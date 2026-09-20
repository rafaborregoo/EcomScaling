"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { interventionRiskViewModel, type RiskRunRow } from "./intervention-risk-view-model";

function tone(disposition: string) { return disposition === "RISK_ASSESSMENTS_AVAILABLE" ? "success" as const : disposition === "NO_RISK_CANDIDATES" || disposition === "DO_NOT_PROCEED" ? "danger" as const : "warn" as const; }
function values(values?: string[]) { return values?.length ? values.join(" · ") : "No declarado"; }

export function InterventionRiskPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<RiskRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-risk?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: RiskRunRow[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar riesgo F7.06."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando riesgo y reversibilidad F7.06..." />;
  const model = interventionRiskViewModel(runs[0]);
  return <Card id="insight-intervention-risk" title="Riesgo y reversibilidad F7.06" description="Separa upside, downside, exposición, reversibilidad, guardrails y coste del error. No calcula un risk score ni autoriza ejecución."><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos evaluados</span>{model.primary ? <span>Principal: <span className="font-mono">{model.primary}</span></span> : <span>Sin principal todavía</span>}</div><Badge tone={tone(model.disposition)}>{model.disposition}</Badge></div>{model.candidates.length ? <div className="space-y-3">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={candidate.disposition === "RISK_ACCEPTABLE_WITH_GUARDRAILS" ? "success" : candidate.disposition === "DO_NOT_PROCEED" ? "danger" : "warn"}>{candidate.disposition ?? "UNKNOWN"}</Badge></div><p className="mt-2 text-xs text-muted">Exposición: {values(candidate.blast_radius?.scope)} · Alcance: {candidate.blast_radius?.level ?? "UNKNOWN"}</p><p className="text-xs text-muted">Reversibilidad: {candidate.reversibility_profile?.can_revert ?? "UNKNOWN"} · Revertir: {candidate.reversibility_profile?.reversal_delay ?? "unknown"} · Coste: {candidate.reversibility_profile?.reversal_cost ?? "unknown"}</p><p className="text-xs text-muted">Coste del error: {candidate.cost_of_error?.severity ?? "UNKNOWN"} · Fallo: {candidate.cost_of_error?.failure ?? "UNKNOWN"} · Rollback: {candidate.cost_of_error?.rollback ?? "UNKNOWN"}</p><p className="mt-2 text-xs text-muted">Fallos posibles: {values(candidate.failure_modes)} </p><p className="text-xs text-muted">Mitigaciones: {values(candidate.de_risking_actions ?? candidate.risk_trace?.de_risking)}</p><p className="mt-2 text-xs text-muted">{[...(candidate.reason_codes ?? []), ...(candidate.unresolved_unknowns ?? [])].join(" · ") || "Sin motivos adicionales."}</p></article>)}</div> : <p className="text-sm text-muted">Todavía no hay evaluaciones de riesgo.</p>}{model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {model.unknowns.join(", ")}. No se completa por inferencia.</p> : null}</div></Card>;
}
