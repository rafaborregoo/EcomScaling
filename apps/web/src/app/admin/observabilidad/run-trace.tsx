"use client";

/**
 * AI-30 (fase 9): reconstruccion de una ejecucion de IA.
 *
 * El objetivo declarado del encargo es localizar un incidente en menos de 60
 * segundos. Eso manda en el orden de la pantalla: primero lo que responde "que
 * paso y por que termino asi" (proveedor y modelo REALES, motivo de
 * terminacion, coste con su base), despues los controles de seguridad -- que
 * son lo que uno mira cuando algo huele raro -- y solo al final la cronologia
 * y el detalle de herramientas.
 *
 * Consume la traza de ejecucion y registra feedback por criterio en una ruta
 * separada. Los resultados del juez se leen por el API con scope de
 * organizacion; el navegador nunca accede directamente a sus tablas.
 */

import { useEffect, useState } from "react";
import { Select,
  EmptyState,
  AsyncState,
  Badge,
  Button,
  ErrorBlock,
  EYEBROW,
  DataTable,
  type DataTableColumn,
  Card,
  CardContent,
} from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  formatCostWithBasis,
  formatDuration,
  formatReportedTokens,
  SECURITY_EVENT_ES,
  severityTone,
  STEP_ES,
  waterfallWidths,
} from "./run-trace-format";

type TraceStep = {
  id: string;
  position: number;
  step_type: string;
  summary: string | null;
  duration_ms: number | null;
  created_at: string;
};

type TraceToolCall = {
  id: string;
  tool_name: string;
  is_error: boolean;
  duration_ms: number | null;
  created_at: string;
};

