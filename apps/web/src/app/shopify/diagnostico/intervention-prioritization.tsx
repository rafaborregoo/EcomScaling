"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { interventionPrioritizationViewModel, type PrioritizationRunRow } from "./intervention-prioritization-view-model";

function tone(disposition: string) {
  return disposition === "PRIORITY_AVAILABLE" ? "success" as const : disposition === "NO_PRIORIZABLE_CANDIDATES" ? "danger" as const : "warn" as const;
}

function candidateTone(tier?: string) {
  if (tier === "NOW") return "success" as const;
  if (tier === "DO_NOT_DO") return "danger" as const;
  return "warn" as const;
}

export function InterventionPrioritizationPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<PrioritizationRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-prioritization?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: PrioritizationRunRow[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar priorización F7.03."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando priorización de intervenciones F7.03..." />;
  const model = interventionPrioritizationViewModel(runs[0]);
  return (
    <Card id="insight-intervention-prioritization" title="Prioridad entre intervenciones F7.03" description="Compara candidatos causalmente encajados sin score arbitrario. Expone una prioridad principal cuando hay dominancia clara; nunca autoriza ejecución.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos comparables</span>{model.primary ? <span>Principal: <span className="font-mono">{model.primary}</span></span> : <span>Sin principal todavía</span>}</div>
          <Badge tone={tone(model.disposition)}>{model.disposition}</Badge>
        </div>
        {model.candidates.length ? <div className="space-y-2">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={candidateTone(candidate.priority_tier)}>{candidate.priority_tier ?? "VALIDATION_REQUIRED"}</Badge></div><p className="mt-2 text-xs text-muted">{[...candidate.reason_codes, ...candidate.unresolved_unknowns].join(" · ") || "Sin motivos adicionales."}</p></article>)}</div> : <p className="text-sm text-muted">Todavía no hay candidatos elegibles y emparejados para comparar.</p>}
        {model.unknowns.length ? <p className="text-xs text-muted">Evidencia pendiente: {model.unknowns.join(", ")}. El motor no la convierte en prioridad.</p> : null}
      </div>
    </Card>
  );
}
