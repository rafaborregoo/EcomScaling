// AI-07: memoria acumulativa del consultor experto. Outbox asincrono e
// idempotente -- decideSummary/addTaskComment/decideAgentOutput solo llaman a
// enqueueMemoryIngestion (nunca a Voyage directamente); processMemoryIngestionQueue
// corre en un job de worker aparte (mismo patron que ops-health-check-once.ts).
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { chunkText, VoyageEmbeddingProvider } from "@ecomscaling/ai";
import { createLogger } from "@ecomscaling/observability";

// Tipo estructural minimo (no LoadedApiEnv completo): cada punto de entrada
// que encola (calls.ts, operations.ts, ai-runtime.ts) tiene su propio tipo de
// entorno mas estrecho, y todos ya incluyen estas dos claves.
type EnqueueEnv = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY?: string };
type ProcessEnv = EnqueueEnv & { VOYAGE_API_KEY?: string };

const logger = createLogger("memory-ingestion");
const EMBEDDING_BATCH_SIZE = 64;
const MAX_ATTEMPTS = 5;
const QUEUE_BATCH_SIZE = 20;

export type MemorySourceType = "call_summary" | "internal_note" | "ai_output_decision";
export type MemoryAudience = "client_visible" | "consultant_only" | "system_only";
export type MemoryOrigin = "human_authored" | "human_approved_ai" | "human_decision";
export type MemoryAuthority = "canonical" | "operational" | "contextual";