type TraceSecurityEvent = {
  id: string;
  event_type: string;
  severity: string;
  source: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

type TraceQueryRun = {
  id: string;
  tables_used: unknown;
  rows_returned: number | null;
  duration_ms: number | null;
  was_rejected: boolean;
  rejection_reason: string | null;
};

type TraceRun = {
  id: string;
  trace_id: string | null;
  parent_run_id: string | null;
  parallel_group_id: string | null;
  deployment_version: string | null;
  status: string;
  stop_reason: string | null;
  provider: string | null;
  model: string | null;
  model_calls: number | null;
  tool_call_count: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number | null;
  cache_creation_tokens: number | null;
  reasoning_tokens: number | null;
  estimated_cost_usd: number | null;
  cost_basis: string | null;
  pricing_version: string | null;
  budget_max_cost_usd: number | null;
  budget_max_tool_calls: number | null;
  latency_ms: number | null;
  // AI-30 fase 3. null en ejecuciones anteriores a la fase.
  prompt_code?: string | null;
  prompt_version?: string | null;
  system_prompt_hash?: string | null;
  declared_tools?: string[] | null;
  context_truncated?: boolean | null;
  agent_versions?: {
    version: string;
    model: string;
    prompt_code?: string;
    prompt_version?: string;
  } | null;
};

type TracePayload = {
  run: TraceRun;
  steps: TraceStep[];
  tool_calls: TraceToolCall[];
  query_runs: TraceQueryRun[];
  security_events?: TraceSecurityEvent[];
  judgments?: Array<{
    id: string;
    agent_code: string;
    artifact_kind: string;
    rubric_version: string;
    status: string;
    overall_score: number | null;
    result: {
      summary?: string;
      evaluated_criteria?: number;
      criteria?: Array<{
        criterion_id: string;
        score: number | null;
        status: string;
        rationale: string;
      }>;
    } | null;
    error_code: string | null;
    model: string | null;
    estimated_cost_usd: number | null;
    latency_ms: number | null;
    created_at: string;
  }>;
  judge_jobs?: Array<{
    id: string;
    agent_code: string;
    status: string;
    attempts: number;
    max_attempts: number;
    last_error: string | null;
    available_at: string;
    created_at: string;
    updated_at: string;
  }>;
  judge_feedback?: Array<{
    id: string;
    judgment_id: string;
    criterion_id: string;
    decision: "agree" | "incorrect" | "not_applicable" | "corrected";
    reason_code: string | null;
    note: string | null;
    corrected_status: "evaluable" | "no_evaluable" | null;
    corrected_score: number | null;
    request_id: string;
    created_at: string;
  }>;
};
type JudgeFeedbackRecord = NonNullable<TracePayload["judge_feedback"]>[number];

function JudgeFeedbackEditor({
  organizationId,
  runId,
  judgmentId,
  criterionId,
  existing,
}: {
  organizationId: string;
  runId: string;
  judgmentId: string;
  criterionId: string;
  existing?: JudgeFeedbackRecord;
}) {
  const [decision, setDecision] = useState<"agree" | "incorrect" | "not_applicable" | "corrected">(existing?.decision ?? "agree");
  const [reason, setReason] = useState(existing?.reason_code ?? "accuracy");
  const [correctedStatus, setCorrectedStatus] = useState<"evaluable" | "no_evaluable">(existing?.corrected_status ?? "evaluable");
  const [correctedScore, setCorrectedScore] = useState(String(existing?.corrected_score ?? 3));
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(existing));
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/runs/${runId}/judgments/${judgmentId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            criterion_id: criterionId,
            decision,
            reason_code: decision === "agree" ? null : reason,
            note: note.trim() || null,
            corrected_status: decision === "corrected" ? correctedStatus : null,
            corrected_score: decision === "corrected" && correctedStatus === "evaluable" ? Number(correctedScore) : null,
            request_id: crypto.randomUUID(),
          }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la revisión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/30 p-3">
      <p className="text-xs font-medium">Tu revisión</p>
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Valoración del criterio" size="sm" className="w-auto" value={decision} onChange={(value) => { setDecision(value as typeof decision); setSaved(false); }} options={[{ value: "agree", label: "De acuerdo" }, { value: "incorrect", label: "Incorrecto" }, { value: "not_applicable", label: "No aplica" }, { value: "corrected", label: "Corregido" }]} />
        {decision === "corrected" ? (
          <>
            <Select aria-label="Estado corregido" size="sm" className="w-auto" value={correctedStatus} onChange={(value) => { setCorrectedStatus(value as typeof correctedStatus); setSaved(false); }} options={[{ value: "evaluable", label: "Se puede evaluar" }, { value: "no_evaluable", label: "Sin evidencia suficiente" }]} />
            {correctedStatus === "evaluable" ? (
              <Select aria-label="Puntuación corregida" size="sm" className="w-auto" value={correctedScore} onChange={(value) => { setCorrectedScore(value); setSaved(false); }} options={[0, 1, 2, 3, 4].map((score) => ({ value: String(score), label: `${score}/4` }))} />
            ) : null}
          </>
        ) : null}
        {decision !== "agree" ? (
          <Select aria-label="Motivo de la revisión" size="sm" className="w-auto" value={reason} onChange={(value) => { setReason(value); setSaved(false); }} options={[{ value: "accuracy", label: "Dato o conclusión incorrecta" }, { value: "missing_evidence", label: "Falta evidencia" }, { value: "wrong_scope", label: "Scope incorrecto" }, { value: "not_actionable", label: "No es accionable" }, { value: "duplicate", label: "Hallazgo duplicado" }, { value: "other", label: "Otro motivo" }]} />
        ) : null}
      </div>
      <textarea aria-label="Nota de revisión" className="w-full rounded border bg-background px-2 py-1 text-sm" maxLength={1200} rows={2} value={note} onChange={(event) => { setNote(event.target.value); setSaved(false); }} placeholder="Nota breve para explicar tu revisión" />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={saving || (decision !== "agree" && reason === "other" && !note.trim())} onClick={() => void submit()}>
          {saving ? "Guardando…" : saved ? "Actualizar revisión" : "Guardar revisión"}
        </Button>
        {saved ? <span className="text-muted text-xs">Guardada</span> : null}
        {error ? <span role="alert" className="text-danger text-xs">{error}</span> : null}
      </div>
    </div>
  );
}

function CopyableId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <code className="text-xs">{value}</code>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Copiar ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Cascada de fases. No usa una libreria de graficos: son barras proporcionales
 * a la duracion, que es todo lo que hace falta para ver donde se fue el tiempo.
 */
