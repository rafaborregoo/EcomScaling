"use client";

import { type FormEvent, useEffect, useState } from "react";
import { forecastStockDemand } from "@e-nora/contracts";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { formatMoney } from "@/lib/money";
import { Select, AsyncState, Pagination, EmptyState, ErrorBlock, ToggleGroup, ToggleGroupItem } from "@/components/ui";
import { cx } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import s from "./catalogo.module.css";
import type {
  CatalogFilter,
  CatalogProduct,
  CatalogProductsResponse,
  CatalogSort,
} from "../catalog-types";

type View = "list" | "grid";

const STATUSES: Array<{ value: string; label: string; count: (summary: NonNullable<CatalogProductsResponse["summary"]>) => number }> = [
  { value: "ACTIVE", label: "Activos", count: (summary) => summary.active },
  { value: "DRAFT", label: "Borradores", count: (summary) => summary.draft },
  { value: "ARCHIVED", label: "Archivados", count: (summary) => summary.archived },
  { value: "", label: "Todos", count: (summary) => summary.total },
];

const SORTS: Array<{ value: CatalogSort; label: string }> = [
  { value: "sales", label: "Más vendidos" },
  { value: "stock", label: "Menos stock" },
  { value: "margin", label: "Menor margen" },
  { value: "updated", label: "Actualizados" },
  { value: "name", label: "Nombre" },
];

const PERIODS = [30, 90, 365] as const;

function statusLabel(status: string | null) {
  return status === "DRAFT" ? "Borrador" : status === "ARCHIVED" ? "Archivado" : status === "DELETED" ? "Eliminado en Shopify" : status ?? "Sin estado";
}

function money(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  return currency ? formatMoney(value, currency) : `${fmtNum(value, 2)} (moneda no informada)`;
}

function priceText(product: CatalogProduct) {
  const m = product.metrics;
  if (!m || m.price_min == null) return "—";
  return m.price_max != null && m.price_max !== m.price_min
    ? `${money(m.price_min, product.currency_code)} – ${money(m.price_max, product.currency_code)}`
    : money(m.price_min, product.currency_code);
}

/** El aviso mas importante de un producto: una linea de texto, sin pildora. */
function productAlert(product: CatalogProduct, periodDays: number): { text: string; tone: string } | null {
  const m = product.metrics;
  if (!m) return null;
  if (m.tracked_variants > 0 && (m.stock_available ?? 0) <= 0) return { text: "Agotado", tone: s.bad };
  if (m.variants_out > 0) return { text: m.variants_out === 1 ? "1 variante agotada" : `${m.variants_out} variantes agotadas`, tone: s.bad };
  if (m.return_rate != null && m.return_rate >= 0.1 && m.units_ordered >= 10) return { text: `${fmtNum(m.return_rate * 100, 0)} % devuelto`, tone: s.bad };
  if (m.stock_available != null && m.stock_available > 0 && m.stock_available <= 5) return { text: `Quedan ${m.stock_available}`, tone: s.warn };
  if (product.status === "ACTIVE" && m.units_ordered === 0) return { text: `Sin ventas en ${periodDays} días`, tone: s.dim };
  return null;
}

function coverage(product: CatalogProduct) {
  const m = product.metrics;
  const tracked = (m?.tracked_variants ?? 0) > 0;
  const result = forecastStockDemand(product.weekly_units ?? [], m?.stock_available ?? null, tracked);
  const tone = result.risk === "high" ? s.bad : result.risk === "watch" ? s.warn : undefined;
  return {
    days: result.coverageDays == null ? "—" : Math.round(result.coverageDays) === 1 ? "1 día" : `${fmtNum(result.coverageDays, 0)} días`,
    perMonth: result.forecast30d == null ? null : `≈ ${fmtNum(result.forecast30d)}/mes`,
    tone,
  };
}

function marginCell(product: CatalogProduct) {
  const m = product.metrics;
  if (!m) return { text: "—", tone: s.dim };
  if (m.margin_pct != null) return { text: `${fmtNum(m.margin_pct * 100, 0)} %`, tone: m.margin_pct < 0.2 ? s.bad : m.margin_pct < 0.35 ? s.warn : undefined };
  if (m.variants_without_cost > 0) return { text: "Sin coste", tone: s.warn };
  return { text: "—", tone: s.dim };
}

