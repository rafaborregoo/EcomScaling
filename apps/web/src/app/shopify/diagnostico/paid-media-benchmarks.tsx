"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EmptyState, Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type PaidMediaBenchmarksRun = {
  organization_id: string;
  disposition: string;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
};

const FACTS = [
  ["paid_media.objective.observed", "Objetivo"],
  ["paid_media.delivery.observed", "Delivery / inversión"],
  ["paid_media.response.observed", "Respuesta media"],
  ["paid_media.traffic.observed", "Tráfico"],
  ["paid_media.post_click.observed", "Post-click"],
  ["paid_media.acquisition.observed", "Adquisición"],
  ["paid_media.revenue.observed", "Revenue"],
  ["paid_media.economics.observed", "Economics"],
  ["paid_media.attribution.observed", "Atribución"],
  ["paid_media.incrementality.observed", "Incrementalidad"],
  ["paid_media.scale.observed", "Escala marginal"],
  ["paid_media.saturation.observed", "Saturación"],
  ["paid_media.creative_fatigue.observed", "Fatiga creativa"],
  ["paid_media.customer_mix.observed", "Mix de cliente"],
  ["paid_media.guardrails.observed", "Guardrails"],
] as const;

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function PaidMediaBenchmarksPanel() {
  const [runs, setRuns] = useState<PaidMediaBenchmarksRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/paid-media-benchmarks")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: PaidMediaBenchmarksRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar Paid Media.");
      });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando benchmarks y guardrails de Paid Media F6.04..." />;

  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const value = (key: string) => facts[key] ?? "UNKNOWN";
  const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;

  return (
    <Card id="insight-paid-media-benchmarks">
      <CardHeader>
        <CardTitle>Benchmarks y guardrails de Paid Media</CardTitle>
        <CardDescription>Descompone la cadena desde spend hasta contribution, separa media efficiency de business efficiency y conserva la diferencia entre atribución e incrementalidad.</CardDescription>
      </CardHeader>
      <CardContent>
        {current ? (
          <Card role="article"><CardContent>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted text-xs">{current.organization_id}</span>
              <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FACTS.map(([key, label]) => {
                const currentValue = value(key);
                return (
                  <Card size="sm" key={key}><CardContent>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span>{label}</span>
                      <span className="font-mono text-muted">{currentValue}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded bg-default-100">
                      <div className={`h-1.5 rounded ${currentValue === "TRUE" ? "bg-success" : currentValue === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: currentValue === "UNKNOWN" ? "22%" : "100%" }} />
                    </div>
                  </CardContent></Card>
                );
              })}
            </div>
            <p className="text-muted mt-3 text-xs">
              Cobertura de Paid Media: {observed}/{FACTS.length}. Los datos de plataforma no demuestran por sí solos rentabilidad, causalidad ni permiso para cambiar presupuesto.
            </p>
            <p className="text-muted mt-2 text-xs">
              {current.selected_instance_id ? "Evaluación trazable preparada." : "Sin evaluación seleccionada: faltan objetivo, contexto, evidencia marginal o incrementalidad suficiente."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}
            </p>
          </CardContent></Card>
        ) : (
          <EmptyState title="Todavía no hay evaluaciones de Paid Media F6.04" />
        )}
      </CardContent>
    </Card>
  );
}
