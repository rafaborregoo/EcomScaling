"use client";

import { useCachedQuery } from "@/lib/use-cached-query";
import { EmptyState, Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type AcquisitionRun = {
  organization_id: string;
  disposition: string;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
};
const FACTS = [
  ["acquisition.sales.observed", "Ventas observadas"],
  ["acquisition.sample.observed", "Muestra"],
  ["acquisition.new_customer_orders.observed", "Pedidos nuevos"],
  ["acquisition.new_customers.observed", "Clientes nuevos"],
  ["acquisition.cac.observed", "CAC"],
  ["acquisition.spend.observed", "Inversión"],
  ["acquisition.economics.observed", "Economics"],
  ["acquisition.customer_quality.observed", "Calidad cliente"],
  ["acquisition.channel_mix.observed", "Mix de canales"],
  ["acquisition.concentration.observed", "Concentración"],
  ["acquisition.marginal_cac.observed", "CAC marginal"],
  ["acquisition.incrementality.observed", "Incrementalidad"],
  ["acquisition.payback.observed", "Payback"],
  ["acquisition.inventory_constraint.observed", "Inventario"],
  ["acquisition.confidence.observed", "Confianza"],
] as const;
function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function AcquisitionDemandPanel() {
  const { data, error } = useCachedQuery<{ assessments: AcquisitionRun[] }>(
    "/v1/consultant/acquisition-demand",
  );
  const runs = data?.assessments;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs)
    return (
      <LoadingBlock label="Cargando adquisición y generación de demanda F6.03..." />
    );
  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const value = (key: string) => facts[key] ?? "UNKNOWN";
  const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;
  return (
    <Card id="insight-acquisition-demand">
      <CardHeader>
        <CardTitle>Adquisición y generación de demanda</CardTitle>
        <CardDescription>Evalúa clientes nuevos, economics, calidad de cliente, dependencia, eficiencia marginal y restricciones. No confunde tráfico con demanda ni atribución con incrementalidad.</CardDescription>
      </CardHeader>
      <CardContent>
        {current ? (
          <Card role="article"><CardContent>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted text-xs">
                {current.organization_id}
              </span>
              <Badge tone={tone(current.disposition)}>
                {current.disposition}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FACTS.map(([key, label]) => (
                <Card size="sm" key={key}><CardContent>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span>{label}</span>
                    <span className="font-mono text-muted">{value(key)}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded bg-default-100">
                    <div
                      className={`h-1.5 rounded ${value(key) === "TRUE" ? "bg-success" : value(key) === "FALSE" ? "bg-danger" : "bg-muted"}`}
                      style={{ width: value(key) === "UNKNOWN" ? "22%" : "100%" }}
                    />
                  </div>
                </CardContent></Card>
              ))}
            </div>
            <p className="text-muted mt-3 text-xs">
              Cobertura de adquisición: {observed}/{FACTS.length}. Pedidos, margen
              o stock observados no demuestran por sí solos CAC, gasto, canal,
              demanda generada o incrementalidad.
            </p>
            <p className="text-muted mt-2 text-xs">
              {current.selected_instance_id
                ? "Evaluación trazable preparada."
                : "Sin evaluación seleccionada: faltan definiciones, inversión, calidad de cohortes o evidencia incremental suficiente."}
              {current.unresolved_unknowns.length
                ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.`
                : ""}
            </p>
          </CardContent></Card>
        ) : (
          <EmptyState title="Todavía no hay evaluaciones de adquisición" />
        )}
      </CardContent>
    </Card>
  );
}
