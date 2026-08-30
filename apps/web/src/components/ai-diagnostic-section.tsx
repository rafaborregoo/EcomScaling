"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import { useActiveConnection } from "@/components/active-connection";
import {
  Badge,
  AgentRuntimeStatusBadge,
  Banner,
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  LoadingBlock,
  Table,
  type Tone,
} from "@/components/ui";

type Finding = {
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  evidence: string;
};
type Recommendation = {
  action: string;
  priority: "low" | "medium" | "high" | "urgent";
  expected_impact: string;
  owner: "cliente" | "consultor";
};
type DiagnosticOutput = {
  answer: string;
  findings: Finding[];
  recommendations: Recommendation[];
  proposed_writes: Array<{
    kind: string;
    title: string;
    description: string;
    priority: string;
  }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};
type Diagnostic = {
  run_id: string;
  output_id: string;
  output_status: string;
  output: DiagnosticOutput;
  generated_at: string;
  from_cache: boolean;
  runtime?: {
    orchestration_mode: "direct" | "langgraph";
    langsmith_tracing: boolean;
  };
  envelope?: {
    freshness: { status: "fresh" | "stale" | "superseded"; reason?: string };
    quality: {
      confidence: "low" | "medium" | "high";
      groundedness:
        "verified" | "partially_supported" | "insufficient_evidence";
      dataCompleteness: "complete" | "partial" | "insufficient";
      warnings: string[];
    };
    sources: Array<{ id: string; label: string }>;
  };
};

