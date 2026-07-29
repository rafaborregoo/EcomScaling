"use client";

import { useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { useShopifyOverview, type ShopifyOverview } from "@/hooks/use-shopify-overview";
import { usePaginatedUrl } from "@/hooks/use-paginated-url";
import { Banner, EmptyState, ErrorBlock, Heading, IconChevronLeft, Link, LoadingBlock, Pagination, Table, Tabs, type TableColumnDef } from "@/components/ui";

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
      return "text-brand";
    case "succeeded":
      return "text-black";
    case "failed":
      return "text-brand-deep";
    default:
      return "text-muted";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value: number | null | undefined, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value ?? 0));
}

const PAGE_SIZE = 10;

type SummaryRow = { id: string; field: string; value: string; detail: string };

const summaryColumns: TableColumnDef<SummaryRow>[] = [
  { key: "field", label: "Campo", render: (row) => <span className="font-mono text-xs uppercase tracking-wide text-muted">{row.field}</span> },
  { key: "value", label: "Valor", render: (row) => <span className="font-medium">{row.value}</span> },
  { key: "detail", label: "Detalle", render: (row) => <span className="text-muted">{row.detail}</span> },
];

type SyncBlockRow = {
  id: string;
  label: string;
  block: ShopifyOverview["sync_blocks"][keyof ShopifyOverview["sync_blocks"]];
};

const syncBlockColumns: TableColumnDef<SyncBlockRow>[] = [
  { key: "label", label: "Bloque" },
  {
    key: "status",
    label: "Estado",
    render: (row) => (
      <span className={["font-mono text-xs uppercase", blockStatusClass(row.block?.status)].join(" ")}>
        {blockStatusLabel(row.block?.status)}
      </span>
    ),
  },
  { key: "records_written", label: "Registros", render: (row) => <span className="font-mono">{row.block?.records_written ?? 0}</span> },
  { key: "finished_at", label: "Ultima corrida", render: (row) => formatDate(row.block?.finished_at) },
  {
    key: "error_message",
    label: "Error",
    render: (row) => <span className="font-mono text-xs break-words text-brand-deep">{row.block?.error_message ?? "—"}</span>,
  },
];

type ScopeRow = ShopifyOverview["scope_catalog"][number] & { id: string };

function scopeColumns(authorizedScopes: Set<string>): TableColumnDef<ScopeRow>[] {
  return [
    { key: "scope", label: "Scope", render: (row) => <span className="font-mono text-xs">{row.scope}</span> },
    { key: "area", label: "Area" },
    {
      key: "authorized",
      label: "Estado",
      render: (row) => (
        <span className={["font-mono text-xs uppercase", authorizedScopes.has(row.scope) ? "text-black" : "text-brand"].join(" ")}>
          {authorizedScopes.has(row.scope) ? "autorizado" : "no concedido"}
        </span>
      ),
    },
    { key: "enables", label: "Permite calcular", render: (row) => <span className="text-muted">{row.enables.join(", ")}</span> },
  ];
}

type DatasetRow = ShopifyOverview["datasets"][number] & { id: string };

const datasetColumns: TableColumnDef<DatasetRow>[] = [
  { key: "label", label: "Bloque de datos", render: (row) => <span className="font-medium">{row.label}</span> },
  { key: "table", label: "Tabla", render: (row) => <span className="font-mono text-xs text-brand">{row.table ?? "pendiente_modelo"}</span> },
  {
    key: "status",
    label: "Estado",
    render: (row) => (
      <span className="font-mono text-xs uppercase text-muted">
        {row.status === "active" ? "guardando datos" : "pendiente de modelo"}
      </span>
    ),
  },
  { key: "count", label: "Registros", render: (row) => <span className="font-mono">{row.count}</span> },
];

type ProductRow = ShopifyOverview["samples"]["products"][number];

const productColumns: TableColumnDef<ProductRow>[] = [
  {
    key: "title",
    label: "Producto",
    render: (row) => (
      <div>
        <p className="font-medium">{row.title}</p>
        <p className="font-mono text-xs text-muted">{row.handle ?? "sin_handle"}</p>
      </div>
    ),
  },
  { key: "vendor", label: "Vendor", render: (row) => row.vendor ?? "n/a" },
  { key: "product_type", label: "Tipo", render: (row) => row.product_type ?? "n/a" },
  { key: "status", label: "Estado", render: (row) => <span className="font-mono text-xs text-brand">{row.status ?? "n/a"}</span> },
  { key: "external_updated_at", label: "Actualizado", render: (row) => formatDate(row.external_updated_at) },
];

