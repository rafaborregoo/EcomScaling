"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import {
  interventionEligibilityViewModel,
  type EligibilityRunRow,
} from "./intervention-eligibility-view-model";

function tone(disposition: string) {
  if (disposition === "CANDIDATES_AVAILABLE") return "success" as const;
  if (disposition === "NO_ELIGIBLE_CANDIDATES") return "danger" as const;
  return "warn" as const;
}

function candidateTone(disposition: string) {
  if (disposition === "ELIGIBLE_NOW") return "success" as const;
  if (["BLOCKED_BY_CONSTRAINT", "NOT_APPROPRIATE"].includes(disposition)) return "danger" as const;
  return "warn" as const;
}

export function InterventionEligibilityPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<EligibilityRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) {
      setRuns([]);
      setError(null);
      return;
    }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-eligibility?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: EligibilityRunRow[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar elegibilidad F7.01."); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando elegibilidad de intervenciones F7.01..." />;
  const model = interventionEligibilityViewModel(runs[0]);
  return (
    <Card id="insight-intervention-eligibility" title="Elegibilidad de intervenciones" description="Filtra qué candidatos pueden pasar a comparación. No prioriza, no elige y no ejecuta.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos evaluados</span><span>{model.eligibleCount} elegibles para la siguiente etapa</span></div>
          <Badge tone={tone(model.disposition)}>{model.disposition}</Badge>
        </div>
        {model.candidates.length ? (
          <div className="space-y-2">
            {model.candidates.map((candidate) => (
              <article key={candidate.candidate_id} className="rounded border border-default-200 p-3">
                <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={candidateTone(candidate.disposition)}>{candidate.disposition}</Badge></div>
                <p className="mt-2 text-xs text-muted">{[...candidate.blockers, ...candidate.conditions, ...candidate.unresolved_unknowns, ...candidate.reason_codes].join(" · ") || "Sin condiciones adicionales declaradas."}</p>
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-muted">No hay intervenciones activas en el catálogo para evaluar.</p>}
        {model.unknowns.length ? <p className="text-xs text-muted">Evidencia pendiente: {model.unknowns.join(", ")}. No se convierte en permiso de acción.</p> : null}
      </div>
    </Card>
  );
}
