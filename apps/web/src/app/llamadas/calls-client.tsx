"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { displayValue } from "@/lib/display-labels";
import { A01_CAMPAIGN_BRIEF_KEY, A01_CAMINO_BRIEF_KEY, serializeA01BriefHandoff } from "@/lib/a01-call-handoff";
import { isSummaryCurrentForTranscript } from "./summary-visibility";
import { callStage } from "./call-stage";
import {
  callTaskAudience,
  callTaskStatusLabel,
  type CallTaskAudience,
} from "./call-task-view-model";
import { ModuleSummary } from "@/components/module-summary";
import { daysSince, isUpcoming } from "@/lib/elapsed";
import {
  LoadingBlock,
  Heading,
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  List,
  Modal,
  Select,
  Textarea,
  toast,
  type Tone,
} from "@/components/ui";

type CallTranscript = {
  id: string;
  version: number;
  source: string;
  is_current: boolean;
  content: string;
  created_at: string;
};

// Detalle estructurado que produce el agente A01 (guardado en key_points).
// Un resumen manual guarda key_points como string[] (o null); uno de A01 guarda
// este objeto. El render distingue ambos casos.
type CallSummaryDetail = {
  facts?: string[];
  recommendations?: Array<{
    action: string;
    priority: string;
    rationale: string;
  }>;
  risks?: string[];
  key_quotes?: string[];
  proposed_tasks?: Array<{
    title: string;
    description: string;
    priority: string;
    owner: string;
  }>;
  proposed_campaign_ideas?: Array<{
    objective: string;
    audience: string;
    timing_hint: string | null;
    evidence_quote: string;
  }>;
  proposed_camino_changes?: Array<{
    change: string;
    rationale: string;
    evidence_quote: string;
  }>;
  // AI-15. Los dos son internos: la API los recorta antes de servir la llamada
  // a un cliente (`redactConsultantOnly`), y aquí solo se pintan si
  // `isConsultant`. Opcionales porque los resúmenes anteriores a AI-15 no los
  // tienen.
  consultant_gaps?: Array<{
    topic: string;
    why_it_matters: string;
    evidence: string;
    severity: string;
  }>;
  conversation_signals?: Array<{
    label: string;
    value: string;
    about: string;
    reading: string;
    trend: string;
  }>;
  sources?: Array<{
    kind: string;
    reference: string;
    period: string | null;
  }>;
  confidence?: string;
  warnings?: string[];
};

function A01Handoffs({
  organizationId,
  detail,
}: {
  organizationId: string;
  detail: CallSummaryDetail;
}) {
  const campaigns = detail.proposed_campaign_ideas ?? [];
  const caminoChanges = detail.proposed_camino_changes ?? [];
  if (!campaigns.length && !caminoChanges.length) return null;

  const campaignBrief = (item: (typeof campaigns)[number]) =>
    `Objetivo acordado: ${item.objective}\nAudiencia: ${item.audience}\nCuándo: ${item.timing_hint ?? "No se fijó una fecha"}\nCita de la llamada: “${item.evidence_quote}”`;
  const caminoBrief = (item: (typeof caminoChanges)[number]) =>
    `Cambio acordado: ${item.change}\nMotivo: ${item.rationale}\nCita de la llamada: “${item.evidence_quote}”`;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-separator bg-surface-subtle p-4">
      <h3 className="text-sm font-semibold">Continuar lo acordado</h3>
      {campaigns.map((item, index) => (
        <div key={`campaign-${index}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Preparar campaña · {item.objective}</p>
            <p className="mt-1 text-xs text-muted">{item.audience}{item.timing_hint ? ` · ${item.timing_hint}` : ""}</p>
            <p className="mt-1 text-xs text-muted">«{item.evidence_quote}»</p>
          </div>
          <Link
            href="/marketing?section=plan&openCampaignPlan=1"
            onClick={() => window.sessionStorage.setItem(A01_CAMPAIGN_BRIEF_KEY, serializeA01BriefHandoff(organizationId, campaignBrief(item)))}
            className="shrink-0"
          >Abrir A05 · Plan de campañas</Link>
        </div>
      ))}
      {caminoChanges.map((item, index) => (
        <div key={`camino-${index}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Revisar cambio del Camino · {item.change}</p>
            <p className="mt-1 text-xs text-muted">{item.rationale}</p>
            <p className="mt-1 text-xs text-muted">«{item.evidence_quote}»</p>
          </div>
          <Link
            href="/camino?fromCall=1"
            onClick={() => window.sessionStorage.setItem(A01_CAMINO_BRIEF_KEY, serializeA01BriefHandoff(organizationId, caminoBrief(item)))}
            className="shrink-0"
          >Abrir A19 · Camino</Link>
        </div>
      ))}
      <p className="text-xs text-muted">El agente especialista contrastará el brief con los datos actuales. No se crea ni modifica nada hasta revisar y confirmar su propuesta.</p>
    </div>
  );
}

