"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { constraintRecommendationViewModel, recommendationTone, type ConstraintRecommendationRun } from "./constraint-recommendations-view-model";

const values = (items?: string[]) => items?.length ? items.join(" · ") : "No declarado";

export function ConstraintRecommendationsPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<ConstraintRecommendationRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/constraint-recommendations?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: ConstraintRecommendationRun[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las recomendaciones bajo restricciones F7.11."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando recomendaciones bajo restricciones F7.11..." />;
  const model = constraintRecommendationViewModel(runs[0]);
  return <Card id="insight-constraint-recommendations" title="Recomendaciones bajo restricciones" description="Distingue la mejor acción factible de la ideal, explicando el límite vinculante y sin asignar recursos ni ejecutar cambios.">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">{model.candidateCount} candidatos adaptados</span><Badge tone={model.disposition === "CONSTRAINT_RECOMMENDATIONS_AVAILABLE" ? "success" : "warn"}>{model.disposition}</Badge></div>
      {model.candidates.length ? <div className="space-y-3">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><div className="flex gap-2"><Badge tone={recommendationTone(candidate.recommended_mode ?? "UNKNOWN")}>{candidate.recommended_mode ?? "UNKNOWN"}</Badge><Badge tone={candidate.timing_fit === "NOW" ? "success" : "warn"}>{candidate.timing_fit ?? "UNKNOWN"}</Badge></div></div>
        <p className="mt-2 text-sm">{candidate.desired_intervention ?? "Intervención no declarada"}</p>
        <p className="mt-2 text-xs text-muted">Constraint vinculante: {candidate.criticalConstraint} · Factibilidad: {candidate.feasibility_disposition ?? "No evaluada"}</p>
        <p className="mt-2 text-sm"><span className="font-medium">Mejor acción factible:</span> {candidate.bestFeasible}</p>
        {candidate.minimum_viable_intervention ? <p className="text-sm"><span className="font-medium">Mínimo viable:</span> {candidate.minimum_viable_intervention}</p> : null}
        {candidate.alternative_mechanism ? <p className="text-sm"><span className="font-medium">Mecanismo alternativo:</span> {candidate.alternative_mechanism}</p> : null}
        {candidate.enabling_recommendation ? <p className="text-sm"><span className="font-medium">Habilitador:</span> {candidate.enabling_recommendation}</p> : null}
        <p className="mt-2 text-sm"><span className="font-medium">Diferido:</span> {candidate.deferredAction}</p>
        <p className="text-xs text-muted">Activación: {candidate.activation_trigger ?? "No declarada"} · Siguiente constraint: {candidate.nextConstraint}</p>
        <p className="mt-2 text-xs text-muted">Outcome ajustado: {candidate.expected_outcome_adjustment ?? "No declarado"} · Confianza de factibilidad: {candidate.feasibility_confidence ?? "No declarada"}</p>
        <p className="mt-2 text-xs text-muted">Razonamiento: {values(candidate.rationale)}</p>
      </article>)}</div> : <p className="text-sm text-muted">Todavía no hay recomendaciones bajo restricciones.</p>}
      {model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {model.unknowns.join(", ")}. No se completa por inferencia.</p> : null}
    </div>
  </Card>;
}
