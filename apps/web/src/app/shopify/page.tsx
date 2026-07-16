"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";

type ShopifyOverview = {
  organization_id: string;
  connection: {
    id: string;
    provider_account_name: string | null;
    provider_account_id: string | null;
    status: string;
    scopes?: string[];
    api_version: string | null;
    connected_at: string | null;
    last_sync_at: string | null;
    last_error_message: string | null;
  } | null;
  connections: Array<{
    id: string;
    provider_account_name: string | null;
    provider_account_id: string | null;
    status: string;
  }>;
  selected_connection_id: string | null;
  authorized_scopes: string[];
  scope_catalog: Array<{
    scope: string;
    area: string;
    status: "active_ingestion" | "authorized_pending_ingestion" | "metric_source" | "special_access";
    fields: string[];
    enables: string[];
  }>;
  store: {
    shop_name: string;
    myshopify_domain: string;
    primary_domain: string | null;
    currency_code: string | null;
    timezone: string | null;
    plan_display_name: string | null;
    taxes_included: boolean | null;
    updated_at: string;
  } | null;
  datasets: Array<{
    key: string;
    label: string;
    table: string | null;
    description: string;
    status: "active" | "planned";
    scopes: string[];
    sync_scope: "catalog" | "inventory" | "orders" | "refunds" | "customers" | null;
    count: number;
  }>;
  samples: {
    products: Array<{
      id: string;
      title: string;
      handle: string | null;
      vendor: string | null;
      product_type: string | null;
      status: string | null;
      external_updated_at: string | null;
    }>;
    orders: Array<{
      id: string;
      order_name: string | null;
      financial_status: string | null;
      fulfillment_status: string | null;
      current_total_price: number;
      net_sales: number;
      refunds: number;
      processed_at: string | null;
    }>;
    inventory: Array<{
      id: string;
      sku: string | null;
      tracked: boolean;
      requires_shipping: boolean;
      current_unit_cost: number | null;
      cost_currency_code: string | null;
      external_updated_at: string | null;
    }>;
  };
  sync_runs: Array<{
    id: string;
    sync_type: string;
    status: string;
    records_read: number;
    records_written: number;
    records_failed: number;
    error_message: string | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
  }>;
  sync_blocks: Record<
    "catalog" | "inventory" | "orders" | "refunds" | "customers",
    {
      status: string;
      records_read: number;
      records_written: number;
      records_failed: number;
      error_message: string | null;
      started_at: string | null;
      finished_at: string | null;
      created_at: string;
    } | null
  >;
};

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
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
  { days: "all", label: "Todo" },
];

const syncBlockLabels: Record<"catalog" | "inventory" | "orders" | "refunds" | "customers", string> = {
  catalog: "Catalogo",
  inventory: "Inventario",
  orders: "Pedidos",
  refunds: "Reembolsos",
  customers: "Clientes",
};

function blockStatusLabel(status: string | undefined) {
  switch (status) {
    case "running":
      return "sincronizando";
    case "succeeded":
      return "ok";
    case "failed":
      return "error";
    default:
      return "sin sync";
  }
}

