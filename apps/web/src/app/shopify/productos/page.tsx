"use client";

import { type FormEvent, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { formatMoney } from "@/lib/money";
import { AsyncState, EmptyState, ErrorBlock } from "@/components/ui";
import { cx, Spark } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import s from "./catalogo.module.css";
import type {
  CatalogFilter,
  CatalogProduct,
  CatalogProductsResponse,
  CatalogSort,
} from "../catalog-types";

type View = "grid" | "table";

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
  { value: "updated", label: "Actualizados recientemente" },
  { value: "name", label: "Nombre" },
];

const PERIODS = [30, 90, 365] as const;

function statusLabel(status: string | null) {
  return status === "ACTIVE" ? "Activo" : status === "DRAFT" ? "Borrador" : status === "ARCHIVED" ? "Archivado" : status === "DELETED" ? "Eliminado en Shopify" : status ?? "Sin estado";
}

function statusChip(status: string | null) {
  return status === "ACTIVE" ? pulse.chipGood : status === "DRAFT" ? pulse.chipWarn : undefined;
}

function money(value: number | null | undefined, currency: string | null, decimals = 2) {
  if (value == null) return "—";
  return currency ? formatMoney(value, currency) : `${fmtNum(value, decimals)} (moneda no informada)`;
}

function priceText(product: CatalogProduct) {
  const m = product.metrics;
  if (!m || m.price_min == null) return "—";
  return m.price_max != null && m.price_max !== m.price_min
    ? `${money(m.price_min, product.currency_code)} – ${money(m.price_max, product.currency_code)}`
    : money(m.price_min, product.currency_code);
}

const marginChip = (pct: number) => (pct < 0.2 ? pulse.chipBad : pct < 0.35 ? pulse.chipWarn : pulse.chipGood);

/** El aviso mas importante de un producto, para la esquina de su foto. */
function productAlert(product: CatalogProduct, periodDays: number): { text: string; tone: string | undefined } | null {
  const m = product.metrics;
  if (!m) return null;
  if (m.tracked_variants > 0 && (m.stock_available ?? 0) <= 0) return { text: "Agotado", tone: pulse.chipBad };
  if (m.variants_out > 0) return { text: m.variants_out === 1 ? "1 variante agotada" : `${m.variants_out} variantes agotadas`, tone: pulse.chipBad };
  if (m.return_rate != null && m.return_rate >= 0.1 && m.units_ordered >= 10) return { text: `${fmtNum(m.return_rate * 100, 0)} % devuelve`, tone: pulse.chipBad };
  if (m.stock_available != null && m.stock_available > 0 && m.stock_available <= 5) return { text: `Quedan ${m.stock_available}`, tone: pulse.chipWarn };
  if (product.status === "ACTIVE" && m.units_ordered === 0) return { text: `Sin ventas ${periodDays} d`, tone: undefined };
  return null;
}

function Thumb({ product, className }: { product: CatalogProduct; className: string }) {
  return (
    <span className={className}>
      {product.primary_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.primary_image_url} alt={product.primary_image_alt || product.title} loading="lazy" decoding="async" />
      ) : null}
    </span>
  );
}

function MarginChip({ product }: { product: CatalogProduct }) {
  const m = product.metrics;
  if (!m) return null;
  if (m.margin_pct != null) return <span className={cx(pulse.chip, marginChip(m.margin_pct))}>margen {fmtNum(m.margin_pct * 100, 0)} %</span>;
  if (m.variants_without_cost > 0) return <span className={cx(pulse.chip, pulse.chipWarn)}>sin coste</span>;
  return <span className={pulse.chip}>sin ventas para el margen</span>;
}

