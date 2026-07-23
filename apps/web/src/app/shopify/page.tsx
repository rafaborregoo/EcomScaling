"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { useShopifyOverview } from "@/hooks/use-shopify-overview";
import { Button, Input } from "@ecomscaling/ui";

type ShopifyMetrics = {
  organization_id: string;
  selected_connection_id: string | null;
  store_id: string | null;
  period: { days: number | "all"; start: string | null; end: string };
  sales: {
    orders_count: number;
    gross_sales: number;
    net_sales: number;
    discounts: number;
    refunds: number;
    units_sold: number;
    aov: number;
  };
  top_products: Array<{
    product_id: string;
    title: string;
    quantity_sold: number;
    revenue: number;
  }>;
  stock: {
    tracked_items: number;
    total_available: number;
    low_stock_items: number;
    out_of_stock_items: number;
  };
  margin: {
    revenue: number;
    cogs: number;
    gross_margin: number;
    margin_pct: number;
    items_with_cost: number;
    items_without_cost: number;
  };
};

const periodOptions: Array<{ days: number | "all"; label: string }> = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
  { days: "all", label: "Todo" },
];

function formatMoney(value: number | null | undefined, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function ShopifyBusinessView({ bootstrap, token }: { bootstrap: BootstrapResponse; token: string }) {
  const { organizationId: selectedOrganizationId, setOrganizationId: setSelectedOrganizationId } =
    useActiveOrganization();
  const { connectionId: selectedConnectionId, setConnectionId: setSelectedConnectionId } = useActiveConnection();
  const [hasAppliedUrlSelection, setHasAppliedUrlSelection] = useState(false);
  const [metrics, setMetrics] = useState<ShopifyMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number | "all">(30);
  const [costSku, setCostSku] = useState("");
  const [costUnitCost, setCostUnitCost] = useState("");
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [costFeedback, setCostFeedback] = useState<string | null>(null);

  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  const { overview, isLoading, isRefreshing, error, reload, isSyncing, syncError, triggerSync } =
    useShopifyOverview(organization?.id, selectedConnectionId);

  async function loadMetrics() {
    if (!organization) {
      return;
    }

    setMetricsError(null);

    const params = new URLSearchParams({ days: String(periodDays) });
    if (selectedConnectionId) {
      params.set("connectionId", selectedConnectionId);
    }

    const response = await apiFetch(`/v1/organizations/${organization.id}/shopify/metrics?${params.toString()}`);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; detail?: string }
        | null;
      setMetricsError([body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - "));
      return;
    }

    setMetrics((await response.json()) as ShopifyMetrics);
  }

  async function saveCost(event: FormEvent) {
    event.preventDefault();

    if (!organization || !costSku.trim() || !costUnitCost) {
      return;
    }

    setIsSavingCost(true);
    setCostFeedback(null);

    const response = await apiFetch(`/v1/organizations/${organization.id}/shopify/product-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: costSku.trim(), unitCost: Number(costUnitCost) }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; detail?: string }
        | null;
      setCostFeedback([body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - "));
      setIsSavingCost(false);
      return;
    }

    setCostFeedback("Coste guardado.");
    setCostSku("");
    setCostUnitCost("");
    setIsSavingCost(false);
    void loadMetrics();
  }

  useEffect(() => {
    if (hasAppliedUrlSelection || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const organizationId = params.get("organizationId");
    const connectionId = params.get("connectionId");

    if (organizationId && bootstrap.memberships.some((membership) => membership.organization_id === organizationId)) {
      setSelectedOrganizationId(organizationId);
    }
    if (connectionId) {
      setSelectedConnectionId(connectionId);
    }

    setHasAppliedUrlSelection(true);
  }, [bootstrap.memberships, hasAppliedUrlSelection]);

  useEffect(() => {
    if (!overview?.selected_connection_id) {
      return;
    }
    if (!selectedConnectionId) {
      setSelectedConnectionId(overview.selected_connection_id);
    }
  }, [overview?.selected_connection_id, selectedConnectionId]);

  useEffect(() => {
    void loadMetrics();
  }, [organization?.id, selectedConnectionId, token, periodDays]);

  if (isLoading) {
    return <div className="border-t border-ink/20 pt-5">Cargando datos Shopify...</div>;
  }

  if (error) {
    return <div className="border-l-2 border-brand py-0.5 pl-3 text-sm text-brand-deep">{error}</div>;
  }

  if (!overview) {
    return null;
  }

  const currency = overview.store?.currency_code ?? "EUR";

  return (
    <div className="space-y-5">
      <section className="border-t border-ink/20 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl">{overview.store?.shop_name ?? "Sin tienda conectada"}</h3>
            <p className="mt-1 font-mono text-xs text-muted">
              {overview.store?.primary_domain ?? overview.store?.myshopify_domain ?? "sin dominio"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button type="button" disabled={isRefreshing} onClick={() => void reload()}>
              {isRefreshing ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={isSyncing || !overview.connection || overview.connection.status === "syncing"}
              onClick={() => void triggerSync()}
            >
              {isSyncing || overview.connection?.status === "syncing" ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          </div>
        </div>
        {syncError ? <p className="mt-3 text-sm text-brand-deep">{syncError}</p> : null}
        {overview.connection?.last_error_message ? (
          <p className="mt-3 border-l-2 border-brand pl-3 font-mono text-xs text-brand-deep">
            {overview.connection.last_error_message}
          </p>
        ) : null}
      </section>

      <section className="border-t border-ink/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h3 className="font-display text-2xl">Ventas</h3>
          <div className="flex gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setPeriodDays(option.days)}
                className={[
                  "border px-3 py-1 text-sm",
                  periodDays === option.days ? "border-black bg-black text-white" : "border-edge text-muted",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {metricsError ? (
          <p className="p-4 text-sm text-brand-deep">{metricsError}</p>
        ) : !metrics ? (
          <p className="p-4 text-sm text-muted">Cargando métricas...</p>
        ) : (
          <>
            <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-6">
              <article className="border-b border-line p-4 xl:border-r">
                <p className="text-sm text-muted">Ventas brutas</p>
                <p className="mt-2 font-mono text-xl">{formatMoney(metrics.sales.gross_sales, currency)}</p>
              </article>
              <article className="border-b border-line p-4 xl:border-r">
                <p className="text-sm text-muted">Ventas netas</p>
                <p className="mt-2 font-mono text-xl">{formatMoney(metrics.sales.net_sales, currency)}</p>
              </article>
              <article className="border-b border-line p-4 xl:border-r">
                <p className="text-sm text-muted">Pedidos</p>
                <p className="mt-2 font-mono text-xl">{metrics.sales.orders_count}</p>
              </article>
              <article className="border-b border-line p-4 xl:border-r">
                <p className="text-sm text-muted">Ticket medio (AOV)</p>
                <p className="mt-2 font-mono text-xl">{formatMoney(metrics.sales.aov, currency)}</p>
              </article>
              <article className="border-b border-line p-4 xl:border-r">
                <p className="text-sm text-muted">Unidades vendidas</p>
                <p className="mt-2 font-mono text-xl">{metrics.sales.units_sold}</p>
              </article>
              <article className="border-b border-line p-4">
                <p className="text-sm text-muted">Reembolsos</p>
                <p className="mt-2 font-mono text-xl text-brand">{formatMoney(metrics.sales.refunds, currency)}</p>
              </article>
            </div>

            <div className="grid gap-0 md:grid-cols-3">
              <div className="border-b border-line p-4 md:border-r">
                <h4 className="font-display text-xl">Productos top</h4>
                <div className="mt-3 divide-y divide-line">
                  {metrics.top_products.length ? (
                    metrics.top_products.map((product) => (
                      <div key={product.product_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>{product.title}</span>
                        <span className="font-mono text-muted">
                          {product.quantity_sold}u / {formatMoney(product.revenue, currency)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-muted">Sin ventas en el periodo seleccionado.</p>
                  )}
                </div>
              </div>
              <div className="border-b border-line p-4 md:border-r">
                <h4 className="font-display text-xl">Stock</h4>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted">SKUs con tracking</p>
                    <p className="font-mono text-lg">{metrics.stock.tracked_items}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Unidades disponibles</p>
                    <p className="font-mono text-lg">{metrics.stock.total_available}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Stock bajo (&le;5)</p>
                    <p className="font-mono text-lg text-brand">{metrics.stock.low_stock_items}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Sin stock</p>
                    <p className="font-mono text-lg text-brand">{metrics.stock.out_of_stock_items}</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h4 className="font-display text-xl">Margen</h4>
                <p className="mt-1 text-sm text-muted">
                  {metrics.margin.items_with_cost} con coste, {metrics.margin.items_without_cost} sin coste.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted">Margen bruto</p>
                    <p className="font-mono text-lg">{formatMoney(metrics.margin.gross_margin, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">% margen</p>
                    <p className="font-mono text-lg">{metrics.margin.margin_pct}%</p>
                  </div>
                </div>
                <form onSubmit={(event) => void saveCost(event)} className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase text-muted">Cargar coste por SKU</p>
                  <Input
                    type="text"
                    placeholder="SKU"
                    value={costSku}
                    onChange={(event) => setCostSku(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      className="w-full"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Coste unitario"
                      value={costUnitCost}
                      onChange={(event) => setCostUnitCost(event.target.value)}
                    />
                    <Button type="submit" className="whitespace-nowrap" disabled={isSavingCost || !costSku.trim() || !costUnitCost}>
                      {isSavingCost ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                  {costFeedback ? <p className="text-xs text-muted">{costFeedback}</p> : null}
                </form>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="flex items-center justify-between border-t border-ink/20 pt-5 text-sm text-muted">
        <span>Último sync: {formatDate(overview.sync_runs[0]?.finished_at)}</span>
        <Link
          className="font-medium underline decoration-edge-strong decoration-1 underline-offset-4 transition hover:text-brand hover:decoration-brand"
          href="/shopify/diagnostico"
        >
          Diagnóstico técnico →
        </Link>
      </section>
    </div>
  );
}

export default function ShopifyPage() {
  return (
    <PortalShell title="Shopify">
      {(bootstrap, token) => <ShopifyBusinessView bootstrap={bootstrap} token={token} />}
    </PortalShell>
  );
}
