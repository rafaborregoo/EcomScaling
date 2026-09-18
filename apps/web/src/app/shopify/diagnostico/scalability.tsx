"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type ScalabilityRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: { selected_instance?: { domain_extension?: { scalability?: { scalability_motion?: string; constraint_ref?: string; scale_scope?: string; headroom_state?: string } } | null } | null };
};

const FACTS = [
  ["scalability.demand.observed", "Demanda observada"],
  ["scalability.throughput.observed", "Throughput observado"],
  ["scalability.economics.observed", "Economics observados"],
  ["scalability.inventory_readiness.observed", "Readiness de stock"],
  ["scalability.operational_readiness.observed", "Readiness operativo"],
  ["scalability.capacity.observed", "Capacidad real"],
  ["scalability.headroom.observed", "Headroom"],
  ["scalability.constraint.observed", "Constraint actual"],
] as const;

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

function factTone(value: string | undefined) {
  return value === "TRUE" ? "bg-success" : value === "FALSE" ? "bg-danger" : "bg-muted";
}

export function ScalabilityPlaybookPanel() {
  const [runs, setRuns] = useState<ScalabilityRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/scalability")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: ScalabilityRun[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar escalabilidad."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando constraints, capacidad y readiness F5.10..." />;

  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const profile = current?.result?.selected_instance?.domain_extension?.scalability;
  const value = (key: string) => facts[key] ?? "UNKNOWN";
  const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;

  return (
    <Card id="insight-scalability" title="Escalabilidad y constraints F5.10" description="Localiza la restricción que limita el sistema y exige evidencia de capacidad, headroom, economics y resiliencia antes de escalar.">
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FACTS.map(([key, label]) => {
              const fact = value(key);
              return <div key={key} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="font-mono text-muted">{fact}</span></div><div className="mt-2 h-1.5 rounded bg-default-100"><div className={`h-1.5 rounded ${factTone(fact)}`} style={{ width: fact === "UNKNOWN" ? "22%" : "100%" }} /></div></div>;
            })}
          </div>
          <p className="text-muted mt-3 text-xs">Cobertura de señales: {observed}/{FACTS.length}. Capacidad y headroom no se infieren del volumen actual.</p>
          {profile ? <p className="text-muted mt-2 text-xs">Movimiento: {profile.scalability_motion}; constraint: {profile.constraint_ref}; scope: {profile.scale_scope}; headroom declarado: {profile.headroom_state ?? "UNKNOWN"}.</p> : null}
          <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar el constraint, capacidad, headroom y economics marginales."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
        </article>
      ) : <p className="text-muted text-sm">Todavía no hay evaluaciones de escalabilidad.</p>}
    </Card>
  );
}
