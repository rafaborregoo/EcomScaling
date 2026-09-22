"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type ConversionCroRun = {
  organization_id: string;
  disposition: string;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
};

const FACTS = [
  ["conversion_cro.definition.observed", "Definición de conversión"],
  ["conversion_cro.funnel.observed", "Funnel"],
  ["conversion_cro.sessions.observed", "Sesiones"],
  ["conversion_cro.product_views.observed", "Product views"],
  ["conversion_cro.add_to_cart.observed", "Add to cart"],
  ["conversion_cro.checkout.observed", "Checkout"],
  ["conversion_cro.purchase.observed", "Purchase"],
  ["conversion_cro.mix.observed", "Mix / segmentos"],
  ["conversion_cro.economics.observed", "Economics"],
  ["conversion_cro.aov.observed", "AOV"],
  ["conversion_cro.contribution_per_session.observed", "Contribution / sesión"],
  ["conversion_cro.returns.observed", "Returns"],
  ["conversion_cro.technical.observed", "Fricción técnica"],
  ["conversion_cro.offer.observed", "Oferta / pricing"],
  ["conversion_cro.experiments.observed", "Experimentos"],
  ["conversion_cro.guardrails.observed", "Guardrails"],
] as const;

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function ConversionCroBenchmarksPanel() {
  const [runs, setRuns] = useState<ConversionCroRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/conversion-cro-benchmarks")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: ConversionCroRun[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar Conversión / CRO."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando benchmarks y guardrails de conversión F6.05..." />;

  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const value = (key: string) => facts[key] ?? "UNKNOWN";
  const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;

  return (
    <Card
      id="insight-conversion-cro-benchmarks"
      title="Benchmarks y guardrails de conversión / CRO"
      description="Valida el denominador, controla el mix, descompone el funnel y separa fricción observable de hipótesis, oportunidad económica y experimento."
    >
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FACTS.map(([key, label]) => {
              const currentValue = value(key);
              return (
                <div key={key} className="rounded border border-default-200 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span>{label}</span>
                    <span className="font-mono text-muted">{currentValue}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded bg-default-100">
                    <div className={`h-1.5 rounded ${currentValue === "TRUE" ? "bg-success" : currentValue === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: currentValue === "UNKNOWN" ? "22%" : "100%" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-muted mt-3 text-xs">Cobertura CRO: {observed}/{FACTS.length}. La tasa por sí sola no identifica una fuga ni demuestra recuperabilidad económica.</p>
          <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Evaluación trazable preparada." : "Sin evaluación seleccionada: faltan definiciones, contexto, evidencia o guardrails suficientes."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
        </article>
      ) : <p className="text-muted text-sm">Todavía no hay evaluaciones de conversión / CRO F6.05.</p>}
    </Card>
  );
}
