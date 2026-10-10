"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { Badge, Button, Card, ErrorBlock, LoadingBlock, toast } from "@/components/ui";

type EvaluationStatus = { status: string; evaluated_at: string | null } | null;
type ReleaseCandidate = {
  id: string;
  code: string;
  name: string;
  version: string;
  model: string;
  is_active: boolean;
  evaluations: { offline: EvaluationStatus; live: EvaluationStatus };
  judge_calibration: { status: string; dataset_version: string; evaluated_at: string | null } | null;
  can_promote: boolean;
};

export function AgentReleaseGatePanel() {
  const { data, error, isLoading, reload } = useCachedQuery<{ candidates: ReleaseCandidate[] }>(
    "/v1/admin/agent-release-candidates",
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function evaluateOffline(candidate: ReleaseCandidate) {
    setBusy(candidate.id);
    try {
      const response = await apiFetch(
        `/v1/admin/agent-release-candidates/${candidate.id}/evaluate-offline`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(`Evaluación offline terminada para ${candidate.name} ${candidate.version}.`);
      reload();
    } catch {
      toast.danger("No se pudo ejecutar la evaluación offline.");
    } finally {
      setBusy(null);
    }
  }

  async function promote(candidate: ReleaseCandidate) {
    if (!candidate.can_promote || candidate.is_active) return;
    if (!window.confirm(`¿Activar ${candidate.name} ${candidate.version}?`)) return;
    setBusy(candidate.id);
    try {
      const response = await apiFetch(
        `/v1/admin/agent-release-candidates/${candidate.id}/promote`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(`${candidate.name} ${candidate.version} está activa.`);
      reload();
    } catch {
      toast.danger("No se pudo activar la versión. La versión actual se conserva.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      kicker="Calidad y despliegue"
      title="Versiones candidatas"
      description="La activación exige una suite real de la versión candidata y una calibración aprobada del juez. La base de datos aplica ambos bloqueos."
    >
      {isLoading ? <LoadingBlock label="Cargando versiones…" /> : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {!isLoading && !error && (data?.candidates.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">No hay versiones registradas en el catálogo activo.</p>
      ) : null}
      <ul className="grid gap-3">
        {(data?.candidates ?? []).map((candidate) => {
          const offlinePassed = candidate.evaluations.offline?.status === "passed";
          const livePassed = candidate.evaluations.live?.status === "passed";
          return (
            <li key={candidate.id} className="flex flex-col gap-3 rounded-lg border border-separator p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{candidate.name} · {candidate.version}</p>
                  <p className="mt-1 truncate font-mono text-xs text-muted">{candidate.code} · {candidate.model}</p>
                </div>
                <Badge tone={candidate.is_active ? "success" : "neutral"}>
                  {candidate.is_active ? "Activa" : "Candidata"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={offlinePassed ? "success" : "neutral"}>
                  Offline: {candidate.evaluations.offline?.status ?? "pendiente"}
                </Badge>
                <Badge tone={livePassed ? "success" : "neutral"}>
                  Live: {candidate.evaluations.live?.status ?? "pendiente"}
                </Badge>
                <Badge tone={candidate.judge_calibration ? "success" : "neutral"}>
                  Juez: {candidate.judge_calibration ? `aprobado · ${candidate.judge_calibration.dataset_version}` : "sin calibrar"}
                </Badge>
              </div>
              {candidate.evaluations.offline?.status === "incomplete"
                || candidate.evaluations.live?.status === "incomplete" ? (
                <p className="text-xs text-muted">
                  Las pruebas incompletas no habilitan la activación. Se necesita ejecutar esta versión y superar la suite adjudicada: 10 casos gold y 3 holdout por agente.
                </p>
              ) : null}
              {!candidate.is_active ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void evaluateOffline(candidate)}
                  >
                    {busy === candidate.id ? "Ejecutando…" : "Evaluar offline"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy !== null || !candidate.can_promote}
                    onClick={() => void promote(candidate)}
                  >
                    Activar versión
                  </Button>
                  {!livePassed || !candidate.judge_calibration ? (
                    <span className="text-xs text-muted">Falta completar la suite live del candidato y la calibración aprobada del juez.</span>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
