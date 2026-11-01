"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { getAgentCatalogEntry } from "@e-nora/contracts";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  ScrollArea,
  AsyncState,
  AgentEvalReadinessPanel,
  Badge,
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  ErrorBlock,
  Field,
  Heading,
  LoadingBlock,
  Metric,
  Select,
  DataTable,
  Tabs,
  Textarea,
  toast,
  type Tone,
  type DataTableColumn,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
  EYEBROW,
} from "@/components/ui";

// AI-30 fase 7: el rechazo categorizado es la señal de calidad que agrupa
// /admin/observabilidad. Mismos valores que el check de agent_approvals.
const REJECTION_CATEGORY_OPTIONS = [
  { value: "incorrecto", label: "Dato o conclusión incorrecta" },
  { value: "sin_evidencia", label: "Sin evidencia suficiente" },
  { value: "irrelevante", label: "No aplica a este negocio" },
  { value: "incompleto", label: "Incompleta" },
  { value: "duplicado", label: "Repite algo ya propuesto" },
  { value: "otro", label: "Otro motivo" },
];

type AgentRunOutput = {
  id: string;
  status: string;
  approval_required?: boolean;
  output?: {
    answer?: string;
    citations?: unknown;
    evidence?: unknown;
    findings?: unknown;
    sources?: unknown;
    proposed_writes?: Array<Record<string, unknown>>;
  } | null;
} | null;

type AgentRun = {
  id: string;
  trigger_type: string;
  objective: string;
  status: string;
  execution_mode: "shadow" | "live";
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  agent_outputs: AgentRunOutput[];
};

/**
 * Datos de un agente que llegan como JSON suelto (evidencia, hallazgos,
 * fuentes, escrituras propuestas): cadenas se listan, objetos se enseñan como
 * tabla con sus campos simples. Nunca se vuelca el JSON en pantalla.
 */
function ReadableData({ value, label }: { value: unknown; label: string }) {
  const rows = Array.isArray(value) ? value : value == null ? [] : [value];
  if (rows.length === 0) return null;
  if (rows.every((row) => typeof row === "string")) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <ul className="list-disc space-y-1 pl-4">
          {(rows as string[]).map((row, index) => (
            <li key={index}>{row}</li>
          ))}
        </ul>
      </section>
    );
  }
  const objects = rows.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
  const keys = [
    ...new Set(
      objects.flatMap((row) =>
        Object.keys(row).filter((key) =>
          ["string", "number", "boolean"].includes(typeof row[key]),
        ),
      ),
    ),
  ].slice(0, 4);
  if (objects.length === 0 || keys.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">{label}</h3>
      <DataTable
        ariaLabel={label}
        columns={keys.map((key) => ({ key, label: displayValue(key) }))}
        rows={objects.map((row, index) => ({
          id: String(row.id ?? index),
          ...Object.fromEntries(keys.map((key) => [key, String(row[key] ?? "")])),
        }))}
      />
    </section>
  );
}

type AgentBudgetStatus = {
  spentTodayUsd: number;
  dailyBudgetUsd: number;
  remainingUsd: number;
  asOf: string;
};

type AgentEvalReadiness = {
  coveredAgents: number;
  totalAgents: number;
  offlineRunRecorded: boolean;
  liveVerified: boolean;
  datasetVersion: string;
  source: "persisted" | "local_prepared";
};

type TraceStep = {
  id: string;
  position: number;
  step_type: string;
  summary: string | null;
  duration_ms: number | null;
};
type TraceToolCall = {
  id: string;
  tool_name: string;
  is_error: boolean;
  duration_ms: number | null;
  created_at: string;
};
type TraceContextSnapshot = {
  id: string;
  context_level: string;
  created_at: string;
};
type TraceQueryRun = {
  id: string;
  sql_text: string;
  rows_returned: number | null;
  duration_ms: number | null;
  was_rejected: boolean;
  created_at: string;
};

