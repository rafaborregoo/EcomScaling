"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { maturityRecommendationViewModel, recommendationTone, type MaturityRecommendationRun } from "./maturity-recommendations-view-model";

const values = (items?: string[]) => items?.length ? items.join(" · ") : "No declarado";

export function MaturityRecommendationsPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<MaturityRecommendationRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/maturity-recommendations?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: MaturityRecommendationRun[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la adaptación por madurez F7.10."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando recomendaciones adaptadas por madurez F7.10..." />;
  const model = maturityRecommendationViewModel(runs[0]);
  return <Card id="insight-maturity-recommendations" title="Recomendaciones por madurez" description="Separa lo apropiado ahora de lo que conviene dejar para después. No usa facturación o tooling como proxy de madurez y no autoriza ejecución.">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">{model.candidateCount} candidatos adaptados</span><Badge tone={model.disposition === "MATURITY_RECOMMENDATIONS_AVAILABLE" ? "success" : "warn"}>{model.disposition}</Badge></div>
      {model.candidates.length ? <div className="space-y-3">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><div className="flex gap-2"><Badge tone={recommendationTone(candidate.recommended_mode ?? "UNKNOWN")}>{candidate.recommended_mode ?? "UNKNOWN"}</Badge><Badge tone={candidate.timing_fit === "NOW" ? "success" : "warn"}>{candidate.timing_fit ?? "UNKNOWN"}</Badge></div></div>
        <p className="mt-2 text-sm">{candidate.selected_intervention ?? "Intervención no declarada"}</p>
        <p className="mt-2 text-xs text-muted">Madurez funcional: {candidate.functional_maturity ?? "No observada"} · Complejidad: {candidate.complexity_decision ?? "No evaluada"}</p>
        <p className="mt-2 text-sm"><span className="font-medium">Ahora:</span> {candidate.current_recommendation ?? "No declarado"}</p>
        <p className="text-sm"><span className="font-medium">Después:</span> {candidate.deferred_recommendation ?? "No declarado"}</p>
        {candidate.missing_capability ? <p className="mt-2 text-xs text-muted">Capability previa: {candidate.missing_capability}. {candidate.capability_building_recommendation ?? "Debe construirse antes."}</p> : null}
        {candidate.not_yet_reason ? <p className="mt-2 text-xs text-muted">Todavía no: {candidate.not_yet_reason}</p> : null}
        <p className="mt-2 text-xs text-muted">Desbloquea: {values(candidate.maturity_unlock)} · Evidencia: {candidate.evidence_standard ?? "No declarada"}</p>
      </article>)}</div> : <p className="text-sm text-muted">Todavía no hay recomendaciones adaptadas por madurez.</p>}
      {model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {model.unknowns.join(", ")}. No se completa por inferencia.</p> : null}
    </div>
  </Card>;
}
