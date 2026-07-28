"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { useActiveConnection } from "@/components/active-connection";
import { Badge, Banner, Button, Card, ErrorBlock, Heading, LoadingBlock, Table, type Tone } from "@/components/ui";

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
  envelope?: {
    freshness: { status: "fresh" | "stale" | "superseded"; reason?: string };
    quality: {
      confidence: "low" | "medium" | "high";
      groundedness: "verified" | "partially_supported" | "insufficient_evidence";
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
          <Heading size="lg">{title}</Heading>
          {diagnostic ? (
            <p className="mt-1 font-mono text-xs text-muted">
              {days ? `últimos ${days} días · ` : ""}
              {diagnostic.from_cache ? "generado" : "recien generado"} el{" "}
              {new Date(diagnostic.generated_at).toLocaleString()}
              {diagnostic.envelope ? (
                <>
                  {" "}· datos {diagnostic.envelope.freshness.status} · {diagnostic.envelope.sources.length} fuente(s)
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {diagnostic ? (
          <Button variant="secondary" size="sm" type="button" disabled={isRegenerating} onClick={regenerate}>
            {isRegenerating ? "Actualizando..." : "Actualizar ahora"}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-3">
          <LoadingBlock label={loadingLabel} />
        </div>
      ) : error ? (
        <div className="mt-3">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : diagnostic ? (
        <Card className="mt-3">
          <p className="text-sm leading-6">{diagnostic.output.answer}</p>

          {diagnostic.output.findings.length ? (
            <div className="mt-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Hallazgos</p>
              <Table
                className="mt-2"
                ariaLabel="Hallazgos del diagnostico"
                columns={[
                  {
                    key: "severity",
                    label: "Severidad",
                    render: (row) => <Badge tone={severityTone[row.severity]}>{row.severity}</Badge>,
                  },
                  { key: "title", label: "Hallazgo" },
                  { key: "evidence", label: "Evidencia" },
                ]}
                rows={diagnostic.output.findings.map((finding, index) => ({ id: String(index), ...finding }))}
              />
            </div>
          ) : null}

          {diagnostic.output.recommendations.length ? (
            <Card className="mt-4" kicker="Recomendación">
              <Table
                ariaLabel="Recomendaciones del diagnostico"
                columns={[
                  { key: "action", label: "Acción" },
                  {
                    key: "priority",
                    label: "Prioridad",
                    render: (row) => priorityLabelsEs[row.priority] ?? row.priority,
                  },
                  { key: "expected_impact", label: "Impacto esperado" },
                  { key: "owner", label: "Responsable" },
                ]}
                rows={diagnostic.output.recommendations.map((rec, index) => ({ id: String(index), ...rec }))}
              />
            </Card>
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

          {diagnostic.output.proposed_writes.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                {diagnostic.output_status === "pending_approval" ? "Propuesta, sin aplicar" : "Propuesta ya revisada"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <Button
                  type="button"
                  disabled={isCreatingTasks || diagnostic.output_status !== "pending_approval"}
                  onClick={createSuggestedTasks}
                >
                  {isCreatingTasks
                    ? "Creando..."
                    : diagnostic.output_status !== "pending_approval"
                      ? "Tareas ya revisadas"
                      : `Crear ${diagnostic.output.proposed_writes.length} ${tasksLabelSingular}(s) sugerida(s)`}
                </Button>
                {tasksFeedback ? <p className="text-sm text-muted">{tasksFeedback}</p> : null}
              </div>
            </div>
          ) : tasksFeedback ? (
            <p className="mt-4 text-sm text-muted">{tasksFeedback}</p>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