type RunTrace = {
  run: AgentRun & {
    agent_versions: {
      version: string;
      model: string;
      agent_definitions: { code: string };
    } | null;
  };
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

const outputStatusTone: Record<string, Tone> = {
  pending_approval: "warn",
  approved: "success",
  published: "success",
  rejected: "danger",
  failed: "danger",
  draft: "neutral",
};

const outputStatusLabel: Record<string, string> = {
  pending_approval: "Pendiente de revisión",
  approved: "Aprobada",
  published: "Publicada",
  rejected: "Rechazada",
  failed: "Fallida",
  draft: "Borrador",
};

const runStatusLabel: Record<string, string> = {
  queued: "En cola",
  running: "En curso",
  succeeded: "Completada",
  failed: "Fallida",
  cancelled: "Cancelada",
};

function AgentRunsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isDesktop = useIsDesktop();
  const canView = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [trace, setTrace] = useState<RunTrace | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [isTraceLoading, setIsTraceLoading] = useState(false);
  const [reviewOutput, setReviewOutput] = useState<{
    runId: string;
    output: Exclude<AgentRunOutput, null>;
  } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewCategory, setReviewCategory] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [traceTab, setTraceTab] = useState("steps");
  const [isDeciding, setIsDeciding] = useState(false);
  const [budget, setBudget] = useState<AgentBudgetStatus | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [evalReadiness, setEvalReadiness] = useState<AgentEvalReadiness>({
    coveredAgents: 11,
    totalAgents: 11,
    offlineRunRecorded: false,
    liveVerified: false,
    datasetVersion: "2026-08-26.v1",
    source: "local_prepared",
  });

  const loadRuns = useCallback(async () => {
    if (!canView) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/runs`,
      );
      if (response.ok) {
        const body = (await response.json()) as { runs: AgentRun[] };
        setRuns(body.runs);
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(
        "No se pudieron cargar las ejecuciones de agentes. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, canView]);

  useEffect(() => {
    // Sincroniza las ejecuciones con el endpoint remoto al montar/cambiar de
    // organizacion; no es estado derivado de otro valor local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRuns();
  }, [loadRuns]);

  const loadBudget = useCallback(async () => {
    if (!canView) return;

    setBudgetLoading(true);
    setBudgetError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/budget`,
      );
      if (response.ok) {
        setBudget((await response.json()) as AgentBudgetStatus);
      } else {
        setBudgetError(await readApiError(response));
      }
    } catch {
      setBudgetError(
        "No se pudo cargar el presupuesto de IA. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setBudgetLoading(false);
    }
  }, [organizationId, canView]);

  useEffect(() => {
    // Sincroniza el presupuesto remoto con la organizacion activa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBudget();
  }, [loadBudget]);

  const loadEvalReadiness = useCallback(async () => {
    if (!canView) return;
    try {
      const response = await apiFetch("/v1/agents/eval-readiness");
      if (response.ok) {
        setEvalReadiness((await response.json()) as AgentEvalReadiness);
      }
    } catch {
      // La readiness es informativa; la vista principal conserva sus datos.
    }
  }, [canView]);

  useEffect(() => {
    // Si AI-26 aún no está aplicado, el API devuelve el fallback preparado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvalReadiness();
  }, [loadEvalReadiness]);

  async function openTrace(runId: string) {
    setSelectedRunId(runId);
    setTrace(null);
    setTraceError(null);
    setIsTraceLoading(true);

    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/runs/${runId}/trace`,
      );
      if (response.ok) {
        setTrace((await response.json()) as RunTrace);
      } else {
        setTraceError(await readApiError(response));
      }
    } catch {
      setTraceError(
        "No se pudo cargar la traza. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setIsTraceLoading(false);
    }
  }

  async function decideOutput(decision: "approved" | "rejected") {
    if (!reviewOutput) return;

    setIsDeciding(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/outputs/${reviewOutput.output.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reason: reviewReason.trim() || undefined,
            reason_category:
              decision === "rejected" && reviewCategory
                ? reviewCategory
                : undefined,
          }),
        },
      );

      if (!response.ok) {
        toast.danger(
          `No se pudo ${decision === "approved" ? "aprobar" : "rechazar"} la propuesta: ${await readApiError(response)}`,
        );
      } else {
        toast.success(
          decision === "approved"
            ? "Propuesta aprobada y materializada."
            : "Propuesta rechazada.",
        );
        setReviewOutput(null);
        setReviewReason("");
        setReviewCategory("");
        await loadRuns();
      }
    } catch {
      toast.danger(
        "No se pudo procesar la propuesta. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setIsDeciding(false);
    }
  }

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="Las ejecuciones de agentes IA son un panel tecnico solo para consultor/platform admin."
      />
    );
  }

  const runColumns: DataTableColumn<AgentRun>[] = [
    { key: "objective", label: "Objetivo" },
    { key: "trigger_type", label: "Disparador" },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <Badge tone={statusTone[row.status] ?? "neutral"}>
          {runStatusLabel[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "execution_mode",
      label: "Modo",
      render: (row) => (
        <Badge tone={row.execution_mode === "shadow" ? "warn" : "danger"}>
          {row.execution_mode === "shadow" ? "Previsualización" : "En vivo"}
        </Badge>
      ),
    },
    {
      key: "agent_outputs",
      label: "Salida / revisión",
      render: (row) => {
        const output = row.agent_outputs?.[0] ?? null;
        const outputStatus = output?.status ?? "sin_salida";
        return (
          <div className="flex items-center gap-2">
            <Badge tone={outputStatusTone[outputStatus] ?? "neutral"}>
              {outputStatusLabel[outputStatus] ??
                outputStatus.replaceAll("_", " ")}
            </Badge>
            {output?.status === "pending_approval" ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setReviewOutput({ runId: row.id, output });
                  setReviewReason("");
                }}
              >
                Revisar
              </Button>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "estimated_cost_usd",
      label: "Coste (USD)",
      render: (row) => row.estimated_cost_usd.toFixed(4),
    },
    {
      key: "latency_ms",
      label: "Latencia (ms)",
      render: (row) => row.latency_ms ?? "—",
    },
    {
      key: "started_at",
      label: "Fecha",
      render: (row) => new Date(row.started_at).toLocaleString(),
    },
    {
      key: "trace",
      label: "",
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => openTrace(row.id)}
        >
          Ver traza
        </Button>
      ),
    },
  ];

  const stepColumns: DataTableColumn<TraceStep>[] = [
    { key: "position", label: "#" },
    { key: "step_type", label: "Tipo" },
    { key: "summary", label: "Resumen", render: (row) => row.summary ?? "—" },
    {
      key: "duration_ms",
      label: "Duración (ms)",
      render: (row) => row.duration_ms ?? "—",
    },
  ];

  const toolCallColumns: DataTableColumn<TraceToolCall>[] = [
    { key: "tool_name", label: "Herramienta" },
    {
      key: "is_error",
      label: "Resultado",
      render: (row) => (
        <Badge tone={row.is_error ? "danger" : "neutral"}>
          {row.is_error ? "Error" : "Correcto"}
        </Badge>
      ),
    },
    {
      key: "duration_ms",
      label: "Duración (ms)",
      render: (row) => row.duration_ms ?? "—",
    },
    {
      key: "created_at",
      label: "Hora",
      render: (row) => new Date(row.created_at).toLocaleTimeString(),
    },
  ];

  const contextColumns: DataTableColumn<TraceContextSnapshot>[] = [
    { key: "context_level", label: "Nivel" },
    {
      key: "created_at",
      label: "Hora",
      render: (row) => new Date(row.created_at).toLocaleTimeString(),
    },
  ];

  const queryRunColumns: DataTableColumn<TraceQueryRun>[] = [
    { key: "sql_text", label: "SQL" },
    {
      key: "rows_returned",
      label: "Filas",
      render: (row) => row.rows_returned ?? "—",
    },
    {
      key: "was_rejected",
      label: "Estado",
      render: (row) => (
        <Badge tone={row.was_rejected ? "danger" : "neutral"}>
          {row.was_rejected ? "Rechazada" : "Correcta"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Heading level={1} size="lg">
        Ejecuciones de agentes IA
      </Heading>
      <p className="text-[13px] text-muted">
        Panel técnico: reconstruye una ejecución completa sin consultar varias tablas a mano. Las salidas con
        propuestas quedan pendientes de revisión humana; esta vista no ejecuta
        cambios por sí sola.
      </p>

      <AgentEvalReadinessPanel
        coveredAgents={evalReadiness.coveredAgents}
        totalAgents={evalReadiness.totalAgents}
        offlineRunRecorded={evalReadiness.offlineRunRecorded}
        liveVerified={evalReadiness.liveVerified}
      />

      <Card>
        <CardHeader>
          <CardKicker>Control de costes</CardKicker>
          <CardTitle>Presupuesto diario de IA</CardTitle>
          <CardDescription>Supervisa el consumo de los agentes antes de alcanzar el límite operativo de la organización.</CardDescription>
        </CardHeader>
        <CardContent>
          {budgetLoading ? (
            <LoadingBlock label="Consultando presupuesto..." />
          ) : budgetError ? (
            <ErrorBlock>{budgetError}</ErrorBlock>
          ) : budget ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">Gastado hoy</p>
                <p className="text-xl font-semibold text-foreground">
                  ${budget.spentTodayUsd.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Límite diario</p>
                <p className="text-xl font-semibold text-foreground">
                  ${budget.dailyBudgetUsd.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Disponible</p>
                <p className="text-xl font-semibold text-foreground">
                  ${budget.remainingUsd.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Presupuesto no disponible"
              hint="No se pudo obtener el estado actual del control de costes."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ejecuciones recientes</CardTitle>
          <CardDescription>Consulta el estado, coste, latencia y trazabilidad de cada ejecución.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <AsyncState status="loading" loadingLabel="Cargando ejecuciones..." />
          ) : error ? (
            <AsyncState status="error" error={error} />
          ) : runs.length === 0 ? (
            <EmptyState
              title="Sin ejecuciones todavia"
              hint="Los agentes de esta organizacion no han corrido todavia."
            />
          ) : (
            <DataTable
              columns={runColumns}
              rows={runs}
              ariaLabel="Ejecuciones de agentes IA"
            />
          )}
        </CardContent>
      </Card>

      <Drawer
        open={reviewOutput !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewOutput(null);
            setReviewReason("");
            setReviewCategory("");
            setRejecting(false);
          }
        }}
        busy={isDeciding}
        dirty={Boolean(reviewReason.trim())}
        swipeDirection={isDesktop ? "right" : "down"}
        showSwipeHandle={!isDesktop}
      >
        <DrawerContent className="sm:max-w-[44rem]">
        <DrawerHeader>
          <span className={EYEBROW}>Propuesta pendiente de revisión</span>
          <DrawerTitle>
            {runs.find((run) => run.id === reviewOutput?.runId)?.objective ?? "Propuesta del agente"}
          </DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 space-y-4 p-4 sm:px-6">
        {reviewOutput ? (
          <>
            <p className="text-muted">
              El agente todavía no ha escrito nada. Revisa lo que propone antes de crear las tareas.
            </p>
            {reviewOutput.output.output?.answer ? (
              <p className="whitespace-pre-wrap leading-relaxed text-ink">
                {reviewOutput.output.output.answer}
              </p>
            ) : null}
            <ReadableData label="Evidencia" value={reviewOutput.output.output?.evidence} />
            <ReadableData label="Hallazgos" value={reviewOutput.output.output?.findings} />
            <ReadableData label="Fuentes" value={reviewOutput.output.output?.sources} />
            <ReadableData label="Citas" value={reviewOutput.output.output?.citations} />
            <ReadableData label="Cambios que haría" value={reviewOutput.output.output?.proposed_writes} />
            <Field label="Motivo de la decisión (opcional)">
              <Textarea
                aria-label="Motivo de la decisión"
                placeholder="Deja contexto para el siguiente revisor…"
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
                disabled={isDeciding}
              />
            </Field>
            {rejecting ? (
              <Field label="¿Por qué la rechazas? (opcional)">
                <Select
                  aria-label="Motivo del rechazo"
                  placeholder="Sin categoría"
                  value={reviewCategory}
                  onChange={setReviewCategory}
                  options={REJECTION_CATEGORY_OPTIONS}
                  disabled={isDeciding}
                />
              </Field>
            ) : null}
          </>
        ) : null}
        </ScrollArea>
        <DrawerFooter>
          {rejecting ? (
            <>
              <Button variant="destructive" disabled={isDeciding} onClick={() => void decideOutput("rejected")}>
                {isDeciding ? "Guardando…" : "Rechazar propuesta"}
              </Button>
              <Button variant="outline" onClick={() => setRejecting(false)}>
                Volver
              </Button>
            </>
          ) : (
            <>
              <Button disabled={isDeciding} onClick={() => void decideOutput("approved")}>
                {isDeciding ? "Guardando…" : "Aprobar y crear tareas"}
              </Button>
              {reviewOutput ? (
                <Button variant="ghost" className="text-danger" disabled={isDeciding} onClick={() => setRejecting(true)}>
                  Rechazar…
                </Button>
              ) : null}
              <DrawerClose render={<Button variant="outline" />}>Cancelar</DrawerClose>
            </>
          )}
        </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={selectedRunId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRunId(null);
            setTrace(null);
            setTraceError(null);
            setTraceTab("steps");
          }
        }}
        swipeDirection={isDesktop ? "right" : "down"}
        showSwipeHandle={!isDesktop}
      >
        <DrawerContent className="sm:max-w-[60rem]">
        <DrawerHeader>
          {trace ? (
            <span className={EYEBROW}>
              {getAgentCatalogEntry(trace.run.agent_versions?.agent_definitions.code ?? "")?.displayName ?? "Agente IA"}
            </span>
          ) : null}
          <DrawerTitle>
            {trace
              ? `Ejecución del ${new Date(trace.run.started_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "Traza de ejecución"}
          </DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 space-y-4 p-4 sm:px-6">
        {isTraceLoading ? (
          <LoadingBlock label="Cargando traza…" />
        ) : traceError ? (
          <ErrorBlock>{traceError}</ErrorBlock>
        ) : trace ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric size="sm" label="Tokens de entrada" value={trace.run.input_tokens.toLocaleString("es-ES")} />
              <Metric size="sm" label="Tokens de salida" value={trace.run.output_tokens.toLocaleString("es-ES")} />
              <Metric
                size="sm"
                label="Coste"
                value={new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(trace.run.estimated_cost_usd)}
              />
              <Metric size="sm" label="Modelo" value={`${trace.run.agent_versions?.model ?? "—"} v${trace.run.agent_versions?.version ?? ""}`} />
            </div>
            {trace.run.error_message ? <ErrorBlock>{trace.run.error_message}</ErrorBlock> : null}
            <Tabs
              value={traceTab}
              onChange={setTraceTab}
              items={[
                { value: "steps", label: `Pasos (${trace.steps.length})` },
                { value: "tools", label: `Herramientas (${trace.tool_calls.length})` },
                { value: "context", label: `Contexto (${trace.context_snapshots.length})` },
                { value: "sql", label: `SQL (${trace.query_runs.length})` },
              ]}
              panels={{
                steps: (
                  <DataTable
                    className="mt-4"
                    ariaLabel="Pasos de la ejecución"
                    columns={stepColumns}
                    rows={trace.steps}
                    emptyLabel="Sin pasos registrados."
                  />
                ),
                tools: (
                  <DataTable
                    className="mt-4"
                    ariaLabel="Llamadas a herramientas"
                    columns={toolCallColumns}
                    rows={trace.tool_calls}
                    emptyLabel="Esta ejecución no llamó a herramientas."
                  />
                ),
                context: (
                  <DataTable
                    className="mt-4"
                    ariaLabel="Snapshots de contexto"
                    columns={contextColumns}
                    rows={trace.context_snapshots}
                    emptyLabel="Sin snapshots de contexto."
                  />
                ),
                sql: (
                  <DataTable
                    className="mt-4"
                    ariaLabel="Consultas SQL del SQL Gateway"
                    columns={queryRunColumns}
                    rows={trace.query_runs}
                    emptyLabel="Sin consultas SQL en esta ejecución."
                  />
                ),
              }}
            />
          </>
        ) : null}
        </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function AgentRunsPageContent() {
  return (
    <PortalShell title="Ejecuciones IA">
      {(bootstrap) => <AgentRunsContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}

export default function AgentRunsPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando ejecuciones IA..." />}>
      <AgentRunsPageContent />
    </Suspense>
  );
}
