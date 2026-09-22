"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type MeasurementExperimentationRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: {
    selected_instance?: {
      domain_extension?: {
        measurement_experimentation?: {
          measurement_motion?: string;
          measurement_surface?: string;
          data_scope?: string;
          quality_state?: string;
          experiment_mode?: string;
          primary_outcome_ref?: string;
        };
      } | null;
    } | null;
  };
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function MeasurementExperimentationPlaybookPanel() {
  const [runs, setRuns] = useState<MeasurementExperimentationRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/measurement-experimentation")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: MeasurementExperimentationRun[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar datos y experimentación."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando datos, tracking y experimentación F5.09..." />;

  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const profile = current?.result?.selected_instance?.domain_extension?.measurement_experimentation;
  const value = (key: string) => facts[key] ?? "UNKNOWN";

  return (
    <Card id="insight-measurement-experimentation" title="Datos, tracking y experimentación" description="Valida definición, cobertura y fuentes antes de optimizar; no confunde atribución con causalidad ni una señal de funnel con tracking fiable.">
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <p className="mt-3 text-sm">{current.candidate_count ? `${current.candidate_count} playbook(s) de medición evaluado(s).` : "No hay templates MEASUREMENT_EXPERIMENTATION activos; no se inventa calidad ni se propone un experimento por defecto."}</p>
          <p className="text-muted mt-2 text-xs">Datos: {value("measurement.data.available")}; pedidos: {value("measurement.orders.observed")}; sesiones: {value("measurement.sessions.observed")}; pasos del funnel: {value("measurement.funnel.steps_observed")}; baseline diario: {value("measurement.baseline.observed")}.</p>
          <p className="text-muted mt-2 text-xs">Reconciliación: {value("measurement.reconciliation.observed")}; completitud: {value("measurement.data_quality.completeness_observed")}; consistencia: {value("measurement.data_quality.consistency_observed")}; freshness: {value("measurement.data_quality.freshness_observed")}; lineage: {value("measurement.data_quality.lineage_observed")}.</p>
          <p className="text-muted mt-2 text-xs">Semántica de eventos: {value("measurement.tracking.event_semantics_observed")}; identidad: {value("measurement.identity.observed")}; atribución: {value("measurement.attribution.observed")}; evidencia causal: {value("measurement.causal_evidence.observed")}; capacidad experimental: {value("measurement.experimentation.capability_observed")}.</p>
          {profile ? <p className="text-muted mt-2 text-xs">Movimiento: {profile.measurement_motion}; superficie: {profile.measurement_surface}; scope: {profile.data_scope}; quality: {profile.quality_state ?? "UNKNOWN"}; modo: {profile.experiment_mode ?? "NO_EXPERIMENT"}; primary outcome: {profile.primary_outcome_ref ?? "pendiente"}.</p> : null}
          <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar definición, fuente, calidad y diseño causal."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
        </article>
      ) : <p className="text-muted text-sm">Todavía no hay evaluaciones de datos y experimentación.</p>}
    </Card>
  );
}
