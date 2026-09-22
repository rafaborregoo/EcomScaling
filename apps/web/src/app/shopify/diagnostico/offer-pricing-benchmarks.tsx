"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type Run = { organization_id: string; disposition: string; selected_instance_id: string | null; unresolved_unknowns: string[]; input_envelope?: { context?: { facts?: Record<string, string> } } };
const FACTS = [
  ["offer_pricing_benchmarks.offer_context.observed", "Oferta"], ["offer_pricing_benchmarks.pricing.observed", "Pricing"],
  ["offer_pricing_benchmarks.aov.observed", "AOV"], ["offer_pricing_benchmarks.upt.observed", "UPT"], ["offer_pricing_benchmarks.asp.observed", "ASP"],
  ["offer_pricing_benchmarks.funnel.observed", "CVR / funnel"], ["offer_pricing_benchmarks.economics.observed", "Economics"],
  ["offer_pricing_benchmarks.contribution_per_order.observed", "Contribution / pedido"], ["offer_pricing_benchmarks.contribution_per_session.observed", "Contribution / sesión"],
  ["offer_pricing_benchmarks.product_mix.observed", "Product mix"], ["offer_pricing_benchmarks.promotions.observed", "Promociones"],
  ["offer_pricing_benchmarks.returns.observed", "Returns"], ["offer_pricing_benchmarks.inventory.observed", "Inventario"], ["offer_pricing_benchmarks.merchandising.observed", "Merchandising"],
  ["offer_pricing_benchmarks.customer_quality.observed", "Customer quality"], ["offer_pricing_benchmarks.incrementality.observed", "Incrementalidad"],
  ["offer_pricing_benchmarks.pricing_elasticity.observed", "Elasticidad"], ["offer_pricing_benchmarks.guardrails.observed", "Guardrails"],
] as const;
function tone(disposition: string) { return disposition === "READY_FOR_RECOMMENDATION" ? "success" as const : disposition === "BLOCKED" ? "danger" as const : "warn" as const; }

export function OfferPricingBenchmarksPanel() {
  const [runs, setRuns] = useState<Run[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; apiFetch("/v1/consultant/offer-pricing-benchmarks").then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: Run[] }>; }).then((payload) => { if (!cancelled) setRuns(payload.assessments); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar oferta y pricing F6.06."); }); return () => { cancelled = true; }; }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>; if (!runs) return <LoadingBlock label="Cargando benchmarks de oferta, pricing y AOV F6.06..." />;
  const current = runs[0]; const facts = current?.input_envelope?.context?.facts ?? {}; const value = (key: string) => facts[key] ?? "UNKNOWN"; const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;
  return <Card id="insight-offer-pricing-benchmarks" title="Benchmarks y guardrails de oferta / pricing" description="Descompone AOV en evidencia comercial y económica, separa precio, mix, promociones y merchandising, y no optimiza el ticket de forma aislada.">{current ? <article className="rounded border border-default-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-muted text-xs">{current.organization_id}</span><Badge tone={tone(current.disposition)}>{current.disposition}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{FACTS.map(([key, label]) => { const currentValue = value(key); return <div key={key} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="font-mono text-muted">{currentValue}</span></div><div className="mt-2 h-1.5 rounded bg-default-100"><div className={`h-1.5 rounded ${currentValue === "TRUE" ? "bg-success" : currentValue === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: currentValue === "UNKNOWN" ? "22%" : "100%" }} /></div></div>; })}</div><p className="text-muted mt-3 text-xs">Cobertura de oferta / pricing: {observed}/{FACTS.length}. AOV alto no equivale a profit, promoción usada no equivale a incrementalidad y una mejora de mix no demuestra elasticidad.</p><p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Evaluación trazable preparada." : "Sin evaluación seleccionada: faltan definiciones, economics o contexto comercial suficiente."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p></article> : <p className="text-muted text-sm">Todavía no hay evaluaciones de oferta / pricing F6.06.</p>}</Card>;
}
