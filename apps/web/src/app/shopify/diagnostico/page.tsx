"use client";

import { useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { useShopifyOverview } from "@/hooks/use-shopify-overview";
import { usePaginatedUrl } from "@/hooks/use-paginated-url";
import { Banner, ErrorBlock, Heading, Link, LoadingBlock, Pagination, Tabs } from "@/components/ui";

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

  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  const { overview, isLoading, error } = useShopifyOverview(organization?.id, selectedConnectionId);

  const products = usePaginatedUrl(overview?.samples.products ?? [], PAGE_SIZE, "page_productos");
  const orders = usePaginatedUrl(overview?.samples.orders ?? [], PAGE_SIZE, "page_pedidos");
  const inventory = usePaginatedUrl(overview?.samples.inventory ?? [], PAGE_SIZE, "page_inventario");

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
        <Link href="/shopify">← Volver a Shopify</Link>
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

          <section className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs uppercase tracking-wide text-muted">Conexion</td>
                  <td className="py-3 font-medium">{overview.connection?.status ?? "sin_conexion"}</td>
                  <td className="py-3 text-muted">{overview.connection?.provider_account_id ?? "Tienda pendiente"}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs uppercase tracking-wide text-muted">Tienda</td>
                  <td className="py-3 font-medium">{overview.store?.shop_name ?? "Sin tienda"}</td>
                  <td className="py-3 text-muted">{overview.store?.primary_domain ?? "sin dominio primario"}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs uppercase tracking-wide text-muted">Ultimo sync</td>
                  <td className="py-3 font-medium">{overview.sync_runs[0]?.status ?? "sin_sync"}</td>
                  <td className="py-3 text-muted">{formatDate(overview.sync_runs[0]?.finished_at)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs uppercase tracking-wide text-muted">Registros escritos</td>
                  <td className="py-3 font-mono font-medium">{overview.sync_runs[0]?.records_written ?? 0}</td>
                  <td className="py-3 text-muted">en el último sync</td>
                </tr>
              </tbody>
            </table>
          </section>
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

          <section className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line font-mono text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Bloque</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Registros</th>
                  <th className="py-2 pr-4 font-medium">Ultima corrida</th>
                  <th className="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(Object.keys(syncBlockLabels) as Array<keyof typeof syncBlockLabels>).map((blockKey) => {
                  const block = overview.sync_blocks?.[blockKey] ?? null;
                  return (
                    <tr key={blockKey}>
                      <td className="py-2.5 pr-4 font-medium">{syncBlockLabels[blockKey]}</td>
                      <td className={["py-2.5 pr-4 font-mono text-xs uppercase", blockStatusClass(block?.status)].join(" ")}>
                        {blockStatusLabel(block?.status)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono">{block?.records_written ?? 0}</td>
                      <td className="py-2.5 pr-4 text-muted">{formatDate(block?.finished_at)}</td>
                      <td className="py-2.5 font-mono text-xs break-words text-brand-deep">
                        {block?.error_message ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === "permisos" ? (
        <div className="space-y-5">
          <section className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line font-mono text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Scope</th>
                  <th className="py-2 pr-4 font-medium">Area</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 font-medium">Permite calcular</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.scope_catalog.map((item) => {
                  const isAuthorized = authorizedScopes.has(item.scope);
                  return (
                    <tr key={item.scope}>
                      <td className="py-2.5 pr-4 font-mono text-xs">{item.scope}</td>
                      <td className="py-2.5 pr-4">{item.area}</td>
                      <td className={["py-2.5 pr-4 font-mono text-xs uppercase", isAuthorized ? "text-black" : "text-brand"].join(" ")}>
                        {isAuthorized ? "autorizado" : "no concedido"}
                      </td>
                      <td className="py-2.5 text-muted">{item.enables.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line font-mono text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Bloque de datos</th>
                  <th className="py-2 pr-4 font-medium">Tabla</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 font-medium">Registros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.datasets.map((dataset) => (
                  <tr key={dataset.key}>
                    <td className="py-2.5 pr-4 font-medium">{dataset.label}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-brand">{dataset.table ?? "pendiente_modelo"}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs uppercase text-muted">
                      {dataset.status === "active" ? "guardando datos" : "pendiente de modelo"}
                    </td>
                    <td className="py-2.5 font-mono">{dataset.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === "muestras" ? (
        <div className="space-y-8">
          <section>
            <Heading size="md">Productos ({overview.samples.products.length})</Heading>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-line font-mono text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Producto</th>
                    <th className="py-2 pr-4 font-medium">Vendor</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 font-medium">Actualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {products.pageItems.map((product) => (
                    <tr key={product.id}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{product.title}</p>
                        <p className="font-mono text-xs text-muted">{product.handle ?? "sin_handle"}</p>
                      </td>
                      <td className="py-2.5 pr-4">{product.vendor ?? "n/a"}</td>
                      <td className="py-2.5 pr-4">{product.product_type ?? "n/a"}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-brand">{product.status ?? "n/a"}</td>
                      <td className="py-2.5">{formatDate(product.external_updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination className="mt-3" page={products.page} pageCount={products.pageCount} onChange={products.setPage} />
          </section>

          <section>
            <Heading size="md">Pedidos ({overview.samples.orders.length})</Heading>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-line font-mono text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Pedido</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 pr-4 font-medium">Fecha</th>
                    <th className="py-2 pr-4 font-medium">Total</th>
                    <th className="py-2 font-medium">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.pageItems.map((order) => (
                    <tr key={order.id}>
                      <td className="py-2.5 pr-4 font-medium">{order.order_name ?? "Pedido sin nombre"}</td>
                      <td className="py-2.5 pr-4 text-muted">
                        {order.financial_status ?? "n/a"} / {order.fulfillment_status ?? "n/a"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted">{formatDate(order.processed_at)}</td>
                      <td className="py-2.5 pr-4 font-mono">{formatMoney(order.current_total_price, currency)}</td>
                      <td className="py-2.5 font-mono text-brand">{formatMoney(order.net_sales, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination className="mt-3" page={orders.page} pageCount={orders.pageCount} onChange={orders.setPage} />
          </section>

          <section>
            <Heading size="md">Inventory items ({overview.samples.inventory.length})</Heading>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-line font-mono text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">SKU</th>
                    <th className="py-2 pr-4 font-medium">Tracked</th>
                    <th className="py-2 pr-4 font-medium">Shipping</th>
                    <th className="py-2 font-medium">Coste unitario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {inventory.pageItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-4 font-mono">{item.sku ?? "sin_sku"}</td>
                      <td className="py-2.5 pr-4 text-muted">{String(item.tracked)}</td>
                      <td className="py-2.5 pr-4 text-muted">{String(item.requires_shipping)}</td>
                      <td className="py-2.5 font-mono">
                        {item.current_unit_cost
                          ? formatMoney(item.current_unit_cost, item.cost_currency_code ?? currency)
                          : "sin_coste"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