function blockStatusClass(status: string | undefined) {
  switch (status) {
    case "running":
      return "border-[#dc1f26] text-[#dc1f26]";
    case "succeeded":
      return "border-[#111] text-black";
    case "failed":
      return "border-[#dc1f26] bg-[#fff7f7] text-[#9f1119]";
    default:
      return "border-[#d8d8d8] text-[#5f5f5f]";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: number | null | undefined, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(Number(value ?? 0));
}

function statusText(status: ShopifyOverview["scope_catalog"][number]["status"]) {
  switch (status) {
    case "active_ingestion":
      return "ingesta activa";
    case "authorized_pending_ingestion":
      return "pendiente de ingesta";
    case "metric_source":
      return "fuente de metricas";
    case "special_access":
      return "acceso especial";
  }
}

function datasetStatusLabel(status: ShopifyOverview["datasets"][number]["status"]) {
  return status === "active" ? "guardando datos" : "pendiente de modelo";
}

function datasetStatusClass(status: ShopifyOverview["datasets"][number]["status"]) {
  return status === "active"
    ? "border-[#111] bg-black text-white"
    : "border-[#d8d8d8] bg-white text-[#5f5f5f]";
}

function ShopifyDataView({
  bootstrap,
  token,
}: {
  bootstrap: BootstrapResponse;
  token: string;
}) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    bootstrap.memberships[0]?.organization_id ?? "",
  );
  const [overview, setOverview] = useState<ShopifyOverview | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [hasAppliedUrlSelection, setHasAppliedUrlSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ShopifyMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number | "all">(30);
  const [costSku, setCostSku] = useState("");
  const [costUnitCost, setCostUnitCost] = useState("");
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [costFeedback, setCostFeedback] = useState<string | null>(null);

  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  async function loadOverview(options: { initial?: boolean } = {}) {
    if (!organization) {
      setError("No hay organizacion activa.");
      setIsLoading(false);
      return;
    }

    if (options.initial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    const connectionParam = selectedConnectionId
      ? `?connectionId=${encodeURIComponent(selectedConnectionId)}`
      : "";
    const response = await apiFetch(`/v1/organizations/${organization.id}/shopify/overview${connectionParam}`);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; detail?: string }
        | null;
      setError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setOverview((await response.json()) as ShopifyOverview);
    setIsLoading(false);
    setIsRefreshing(false);
  }

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
      setMetricsError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - "),
      );
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
      setCostFeedback(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - "),
      );
      setIsSavingCost(false);
      return;
    }

    setCostFeedback("Coste guardado.");
    setCostSku("");
    setCostUnitCost("");
    setIsSavingCost(false);
    void loadMetrics();
  }

  async function triggerSync() {
    if (!organization) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    const connectionParam = selectedConnectionId
      ? `?connectionId=${encodeURIComponent(selectedConnectionId)}`
      : "";
    const response = await apiFetch(`/v1/organizations/${organization.id}/shopify/sync${connectionParam}`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; detail?: string }
        | null;
      setSyncError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
      setIsSyncing(false);
      return;
    }

    setIsSyncing(false);
    void loadOverview();
  }

  useEffect(() => {
    void loadOverview({ initial: true });
  }, [organization?.id, selectedConnectionId, token]);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("shopify") === "connected") {
      void loadOverview();
    }
  }, [organization?.id, token]);

  useEffect(() => {
    if (overview?.connection?.status !== "syncing" && overview?.sync_runs[0]?.status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      void loadOverview();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [overview?.connection?.status, overview?.sync_runs, organization?.id, token]);

  if (isLoading) {
    return <div className="rounded-md border border-[#d8d8d8] p-4">Cargando datos Shopify...</div>;
  }

  if (error) {
    return <div className="rounded-md border border-[#dc1f26] p-4 text-[#b5121b]">{error}</div>;
  }

  if (!overview) {
    return null;
  }

  const currency = overview.store?.currency_code ?? "EUR";
  const authorizedScopes = new Set(overview.authorized_scopes);
  const authorizedCatalog = overview.scope_catalog.filter((item) => authorizedScopes.has(item.scope));
  const pendingCatalog = overview.scope_catalog.filter((item) => !authorizedScopes.has(item.scope));
  const activeDatasets = overview.datasets.filter((dataset) => dataset.status === "active");
  const plannedDatasets = overview.datasets.filter((dataset) => dataset.status === "planned");
  const authorizedPlannedDatasets = plannedDatasets.filter((dataset) =>
    dataset.scopes.some((scope) => authorizedScopes.has(scope)),
  );
  const notAuthorizedPlannedDatasets = plannedDatasets.filter(
    (dataset) => !dataset.scopes.some((scope) => authorizedScopes.has(scope)),
  );
  const activeRecordCount = activeDatasets.reduce((total, dataset) => total + dataset.count, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#d8d8d8] bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_240px_260px_150px_180px] lg:items-end">
          <div>
            <h3 className="font-medium">Datos Shopify</h3>
            <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
              Vista tecnica de los datos que ya guardamos, los permisos concedidos y los bloques pendientes de modelar.
            </p>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Organizacion</span>
            <select
              className="mt-2 w-full rounded-md border border-[#cfcfcf] bg-white px-3 py-2 outline-none focus:border-[#dc1f26]"
              value={organization?.id ?? ""}
              onChange={(event) => {
                setSelectedOrganizationId(event.target.value);
                setSelectedConnectionId("");
              }}
            >
              {bootstrap.memberships.map((membership) => (
                <option key={membership.organization_id} value={membership.organization_id}>
                  {membership.organization?.display_name ?? membership.organization_id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Tienda</span>
            <select
              className="mt-2 w-full rounded-md border border-[#cfcfcf] bg-white px-3 py-2 outline-none focus:border-[#dc1f26]"
              value={overview.selected_connection_id ?? selectedConnectionId}
              onChange={(event) => setSelectedConnectionId(event.target.value)}
            >
              {overview.connections.length ? (
                overview.connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.provider_account_id ?? connection.provider_account_name ?? connection.id}
                  </option>
                ))
              ) : (
                <option value="">Sin tienda conectada</option>
              )}
            </select>
          </label>
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-[#dc1f26] disabled:cursor-not-allowed disabled:bg-[#808080]"
            type="button"
            disabled={isRefreshing}
            onClick={() => void loadOverview()}
          >
            {isRefreshing ? "Actualizando..." : "Actualizar"}
          </button>
          <button
            className="rounded-md bg-[#dc1f26] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#808080]"
            type="button"
            disabled={isSyncing || !overview?.connection || overview.connection.status === "syncing"}
            onClick={() => void triggerSync()}
          >
            {isSyncing || overview?.connection?.status === "syncing" ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        </div>
        {syncError ? <p className="mt-3 text-sm text-[#b5121b]">{syncError}</p> : null}
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Alcance de sincronizacion</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Separacion exacta entre bloques que se vuelcan hoy, bloques autorizados pendientes de modelo y permisos que aun no ha concedido la tienda.
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-4">
          <article className="border-b border-[#e2e2e2] p-4 md:border-r">
            <p className="text-sm text-[#5f5f5f]">Se vuelcan ahora</p>
            <p className="mt-2 font-mono text-2xl">{activeDatasets.length}</p>
            <p className="mt-1 text-xs text-[#5f5f5f]">{activeRecordCount} registros</p>
          </article>
          <article className="border-b border-[#e2e2e2] p-4 md:border-r">
            <p className="text-sm text-[#5f5f5f]">Autorizados pendientes</p>
            <p className="mt-2 font-mono text-2xl">{authorizedPlannedDatasets.length}</p>
            <p className="mt-1 text-xs text-[#5f5f5f]">requieren tabla e ingesta</p>
          </article>
          <article className="border-b border-[#e2e2e2] p-4 md:border-r">
            <p className="text-sm text-[#5f5f5f]">Sin permiso</p>
            <p className="mt-2 font-mono text-2xl">{notAuthorizedPlannedDatasets.length}</p>
            <p className="mt-1 text-xs text-[#5f5f5f]">requieren reautorizacion</p>
          </article>
          <article className="border-b border-[#e2e2e2] p-4">
            <p className="text-sm text-[#5f5f5f]">Permisos concedidos</p>
            <p className="mt-2 font-mono text-2xl">{overview.authorized_scopes.length}</p>
            <p className="mt-1 text-xs text-[#5f5f5f]">scopes Shopify</p>
          </article>
        </div>
        <div className="grid gap-0 lg:grid-cols-3">
          <div className="border-b border-[#e2e2e2] p-4 lg:border-r">
            <h4 className="font-medium">Volcado activo</h4>
            <div className="mt-3 space-y-2">
              {activeDatasets.map((dataset) => (
                <div key={dataset.key} className="flex items-center justify-between gap-3 text-sm">
                  <span>{dataset.label}</span>
                  <span className="font-mono text-[#5f5f5f]">{dataset.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-b border-[#e2e2e2] p-4 lg:border-r">
            <h4 className="font-medium">Autorizado, no modelado</h4>
            <div className="mt-3 space-y-2">
              {authorizedPlannedDatasets.length ? (
                authorizedPlannedDatasets.map((dataset) => (
                  <div key={dataset.key} className="text-sm">
                    <p>{dataset.label}</p>
                    <p className="font-mono text-xs text-[#dc1f26]">{dataset.scopes.join(", ")}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#5f5f5f]">No hay bloques autorizados pendientes para esta tienda.</p>
              )}
            </div>
          </div>
          <div className="border-b border-[#e2e2e2] p-4">
            <h4 className="font-medium">Requiere permiso</h4>
            <div className="mt-3 space-y-2">
              {notAuthorizedPlannedDatasets.length ? (
                notAuthorizedPlannedDatasets.map((dataset) => (
                  <div key={dataset.key} className="text-sm">
                    <p>{dataset.label}</p>
                    <p className="font-mono text-xs text-[#5f5f5f]">{dataset.scopes.join(", ")}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#5f5f5f]">La tienda ha concedido todos los permisos del mapa actual.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e2e2] px-4 py-3">
          <div>
            <h3 className="font-medium">Metricas de ventas</h3>
            <p className="mt-1 text-sm text-[#5f5f5f]">
              Calculadas sobre pedidos reales (sin tests ni cancelados) en el periodo seleccionado.
            </p>
          </div>
          <div className="flex gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setPeriodDays(option.days)}
                className={[
                  "rounded-sm border px-3 py-1 text-sm",
                  periodDays === option.days ? "border-black bg-black text-white" : "border-[#d8d8d8] text-[#5f5f5f]",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {metricsError ? (
          <p className="p-4 text-sm text-[#b5121b]">{metricsError}</p>
        ) : !metrics ? (
          <p className="p-4 text-sm text-[#5f5f5f]">Cargando metricas...</p>
        ) : (
          <>
            <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-6">
              <article className="border-b border-[#e2e2e2] p-4 xl:border-r">
                <p className="text-sm text-[#5f5f5f]">Ventas brutas</p>
                <p className="mt-2 font-mono text-xl">{formatMoney(metrics.sales.gross_sales, currency)}</p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4 xl:border-r">
                <p className="text-sm text-[#5f5f5f]">Ventas netas</p>
                <p className="mt-2 font-mono text-xl">{formatMoney(metrics.sales.net_sales, currency)}</p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4 xl:border-r">
                <p className="text-sm text-[#5f5f5f]">Pedidos</p>
                <p className="mt-2 font-mono text-xl">{metrics.sales.orders_count}</p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4 xl:border-r">
                <p className="text-sm text-[#5f5f5f]">Ticket medio (AOV)</p>
                <p className="mt-2 font-mono text-xl">{formatMoney(metrics.sales.aov, currency)}</p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4 xl:border-r">
                <p className="text-sm text-[#5f5f5f]">Unidades vendidas</p>
                <p className="mt-2 font-mono text-xl">{metrics.sales.units_sold}</p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4">
                <p className="text-sm text-[#5f5f5f]">Reembolsos</p>
                <p className="mt-2 font-mono text-xl text-[#dc1f26]">{formatMoney(metrics.sales.refunds, currency)}</p>
              </article>
            </div>

            <div className="grid gap-0 md:grid-cols-3">
              <div className="border-b border-[#e2e2e2] p-4 md:border-r">
                <h4 className="font-medium">Productos top</h4>
                <p className="mt-1 text-sm text-[#5f5f5f]">Por ingresos en el periodo seleccionado.</p>
                <div className="mt-3 divide-y divide-[#e2e2e2]">
                  {metrics.top_products.length ? (
                    metrics.top_products.map((product) => (
                      <div key={product.product_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>{product.title}</span>
                        <span className="font-mono text-[#5f5f5f]">
                          {product.quantity_sold}u / {formatMoney(product.revenue, currency)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-[#5f5f5f]">Sin ventas en el periodo seleccionado.</p>
                  )}
                </div>
              </div>
              <div className="border-b border-[#e2e2e2] p-4 md:border-r">
                <h4 className="font-medium">Stock</h4>
                <p className="mt-1 text-sm text-[#5f5f5f]">Ultima foto de inventario disponible.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#5f5f5f]">SKUs con tracking</p>
                    <p className="font-mono text-lg">{metrics.stock.tracked_items}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5f5f5f]">Unidades disponibles</p>
                    <p className="font-mono text-lg">{metrics.stock.total_available}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5f5f5f]">Stock bajo (&le;5)</p>
                    <p className="font-mono text-lg text-[#dc1f26]">{metrics.stock.low_stock_items}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5f5f5f]">Sin stock</p>
                    <p className="font-mono text-lg text-[#dc1f26]">{metrics.stock.out_of_stock_items}</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h4 className="font-medium">Margen</h4>
                <p className="mt-1 text-sm text-[#5f5f5f]">
                  {metrics.margin.items_with_cost} lineas con coste cargado, {metrics.margin.items_without_cost} sin coste.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#5f5f5f]">Margen bruto</p>
                    <p className="font-mono text-lg">{formatMoney(metrics.margin.gross_margin, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5f5f5f]">% margen</p>
                    <p className="font-mono text-lg">{metrics.margin.margin_pct}%</p>
                  </div>
                </div>
                <form onSubmit={(event) => void saveCost(event)} className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase text-[#5f5f5f]">Cargar coste por SKU</p>
                  <input
                    type="text"
                    placeholder="SKU"
                    value={costSku}
                    onChange={(event) => setCostSku(event.target.value)}
                    className="w-full rounded-md border border-[#cfcfcf] px-3 py-2 text-sm outline-none focus:border-[#dc1f26]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Coste unitario"
                      value={costUnitCost}
                      onChange={(event) => setCostUnitCost(event.target.value)}
                      className="w-full rounded-md border border-[#cfcfcf] px-3 py-2 text-sm outline-none focus:border-[#dc1f26]"
                    />
                    <button
                      type="submit"
                      disabled={isSavingCost || !costSku.trim() || !costUnitCost}
                      className="whitespace-nowrap rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-[#dc1f26] disabled:cursor-not-allowed disabled:bg-[#808080]"
                    >
                      {isSavingCost ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                  {costFeedback ? <p className="text-xs text-[#5f5f5f]">{costFeedback}</p> : null}
                </form>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-[#d8d8d8] bg-white p-4">
          <p className="text-sm text-[#5f5f5f]">Conexion</p>
          <p className="mt-2 font-mono text-xl">{overview.connection?.status ?? "sin_conexion"}</p>
          <p className="mt-2 text-sm text-[#5f5f5f]">
            {overview.connection?.provider_account_id ?? "Tienda pendiente"}
          </p>
        </article>
        <article className="rounded-md border border-[#d8d8d8] bg-white p-4">
          <p className="text-sm text-[#5f5f5f]">Tienda</p>
          <p className="mt-2 text-xl font-medium">{overview.store?.shop_name ?? "Sin tienda"}</p>
          <p className="mt-2 text-sm text-[#5f5f5f]">{overview.store?.primary_domain ?? "sin dominio primario"}</p>
        </article>
        <article className="rounded-md border border-[#d8d8d8] bg-white p-4">
          <p className="text-sm text-[#5f5f5f]">Ultimo sync</p>
          <p className="mt-2 font-mono text-xl">{overview.sync_runs[0]?.status ?? "sin_sync"}</p>
          <p className="mt-2 text-sm text-[#5f5f5f]">{formatDate(overview.sync_runs[0]?.finished_at)}</p>
        </article>
        <article className="rounded-md border border-[#d8d8d8] bg-white p-4">
          <p className="text-sm text-[#5f5f5f]">Registros escritos</p>
          <p className="mt-2 font-mono text-2xl">{overview.sync_runs[0]?.records_written ?? 0}</p>
          <p className="mt-2 text-sm text-[#5f5f5f]">en el ultimo sync</p>
        </article>
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Permisos Shopify autorizados</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Permisos concedidos por la tienda. Tener permiso no significa que el bloque ya tenga tabla e ingesta propia.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          {overview.authorized_scopes.length ? (
            overview.authorized_scopes.map((scope) => (
              <span key={scope} className="rounded-sm border border-[#111] px-2 py-1 font-mono text-xs">
                {scope}
              </span>
            ))
          ) : (
            <p className="text-sm text-[#5f5f5f]">No hay scopes guardados para esta conexion todavia.</p>
          )}
        </div>
      </section>

      {overview.connection?.last_error_message ? (
        <section className="rounded-md border border-[#dc1f26] bg-[#fff7f7] p-4 text-sm text-[#9f1119]">
          <p className="font-medium">Ultimo error Shopify</p>
          <p className="mt-2 font-mono break-words">{overview.connection.last_error_message}</p>
        </section>
      ) : null}

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Estado por bloque de sincronizacion</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Cada bloque (catalogo, inventario, pedidos, reembolsos y clientes) se sincroniza y falla de forma independiente.
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(syncBlockLabels) as Array<keyof typeof syncBlockLabels>).map((blockKey) => {
            const block = overview.sync_blocks?.[blockKey] ?? null;

            return (
              <article key={blockKey} className="border-b border-[#e2e2e2] p-4 xl:border-r">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium">{syncBlockLabels[blockKey]}</h4>
                  <span className={["rounded-sm border px-2 py-1 text-xs", blockStatusClass(block?.status)].join(" ")}>
                    {blockStatusLabel(block?.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#5f5f5f]">
                  {block ? `${block.records_written} registros escritos` : "Todavia no se ha ejecutado."}
                </p>
                <p className="mt-1 text-xs text-[#5f5f5f]">{formatDate(block?.finished_at)}</p>
                {block?.error_message ? (
                  <p className="mt-2 font-mono text-xs break-words text-[#9f1119]">{block.error_message}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Bloques de datos disponibles</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Los bloques activos ya tienen tabla y se guardan en Supabase. Los pendientes estan autorizados, pero aun falta crear su modelo de datos e ingesta.
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
          {overview.datasets.map((dataset) => (
            <article key={dataset.key} className="border-b border-[#e2e2e2] p-4 xl:border-r">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium">{dataset.label}</h4>
                  <p className="mt-1 font-mono text-xs text-[#dc1f26]">
                    {dataset.table ?? "pendiente_modelo"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={[
                        "rounded-sm border px-2 py-1 text-xs",
                        datasetStatusClass(dataset.status),
                      ].join(" ")}
                    >
                      {datasetStatusLabel(dataset.status)}
                    </span>
                    {dataset.scopes.map((scope) => (
                      <span key={scope} className="rounded-sm bg-[#f5f5f5] px-2 py-1 font-mono text-xs">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="font-mono text-xl">{dataset.count}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#5f5f5f]">{dataset.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Mapa de datos por permiso</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Lectura por permiso: que campos nos habilita Shopify y que calculos podremos construir con ellos.
          </p>
        </div>
        <div className="divide-y divide-[#e2e2e2]">
          {[...authorizedCatalog, ...pendingCatalog].map((item) => {
            const isAuthorized = authorizedScopes.has(item.scope);

            return (
              <article key={item.scope} className="grid gap-4 p-4 xl:grid-cols-[260px_1fr_1fr]">
                <div>
                  <p className="font-mono text-sm font-medium">{item.scope}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-sm bg-black px-2 py-1 text-xs text-white">{item.area}</span>
                    <span
                      className={[
                        "rounded-sm border px-2 py-1 text-xs",
                        isAuthorized ? "border-[#111] text-black" : "border-[#dc1f26] text-[#dc1f26]",
                      ].join(" ")}
                    >
                      {isAuthorized ? "autorizado" : "no concedido"}
                    </span>
                    <span className="rounded-sm border border-[#d8d8d8] px-2 py-1 text-xs">
                      {statusText(item.status)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-[#5f5f5f]">Campos principales</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.fields.map((field) => (
                      <span key={field} className="rounded-sm bg-[#f5f5f5] px-2 py-1 font-mono text-xs">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-[#5f5f5f]">Permite calcular</p>
                  <ul className="mt-2 space-y-1 text-sm text-[#3f3f3f]">
                    {item.enables.map((metric) => (
                      <li key={metric}>{metric}</li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Productos recientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#e2e2e2] text-[#5f5f5f]">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e2e2]">
              {overview.samples.products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{product.title}</p>
                    <p className="font-mono text-xs text-[#5f5f5f]">{product.handle ?? "sin_handle"}</p>
                  </td>
                  <td className="px-4 py-3">{product.vendor ?? "n/a"}</td>
                  <td className="px-4 py-3">{product.product_type ?? "n/a"}</td>
                  <td className="px-4 py-3 font-mono text-[#dc1f26]">{product.status ?? "n/a"}</td>
                  <td className="px-4 py-3">{formatDate(product.external_updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-md border border-[#d8d8d8] bg-white">
          <div className="border-b border-[#e2e2e2] px-4 py-3">
            <h3 className="font-medium">Pedidos recientes</h3>
          </div>
          <div className="divide-y divide-[#e2e2e2]">
            {overview.samples.orders.length ? (
              overview.samples.orders.map((order) => (
                <div key={order.id} className="grid gap-2 p-4 md:grid-cols-[1fr_120px]">
                  <div>
                    <p className="font-medium">{order.order_name ?? "Pedido sin nombre"}</p>
                    <p className="mt-1 text-sm text-[#5f5f5f]">
                      {order.financial_status ?? "n/a"} / {order.fulfillment_status ?? "n/a"}
                    </p>
                    <p className="mt-1 text-xs text-[#5f5f5f]">{formatDate(order.processed_at)}</p>
                  </div>
                  <div className="font-mono text-sm md:text-right">
                    <p>{formatMoney(order.current_total_price, currency)}</p>
                    <p className="text-[#dc1f26]">net {formatMoney(order.net_sales, currency)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm leading-6 text-[#5f5f5f]">
                No hay pedidos guardados para esta tienda en el ultimo sync. El bloque existe, pero Shopify no ha devuelto pedidos con los permisos actuales.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-md border border-[#d8d8d8] bg-white">
          <div className="border-b border-[#e2e2e2] px-4 py-3">
            <h3 className="font-medium">Inventory items</h3>
          </div>
          <div className="divide-y divide-[#e2e2e2]">
            {overview.samples.inventory.length ? (
              overview.samples.inventory.map((item) => (
                <div key={item.id} className="grid gap-2 p-4 md:grid-cols-[1fr_140px]">
                  <div>
                    <p className="font-mono font-medium">{item.sku ?? "sin_sku"}</p>
                    <p className="mt-1 text-sm text-[#5f5f5f]">
                      tracked: {String(item.tracked)} / shipping: {String(item.requires_shipping)}
                    </p>
                  </div>
                  <p className="font-mono text-sm md:text-right">
                    {item.current_unit_cost ? formatMoney(item.current_unit_cost, item.cost_currency_code ?? currency) : "sin_coste"}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm leading-6 text-[#5f5f5f]">
                No hay inventory items guardados todavia.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default function ShopifyPage() {
  return (
    <PortalShell title="Shopify">
      {(bootstrap, token) => <ShopifyDataView bootstrap={bootstrap} token={token} />}
    </PortalShell>
  );
}