type OrderRow = ShopifyOverview["samples"]["orders"][number];

function orderColumns(currency: string): TableColumnDef<OrderRow>[] {
  return [
    { key: "order_name", label: "Pedido", render: (row) => <span className="font-medium">{row.order_name ?? "Pedido sin nombre"}</span> },
    {
      key: "status",
      label: "Estado",
      render: (row) => <span className="text-muted">{row.financial_status ?? "n/a"} / {row.fulfillment_status ?? "n/a"}</span>,
    },
    { key: "processed_at", label: "Fecha", render: (row) => <span className="text-muted">{formatDate(row.processed_at)}</span> },
    { key: "current_total_price", label: "Total", render: (row) => <span className="font-mono">{formatMoney(row.current_total_price, currency)}</span> },
    { key: "net_sales", label: "Neto", render: (row) => <span className="font-mono text-brand">{formatMoney(row.net_sales, currency)}</span> },
  ];
}

type InventoryRow = ShopifyOverview["samples"]["inventory"][number];

function inventoryColumns(currency: string): TableColumnDef<InventoryRow>[] {
  return [
    { key: "sku", label: "SKU", render: (row) => <span className="font-mono">{row.sku ?? "sin_sku"}</span> },
    { key: "tracked", label: "Tracked", render: (row) => <span className="text-muted">{String(row.tracked)}</span> },
    { key: "requires_shipping", label: "Shipping", render: (row) => <span className="text-muted">{String(row.requires_shipping)}</span> },
    {
      key: "current_unit_cost",
      label: "Coste unitario",
      render: (row) => (
        <span className="font-mono">
          {row.current_unit_cost ? formatMoney(row.current_unit_cost, row.cost_currency_code ?? currency) : "sin_coste"}
        </span>
      ),
    },
  ];
}

const tabs = [
  { value: "resumen", label: "Resumen" },
  { value: "sincronizacion", label: "Sincronización" },
  { value: "permisos", label: "Permisos y datos" },
  { value: "muestras", label: "Muestras" },
];

