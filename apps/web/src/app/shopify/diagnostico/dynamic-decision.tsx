"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";
import { dynamicDecisionTone, dynamicDecisionViewModel, type DynamicDecisionRun } from "./dynamic-decision-view-model";

const list = (items?: string[]) => items?.length ? items.join(" · ") : "No declarado";

export function DynamicDecisionPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<DynamicDecisionRun[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!organizationId) { setRuns([]); setError(null); return; } let cancelled = false; apiFetch(`/v1/consultant/dynamic-decisions?organizationId=${encodeURIComponent(organizationId)}`).then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: DynamicDecisionRun[] }>; }).then((payload) => { if (!cancelled) setRuns(payload.assessments); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar F7.13."); }); return () => { cancelled = true; }; }, [organizationId]);
  if (error) return <ErrorBlock>{error}</ErrorBlock>; if (!runs) return <LoadingBlock label="Cargando decisiones dinámicas F7.13..." />;
  const model = dynamicDecisionViewModel(runs[0]);
  return <Card id="insight-dynamic-decision" title="Decisiones dinámicas" description="Actualiza stop, continue, scale o rollback con outcomes observados. Es una recomendación para el consultor; no monitoriza ni ejecuta cambios automáticamente.">
    <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">{model.unitCount} unidades evaluadas · {model.scaleCount} scale · {model.rollbackCount} rollback</span><Badge tone={model.disposition === "DECISIONS_AVAILABLE" ? "success" : "warn"}>{model.overallDecision}</Badge></div>
      {model.units.length ? <div className="space-y-3">{model.units.map((unit) => <article key={unit.unit_id} className="rounded border border-default-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs">{unit.unit_id}</span><Badge tone={dynamicDecisionTone(unit.decision)}>{unit.decision}</Badge></div><p className="mt-1 text-xs text-muted">Alcance: {unit.decision_scope ?? "UNKNOWN"} · Exposición: {unit.current_exposure_recommendation ?? "UNKNOWN"}</p><p className="mt-2 text-sm">{unit.rationale ?? "Sin razón declarada"}</p>{unit.qualifiers.length ? <p className="mt-1 text-xs text-muted">Cualificadores: {list(unit.qualifiers)}</p> : null}{unit.decision === "SCALE" ? <p className="mt-1 text-xs text-muted">Límite: {unit.scaleLimit}</p> : null}{unit.decision === "ROLLBACK" ? <p className="mt-1 text-xs text-muted">Objetivo de rollback: {unit.rollbackTarget}</p> : null}{unit.fix_forward_alternative ? <p className="mt-1 text-xs text-muted">Fix-forward: {unit.fix_forward_alternative}</p> : null}{unit.nextEvidence.length ? <p className="mt-1 text-xs text-muted">Siguiente evidencia: {list(unit.nextEvidence)}</p> : null}</article>)}</div> : <p className="text-sm text-muted">No hay decisiones disponibles; faltan outcomes o contexto verificable.</p>}
      {model.nextEvidence.length ? <p className="text-xs text-muted"><span className="font-medium">Evidencia pendiente:</span> {list(model.nextEvidence)}</p> : null}{model.unknowns.length ? <p className="text-xs text-muted">Contexto pendiente: {list(model.unknowns)}.</p> : null}<p className="text-xs text-muted">execution_authorized: {String(model.executionAuthorized)} · el consultor decide y ejecuta fuera de este motor.</p>
    </div>
  </Card>;
}
