"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { useActiveConnection } from "@/components/active-connection";

type Finding = { title: string; severity: "info" | "low" | "medium" | "high" | "critical"; evidence: string };
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
  proposed_writes: Array<{ kind: string; title: string; description: string; priority: string }>;
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
};

const severityDot: Record<Finding["severity"], string> = {
  info: "bg-muted",
  low: "bg-muted",
  medium: "bg-warn",
  high: "bg-brand",
  critical: "bg-brand",
};

const priorityLabelsEs: Record<string, string> = {
  low: "baja",
  medium: "media",
  high: "alta",
  urgent: "urgente",
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - ");
}

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
}: {
  organizationId: string;
  title: string;
  getPath: string;
  runPath: string;
  loadingLabel: string;
  tasksLabelSingular: string;
  days?: number;
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
  const connectionParam = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      setTasksFeedback(null);

      const response = await apiFetch(`/v1/organizations/${organizationId}${getPath}${connectionParam}`);

      if (response.ok) {
        setDiagnostic((await response.json()) as Diagnostic);
      } else {
        setDiagnostic(null);
        setError(await readError(response));
      }

      setIsLoading(false);
    }

    void load();
  }, [organizationId, getPath, connectionParam]);

  async function regenerate() {
    setIsRegenerating(true);
    setError(null);
    setTasksFeedback(null);

    const response = await apiFetch(`/v1/organizations/${organizationId}${runPath}${connectionParam}`, {
      method: "POST",
    });

    if (response.ok) {
      setDiagnostic((await response.json()) as Diagnostic);
    } else {
      setError(await readError(response));
    }

    setIsRegenerating(false);
  }

  async function createSuggestedTasks() {
    if (!diagnostic) {
      return;
    }

    setIsCreatingTasks(true);
    setTasksFeedback(null);

    const response = await apiFetch(
      `/v1/organizations/${organizationId}/ai/outputs/${diagnostic.output_id}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approved" }),
      },
    );

    if (!response.ok) {
      setTasksFeedback(await readError(response));
      setIsCreatingTasks(false);
      return;
    }

    const payload = (await response.json()) as { tasks_created: number };
    setDiagnostic({ ...diagnostic, output_status: "approved" });
    setTasksFeedback(
      payload.tasks_created > 0
        ? `${payload.tasks_created} tarea(s) creada(s) en Tareas.`
        : "Sin tareas nuevas que crear.",
    );
    setIsCreatingTasks(false);
  }

  return (
    <section className="border-t border-ink/20 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div>
          <h3 className="font-display text-2xl">{title}</h3>
          {diagnostic ? (
            <p className="mt-1 font-mono text-xs text-muted">
              {days ? `últimos ${days} días · ` : ""}
              {diagnostic.from_cache ? "generado" : "recien generado"} el{" "}
              {new Date(diagnostic.generated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
        {diagnostic ? (
          <button
            className="text-sm font-medium underline decoration-edge-strong decoration-1 underline-offset-4 transition hover:text-brand hover:decoration-brand disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isRegenerating}
            onClick={regenerate}
          >
            {isRegenerating ? "Actualizando..." : "Actualizar ahora"}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted">{loadingLabel}</p>
      ) : error ? (
        <p className="mt-3 text-sm text-brand">{error}</p>
      ) : diagnostic ? (
        <div className="mt-3 space-y-4">
          <p className="text-sm leading-6">{diagnostic.output.answer}</p>

          {diagnostic.output.findings.length ? (
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Hallazgos</p>
              <ul className="mt-1.5 space-y-1.5">
                {diagnostic.output.findings.map((finding, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden
                      className={["mt-1.5 inline-block size-1.5 shrink-0 rounded-full", severityDot[finding.severity]].join(" ")}
                    />
                    <span>
                      <span className="font-medium">{finding.title}</span>{" "}
                      <span className="text-muted">— {finding.evidence}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {diagnostic.output.recommendations.length ? (
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Recomendaciones</p>
              <ul className="mt-1.5 space-y-1">
                {diagnostic.output.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm">
                    <span className="font-medium">{rec.action}</span>{" "}
                    <span className="font-mono text-xs text-muted">
                      ({priorityLabelsEs[rec.priority] ?? rec.priority} · {rec.owner})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {diagnostic.output.warnings.length ? (
            <div className="border-l-2 border-warn pl-3">
              <ul className="space-y-1 text-sm text-muted">
                {diagnostic.output.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {diagnostic.output.proposed_writes.length ? (
            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3">
              <button
                className="bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={isCreatingTasks || diagnostic.output_status !== "pending_approval"}
                onClick={createSuggestedTasks}
              >
                {isCreatingTasks
                  ? "Creando..."
                  : diagnostic.output_status !== "pending_approval"
                    ? "Tareas ya revisadas"
                    : `Crear ${diagnostic.output.proposed_writes.length} ${tasksLabelSingular}(s) sugerida(s)`}
              </button>
              {tasksFeedback ? <p className="text-sm text-muted">{tasksFeedback}</p> : null}
            </div>
          ) : tasksFeedback ? (
            <p className="text-sm text-muted">{tasksFeedback}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