function ShopifyDiagnosticoView({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const { connectionId: selectedConnectionId } = useActiveConnection();
  const [tab, setTab] = useState("resumen");

  // Auditoria estructural 2026-07-29 (peticion de Rafa, "tiene que estar
  // masticado para cliente"): esta pagina es un panel tecnico (scopes de
  // API, estado interno de sincronizacion por bloque, muestras crudas de
  // filas) sin ningun filtro de rol -- cualquier cliente que siguiera el
  // enlace "Diagnostico tecnico" desde /shopify caia aqui. Mismo patron que
  // ya usa /agentes (`canView`): solo consultor/platform_admin.
  const canView = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);

  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  const { overview, isLoading, error } = useShopifyOverview(canView ? organization?.id : undefined, selectedConnectionId);

  const products = usePaginatedUrl(overview?.samples.products ?? [], PAGE_SIZE, "page_productos");
  const orders = usePaginatedUrl(overview?.samples.orders ?? [], PAGE_SIZE, "page_pedidos");
  const inventory = usePaginatedUrl(overview?.samples.inventory ?? [], PAGE_SIZE, "page_inventario");

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="El diagnóstico técnico de Shopify es un panel para consultor/platform admin. Para ver el resumen de tu tienda, vuelve a Shopify."
        action={
          <Link className="inline-flex items-center gap-1" href="/shopify">
            <IconChevronLeft aria-hidden /> Volver a Shopify
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="border-t border-ink/20 pt-5">
        <LoadingBlock label="Cargando diagnóstico..." />
      </div>
    );
  }

  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }

  if (!overview) {
    return null;
  }

  const currency = overview.store?.currency_code ?? "EUR";
  const authorizedScopes = new Set(overview.authorized_scopes);
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
      <div className="flex items-center justify-between border-t border-ink/20 pt-5">
        <Link className="inline-flex items-center gap-1" href="/shopify">
          <IconChevronLeft aria-hidden /> Volver a Shopify
        </Link>
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === "resumen" ? (
        <div className="space-y-5">
          {overview.connection?.last_error_message ? (
            <Banner tone="danger">
              <span className="font-medium">Ultimo error Shopify:</span>{" "}
              <span className="font-mono break-words">{overview.connection.last_error_message}</span>
            </Banner>
          ) : null}

          <Table
            ariaLabel="Resumen de la conexion Shopify"
            columns={summaryColumns}
            rows={[
              {
                id: "conexion",
                field: "Conexion",
                value: overview.connection?.status ?? "sin_conexion",
                detail: overview.connection?.provider_account_id ?? "Tienda pendiente",
              },
              {
                id: "tienda",
                field: "Tienda",
                value: overview.store?.shop_name ?? "Sin tienda",
                detail: overview.store?.primary_domain ?? "sin dominio primario",
              },
              {
                id: "ultimo-sync",
                field: "Ultimo sync",
                value: overview.sync_runs[0]?.status ?? "sin_sync",
                detail: formatDate(overview.sync_runs[0]?.finished_at),
              },
              {
                id: "registros",
                field: "Registros escritos",
                value: String(overview.sync_runs[0]?.records_written ?? 0),
                detail: "en el último sync",
              },
            ]}
          />
        </div>
      ) : null}

      {tab === "sincronizacion" ? (
        <div className="space-y-5">
          <section className="grid gap-0 md:grid-cols-4">
            <article className="border-b border-line p-4 md:border-r">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Se vuelcan ahora</p>
              <p className="mt-2 font-mono text-2xl">{activeDatasets.length}</p>
              <p className="mt-1 text-xs text-muted">{activeRecordCount} registros</p>
            </article>
            <article className="border-b border-line p-4 md:border-r">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Autorizados pendientes</p>
              <p className="mt-2 font-mono text-2xl">{authorizedPlannedDatasets.length}</p>
            </article>
            <article className="border-b border-line p-4 md:border-r">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Sin permiso</p>
              <p className="mt-2 font-mono text-2xl">{notAuthorizedPlannedDatasets.length}</p>
            </article>
            <article className="border-b border-line p-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Permisos concedidos</p>
              <p className="mt-2 font-mono text-2xl">{overview.authorized_scopes.length}</p>
            </article>
          </section>

          <Table
            ariaLabel="Estado de sincronizacion por bloque"
            columns={syncBlockColumns}
            rows={(Object.keys(syncBlockLabels) as Array<keyof typeof syncBlockLabels>).map((blockKey) => ({
              id: blockKey,
              label: syncBlockLabels[blockKey],
              block: overview.sync_blocks?.[blockKey] ?? null,
            }))}
          />
        </div>
      ) : null}

      {tab === "permisos" ? (
        <div className="space-y-5">
          <Table
            ariaLabel="Permisos de Shopify concedidos"
            columns={scopeColumns(authorizedScopes)}
            rows={overview.scope_catalog.map((item) => ({ id: item.scope, ...item }))}
          />

          <Table
            ariaLabel="Datasets de Shopify"
            columns={datasetColumns}
            rows={overview.datasets.map((dataset) => ({ id: dataset.key, ...dataset }))}
          />
        </div>
      ) : null}

      {tab === "muestras" ? (
        <div className="space-y-8">
          <section>
            <Heading size="md">Productos ({overview.samples.products.length})</Heading>
            <Table
              className="mt-3"
              ariaLabel="Muestra de productos"
              columns={productColumns}
              rows={products.pageItems}
              emptyLabel="Sin productos sincronizados todavia."
            />
            <Pagination className="mt-3" page={products.page} pageCount={products.pageCount} onChange={products.setPage} />
          </section>

          <section>
            <Heading size="md">Pedidos ({overview.samples.orders.length})</Heading>
            <Table
              className="mt-3"
              ariaLabel="Muestra de pedidos"
              columns={orderColumns(currency)}
              rows={orders.pageItems}
              emptyLabel="Sin pedidos sincronizados todavia."
            />
            <Pagination className="mt-3" page={orders.page} pageCount={orders.pageCount} onChange={orders.setPage} />
          </section>

          <section>
            <Heading size="md">Inventory items ({overview.samples.inventory.length})</Heading>
            <Table
              className="mt-3"
              ariaLabel="Muestra de inventario"
              columns={inventoryColumns(currency)}
              rows={inventory.pageItems}
              emptyLabel="Sin items de inventario sincronizados todavia."
            />
            <Pagination className="mt-3" page={inventory.page} pageCount={inventory.pageCount} onChange={inventory.setPage} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default function ShopifyDiagnosticoPage() {
  return (
    <PortalShell title="Diagnóstico Shopify">
      {(bootstrap) => <ShopifyDiagnosticoView bootstrap={bootstrap} />}
    </PortalShell>
  );
}