function detailHref(productId: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/shopify/productos/${productId}?${params.toString()}`;
}

function ProductCard({ product, href, periodDays }: { product: CatalogProduct; href: string; periodDays: number }) {
  const m = product.metrics;
  const alert = productAlert(product, periodDays);
  const sold = m && (m.units_ordered > 0 || product.status === "ACTIVE") ? fmtNum(m.units_ordered) : "—";
  const stockText = m?.stock_available == null ? "—" : fmtNum(m.stock_available);
  const stockTone = m && m.stock_available != null ? ((m.tracked_variants > 0 && m.stock_available <= 0) ? "var(--bad)" : m.stock_available <= 5 ? "var(--warn)" : undefined) : undefined;
  return (
    <a className={s.card} href={href} aria-label={`Abrir ficha de ${product.title}`}>
      <div className={s.img}>
        {product.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.primary_image_url} alt={product.primary_image_alt || product.title} loading="lazy" decoding="async" />
        ) : (
          "Sin foto"
        )}
        <span className={cx(pulse.chip, statusChip(product.status), s.imgSt)}>{statusLabel(product.status)}</span>
        {alert ? <span className={cx(pulse.chip, alert.tone, s.imgWarn)}>{alert.text}</span> : null}
      </div>
      <div className={s.body}>
        <div>
          <p className={s.name}>{product.title}</p>
          <p className={s.meta}>
            {[product.vendor, product.shopify_category_name || product.product_type, m ? `${m.variants_total} variante${m.variants_total === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className={s.price}>
          <b>{priceText(product)}</b>
          <MarginChip product={product} />
        </div>
        <div className={s.stats}>
          <div><span>Vendidas</span><span>{sold}</span></div>
          <div><span>Stock</span><span style={{ color: stockTone }}>{stockText}</span></div>
          <div>
            <span>Devol.</span>
            <span style={{ color: m?.return_rate != null && m.return_rate >= 0.1 ? "var(--bad)" : undefined }}>{m?.return_rate != null ? `${fmtNum(m.return_rate * 100, 1)} %` : "—"}</span>
          </div>
        </div>
        {product.weekly_units && product.weekly_units.some((value) => value > 0) ? <Spark values={product.weekly_units} /> : null}
        {product.status === "DRAFT" ? <p className={s.meta}>Sin publicar: no recibe ventas todavía.</p> : null}
      </div>
    </a>
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
  const [view, setView] = useState<View>("grid");
  const [periodDays, setPeriodDays] = useState<(typeof PERIODS)[number]>(90);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [organizationId, connectionId]);

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

  const tiles: Array<{ key: CatalogFilter; label: string; value: number; hint: string; tone?: string }> = summary
    ? [
        { key: "", label: "Productos", value: summary.total, hint: `${summary.active} activos · ${summary.draft} borradores · ${summary.archived} archivados` },
        { key: "out", label: "Sin stock", value: summary.out_of_stock, hint: "activos con 0 disponibles", tone: summary.out_of_stock ? "var(--bad)" : undefined },
        { key: "low", label: "Stock bajo", value: summary.low_stock, hint: "5 unidades o menos", tone: summary.low_stock ? "var(--warn)" : undefined },
        { key: "no_cost", label: "Sin coste", value: summary.without_cost, hint: "el margen no se puede calcular", tone: summary.without_cost ? "var(--warn)" : undefined },
        { key: "no_sales", label: `Sin ventas en ${periodDays} días`, value: summary.without_sales, hint: "activos que no se mueven" },
      ]
    : [];

  return (
    <div className={pulse.root}>
      <header className={s.top}>
        <div>
          <nav className={s.crumb} aria-label="Ruta" style={{ padding: 0 }}>
            <a href="/shopify">Analítica</a>
            <span aria-hidden="true">/</span>
            <a href="/shopify">Shopify</a>
            <span aria-hidden="true">/</span>
            <span>Productos</span>
          </nav>
          <h1>Catálogo</h1>
          <div className={s.topMeta}>
            <span className={pulse.chip}>{connectionId ? "Tienda seleccionada" : "Todas las tiendas"}</span>
            {data ? <span className={pulse.chip}>{fmtNum(data.total)} productos</span> : null}
          </div>
        </div>
        <a className={cx(pulse.btn, pulse.ghost)} href="/shopify">
          Volver a Shopify
        </a>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona un cliente" hint="Elige una organización en la barra superior para consultar su catálogo." />
      ) : (
        <>
          {tiles.length ? (
            <div className={s.sum} role="group" aria-label="Resumen del catálogo">
              {tiles.map((tile) => (
                <button key={tile.label} type="button" className={s.sumC} aria-pressed={filter === tile.key && tile.key !== ""} onClick={() => pickFilter(tile.key)}>
                  <span className={pulse.lbl}>{tile.label}</span>
                  <strong style={{ color: tile.tone }}>{fmtNum(tile.value)}</strong>
                  <small>{tile.hint}</small>
                </button>
              ))}
            </div>
          ) : null}

          <div className={s.bar}>
            <form className={s.search} role="search" onSubmit={submitSearch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar por nombre, SKU, proveedor o tipo" aria-label="Buscar productos" />
            </form>
            <div className={s.barR}>
              <div className={pulse.seg} role="group" aria-label="Estado">
                {STATUSES.map((item) => (
                  <button key={item.value || "all"} type="button" aria-pressed={status === item.value} onClick={() => { setStatus(item.value); setPage(1); }}>
                    {item.label}
                    {summary ? <b>{fmtNum(item.count(summary))}</b> : null}
                  </button>
                ))}
              </div>
              <label className={s.selectL}>
                Ordenar
                <select value={sort} onChange={(event) => { setSort(event.target.value as CatalogSort); setPage(1); }} aria-label="Ordenar por" disabled={data?.metrics_coverage === "migration_pending"}>
                  {SORTS.map((item) => (
                    <option key={item.value} value={item.value}>{item.value === "sales" ? `${item.label} (${periodDays} días)` : item.label}</option>
                  ))}
                </select>
              </label>
              <div className={pulse.seg} role="group" aria-label="Periodo de ventas">
                {PERIODS.map((p) => (
                  <button key={p} type="button" aria-pressed={periodDays === p} onClick={() => { setPeriodDays(p); setPage(1); }}>
                    {p === 365 ? "1 año" : `${p} d`}
                  </button>
                ))}
              </div>
              <div className={pulse.seg} role="group" aria-label="Vista">
                <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Tarjetas</button>
                <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Tabla</button>
              </div>
            </div>
          </div>

          {data?.metrics_coverage === "migration_pending" ? (
            <p className={pulse.error}>Las ventas, el stock y el margen por producto estarán disponibles cuando se aplique la migración de métricas del catálogo. Mientras tanto se muestra el catálogo sin ordenar por ellas.</p>
          ) : null}
          {data?.metrics_coverage === "unavailable" ? (
            <p className={pulse.error}>No se pudieron cargar las métricas de los productos. No significa que no tengan ventas: reintenta en un rato.</p>
          ) : null}
          {query.error && !data ? <ErrorBlock>{query.error}</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando productos…" /> : null}

          {data && rows.length === 0 ? (
            <div className={pulse.panel}>
              <p className={pulse.empty}>No hay productos con estos filtros. Si acabas de conectar la tienda, revisa la sincronización.</p>
            </div>
          ) : null}

          {data && rows.length && view === "grid" ? (
            <div className={s.grid}>
              {rows.map((product) => (
                <ProductCard key={product.id} product={product} periodDays={periodDays} href={detailHref(product.id, organizationId, connectionId)} />
              ))}
            </div>
          ) : null}

          {data && rows.length && view === "table" ? (
            <div className={pulse.panel}>
              <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
                <table className={pulse.tbl}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Estado</th>
                      <th>Tienda</th>
                      <th style={{ textAlign: "right" }}>Precio</th>
                      <th style={{ textAlign: "right" }}>Margen</th>
                      <th style={{ textAlign: "right" }}>Vendidas</th>
                      <th style={{ textAlign: "right" }}>Stock</th>
                      <th style={{ textAlign: "right" }}>Devol.</th>
                      <th>Actualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product) => {
                      const m = product.metrics;
                      const stock = m?.stock_available;
                      const stockColor = m && stock != null ? ((m.tracked_variants > 0 && stock <= 0) ? "var(--bad)" : stock <= 5 ? "var(--warn)" : "var(--good)") : "var(--ink-3)";
                      return (
                        <tr key={product.id}>
                          <td>
                            <a className={s.prod} href={detailHref(product.id, organizationId, connectionId)} aria-label={`Abrir ficha de ${product.title}`}>
                              <Thumb product={product} className={s.th} />
                              <span>
                                <b style={{ fontWeight: 600 }}>{product.title}</b>
                                <br />
                                <span className={pulse.muted} style={{ fontSize: 12 }}>
                                  {[product.vendor, product.shopify_category_name || product.product_type, m ? `${m.variants_total} variantes` : null].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                            </a>
                          </td>
                          <td><span className={cx(pulse.chip, statusChip(product.status))}>{statusLabel(product.status)}</span></td>
                          <td>{product.store_name}</td>
                          <td className={pulse.tdN}>{priceText(product)}</td>
                          <td className={pulse.tdN}><MarginChip product={product} /></td>
                          <td className={pulse.tdN}>{m ? fmtNum(m.units_ordered) : "—"}</td>
                          <td className={pulse.tdN}>
                            <span className={s.stockBar}>
                              <span style={{ color: stockColor }}>{stock == null ? "—" : fmtNum(stock)}</span>
                              <i><b style={{ width: `${stock == null ? 0 : Math.min(stock / 100, 1) * 100}%`, background: stockColor }} /></i>
                            </span>
                          </td>
                          <td className={pulse.tdN} style={{ color: m?.return_rate != null && m.return_rate >= 0.1 ? "var(--bad)" : undefined }}>{m?.return_rate != null ? `${fmtNum(m.return_rate * 100, 1)} %` : "—"}</td>
                          <td className={pulse.muted}>{product.external_updated_at ? new Date(product.external_updated_at).toLocaleDateString("es-ES") : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {data ? (
            <div className={s.pager}>
              <span className={pulse.muted} style={{ fontSize: 12.5 }}>
                {data.total ? `Mostrando ${fmtNum(from)}–${fmtNum(to)} de ${fmtNum(data.total)}` : "Sin resultados"} · página {page} de {totalPages}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
                <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
              </div>
            </div>
          ) : null}

          <footer className={s.foot}>
            <span>Catálogo sincronizado de Shopify. Ventas, devoluciones y margen: pedidos sincronizados de los últimos {periodDays} días, no necesariamente todo el historial.</span>
          </footer>
        </>
      )}
    </div>
  );
}

export default function ShopifyProductsPage() {
  return <PortalShell title="Productos Shopify">{() => <CatalogContent />}</PortalShell>;
}
