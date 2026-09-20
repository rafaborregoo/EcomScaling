"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { interventionImpactViewModel, type ImpactRunRow } from "./intervention-impact-view-model";

function tone(disposition: string) { return disposition === "IMPACTS_AVAILABLE" ? "success" as const : disposition === "NO_IMPACT_CANDIDATES" ? "danger" as const : "warn" as const; }
function values(values?: string[]) { return values?.length ? values.join(" · ") : "No declarado"; }

export function InterventionImpactPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<ImpactRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-impact?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: ImpactRunRow[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar impacto esperado F7.04."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando impacto esperado F7.04..." />;
  const model = interventionImpactViewModel(runs[0]);
  return <Card id="insight-intervention-impact" title="Impacto esperado F7.04" description="Traza la expectativa desde la intervención hasta el resultado de negocio. Es cualitativa, no una garantía, forecast, ROI ni autorización de ejecución."><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos evaluados</span>{model.primary ? <span>Principal: <span className="font-mono">{model.primary}</span></span> : <span>Sin principal todavía</span>}</div><Badge tone={tone(model.disposition)}>{model.disposition}</Badge></div>{model.candidates.length ? <div className="space-y-3">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={candidate.disposition === "SUPPORTED_QUALITATIVE" ? "success" : candidate.disposition === "NO_VALID_IMPACT" ? "danger" : "warn"}>{candidate.disposition ?? "UNKNOWN"}</Badge></div><p className="mt-2 text-sm">{candidate.primary_effect ?? "Efecto principal no declarado"}</p><p className="mt-2 text-xs text-muted">Mecanismo → indicador: {values(candidate.impact_trace?.mechanism_refs)} → {values(candidate.impact_trace?.leading_indicator_refs)}</p><p className="text-xs text-muted">KPI → outcome: {values(candidate.impact_trace?.business_outcome_refs)} → {values(candidate.impact_trace?.economic_outcome_refs)}</p><p className="mt-2 text-xs text-muted">Magnitud: {candidate.magnitude_qualitative ?? "UNKNOWN"} · Señal: {candidate.time_to_signal ?? "No declarado"} · Durabilidad: {candidate.durability ?? "UNKNOWN"}</p><p className="mt-2 text-xs text-muted">{[...(candidate.reason_codes ?? []), ...(candidate.unknowns ?? [])].join(" · ") || "Sin motivos adicionales."}</p></article>)}</div> : <p className="text-sm text-muted">Todavía no hay impactos esperados evaluables.</p>}{model.unknowns.length ? <p className="text-xs text-muted">Evidencia pendiente: {model.unknowns.join(", ")}. No se convierte en certeza ni autorización.</p> : null}</div></Card>;
}
