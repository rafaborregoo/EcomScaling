"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import NextLink from "next/link";
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
import { useModuleSummary } from "@/components/module-summary";
import { daysSince, isUpcoming } from "@/lib/elapsed";
import {
  LoadingBlock,
  Dialog,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import p from "../dashboard/client-pulse.module.css";
import s from "./llamadas.module.css";

// Llamadas usa el lenguaje del panel: .root trae los tokens (petróleo +
// azafrán para el cliente) y .consultant los cambia a grafito + mandarina.
export function CallsTheme({
  isConsultant,
  children,
}: {
  isConsultant: boolean;
  children: ReactNode;
}) {
  const root = <div className={p.root}>{children}</div>;
  return isConsultant ? <div className={p.consultant}>{root}</div> : root;
}

type ChipTone = "neutral" | "good" | "warn" | "bad" | "acc";

const CHIP_CLASS: Record<ChipTone, string> = {
  neutral: p.chip,
  good: `${p.chip} ${p.chipGood}`,
  warn: `${p.chip} ${p.chipWarn}`,
  bad: `${p.chip} ${s.chipBad}`,
  acc: `${p.chip} ${p.chipAcc}`,
};

function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={CHIP_CLASS[tone]}>{children}</span>;
}

const btn = {
  primary: p.btn,
  acc: `${p.btn} ${p.acc}`,
  ghost: `${p.btn} ${p.ghost}`,
  ghostSm: `${p.btn} ${p.ghost} ${p.sm}`,
  accSm: `${p.btn} ${p.acc} ${p.sm}`,
};

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
    <div className={s.handoffs}>
      <p className={p.lbl}>Continuar lo acordado</p>
      {campaigns.map((item, index) => (
        <div key={`campaign-${index}`} className={s.list}>
          <div>
            <div className="min-w-0">
              <p className="font-semibold">Preparar campaña · {item.objective}</p>
              <p className={s.small}>{item.audience}{item.timing_hint ? ` · ${item.timing_hint}` : ""} · «{item.evidence_quote}»</p>
            </div>
            <Link
              href="/marketing?section=plan&openCampaignPlan=1"
              onClick={() => window.sessionStorage.setItem(A01_CAMPAIGN_BRIEF_KEY, serializeA01BriefHandoff(organizationId, campaignBrief(item)))}
              className={`${btn.ghostSm} shrink-0 no-underline`}
            >Abrir plan de campañas</Link>
          </div>
        </div>
      ))}
      {caminoChanges.map((item, index) => (
        <div key={`camino-${index}`} className={s.list}>
          <div>
            <div className="min-w-0">
              <p className="font-semibold">Revisar cambio del Camino · {item.change}</p>
              <p className={s.small}>{item.rationale} · «{item.evidence_quote}»</p>
            </div>
            <Link
              href="/camino?fromCall=1"
              onClick={() => window.sessionStorage.setItem(A01_CAMINO_BRIEF_KEY, serializeA01BriefHandoff(organizationId, caminoBrief(item)))}
              className={`${btn.ghostSm} shrink-0 no-underline`}
            >Abrir Camino</Link>
          </div>
        </div>
      ))}
      <p className={s.small}>El especialista contrastará el brief con los datos actuales. No se crea ni modifica nada hasta que revises y confirmes su propuesta.</p>
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

  const bulletBlock = (label: string, items: ReactNode[]) =>
    items.length ? (
      <div className={s.block}>
        <p className={p.lbl}>{label}</p>
        <ul className={s.dots}>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null;

  // Los avisos del modelo no van aquí: se leen al revisar el resumen
  // (PendingSummaryReview) y nunca llegan a la vista del cliente.
  return (
    <div className={p.two}>
      {bulletBlock("Hechos", detail?.facts ?? [])}
      {bulletBlock("Decisiones", decisions)}
      {bulletBlock(
        "Recomendaciones",
        (detail?.recommendations ?? []).map((rec) => (
          <>
            <span className="font-medium text-[var(--ink)]">{rec.action}</span>{" "}
            <span className={s.small}>
              ({priorityLabels[rec.priority] ?? rec.priority})
            </span>
            {rec.rationale ? <> · {rec.rationale}</> : null}
          </>
        )),
      )}
      {bulletBlock("A vigilar", detail?.risks ?? [])}
      {createdTasksForClient !== undefined
        ? bulletBlock(
            "Tareas creadas",
            createdTasksForClient.map((link) => link.tasks?.title ?? link.task_id),
          )
        : !hideProposedTasks
          ? bulletBlock(
              "Tareas propuestas (se crean al aprobar)",
              (detail?.proposed_tasks ?? []).map(
                (task) =>
                  `${task.title} · ${priorityLabels[task.priority] ?? task.priority} · ${task.owner}`,
              ),
            )
          : null}
    </div>
  );
}

const GAP_SEVERITY: Record<string, { label: string; tone: ChipTone }> = {
  high: { label: "Alta", tone: "bad" },
  medium: { label: "Media", tone: "warn" },
  low: { label: "Baja", tone: "neutral" },
};

