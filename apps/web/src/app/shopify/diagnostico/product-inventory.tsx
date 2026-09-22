"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type ProductInventoryRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: { selected_instance?: { domain_extension?: { product_inventory?: { product_inventory_motion?: string; intervention_surface?: string; product_scope?: string } } } | null };
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function ProductInventoryPlaybookPanel() {
  const [runs, setRuns] = useState<ProductInventoryRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/product-inventory")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: ProductInventoryRun[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar producto e inventario."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando producto, catálogo e inventario F5.07..." />;

  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const profile = current?.result?.selected_instance?.domain_extension?.product_inventory;
  const value = (key: string) => facts[key] ?? "UNKNOWN";
  return (
    <Card id="insight-product-inventory" title="Producto, catálogo e inventario" description="Separa catálogo, disponibilidad, demanda y reposición; no convierte un stockout en una compra automática ni el stock absoluto en overstock.">
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <p className="mt-3 text-sm">{current.candidate_count ? `${current.candidate_count} playbook(s) de producto/inventario evaluado(s).` : "No hay templates PRODUCT_INVENTORY activos; no se inventa reposición, forecast ni racionalización."}</p>
          <p className="text-muted mt-2 text-xs">Catálogo: {value("product_inventory.catalog.available")}; variantes: {value("product_inventory.variants.available")}; snapshot de inventario: {value("product_inventory.inventory.snapshot_available")}; stock bajo: {value("product_inventory.stock.low_observed")}; stockout: {value("product_inventory.stockout.observed")}.</p>
          <p className="text-muted mt-2 text-xs">Demanda/velocidad: {value("product_inventory.demand.observed")}/{value("product_inventory.demand.velocity_observed")}; economics: {value("product_inventory.economics.available")}; replenishment: {value("product_inventory.replenishment.observed")}; forecast: {value("product_inventory.forecast.observed")}; supplier: {value("product_inventory.supplier.observed")}.</p>
          <p className="text-muted mt-2 text-xs">Overstock: {value("product_inventory.overstock.observed")}; calidad: {value("product_inventory.quality.observed")}; precisión de inventario: {value("product_inventory.inventory_accuracy.observed")}; demand/supply: {value("product_inventory.demand_supply.alignment")}.</p>
          {profile ? <p className="text-muted mt-2 text-xs">Movimiento: {profile.product_inventory_motion}; superficie: {profile.intervention_surface}; scope: {profile.product_scope}.</p> : null}
          <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar disponibilidad, demanda, reposición y economics."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
        </article>
      ) : <p className="text-muted text-sm">Todavía no hay evaluaciones de producto e inventario.</p>}
    </Card>
  );
}
