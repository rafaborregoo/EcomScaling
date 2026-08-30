"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { useShopifyOverview } from "@/hooks/use-shopify-overview";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  IconChevronRight,
  Input,
  Link,
  List,
  LoadingBlock,
  Select,
} from "@/components/ui";

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


function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function ShopifyBusinessView({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const {
    organizationId: selectedOrganizationId,
    setOrganizationId: setSelectedOrganizationId,
  } = useActiveOrganization();
  const {
    connectionId: selectedConnectionId,
    setConnectionId: setSelectedConnectionId,
  } = useActiveConnection();
  const [hasAppliedUrlSelection, setHasAppliedUrlSelection] = useState(false);
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
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const {
    overview,
    isLoading,
    isRefreshing,
    error,
    reload,
    isSyncing,
    syncError,
    triggerSync,
  } = useShopifyOverview(organization?.id, selectedConnectionId);

  const loadMetrics = useCallback(async () => {
    if (!organization) {
      return;
    }

    setMetricsError(null);

    const params = new URLSearchParams({ days: String(periodDays) });
    if (selectedConnectionId) {
      params.set("connectionId", selectedConnectionId);
    }

    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/shopify/metrics?${params.toString()}`,
      );

      if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        detail?: string;
      } | null;
      setMetricsError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
        return;
      }

      setMetrics((await response.json()) as ShopifyMetrics);
    } catch {
      setMetricsError("No se pudieron cargar las métricas de Shopify. Revisa la conexión e inténtalo de nuevo.");
    }
  }, [organization, periodDays, selectedConnectionId]);

  async function saveCost(event: FormEvent) {
    event.preventDefault();

    if (!organization || !costSku.trim() || !costUnitCost) {
      return;
    }

    setIsSavingCost(true);
    setCostFeedback(null);

    try {
      const response = await apiFetch(
      `/v1/organizations/${organization.id}/shopify/product-costs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: costSku.trim(),
          unitCost: Number(costUnitCost),
        }),
      },
      );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        detail?: string;
      } | null;
      setCostFeedback(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
      return;
    }

    setCostFeedback("Coste guardado.");
    setCostSku("");
    setCostUnitCost("");
    void loadMetrics();
    } catch {
      setCostFeedback("No se pudo guardar el coste. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsSavingCost(false);
    }
  }

  useEffect(() => {
    if (hasAppliedUrlSelection || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const organizationId = params.get("organizationId");
    const connectionId = params.get("connectionId");

    if (
      organizationId &&
      bootstrap.memberships.some(
        (membership) => membership.organization_id === organizationId,
      )
    ) {
      setSelectedOrganizationId(organizationId);
    }
    if (connectionId) {
      setSelectedConnectionId(connectionId);
    }

    setHasAppliedUrlSelection(true);
  }, [
    bootstrap.memberships,
    hasAppliedUrlSelection,
    setSelectedConnectionId,
    setSelectedOrganizationId,
  ]);

  useEffect(() => {
    if (!overview?.selected_connection_id) {
      return;
    }
    if (!selectedConnectionId) {
      setSelectedConnectionId(overview.selected_connection_id);
    }
  }, [
    overview?.selected_connection_id,
    selectedConnectionId,
    setSelectedConnectionId,
  ]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  if (isLoading) {
    return (
      <div className="border-t border-ink/20 pt-5">
        <AsyncState status="loading" loadingLabel="Cargando datos Shopify..." />
      </div>
    );
  }

  if (error) {
    return <AsyncState status="error" error={error} />;
  }

  if (!overview) {
    return (
      <AsyncState
        status="empty"
        emptyTitle="No hay datos Shopify disponibles"
        emptyHint="Conecta una tienda o selecciona otra conexión activa."
      />
    );
  }

  if (!overview.connection) {
    return (
      <EmptyState
        title="Shopify todavía no está conectado"
        hint="Conecta una tienda para importar ventas, productos, stock y métricas reales. Meta Ads y Klaviyo no son necesarios para empezar."
        action={<Link href="/integraciones">Ir a Integraciones</Link>}
      />
    );
  }

  const currency = overview.store?.currency_code ?? "EUR";

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Card
        title={overview.store?.shop_name ?? "Sin tienda conectada"}
        description={
          overview.store?.primary_domain ??
          overview.store?.myshopify_domain ??
          "sin dominio"
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={isRefreshing}
              onClick={() => void reload()}
            >
              {isRefreshing ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={
                isSyncing ||
                !overview.connection ||
                overview.connection.status === "syncing"
              }
              onClick={() => void triggerSync()}
            >
              {isSyncing || overview.connection?.status === "syncing"
                ? "Sincronizando..."
                : "Sincronizar ahora"}
            </Button>
          </div>
        }
      >
        {syncError ? (
          <div className="mt-3">
            <ErrorBlock>{syncError}</ErrorBlock>
          </div>
        ) : null}
        {overview.connection?.last_error_message ? (
          <div className="mt-3">
            <Banner tone="danger">
              <span className="font-mono text-xs">
                {overview.connection.last_error_message}
              </span>
            </Banner>
          </div>
        ) : null}
      </Card>

      <Card
        title="Ventas"
        actions={
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Button
                key={option.days}
                size="sm"
                variant={periodDays === option.days ? "primary" : "ghost"}
                onClick={() => setPeriodDays(option.days)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      >
        {metricsError ? (
          <div className="p-4">
            <ErrorBlock>{metricsError}</ErrorBlock>
          </div>
        ) : !metrics ? (
          <div className="p-4">
            <LoadingBlock label="Cargando métricas..." />
          </div>
        ) : (
          <>
            <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-6">
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Ventas brutas</p>
                <p className="mt-2 font-mono text-xl">
                  {formatMoney(metrics.sales.gross_sales, currency)}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Ventas netas</p>
                <p className="mt-2 font-mono text-xl">
                  {formatMoney(metrics.sales.net_sales, currency)}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Pedidos</p>
                <p className="mt-2 font-mono text-xl">
                  {metrics.sales.orders_count}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Ticket medio (AOV)</p>
                <p className="mt-2 font-mono text-xl">
                  {formatMoney(metrics.sales.aov, currency)}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Unidades vendidas</p>
                <p className="mt-2 font-mono text-xl">
                  {metrics.sales.units_sold}
                </p>
              </article>
              <article className="border-b border-separator p-4">
                <p className="text-sm text-muted">Reembolsos</p>
                <p className="mt-2 font-mono text-xl text-warn">
                  {formatMoney(metrics.sales.refunds, currency)}
                </p>
              </article>
            </div>

            <div className="grid gap-0 md:grid-cols-3">
              <div className="border-b border-separator p-4 md:border-r">
                <Heading level={3} size="md">
                  Productos top
                </Heading>
                <List className="mt-3">
                  {metrics.top_products.length ? (
                    metrics.top_products.map((product) => (
                      <List.Item
                        key={product.product_id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span>{product.title}</span>
                        <span className="font-mono text-muted">
                          {product.quantity_sold}u /{" "}
                          {formatMoney(product.revenue, currency)}
                        </span>
                      </List.Item>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-muted">
                      Sin ventas en el periodo seleccionado.
                    </p>
                  )}
                </List>
              </div>
              <div className="border-b border-separator p-4 md:border-r">
                <Heading level={3} size="md">
                  Stock
                </Heading>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted">SKUs con tracking</p>
                    <p className="font-mono text-lg">
                      {metrics.stock.tracked_items}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Unidades disponibles</p>
                    <p className="font-mono text-lg">
                      {metrics.stock.total_available}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Stock bajo (&le;5)</p>
                    <p className="font-mono text-lg text-warn">
                      {metrics.stock.low_stock_items}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Sin stock</p>
                    <p className="font-mono text-lg text-danger">
                      {metrics.stock.out_of_stock_items}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <Heading level={3} size="md">
                  Margen
                </Heading>
                <p className="mt-1 text-sm text-muted">
                  {metrics.margin.items_with_cost} con coste,{" "}
                  {metrics.margin.items_without_cost} sin coste.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted">Margen bruto</p>
                    <p className="font-mono text-lg">
                      {formatMoney(metrics.margin.gross_margin, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">% margen</p>
                    <p className="font-mono text-lg">
                      {metrics.margin.margin_pct}%
                    </p>
                  </div>
                </div>
                <form
                  onSubmit={(event) => void saveCost(event)}
                  className="mt-4 space-y-2"
                >
                  <p className={EYEBROW}>Cargar coste por SKU</p>
                  <Field label="SKU">
                    <Input
                      className="mt-2"
                      type="text"
                      placeholder="Ej. CAMISETA-NEGRA-M"
                      value={costSku}
                      onChange={(event) => setCostSku(event.target.value)}
                    />
                  </Field>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Field label="Coste unitario">
                      <Input
                        className="mt-2 w-full"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={costUnitCost}
                        onChange={(event) => setCostUnitCost(event.target.value)}
                      />
                    </Field>
                    <Button
                      type="submit"
                      className="whitespace-nowrap"
                      disabled={
                        isSavingCost || !costSku.trim() || !costUnitCost
                      }
                    >
                      {isSavingCost ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                  {costFeedback ? <p className="text-xs text-muted">{costFeedback}</p> : null}
                </form>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>
            Último sync: {formatDate(overview.sync_runs[0]?.finished_at)}
          </span>
          {isConsultant ? (
            <Link
              className="inline-flex items-center gap-1"
              href="/shopify/diagnostico"
            >
              Diagnóstico técnico <IconChevronRight aria-hidden />
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

// --- Estado "vista general" de /shopify (consultor sin cliente activo):
// todas las tiendas de la cartera con su frescura de sincronización. ---

type ConsultantStoreRow = {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  status: string;
  connected_at: string | null;
  last_sync_at: string | null;
};

const STALE_SYNC_DAYS = 2;

function syncAge(lastSyncAt: string | null): {
  label: string;
  stale: boolean;
} {
  if (!lastSyncAt) return { label: "sin sincronizar", stale: true };
  const days = Math.floor(
    (Date.now() - Date.parse(lastSyncAt)) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return { label: "hoy", stale: false };
  if (days === 1) return { label: "ayer", stale: false };
  return { label: `hace ${days} días`, stale: days > STALE_SYNC_DAYS };
}

function ConsultantStoresView() {
  const { setOrganizationId } = useActiveOrganization();
  const { setConnectionId } = useActiveConnection();
  const [data, setData] = useState<{
    stores: ConsultantStoreRow[];
    organizations: Array<{ id: string; display_name: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [onlyIssues, setOnlyIssues] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch("/v1/consultant/stores")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(`No se pudieron cargar las tiendas (HTTP ${response.status}).`);
          return;
        }
        setData(
          (await response.json()) as {
            stores: ConsultantStoreRow[];
            organizations: Array<{ id: string; display_name: string }>;
          },
        );
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudieron cargar las tiendas por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando tiendas de la cartera..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!data) return null;

  const isIssue = (store: ConsultantStoreRow) =>
    ["error", "reauthorization_required", "needs_reauth"].includes(
      store.status,
    ) || syncAge(store.last_sync_at).stale;
  const issueCount = data.stores.filter(isIssue).length;
  const rows = data.stores
    .filter(
      (store) =>
        clientFilter === "all" || store.organization_id === clientFilter,
    )
    .filter((store) => !onlyIssues || isIssue(store));

  function openStore(store: ConsultantStoreRow) {
    setOrganizationId(store.organization_id);
    setConnectionId(store.id);
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Card
        title="Tiendas Shopify · toda la cartera"
        description={`${data.stores.length} tiendas · ${issueCount} en error o con la sincronización parada.`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            className="w-52"
            aria-label="Filtrar por cliente"
            value={clientFilter}
            onChange={setClientFilter}
            options={[
              { value: "all", label: "Todos los clientes" },
              ...data.organizations.map((organization) => ({
                value: organization.id,
                label: organization.display_name,
              })),
            ]}
          />
          <Button
            variant={onlyIssues ? "primary" : "secondary"}
            size="sm"
            onClick={() => setOnlyIssues((value) => !value)}
          >
            Solo con incidencias
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={
              onlyIssues ? "Ninguna tienda con incidencias" : "Sin tiendas"
            }
            hint={
              onlyIssues
                ? "Toda la cartera sincronizando al día."
                : "Los clientes conectan sus tiendas desde Integraciones."
            }
          />
        ) : (
          <List>
            {rows.map((store) => {
              const age = syncAge(store.last_sync_at);
              const brokenStatus = [
                "error",
                "reauthorization_required",
                "needs_reauth",
              ].includes(store.status);
              return (
                <List.Item
                  as="button"
                  key={store.id}
                  type="button"
                  onClick={() => openStore(store)}
                  className="flex w-full items-start justify-between gap-4 py-3 text-left hover:bg-surface"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          brokenStatus
                            ? "danger"
                            : store.status === "connected"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {store.status}
                      </Badge>
                      <span className="font-medium">{store.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {store.organization_name} · sync {age.label}
                    </p>
                  </div>
                  {age.stale && !brokenStatus ? (
                    <Badge tone="warn">sync parada</Badge>
                  ) : null}
                </List.Item>
              );
            })}
          </List>
        )}
      </Card>
    </div>
  );
}

function ShopifyRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    return <ConsultantStoresView />;
  }

  return <ShopifyBusinessView bootstrap={bootstrap} />;
}

export default function ShopifyPage() {
  return (
    <PortalShell title="Shopify">
      {(bootstrap) => <ShopifyRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
