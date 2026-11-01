"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { portfolioRoleTone, recommendationPortfolioViewModel, type RecommendationPortfolioRun } from "./recommendation-portfolio-view-model";

const values = (items?: string[]) => items?.length ? items.join(" · ") : "No declarado";

export function RecommendationPortfolioPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<RecommendationPortfolioRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/recommendation-portfolio?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: RecommendationPortfolioRun[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el portafolio F7.12."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando portafolio de recomendaciones F7.12..." />;
  const model = recommendationPortfolioViewModel(runs[0]);
  return <Card id="insight-recommendation-portfolio">
    <CardHeader>
      <CardTitle>Portafolio de recomendaciones</CardTitle>
      <CardDescription>Selecciona una cartera mínima y coherente alrededor de una prioridad, conserva los diferidos y deja explícitas las exclusiones. No asigna recursos ni ejecuta cambios.</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">{model.candidateCount} candidatos evaluados</span><Badge tone={model.disposition === "PORTFOLIO_AVAILABLE" ? "success" : "warn"}>{model.disposition}</Badge></div>
        <div className="grid gap-3 md:grid-cols-3"><div><p className="text-xs text-muted">Primary</p><p className="font-mono text-sm">{model.primaryCandidateId ?? "No declarada"}</p></div><div><p className="text-xs text-muted">Factibilidad agregada</p><p className="text-sm">{model.portfolioFeasibility}</p></div><div><p className="text-xs text-muted">Riesgo de cartera</p><p className="text-sm">{model.portfolioRisk}</p></div></div>
        <p className="text-sm">{model.narrative}</p>
        {model.activeCandidates.length ? <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Cartera activa</p><div className="space-y-2">{model.activeCandidates.map((candidate) => <Card size="sm" key={candidate.candidate_id} role="article"><CardContent><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={portfolioRoleTone(candidate.role ?? "UNKNOWN")}>{candidate.role ?? "UNKNOWN"}</Badge></div><p className="mt-1 text-sm">{candidate.intervention ?? "Intervención no declarada"}</p><p className="mt-1 text-xs text-muted">{candidate.role_reason ?? "Sin razón declarada"} · {candidate.sequence_position ?? "UNKNOWN"}</p></CardContent></Card>)}</div></div> : null}
        {model.deferredCandidates.length ? <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Diferidos</p><p className="text-sm text-muted">{model.deferredCandidates.map((candidate) => `${candidate.candidate_id}: ${candidate.role_reason ?? "válida pero no ahora"}`).join(" · ")}</p></div> : null}
        {model.excludedCandidates.length ? <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Exclusiones explícitas</p><p className="text-sm text-muted">{model.excludedCandidates.map((candidate) => candidate.candidate_id).join(" · ")}</p></div> : null}
        {model.sequence.length ? <p className="text-xs text-muted"><span className="font-medium">Secuencia:</span> {values(model.sequence)}</p> : null}
        {model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {model.unknowns.join(", ")}. No se completa por inferencia.</p> : null}
      </div>
    </CardContent>
  </Card>;
}
