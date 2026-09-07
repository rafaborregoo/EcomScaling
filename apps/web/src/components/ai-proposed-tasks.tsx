"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  CheckIcon,
  CloseIcon,
  IconChevronDown,
  Input,
  Textarea,
  toast,
  type Tone,
} from "@/components/ui";

export type ProposedEvidence = {
  label: string;
  value: string;
  period: string | null;
  source: string;
};

export type ProposedTask = {
  area: "shopify" | "meta" | "klaviyo";
  title: string;
  rationale: string;
  description: string;
  priority: string;
  phase: string | null;
  pending_approval: boolean;
  output_id: string;
  write_index: number;
  evidence: ProposedEvidence[];
};

export type ProposedTasksClient = {
  organization_id: string;
  display_name: string;
  attention_score: number;
  tasks: ProposedTask[];
};

// El canal se nombra por la plataforma, no por el medio: junto a tareas de
// Shopify y Meta, "Email" no dice en que herramienta se trabaja.
export const AREA_LABEL: Record<ProposedTask["area"], string> = {
  shopify: "Shopify",
  meta: "Meta Ads",
  klaviyo: "Klaviyo",
};

export const AREA_TONE: Record<ProposedTask["area"], Tone> = {
  shopify: "success",
  meta: "brand",
  klaviyo: "warn",
};

/**
 * Las cifras que sostienen una tarea propuesta. El consultor decide sobre el
 * dato, no sobre la prosa del agente: por eso van visibles y no plegadas.
 */