function metaLine(product: CatalogProduct) {
  return [
    product.status === "ACTIVE" ? null : statusLabel(product.status),
    product.vendor,
    product.shopify_category_name || product.product_type,
    product.metrics && product.metrics.variants_total > 1 ? `${product.metrics.variants_total} variantes` : null,
  ].filter(Boolean).join(" · ");
}

function detailHref(productId: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/shopify/productos/${productId}?${params.toString()}`;
}

function Thumb({ product, className }: { product: CatalogProduct; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {product.primary_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.primary_image_url} alt="" loading="lazy" decoding="async" />
      ) : (
        product.title.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

function ProductList({ rows, href, periodDays }: { rows: CatalogProduct[]; href: (id: string) => string; periodDays: number }) {
  return (
    <table className={s.list}>
      <thead>
        <tr>
          <th scope="col">Producto</th>
          <th scope="col" className={s.num}>Precio</th>
          <th scope="col" className={cx(s.num, s.opt)}>Vendidas</th>
          <th scope="col" className={s.num}>Stock</th>
          <th scope="col" className={cx(s.num, s.opt)}>Cobertura</th>
          <th scope="col" className={cx(s.num, s.opt)}>Margen</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((product) => {
          const m = product.metrics;
          const alert = productAlert(product, periodDays);
          const cov = coverage(product);
          const margin = marginCell(product);
          const meta = metaLine(product);
          return (
            <tr key={product.id} className="task-lift">
              <td>
                <a className={s.prodLink} href={href(product.id)}>
                  <Thumb product={product} className={s.thumb} />
                  <span className={s.prodText}>
                    <span className={s.prodName}>{product.title}</span>
                    {meta ? <span className={s.dim}>{meta}</span> : null}
                    {alert ? <span className={alert.tone}>{alert.text}</span> : null}
                  </span>
                </a>
              </td>
              <td className={s.num}>{priceText(product)}</td>
              <td className={cx(s.num, s.opt)}>{m ? fmtNum(m.units_ordered) : "—"}</td>
              <td className={s.num}>{m?.stock_available == null ? <span className={s.dim}>—</span> : fmtNum(m.stock_available)}</td>
              <td className={cx(s.num, s.opt)}>
                <span className={cov.tone}>{cov.days}</span>
                {cov.perMonth ? <small className={s.dim}>{cov.perMonth}</small> : null}
              </td>
              <td className={cx(s.num, s.opt)}><span className={margin.tone}>{margin.text}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ProductGrid({ rows, href, periodDays }: { rows: CatalogProduct[]; href: (id: string) => string; periodDays: number }) {
  return (
    <ul className={s.tiles}>
      {rows.map((product) => {
        const m = product.metrics;
        const alert = productAlert(product, periodDays);
        const facts = m
          ? [`${fmtNum(m.units_ordered)} vendidas`, m.stock_available == null ? null : `${fmtNum(m.stock_available)} en stock`].filter(Boolean).join(" · ")
          : null;
        return (
          <li key={product.id}>
            <a className={`${s.tile} task-lift`} href={href(product.id)}>
              <Thumb product={product} className={s.tileImg} />
              <span className={s.prodName}>{product.title}</span>
              <span className={s.tilePrice}>{priceText(product)}</span>
              {facts ? <span className={s.dim}>{facts}</span> : null}
              {alert ? <span className={alert.tone}>{alert.text}</span> : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function CatalogContent() {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [filter, setFilter] = useState<CatalogFilter>("");
  const [sort, setSort] = useState<CatalogSort>("sales");
  const [view, setView] = useState<View>("list");
  const [periodDays, setPeriodDays] = useState<(typeof PERIODS)[number]>(90);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [organizationId, connectionId]);
  useEffect(() => {
    const requestedFilter = new URLSearchParams(window.location.search).get("filter");
    if (requestedFilter === "out" || requestedFilter === "low") setFilter(requestedFilter);
  }, []);

  const params = new URLSearchParams({ page: String(page), sort, periodDays: String(periodDays) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (filter) params.set("filter", filter);
  const key = organizationId
    ? `/v1/organizations/${organizationId}/shopify/catalog/products?${params.toString()}`
    : null;
  const query = useCachedQuery<CatalogProductsResponse>(key);
  const data = query.data;
  const summary = data?.summary ?? null;
  const metricsPending = data?.metrics_coverage === "migration_pending";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  }

  function pickFilter(next: CatalogFilter) {
    setFilter((current) => (current === next ? "" : next));
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const rows = data?.products ?? [];
  const from = data && data.total ? (page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(page * data.page_size, data.total) : 0;
  const href = (id: string) => detailHref(id, organizationId ?? "", connectionId);

  // Las alertas solo aparecen si hay algo que mirar; el total siempre.
  const alerts: Array<{ key: CatalogFilter; label: string; value: number; tone?: string }> = summary
    ? [
        { key: "out" as const, label: "sin stock", value: summary.out_of_stock, tone: s.bad },
        { key: "low" as const, label: "stock bajo", value: summary.low_stock, tone: s.warn },
        { key: "no_cost" as const, label: "sin coste", value: summary.without_cost, tone: s.warn },
        { key: "no_sales" as const, label: `sin ventas en ${periodDays} días`, value: summary.without_sales },
      ].filter((item) => item.value > 0 || filter === item.key)
    : [];

  return (
    <div className={cx(pulse.root, s.cat)}>
      <header className={`${s.top} client-sr-title`}>
        <h1>Productos</h1>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona un cliente" hint="Elige una organización en la barra superior para consultar su catálogo." />
      ) : (
        <>
          <div className={s.toolbar}>
            <form className={s.find} role="search" onSubmit={submitSearch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar por nombre, SKU, proveedor o tipo" aria-label="Buscar productos" />
            </form>
            <div className={s.controls}>
              <Select bare className="w-auto" value={status} onChange={(value) => { setStatus(value); setPage(1); }} aria-label="Estado" options={STATUSES.map((item) => ({ value: item.value, label: summary ? `${item.label} (${fmtNum(item.count(summary))})` : item.label }))} />
              <Select bare className="w-auto" value={sort} onChange={(value) => { setSort(value as CatalogSort); setPage(1); }} aria-label="Ordenar por" disabled={metricsPending} options={SORTS} />
              <Select bare className="w-auto" value={String(periodDays)} onChange={(value) => { setPeriodDays(Number(value) as (typeof PERIODS)[number]); setPage(1); }} aria-label="Periodo de ventas" options={PERIODS.map((p) => ({ value: String(p), label: p === 365 ? "Último año" : `Últimos ${p} días` }))} />
              <ToggleGroup aria-label="Vista" value={view} onValueChange={setView}>
                <ToggleGroupItem value="list" size="icon-sm" aria-label="Lista" title="Lista">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" size="icon-sm" aria-label="Cuadrícula" title="Cuadrícula">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {summary ? (
            <ToggleGroup aria-label="Filtrar por aviso" className={s.alerts} spacing={1.5} value={filter} onValueChange={pickFilter}>
              <ToggleGroupItem value="">
                <b>{fmtNum(data?.total ?? summary.total)}</b> productos
              </ToggleGroupItem>
              {alerts.map((item) => (
                <ToggleGroupItem key={item.key} value={item.key}>
                  <b className={item.tone}>{fmtNum(item.value)}</b> {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          {metricsPending ? (
            <p className={pulse.error}>Las ventas, el stock y el margen por producto estarán disponibles cuando se aplique la migración de métricas del catálogo. Mientras tanto se muestra el catálogo sin ordenar por ellas.</p>
          ) : null}
          {data?.metrics_coverage === "unavailable" ? (
            <p className={pulse.error}>No se pudieron cargar las métricas de los productos. No significa que no tengan ventas: reintenta en un rato.</p>
          ) : null}
          {query.error && !data ? <ErrorBlock onRetry={() => query.reload()}>No se han podido cargar los datos. Inténtalo de nuevo en unos segundos.</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando productos…" /> : null}

          {data && rows.length === 0 ? (
            <p className={cx(s.dim, s.none)}>No hay productos con estos filtros. Si acabas de conectar la tienda, revisa la sincronización.</p>
          ) : null}

          {data && rows.length ? (
            view === "list"
              ? <ProductList rows={rows} href={href} periodDays={periodDays} />
              : <ProductGrid rows={rows} href={href} periodDays={periodDays} />
          ) : null}

          {data && data.total ? (
            <div className={s.pages}>
              <span className={s.dim}>
                {fmtNum(from)}–{fmtNum(to)} de {fmtNum(data.total)} · ventas, devoluciones y margen de los últimos {periodDays} días sincronizados
              </span>
              {totalPages > 1 ? (
                <Pagination page={page} pageCount={totalPages} onChange={setPage} />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ShopifyProductsPage() {
  return <PortalShell title="Productos Shopify">{() => <CatalogContent />}</PortalShell>;
}
