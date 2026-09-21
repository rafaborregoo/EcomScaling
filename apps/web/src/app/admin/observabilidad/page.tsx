"use client";

import { useMemo, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { RunTraceDetail } from "./run-trace";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Badge,
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  Metric,
  Select,
  Table,
  type TableColumnDef,
  type Tone,
} from "@/components/ui";

type AgentUsage = { name: string; runs: number };

type AgentStat = {
  agent_code: string;
  agent_name: string;
  run_count: number;
  failed_count: number;
  running_count: number;
  total_cost_usd: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
};

type ClientStat = {
  organization_id: string;
  name: string;
  run_count: number;
  total_cost_usd: number;
  top_agents: AgentUsage[];
};

type ConsultantStat = {
  consultant_user_id: string;
  name: string;
  client_count: number;
  run_count: number;
  total_cost_usd: number;
  top_agents: AgentUsage[];
};

type ObservabilityRun = {
  id: string;
  agent_code: string;
  agent_name: string;
  status: string;
  execution_mode: string | null;
  trigger_type: string;
  objective: string;
  /** AI-30: null = modelo sin tarifa conocida. No es gratis. */
  cost_usd: number | null;
  cost_basis: string | null;
  provider: string | null;
  model: string | null;
  trace_id: string | null;
  latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  error_message: string | null;
  started_at: string;
  organization_id: string;
  organization_name: string;
  store_id: string | null;
  store_name: string | null;
  actor_name: string | null;
  consultant_id: string | null;
  consultant_name: string | null;
};

type ObservabilityPayload = {
  window_days: number;
  summary: {
    run_count: number;
    failed_count: number;
    running_count: number;
    total_cost_usd: number;
    avg_latency_ms: number | null;
  };
  by_agent: AgentStat[];
  by_client: ClientStat[];
  by_consultant: ConsultantStat[];
  runs: ObservabilityRun[];
  organizations: { id: string; display_name: string }[];
};

type GroupBy = "agent" | "client" | "consultant";

type OrchestratorDecision = {
  id: string;
  organization_id: string;
  organization_name: string;
  agent_code: string;
  decision: "ran" | "skipped";
  reason: string;
  tick_id: string;
  created_at: string;
};

type OrchestratorPayload = {
  platform_budget: {
    spent_today_usd: number;
    cap_usd: number;
    remaining_usd: number;
  } | null;
  today: { manual: number; cron: number; other: number; total: number };
  last_tick: {
    tick_id: string;
    at: string | null;
    by_reason: Record<string, number>;
  } | null;
  recent_decisions: OrchestratorDecision[];
  by_org_today: {
    organization_id: string;
    organization_name: string;
    runs_today: number;
    cost_today_usd: number;
  }[];
  gate_log_available: boolean;
};

const ORCH_REASON_ES: Record<string, string> = {
  ran: "Ejecutado",
  no_activity: "Sin actividad nueva",
  cooldown: "Run muy reciente",
  pending_unreviewed: "Propuesta anterior sin revisar",
  org_run_cap: "Tope de runs de la org",
  org_budget: "Presupuesto de la org agotado",
  platform_budget: "Presupuesto de plataforma agotado",
  tick_cap: "Fuera del cupo de la pasada",
  error: "Error al ejecutar",
};

const ORCH_AGENT_ES: Record<string, string> = {
  a02_monitor_negocio: "Monitor de negocio",
  a04_generador_tareas: "Plan de tareas",
  a06_planificador_stock: "Stock",
};

function reasonSummary(byReason: Record<string, number>) {
  const entries = Object.entries(byReason);
  if (entries.length === 0) return "—";
  return entries
    .map(([reason, count]) => `${ORCH_REASON_ES[reason] ?? reason}: ${count}`)
    .join(" · ");
}

