"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { interventionFeasibilityViewModel, type FeasibilityRunRow } from "./intervention-feasibility-view-model";

function tone(disposition: string) { return disposition === "FEASIBILITY_AVAILABLE" ? "success" as const : disposition === "NO_FEASIBILITY_CANDIDATES" ? "danger" as const : "warn" as const; }
function values(values?: string[]) { return values?.length ? values.join(" · ") : "No declarado"; }

export function InterventionFeasibilityPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<FeasibilityRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-feasibility?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: FeasibilityRunRow[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar factibilidad F7.05."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando factibilidad de recursos F7.05..." />;
  const model = interventionFeasibilityViewModel(runs[0]);
  return <Card id="insight-intervention-feasibility" title="Factibilidad de recursos" description="Separa coste, esfuerzo y capacidad, y muestra el bottleneck o la adaptación necesaria. No es un presupuesto ni autoriza contratación, compra o ejecución."><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos evaluados</span>{model.primary ? <span>Principal: <span className="font-mono">{model.primary}</span></span> : <span>Sin principal todavía</span>}</div><Badge tone={tone(model.disposition)}>{model.disposition}</Badge></div>{model.candidates.length ? <div className="space-y-3">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={candidate.disposition === "FEASIBLE_NOW" ? "success" : candidate.disposition === "NOT_FEASIBLE_NOW" ? "danger" : "warn"}>{candidate.disposition ?? "UNKNOWN"}</Badge></div><p className="mt-2 text-xs text-muted">Recursos requeridos: {values(candidate.resource_trace?.required_resources)} · Disponibles: {values(candidate.resource_trace?.available_resources)}</p><p className="text-xs text-muted">Bottleneck: {values(candidate.resource_trace?.bottleneck_resources)} · Gaps: {values(candidate.resource_trace?.capability_gaps)}</p><p className="mt-2 text-xs text-muted">Coste directo: {candidate.cost_profile?.direct ?? "UNKNOWN"} · Recurrente: {candidate.cost_profile?.recurring ?? "UNKNOWN"} · Esfuerzo: {candidate.effort_profile?.workload ?? "UNKNOWN"}</p>{candidate.adaptations?.length ? <p className="mt-2 text-xs text-muted">Adaptación: {candidate.adaptations.map((item) => item.description).join(" · ")}</p> : null}<p className="mt-2 text-xs text-muted">{[...(candidate.reason_codes ?? []), ...(candidate.unresolved_unknowns ?? [])].join(" · ") || "Sin motivos adicionales."}</p></article>)}</div> : <p className="text-sm text-muted">Todavía no hay factibilidad evaluable.</p>}{model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {model.unknowns.join(", ")}. No se convierte en una capacidad inventada.</p> : null}</div></Card>;
}
