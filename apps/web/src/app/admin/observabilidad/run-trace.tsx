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
 * Consume `/v1/organizations/:organizationId/ai/runs/:runId/trace`, que ya
 * existia y ya devolvia todo esto. No hay endpoint nuevo: platform_admin tiene
 * membresia sintetica a todas las organizaciones (ver auth-context), asi que la
 * ruta por organizacion sirve tal cual desde el panel de plataforma.
 */

import { useEffect, useState } from "react";
import {
  AsyncState,
  Badge,
  Button,
  ErrorBlock,
  EYEBROW,
  Table,
  type TableColumnDef,
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
};

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

  const toolColumns: TableColumnDef<TraceToolCall>[] = [
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

  const securityColumns: TableColumnDef<TraceSecurityEvent>[] = [
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
            {run.agent_versions?.prompt_code
              ? `${run.agent_versions.prompt_code}@${run.agent_versions.prompt_version ?? "?"}`
              : "—"}
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
          <Table
            className="mt-2"
            ariaLabel="Eventos de seguridad de la ejecución"
            columns={securityColumns}
            rows={securityEvents}
            emptyLabel="Sin eventos."
          />
        </div>
      ) : null}

      <div>
        <p className={EYEBROW}>Cronología</p>
        <StepWaterfall steps={data.steps} />
        {data.steps.length === 0 ? (
          <p className="text-muted mt-1 text-sm">Sin fases registradas.</p>
        ) : null}
      </div>

      {data.tool_calls.length > 0 ? (
        <div>
          <p className={EYEBROW}>Herramientas ejecutadas</p>
          <Table
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