function createServiceClient(env: EnqueueEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export interface EnqueueMemoryIngestionInput {
  organizationId: string;
  storeId: string | null;
  sourceType: MemorySourceType;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceVersion?: number;
  sourceActorId: string | null;
  audience: MemoryAudience;
  origin: MemoryOrigin;
  authority: MemoryAuthority;
  title: string;
  content: string;
}

/**
 * Encola una fuente de memoria (resumen publicado, nota interna, decision
 * sobre salida de IA) para indexacion asincrona. Nunca falla la accion humana
 * que la origina: si Voyage esta caido, la fila queda pendiente y un worker
 * la reintenta. Idempotente por (organization_id, source_type,
 * source_entity_id, source_version) -- volver a llamar con los mismos valores
 * no duplica nada.
 */
export async function enqueueMemoryIngestion(env: EnqueueEnv, input: EnqueueMemoryIngestionInput) {
  const supabase = createServiceClient(env);
  const sourceVersion = input.sourceVersion ?? 1;

  if (sourceVersion > 1) {
    // Ciclo de vida (criterio de cierre): una version mas nueva de la misma
    // fuente sustituye a la anterior, nunca queda duplicada.
    await supabase
      .from("knowledge_documents")
      .update({ status: "superseded" })
      .eq("organization_id", input.organizationId)
      .eq("source_type", input.sourceType)
      .eq("source_entity_id", input.sourceEntityId)
      .lt("source_version", sourceVersion)
      .in("status", ["pending_indexing", "active"]);
  }

  const { data: queueRow, error: queueError } = await supabase
    .from("memory_ingestion_queue")
    .upsert(
      {
        organization_id: input.organizationId,
        store_id: input.storeId,
        source_type: input.sourceType,
        source_entity_type: input.sourceEntityType,
        source_entity_id: input.sourceEntityId,
        source_version: sourceVersion,
        source_actor_id: input.sourceActorId,
        audience: input.audience,
        origin: input.origin,
        authority: input.authority,
        title: input.title.slice(0, 255),
        content: input.content,
      },
      {
        onConflict: "organization_id,source_type,source_entity_id,source_version",
        ignoreDuplicates: true,
      },
    )
    .select("id")
    .maybeSingle();

  if (queueError) {
    // La accion humana (publicar resumen/nota/decision) nunca falla por esto:
    // solo se registra, no se propaga al llamador.
    logger.error("memory_ingestion_enqueue_failed", {
      error: queueError.message,
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceEntityId: input.sourceEntityId,
    });
    return { ok: false as const, error: queueError.message };
  }

  if (!queueRow) {
    // Conflicto de idempotencia: ya existia una fila para esta fuente/version.
    return { ok: true as const, duplicate: true as const };
  }

  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .insert({
      organization_id: input.organizationId,
      store_id: input.storeId,
      title: input.title.slice(0, 255),
      source_type: input.sourceType,
      visibility: "organization",
      audience: input.audience,
      origin: input.origin,
      authority: input.authority,
      status: "pending_indexing",
      checksum: `pending-${queueRow.id}`,
      source_actor_id: input.sourceActorId,
      ingested_by: "system",
      source_entity_type: input.sourceEntityType,
      source_entity_id: input.sourceEntityId,
      source_version: sourceVersion,
      source_event_id: null,
    })
    .select("id")
    .single();

  if (documentError || !document) {
    logger.error("memory_ingestion_document_placeholder_failed", {
      error: documentError?.message,
      queueId: queueRow.id,
    });
    return { ok: false as const, error: documentError?.message ?? "document_placeholder_failed" };
  }

  await supabase.from("memory_ingestion_queue").update({ document_id: document.id }).eq("id", queueRow.id);

  return { ok: true as const, queueId: queueRow.id, documentId: document.id };
}

/**
 * Procesa filas pendientes del outbox: genera embeddings, crea los chunks, y
 * marca el documento placeholder como active/indexing_failed. Job corto para
 * cron (GitHub Actions), no requiere BullMQ -- mismo patron que
 * ops-health-check/shopify-reconcile.
 */
export async function processMemoryIngestionQueue(env: ProcessEnv) {
  const supabase = createServiceClient(env);
  const result = { processed: 0, failed: 0, skipped: 0 };

  if (!env.VOYAGE_API_KEY) {
    logger.info("memory_ingestion_skipped_no_voyage_key");
    return result;
  }

  const embeddings = new VoyageEmbeddingProvider(env.VOYAGE_API_KEY);

  const { data: rows, error } = await supabase
    .from("memory_ingestion_queue")
    .select("id, organization_id, store_id, title, content, document_id, attempts")
    .or(`status.eq.pending,and(status.eq.failed,attempts.lt.${MAX_ATTEMPTS})`)
    .order("created_at", { ascending: true })
    .limit(QUEUE_BATCH_SIZE);

  if (error) {
    logger.error("memory_ingestion_queue_load_failed", { error: error.message });
    return result;
  }

  for (const row of rows ?? []) {
    if (!row.document_id) {
      result.skipped += 1;
      continue;
    }

    try {
      const chunks = chunkText(row.content);

      if (chunks.length === 0) {
        throw new Error("contenido_vacio_tras_chunking");
      }

      const vectors: number[][] = [];
      for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
        const embedded = await embeddings.embed(batch, "document");
        vectors.push(...embedded);
      }

      const { error: chunksError } = await supabase.from("knowledge_chunks").insert(
        chunks.map((chunk, index) => ({
          document_id: row.document_id,
          organization_id: row.organization_id,
          chunk_index: index,
          content: chunk,
          token_count: Math.ceil(chunk.length / 4),
          embedding: JSON.stringify(vectors[index]),
        })),
      );

      if (chunksError) {
        throw new Error(chunksError.message);
      }

      await supabase
        .from("knowledge_documents")
        .update({ status: "active", embedding_model: embeddings.model })
        .eq("id", row.document_id);

      await supabase
        .from("memory_ingestion_queue")
        .update({ status: "processed", processed_at: new Date().toISOString(), attempts: row.attempts + 1 })
        .eq("id", row.id);

      result.processed += 1;
    } catch (processError) {
      const message = processError instanceof Error ? processError.message : "unknown_error";

      await supabase
        .from("knowledge_documents")
        .update({ status: "indexing_failed" })
        .eq("id", row.document_id);

      await supabase
        .from("memory_ingestion_queue")
        .update({ status: "failed", last_error: message.slice(0, 500), attempts: row.attempts + 1 })
        .eq("id", row.id);

      logger.error("memory_ingestion_row_failed", { queueId: row.id, error: message });
      result.failed += 1;
    }
  }

  return result;
}