const TREND_META: Record<string, { label: string; tone: ChipTone }> = {
  mejora: { label: "Mejora", tone: "good" },
  estable: { label: "Estable", tone: "neutral" },
  empeora: { label: "Empeora", tone: "bad" },
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
    <section className={p.panel}>
      <div className={p.panelH}>
        <h3>
          Lectura para ti <Chip>Solo consultor</Chip>
        </h3>
      </div>
      <div className={p.two}>
        {gaps.length > 0 ? (
          <div className={s.block}>
            <p className={p.lbl}>Lo que no se trató</p>
            <ul className={s.list}>
              {gaps.map((gap, index) => (
                <li key={index}>
                  <div className={s.signal}>
                    <span className="font-semibold">{gap.topic}</span>
                    <Chip tone={GAP_SEVERITY[gap.severity]?.tone ?? "neutral"}>
                      {GAP_SEVERITY[gap.severity]?.label ?? gap.severity}
                    </Chip>
                  </div>
                  <p className={s.gapNote}>{gap.why_it_matters}</p>
                  {/* La evidencia es lo que separa un hueco real de una opinión
                      del modelo: siempre visible, no plegada. */}
                  <p className={s.gapNote}>
                    <strong className="text-[var(--ink)]">Por qué lo dice: </strong>
                    {gap.evidence}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {[
          { title: "Cómo llevaste la llamada", rows: aboutConsultant },
          { title: "Cómo llegó el cliente", rows: aboutClient },
        ]
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <div key={group.title} className={s.block}>
              <p className={p.lbl}>{group.title}</p>
              <ul className={s.list}>
                {group.rows.map((signal, index) => (
                  <li key={index}>
                    <div className={s.signal}>
                      <span className="font-medium">{signal.label}</span>
                      <span className={s.signalValue}>{signal.value}</span>
                      <Chip tone={TREND_META[signal.trend]?.tone ?? "neutral"}>
                        {TREND_META[signal.trend]?.label ?? signal.trend}
                      </Chip>
                    </div>
                    <p className={s.gapNote}>{signal.reading}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
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

function shortDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      })
    : "—";
}

function callWhen(call: ConsultingCall) {
  return call.held_at ?? call.scheduled_at ?? call.created_at;
}

const OPEN_TASK_STATUSES = new Set(["pending", "in_progress"]);

// --- Flujo de una llamada -------------------------------------------------
//
// El modulo tenia todas las piezas (transcripcion, agente A01, aprobacion,
// tareas) pero ninguna decia en que orden van ni por que el boton de la IA
// esta apagado. Aqui se declara el flujo una sola vez y lo usan las dos
// vistas: la fila de la lista (para saberlo sin desplegar) y el detalle (para
// decir cual es el siguiente paso y quien lo hace).

const CONFIDENCE_META: Record<string, { label: string; tone: ChipTone }> = {
  high: { label: "Confianza alta", tone: "good" },
  medium: { label: "Confianza media", tone: "warn" },
  low: { label: "Confianza baja", tone: "bad" },
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
    <section id="resumen" className={`${p.panel} ${s.attn}`}>
      <div className={p.panelH}>
        <div>
          <h3>
            Resumen propuesto
            <Chip tone="warn">{summaryStatusLabels[summary.status]}</Chip>
            {confidence && CONFIDENCE_META[confidence] ? (
              <Chip tone={CONFIDENCE_META[confidence].tone}>
                {CONFIDENCE_META[confidence].label}
              </Chip>
            ) : null}
          </h3>
          <p className={p.sub}>
            {summary.run_id ? "Generado por IA" : "Redactado a mano"} ·{" "}
            {formatDate(summary.created_at)}
          </p>
        </div>
      </div>

      <div className={s.stack}>
        <p className={s.lead}>{summary.summary}</p>

        <StructuredSummary summary={summary} hideProposedTasks />

        {warnings.length ? (
          <ul className={`${s.warnings} ${s.dots}`}>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        ) : null}

        {sources.length ? (
          <p className={s.small}>
            Consultó: {sources.map((source) => source.reference).join(" · ")}
          </p>
        ) : null}

        {proposedTasks.length ? (
          <div className={s.block}>
            <p className={p.lbl}>
              Tareas detectadas · marca las que se crean al aprobar
            </p>
            <div className={s.tasks}>
              {proposedTasks.map((task, index) => {
                const isForClient = task.owner === "cliente";
                const isSelected = selected.has(index);
                return (
                  <div
                    key={index}
                    className={`${s.task} ${isSelected ? "" : s.taskOff}`}
                  >
                    <div className="min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggle(index)}
                      >
                        <span className="font-semibold">{task.title}</span>
                      </Checkbox>
                      <div className={s.tags}>
                        {/* `owner` decide si la tarea entra en el backlog del
                            cliente o nace interna para ti. */}
                        <Chip tone={isForClient ? "neutral" : "acc"}>
                          {isForClient ? "Cliente" : "Para ti · interna"}
                        </Chip>
                        <Chip
                          tone={
                            ["urgent", "high"].includes(task.priority)
                              ? "warn"
                              : "neutral"
                          }
                        >
                          {priorityLabels[task.priority] ?? task.priority}
                        </Chip>
                      </div>
                      {task.description ? (
                        <p className={s.why}>{task.description}</p>
                      ) : null}
                    </div>
                    {/* Punto de Mi Camino en el que entra. Solo para las del
                        cliente: una tarea interna tuya no es parte del plan. */}
                    {isForClient && milestones.length > 0 ? (
                      <Select
                        className="w-full"
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
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </div>
            {milestones.length === 0 ? (
              <p className={s.small}>
                Esta tienda no tiene un camino activo, así que las tareas se
                crean fuera del plan.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={s.foot}>
        <button
          className={btn.acc}
          type="button"
          disabled={isBusy}
          onClick={approve}
        >
          {proposedTasks.length
            ? `Aprobar y publicar · ${selected.size} ${selected.size === 1 ? "tarea" : "tareas"}`
            : "Aprobar y publicar"}
        </button>
        <button
          className={`${btn.ghost} ${s.push}`}
          type="button"
          disabled={isBusy}
          onClick={() => {
            setRejectReason("");
            setRejectOpen(true);
          }}
        >
          Rechazar
        </button>
      </div>

      <Dialog
        isOpen={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Rechazar resumen"
        isBusy={isBusy}
        isDirty={Boolean(rejectReason.trim())}
        formId="reject-summary-form"
        primary={{
          label: "Rechazar resumen",
          busyLabel: "Rechazando…",
          disabled: !rejectReason.trim(),
        }}
      >
        <form
          id="reject-summary-form"
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onReject(rejectReason.trim());
            setRejectOpen(false);
          }}
        >
          <Field label="Motivo del rechazo">
            <Textarea
              className="h-24"
              autoFocus
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Qué falló o qué debería corregir el análisis"
            />
          </Field>
          <p className="text-xs text-muted">
            Obligatorio. Queda registrado y sirve de feedback para el análisis.
          </p>
        </form>
      </Dialog>
    </section>
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
  // Qué acción está en curso: todas bloquean (evita dobles envíos), pero solo
  // el análisis dice "Analizando...".
  const [busy, setBusy] = useState<string | null>(null);
  const isBusy = busy !== null;

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
  // Mismo criterio que callStage: un pendiente de una transcripción antigua ya
  // no cuenta.
  const hasPendingSummary = pendingSummaries.length > 0;

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

  async function run(
    action: () => Promise<Response>,
    successMessage?: string,
    key = "other",
  ) {
    setBusy(key);
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
      setBusy(null);
    }
  }

  async function setStatus(status: "held" | "cancelled") {
    await run(
      () =>
        apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      status === "cancelled" ? "Llamada cancelada." : undefined,
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
    const ok = await run(
      () =>
        apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(focus ? { focus } : {}),
        }),
      undefined,
      "analyze",
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

  const stage = callStage(call);
  const isUpcomingCall =
    call.status === "scheduled" && isUpcoming(call.scheduled_at);
  const stepState = (index: number) =>
    stage.step === 4 || index + 1 < stage.step
      ? s.stepDone
      : index + 1 === stage.step
        ? s.stepNow
        : s.stepTodo;
  const stepNote = [
    currentTranscript ? `v${currentTranscript.version}` : "Falta",
    stage.step > 2 ? "Hecho" : "Pendiente",
    stage.step === 3 ? "Te toca" : stage.step > 3 ? "Aprobado" : "Pendiente",
    stage.step === 4 ? "Lo ve el cliente" : "Lo verá el cliente",
  ];
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="grid gap-7">
      <div className={s.head}>
        <div>
          <p className={p.lbl}>{callTypeLabels[call.call_type] ?? call.call_type}</p>
          <h1 className={s.title}>{call.title}</h1>
          <p className={s.meta}>
            {formatDate(call.held_at ?? call.scheduled_at)}
            {call.duration_minutes ? ` · ${call.duration_minutes} min` : ""}
            {call.recording_url ? (
              <>
                {" · "}
                <a href={call.recording_url} target="_blank" rel="noreferrer">
                  Grabación
                  {call.recording_provider
                    ? ` en ${displayValue(call.recording_provider)}`
                    : ""}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className={s.headActions}>
          {call.status === "cancelled" ? <Chip>Cancelada</Chip> : null}
          {isConsultant && !call.is_visible_to_client ? (
            <Chip tone="warn">Oculta al cliente</Chip>
          ) : null}
          {isConsultant && call.status === "scheduled" ? (
            <button
              className={btn.ghost}
              type="button"
              disabled={isBusy}
              onClick={() => void setStatus("held")}
            >
              Marcar realizada
            </button>
          ) : null}
          {isConsultant && call.status !== "cancelled" ? (
            <ConfirmDialog
              trigger={
                <button
                  className={`${btn.ghost} ${s.danger}`}
                  type="button"
                  disabled={isBusy}
                >
                  Cancelar llamada
                </button>
              }
              title="Cancelar llamada"
              description="La llamada queda como cancelada y sale de lo pendiente. Su historial se conserva."
              confirmLabel="Cancelar llamada"
              cancelLabel="Volver"
              onConfirm={() => void setStatus("cancelled")}
            />
          ) : null}
        </div>
      </div>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {isConsultant && call.status !== "cancelled" ? (
        isUpcomingCall ? (
          <section className={p.hero}>
            <div className={p.heroMeta}>
              <span>Próxima llamada</span>
            </div>
            <h2 className={p.headline}>
              Programada para el {formatDate(call.scheduled_at)}
            </h2>
            <p className={p.headlineDetail}>
              Cuando termine, márcala como realizada y pega la transcripción.
            </p>
          </section>
        ) : (
          <section className={p.hero}>
            <div className={p.heroMeta}>
              <span>{stage.step === 4 ? "Al día" : "Siguiente paso"}</span>
              {stage.step < 4 ? <span>Te toca a ti</span> : null}
            </div>
            <h2 className={p.headline}>{stage.next}</h2>
            <div className={s.steps} aria-label="Paso del flujo">
              {["Transcripción", "Análisis", "Aprobar", "Publicado"].map(
                (label, index) => (
                  <div
                    key={label}
                    className={`${s.step} ${stepState(index)}`}
                    aria-current={
                      stepState(index) === s.stepNow ? "step" : undefined
                    }
                  >
                    <b>
                      <i aria-hidden />
                      {label}
                    </b>
                    <span>{stepNote[index]}</span>
                  </div>
                ),
              )}
            </div>
            <div className={p.heroActions}>
              {stage.step === 1 ? (
                <button
                  className={btn.acc}
                  type="button"
                  onClick={() => {
                    setShowTranscriptForm(true);
                    scrollTo("transcripcion");
                  }}
                >
                  Añadir transcripción
                </button>
              ) : null}
              {stage.step === 2 ? (
                <>
                  <button
                    className={btn.acc}
                    type="button"
                    disabled={isBusy}
                    onClick={() => void analyzeCall()}
                  >
                    {busy === "analyze"
                      ? "Analizando..."
                      : "Generar resumen con IA"}
                  </button>
                  <button
                    className={btn.ghost}
                    type="button"
                    onClick={() => {
                      setShowSummaryForm(true);
                      scrollTo("generar");
                    }}
                  >
                    Redactar a mano
                  </button>
                </>
              ) : null}
              {stage.step === 3 ? (
                <a className={btn.acc} href="#resumen">
                  Ir al resumen
                </a>
              ) : null}
              {stage.step === 4 ? (
                <a className={btn.ghost} href="#resumen-publicado">
                  Ver resumen publicado
                </a>
              ) : null}
              {currentTranscript ? (
                <a className={btn.ghost} href="#transcripcion">
                  Ver transcripción
                </a>
              ) : null}
            </div>
          </section>
        )
      ) : null}

      <div className={s.grid}>
        <div className={s.stack}>
          {isConsultant
            ? pendingSummaries.map((summary) => (
                <div key={summary.id} className={s.stack}>
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
              ))
            : null}

          {publishedSummary ? (
            <section className={p.panel} id="resumen-publicado">
              <div className={p.panelH}>
                <div>
                  <h3>{isConsultant ? "Resumen publicado" : "Lo que hablamos"}</h3>
                  <p className={p.sub}>
                    Publicado el {formatDate(publishedSummary.published_at)}
                  </p>
                </div>
              </div>
              <div className={s.stack}>
                <p className={s.lead}>{publishedSummary.summary}</p>
                <StructuredSummary summary={publishedSummary} hideProposedTasks />
                {/* Atajos a otros especialistas: trabajo del consultor, el
                    cliente no los ve. */}
                {isConsultant &&
                isCallSummaryDetail(publishedSummary.key_points) ? (
                  <A01Handoffs
                    organizationId={organizationId}
                    detail={publishedSummary.key_points}
                  />
                ) : null}
              </div>
            </section>
          ) : !isConsultant ? (
            <section className={p.panel}>
              <p className={p.sub}>
                El resumen estará disponible cuando tu consultor lo publique.
              </p>
            </section>
          ) : null}

          {/* La lectura interna sobrevive a la aprobación: sigue siendo lo que
            revisas antes de la siguiente llamada. Solo si no hay uno pendiente,
            que trae el suyo. */}
          {isConsultant &&
          pendingSummaries.length === 0 &&
          publishedSummary &&
          isCallSummaryDetail(publishedSummary.key_points) ? (
            <ConsultantCoaching detail={publishedSummary.key_points} />
          ) : null}

          {isConsultant ? (
            <section className={p.panel} id="transcripcion">
              <div className={p.panelH}>
                <h3>
                  Transcripción
                  {currentTranscript ? (
                    <Chip tone="good">v{currentTranscript.version}</Chip>
                  ) : (
                    <Chip>Sin transcripción</Chip>
                  )}
                </h3>
                {!showTranscriptForm ? (
                  <button
                    className={btn.ghostSm}
                    type="button"
                    onClick={() => setShowTranscriptForm(true)}
                  >
                    {currentTranscript ? "Reemplazar" : "Añadir transcripción"}
                  </button>
                ) : null}
              </div>

              {currentTranscript && !showTranscriptForm ? (
                <div className={s.stack}>
                  <p
                    className={`${s.transcript} ${transcriptExpanded ? "" : s.transcriptClamp}`}
                  >
                    {currentTranscript.content}
                  </p>
                  <div>
                    <button
                      className={btn.ghostSm}
                      type="button"
                      aria-expanded={transcriptExpanded}
                      onClick={() => setTranscriptExpanded((value) => !value)}
                    >
                      {transcriptExpanded
                        ? "Ocultar transcripción"
                        : "Ver transcripción completa"}
                    </button>
                  </div>
                </div>
              ) : null}

              {!currentTranscript && !showTranscriptForm ? (
                <p className={p.sub}>
                  Pégala desde Loom, Fathom o Meet: es lo único que lee la IA
                  para preparar el resumen.
                </p>
              ) : null}

              {showTranscriptForm ? (
                <form className={s.stack} onSubmit={submitTranscript}>
                  <Textarea
                    className="h-40"
                    autoFocus
                    aria-label="Transcripción de la llamada"
                    value={transcriptDraft}
                    onChange={(event) => setTranscriptDraft(event.target.value)}
                    placeholder="Pega aquí la transcripción de Loom, Fathom, Meet..."
                  />
                  {currentTranscript ? (
                    <p className={s.small}>
                      Se guarda como versión nueva. El resumen ya publicado
                      queda atado a la versión que lo originó.
                    </p>
                  ) : null}
                  <div className={s.headActions}>
                    <button
                      className={btn.primary}
                      type="submit"
                      disabled={isBusy || !transcriptDraft.trim()}
                    >
                      {currentTranscript
                        ? `Guardar como v${currentTranscript.version + 1}`
                        : "Guardar transcripción"}
                    </button>
                    <button
                      className={btn.ghost}
                      type="button"
                      onClick={() => {
                        setShowTranscriptForm(false);
                        setTranscriptDraft("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          ) : null}

          {isConsultant ? (
            <section className={p.panel} id="generar">
              <div className={p.panelH}>
                <div>
                  <h3>
                    <span className={p.ia}>IA</span>
                    {pendingSummaries.length || publishedSummary
                      ? "Nuevo resumen"
                      : "Resumen"}
                  </h3>
                  {pendingSummaries.length ? (
                    <p className={p.sub}>
                      Regenerar crea otra propuesta para revisar.
                    </p>
                  ) : null}
                </div>
              </div>
              {showSummaryForm ? (
                <form className={s.stack} onSubmit={submitSummary}>
                  <Textarea
                    className="h-32"
                    autoFocus
                    aria-label="Nuevo resumen de la llamada"
                    value={summaryDraft}
                    onChange={(event) => setSummaryDraft(event.target.value)}
                    placeholder="Puntos tratados, decisiones y próximos pasos..."
                  />
                  <div className={s.headActions}>
                    <button
                      className={btn.primary}
                      type="submit"
                      disabled={isBusy || !summaryDraft.trim()}
                    >
                      Guardar resumen
                    </button>
                    <button
                      className={btn.ghost}
                      type="button"
                      onClick={() => setShowSummaryForm(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className={s.stack}>
                  <Input
                    aria-label="Enfoque para el análisis (opcional)"
                    value={focusDraft}
                    onChange={(event) => setFocusDraft(event.target.value)}
                    placeholder="Enfoque opcional: «profundiza en pricing», «ignora la parte de RRHH»"
                  />
                  <div className={s.headActions}>
                    <button
                      className={btn.acc}
                      type="button"
                      disabled={isBusy || !currentTranscript}
                      onClick={() => void analyzeCall()}
                    >
                      {busy === "analyze"
                        ? "Analizando..."
                        : pendingSummaries.length
                          ? "Regenerar con IA"
                          : "Generar resumen con IA"}
                    </button>
                    <button
                      className={btn.ghost}
                      type="button"
                      onClick={() => setShowSummaryForm(true)}
                    >
                      Redactar a mano
                    </button>
                  </div>
                  {!currentTranscript ? (
                    <p className={s.small}>
                      Añade la transcripción para poder generar el resumen: es
                      lo único que lee la IA.
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}
        </div>

        <aside className={s.aside}>
          <section className={p.panel}>
            <div className={p.panelH}>
              <h3>{isConsultant ? "Tareas de la llamada" : "Tus tareas"}</h3>
              <Chip tone={selectedTaskLinks.length ? "acc" : "neutral"}>
                {selectedTaskLinks.length}
              </Chip>
            </div>

            {isConsultant ? (
              <div className={s.stack}>
                <div
                  className={s.seg}
                  role="group"
                  aria-label="Responsable de las tareas"
                >
                  <button
                    type="button"
                    aria-pressed={taskAudience === "cliente"}
                    onClick={() => setTaskAudience("cliente")}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    aria-pressed={taskAudience === "consultor"}
                    onClick={() => setTaskAudience("consultor")}
                  >
                    Para mí
                  </button>
                </div>
                <form className={s.field} onSubmit={submitTask}>
                  <Input
                    aria-label={
                      taskAudience === "cliente"
                        ? "Nueva tarea para el cliente"
                        : "Nueva tarea interna del consultor"
                    }
                    value={taskTitleDraft}
                    onChange={(event) => setTaskTitleDraft(event.target.value)}
                    placeholder={
                      taskAudience === "cliente"
                        ? "Añadir tarea para el cliente..."
                        : "Añadir tarea interna..."
                    }
                  />
                  <button
                    className={btn.ghost}
                    type="submit"
                    disabled={isBusy || !taskTitleDraft.trim()}
                  >
                    Añadir
                  </button>
                </form>
              </div>
            ) : null}

            {selectedProposedTasks.length > 0 ? (
              <div className={`${s.block} mt-4`}>
                <p className={p.lbl}>Detectadas en la conversación</p>
                <div className={s.list}>
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
                      <div key={`${task.title}-${index}`}>
                        <span className="min-w-0">{task.title}</span>
                        <Chip tone={linked ? "good" : pending ? "warn" : "neutral"}>
                          {linked
                            ? callTaskStatusLabel(linked.tasks?.status)
                            : pending
                              ? "Propuesta"
                              : "No creada"}
                        </Chip>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {additionalCallTasks.length > 0 ? (
              <div className={`${s.block} mt-4`}>
                {isConsultant ? <p className={p.lbl}>Añadidas a mano</p> : null}
                <div className={s.list}>
                  {additionalCallTasks.map((link) => (
                    <div key={link.id}>
                      <span className="min-w-0">
                        {link.tasks?.title ?? link.task_id}
                      </span>
                      <Chip
                        tone={
                          link.tasks?.status === "completed" ? "good" : "neutral"
                        }
                      >
                        {callTaskStatusLabel(link.tasks?.status)}
                      </Chip>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedProposedTasks.length === 0 &&
            additionalCallTasks.length === 0 ? (
              <p className={`${s.small} mt-4`}>
                {taskAudience === "consultor"
                  ? "No tienes tareas internas vinculadas a esta llamada."
                  : isConsultant
                    ? "No hay tareas del cliente vinculadas a esta llamada."
                    : "Esta llamada no dejó tareas para ti."}
              </p>
            ) : null}
          </section>

          {isConsultant ? (
            <section className={p.panel}>
              <div className={p.panelH}>
                <h3>Notas internas</h3>
              </div>
              <div className={s.stack}>
                {call.call_internal_notes.length > 0 ? (
                  <ul className={s.list}>
                    {call.call_internal_notes.map((note) => (
                      <li key={note.id}>
                        <p>{note.body}</p>
                        <p className={s.small}>{formatDate(note.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <form className={s.field} onSubmit={submitNote}>
                  <Input
                    aria-label="Nota interna (solo consultores)"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Escribe una nota..."
                  />
                  <button
                    className={btn.ghost}
                    type="submit"
                    disabled={isBusy || !noteDraft.trim()}
                  >
                    Guardar
                  </button>
                </form>
              </div>
            </section>
          ) : null}

          {previousSummaries.length > 0 ? (
            <section className={p.panel}>
              <div className={p.panelH}>
                <h3>Llamadas anteriores</h3>
              </div>
              <div className={s.list}>
                {previousSummaries.map(({ call: other, summary }) => (
                  <div key={other.id}>
                    <NextLink
                      href={`/llamadas/${other.id}`}
                      className="min-w-0 font-medium"
                    >
                      {other.title}
                    </NextLink>
                    <span className={`${s.small} shrink-0`}>
                      {shortDate(other.held_at ?? other.scheduled_at)}
                      {Array.isArray(summary.agreed_actions) &&
                      summary.agreed_actions.length
                        ? ` · ${summary.agreed_actions.length} decisiones`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
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

  // Tres grupos excluyentes. "Te esperan" usa callStage, el mismo criterio que
  // el detalle, para que la lista y la llamada nunca digan cosas distintas.
  const byDateDesc = (a: ConsultingCall, b: ConsultingCall) =>
    Date.parse(callWhen(b)) - Date.parse(callWhen(a));
  const upcoming = calls
    .filter((call) => call.status === "scheduled" && isUpcoming(call.scheduled_at))
    .sort((a, b) => -byDateDesc(a, b));
  const waiting = isConsultant
    ? calls
        .filter(
          (call) =>
            call.status !== "cancelled" &&
            !upcoming.includes(call) &&
            callStage(call).step < 4,
        )
        .sort(byDateDesc)
    : [];
  const history = calls
    .filter((call) => !upcoming.includes(call) && !waiting.includes(call))
    .sort(byDateDesc);

  const lastHeld = calls
    .filter((call) => call.status === "held" && call.held_at)
    .sort(byDateDesc)[0];
  const lastHeldDays = daysSince(lastHeld?.held_at);
  const taskLinks = calls.flatMap((call) =>
    call.call_task_links.filter((link) => link.tasks),
  );
  const openTasks = taskLinks.filter((link) =>
    OPEN_TASK_STATUSES.has(link.tasks?.status ?? ""),
  ).length;

  const metrics: Array<{
    label: string;
    value: string;
    hint?: string;
    tone?: "default" | "warn" | "success";
  }> = calls.length
    ? [
        ...(isConsultant
          ? [
              {
                label: "Te esperan",
                value: waiting.length.toLocaleString("es-ES"),
                hint: "Llamadas con un paso pendiente tuyo",
                tone: waiting.length ? ("warn" as const) : ("success" as const),
              },
            ]
          : []),
        {
          label: "Próxima llamada",
          value: upcoming[0]?.scheduled_at
            ? shortDate(upcoming[0].scheduled_at)
            : "Sin agendar",
          tone: upcoming.length ? "default" : "warn",
        },
        {
          label: isConsultant ? "Tareas abiertas de llamadas" : "Tareas abiertas",
          value: `${openTasks} / ${taskLinks.length}`,
        },
        {
          label: "Última realizada",
          value:
            lastHeldDays === null
              ? "Ninguna"
              : lastHeldDays === 0
                ? "Hoy"
                : `Hace ${lastHeldDays} d`,
          hint: "Frecuencia de contacto",
        },
      ]
    : [];
  // Las mismas cifras que ve la pantalla, publicadas al Consultor IA.
  useModuleSummary(metrics.length ? { metrics } : null);

  return (
    <div className="grid gap-7">
      <section className={s.head}>
        <h1 className={s.title}>Llamadas</h1>
        {isConsultant ? (
          <>
            {/* El boton NO puede ir dentro de `Modal.Trigger`: ese componente
                renderiza un `<div role="button">` con la pulsacion de
                react-aria, y el `Button` de dentro (react-aria tambien) corta
                la propagacion -- el div nunca recibia el clic y "Registrar
                llamada" no hacia absolutamente nada. El modal ya esta
                controlado por `isOpen`, asi que se abre desde el propio boton. */}
            <button
              className={btn.primary}
              type="button"
              onClick={() => setShowCreateForm(true)}
            >
              Registrar llamada
            </button>
            <Dialog
              isOpen={showCreateForm}
              onOpenChange={(open) => {
                setShowCreateForm(open);
                if (!open) setCreateError(null);
              }}
              title="Registrar llamada"
              isBusy={isCreating}
              isDirty={Boolean(newTitle.trim() || newRecordingUrl.trim())}
              formId="create-call-form"
              primary={{
                label: "Crear llamada",
                busyLabel: "Creando…",
                disabled: !newTitle.trim(),
              }}
            >
              <form id="create-call-form" className="space-y-4" onSubmit={submitCreate}>
                <Field label="Título">
                  <Input
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="Ej: Revisión mensual julio"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fecha y hora">
                    {/* `type="date"` perdia la hora de la llamada, que es justo lo
                        que hace falta para agendarla. */}
                    <Input
                      type="datetime-local"
                      value={newScheduledAt}
                      onChange={(event) => setNewScheduledAt(event.target.value)}
                    />
                  </Field>
                  <Field label="Tipo">
                    <Select
                      aria-label="Tipo"
                      value={newType}
                      onChange={setNewType}
                      options={Object.entries(callTypeLabels).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                </div>
                {/* La grabacion ya la aceptaba la API desde el primer dia, pero el
                    formulario no la pedia y no habia otra pantalla para añadirla. */}
                <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                  <Field label="Grabación (opcional)">
                    <Input
                      type="url"
                      value={newRecordingUrl}
                      onChange={(event) => setNewRecordingUrl(event.target.value)}
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
                {createError ? <ErrorBlock>{createError}</ErrorBlock> : null}
              </form>
            </Dialog>
          </>
        ) : null}
      </section>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {/* Antes de una llamada el consultor necesita saber cuándo fue la
          anterior, qué quedó sin cerrar y qué le espera. */}
      {!isLoading && metrics.length > 0 ? (
        <section className={s.pulse} aria-label="Resumen de llamadas">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={
                metric.label === "Te esperan" && metric.tone === "warn"
                  ? s.hot
                  : metric.tone === "warn"
                    ? s.warn
                    : undefined
              }
            >
              <b>{metric.value}</b>
              <span>{metric.label}</span>
            </div>
          ))}
        </section>
      ) : null}

      {isLoading ? (
        <LoadingBlock label="Cargando llamadas..." />
      ) : calls.length === 0 ? (
        <EmptyState
          title="Aún no hay llamadas registradas"
          hint={
            isConsultant
              ? "Registra la primera para guardar su transcripción y sacar el resumen con IA."
              : "Cuando tu consultor registre una llamada, aparecerá aquí."
          }
          action={
            isConsultant ? (
              <button
                className={btn.primary}
                type="button"
                onClick={() => setShowCreateForm(true)}
              >
                Registrar llamada
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <CallGroup
            label="Te esperan"
            calls={waiting}
            render={(call) => {
              const stage = callStage(call);
              return (
                <CallRow
                  key={call.id}
                  call={call}
                  aside={
                    <>
                      <div className={s.bar} aria-hidden>
                        {[1, 2, 3, 4].map((step) => (
                          <i
                            key={step}
                            className={
                              step < stage.step
                                ? s.barDone
                                : step === stage.step
                                  ? s.barNow
                                  : undefined
                            }
                          />
                        ))}
                      </div>
                      <span className={s.stage}>{stage.label}</span>
                    </>
                  }
                  action={
                    <span className={stage.step === 3 ? btn.accSm : btn.ghostSm}>
                      {STAGE_ACTION[stage.step]}
                    </span>
                  }
                />
              );
            }}
          />
          <CallGroup
            label="Próximas"
            calls={upcoming}
            render={(call) => (
              <CallRow
                key={call.id}
                call={call}
                aside={
                  <span className={s.stage}>
                    {new Date(call.scheduled_at as string).toLocaleTimeString(
                      "es-ES",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </span>
                }
                action={<span className={btn.ghostSm}>Abrir</span>}
              />
            )}
          />
          <CallGroup
            label="Historial"
            calls={history}
            render={(call) => {
              const links = call.call_task_links.filter((link) => link.tasks);
              const closed = links.filter(
                (link) => link.tasks?.status === "completed",
              ).length;
              const hasPublished = call.call_ai_summaries.some(
                (summary) => summary.status === "published",
              );
              return (
                <CallRow
                  key={call.id}
                  call={call}
                  muted={call.status === "cancelled"}
                  aside={
                    <span className={s.stage}>
                      {call.status === "cancelled" ? (
                        <Chip>Cancelada</Chip>
                      ) : hasPublished ? (
                        <Chip tone="good">
                          {isConsultant ? "Publicado" : "Resumen disponible"}
                        </Chip>
                      ) : null}
                      {links.length ? (
                        <span className={s.small}>
                          {closed} de {links.length} tareas cerradas
                        </span>
                      ) : null}
                    </span>
                  }
                  action={<span className={btn.ghostSm}>Abrir</span>}
                />
              );
            }}
          />
        </>
      )}
    </div>
  );
}

const STAGE_ACTION: Record<number, string> = {
  1: "Pegar transcripción",
  2: "Analizar",
  3: "Revisar",
  4: "Abrir",
};

function CallGroup({
  label,
  calls,
  render,
}: {
  label: string;
  calls: ConsultingCall[];
  render: (call: ConsultingCall) => ReactNode;
}) {
  if (calls.length === 0) return null;
  return (
    <section className={s.group}>
      <p className={p.lbl}>
        {label} · {calls.length}
      </p>
      <div className={s.rows}>{calls.map(render)}</div>
    </section>
  );
}

function CallRow({
  call,
  aside,
  action,
  muted = false,
}: {
  call: ConsultingCall;
  aside: ReactNode;
  action: ReactNode;
  muted?: boolean;
}) {
  const when = new Date(callWhen(call));
  return (
    <NextLink
      href={`/llamadas/${call.id}`}
      aria-label={`Abrir llamada ${call.title}`}
      className={`${s.row} ${muted ? s.rowMuted : ""}`}
    >
      <div className={s.date}>
        <b>{when.getDate()}</b>
        {when.toLocaleDateString("es-ES", { month: "short" })}
      </div>
      <div className="min-w-0">
        <p className={s.rowTitle}>{call.title}</p>
        <p className={s.rowMeta}>
          {[
            callTypeLabels[call.call_type] ?? call.call_type,
            call.duration_minutes ? `${call.duration_minutes} min` : null,
            call.recording_provider ? displayValue(call.recording_provider) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="min-w-0">{aside}</div>
      <div>{action}</div>
    </NextLink>
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
    return <LoadingBlock label="Cargando llamadas de la cartera..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
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
    <div className="grid gap-7">
      <section className={s.head}>
        <div>
          <p className={p.lbl}>Toda la cartera</p>
          <h1 className={s.title}>Llamadas</h1>
        </div>
        {/* Registrar una llamada exige un cliente activo (la API es por
            organizacion). Con un cliente filtrado, esto abre su vista, que es
            donde se registra. */}
        {clientFilter !== "all" ? (
          <button
            className={btn.primary}
            type="button"
            onClick={() => setOrganizationId(clientFilter)}
          >
            Registrar llamada en este cliente
          </button>
        ) : null}
      </section>

      <section className={s.pulse} aria-label="Resumen de la cartera">
        <div className={pendingCount ? s.hot : undefined}>
          <b>{pendingCount.toLocaleString("es-ES")}</b>
          <span>Resúmenes por aprobar</span>
        </div>
        <div>
          <b>{data.calls.length.toLocaleString("es-ES")}</b>
          <span>Llamadas registradas</span>
        </div>
        <div>
          <b>{data.organizations.length.toLocaleString("es-ES")}</b>
          <span>Clientes</span>
        </div>
      </section>

      <div className={s.headActions}>
        <Select
          className="w-56"
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
        <button
          className={onlyPending ? `${btn.primary} ${p.sm}` : btn.ghostSm}
          type="button"
          aria-pressed={onlyPending}
          onClick={() => setOnlyPending((value) => !value)}
        >
          Solo por aprobar
        </button>
        {clientFilter === "all" ? (
          <span className={s.small}>
            Elige un cliente para registrar una llamada.
          </span>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin llamadas para este filtro"
          hint="Cambia el filtro o abre un cliente para registrar una llamada."
        />
      ) : (
        <div className={s.rows}>
          {filtered.map((call) => {
            const when = new Date(call.held_at ?? call.created_at);
            return (
              <NextLink
                key={call.id}
                href={`/llamadas/${call.id}`}
                onClick={() => setOrganizationId(call.organization_id)}
                aria-label={`Abrir llamada ${call.title} de ${call.organization_name}`}
                className={s.row}
              >
                <div className={s.date}>
                  <b>{when.getDate()}</b>
                  {when.toLocaleDateString("es-ES", { month: "short" })}
                </div>
                <div className="min-w-0">
                  <p className={s.rowTitle}>{call.title}</p>
                  <p className={s.rowMeta}>
                    {call.organization_name} · {displayValue(call.call_type)} ·{" "}
                    {displayValue(call.status)}
                  </p>
                </div>
                <div className="min-w-0">
                  {call.summary_pending ? (
                    <Chip tone="warn">Resumen por aprobar</Chip>
                  ) : call.has_published_summary ? (
                    <Chip tone="good">Publicado</Chip>
                  ) : null}
                </div>
                <div>
                  <span className={call.summary_pending ? btn.accSm : btn.ghostSm}>
                    {call.summary_pending ? "Revisar" : "Abrir"}
                  </span>
                </div>
              </NextLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CallsRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  return (
    <CallsTheme isConsultant={isConsultant}>
      {isConsultant && !organizationId ? (
        <ConsultantCallsView />
      ) : (
        <CallsContent bootstrap={bootstrap} />
      )}
    </CallsTheme>
  );
}
