"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { isSummaryCurrentForTranscript } from "./summary-visibility";
import {
  AsyncState,
  LoadingBlock,
  Heading,
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  cn,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  IconChevronDown,
  IconChevronUp,
  Input,
  Link,
  List,
  Modal,
  Select,
  Textarea,
  toast,
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
  confidence?: string;
  warnings?: string[];
};

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
}: {
  summary: CallSummary;
  // En la revisión de un resumen pendiente las tareas propuestas se muestran
  // como checklist interactiva aparte (PendingSummaryReview), no aquí.
  hideProposedTasks?: boolean;
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
          <p className={EYEBROW}>
            Hechos
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {detail.facts.map((fact, index) => (
              <li key={index}>{fact}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {decisions.length ? (
        <div>
          <p className={EYEBROW}>
            Decisiones
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.recommendations?.length ? (
        <div>
          <p className={EYEBROW}>
            Recomendaciones
          </p>
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
          <p className={EYEBROW}>
            Riesgos
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {detail.risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hideProposedTasks && detail?.proposed_tasks?.length ? (
        <div>
          <p className={EYEBROW}>
            Tareas propuestas (se crean al aprobar)
          </p>
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
        <div className="border-l-2 border-warn pl-3">
          <p className={cn(EYEBROW, "text-warn-deep")}>Avisos</p>
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

type CallInternalNote = {
  id: string;
  body: string;
  author_user_id: string;
  created_at: string;
};

type CallTaskLink = {
  id: string;
  task_id: string;
  tasks: { id: string; title: string; status: string; priority: string } | null;
};

type ConsultingCall = {
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

const taskStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  ignored: "Ignorada",
  cancelled: "Cancelada",
};

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
}

const CONFIDENCE_META: Record<string, { label: string; tone: "success" | "warn" | "danger" }> = {
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
  onApprove,
  onReject,
}: {
  summary: CallSummary;
  isBusy: boolean;
  onApprove: (selectedTaskIndexes: number[]) => void;
  onReject: (reason: string) => void;
}) {
  const detail = isCallSummaryDetail(summary.key_points)
    ? summary.key_points
    : null;
  const proposedTasks = detail?.proposed_tasks ?? [];
  const warnings = detail?.warnings ?? [];
  const confidence = detail?.confidence;

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(proposedTasks.map((_, index) => index)),
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

        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
          {summary.summary}
        </p>

        <StructuredSummary summary={summary} hideProposedTasks />

        {proposedTasks.length ? (
          <div>
            <p className={EYEBROW}>
              Tareas propuestas · marca las que quieras crear al aprobar
            </p>
            <ul className="mt-2 space-y-1.5">
              {proposedTasks.map((task, index) => (
                <li
                  key={index}
                  className="rounded-md border border-separator bg-surface p-2.5 text-sm"
                >
                  <Checkbox
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                  >
                    <span className="font-medium">{task.title}</span>
                  </Checkbox>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-6">
                    <Badge tone={task.owner === "cliente" ? "neutral" : "brand"}>
                      {task.owner}
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
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            size="sm"
            type="button"
            disabled={isBusy}
            onClick={() => onApprove([...selected])}
          >
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

function CallDetail({
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

  const [summaryDraft, setSummaryDraft] = useState("");
  const [showSummaryForm, setShowSummaryForm] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
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
    opts?: { reason?: string; selectedTaskIndexes?: number[] },
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
    const saved = await run(() =>
      apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitleDraft }),
      }),
    );
    if (saved) {
      setTaskTitleDraft("");
    }
  }

  return (
    <Card
      title={call.title}
      description={
        `${callTypeLabels[call.call_type] ?? call.call_type} · ${formatDate(call.held_at ?? call.scheduled_at)}${call.duration_minutes ? ` · ${call.duration_minutes} min` : ""}`
      }
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
      <div className="space-y-6">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}

        {publishedSummary ? (
          <Card title="Resumen de la llamada">
            <p className="whitespace-pre-wrap text-sm leading-6">
              {publishedSummary.summary}
            </p>
            <StructuredSummary summary={publishedSummary} />
            <p className="mt-2 text-xs text-muted">
              Publicado el {formatDate(publishedSummary.published_at)}
            </p>
          </Card>
        ) : !isConsultant ? (
          <p className="text-sm text-muted">
            El resumen estara disponible cuando se publique.
          </p>
        ) : null}

        {isConsultant ? (
          <>
            {pendingSummaries.map((summary) => (
              <PendingSummaryReview
                key={summary.id}
                summary={summary}
                isBusy={isBusy}
                onApprove={(selectedTaskIndexes) =>
                  decideSummary(summary.id, "approved", { selectedTaskIndexes })
                }
                onReject={(reason) =>
                  decideSummary(summary.id, "rejected", { reason })
                }
              />
            ))}

            <Accordion
              className="border border-separator"
              items={[
                {
                  id: "transcript",
                  title: `Transcripcion ${currentTranscript ? `(v${currentTranscript.version})` : "(sin transcripcion)"}`,
                  content: (
                    <div className="space-y-3">
                      {currentTranscript ? (
                        <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {currentTranscript.content}
                        </p>
                      ) : (
                        <p className="text-sm text-muted">
                          Pega la transcripcion de Loom/Fathom para que el
                          resumen (y el futuro agente A01) tenga contexto.
                        </p>
                      )}
                      {showTranscriptForm ? (
                        <form className="space-y-2" onSubmit={submitTranscript}>
                          <Textarea
                            className="h-40"
                            aria-label="Transcripcion de la llamada"
                            value={transcriptDraft}
                            onChange={(event) =>
                              setTranscriptDraft(event.target.value)
                            }
                            placeholder="Pega aquí la transcripcion completa..."
                          />
                          <Button
                            size="sm"
                            type="submit"
                            disabled={isBusy || !transcriptDraft.trim()}
                          >
                            Guardar nueva version
                          </Button>
                        </form>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setShowTranscriptForm(true)}
                        >
                          {currentTranscript
                            ? "Reemplazar transcripcion"
                            : "Añadir transcripcion"}
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />

            {showSummaryForm ? (
              <form
                className="space-y-2 border-t border-separator pt-3"
                onSubmit={submitSummary}
              >
                <p className="text-sm font-medium">
                  Nuevo resumen (quedara pendiente de aprobación)
                </p>
                <Textarea
                  className="h-32"
                  aria-label="Nuevo resumen de la llamada"
                  value={summaryDraft}
                  onChange={(event) => setSummaryDraft(event.target.value)}
                  placeholder="Puntos tratados, decisiones y próximos pasos..."
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={isBusy || !summaryDraft.trim()}
                >
                  Guardar resumen
                </Button>
              </form>
            ) : (
              <div className="space-y-2">
                <Input
                  aria-label="Enfoque para el análisis (opcional)"
                  value={focusDraft}
                  onChange={(event) => setFocusDraft(event.target.value)}
                  placeholder="Enfoque para la IA (opcional): p. ej. «profundiza en pricing», «ignora la parte de RRHH»"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={isBusy || !currentTranscript}
                    onClick={analyzeCall}
                    title={
                      currentTranscript
                        ? "Genera el resumen desde la transcripcion con el agente A01 (usa el enfoque si lo hay)"
                        : "Añade la transcripcion para poder generar el resumen con IA"
                    }
                  >
                    {isBusy
                      ? "Generando..."
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
              </div>
            )}
          </>
        ) : null}

        {call.call_task_links.length > 0 ? (
          <section>
            <p className={EYEBROW}>
              Tareas de esta llamada
            </p>
            <ul className="mt-2 space-y-1">
              {call.call_task_links.map((link) => (
                <li key={link.id} className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-muted">
                    {taskStatusLabels[link.tasks?.status ?? ""] ?? "Sin estado"}
                  </span>
                  <span>{link.tasks?.title ?? link.task_id}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isConsultant ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitTask}>
              <Input
                className="w-full"
                aria-label="Nueva tarea acordada en la llamada"
                value={taskTitleDraft}
                onChange={(event) => setTaskTitleDraft(event.target.value)}
                placeholder="Nueva tarea acordada en la llamada..."
              />
              <Button
                size="sm"
                type="submit"
                className="w-full sm:w-auto"
                disabled={isBusy || !taskTitleDraft.trim()}
              >
                Crear
              </Button>
            </form>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitNote}>
              <Input
                className="w-full"
                aria-label="Nota interna (solo consultores)"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Nota interna (solo consultores)..."
              />
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                className="w-full sm:w-auto"
                disabled={isBusy || !noteDraft.trim()}
              >
                Anotar
              </Button>
            </form>
          </div>
        ) : null}

        {isConsultant && call.call_internal_notes.length > 0 ? (
          <section className="border-l-2 border-separator py-1 pl-3">
            <p className={EYEBROW}>Notas internas</p>
            <ul className="mt-2 space-y-2">
              {call.call_internal_notes.map((note) => (
                <li key={note.id} className="text-sm">
                  {note.body}
                  <span className="ml-2 text-xs text-muted">
                    {formatDate(note.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {previousSummaries.length > 0 ? (
          <Accordion
            className="border border-separator"
            items={[
              {
                id: "history",
                title: `Llamadas anteriores (${previousSummaries.length})`,
                content: (
                  <div className="space-y-4">
                    {previousSummaries.map(({ call: other, summary }) => {
                      const decisions = Array.isArray(summary.agreed_actions)
                        ? summary.agreed_actions
                        : [];
                      return (
                        <div
                          key={other.id}
                          className="border-l-2 border-separator pl-3"
                        >
                          <p className="text-sm font-medium">{other.title}</p>
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
                              {decisions.slice(0, 4).map((decision, index) => (
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
        ) : null}
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
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Un cliente activo -> una llamada abierta a la vez (lista plegable). Sin
  // esto, cada llamada se renderizaba entera y la vista era un muro de texto.
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

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
          }),
        },
      );

      if (!response.ok) {
        setCreateError(await readApiError(response));
        return;
      }

      setNewTitle("");
      setNewScheduledAt("");
      setShowCreateForm(false);
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
          <Modal
            isOpen={showCreateForm}
            onOpenChange={(open) => {
              setShowCreateForm(open);
              if (!open) setCreateError(null);
            }}
          >
            <Modal.Trigger>
              <Button type="button">Registrar llamada</Button>
            </Modal.Trigger>
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
                            onChange={(event) => setNewTitle(event.target.value)}
                            placeholder="Ej: Revisión mensual julio"
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Fecha">
                            <Input
                              type="date"
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
        ) : null}
      </section>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

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
            const open = expandedCallId === call.id;
            const when = call.held_at ?? call.scheduled_at;
            return (
              <List.Item key={call.id} className="px-1 py-2.5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setExpandedCallId(open ? null : call.id)
                  }
                  className="flex w-full items-center gap-2 text-left"
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
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {call.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {when
                      ? new Date(when).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </span>
                  {open ? (
                    <IconChevronUp aria-hidden className="shrink-0 text-muted" />
                  ) : (
                    <IconChevronDown
                      aria-hidden
                      className="shrink-0 text-muted"
                    />
                  )}
                </button>
                {open ? (
                  <div className="mt-3">
                    <CallDetail
                      call={call}
                      isConsultant={isConsultant}
                      onChanged={loadCalls}
                      priorCalls={calls}
                    />
                  </div>
                ) : null}
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
  const [data, setData] = useState<{
    calls: ConsultantCallRow[];
    organizations: Array<{ id: string; display_name: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [onlyPending, setOnlyPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch("/v1/consultant/calls")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        setData(
          (await response.json()) as {
            calls: ConsultantCallRow[];
            organizations: Array<{ id: string; display_name: string }>;
          },
        );
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudieron cargar las llamadas por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Sin llamadas para este filtro"
            hint="Cambia el filtro o abre un cliente para registrar una llamada."
          />
        ) : (
          <List>
            {filtered.map((call) => (
              <List.Item
                as="button"
                key={call.id}
                type="button"
                onClick={() => setOrganizationId(call.organization_id)}
                className="flex w-full items-start justify-between gap-4 py-3 text-left hover:bg-surface"
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
                    {call.organization_name} · {displayValue(call.call_type)} ·{" "}
                    {displayValue(call.status)}
                    {call.held_at
                      ? ` · ${new Date(call.held_at).toLocaleDateString("es-ES")}`
                      : ""}
                  </p>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}

function CallsRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    return <ConsultantCallsView />;
  }

  return <CallsContent bootstrap={bootstrap} />;
}

export default function CallsPage() {
  return (
    <PortalShell title="Llamadas">
      {(bootstrap) => <CallsRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