const severityTone: Record<Finding["severity"], Tone> = {
  info: "neutral",
  low: "neutral",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

const priorityLabelsEs: Record<string, string> = {
  low: "baja",
  medium: "media",
  high: "alta",
  urgent: "urgente",
};

/**
 * Bloque de diagnostico automatico reutilizable (AI-02/AI-05: A02, A04, A06).
 * Se genera solo (sin boton de "aprobar para ver"); la aprobacion humana solo
 * materializa proposed_writes como tareas reales. Mismo patron de cache de
 * 24h en el backend (getMonitorDiagnostic / getTaskPlannerDiagnostic /
 * getStockPlannerDiagnostic), solo cambia el par de endpoints.
 */
export function AiDiagnosticSection({
  organizationId,
  title,
  getPath,
  runPath,
  loadingLabel,
  tasksLabelSingular,
  days,
  variant = "full",
}: {
  organizationId: string;
  title: string;
  getPath: string;
  runPath: string;
  loadingLabel: string;
  tasksLabelSingular: string;
  days?: number;
  variant?: "full" | "summary";
}) {
  const { connectionId } = useActiveConnection();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [tasksFeedback, setTasksFeedback] = useState<string | null>(null);

  const queryParams = [
    connectionId ? `connectionId=${encodeURIComponent(connectionId)}` : null,
    days ? `days=${days}` : null,
  ].filter(Boolean);
  const connectionParam =
    queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      setTasksFeedback(null);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}${getPath}${connectionParam}`,
        );

        if (response.ok) {
          setDiagnostic((await response.json()) as Diagnostic);
        } else {
          setDiagnostic(null);
          setError(await readApiError(response));
        }
      } catch {
        setDiagnostic(null);
        setError(
          "No se pudo cargar el diagnóstico IA por un error de red. Reintenta.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [organizationId, getPath, connectionParam]);

  async function regenerate() {
    setIsRegenerating(true);
    setError(null);
    setTasksFeedback(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}${runPath}${connectionParam}`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        setDiagnostic((await response.json()) as Diagnostic);
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(
        "No se pudo regenerar el diagnóstico IA por un error de red. Reintenta.",
      );
    } finally {
      setIsRegenerating(false);
    }
  }

  async function createSuggestedTasks() {
    if (!diagnostic) {
      return;
    }

    setIsCreatingTasks(true);
    setTasksFeedback(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/outputs/${diagnostic.output_id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "approved" }),
        },
      );

      if (!response.ok) {
        setTasksFeedback(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as { tasks_created: number };
      setDiagnostic({ ...diagnostic, output_status: "approved" });
      setTasksFeedback(
        payload.tasks_created > 0
          ? `${payload.tasks_created} tarea(s) creada(s) en Tareas.`
          : "Sin tareas nuevas que crear.",
      );
    } catch {
      setTasksFeedback(
        "No se pudieron crear las tareas sugeridas por un error de red. Reintenta.",
      );
    } finally {
      setIsCreatingTasks(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Badge tone="brand">IA</Badge>
          {title}
        </span>
      }
      description={
        diagnostic ? (
          <span className="text-xs text-muted">
            {days ? `últimos ${days} días · ` : ""}
            {diagnostic.from_cache ? "generado" : "recién generado"} el{" "}
            {new Date(diagnostic.generated_at).toLocaleString()}
            {diagnostic.envelope
              ? ` · datos ${displayValue(
                  diagnostic.envelope.freshness.status,
                )} · ${diagnostic.envelope.sources.length} fuente(s)`
              : ""}
          </span>
        ) : undefined
      }
      actions={
        diagnostic ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={isRegenerating}
            onClick={regenerate}
          >
            {isRegenerating ? "Actualizando..." : "Actualizar ahora"}
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <LoadingBlock label={loadingLabel} />
      ) : error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : diagnostic ? (
        <>
          <p className="text-[13px] leading-relaxed text-ink">
            {diagnostic.output.answer}
          </p>
          {diagnostic.runtime ? (
            <div className="mt-2">
              <AgentRuntimeStatusBadge
                orchestrationMode={diagnostic.runtime.orchestration_mode}
                langsmithTracing={diagnostic.runtime.langsmith_tracing}
              />
            </div>
          ) : null}

          {variant === "summary" ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="neutral">
                  Confianza: {diagnostic.output.confidence}
                </Badge>
                {diagnostic.envelope ? (
                  <>
                    <Badge tone="neutral">
                      Evidencia: {diagnostic.envelope.quality.groundedness}
                    </Badge>
                    <Badge tone="neutral">
                      Datos: {diagnostic.envelope.quality.dataCompleteness}
                    </Badge>
                  </>
                ) : null}
              </div>
              {diagnostic.envelope?.sources.length ? (
                <p className="mt-3 text-xs text-muted">
                  Basado en {diagnostic.envelope.sources.length} fuente(s):{" "}
                  {diagnostic.envelope.sources
                    .map((source) => source.label)
                    .join(", ")}
                </p>
              ) : null}
              {diagnostic.output.proposed_writes.length ? (
                <Banner tone="warn" className="mt-3">
                  {diagnostic.output.proposed_writes.length} propuesta(s)
                  pendiente(s) de revisión humana. No se ha ejecutado ninguna
                  escritura.
                </Banner>
              ) : null}
            </>
          ) : null}

          {variant === "full" && diagnostic.output.findings.length ? (
            <div className="mt-4">
              <p className={EYEBROW}>
                Hallazgos
              </p>
              <Table
                className="mt-2"
                ariaLabel="Hallazgos del diagnostico"
                columns={[
                  {
                    key: "severity",
                    label: "Severidad",
                    render: (row) => (
                      <Badge tone={severityTone[row.severity]}>
                        {row.severity}
                      </Badge>
                    ),
                  },
                  { key: "title", label: "Hallazgo" },
                  { key: "evidence", label: "Evidencia" },
                ]}
                rows={diagnostic.output.findings.map((finding, index) => ({
                  id: String(index),
                  ...finding,
                }))}
              />
            </div>
          ) : null}

          {variant === "full" && diagnostic.output.recommendations.length ? (
            <div className="mt-4">
              <p className={EYEBROW}>Recomendación</p>
              <Table
                className="mt-2"
                ariaLabel="Recomendaciones del diagnostico"
                columns={[
                  { key: "action", label: "Acción" },
                  {
                    key: "priority",
                    label: "Prioridad",
                    render: (row) =>
                      priorityLabelsEs[row.priority] ?? row.priority,
                  },
                  { key: "expected_impact", label: "Impacto esperado" },
                  { key: "owner", label: "Responsable" },
                ]}
                rows={diagnostic.output.recommendations.map((rec, index) => ({
                  id: String(index),
                  ...rec,
                }))}
              />
            </div>
          ) : null}

          {diagnostic.output.warnings.length ? (
            <Banner tone="warn" className="mt-4">
              <ul className="space-y-1">
                {diagnostic.output.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </Banner>
          ) : null}

          {variant === "full" && diagnostic.output.proposed_writes.length ? (
            <div className="mt-4 border-t border-edge pt-3">
              <p className={EYEBROW}>
                {diagnostic.output_status === "pending_approval"
                  ? "Propuesta, sin aplicar"
                  : "Propuesta ya revisada"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <Button
                  type="button"
                  disabled={
                    isCreatingTasks ||
                    diagnostic.output_status !== "pending_approval"
                  }
                  onClick={createSuggestedTasks}
                >
                  {isCreatingTasks
                    ? "Creando..."
                    : diagnostic.output_status !== "pending_approval"
                      ? "Tareas ya revisadas"
                      : `Crear ${diagnostic.output.proposed_writes.length} ${tasksLabelSingular}(s) sugerida(s)`}
                </Button>
                {tasksFeedback ? (
                  <p className="text-sm text-muted">{tasksFeedback}</p>
                ) : null}
              </div>
            </div>
          ) : tasksFeedback ? (
            <p className="mt-4 text-sm text-muted">{tasksFeedback}</p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
