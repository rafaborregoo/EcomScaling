/**
 * ADR-0025: checkpointer de LangGraph sobre tablas propias de Supabase.
 *
 * Cada instancia queda atada a UNA campaña (organization_id, store_id,
 * sequence_id) y rechaza cualquier thread_id distinto: no hay forma de leer
 * ni reanudar el hilo de otra organizacion o tienda a traves de el.
 * La persistencia va detras de `CheckpointRowStore` para probar la logica del
 * saver con un almacen en memoria; el de Supabase es una capa fina.
 */
import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  copyCheckpoint,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MailingCheckpointScope = {
  organizationId: string;
  storeId: string | null;
  sequenceId: string;
};

export type CheckpointRow = {
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  checkpoint_type: string;
  checkpoint: string;
  metadata_type: string;
  metadata: string;
};

export type CheckpointWriteRow = {
  checkpoint_ns: string;
  checkpoint_id: string;
  task_id: string;
  idx: number;
  channel: string;
  value_type: string;
  value: string;
};

export interface CheckpointRowStore {
  /** Ultimo checkpoint del namespace si no se pasa id. */
  getCheckpoint(ns: string, id?: string): Promise<CheckpointRow | null>;
  /** Orden descendente por checkpoint_id. */
  listCheckpoints(options: { ns?: string; id?: string; before?: string; limit?: number }): Promise<CheckpointRow[]>;
  getWrites(ns: string, id: string): Promise<CheckpointWriteRow[]>;
  putCheckpoint(row: CheckpointRow): Promise<void>;
  /** overwrite=false: no pisa una escritura ya guardada (idx >= 0). */
  putWrites(rows: CheckpointWriteRow[], overwrite: boolean): Promise<void>;
  deleteAll(): Promise<void>;
  /**
   * Borra todo checkpoint y escritura salvo el ultimo de la raiz (namespace vacio).
   * Con la campaña cerrada, ese guarda el estado final y los demas solo pesan.
   */
  pruneExceptLatest(): Promise<void>;
}

const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const decode = (text: string) => new Uint8Array(Buffer.from(text, "base64"));

export class MailingCampaignCheckpointSaver extends BaseCheckpointSaver {
  constructor(
    private readonly store: CheckpointRowStore,
    private readonly scope: MailingCheckpointScope,
  ) {
    super();
  }

  private threadId(config: RunnableConfig) {
    const threadId = config.configurable?.thread_id;
    if (threadId !== this.scope.sequenceId) {
      throw new Error("mailing_checkpoint_thread_out_of_scope");
    }
    return threadId as string;
  }

