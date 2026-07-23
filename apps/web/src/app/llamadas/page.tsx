"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { Button, Field, Input, LoadingBlock, Select, Textarea } from "@ecomscaling/ui";

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
  recommendations?: Array<{ action: string; priority: string; rationale: string }>;
  risks?: string[];
  key_quotes?: string[];
  proposed_tasks?: Array<{ title: string; description: string; priority: string; owner: string }>;
  confidence?: string;
  warnings?: string[];
};

type CallSummary = {
  id: string;
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

function isCallSummaryDetail(value: CallSummary["key_points"]): value is CallSummaryDetail {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

const priorityLabels: Record<string, string> = {
  low: "baja",
  medium: "media",
  high: "alta",
  urgent: "urgente",
};

function StructuredSummary({ summary }: { summary: CallSummary }) {
  const detail = isCallSummaryDetail(summary.key_points) ? summary.key_points : null;
  const decisions = Array.isArray(summary.agreed_actions) ? summary.agreed_actions : [];

  if (!detail && decisions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 text-sm">
      {detail?.facts?.length ? (
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Hechos</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {detail.facts.map((fact, index) => (
              <li key={index}>{fact}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {decisions.length ? (
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Decisiones</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.recommendations?.length ? (
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Recomendaciones
          </p>
          <ul className="mt-1 space-y-1">
            {detail.recommendations.map((rec, index) => (
              <li key={index}>
                <span className="font-medium">{rec.action}</span>{" "}
                <span className="font-mono text-xs text-muted">
                  ({priorityLabels[rec.priority] ?? rec.priority})
                </span>
                {rec.rationale ? <span className="text-muted"> — {rec.rationale}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.risks?.length ? (
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Riesgos</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {detail.risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.proposed_tasks?.length ? (
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Tareas propuestas (se crean al aprobar)
          </p>
          <ul className="mt-1 space-y-0.5">
            {detail.proposed_tasks.map((task, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-2">
                <span>{task.title}</span>
                <span className="font-mono text-xs text-muted">
                  {priorityLabels[task.priority] ?? task.priority} · {task.owner}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.warnings?.length ? (
        <div className="border-l-2 border-warn pl-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-warn-deep">Avisos</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
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

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
    .filter(Boolean)
    .join(" - ");
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function CallDetail({
  call,
  isConsultant,
  onChanged,
}: {
  call: ConsultingCall;
  isConsultant: boolean;
  onChanged: () => void;
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

  const currentTranscript = call.call_transcripts[0] ?? null;
  const publishedSummary = call.call_ai_summaries.find((summary) => summary.status === "published");
  const pendingSummaries = call.call_ai_summaries.filter(
    (summary) => summary.status === "pending_approval",
  );

  async function run(action: () => Promise<Response>) {
    setIsBusy(true);
    setError(null);
    const response = await action();

    if (!response.ok) {
      setError(await readApiError(response));
      setIsBusy(false);
      return false;
    }

    setIsBusy(false);
    onChanged();
    return true;
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
      apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/transcript`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: transcriptDraft, source: "manual" }),
      }),
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
  // pendiente de aprobacion, igual que un resumen redactado a mano.
  async function analyzeCall() {
    await run(() =>
      apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/analyze`, {
        method: "POST",
      }),
    );
  }

  async function decideSummary(summaryId: string, decision: "approved" | "rejected") {
    await run(() =>
      apiFetch(`/v1/organizations/${organizationId}/call-summaries/${summaryId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      }),
    );
  }

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      apiFetch(`/v1/organizations/${organizationId}/calls/${call.id}/internal-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft }),
      }),
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
    <article className="border-t border-ink/20">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-medium">{call.title}</p>
          <p className="mt-1 text-sm text-muted">
            {callTypeLabels[call.call_type] ?? call.call_type} - {formatDate(call.held_at ?? call.scheduled_at)}
            {call.duration_minutes ? ` - ${call.duration_minutes} min` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wide text-muted">
            {callStatusLabels[call.status] ?? call.status}
          </span>
          {!call.is_visible_to_client && isConsultant ? (
            <span className="font-mono text-xs uppercase tracking-wide text-warn-deep">
              oculta al cliente
            </span>
          ) : null}
          {call.recording_url ? (
            <a
              className="text-sm font-medium underline decoration-edge-strong decoration-1 underline-offset-4 transition hover:text-brand hover:decoration-brand"
              href={call.recording_url}
              target="_blank"
              rel="noreferrer"
            >
              Ver grabacion{call.recording_provider ? ` (${call.recording_provider})` : ""}
            </a>
          ) : null}
          {isConsultant && call.status === "scheduled" ? (
            <Button size="sm" type="button" disabled={isBusy} onClick={markHeld}>
              Marcar realizada
            </Button>
          ) : null}
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {error ? <p className="text-sm text-brand-deep">{error}</p> : null}

        {publishedSummary ? (
          <section className="border border-line bg-surface p-3">
            <p className="text-xs font-medium uppercase text-muted">Resumen de la llamada</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{publishedSummary.summary}</p>
            <StructuredSummary summary={publishedSummary} />
            <p className="mt-2 text-xs text-muted">
              Publicado el {formatDate(publishedSummary.published_at)}
            </p>
          </section>
        ) : !isConsultant ? (
          <p className="text-sm text-muted">El resumen estara disponible cuando se publique.</p>
        ) : null}

        {isConsultant ? (
          <>
            {pendingSummaries.map((summary) => (
              <section key={summary.id} className="border border-warn p-3">
                <p className="text-xs font-medium uppercase text-warn-deep">
                  {summaryStatusLabels[summary.status]}
                  {summary.run_id ? " · generado por IA (A01)" : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{summary.summary}</p>
                <StructuredSummary summary={summary} />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" type="button" disabled={isBusy} onClick={() => decideSummary(summary.id, "approved")}>
                    Aprobar y publicar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={isBusy}
                    onClick={() => decideSummary(summary.id, "rejected")}
                  >
                    Rechazar
                  </Button>
                </div>
              </section>
            ))}

            <details className="border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Transcripcion {currentTranscript ? `(v${currentTranscript.version})` : "(sin transcripcion)"}
              </summary>
              <div className="space-y-3 border-t border-line px-3 py-3">
                {currentTranscript ? (
                  <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-ink">
                    {currentTranscript.content}
                  </p>
                ) : (
                  <p className="text-sm text-muted">
                    Pega la transcripcion de Loom/Fathom para que el resumen (y el futuro agente A01)
                    tenga contexto.
                  </p>
                )}
                {showTranscriptForm ? (
                  <form className="space-y-2" onSubmit={submitTranscript}>
                    <Textarea
                      className="h-40"
                      aria-label="Transcripcion de la llamada"
                      value={transcriptDraft}
                      onChange={(event) => setTranscriptDraft(event.target.value)}
                      placeholder="Pega aquí la transcripcion completa..."
                    />
                    <Button size="sm" type="submit" disabled={isBusy || !transcriptDraft.trim()}>
                      Guardar nueva version
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setShowTranscriptForm(true)}
                  >
                    {currentTranscript ? "Reemplazar transcripcion" : "Añadir transcripcion"}
                  </Button>
                )}
              </div>
            </details>

            {showSummaryForm ? (
              <form className="space-y-2 border-t border-line pt-3" onSubmit={submitSummary}>
                <p className="text-sm font-medium">Nuevo resumen (quedara pendiente de aprobación)</p>
                <Textarea
                  className="h-32"
                  aria-label="Nuevo resumen de la llamada"
                  value={summaryDraft}
                  onChange={(event) => setSummaryDraft(event.target.value)}
                  placeholder="Puntos tratados, decisiones y próximos pasos..."
                />
                <Button size="sm" type="submit" disabled={isBusy || !summaryDraft.trim()}>
                  Guardar resumen
                </Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  type="button"
                  disabled={isBusy || !currentTranscript}
                  onClick={analyzeCall}
                  title={
                    currentTranscript
                      ? "Genera el resumen desde la transcripcion con el agente A01"
                      : "Añade la transcripcion para poder generar el resumen con IA"
                  }
                >
                  {isBusy ? "Generando..." : "Generar resumen con IA"}
                </Button>
                <Button variant="secondary" type="button" onClick={() => setShowSummaryForm(true)}>
                  Redactar a mano
                </Button>
              </div>
            )}
          </>
        ) : null}

        {call.call_task_links.length > 0 ? (
          <section>
            <p className="text-xs font-medium uppercase text-muted">Tareas de esta llamada</p>
            <ul className="mt-2 space-y-1">
              {call.call_task_links.map((link) => (
                <li key={link.id} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted">{link.tasks?.status ?? "?"}</span>
                  <span>{link.tasks?.title ?? link.task_id}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isConsultant ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <form className="flex gap-2" onSubmit={submitTask}>
              <Input
                className="w-full"
                aria-label="Nueva tarea acordada en la llamada"
                value={taskTitleDraft}
                onChange={(event) => setTaskTitleDraft(event.target.value)}
                placeholder="Nueva tarea acordada en la llamada..."
              />
              <Button size="sm" type="submit" disabled={isBusy || !taskTitleDraft.trim()}>
                Crear
              </Button>
            </form>
            <form className="flex gap-2" onSubmit={submitNote}>
              <Input
                className="w-full"
                aria-label="Nota interna (solo consultores)"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Nota interna (solo consultores)..."
              />
              <Button variant="secondary" size="sm" type="submit" disabled={isBusy || !noteDraft.trim()}>
                Anotar
              </Button>
            </form>
          </div>
        ) : null}

        {isConsultant && call.call_internal_notes.length > 0 ? (
          <section className="border-l-2 border-edge py-0.5 pl-3">
            <p className="text-xs font-medium uppercase text-muted">Notas internas</p>
            <ul className="mt-2 space-y-2">
              {call.call_internal_notes.map((note) => (
                <li key={note.id} className="text-sm">
                  {note.body}
                  <span className="ml-2 font-mono text-xs text-muted">
                    {formatDate(note.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function CallsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);

  const [calls, setCalls] = useState<ConsultingCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("monthly_review");
  const [newRecordingUrl, setNewRecordingUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadCalls = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    const response = await apiFetch(`/v1/organizations/${organizationId}/calls`);

    if (!response.ok) {
      setError(await readApiError(response));
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as { calls: ConsultingCall[] };
    setCalls(payload.calls);
    setError(null);
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    setIsLoading(true);
    void loadCalls();
  }, [loadCalls]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    const response = await apiFetch(`/v1/organizations/${organizationId}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        call_type: newType,
        recording_url: newRecordingUrl.trim() || undefined,
        recording_provider: newRecordingUrl.includes("loom.com")
          ? "loom"
          : newRecordingUrl.includes("fathom")
            ? "fathom"
            : undefined,
      }),
    });

    if (!response.ok) {
      setCreateError(await readApiError(response));
      setIsCreating(false);
      return;
    }

    setNewTitle("");
    setNewRecordingUrl("");
    setShowCreateForm(false);
    setIsCreating(false);
    void loadCalls();
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-baseline justify-between gap-3 border-t border-ink/20 pt-5">
        <h3 className="font-display text-2xl">Llamadas de consultoría</h3>
        {isConsultant ? (
          <Button type="button" onClick={() => setShowCreateForm((value) => !value)}>
            {showCreateForm ? "Cerrar" : "Registrar llamada"}
          </Button>
        ) : null}
      </section>

      {showCreateForm && isConsultant ? (
        <form className="space-y-3 border-t border-ink/20 pt-5" onSubmit={submitCreate}>
          <div className="grid gap-3 md:grid-cols-[1fr_200px_1fr]">
            <Field label="Titulo">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Ej: Revisión mensual julio"
              />
            </Field>
            <Field label="Tipo">
              <Select value={newType} onChange={(event) => setNewType(event.target.value)}>
                {Object.entries(callTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Enlace grabacion (Loom/Fathom, opcional)">
              <Input
                value={newRecordingUrl}
                onChange={(event) => setNewRecordingUrl(event.target.value)}
                placeholder="https://www.loom.com/share/..."
              />
            </Field>
          </div>
          <Button type="submit" disabled={isCreating || !newTitle.trim()}>
            {isCreating ? "Creando..." : "Crear llamada"}
          </Button>
          {createError ? <p className="text-sm text-brand-deep">{createError}</p> : null}
        </form>
      ) : null}

      {error ? (
        <div className="border-l-2 border-brand py-0.5 pl-3 text-sm text-brand-deep">{error}</div>
      ) : null}

      {isLoading ? (
        <LoadingBlock label="Cargando llamadas..." />
      ) : calls.length === 0 ? (
        <div className="border-t border-ink/20 pt-5 text-sm text-muted">
          {isConsultant
            ? "Aún no hay llamadas registradas para esta organización."
            : "Aún no hay llamadas registradas."}
        </div>
      ) : (
        calls.map((call) => (
          <CallDetail key={call.id} call={call} isConsultant={isConsultant} onChanged={loadCalls} />
        ))
      )}
    </div>
  );
}

export default function CallsPage() {
  return (
    <PortalShell title="Llamadas">
      {(bootstrap) => <CallsContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