function OrchestratorPanel() {
  const { data, error, isLoading } = useCachedQuery<OrchestratorPayload>(
    "/v1/admin/ai-orchestrator",
  );

  if (isLoading) {
    return (
      <Card kicker="Control de coste" title="Orquestador de diagnósticos IA">
        <AsyncState
          status="loading"
          loadingLabel="Cargando estado del orquestador..."
        />
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card kicker="Control de coste" title="Orquestador de diagnósticos IA">
        <ErrorBlock>{error ?? "Sin datos."}</ErrorBlock>
      </Card>
    );
  }

  const budget = data.platform_budget;
  const spentPct =
    budget && budget.cap_usd > 0
      ? Math.round((budget.spent_today_usd / budget.cap_usd) * 100)
      : 0;

  const decisionRows = data.recent_decisions.map((row) => ({ ...row }));
  const decisionColumns: TableColumnDef<OrchestratorDecision>[] = [
    {
      key: "created_at",
      label: "Fecha",
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "organization_name",
      label: "Cliente",
      render: (row) => row.organization_name,
    },
    {
      key: "agent_code",
      label: "Agente",
      render: (row) => ORCH_AGENT_ES[row.agent_code] ?? row.agent_code,
    },
    {
      key: "decision",
      label: "Decisión",
      render: (row) => (
        <Badge tone={row.decision === "ran" ? "success" : "neutral"}>
          {row.decision === "ran" ? "Ejecutado" : "Omitido"}
        </Badge>
      ),
    },
    {
      key: "reason",
      label: "Motivo",
      render: (row) => (
        <span className="text-xs text-muted">
          {ORCH_REASON_ES[row.reason] ?? row.reason}
        </span>
      ),
    },
  ];

  const orgRows = data.by_org_today
    .slice(0, 10)
    .map((row) => ({ ...row, id: row.organization_id }));
  const orgColumns: TableColumnDef<(typeof orgRows)[number]>[] = [
    {
      key: "organization_name",
      label: "Cliente",
      render: (row) => row.organization_name,
    },
    {
      key: "runs_today",
      label: "Ejecuciones hoy",
      render: (row) => String(row.runs_today),
    },
    {
      key: "cost_today_usd",
      label: "Coste hoy",
      render: (row) => formatCost(row.cost_today_usd),
    },
  ];

  return (
    <Card
      kicker="Control de coste"
      title="Orquestador de diagnósticos IA"
      description="Decide 2 veces al día si merece la pena regenerar cada diagnóstico y ejecuta dentro de los topes de gasto."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          card
          label="Gasto IA hoy · plataforma"
          tone={spentPct >= 80 ? "danger" : "default"}
          value={
            budget
              ? `${formatCost(budget.spent_today_usd)} / ${formatCost(budget.cap_usd)}`
              : "—"
          }
          hint={
            budget ? `${spentPct}% del tope diario` : "sin datos de presupuesto"
          }
        />
        <Metric
          card
          label="Ejecuciones hoy"
          value={String(data.today.total)}
          hint={`manual ${data.today.manual} · automático ${data.today.cron}`}
        />
        <Metric
          card
          label="Última pasada"
          value={
            data.last_tick
              ? reasonSummary(data.last_tick.by_reason)
              : "sin pasadas"
          }
          hint={
            data.last_tick?.at ? formatDateTime(data.last_tick.at) : undefined
          }
        />
      </div>

      {!data.gate_log_available ? (
        <p className="mt-3 text-xs text-muted">
          El registro de decisiones (ai_diagnostic_gate_log) aún no está
          desplegado; se muestran gasto y ejecuciones.
        </p>
      ) : (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">
            Últimas decisiones del orquestador
          </h3>
          <Table
            className="mt-2"
            ariaLabel="Decisiones del orquestador"
            columns={decisionColumns}
            rows={decisionRows}
            emptyLabel="El orquestador todavía no ha registrado decisiones."
          />
        </div>
      )}

      {orgRows.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">
            Ejecuciones de hoy por cliente
          </h3>
          <Table
            className="mt-2"
            ariaLabel="Ejecuciones de hoy por cliente"
            columns={orgColumns}
            rows={orgRows}
            emptyLabel="Sin ejecuciones hoy."
          />
        </div>
      ) : null}
    </Card>
  );
}

// AI-30: el encargo pide diferenciar ERROR / SECURITY BLOCK / TIMEOUT /
// BUDGET. Un timeout y un fallo real no se arreglan igual, y antes los dos se
// pintaban "Fallo".
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  succeeded: { label: "OK", tone: "success" },
  failed: { label: "Fallo", tone: "danger" },
  rejected_output: { label: "Salida rechazada", tone: "danger" },
  running: { label: "En curso", tone: "warn" },
  budget_exceeded: { label: "Presupuesto", tone: "warn" },
  timeout: { label: "Timeout", tone: "warn" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: "neutral" as Tone };
}