export function EvidenceChips({
  evidence,
}: {
  evidence: ProposedEvidence[];
}) {
  if (!evidence.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {evidence.map((item, index) => (
        <li
          key={index}
          className="rounded-md border border-separator px-2 py-1 text-xs"
          title={[item.source, item.period].filter(Boolean).join(" · ")}
        >
          <span className="text-muted">{item.label}: </span>
          <span className="font-medium text-foreground">{item.value}</span>
          {item.period ? (
            <span className="text-muted"> ({item.period})</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "baja",
  medium: "media",
  high: "alta",
  urgente: "urgente",
  urgent: "urgente",
};

function priorityTone(priority: string): Tone {
  if (["urgent", "high"].includes(priority)) return "danger";
  if (priority === "medium") return "warn";
  return "neutral";
}

/**
 * Una propuesta de la IA como fila de la lista de tareas, con la misma forma
 * que TaskRow (`/tareas`): badge, titulo, linea de meta y acciones a la
 * derecha. Se distingue con un badge "IA" y nada mas -- el consultor las lee
 * en el mismo sitio y con el mismo gesto que el resto del backlog.
 */
export function ProposedTaskRow({
  task,
  isPending,
  isExpanded,
  approveHint,
  clientName,
  children,
  onToggle,
  onApprove,
  onDiscard,
}: {
  task: ProposedTask;
  isPending: boolean;
  isExpanded: boolean;
  /** Texto del tooltip de aceptar: dice cuantas tareas se van a crear. */
  approveHint: string;
  clientName?: string | undefined;
  children: ReactNode;
  onToggle: () => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  // El canal sale de la linea meta y sube a badge: junto a tareas de otras
  // plataformas, saber si es Shopify, Klaviyo o Meta es lo primero que hay que
  // distinguir, y en gris pequeño se perdia.
  const meta = [
    "propuesta sin aprobar",
    task.phase ?? "tarea libre",
    task.evidence.length
      ? `${task.evidence[0]?.label}: ${task.evidence[0]?.value}`
      : null,
  ].filter(Boolean);

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-4">
        {/* Toda la fila abre el detalle: pulsar en cualquier sitio, no en un
            enlace concreto. Los botones de decidir van fuera del boton para no
            anidar controles. */}
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <IconChevronDown
              aria-hidden
              className={`size-3 shrink-0 text-muted transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
            <Badge tone="brand">IA</Badge>
            <Badge tone={AREA_TONE[task.area]}>{AREA_LABEL[task.area]}</Badge>
            {["urgent", "high"].includes(task.priority) ? (
              <Badge tone={priorityTone(task.priority)}>
                {PRIORITY_LABEL[task.priority] ?? task.priority}
              </Badge>
            ) : null}
            <span className="truncate text-sm font-medium text-foreground">
              {task.title}
            </span>
          </div>
          {/* El cliente, como texto con peso propio: en badge gris competia con
              los badges que si clasifican la tarea y no se leia. */}
          <p className="mt-0.5 text-xs text-muted">
            {clientName ? (
              <>
                <span className="font-medium text-foreground">
                  {clientName}
                </span>
                {" · "}
              </>
            ) : null}
            {meta.join(" · ")}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={onApprove}
            title={approveHint}
            aria-label={approveHint}
            className="rounded-full p-1.5 text-success transition-colors hover:bg-success/10 disabled:opacity-40"
          >
            <CheckIcon aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onDiscard}
            title="Descartar esta propuesta"
            aria-label="Descartar esta propuesta"
            className="rounded-full p-1.5 text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
          >
            <CloseIcon aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      {isExpanded ? <div className="mt-3 pl-5">{children}</div> : null}
    </div>
  );
}

/**
 * Carga las tareas que los agentes proponen para toda la cartera del
 * consultor. Se comparte entre la rejilla de "Vista general" (que solo
 * necesita el recuento por cliente) y la tarjeta de aprobacion.
 */
export function useProposedTasks({ enabled = true }: { enabled?: boolean } = {}) {
  const [clients, setClients] = useState<ProposedTasksClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // El endpoint es de consultor: pedirlo como cliente solo gasta un 403 por
    // carga de pagina.
    if (!enabled) return;
    try {
      const response = await apiFetch("/v1/consultant/proposed-tasks");
      if (!response.ok) {
        setError("No se pudieron cargar las tareas propuestas por la IA.");
        return;
      }
      const payload = (await response.json()) as {
        clients?: ProposedTasksClient[];
      };
      setClients(payload.clients ?? []);
      setError(null);
    } catch {
      setError("No se pudieron cargar las tareas propuestas por la IA.");
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Propuestas sin decidir por organizacion, para los contadores. */
  const pendingByOrg = useMemo(() => {
    const counts = new Map<string, number>();
    for (const client of clients ?? []) {
      const pending = client.tasks.filter(
        (task) => task.pending_approval,
      ).length;
      if (pending > 0) counts.set(client.organization_id, pending);
    }
    return counts;
  }, [clients]);

  return { clients, error, reload, pendingByOrg };
}

type Draft = {
  title: string;
  description: string;
  priority: string;
  skip: boolean;
};

const draftKey = (task: ProposedTask) =>
  `${task.output_id}:${task.write_index}`;

/**
 * Modal de una propuesta: lo que no cabe en la fila. El consultor lee el porque
 * y las cifras, ajusta titulo/descripcion si quiere, y decide.
 */
function ProposedTaskDetail({
  task,
  draft,
  onPatch,
}: {
  task: ProposedTask;
  draft: Draft;
  onPatch: (patch: Partial<Draft>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">IA</Badge>
        <Badge tone={AREA_TONE[task.area]}>{AREA_LABEL[task.area]}</Badge>
        <Badge tone={priorityTone(draft.priority)}>
          {PRIORITY_LABEL[draft.priority] ?? draft.priority}
        </Badge>
      </div>

      <div className="space-y-2">
        <Input
          aria-label="Título de la tarea"
          value={draft.title}
          onChange={(event) => onPatch({ title: event.target.value })}
        />
        <Textarea
          aria-label="Descripción de la tarea"
          rows={4}
          value={draft.description}
          onChange={(event) => onPatch({ description: event.target.value })}
        />
      </div>

      {/* El porque lo pone el agente y no se edita: es la trazabilidad de en
          que se apoyo para proponerla. */}
      {task.rationale || task.evidence.length ? (
        <div className="border-t border-separator pt-3">
          {task.rationale ? (
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-medium">Por qué: </span>
              {task.rationale}
            </p>
          ) : null}
          <EvidenceChips evidence={task.evidence} />
        </div>
      ) : null}

      <p className="text-xs text-muted">
        {task.phase ? (
          <>
            Mi Camino:{" "}
            <span className="font-medium text-accent">{task.phase}</span>
          </>
        ) : (
          "Tarea libre · no influye en ninguna rama"
        )}
      </p>
    </div>
  );
}

/**
 * Propuestas de la IA como filas de tarea, para leerlas y decidirlas en el
 * mismo sitio y con el mismo gesto que el backlog real.
 *
 * Aprobar materializa la SALIDA completa del agente (`output_id`), no una fila
 * suelta: la decision se registra una sola vez en `agent_approvals` y no hay
 * estado por propuesta. Por eso, cuando una salida trae varias, el boton dice
 * cuantas tareas va a crear en vez de aparentar que solo crea esa.
 */
export function ProposedTasksList({
  clients,
  activeClientId,
  onApproved,
}: {
  clients: ProposedTasksClient[] | null;
  /** Id de organizacion, o "all" para toda la cartera. */
  activeClientId: string;
  onApproved: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pendingOutputId, setPendingOutputId] = useState<string | null>(null);

  const rows = (clients ?? [])
    .filter(
      (client) =>
        activeClientId === "all" || client.organization_id === activeClientId,
    )
    .flatMap((client) =>
      client.tasks
        .filter((task) => task.pending_approval)
        .map((task) => ({ client, task })),
    );

  const draftFor = (task: ProposedTask): Draft =>
    drafts[draftKey(task)] ?? {
      title: task.title,
      description: task.description,
      priority: task.priority,
      skip: false,
    };

  function patchDraft(task: ProposedTask, patch: Partial<Draft>) {
    setDrafts((previous) => ({
      ...previous,
      [draftKey(task)]: { ...draftFor(task), ...patch },
    }));
  }

  /** Cuantas propuestas comparten salida con esta: se crean todas juntas. */
  const siblingsOf = (task: ProposedTask) =>
    rows.filter((row) => row.task.output_id === task.output_id).length;

  async function approve(organizationId: string, outputId: string) {
    setPendingOutputId(outputId);
    try {
      // Solo viajan las entradas realmente tocadas: el resto se crea tal como
      // las propuso el agente.
      const edits = rows
        .filter((row) => row.task.output_id === outputId)
        .map(({ task }) => {
          const draft = drafts[draftKey(task)];
          if (!draft) return null;
          if (draft.skip) return { index: task.write_index, skip: true };
          const changed =
            draft.title !== task.title ||
            draft.description !== task.description ||
            draft.priority !== task.priority;
          if (!changed) return null;
          return {
            index: task.write_index,
            title: draft.title,
            description: draft.description,
            priority: draft.priority,
          };
        })
        .filter((edit): edit is NonNullable<typeof edit> => edit !== null);

      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/outputs/${outputId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: "approved",
            ...(edits.length ? { edits } : {}),
          }),
        },
      );

      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as { tasks_created?: number };
      toast.success(
        payload.tasks_created
          ? `${payload.tasks_created} tarea(s) creada(s).`
          : "Sin tareas nuevas que crear.",
      );

      onApproved();
    } catch {
      toast.danger("No se pudo aprobar por un error de red. Reintenta.");
    } finally {
      setPendingOutputId(null);
    }
  }

  /**
   * Cruz roja. La decision se registra por salida, asi que:
   *  - si la propuesta es la unica viva de su salida, se rechaza la salida;
   *  - si tiene hermanas, se marca como descartada y desaparece de la lista;
   *    al aceptar cualquiera de las hermanas viaja como `skip` y no se crea.
   */
  async function discard(
    organizationId: string,
    task: ProposedTask,
    siblingsAlive: number,
  ) {
    if (siblingsAlive > 1) {
      patchDraft(task, { skip: true });
      return;
    }

    setPendingOutputId(task.output_id);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/outputs/${task.output_id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "rejected" }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Propuesta descartada.");
      onApproved();
    } catch {
      toast.danger("No se pudo descartar por un error de red. Reintenta.");
    } finally {
      setPendingOutputId(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map(({ client, task }) => {
        const key = draftKey(task);
        const siblings = siblingsOf(task);
        return (
          <ProposedTaskRow
            key={key}
            task={{ ...task, ...draftFor(task) }}
            isPending={pendingOutputId === task.output_id}
            isExpanded={expandedKey === key}
            approveHint={
              siblings > 1
                ? `Aceptar y crear ${siblings} tareas`
                : "Aceptar y crear la tarea"
            }
            clientName={
              activeClientId === "all" ? client.display_name : undefined
            }
            onToggle={() =>
              setExpandedKey((previous) => (previous === key ? null : key))
            }
            onApprove={() =>
              void approve(client.organization_id, task.output_id)
            }
            onDiscard={() =>
              void discard(client.organization_id, task, siblings)
            }
          >
            <ProposedTaskDetail
              task={task}
              draft={draftFor(task)}
              onPatch={(patch) => patchDraft(task, patch)}
            />
          </ProposedTaskRow>
        );
      })}
    </>
  );
}
