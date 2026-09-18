"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type AcquisitionRun = { organization_id: string; disposition: string; selected_instance_id: string | null; unresolved_unknowns: string[]; input_envelope?: { context?: { facts?: Record<string, string> } } };
const FACTS = [
  ["acquisition.sales.observed", "Ventas observadas"], ["acquisition.sample.observed", "Muestra"],
  ["acquisition.new_customer_orders.observed", "Pedidos nuevos"], ["acquisition.new_customers.observed", "Clientes nuevos"],
  ["acquisition.cac.observed", "CAC"], ["acquisition.spend.observed", "Inversión"],
  ["acquisition.economics.observed", "Economics"], ["acquisition.customer_quality.observed", "Calidad cliente"],
  ["acquisition.channel_mix.observed", "Mix de canales"], ["acquisition.concentration.observed", "Concentración"],
  ["acquisition.marginal_cac.observed", "CAC marginal"], ["acquisition.incrementality.observed", "Incrementalidad"],
  ["acquisition.payback.observed", "Payback"], ["acquisition.inventory_constraint.observed", "Inventario"],
  ["acquisition.confidence.observed", "Confianza"],
] as const;
function tone(disposition: string) { if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const; if (disposition === "BLOCKED") return "danger" as const; return "warn" as const; }

export function AcquisitionDemandPanel() {
  const [runs, setRuns] = useState<AcquisitionRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/acquisition-demand").then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: AcquisitionRun[] }>; }).then((payload) => { if (!cancelled) setRuns(payload.assessments); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la evaluación de adquisición."); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando adquisición y generación de demanda F6.03..." />;
  const current = runs[0]; const facts = current?.input_envelope?.context?.facts ?? {}; const value = (key: string) => facts[key] ?? "UNKNOWN"; const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;
  return <Card id="insight-acquisition-demand" title="Adquisición y generación de demanda F6.03" description="Evalúa clientes nuevos, economics, calidad de cliente, dependencia, eficiencia marginal y restricciones. No confunde tráfico con demanda ni atribución con incrementalidad.">{current ? <article className="rounded border border-default-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-muted text-xs">{current.organization_id}</span><Badge tone={tone(current.disposition)}>{current.disposition}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{FACTS.map(([key, label]) => <div key={key} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="font-mono text-muted">{value(key)}</span></div><div className="mt-2 h-1.5 rounded bg-default-100"><div className={`h-1.5 rounded ${value(key) === "TRUE" ? "bg-success" : value(key) === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: value(key) === "UNKNOWN" ? "22%" : "100%" }} /></div></div>)}</div><p className="text-muted mt-3 text-xs">Cobertura de adquisición: {observed}/{FACTS.length}. Pedidos, margen o stock observados no demuestran por sí solos CAC, gasto, canal, demanda generada o incrementalidad.</p><p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Evaluación trazable preparada." : "Sin evaluación seleccionada: faltan definiciones, inversión, calidad de cohortes o evidencia incremental suficiente."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p></article> : <p className="text-muted text-sm">Todavía no hay evaluaciones de adquisición.</p>}</Card>;
}