// AI-30: null no es cero. Un modelo sin tarifa conocida produce un coste que
// no sabemos calcular; pintarlo "$0.00" es la misma mentira que la fase 1 quito
// de la base de datos.
function formatCost(usd: number | null) {
  if (usd == null) return "n/d";
  return `${usd.toFixed(usd > 0 && usd < 1 ? 4 : 2)}`;
}

function formatLatency(ms: number | null) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function topAgentsLabel(agents: AgentUsage[]) {
  if (agents.length === 0) return "—";
  return agents.map((agent) => `${agent.name} (${agent.runs})`).join(", ");
}

function ObservabilidadPanel() {
  const { data, error, isLoading } = useCachedQuery<ObservabilityPayload>(
    "/v1/admin/observability",
  );
  const [groupBy, setGroupBy] = useState<GroupBy>("agent");
  const [orgFilter, setOrgFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [consultantFilter, setConsultantFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const filteredRuns = useMemo(() => {
    if (!data) return [];
    return data.runs.filter(
      (run) =>
        (!orgFilter || run.organization_id === orgFilter) &&
        (!agentFilter || run.agent_code === agentFilter) &&
        (!consultantFilter || run.consultant_id === consultantFilter) &&
        (!storeFilter || run.store_id === storeFilter) &&
        (!statusFilter || run.status === statusFilter),
    );
  }, [
    data,
    orgFilter,
    agentFilter,
    consultantFilter,
    storeFilter,
    statusFilter,
  ]);

  // Tienda y consultor para los filtros salen de las propias ejecuciones de la
  // ventana (los que no han ejecutado nada no aportan al filtro).
  const storeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const run of data?.runs ?? []) {
      if (run.store_id) seen.set(run.store_id, run.store_name ?? run.store_id);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const consultantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const run of data?.runs ?? []) {
      if (run.consultant_id) {
        seen.set(run.consultant_id, run.consultant_name ?? run.consultant_id);
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  if (isLoading && !data) {
    return (
      <AsyncState status="loading" loadingLabel="Cargando observabilidad..." />
    );
  }
  if (error && !data) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!data) {
    return null;
  }

  const { summary } = data;
  const failRate =
    summary.run_count > 0
      ? Math.round((summary.failed_count / summary.run_count) * 100)
      : 0;

  const agentRows = data.by_agent.map((row) => ({
    ...row,
    id: row.agent_code,
  }));
  const clientRows = data.by_client.map((row) => ({
    ...row,
    id: row.organization_id,
  }));
  const consultantRows = data.by_consultant.map((row) => ({
    ...row,
    id: row.consultant_user_id,
  }));

  const agentColumns: TableColumnDef<(typeof agentRows)[number]>[] = [
    { key: "agent_name", label: "Agente", render: (row) => row.agent_name },
    {
      key: "run_count",
      label: "Ejecuciones",
      render: (row) => String(row.run_count),
    },
    {
      key: "failed_count",
      label: "Fallos",
      render: (row) => (
        <span className={row.failed_count > 0 ? "text-danger" : undefined}>
          {row.failed_count}
        </span>
      ),
    },
    {
      key: "running_count",
      label: "En curso",
      render: (row) =>
        row.running_count > 0 ? String(row.running_count) : "—",
    },
    {
      key: "cost",
      label: "Coste IA",
      render: (row) => formatCost(row.total_cost_usd),
    },
    {
      key: "latency",
      label: "Latencia media",
      render: (row) => formatLatency(row.avg_latency_ms),
    },
    {
      key: "p95",
      label: "Latencia p95",
      render: (row) => formatLatency(row.p95_latency_ms),
    },
  ];

  const clientColumns: TableColumnDef<(typeof clientRows)[number]>[] = [
    { key: "name", label: "Cliente", render: (row) => row.name },
    {
      key: "run_count",
      label: "Ejecuciones",
      render: (row) => String(row.run_count),
    },
    {
      key: "cost",
      label: "Coste IA",
      render: (row) => formatCost(row.total_cost_usd),
    },
    {
      key: "top_agents",
      label: "Agentes más usados",
      render: (row) => (
        <span className="text-xs text-muted">
          {topAgentsLabel(row.top_agents)}
        </span>
      ),
    },
  ];

  const consultantColumns: TableColumnDef<(typeof consultantRows)[number]>[] = [
    { key: "name", label: "Consultor", render: (row) => row.name },
    {
      key: "client_count",
      label: "Clientes",
      render: (row) => String(row.client_count),
    },
    {
      key: "run_count",
      label: "Ejecuciones",
      render: (row) => String(row.run_count),
    },
    {
      key: "cost",
      label: "Coste IA",
      render: (row) => formatCost(row.total_cost_usd),
    },
    {
      key: "top_agents",
      label: "Agentes más usados",
      render: (row) => (
        <span className="text-xs text-muted">
          {topAgentsLabel(row.top_agents)}
        </span>
      ),
    },
  ];

  const groupTable =
    groupBy === "agent" ? (
      <Table
        ariaLabel="Uso por agente"
        columns={agentColumns}
        rows={agentRows}
        emptyLabel="Sin ejecuciones registradas en la ventana."
      />
    ) : groupBy === "client" ? (
      <Table
        ariaLabel="Uso por cliente"
        columns={clientColumns}
        rows={clientRows}
        emptyLabel="Sin ejecuciones registradas en la ventana."
      />
    ) : (
      <Table
        ariaLabel="Uso por consultor"
        columns={consultantColumns}
        rows={consultantRows}
        emptyLabel="Sin ejecuciones registradas en la ventana."
      />
    );

  const runColumns: TableColumnDef<ObservabilityRun>[] = [
    { key: "agent_name", label: "Agente", render: (row) => row.agent_name },
    {
      key: "started_at",
      label: "Fecha",
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted">
          {formatDateTime(row.started_at)}
        </span>
      ),
    },
    {
      key: "organization_name",
      label: "Cliente",
      render: (row) => row.organization_name,
    },
    {
      key: "store_name",
      label: "Tienda",
      render: (row) => row.store_name ?? "—",
    },
    {
      key: "consultant_name",
      label: "Consultor",
      render: (row) => row.consultant_name ?? "—",
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => {
        const meta = statusMeta(row.status);
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "latency_ms",
      label: "Latencia",
      render: (row) => formatLatency(row.latency_ms),
    },
    {
      key: "cost_usd",
      label: "Coste",
      render: (row) =>
        row.cost_usd == null ? (
          <Badge tone="warn">n/d</Badge>
        ) : (
          formatCost(row.cost_usd)
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setExpandedRunId((current) =>
                current === row.id ? null : row.id,
              )
            }
          >
            {expandedRunId === row.id ? "Cerrar" : "Detalle"}
          </Button>
        </div>
      ),
    },
  ];

  const expandedRun = filteredRuns.find((run) => run.id === expandedRunId);

  return (
    <div className="space-y-5 sm:space-y-6">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <OrchestratorPanel />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          card
          label={`Ejecuciones · ${data.window_days} días`}
          value={summary.run_count.toLocaleString("es-ES")}
        />
        <Metric
          card
          label="Fallos"
          tone={summary.failed_count > 0 ? "danger" : "default"}
          value={`${summary.failed_count} · ${failRate}%`}
          hint={
            summary.running_count > 0
              ? `${summary.running_count} en curso`
              : undefined
          }
        />
        <Metric
          card
          label="Coste IA"
          value={formatCost(summary.total_cost_usd)}
        />
        <Metric
          card
          label="Latencia media"
          value={formatLatency(summary.avg_latency_ms)}
        />
      </div>

      <Card
        kicker="Panel platform admin"
        title="Resumen de uso"
        description={`Agrupa el uso de IA de los últimos ${data.window_days} días.`}
        actions={
          <Select
            className="w-48"
            aria-label="Agrupar resumen por"
            value={groupBy}
            onChange={(value) => setGroupBy(value as GroupBy)}
            options={[
              { value: "agent", label: "Por agente" },
              { value: "client", label: "Por cliente" },
              { value: "consultant", label: "Por consultor" },
            ]}
          />
        }
      >
        {groupTable}
      </Card>

      <Card
        kicker="Trazas"
        title="Ejecuciones recientes"
        description="Últimas 120 ejecuciones con cliente, tienda y consultor. Filtra para acotar."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className={EYEBROW}>Cliente</p>
            <Select
              className="mt-1 w-full"
              aria-label="Filtrar por cliente"
              placeholder="Todos"
              value={orgFilter}
              onChange={setOrgFilter}
              options={[
                { value: "", label: "Todos los clientes" },
                ...data.organizations.map((org) => ({
                  value: org.id,
                  label: org.display_name,
                })),
              ]}
            />
          </div>
          <div>
            <p className={EYEBROW}>Consultor</p>
            <Select
              className="mt-1 w-full"
              aria-label="Filtrar por consultor"
              placeholder="Todos"
              value={consultantFilter}
              onChange={setConsultantFilter}
              options={[
                { value: "", label: "Todos los consultores" },
                ...consultantOptions.map(([id, name]) => ({
                  value: id,
                  label: name,
                })),
              ]}
            />
          </div>
          <div>
            <p className={EYEBROW}>Tienda</p>
            <Select
              className="mt-1 w-full"
              aria-label="Filtrar por tienda"
              placeholder="Todas"
              value={storeFilter}
              onChange={setStoreFilter}
              options={[
                { value: "", label: "Todas las tiendas" },
                ...storeOptions.map(([id, name]) => ({
                  value: id,
                  label: name,
                })),
              ]}
            />
          </div>
          <div>
            <p className={EYEBROW}>Agente</p>
            <Select
              className="mt-1 w-full"
              aria-label="Filtrar por agente"
              placeholder="Todos"
              value={agentFilter}
              onChange={setAgentFilter}
              options={[
                { value: "", label: "Todos los agentes" },
                ...data.by_agent.map((agent) => ({
                  value: agent.agent_code,
                  label: agent.agent_name,
                })),
              ]}
            />
          </div>
          <div>
            <p className={EYEBROW}>Estado</p>
            <Select
              className="mt-1 w-full"
              aria-label="Filtrar por estado"
              placeholder="Todos"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "Todos los estados" },
                { value: "succeeded", label: "OK" },
                { value: "failed", label: "Fallo" },
                { value: "rejected_output", label: "Salida rechazada" },
                { value: "running", label: "En curso" },
              ]}
            />
          </div>
        </div>

        <Table
          ariaLabel="Ejecuciones recientes"
          columns={runColumns}
          rows={filteredRuns}
          emptyLabel="Ninguna ejecución coincide con el filtro."
        />

        {expandedRun ? (
          <div className="mt-4 space-y-3 border-t border-separator pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusMeta(expandedRun.status).tone}>
                {statusMeta(expandedRun.status).label}
              </Badge>
              <Badge tone="neutral">{expandedRun.trigger_type}</Badge>
              {expandedRun.execution_mode &&
              expandedRun.execution_mode !== "live" ? (
                <Badge tone="warn">{expandedRun.execution_mode}</Badge>
              ) : null}
              <span className="text-xs text-muted">
                {formatDateTime(expandedRun.started_at)}
              </span>
            </div>

            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Agente</dt>
                <dd>{expandedRun.agent_name}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Cliente</dt>
                <dd>{expandedRun.organization_name}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Tienda</dt>
                <dd>{expandedRun.store_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Consultor</dt>
                <dd>{expandedRun.consultant_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Lanzado por</dt>
                <dd>{expandedRun.actor_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Tokens (in / out)</dt>
                <dd>
                  {expandedRun.input_tokens.toLocaleString("es-ES")} /{" "}
                  {expandedRun.output_tokens.toLocaleString("es-ES")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Latencia</dt>
                <dd>{formatLatency(expandedRun.latency_ms)}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Coste</dt>
                <dd>
                  {formatCost(expandedRun.cost_usd)}
                  {expandedRun.cost_basis === "unknown_model" ? (
                    <span className="text-muted"> · modelo sin tarifa</span>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-muted">Proveedor / modelo</dt>
                <dd>
                  {expandedRun.provider && expandedRun.model
                    ? `${expandedRun.provider} · ${expandedRun.model}`
                    : "Sin registrar"}
                </dd>
              </div>
            </dl>

            <div>
              <p className={EYEBROW}>Objetivo</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {expandedRun.objective || "—"}
              </p>
            </div>

            {expandedRun.error_message ? (
              <div>
                <p className={EYEBROW}>Error</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-danger p-2 text-sm leading-6 text-danger">
                  {expandedRun.error_message}
                </p>
              </div>
            ) : null}

            {/* La traza se pide solo al abrir el detalle: son cuatro consultas
                mas por ejecucion y no tiene sentido pagarlas por las 120 filas
                de la tabla. La clave fuerza el remontaje al cambiar de run. */}
            <div className="border-t border-separator pt-4">
              <RunTraceDetail
                key={expandedRun.id}
                organizationId={expandedRun.organization_id}
                runId={expandedRun.id}
              />
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default function AdminObservabilidadPage() {
  return (
    <PlatformAdminShell title="Observabilidad">
      {() => <ObservabilidadPanel />}
    </PlatformAdminShell>
  );
}
