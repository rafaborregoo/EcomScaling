"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  LoadingBlock,
  Table,
  type Tone,
  type TableColumnDef,
} from "@/components/ui";

type AgentRunOutput = { id: string; status: string } | null;

type AgentRun = {
  id: string;
  trigger_type: string;
  objective: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  agent_outputs: AgentRunOutput[];
};

type TraceStep = { id: string; position: number; step_type: string; summary: string | null; duration_ms: number | null };
type TraceToolCall = { id: string; tool_name: string; is_error: boolean; duration_ms: number | null; created_at: string };
type TraceContextSnapshot = { id: string; context_level: string; created_at: string };
type TraceQueryRun = {
  id: string;
  sql_text: string;
  rows_returned: number | null;
  duration_ms: number | null;
  was_rejected: boolean;
  created_at: string;
};

type RunTrace = {
  run: AgentRun & { agent_versions: { version: string; model: string; agent_definitions: { code: string } } | null };
  steps: TraceStep[];
  tool_calls: TraceToolCall[];
  context_snapshots: TraceContextSnapshot[];
  query_runs: TraceQueryRun[];
};

const statusTone: Record<string, Tone> = {
  succeeded: "neutral",
  failed: "danger",
  rejected_output: "danger",
  budget_exceeded: "warn",
  running: "warn",
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - ");
}

function AgentRunsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const canView = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [trace, setTrace] = useState<RunTrace | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [isTraceLoading, setIsTraceLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!canView) {
      return;
    }
    setIsLoading(true);
    setError(null);
    const response = await apiFetch(`/v1/organizations/${organizationId}/ai/runs`);
    if (response.ok) {
      const body = (await response.json()) as { runs: AgentRun[] };
      setRuns(body.runs);
    } else {
      setError(await readError(response));
    }
    setIsLoading(false);
  }, [organizationId, canView]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  async function openTrace(runId: string) {
    setSelectedRunId(runId);
    setTrace(null);
    setTraceError(null);
    setIsTraceLoading(true);

    const response = await apiFetch(`/v1/organizations/${organizationId}/ai/runs/${runId}/trace`);
    if (response.ok) {
      setTrace((await response.json()) as RunTrace);
    } else {
      setTraceError(await readError(response));
    }
    setIsTraceLoading(false);
  }

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="Las ejecuciones de agentes IA son un panel tecnico solo para consultor/platform admin."
      />
    );
  }

  const runColumns: TableColumnDef<AgentRun>[] = [
    { key: "objective", label: "Objetivo" },
    { key: "trigger_type", label: "Disparador" },
    { key: "status", label: "Estado", render: (row) => <Badge tone={statusTone[row.status] ?? "neutral"}>{row.status}</Badge> },
    { key: "estimated_cost_usd", label: "Coste (USD)", render: (row) => row.estimated_cost_usd.toFixed(4) },
    { key: "latency_ms", label: "Latencia (ms)", render: (row) => row.latency_ms ?? "—" },
    { key: "started_at", label: "Fecha", render: (row) => new Date(row.started_at).toLocaleString() },
    {
      key: "trace",
      label: "",
      render: (row) => (
        <Button variant="secondary" size="sm" type="button" onClick={() => openTrace(row.id)}>
          Ver traza
        </Button>
      ),
    },
  ];

  const stepColumns: TableColumnDef<TraceStep>[] = [
    { key: "position", label: "#" },
    { key: "step_type", label: "Tipo" },
    { key: "summary", label: "Resumen", render: (row) => row.summary ?? "—" },
    { key: "duration_ms", label: "Duración (ms)", render: (row) => row.duration_ms ?? "—" },
  ];

  const toolCallColumns: TableColumnDef<TraceToolCall>[] = [
    { key: "tool_name", label: "Herramienta" },
    {
      key: "is_error",
      label: "Resultado",
      render: (row) => <Badge tone={row.is_error ? "danger" : "neutral"}>{row.is_error ? "error" : "ok"}</Badge>,
    },
    { key: "duration_ms", label: "Duración (ms)", render: (row) => row.duration_ms ?? "—" },
    { key: "created_at", label: "Hora", render: (row) => new Date(row.created_at).toLocaleTimeString() },
  ];

  const contextColumns: TableColumnDef<TraceContextSnapshot>[] = [
    { key: "context_level", label: "Nivel" },
    { key: "created_at", label: "Hora", render: (row) => new Date(row.created_at).toLocaleTimeString() },
  ];

  const queryRunColumns: TableColumnDef<TraceQueryRun>[] = [
    { key: "sql_text", label: "SQL" },
    { key: "rows_returned", label: "Filas", render: (row) => row.rows_returned ?? "—" },
    {
      key: "was_rejected",
      label: "Estado",
      render: (row) => <Badge tone={row.was_rejected ? "danger" : "neutral"}>{row.was_rejected ? "rechazada" : "ok"}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <Heading size="lg">Ejecuciones de agentes IA</Heading>
      <p className="text-sm text-muted">
        Panel tecnico (AI-12, Observability &amp; tracing): reconstruye una ejecucion completa sin consultar
        varias tablas a mano.
      </p>

      {isLoading ? (
        <LoadingBlock label="Cargando ejecuciones..." />
      ) : error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : runs.length === 0 ? (
        <EmptyState title="Sin ejecuciones todavia" hint="Los agentes de esta organizacion no han corrido todavia." />
      ) : (
        <Table columns={runColumns} rows={runs} ariaLabel="Ejecuciones de agentes IA" />
      )}

      {selectedRunId ? (
        <Card kicker="Traza de ejecucion" title={selectedRunId}>
          {isTraceLoading ? (
            <LoadingBlock label="Cargando traza..." />
          ) : traceError ? (
            <ErrorBlock>{traceError}</ErrorBlock>
          ) : trace ? (
            <div className="space-y-6">
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                  {trace.run.agent_versions?.agent_definitions.code} · {trace.run.agent_versions?.model} v
                  {trace.run.agent_versions?.version}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {trace.run.input_tokens} tokens entrada · {trace.run.output_tokens} tokens salida ·{" "}
                  {trace.run.estimated_cost_usd.toFixed(4)} USD
                  {trace.run.error_message ? ` · error: ${trace.run.error_message}` : ""}
                </p>
              </div>

              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Pasos</p>
                <Table
                  className="mt-2"
                  ariaLabel="Pasos de la ejecucion"
                  columns={stepColumns}
                  rows={trace.steps}
                  emptyLabel="Sin pasos registrados."
                />
              </div>

              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Llamadas a herramientas</p>
                <Table
                  className="mt-2"
                  ariaLabel="Llamadas a herramientas"
                  columns={toolCallColumns}
                  rows={trace.tool_calls}
                  emptyLabel="Sin llamadas a herramientas (evidence-pack puro)."
                />
              </div>

              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Snapshots de contexto</p>
                <Table
                  className="mt-2"
                  ariaLabel="Snapshots de contexto"
                  columns={contextColumns}
                  rows={trace.context_snapshots}
                  emptyLabel="Sin snapshots de contexto."
                />
              </div>

              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Consultas SQL</p>
                <Table
                  className="mt-2"
                  ariaLabel="Consultas SQL del SQL Gateway"
                  columns={queryRunColumns}
                  rows={trace.query_runs}
                  emptyLabel="Sin consultas SQL en esta ejecucion."
                />
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function AgentRunsPageContent() {
  return <PortalShell title="Ejecuciones IA">{(bootstrap) => <AgentRunsContent bootstrap={bootstrap} />}</PortalShell>;
}

export default function AgentRunsPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando ejecuciones IA..." />}>
      <AgentRunsPageContent />
    </Suspense>
  );
}
