"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type OfferPricingRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: {
    selected_instance?: {
      domain_extension?: {
        offer_pricing?: {
          intervention_family?: string;
          offer_ref?: string;
          primary_metric_ref?: string;
          economic_metric_ref?: string;
          reversible?: boolean;
        };
      };
    } | null;
  };
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function OfferPricingPlaybookPanel() {
  const [runs, setRuns] = useState<OfferPricingRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/offer-pricing")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: OfferPricingRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar oferta y pricing.");
      });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando oferta, pricing y AOV F5.04..." />;

  const current = runs[0];
  const profile = current?.result?.selected_instance?.domain_extension?.offer_pricing;
  const facts = current?.input_envelope?.context?.facts ?? {};
  return (
    <Card
      id="insight-offer-pricing"
      title="Oferta, pricing, merchandising y AOV"
      description="Prioriza contribution y evidencia de catálogo, stock y cesta; no convierte AOV aislado en recomendación de precio."
    >
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <p className="mt-3 text-sm">
            {current.candidate_count
              ? `${current.candidate_count} playbook(s) de oferta evaluado(s).`
              : "No hay templates OFFER_PRICING activos; no se inventa un precio, bundle ni promoción."}
          </p>
          <p className="text-muted mt-2 text-xs">
            AOV: {facts["offer_pricing.economics.aov.available"] ?? "UNKNOWN"}; margen: {facts["offer_pricing.economics.margin.available"] ?? "UNKNOWN"}; stock: {facts["offer_pricing.inventory.available"] ?? "UNKNOWN"}.
          </p>
          <p className="text-muted mt-2 text-xs">
            Elasticidad: {facts["offer_pricing.pricing.elasticity.observed"] ?? "UNKNOWN"}; incrementalidad promocional: {facts["offer_pricing.promotions.incrementality.supported"] ?? "UNKNOWN"}.
          </p>
          {profile ? (
            <p className="text-muted mt-2 text-xs">
              Familia: {profile.intervention_family}; métrica económica: {profile.economic_metric_ref}; reversible: {profile.reversible ? "sí" : "no"}.
            </p>
          ) : null}
          <p className="text-muted mt-2 text-xs">
            {current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar datos y economics."}
            {current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}
          </p>
        </article>
      ) : (
        <p className="text-muted text-sm">Todavía no hay evaluaciones de oferta y pricing.</p>
      )}
    </Card>
  );
}