type CallSummary = {
  id: string;
  transcript_id: string | null;
  summary: string;
  key_points: string[] | CallSummaryDetail | null;
  agreed_actions: string[] | null;
  run_id: string | null;
  status: "draft" | "pending_approval" | "published" | "rejected";
  approved_at: string | null;
  published_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

function isCallSummaryDetail(
  value: CallSummary["key_points"],
): value is CallSummaryDetail {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

const priorityLabels: Record<string, string> = {
  low: "baja",
  medium: "media",
  high: "alta",
  urgent: "urgente",
};

function StructuredSummary({
  summary,
  hideProposedTasks = false,
  // Tareas ya materializadas de esta llamada (`call_task_links`), solo para
  // la vista de cliente en un resumen publicado. El cliente no debe ver la
  // lista cruda de `proposed_tasks`: incluye las de owner "consultor" (nunca
  // se le publican) y las que el consultor descartó al aprobar -- ver
  // decideSummary/selectProposedTasks en apps/api/src/calls.ts.
  createdTasksForClient,
}: {
  summary: CallSummary;
  // En la revisión de un resumen pendiente las tareas propuestas se muestran
  // como checklist interactiva aparte (PendingSummaryReview), no aquí.
  hideProposedTasks?: boolean;
  createdTasksForClient?: CallTaskLink[];
}) {
  const detail = isCallSummaryDetail(summary.key_points)
    ? summary.key_points
    : null;
  const decisions = Array.isArray(summary.agreed_actions)
    ? summary.agreed_actions
    : [];

  if (!detail && decisions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 text-sm">
      {detail?.facts?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Hechos</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {detail.facts.map((fact, index) => (
              <li key={index}>{fact}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {decisions.length ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Decisiones</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.recommendations?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Recomendaciones
          </h3>
          <ul className="mt-1 space-y-1">
            {detail.recommendations.map((rec, index) => (
              <li key={index}>
                <span className="font-medium">{rec.action}</span>{" "}
                <span className="text-xs text-muted">
                  ({priorityLabels[rec.priority] ?? rec.priority})
                </span>
                {rec.rationale ? (
                  <span className="text-muted"> — {rec.rationale}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.risks?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Riesgos</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {detail.risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {createdTasksForClient !== undefined ? (
        createdTasksForClient.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Tareas creadas
            </h3>
            <ul className="mt-1 space-y-1">
              {createdTasksForClient.map((link) => (
                <li key={link.id}>{link.tasks?.title ?? link.task_id}</li>
              ))}
            </ul>
          </div>
        ) : null
      ) : !hideProposedTasks && detail?.proposed_tasks?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Tareas propuestas (se crean al aprobar)
          </h3>
          <ul className="mt-1 space-y-1">
            {detail.proposed_tasks.map((task, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-2">
                <span>{task.title}</span>
                <span className="text-xs text-muted">
                  {priorityLabels[task.priority] ?? task.priority} ·{" "}
                  {task.owner}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.warnings?.length ? (
        <div className="rounded-md border border-warn/30 bg-warn/5 p-3">
          <h3 className="text-sm font-semibold text-warn-deep">Avisos</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            {detail.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const GAP_SEVERITY: Record<string, { label: string; tone: Tone }> = {
  high: { label: "Alta", tone: "danger" },
  medium: { label: "Media", tone: "warn" },
  low: { label: "Baja", tone: "neutral" },
};

const TREND_META: Record<string, { label: string; tone: Tone }> = {
  mejora: { label: "Mejora", tone: "success" },
  estable: { label: "Estable", tone: "neutral" },
  empeora: { label: "Empeora", tone: "danger" },
  sin_referencia: { label: "Sin referencia", tone: "neutral" },
};

/**
 * Lectura interna de la llamada: lo que faltó tratar y cómo fue la
 * conversación. No se aprueba nada aquí -- es análisis de solo lectura, así
 * que se muestra directamente (la aprobación es para que la IA ESCRIBA, no
 * para que opine). Nunca se pinta para un cliente, y la API tampoco se lo
 * envía.
 */
function ConsultantCoaching({ detail }: { detail: CallSummaryDetail }) {
  const gaps = detail.consultant_gaps ?? [];
  const signals = detail.conversation_signals ?? [];
  if (gaps.length === 0 && signals.length === 0) return null;

  const aboutConsultant = signals.filter(
    (signal) => signal.about === "consultor",
  );
  const aboutClient = signals.filter((signal) => signal.about !== "consultor");

  return (
    <section className="rounded-md border border-separator p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">Lectura para ti</p>
        <Badge tone="neutral">Solo consultor</Badge>
      </div>

      {gaps.length > 0 ? (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-foreground">
            Lo que no se trató
          </h3>
          <ul className="mt-2 space-y-2">
            {gaps.map((gap, index) => (
              <li
                key={index}
                className="border-t border-separator pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{gap.topic}</span>
                  <Badge tone={GAP_SEVERITY[gap.severity]?.tone ?? "neutral"}>
                    {GAP_SEVERITY[gap.severity]?.label ?? gap.severity}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {gap.why_it_matters}
                </p>
                {/* La evidencia es lo que separa un hueco real de una opinión
                    del modelo: siempre visible, no plegada. */}
                <p className="mt-0.5 text-xs text-muted">
                  <span className="font-medium text-foreground">
                    Por qué lo dice:{" "}
                  </span>
                  {gap.evidence}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {[
            { title: "Cómo llevaste la llamada", rows: aboutConsultant },
            { title: "Cómo llegó el cliente", rows: aboutClient },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-foreground">
                  {group.title}
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.rows.map((signal, index) => (
                    <li key={index} className="text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{signal.label}</span>
                        <span className="tabular-nums text-muted">
                          {signal.value}
                        </span>
                        <Badge
                          tone={TREND_META[signal.trend]?.tone ?? "neutral"}
                        >
                          {TREND_META[signal.trend]?.label ?? signal.trend}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {signal.reading}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}

type CallInternalNote = {
  id: string;
  body: string;
  author_user_id: string;
  created_at: string;
};

type CallTaskLink = {
  id: string;
  task_id: string;
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    is_visible_to_client: boolean;
    metadata: { owner?: string } | null;
  } | null;
};

export type ConsultingCall = {
  id: string;
  title: string;
  call_type: string;
  status: "scheduled" | "held" | "cancelled";
  scheduled_at: string | null;
  held_at: string | null;
  duration_minutes: number | null;
  recording_url: string | null;
  recording_provider: string | null;
  is_visible_to_client: boolean;
  created_at: string;
  call_transcripts: CallTranscript[];
  call_ai_summaries: CallSummary[];
  call_internal_notes: CallInternalNote[];
  call_task_links: CallTaskLink[];
};

const callTypeLabels: Record<string, string> = {
  monthly_review: "Revisión mensual",
  onboarding: "Onboarding",
  strategy: "Estrategia",
  ad_hoc: "Puntual",
};

const callStatusLabels: Record<string, string> = {
  scheduled: "Programada",
  held: "Realizada",
  cancelled: "Cancelada",
};

const summaryStatusLabels: Record<string, string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  published: "Publicado",
  rejected: "Rechazado",
};

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
}

// --- Flujo de una llamada -------------------------------------------------
//
// El modulo tenia todas las piezas (transcripcion, agente A01, aprobacion,
// tareas) pero ninguna decia en que orden van ni por que el boton de la IA
// esta apagado. Aqui se declara el flujo una sola vez y lo usan las dos
// vistas: la fila de la lista (para saberlo sin desplegar) y el detalle (para
// decir cual es el siguiente paso y quien lo hace).

const CONFIDENCE_META: Record<
  string,
  { label: string; tone: "success" | "warn" | "danger" }
> = {
  high: { label: "Confianza alta", tone: "success" },
  medium: { label: "Confianza media", tone: "warn" },
  low: { label: "Confianza baja", tone: "danger" },
};

// Revisión de un resumen A01 pendiente: banda de confianza/avisos arriba,
// resumen + detalle estructurado, y las tareas propuestas como checklist para
// elegir cuáles se materializan al aprobar (el resto no se crea). Rechazar
// exige un motivo, que se guarda y sirve de feedback para el agente.
function PendingSummaryReview({
  summary,
  isBusy,
  milestones,
  onApprove,
  onReject,
}: {
  summary: CallSummary;
  isBusy: boolean;
  /** Hitos de Mi Camino donde puede entrar una tarea del cliente. */
  milestones: { value: string; label: string }[];
  onApprove: (selection: {
    indexes: number[];
    /** índice de la tarea -> hito elegido. */
    milestones: Record<string, string>;
  }) => void;
  onReject: (reason: string) => void;
}) {
  const detail = isCallSummaryDetail(summary.key_points)
    ? summary.key_points
    : null;
  const proposedTasks = detail?.proposed_tasks ?? [];
  const warnings = detail?.warnings ?? [];
  const confidence = detail?.confidence;
  const sources = detail?.sources ?? [];

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(proposedTasks.map((_, index) => index)),
  );
  // Hito de Mi Camino por tarea. Vacío = la tarea se crea suelta, fuera del
  // plan; es una decisión válida, no un olvido, así que no se autorrellena.
  const [taskMilestones, setTaskMilestones] = useState<Record<string, string>>(
    {},
  );
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function approve() {
    const indexes = [...selected];
    // Solo viajan los hitos de tareas que realmente se van a crear.
    const chosen = Object.fromEntries(
      indexes
        .map((index) => [String(index), taskMilestones[String(index)] ?? ""])
        .filter(([, milestoneId]) => milestoneId),
    ) as Record<string, string>;
    onApprove({ indexes, milestones: chosen });
  }

  return (
    <Alert status="warning" className="items-start p-3">
      <Alert.Indicator />
      <Alert.Content className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Alert.Title className="text-xs uppercase">
            {summaryStatusLabels[summary.status]}
            {summary.run_id ? " · IA (A01)" : ""}
          </Alert.Title>
          {confidence && CONFIDENCE_META[confidence] ? (
            <Badge tone={CONFIDENCE_META[confidence].tone}>
              {CONFIDENCE_META[confidence].label}
            </Badge>
          ) : null}
        </div>

        {warnings.length ? (
          <ul className="list-disc space-y-0.5 rounded-md border border-warn/40 bg-warn-tint px-4 py-2 pl-6 text-xs text-warn-deep">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        ) : null}

        {sources.length ? (
          <div className="rounded-md border border-separator bg-surface-subtle p-3">
            <p className="text-xs font-semibold">
              Referencias de conocimiento consultadas
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-muted">
              {sources.map((source, index) => (
                <li key={`${source.reference}-${index}`}>{source.reference}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
          {summary.summary}
        </p>

        <StructuredSummary summary={summary} hideProposedTasks />

        {proposedTasks.length ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Tareas propuestas · marca las que quieras crear al aprobar
            </h3>
            <ul className="mt-2 space-y-1.5">
              {proposedTasks.map((task, index) => {
                const isForClient = task.owner === "cliente";
                const isSelected = selected.has(index);
                return (
                  <li
                    key={index}
                    className="rounded-md border border-separator bg-surface p-2.5 text-sm"
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggle(index)}
                    >
                      <span className="font-medium">{task.title}</span>
                    </Checkbox>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-6">
                      {/* `owner` ya no es decorativo: decide si la tarea entra
                          en el backlog del cliente o nace interna para ti. */}
                      <Badge tone={isForClient ? "neutral" : "brand"}>
                        {isForClient ? "Para el cliente" : "Para ti · interna"}
                      </Badge>
                      <Badge
                        tone={
                          ["urgent", "high"].includes(task.priority)
                            ? "warn"
                            : "neutral"
                        }
                      >
                        {priorityLabels[task.priority] ?? task.priority}
                      </Badge>
                    </div>
                    {task.description ? (
                      <p className="mt-1 pl-6 text-xs text-muted">
                        {task.description}
                      </p>
                    ) : null}
                    {/* Punto de Mi Camino en el que entra. Solo para las del
                        cliente: una tarea interna tuya no es parte del plan de
                        la tienda. */}
                    {isForClient && milestones.length > 0 ? (
                      <div className="mt-2 pl-6">
                        <Select
                          className="w-full sm:w-80"
                          aria-label={`Punto de Mi Camino para «${task.title}»`}
                          disabled={!isSelected}
                          value={taskMilestones[String(index)] ?? ""}
                          onChange={(value) =>
                            setTaskMilestones((current) => ({
                              ...current,
                              [String(index)]: value,
                            }))
                          }
                          options={[
                            { value: "", label: "Fuera del plan" },
                            ...milestones,
                          ]}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {milestones.length === 0 ? (
              <p className="mt-2 text-xs text-muted">
                Esta tienda no tiene un camino activo, así que las tareas se
                crean fuera del plan.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-2">
          <Button size="sm" type="button" disabled={isBusy} onClick={approve}>
            {proposedTasks.length
              ? `Aprobar · ${selected.size}/${proposedTasks.length} tareas`
              : "Aprobar y publicar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={isBusy}
            onClick={() => {
              setRejectReason("");
              setRejectOpen(true);
            }}
          >
            Rechazar
          </Button>
        </div>

        <Modal isOpen={rejectOpen} onOpenChange={setRejectOpen}>
          <Modal.Backdrop>
            <Modal.Container size="md">
              <Modal.Dialog aria-label="Rechazar resumen">
                <Modal.Header>
                  <Modal.Heading>Rechazar resumen</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <Field label="Motivo del rechazo">
                    <Textarea
                      className="h-24"
                      autoFocus
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Qué falló o qué debería corregir el análisis. Queda registrado y sirve de feedback."
                    />
                  </Field>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRejectOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={isBusy || !rejectReason.trim()}
                    onClick={() => {
                      onReject(rejectReason.trim());
                      setRejectOpen(false);
                    }}
                  >
                    Rechazar resumen
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </Alert.Content>
    </Alert>
  );
}

export function CallDetail({
  call,
  isConsultant,
  onChanged,
  priorCalls = [],
}: {
  call: ConsultingCall;
  isConsultant: boolean;
  onChanged: () => void;
  // Otras llamadas de la misma tienda: se usa para mostrar sus resúmenes
  // publicados como "Llamadas anteriores" (mismo histórico que ve el agente).
  priorCalls?: ConsultingCall[];
}) {
  const { organizationId } = useActiveOrganization();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [showTranscriptForm, setShowTranscriptForm] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const [summaryDraft, setSummaryDraft] = useState("");
  const [showSummaryForm, setShowSummaryForm] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [taskAudience, setTaskAudience] = useState<CallTaskAudience>("cliente");
  // B5: enfoque opcional para (re)generar el resumen centrándose en algo.
  const [focusDraft, setFocusDraft] = useState("");

  const currentTranscript = call.call_transcripts[0] ?? null;
  const publishedSummary = call.call_ai_summaries.find((summary) =>
    isSummaryCurrentForTranscript(summary, currentTranscript),
  );
  const pendingSummaries = call.call_ai_summaries.filter(
    (summary) =>
      summary.status === "pending_approval" &&
      (!currentTranscript || summary.transcript_id === currentTranscript.id),
  );

  // Fases/hitos de Mi Camino para elegir dónde entra cada tarea al aprobar.
  // Solo se carga cuando hay algo que aprobar: no todas las tiendas tienen
  // plan y no hace falta en cada llamada plegada.
  const [milestoneOptions, setMilestoneOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const hasPendingSummary = call.call_ai_summaries.some(
    (summary) => summary.status === "pending_approval",
  );

  const planQuery = useCachedQuery<{
    plan?: {
      strategic_plan_phases?: Array<{
        name: string;
        position: number;
        strategic_plan_milestones?: Array<{
          id: string;
          name: string;
          position: number;
        }>;
      }>;
    };
  }>(
    hasPendingSummary && organizationId
      ? `/v1/organizations/${organizationId}/strategic-plan`
      : null,
  );

  useEffect(() => {
    const phases = planQuery.data?.plan?.strategic_plan_phases ?? [];
    setMilestoneOptions(
      phases
        .slice()
        .sort((a, b) => a.position - b.position)
        .flatMap((phase) =>
          (phase.strategic_plan_milestones ?? [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((milestone) => ({
              value: milestone.id,
              label: `${phase.name} · ${milestone.name}`,
            })),
        ),
    );
  }, [planQuery.data]);

  const previousSummaries = priorCalls
    .filter((other) => other.id !== call.id)
    .map((other) => ({
      call: other,
      summary: other.call_ai_summaries.find(
        (summary) => summary.status === "published",
      ),
    }))
    .filter((entry): entry is { call: ConsultingCall; summary: CallSummary } =>
      Boolean(entry.summary),
    )
    .sort(
      (a, b) =>
        Date.parse(b.call.held_at ?? b.call.scheduled_at ?? b.call.created_at) -
        Date.parse(a.call.held_at ?? a.call.scheduled_at ?? a.call.created_at),
    )
    .slice(0, 5);

  const proposedTasksSource = pendingSummaries[0] ?? publishedSummary;
  const proposedTasks =
    isConsultant &&
    proposedTasksSource &&
    isCallSummaryDetail(proposedTasksSource.key_points)
      ? (proposedTasksSource.key_points.proposed_tasks ?? [])
      : [];
  const normalizeTaskTitle = (title: string) =>
    title.trim().toLocaleLowerCase();
  // El enlace puede llegar con `tasks: null` cuando la RLS oculta una tarea
  // interna al cliente. No mostramos su id crudo ni lo contamos como visible.
  const visibleCallTaskLinks = isConsultant
    ? call.call_task_links
    : call.call_task_links.filter((link) => link.tasks);
  const selectedProposedTasks = proposedTasks.filter((task) =>
    taskAudience === "consultor"
      ? task.owner === "consultor"
      : task.owner !== "consultor",
  );
  const selectedTaskLinks = visibleCallTaskLinks.filter(
    (link) => link.tasks && callTaskAudience(link.tasks) === taskAudience,
  );
  const selectedProposedTaskTitles = new Set(
    selectedProposedTasks.map((task) => normalizeTaskTitle(task.title)),
  );
  const additionalCallTasks = selectedTaskLinks.filter(
    (link) =>
      !link.tasks?.title ||
      !selectedProposedTaskTitles.has(normalizeTaskTitle(link.tasks.title)),
  );

  async function run(action: () => Promise<Response>, successMessage?: string) {
    setIsBusy(true);
    setError(null);
    try {
      const response = await action();

      if (!response.ok) {
        setError(await readApiError(response));
        return false;
      }

      if (successMessage) {
        toast.success(successMessage);
      }
      void onChanged();
      return true;
    } catch {
      setError(
        "No se pudo completar la acción de la llamada por un error de red. Reintenta.",
      );
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function markHeld() {
    await run(() =>
      apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "held" }),
      }),
    );
  }

  async function submitTranscript(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      apiFetch(
        `/v1/organizations/${organizationId}/calls/${call.id}/transcript`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: transcriptDraft, source: "manual" }),
        },
      ),
    );
    if (saved) {
      setTranscriptDraft("");
      setShowTranscriptForm(false);
    }
  }

  async function submitSummary(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: summaryDraft }),
      }),
    );
    if (saved) {
      setSummaryDraft("");
      setShowSummaryForm(false);
    }
  }

  // A01: genera el resumen estructurado desde la transcripcion actual. Queda
  // pendiente de aprobacion, igual que un resumen redactado a mano. `focus`
  // opcional deja re-generar centrándose en algo concreto (B5).
  async function analyzeCall() {
    const focus = focusDraft.trim();
    const ok = await run(() =>
      apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(focus ? { focus } : {}),
      }),
    );
    if (ok) {
      setFocusDraft("");
    }
  }

  async function decideSummary(
    summaryId: string,
    decision: "approved" | "rejected",
    opts?: {
      reason?: string;
      selectedTaskIndexes?: number[];
      taskMilestones?: Record<string, string>;
    },
  ) {
    await run(
      () =>
        apiFetch(
          `/v1/organizations/${organizationId}/call-summaries/${summaryId}/decision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision,
              reason: opts?.reason,
              selectedTaskIndexes: opts?.selectedTaskIndexes,
              taskMilestones: opts?.taskMilestones,
            }),
          },
        ),
      decision === "approved"
        ? "Resumen aprobado y publicado."
        : "Resumen rechazado.",
    );
  }

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      apiFetch(
        `/v1/organizations/${organizationId}/calls/${call.id}/internal-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: noteDraft }),
        },
      ),
    );
    if (saved) {
      setNoteDraft("");
    }
  }

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    const saved = await run(
      () =>
        apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitleDraft,
            owner: taskAudience,
          }),
        }),
      taskAudience === "consultor"
        ? "Tarea interna añadida."
        : "Tarea añadida al bloque del cliente.",
    );
    if (saved) {
      setTaskTitleDraft("");
    }
  }

  return (
    <Card
      title={call.title}
      description={`${callTypeLabels[call.call_type] ?? call.call_type} · ${formatDate(call.held_at ?? call.scheduled_at)}${call.duration_minutes ? ` · ${call.duration_minutes} min` : ""}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {callStatusLabels[call.status] ?? call.status}
          </span>
          {!call.is_visible_to_client && isConsultant ? (
            <Badge tone="warn">Oculta al cliente</Badge>
          ) : null}
          {call.recording_url ? (
            <Link href={call.recording_url} target="_blank" rel="noreferrer">
              Ver grabacion
              {call.recording_provider ? ` (${call.recording_provider})` : ""}
            </Link>
          ) : null}
          {isConsultant && call.status === "scheduled" ? (
            <Button
              size="sm"
              type="button"
              disabled={isBusy}
              onClick={markHeld}
            >
              Marcar realizada
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.38fr)]">
          {publishedSummary ? (
            <section className="min-w-0 border-b border-separator pb-5 xl:col-start-1">
              <h2 className="text-base font-semibold text-foreground">
                Resumen de la llamada
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {publishedSummary.summary}
              </p>
              <StructuredSummary summary={publishedSummary} hideProposedTasks />
              {isCallSummaryDetail(publishedSummary.key_points) ? (
                <A01Handoffs organizationId={organizationId} detail={publishedSummary.key_points} />
              ) : null}
              <p className="mt-2 text-xs text-muted">
                Publicado el {formatDate(publishedSummary.published_at)}
              </p>
            </section>
          ) : !isConsultant ? (
            <p className="text-sm text-muted xl:col-start-1">
              El resumen estara disponible cuando se publique.
            </p>
          ) : null}

          {/* La lectura interna sobrevive a la aprobación: sigue siendo lo que
            revisas antes de la siguiente llamada. Solo si no hay uno pendiente,
            que trae el suyo. */}
          {isConsultant &&
          pendingSummaries.length === 0 &&
          publishedSummary &&
          isCallSummaryDetail(publishedSummary.key_points) ? (
            <div className="min-w-0 xl:col-start-1">
              <ConsultantCoaching detail={publishedSummary.key_points} />
            </div>
          ) : null}

          {isConsultant ? (
            <>
              {pendingSummaries.map((summary) => (
                <div
                  key={summary.id}
                  className="min-w-0 space-y-3 xl:col-start-1"
                >
                  <PendingSummaryReview
                    summary={summary}
                    isBusy={isBusy}
                    milestones={milestoneOptions}
                    onApprove={(selection) =>
                      decideSummary(summary.id, "approved", {
                        selectedTaskIndexes: selection.indexes,
                        taskMilestones: selection.milestones,
                      })
                    }
                    onReject={(reason) =>
                      decideSummary(summary.id, "rejected", { reason })
                    }
                  />
                  {/* Fuera del bloque de aprobación a propósito: esto no se
                    aprueba ni se publica, se lee. */}
                  {isCallSummaryDetail(summary.key_points) ? (
                    <ConsultantCoaching detail={summary.key_points} />
                  ) : null}
                </div>
              ))}

              {/* Paso 1. Estaba dentro de un acordeon plegado titulado
                "Transcripcion (sin transcripcion)": el unico campo que
                desbloquea todo el flujo quedaba escondido tras dos clics. */}
              <section className="min-w-0 rounded-md border border-separator p-4 xl:col-start-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    1 · Transcripción
                  </p>
                  {currentTranscript ? (
                    <Badge tone="success">v{currentTranscript.version}</Badge>
                  ) : (
                    <Badge tone="neutral">Sin transcripción</Badge>
                  )}
                  {!showTranscriptForm ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="ml-auto"
                      onClick={() => setShowTranscriptForm(true)}
                    >
                      {currentTranscript
                        ? "Reemplazar"
                        : "Añadir transcripción"}
                    </Button>
                  ) : null}
                </div>

                {currentTranscript && !showTranscriptForm ? (
                  <div className="mt-3">
                    <p
                      className={
                        transcriptExpanded
                          ? "max-h-96 overflow-y-auto whitespace-pre-wrap pr-2 text-[13px] leading-relaxed text-muted"
                          : "line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-muted"
                      }
                    >
                      {currentTranscript.content}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="mt-2"
                      aria-expanded={transcriptExpanded}
                      onClick={() => setTranscriptExpanded((value) => !value)}
                    >
                      {transcriptExpanded
                        ? "Ocultar transcripción"
                        : "Ver transcripción completa"}
                    </Button>
                  </div>
                ) : null}

                {showTranscriptForm ? (
                  <form className="mt-2 space-y-2" onSubmit={submitTranscript}>
                    <Textarea
                      className="h-40"
                      autoFocus
                      aria-label="Transcripción de la llamada"
                      value={transcriptDraft}
                      onChange={(event) =>
                        setTranscriptDraft(event.target.value)
                      }
                      placeholder="Pega aquí la transcripción de Loom, Fathom, Meet..."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        type="submit"
                        disabled={isBusy || !transcriptDraft.trim()}
                      >
                        {currentTranscript
                          ? `Guardar como v${currentTranscript.version + 1}`
                          : "Guardar transcripción"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setShowTranscriptForm(false);
                          setTranscriptDraft("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                    {currentTranscript ? (
                      <p className="text-xs text-muted">
                        Se guarda como versión nueva. El resumen ya publicado
                        queda atado a la versión que lo originó.
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </section>

              {/* Paso 2. Antes eran dos botones sueltos y un input con
                placeholder: nada decia que el agente existe, que lee, ni por
                que estaba apagado. */}
              <section className="min-w-0 rounded-md border border-separator p-4 xl:col-start-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    2 · Resumen
                  </p>
                  <Badge tone="brand">Agente A01</Badge>
                </div>
                {showSummaryForm ? (
                  <form className="mt-3 space-y-2" onSubmit={submitSummary}>
                    <Textarea
                      className="h-32"
                      autoFocus
                      aria-label="Nuevo resumen de la llamada"
                      value={summaryDraft}
                      onChange={(event) => setSummaryDraft(event.target.value)}
                      placeholder="Puntos tratados, decisiones y próximos pasos..."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        type="submit"
                        disabled={isBusy || !summaryDraft.trim()}
                      >
                        Guardar resumen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setShowSummaryForm(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Input
                      aria-label="Enfoque para el análisis (opcional)"
                      value={focusDraft}
                      onChange={(event) => setFocusDraft(event.target.value)}
                      placeholder="Enfoque opcional: «profundiza en pricing», «ignora la parte de RRHH»"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        disabled={isBusy || !currentTranscript}
                        onClick={analyzeCall}
                      >
                        {isBusy
                          ? "Analizando..."
                          : pendingSummaries.length
                            ? "Regenerar con IA"
                            : "Generar resumen con IA"}
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setShowSummaryForm(true)}
                      >
                        Redactar a mano
                      </Button>
                    </div>
                    {/* El motivo del boton apagado, escrito. Antes vivia en un
                      `title` que solo aparecia al pasar el raton. */}
                    {!currentTranscript ? (
                      <p className="text-xs text-warning">
                        Añade la transcripción para poder generar el resumen: es
                        lo único que lee el agente.
                      </p>
                    ) : null}
                  </div>
                )}
              </section>
            </>
          ) : null}

          <aside className="space-y-4 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-24">
            <section className="rounded-lg border border-separator bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">
                  Tareas
                </h2>
                <Badge tone={selectedTaskLinks.length ? "brand" : "neutral"}>
                  {selectedTaskLinks.length}
                </Badge>
              </div>

              {isConsultant ? (
                <>
                  <div
                    className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-separator p-1"
                    role="group"
                    aria-label="Responsable de las tareas"
                  >
                    <Button
                      size="sm"
                      type="button"
                      variant={taskAudience === "cliente" ? "primary" : "ghost"}
                      className="w-full"
                      aria-pressed={taskAudience === "cliente"}
                      onClick={() => setTaskAudience("cliente")}
                    >
                      Cliente
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant={
                        taskAudience === "consultor" ? "primary" : "ghost"
                      }
                      className="w-full"
                      aria-pressed={taskAudience === "consultor"}
                      onClick={() => setTaskAudience("consultor")}
                    >
                      Para mí
                    </Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">
                    {taskAudience === "cliente"
                      ? "Trabajo visible en el bloque de tareas del cliente."
                      : "Trabajo interno tuyo sobre esta tienda."}
                  </p>
                  <form className="mt-3 space-y-2" onSubmit={submitTask}>
                    <Input
                      className="w-full"
                      aria-label={
                        taskAudience === "cliente"
                          ? "Nueva tarea para el cliente"
                          : "Nueva tarea interna del consultor"
                      }
                      value={taskTitleDraft}
                      onChange={(event) =>
                        setTaskTitleDraft(event.target.value)
                      }
                      placeholder={
                        taskAudience === "cliente"
                          ? "Añadir tarea para el cliente..."
                          : "Añadir tarea interna..."
                      }
                    />
                    <Button
                      size="sm"
                      type="submit"
                      className="w-full"
                      disabled={isBusy || !taskTitleDraft.trim()}
                    >
                      {taskAudience === "cliente"
                        ? "Añadir al cliente"
                        : "Añadir para mí"}
                    </Button>
                  </form>
                </>
              ) : null}

              {selectedProposedTasks.length > 0 ? (
                <div className="mt-5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted">
                    Detectadas en la conversación
                  </h3>
                  <ul className="mt-2 divide-y divide-separator">
                    {selectedProposedTasks.map((task, index) => {
                      const linked = selectedTaskLinks.find(
                        (link) =>
                          link.tasks?.title &&
                          normalizeTaskTitle(link.tasks.title) ===
                            normalizeTaskTitle(task.title),
                      );
                      const pending =
                        proposedTasksSource?.status === "pending_approval";
                      return (
                        <li
                          key={`${task.title}-${index}`}
                          className="py-3 first:pt-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-medium leading-5 text-foreground">
                              {task.title}
                            </span>
                            <Badge
                              tone={
                                linked
                                  ? "success"
                                  : pending
                                    ? "warn"
                                    : "neutral"
                              }
                            >
                              {linked
                                ? callTaskStatusLabel(linked.tasks?.status)
                                : pending
                                  ? "Propuesta"
                                  : "No creada"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {priorityLabels[task.priority] ?? task.priority} ·{" "}
                            {task.owner}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {additionalCallTasks.length > 0 ? (
                <div className="mt-5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted">
                    {isConsultant ? "Añadidas a mano" : "Tareas de la llamada"}
                  </h3>
                  <ul className="mt-2 divide-y divide-separator">
                    {additionalCallTasks.map((link) => (
                      <li key={link.id} className="py-3 first:pt-0">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium leading-5 text-foreground">
                            {link.tasks?.title ?? link.task_id}
                          </span>
                          <Badge tone="neutral">
                            {callTaskStatusLabel(link.tasks?.status)}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {selectedProposedTasks.length === 0 &&
              additionalCallTasks.length === 0 ? (
                <p className="mt-4 text-sm leading-5 text-muted">
                  {taskAudience === "consultor"
                    ? "No tienes tareas internas vinculadas a esta llamada."
                    : "No hay tareas del cliente vinculadas a esta llamada."}
                </p>
              ) : null}
            </section>

            {isConsultant ? (
              <section className="rounded-lg border border-separator p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Notas internas
                </h2>
                <form className="mt-3 space-y-2" onSubmit={submitNote}>
                  <Input
                    className="w-full"
                    aria-label="Nota interna (solo consultores)"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Escribe una nota interna..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    type="submit"
                    className="w-full"
                    disabled={isBusy || !noteDraft.trim()}
                  >
                    Guardar nota
                  </Button>
                </form>
                {call.call_internal_notes.length > 0 ? (
                  <ul className="mt-4 divide-y divide-separator">
                    {call.call_internal_notes.map((note) => (
                      <li key={note.id} className="py-3 text-sm first:pt-0">
                        <p>{note.body}</p>
                        <p className="mt-1 text-xs text-muted">
                          {formatDate(note.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
          </aside>

          {previousSummaries.length > 0 ? (
            <div className="min-w-0 xl:col-start-1">
              <Accordion
                className="border border-separator"
                items={[
                  {
                    id: "history",
                    title: `Llamadas anteriores (${previousSummaries.length})`,
                    content: (
                      <div className="space-y-4">
                        {previousSummaries.map(({ call: other, summary }) => {
                          const decisions = Array.isArray(
                            summary.agreed_actions,
                          )
                            ? summary.agreed_actions
                            : [];
                          return (
                            <div
                              key={other.id}
                              className="border-t border-separator pt-3 first:border-t-0 first:pt-0"
                            >
                              <p className="text-sm font-medium">
                                {other.title}
                              </p>
                              <p className="text-xs text-muted">
                                {formatDate(
                                  other.held_at ?? other.scheduled_at,
                                )}
                              </p>
                              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                                {summary.summary}
                              </p>
                              {decisions.length ? (
                                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
                                  {decisions
                                    .slice(0, 4)
                                    .map((decision, index) => (
                                      <li key={index}>{decision}</li>
                                    ))}
                                </ul>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function CallsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const [calls, setCalls] = useState<ConsultingCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("monthly_review");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newRecordingUrl, setNewRecordingUrl] = useState("");
  const [newRecordingProvider, setNewRecordingProvider] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const loadCalls = useCallback(async () => {
    if (!organizationId) {
      setCalls([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/calls`,
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as { calls: ConsultingCall[] };
      setCalls(payload.calls);
      setError(null);
    } catch {
      setError(
        "No se pudieron cargar las llamadas por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    setIsLoading(true);
    void loadCalls();
  }, [loadCalls]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) {
      setCreateError("Selecciona un cliente antes de registrar la llamada.");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/calls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle.trim(),
            call_type: newType,
            scheduled_at: newScheduledAt || undefined,
            recording_url: newRecordingUrl.trim() || undefined,
            recording_provider: newRecordingProvider || undefined,
          }),
        },
      );

      if (!response.ok) {
        setCreateError(await readApiError(response));
        return;
      }

      setNewTitle("");
      setNewScheduledAt("");
      setNewRecordingUrl("");
      setNewRecordingProvider("");
      setShowCreateForm(false);
      toast.success(
        "Llamada registrada. Añade la transcripción para analizarla.",
      );
      void loadCalls();
    } catch {
      setCreateError(
        "No se pudo registrar la llamada por un error de red. Reintenta.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <section className="flex flex-wrap items-baseline justify-between gap-3">
        <Heading size="lg">Llamadas de consultoría</Heading>
        {isConsultant ? (
          <>
            {/* El boton NO puede ir dentro de `Modal.Trigger`: ese componente
                renderiza un `<div role="button">` con la pulsacion de
                react-aria, y el `Button` de dentro (react-aria tambien) corta
                la propagacion -- el div nunca recibia el clic y "Registrar
                llamada" no hacia absolutamente nada. El modal ya esta
                controlado por `isOpen`, asi que se abre desde el propio boton. */}
            <Button type="button" onClick={() => setShowCreateForm(true)}>
              Registrar llamada
            </Button>
            <Modal
              isOpen={showCreateForm}
              onOpenChange={(open) => {
                setShowCreateForm(open);
                if (!open) setCreateError(null);
              }}
            >
              <Modal.Backdrop>
                <Modal.Container size="lg">
                  <Modal.Dialog aria-label="Registrar llamada">
                    <form onSubmit={submitCreate}>
                      <Modal.Header>
                        <Modal.Heading>Registrar llamada</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body>
                        <div className="space-y-4">
                          <Field label="Título">
                            <Input
                              value={newTitle}
                              onChange={(event) =>
                                setNewTitle(event.target.value)
                              }
                              placeholder="Ej: Revisión mensual julio"
                            />
                          </Field>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Fecha y hora">
                              {/* `type="date"` perdia la hora de la llamada, que
                                es justo lo que hace falta para agendarla. */}
                              <Input
                                type="datetime-local"
                                value={newScheduledAt}
                                onChange={(event) =>
                                  setNewScheduledAt(event.target.value)
                                }
                              />
                            </Field>
                            <Field label="Tipo">
                              <Select
                                aria-label="Tipo"
                                value={newType}
                                onChange={setNewType}
                                options={Object.entries(callTypeLabels).map(
                                  ([value, label]) => ({ value, label }),
                                )}
                              />
                            </Field>
                          </div>
                          {/* La grabacion ya la aceptaba la API desde el primer
                            dia, pero el formulario no la pedia y no habia
                            ninguna otra pantalla para añadirla. */}
                          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                            <Field label="Grabación (opcional)">
                              <Input
                                type="url"
                                value={newRecordingUrl}
                                onChange={(event) =>
                                  setNewRecordingUrl(event.target.value)
                                }
                                placeholder="https://..."
                              />
                            </Field>
                            <Field label="Proveedor">
                              <Select
                                aria-label="Proveedor de la grabación"
                                value={newRecordingProvider}
                                onChange={setNewRecordingProvider}
                                options={[
                                  { value: "", label: "Sin especificar" },
                                  { value: "loom", label: "Loom" },
                                  { value: "fathom", label: "Fathom" },
                                  { value: "meet", label: "Meet" },
                                  { value: "zoom", label: "Zoom" },
                                  { value: "other", label: "Otro" },
                                ]}
                              />
                            </Field>
                          </div>
                          {createError ? (
                            <ErrorBlock>{createError}</ErrorBlock>
                          ) : null}
                        </div>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowCreateForm(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={isCreating || !newTitle.trim()}
                        >
                          {isCreating ? "Creando..." : "Crear llamada"}
                        </Button>
                      </Modal.Footer>
                    </form>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          </>
        ) : null}
      </section>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {/* Antes de una llamada el consultor necesita saber cuándo fue la
          anterior, qué quedó sin cerrar y si hay resúmenes esperándole. Estaba
          todo, pero repartido dentro de cada llamada plegada. */}
      {!isLoading && calls.length > 0 ? (
        <ModuleSummary
          metrics={[
            {
              label: "Llamadas registradas",
              value: calls.length.toLocaleString("es-ES"),
            },
            {
              label: "Última realizada",
              value: (() => {
                const held = calls
                  .filter((call) => call.status === "held" && call.held_at)
                  .sort(
                    (a, b) =>
                      Date.parse(b.held_at as string) -
                      Date.parse(a.held_at as string),
                  )[0];
                const days = daysSince(held?.held_at);
                if (days === null) return "Ninguna";
                return days === 0 ? "Hoy" : `Hace ${days} d`;
              })(),
              hint: "Frecuencia de contacto",
            },
            {
              label: "Próxima programada",
              value: (() => {
                const next = calls
                  .filter(
                    (call) =>
                      call.status === "scheduled" &&
                      isUpcoming(call.scheduled_at),
                  )
                  .sort(
                    (a, b) =>
                      Date.parse(a.scheduled_at as string) -
                      Date.parse(b.scheduled_at as string),
                  )[0];
                return next?.scheduled_at
                  ? new Date(next.scheduled_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "Sin agendar";
              })(),
              tone: calls.some(
                (call) =>
                  call.status === "scheduled" && isUpcoming(call.scheduled_at),
              )
                ? "default"
                : "warn",
            },
            {
              label: "Resúmenes por aprobar",
              value: calls
                .filter((call) =>
                  call.call_ai_summaries.some(
                    (summary) => summary.status === "pending_approval",
                  ),
                )
                .length.toLocaleString("es-ES"),
              tone: calls.some((call) =>
                call.call_ai_summaries.some(
                  (summary) => summary.status === "pending_approval",
                ),
              )
                ? "warn"
                : "success",
            },
            {
              label: "Acciones acordadas",
              value: calls
                .reduce((total, call) => total + call.call_task_links.length, 0)
                .toLocaleString("es-ES"),
              hint: "Tareas creadas desde llamadas",
            },
          ]}
        />
      ) : null}

      {isLoading ? (
        <LoadingBlock label="Cargando llamadas..." />
      ) : calls.length === 0 ? (
        <EmptyState
          title="Aún no hay llamadas registradas"
          hint={
            isConsultant
              ? "Esta organización todavía no tiene llamadas para revisar."
              : "Cuando registres una llamada, aparecerá aquí."
          }
        />
      ) : (
        <List bordered>
          {calls.map((call) => {
            const when = call.held_at ?? call.scheduled_at;
            const stage = callStage(call);
            return (
              <List.Item key={call.id} className="px-1 py-2.5">
                <Link
                  href={`/llamadas/${call.id}`}
                  aria-label={`Abrir llamada ${call.title}`}
                  className="flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-1 text-left text-foreground no-underline transition hover:bg-surface"
                >
                  <Badge
                    tone={
                      call.status === "held"
                        ? "success"
                        : call.status === "cancelled"
                          ? "neutral"
                          : "warn"
                    }
                  >
                    {callStatusLabels[call.status] ?? call.status}
                  </Badge>
                  <span className="min-w-0 flex-1 font-medium">
                    {call.title}
                  </span>
                  {/* En que paso del flujo esta, sin desplegar: era la unica
                      forma de saber que llamada te esta esperando. */}
                  {isConsultant ? (
                    <Badge tone={stage.tone}>{stage.label}</Badge>
                  ) : null}
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {when
                      ? new Date(when).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-accent">
                    Abrir
                  </span>
                </Link>
              </List.Item>
            );
          })}
        </List>
      )}
    </div>
  );
}

// --- Estado "vista general" de /llamadas (consultor sin cliente activo):
// llamadas de toda la cartera, resúmenes pendientes de aprobar primero. ---

type ConsultantCallRow = {
  id: string;
  title: string;
  call_type: string;
  status: string;
  held_at: string | null;
  created_at: string;
  organization_id: string;
  organization_name: string;
  summary_pending: boolean;
  has_published_summary: boolean;
};

function ConsultantCallsView() {
  const { setOrganizationId } = useActiveOrganization();
  const callsQuery = useCachedQuery<{
    calls: ConsultantCallRow[];
    organizations: Array<{ id: string; display_name: string }>;
  }>("/v1/consultant/calls");
  const data = callsQuery.data ?? null;
  const error = callsQuery.error
    ? "No se pudieron cargar las llamadas. Revisa la conexión e inténtalo de nuevo."
    : null;
  const isLoading = callsQuery.isLoading;
  const [clientFilter, setClientFilter] = useState("all");
  const [onlyPending, setOnlyPending] = useState(false);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando llamadas de la cartera..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!data) return null;

  const pendingCount = data.calls.filter((call) => call.summary_pending).length;
  const filtered = data.calls
    .filter(
      (call) => clientFilter === "all" || call.organization_id === clientFilter,
    )
    .filter((call) => !onlyPending || call.summary_pending)
    .sort(
      (a, b) =>
        Number(b.summary_pending) - Number(a.summary_pending) ||
        Date.parse(b.held_at ?? b.created_at) -
          Date.parse(a.held_at ?? a.created_at),
    );

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Card
        title="Llamadas · toda la cartera"
        description={`${data.calls.length} llamadas · ${pendingCount} con resumen pendiente de aprobar`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            className="w-52"
            aria-label="Filtrar por cliente"
            value={clientFilter}
            onChange={setClientFilter}
            options={[
              { value: "all", label: "Todos los clientes" },
              ...data.organizations.map((organization) => ({
                value: organization.id,
                label: organization.display_name,
              })),
            ]}
          />
          <Button
            variant={onlyPending ? "primary" : "secondary"}
            size="sm"
            onClick={() => setOnlyPending((value) => !value)}
          >
            Solo pendientes de aprobar
          </Button>
          {/* Registrar una llamada exige un cliente activo (la API es por
              organizacion), y desde la cartera no habia ninguna forma de
              llegar: ni boton ni pista. Con un cliente filtrado, esto abre su
              vista, que es donde se registra. */}
          {clientFilter === "all" ? (
            <span className="text-xs text-muted">
              Elige un cliente para registrar una llamada.
            </span>
          ) : (
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => setOrganizationId(clientFilter)}
            >
              Registrar llamada en este cliente
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Sin llamadas para este filtro"
            hint="Cambia el filtro o abre un cliente para registrar una llamada."
          />
        ) : (
          <List>
            {filtered.map((call) => (
              <List.Item key={call.id} className="py-1">
                <Link
                  href={`/llamadas/${call.id}`}
                  onClick={() => setOrganizationId(call.organization_id)}
                  aria-label={`Abrir llamada ${call.title} de ${call.organization_name}`}
                  className="flex w-full items-start justify-between gap-4 rounded-md px-2 py-3 text-left text-foreground no-underline transition hover:bg-surface"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {call.summary_pending ? (
                        <Badge tone="warn">Resumen pendiente</Badge>
                      ) : call.has_published_summary ? (
                        <Badge tone="success">Resumen publicado</Badge>
                      ) : null}
                      <span className="font-medium">{call.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {call.organization_name} · {displayValue(call.call_type)}{" "}
                      · {displayValue(call.status)}
                      {call.held_at
                        ? ` · ${new Date(call.held_at).toLocaleDateString("es-ES")}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs font-medium text-accent">
                    Abrir
                  </span>
                </Link>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}

export function CallsRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    return <ConsultantCallsView />;
  }

  return <CallsContent bootstrap={bootstrap} />;
}