function StepWaterfall({ steps }: { steps: TraceStep[] }) {
  const total = steps.reduce((sum, step) => sum + (step.duration_ms ?? 0), 0);
  const widths = waterfallWidths(steps);
  if (steps.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {steps.map((step, index) => {
        const pct = widths[index] ?? 0;
        return (
          <div key={step.id}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span>
                {step.position}. {STEP_ES[step.step_type] ?? step.step_type}
              </span>
              <span className="text-muted text-xs">
                {formatDuration(step.duration_ms)}
              </span>
            </div>
            {step.summary ? (
              <p className="text-muted text-xs">{step.summary}</p>
            ) : null}
            <div
              className="mt-1 h-1.5 rounded-full bg-primary"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
        );
      })}
      <p className="text-muted text-xs">
        Total de fases medidas: {formatDuration(total)}
      </p>
    </div>
  );
}

export function RunTraceDetail({
  organizationId,
  runId,
}: {
  organizationId: string;
  runId: string;
}) {
  const [data, setData] = useState<TracePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setData(null);
    setError(null);
    void (async () => {
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/ai/runs/${runId}/trace`,
        );
        if (!alive) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        setData((await response.json()) as TracePayload);
      } catch {
        if (alive) setError("No se pudo cargar la traza de la ejecución.");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [organizationId, runId]);

  const judgePending = Boolean(data?.judge_jobs?.some(
    (job) => job.status === "queued" || job.status === "running",
  ));
  useEffect(() => {
    if (!judgePending) return;
    let alive = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/ai/runs/${runId}/trace`,
        );
        if (alive && response.ok) setData((await response.json()) as TracePayload);
      } catch {
        // Keep the last known queue state visible; the next interval retries.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [organizationId, runId, judgePending]);

  if (isLoading) {
    return (
      <AsyncState
        status="loading"
        loadingLabel="Cargando traza de ejecución..."
      />
    );
  }
  if (error || !data) {
    return <ErrorBlock>{error ?? "Sin traza."}</ErrorBlock>;
  }

  const { run } = data;
  const securityEvents = data.security_events ?? [];
  const judgments = data.judgments ?? [];
  const judgeJobs = data.judge_jobs ?? [];
  const judgeFeedback = data.judge_feedback ?? [];

  const toolColumns: DataTableColumn<TraceToolCall>[] = [
    { key: "tool_name", label: "Herramienta" },
    {
      key: "is_error",
      label: "Resultado",
      render: (row) =>
        row.is_error ? (
          <Badge tone="danger">Error</Badge>
        ) : (
          <Badge tone="success">OK</Badge>
        ),
    },
    {
      key: "duration_ms",
      label: "Duración",
      render: (row) => formatDuration(row.duration_ms),
    },
  ];

  const securityColumns: DataTableColumn<TraceSecurityEvent>[] = [
    {
      key: "severity",
      label: "Severidad",
      render: (row) => (
        <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>
      ),
    },
    {
      key: "event_type",
      label: "Evento",
      render: (row) => SECURITY_EVENT_ES[row.event_type] ?? row.event_type,
    },
    { key: "source", label: "Origen" },
    {
      key: "detail",
      label: "Detalle",
      render: (row) => (
        <span className="text-xs">
          {row.detail ? JSON.stringify(row.detail) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className={EYEBROW}>Ejecución</p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Fact label="Proveedor">
            {run.provider ?? (
              <span className="text-muted">
                Sin registrar
              </span>
            )}
          </Fact>
          <Fact label="Modelo ejecutado">
            {run.model ?? <span className="text-muted">Sin registrar</span>}
          </Fact>
          {/* Se muestra el configurado solo cuando difiere del ejecutado: esa
              diferencia es exactamente la señal de que actuó el fallback. */}
          {run.agent_versions?.model &&
          run.model &&
          run.agent_versions.model !== run.model ? (
            <Fact label="Modelo configurado">
              <span className="text-warn">
                {run.agent_versions.model} · actuó el fallback
              </span>
            </Fact>
          ) : null}
          <Fact label="Motivo de terminación">{run.stop_reason ?? "—"}</Fact>
          <Fact label="Coste">
            {formatCostWithBasis(run.estimated_cost_usd, run.cost_basis)}
            {run.cost_basis === "unknown_model" ? (
              <Badge tone="warn" className="ml-2">
                modelo sin tarifa
              </Badge>
            ) : null}
          </Fact>
          <Fact label="Presupuesto aplicado">
            {run.budget_max_cost_usd == null
              ? "Sin tope de coste"
              : `$${Number(run.budget_max_cost_usd).toFixed(2)}`}
            {run.budget_max_tool_calls == null
              ? ""
              : ` · ${run.budget_max_tool_calls} tool calls`}
          </Fact>
          <Fact label="Llamadas / herramientas">
            {run.model_calls ?? "—"} / {run.tool_call_count ?? "—"}
          </Fact>
          <Fact label="Tokens (in / out)">
            {run.input_tokens.toLocaleString("es-ES")} /{" "}
            {run.output_tokens.toLocaleString("es-ES")}
          </Fact>
          <Fact label="Caché leída">
            {formatReportedTokens(run.cache_read_tokens)}
          </Fact>
          <Fact label="Caché escrita">
            {formatReportedTokens(run.cache_creation_tokens)}
          </Fact>
          <Fact label="Tokens de razonamiento">
            {formatReportedTokens(run.reasoning_tokens)}
          </Fact>
          <Fact label="Prompt">
            {/* El del run es la copia del momento de ejecución; el de
                agent_versions solo sirve para runs anteriores a la fase 3. */}
            {(run.prompt_code ?? run.agent_versions?.prompt_code)
              ? `${run.prompt_code ?? run.agent_versions?.prompt_code}@${run.prompt_version ?? run.agent_versions?.prompt_version ?? "?"}`
              : "—"}
            {run.system_prompt_hash ? (
              <code className="text-muted ml-2 text-xs">
                #{run.system_prompt_hash.slice(0, 12)}
              </code>
            ) : null}
          </Fact>
          <Fact label="Contexto">
            {run.context_truncated == null ? (
              <span className="text-muted">Sin registrar</span>
            ) : run.context_truncated ? (
              <Badge tone="warn">Recortado por tamaño</Badge>
            ) : (
              "Completo"
            )}
          </Fact>
          <Fact label="Herramientas declaradas / usadas">
            {run.declared_tools == null
              ? "—"
              : `${run.declared_tools.length} / ${new Set(data.tool_calls.map((call) => call.tool_name)).size}`}
          </Fact>
          <Fact label="Versión desplegada">
            {run.deployment_version ?? (
              <span className="text-muted">Sin registrar</span>
            )}
          </Fact>
        </dl>
      </div>

      <div className="space-y-2">
        <p className={EYEBROW}>Correlación</p>
        <CopyableId label="run id" value={run.id} />
        {run.trace_id && run.trace_id !== run.id ? (
          <CopyableId label="trace id" value={run.trace_id} />
        ) : null}
        {run.parallel_group_id ? (
          <div>
            <p className="text-muted text-xs">
              Pertenece a una pasada del orquestador
            </p>
            <CopyableId label="grupo" value={run.parallel_group_id} />
          </div>
        ) : null}
        {run.parent_run_id ? (
          <div>
            <p className="text-muted text-xs">Lanzado por otro agente</p>
            <CopyableId label="run padre" value={run.parent_run_id} />
          </div>
        ) : null}
      </div>

      {/* La seguridad va antes que la cronología: es lo que se mira cuando
          algo huele raro, y esconderla al final la haría inútil. */}
      {securityEvents.length > 0 ? (
        <div>
          <p className={EYEBROW}>Controles de seguridad</p>
          <DataTable
            className="mt-2"
            ariaLabel="Eventos de seguridad de la ejecución"
            columns={securityColumns}
            rows={securityEvents}
            emptyLabel="Sin eventos."
          />
        </div>
      ) : null}

      <Card role="region" aria-label="Evaluación de calidad del agente"><CardContent>
        <p className={EYEBROW}>Evaluación del juez</p>
        {judgeJobs.filter((job) => job.status !== "completed").map((job) => (
          <div key={job.id} className="mt-2 rounded-md bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={job.status === "failed" ? "danger" : job.status === "running" ? "warn" : "neutral"}>
                {job.status === "queued" ? "En cola" : job.status === "running" ? "En revisión" : job.status === "failed" ? "Falló" : job.status}
              </Badge>
              <span className="text-muted text-xs">Intento {job.attempts}/{job.max_attempts}</span>
              <span className="text-muted text-xs">{job.agent_code}</span>
            </div>
            {job.last_error ? <p className="mt-1 text-muted">{job.last_error}</p> : null}
            {job.status === "queued" ? <p className="mt-1 text-muted">Próximo intento {new Date(job.available_at).toLocaleString()}</p> : null}
          </div>
        ))}
        {judgments.length === 0 && judgeJobs.length === 0 ? (
          <p className="text-muted mt-2 text-sm">Esta ejecución todavía no tiene evaluación.</p>
        ) : judgments.length > 0 ? (
          <div className="mt-3 space-y-4">
            {judgments.map((judgment) => (
              <article key={judgment.id} className="space-y-2 border-t pt-3 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={judgment.status === "passed" ? "success" : judgment.status === "error" ? "danger" : "warn"}>
                    {judgment.status === "passed" ? "Correcto" : judgment.status === "review" ? "Revisión" : judgment.status === "no_evaluable" ? "Sin evidencia suficiente" : judgment.status === "blocked" ? "Bloqueado" : "Error"}
                  </Badge>
                  {judgment.overall_score != null ? <span className="text-sm font-medium">{judgment.overall_score.toFixed(1)} / 4</span> : null}
                  <span className="text-muted text-xs">{judgment.rubric_version} · {judgment.model ?? "modelo sin registrar"}</span>
                </div>
                <p className="text-sm">{judgment.result?.summary ?? judgment.error_code ?? "La evaluación no produjo un dictamen."}</p>
                {judgment.result?.criteria?.length ? (
                  <div className="space-y-3">
                    {judgment.result.criteria.map((criterion) => {
                      const existing = judgeFeedback.filter((feedback) => feedback.judgment_id === judgment.id && feedback.criterion_id === criterion.criterion_id).at(-1);
                      return (
                        <div key={criterion.criterion_id} className="border-t pt-3 first:border-0 first:pt-0">
                          <p className="flex flex-wrap gap-x-2 text-sm">
                            <span className="font-medium">{criterion.criterion_id}</span>
                            <span className="text-muted">{criterion.score == null ? "Sin evaluar" : `${criterion.score}/4`} · {criterion.rationale}</span>
                          </p>
                          <JudgeFeedbackEditor organizationId={organizationId} runId={runId} judgmentId={judgment.id} criterionId={criterion.criterion_id} existing={existing} />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <p className="text-muted text-xs">Coste {judgment.estimated_cost_usd == null ? "sin dato" : `$${judgment.estimated_cost_usd.toFixed(5)}`} · {judgment.latency_ms == null ? "duración sin dato" : `${judgment.latency_ms} ms`}</p>
              </article>
            ))}
          </div>
        ) : null}
      </CardContent></Card>

      <div>
        <p className={EYEBROW}>Cronología</p>
        <StepWaterfall steps={data.steps} />
        {data.steps.length === 0 ? (
          <EmptyState size="sm" title="Sin fases registradas" />
        ) : null}
      </div>

      {data.tool_calls.length > 0 ? (
        <div>
          <p className={EYEBROW}>Herramientas ejecutadas</p>
          <DataTable
            className="mt-2"
            ariaLabel="Herramientas ejecutadas"
            columns={toolColumns}
            rows={data.tool_calls}
            emptyLabel="Sin herramientas."
          />
          <p className="text-muted mt-1 text-xs">
            Los argumentos y resultados se guardan redactados y recortados; no
            se muestran aquí.
          </p>
        </div>
      ) : null}

      {data.query_runs.length > 0 ? (
        <div>
          <p className={EYEBROW}>Consultas SQL</p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.query_runs.map((query) => (
              <li key={query.id} className="flex items-center gap-2">
                {query.was_rejected ? (
                  <Badge tone="danger">Rechazada</Badge>
                ) : (
                  <Badge tone="success">{query.rows_returned ?? 0} filas</Badge>
                )}
                <span className="text-muted text-xs">
                  {formatDuration(query.duration_ms)}
                  {query.rejection_reason ? ` · ${query.rejection_reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
