"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { getAgentCatalogEntry } from "@ecomscaling/contracts";
import {
  AsyncState,
  AgentEvalReadinessPanel,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  LoadingBlock,
  Modal,
  Table,
  Textarea,
  toast,
  type Tone,
  type TableColumnDef,
} from "@/components/ui";

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
      setError("No se pudieron cargar las ejecuciones de agentes. Revisa la conexión e inténtalo de nuevo.");
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
      setBudgetError("No se pudo cargar el presupuesto de IA. Revisa la conexión e inténtalo de nuevo.");
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
      setTraceError("No se pudo cargar la traza. Revisa la conexión e inténtalo de nuevo.");
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
        await loadRuns();
      }
    } catch {
      toast.danger("No se pudo procesar la propuesta. Revisa la conexión e inténtalo de nuevo.");
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

  const runColumns: TableColumnDef<AgentRun>[] = [
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

  const stepColumns: TableColumnDef<TraceStep>[] = [
    { key: "position", label: "#" },
    { key: "step_type", label: "Tipo" },
    { key: "summary", label: "Resumen", render: (row) => row.summary ?? "—" },
    {
      key: "duration_ms",
      label: "Duración (ms)",
      render: (row) => row.duration_ms ?? "—",
    },
  ];

  const toolCallColumns: TableColumnDef<TraceToolCall>[] = [
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

  const contextColumns: TableColumnDef<TraceContextSnapshot>[] = [
    { key: "context_level", label: "Nivel" },
    {
      key: "created_at",
      label: "Hora",
      render: (row) => new Date(row.created_at).toLocaleTimeString(),
    },
  ];

  const queryRunColumns: TableColumnDef<TraceQueryRun>[] = [
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
    <div className="portal-page space-y-6">
      <Heading level={1} size="lg">Ejecuciones de agentes IA</Heading>
      <p className="text-[13px] text-muted">
        Panel técnico (AI-12, Observability &amp; tracing): reconstruye una
        ejecución completa sin consultar varias tablas a mano. Las salidas con
        propuestas quedan pendientes de revisión humana; esta vista no ejecuta
        cambios por sí sola.
      </p>

      <AgentEvalReadinessPanel
        coveredAgents={evalReadiness.coveredAgents}
        totalAgents={evalReadiness.totalAgents}
        offlineRunRecorded={evalReadiness.offlineRunRecorded}
        liveVerified={evalReadiness.liveVerified}
      />

      <Card
        kicker="Control de costes"
        title="Presupuesto diario de IA"
        description="Supervisa el consumo de los agentes antes de alcanzar el límite operativo de la organización."
      >
        {budgetLoading ? (
          <LoadingBlock label="Consultando presupuesto..." />
        ) : budgetError ? (
          <ErrorBlock>{budgetError}</ErrorBlock>
        ) : budget ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Gastado hoy</p>
              <p className="text-xl font-semibold text-ink">
                ${budget.spentTodayUsd.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Límite diario</p>
              <p className="text-xl font-semibold text-ink">
                ${budget.dailyBudgetUsd.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Disponible</p>
              <p className="text-xl font-semibold text-ink">
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
      </Card>

      <Card
        title="Ejecuciones recientes"
        description="Consulta el estado, coste, latencia y trazabilidad de cada ejecución."
      >
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
          <Table
            columns={runColumns}
            rows={runs}
            ariaLabel="Ejecuciones de agentes IA"
          />
        )}
      </Card>

      <Modal
        isOpen={reviewOutput !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewOutput(null);
            setReviewReason("");
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog aria-label="Revisar propuesta del agente">
              <Modal.Header>
                <Modal.Heading>
                  {reviewOutput
                    ? `Propuesta de ${reviewOutput.runId}`
                    : "Propuesta"}
                </Modal.Heading>
              </Modal.Header>
              {reviewOutput ? (
                <>
                  <Modal.Body>
                    <div className="space-y-4">
                      <p className="text-[13px] text-muted">
                        Esta propuesta está en shadow mode. Revisa el contenido y
                        la evidencia antes de materializar las tareas sugeridas.
                      </p>
                      {reviewOutput.output.output?.answer ? (
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                          {reviewOutput.output.output.answer}
                        </p>
                      ) : null}
                      <div>
                        <p className={EYEBROW}>Evidencia y citas</p>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-edge bg-surface p-3 text-xs">
                          {JSON.stringify(
                            {
                              evidence:
                                reviewOutput.output.output?.evidence ?? [],
                              findings:
                                reviewOutput.output.output?.findings ?? [],
                              sources:
                                reviewOutput.output.output?.sources ?? [],
                              citations:
                                reviewOutput.output.output?.citations ?? [],
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                      <div>
                        <p className={EYEBROW}>Escrituras propuestas</p>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-edge bg-surface p-3 text-xs">
                          {JSON.stringify(
                            reviewOutput.output.output?.proposed_writes ?? [],
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                      <Field label="Motivo de la decisión (opcional)">
                        <Textarea
                          aria-label="Motivo de la decisión"
                          className="mt-2 min-h-20"
                          placeholder="Deja contexto para el siguiente revisor…"
                          value={reviewReason}
                          onChange={(event) =>
                            setReviewReason(event.target.value)
                          }
                          disabled={isDeciding}
                        />
                      </Field>
                    </div>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => void decideOutput("rejected")}
                      disabled={isDeciding}
                    >
                      Rechazar propuesta
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void decideOutput("approved")}
                      disabled={isDeciding}
                    >
                      {isDeciding ? "Guardando..." : "Aprobar y crear tareas"}
                    </Button>
                  </Modal.Footer>
                </>
              ) : null}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal
        isOpen={selectedRunId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRunId(null);
            setTrace(null);
            setTraceError(null);
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="cover">
            <Modal.Dialog aria-label="Traza de ejecución del agente">
              <Modal.Header>
                <Modal.Heading>
                  {selectedRunId ?? "Traza de ejecución"}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {isTraceLoading ? (
                  <LoadingBlock label="Cargando traza..." />
                ) : traceError ? (
                  <ErrorBlock>{traceError}</ErrorBlock>
                ) : trace ? (
                  <div className="space-y-6">
              <div>
                <p className="text-sm font-medium">
                  {getAgentCatalogEntry(
                    trace.run.agent_versions?.agent_definitions.code ?? "",
                  )?.displayName ?? "Agente IA"}
                </p>
                <p className={EYEBROW}>
                  {trace.run.agent_versions?.agent_definitions.code} ·{" "}
                  {trace.run.agent_versions?.model} v
                  {trace.run.agent_versions?.version}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {trace.run.input_tokens} tokens entrada ·{" "}
                  {trace.run.output_tokens} tokens salida ·{" "}
                  {trace.run.estimated_cost_usd.toFixed(4)} USD
                  {trace.run.error_message
                    ? ` · error: ${trace.run.error_message}`
                    : ""}
                </p>
              </div>

              <div>
                <p className={EYEBROW}>
                  Pasos
                </p>
                <Table
                  className="mt-2"
                  ariaLabel="Pasos de la ejecucion"
                  columns={stepColumns}
                  rows={trace.steps}
                  emptyLabel="Sin pasos registrados."
                />
              </div>

              <div>
                <p className={EYEBROW}>
                  Llamadas a herramientas
                </p>
                <Table
                  className="mt-2"
                  ariaLabel="Llamadas a herramientas"
                  columns={toolCallColumns}
                  rows={trace.tool_calls}
                  emptyLabel="Sin llamadas a herramientas (evidence-pack puro)."
                />
              </div>

              <div>
                <p className={EYEBROW}>
                  Snapshots de contexto
                </p>
                <Table
                  className="mt-2"
                  ariaLabel="Snapshots de contexto"
                  columns={contextColumns}
                  rows={trace.context_snapshots}
                  emptyLabel="Sin snapshots de contexto."
                />
              </div>

              <div>
                <p className={EYEBROW}>
                  Consultas SQL
                </p>
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
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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
