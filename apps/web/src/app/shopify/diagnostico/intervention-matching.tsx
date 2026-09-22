"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import {
  interventionMatchingViewModel,
  type MatchingRunRow,
} from "./intervention-matching-view-model";

function tone(disposition: string) {
  if (disposition === "MATCHES_AVAILABLE") return "success" as const;
  if (disposition === "NO_MATCHES") return "danger" as const;
  return "warn" as const;
}

function candidateTone(disposition: string) {
  if (disposition === "MATCHED") return "success" as const;
  if (disposition === "NO_CAUSAL_MATCH") return "danger" as const;
  return "warn" as const;
}

export function InterventionMatchingPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<MatchingRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) {
      setRuns([]);
      setError(null);
      return;
    }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-matching?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: MatchingRunRow[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar matching F7.02.");
      });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando matching causal F7.02..." />;
  const model = interventionMatchingViewModel(runs[0]);
  return (
    <Card id="insight-intervention-matching" title="Matching problema · intervención" description="Expone candidatos causalmente plausibles y su cadena de trazabilidad. No prioriza, no selecciona y no ejecuta.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos revisados</span><span>{model.matchedCount} con encaje causal trazable</span></div>
          <Badge tone={tone(model.disposition)}>{model.disposition}</Badge>
        </div>
        {model.candidates.length ? (
          <div className="space-y-2">
            {model.candidates.map((candidate) => (
              <article key={candidate.candidate_id} className="rounded border border-default-200 p-3">
                <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={candidateTone(candidate.disposition)}>{candidate.disposition}</Badge></div>
                <p className="mt-2 text-xs text-muted">{candidate.causal_chain.problem_refs.concat(candidate.causal_chain.mechanism_refs, candidate.causal_chain.lever_refs).join(" · ") || "Cadena causal pendiente."}</p>
                {candidate.supporting_signal_refs.length ? <p className="mt-1 text-xs text-muted">Apoya: {candidate.supporting_signal_refs.join(", ")}</p> : null}
                {candidate.disconfirming_signal_refs.length ? <p className="mt-1 text-xs text-muted">Debilita: {candidate.disconfirming_signal_refs.join(", ")}</p> : null}
                {candidate.unresolved_unknowns.length ? <p className="mt-1 text-xs text-muted">Pendiente: {candidate.unresolved_unknowns.join(", ")}</p> : null}
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-muted">No hay candidatos con matching causal disponible.</p>}
        {model.unknowns.length ? <p className="text-xs text-muted">Evidencia pendiente: {model.unknowns.join(", ")}. No se convierte en selección.</p> : null}
      </div>
    </Card>
  );
}
