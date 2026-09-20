"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { interventionSequencingViewModel, type SequenceRunRow } from "./intervention-sequencing-view-model";

function tone(disposition: string) { return disposition === "SEQUENCES_AVAILABLE" ? "success" as const : disposition === "NO_SEQUENCE_CANDIDATES" || disposition === "BLOCKED" ? "danger" as const : "warn" as const; }
function values(values?: string[]) { return values?.length ? values.join(" · ") : "No declarado"; }

export function InterventionSequencingPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<SequenceRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) { setRuns([]); setError(null); return; }
    let cancelled = false;
    apiFetch(`/v1/consultant/intervention-sequencing?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: SequenceRunRow[] }>; })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar secuenciación F7.07."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando secuenciación y dependencias F7.07..." />;
  const model = interventionSequencingViewModel(runs[0]);
  return <Card id="insight-intervention-sequencing" title="Secuenciación y dependencias F7.07" description="Explica qué va primero, qué desbloquea, qué gatea el siguiente paso y qué debe esperar. No es un plan de tareas, calendario ni autorización de ejecución."><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 text-xs text-muted"><span>{model.candidateCount} candidatos evaluados</span>{model.primary ? <span>Principal: <span className="font-mono">{model.primary}</span></span> : <span>Sin principal todavía</span>}</div><Badge tone={tone(model.disposition)}>{model.disposition}</Badge></div>{model.candidates.length ? <div className="space-y-3">{model.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs">{candidate.candidate_id}</span><Badge tone={candidate.disposition === "SEQUENCE_READY" ? "success" : candidate.disposition === "BLOCKED" ? "danger" : "warn"}>{candidate.disposition ?? "UNKNOWN"}</Badge></div><p className="mt-2 text-sm">{candidate.strategic_intervention ?? "Intervención estratégica no declarada"}</p><p className="mt-2 text-xs text-muted">NOW: {values(candidate.decision_path?.now)} · THEN: {values(candidate.decision_path?.then)}</p><p className="text-xs text-muted">WHY FIRST: {values(candidate.decision_path?.why_first)}</p><p className="text-xs text-muted">IF: {values(candidate.decision_path?.if_branches)} · IF NOT: {values(candidate.decision_path?.if_not_branches)}</p><p className="text-xs text-muted">Prerequisites: {values(candidate.prerequisites?.map((item) => `${item.dependency_id} (${item.status ?? "UNKNOWN"})`))} · Blockers: {values(candidate.current_blockers)}</p><p className="text-xs text-muted">Parallel: {values(candidate.decision_path?.parallel ?? candidate.parallel_tracks)} · Wait: {values(candidate.decision_path?.wait ?? candidate.wait_conditions)}</p><p className="mt-2 text-xs text-muted">{[...(candidate.reason_codes ?? []), ...(candidate.unresolved_unknowns ?? [])].join(" · ") || "Sin motivos adicionales."}</p></article>)}</div> : <p className="text-sm text-muted">Todavía no hay secuencias evaluables.</p>}{model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {model.unknowns.join(", ")}. No se completa por inferencia.</p> : null}</div></Card>;
}