  private async toTuple(threadId: string, row: CheckpointRow): Promise<CheckpointTuple> {
    const writes = await this.store.getWrites(row.checkpoint_ns, row.checkpoint_id);
    const pendingWrites: CheckpointPendingWrite[] = await Promise.all(
      writes.map(async (write) => [
        write.task_id,
        write.channel,
        await this.serde.loadsTyped(write.value_type, decode(write.value)),
      ] as CheckpointPendingWrite),
    );
    return {
      config: { configurable: { thread_id: threadId, checkpoint_ns: row.checkpoint_ns, checkpoint_id: row.checkpoint_id } },
      checkpoint: (await this.serde.loadsTyped(row.checkpoint_type, decode(row.checkpoint))) as Checkpoint,
      metadata: (await this.serde.loadsTyped(row.metadata_type, decode(row.metadata))) as CheckpointMetadata,
      pendingWrites,
      ...(row.parent_checkpoint_id
        ? { parentConfig: { configurable: { thread_id: threadId, checkpoint_ns: row.checkpoint_ns, checkpoint_id: row.parent_checkpoint_id } } }
        : {}),
    };
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = this.threadId(config);
    const row = await this.store.getCheckpoint(
      config.configurable?.checkpoint_ns ?? "",
      config.configurable?.checkpoint_id,
    );
    return row ? this.toTuple(threadId, row) : undefined;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const threadId = this.threadId(config);
    const rows = await this.store.listCheckpoints({
      ns: config.configurable?.checkpoint_ns,
      id: config.configurable?.checkpoint_id,
      before: options?.before?.configurable?.checkpoint_id,
    });
    let remaining = options?.limit;
    for (const row of rows) {
      const tuple = await this.toTuple(threadId, row);
      const filter = options?.filter;
      if (filter && !Object.entries(filter).every(([key, value]) => (tuple.metadata as Record<string, unknown>)?.[key] === value)) continue;
      if (remaining !== undefined) {
        if (remaining <= 0) break;
        remaining -= 1;
      }
      yield tuple;
    }
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<RunnableConfig> {
    const threadId = this.threadId(config);
    const ns = config.configurable?.checkpoint_ns ?? "";
    const [[checkpointType, checkpointBytes], [metadataType, metadataBytes]] = await Promise.all([
      this.serde.dumpsTyped(copyCheckpoint(checkpoint)),
      this.serde.dumpsTyped(metadata),
    ]);
    await this.store.putCheckpoint({
      checkpoint_ns: ns,
      checkpoint_id: checkpoint.id,
      parent_checkpoint_id: config.configurable?.checkpoint_id ?? null,
      checkpoint_type: checkpointType,
      checkpoint: encode(checkpointBytes),
      metadata_type: metadataType,
      metadata: encode(metadataBytes),
    });
    return { configurable: { thread_id: threadId, checkpoint_ns: ns, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    this.threadId(config);
    const checkpointId = config.configurable?.checkpoint_id;
    if (!checkpointId) throw new Error("mailing_checkpoint_writes_without_checkpoint_id");
    const ns = config.configurable?.checkpoint_ns ?? "";
    const rows = await Promise.all(
      writes.map(async ([channel, value], index) => {
        const [valueType, bytes] = await this.serde.dumpsTyped(value);
        return {
          checkpoint_ns: ns,
          checkpoint_id: checkpointId,
          task_id: taskId,
          idx: (WRITES_IDX_MAP as Record<string, number>)[channel] ?? index,
          channel,
          value_type: valueType,
          value: encode(bytes),
        };
      }),
    );
    // Igual que MemorySaver: las escrituras normales no se pisan (una tarea
    // repetida tras un fallo no duplica); las especiales (error, interrupt,
    // resume) si, porque la ultima es la que vale.
    const special = rows.filter((row) => row.idx < 0);
    const regular = rows.filter((row) => row.idx >= 0);
    if (regular.length) await this.store.putWrites(regular, false);
    if (special.length) await this.store.putWrites(special, true);
  }

  /** Al cerrar la campaña: conserva solo el ultimo checkpoint. */
  async pruneKeepingLatest(): Promise<void> {
    await this.store.pruneExceptLatest();
  }

  async deleteThread(threadId: string): Promise<void> {
    this.threadId({ configurable: { thread_id: threadId } });
    await this.store.deleteAll();
  }
}

/** Almacen real: toda lectura y escritura filtra por organizacion, tienda y campaña. */
export function createSupabaseCheckpointStore(
  supabase: SupabaseClient,
  scope: MailingCheckpointScope,
  mutate?: (operation: string, payload: unknown) => Promise<void>,
): CheckpointRowStore {
  // any: los builders de supabase-js tienen tipos demasiado profundos para un helper generico.
  const scoped = (query: any): any => {
    const byOrg = query.eq("organization_id", scope.organizationId).eq("thread_id", scope.sequenceId);
    return scope.storeId ? byOrg.eq("store_id", scope.storeId) : byOrg.is("store_id", null);
  };
  const write = (operation: string, payload: unknown = {}) => {
    if (!mutate) throw new Error("mailing_checkpoint_lease_required");
    return mutate(operation, payload);
  };
  const checkpointColumns =
    "checkpoint_ns, checkpoint_id, parent_checkpoint_id, checkpoint_type, checkpoint, metadata_type, metadata";
  const fail = (error: { message: string } | null, label: string) => {
    if (error) throw new Error(`${label}: ${error.message}`);
  };
  return {
    async getCheckpoint(ns, id) {
      let query = scoped(supabase.from("mailing_campaign_checkpoints").select(checkpointColumns)).eq("checkpoint_ns", ns);
      query = id ? query.eq("checkpoint_id", id) : query.order("checkpoint_id", { ascending: false }).limit(1);
      const { data, error } = await query;
      fail(error, "mailing_checkpoint_read_failed");
      return ((data ?? [])[0] as CheckpointRow | undefined) ?? null;
    },
    async listCheckpoints({ ns, id, before, limit }) {
      let query = scoped(supabase.from("mailing_campaign_checkpoints").select(checkpointColumns));
      if (ns !== undefined) query = query.eq("checkpoint_ns", ns);
      if (id) query = query.eq("checkpoint_id", id);
      if (before) query = query.lt("checkpoint_id", before);
      query = query.order("checkpoint_id", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      fail(error, "mailing_checkpoint_list_failed");
      return (data ?? []) as CheckpointRow[];
    },
    async getWrites(ns, id) {
      const { data, error } = await scoped(
        supabase
          .from("mailing_campaign_checkpoint_writes")
          .select("checkpoint_ns, checkpoint_id, task_id, idx, channel, value_type, value"),
      )
        .eq("checkpoint_ns", ns)
        .eq("checkpoint_id", id)
        .order("task_id", { ascending: true })
        .order("idx", { ascending: true });
      fail(error, "mailing_checkpoint_writes_read_failed");
      return (data ?? []) as CheckpointWriteRow[];
    },
    async putCheckpoint(row) {
      await write("checkpoint", row);
    },
    async putWrites(rows, overwrite) {
      await write("writes", { rows, overwrite });
    },
    async pruneExceptLatest() {
      await write("prune");
    },
    async deleteAll() {
      throw new Error("mailing_checkpoint_deletion_not_supported");
    },
  };
}

/** Almacen en memoria para tests (mismo contrato que el de Supabase). */
export function createMemoryCheckpointStore(): CheckpointRowStore & { rows: CheckpointRow[]; writes: CheckpointWriteRow[] } {
  const rows: CheckpointRow[] = [];
  const writes: CheckpointWriteRow[] = [];
  const desc = (list: CheckpointRow[]) => [...list].sort((a, b) => b.checkpoint_id.localeCompare(a.checkpoint_id));
  return {
    rows,
    writes,
    async getCheckpoint(ns, id) {
      return desc(rows.filter((row) => row.checkpoint_ns === ns && (!id || row.checkpoint_id === id)))[0] ?? null;
    },
    async listCheckpoints({ ns, id, before, limit }) {
      return desc(rows.filter((row) =>
        (ns === undefined || row.checkpoint_ns === ns) &&
        (!id || row.checkpoint_id === id) &&
        (!before || row.checkpoint_id < before),
      )).slice(0, limit ?? undefined);
    },
    async getWrites(ns, id) {
      return writes
        .filter((write) => write.checkpoint_ns === ns && write.checkpoint_id === id)
        .sort((a, b) => a.task_id.localeCompare(b.task_id) || a.idx - b.idx);
    },
    async putCheckpoint(row) {
      const index = rows.findIndex((item) => item.checkpoint_ns === row.checkpoint_ns && item.checkpoint_id === row.checkpoint_id);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
    },
    async putWrites(newRows, overwrite) {
      for (const row of newRows) {
        const index = writes.findIndex((item) =>
          item.checkpoint_ns === row.checkpoint_ns && item.checkpoint_id === row.checkpoint_id &&
          item.task_id === row.task_id && item.idx === row.idx);
        if (index < 0) writes.push(row);
        else if (overwrite) writes[index] = row;
      }
    },
    async pruneExceptLatest() {
      const latest = desc(rows.filter((row) => row.checkpoint_ns === ""))[0];
      if (!latest) return;
      for (const list of [rows, writes] as Array<Array<{ checkpoint_id: string }>>) {
        for (let index = list.length - 1; index >= 0; index -= 1) {
          if (list[index]!.checkpoint_id !== latest.checkpoint_id) list.splice(index, 1);
        }
      }
    },
    async deleteAll() {
      rows.splice(0);
      writes.splice(0);
    },
  };
}
