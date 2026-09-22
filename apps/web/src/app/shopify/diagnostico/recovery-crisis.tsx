"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type RecoveryRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: { selected_instance?: { domain_extension?: { recovery_crisis?: { recovery_motion?: string; crisis_scope?: string; affected_domain_refs?: string[] } } | null } | null };
};

const FACTS = [
  ["recovery_crisis.sources.available", "Fuentes disponibles"],
  ["recovery_crisis.demand.observed", "Demanda observada"],
  ["recovery_crisis.throughput.observed", "Throughput observado"],
  ["recovery_crisis.measurement_confidence.observed", "Confianza de medición"],
  ["recovery_crisis.crisis_state.observed", "Estado de crisis"],
  ["recovery_crisis.severity.observed", "Severidad"],
  ["recovery_crisis.blast_radius.observed", "Blast radius"],
  ["recovery_crisis.recovery_baseline.observed", "Baseline de recovery"],
] as const;

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function RecoveryCrisisPlaybookPanel() {
  const [runs, setRuns] = useState<RecoveryRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/recovery-crisis").then(async (response) => {
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json() as Promise<{ assessments: RecoveryRun[] }>;
    }).then((payload) => { if (!cancelled) setRuns(payload.assessments); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar recovery y crisis."); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando triage, containment y recovery F5.11..." />;
  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const value = (key: string) => facts[key] ?? "UNKNOWN";
  const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;
  const profile = current?.result?.selected_instance?.domain_extension?.recovery_crisis;
  return <Card id="insight-recovery-crisis" title="Recovery, crisis y continuidad" description="Distingue deterioro normal, incidente y crisis; prioriza contener, estabilizar y recuperar antes de volver a optimizar.">
    {current ? <article className="rounded border border-default-200 p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-muted text-xs">{current.organization_id}</span><Badge tone={tone(current.disposition)}>{current.disposition}</Badge></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{FACTS.map(([key, label]) => { const fact = value(key); return <div key={key} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="font-mono text-muted">{fact}</span></div><div className="mt-2 h-1.5 rounded bg-default-100"><div className={`h-1.5 rounded ${fact === "TRUE" ? "bg-success" : fact === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: fact === "UNKNOWN" ? "22%" : "100%" }} /></div></div>; })}</div>
      <p className="text-muted mt-3 text-xs">Cobertura de señales: {observed}/{FACTS.length}. No se declara una crisis por un KPI aislado ni se inventan severidad o blast radius.</p>
      {profile ? <p className="text-muted mt-2 text-xs">Movimiento: {profile.recovery_motion}; alcance: {profile.crisis_scope}; dominios afectados: {profile.affected_domain_refs?.join(", ") || "pendiente"}.</p> : null}
      <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: falta contexto fiable de incidente, alcance, severidad o baseline de recuperación."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
    </article> : <p className="text-muted text-sm">Todavía no hay evaluaciones de recovery y crisis.</p>}
  </Card>;
}
