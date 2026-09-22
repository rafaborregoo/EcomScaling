"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { interventionTestExecuteViewModel, type TestExecuteRunRow } from "./intervention-test-execute-view-model";

function tone(mode: string) { return mode === "DO_NOT_PROCEED" ? "danger" as const : ["TEST", "PILOT", "GATHER_EVIDENCE", "WAIT_OBSERVE"].includes(mode) ? "warn" as const : "success" as const; }
function values(values?: string[]) { return values?.length ? values.join(" · ") : "No declarado"; }

export function InterventionTestExecutePanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<TestExecuteRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-test-execute?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: TestExecuteRunRow[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar F7.08."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando decisión test vs ejecución F7.08..." />;
  const model = interventionTestExecuteViewModel(runs[0]);
  return <Card id="insight-intervention-test-execute" title="Experimentar vs ejecutar" description="Decide cualitativamente entre fijar, ejecutar, testear, pilotar, recopilar evidencia, esperar o no proceder. No lanza experimentos ni autoriza cambios."><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos evaluados</span>{model.primary ? <span>Principal: <span className="font-mono">{model.primary}</span></span> : <span>Sin principal todavía</span>}</div><Badge tone={model.disposition === "DECISIONS_AVAILABLE" ? "success" : "warn"}>{model.disposition}</Badge></div>{model.candidates.length ? <div className="space-y-3">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={tone(candidate.recommended_mode ?? "UNKNOWN")}>{candidate.recommended_mode ?? "UNKNOWN"}</Badge></div><p className="mt-2 text-sm">{candidate.candidate_intervention ?? "Intervención no declarada"}</p><p className="mt-2 text-xs text-muted">Hipótesis: {candidate.hypothesis ?? "No declarada"}</p><p className="text-xs text-muted">Pregunta de aprendizaje: {candidate.learning_question ?? "No declarada"}</p><p className="text-xs text-muted">Outcome: {candidate.primary_outcome ?? "No declarado"} · Guardrails: {values(candidate.guardrail_outcomes)}</p><p className="text-xs text-muted">Exposición: {candidate.exposure_mode ?? "No declarada"} · Piloto: {candidate.pilot_scope ?? "No declarado"} · Observación: {candidate.observation_requirement ?? "No declarada"}</p><p className="text-xs text-muted">Después del resultado: {values(candidate.decision_after_result)} · Contaminación: {values(candidate.contamination)}</p><p className="mt-2 text-xs text-muted">{[...(candidate.rationale ?? []), ...(candidate.reason_codes ?? []), ...(candidate.unresolved_unknowns ?? [])].join(" · ") || "Sin motivos adicionales."}</p></article>)}</div> : <p className="text-sm text-muted">Todavía no hay decisiones evaluables.</p>}{model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {model.unknowns.join(", ")}. No se completa por inferencia.</p> : null}</div></Card>;
}
