"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCopilotAsk } from "@/components/copilot-ask";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { formatMoney } from "@/lib/money";
import { apiFetch, invalidateApiGetCache, type BootstrapResponse } from "@/lib/bootstrap";
import { AsyncState, Card, ErrorBlock } from "@/components/ui";
import { cx, Empty, SectionHead } from "../../../dashboard/client-pulse";
import { fmtNum } from "../../../dashboard/client-pulse-model";
import pulse from "../../../dashboard/client-pulse.module.css";
import s from "../catalogo.module.css";
import type { CatalogProductDetailResponse, CatalogVariant } from "../../catalog-types";

const PERIODS = [30, 90, 365] as const;
type Period = (typeof PERIODS)[number];

function money(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  return currency ? formatMoney(value, currency) : "Moneda no informada";
}

function statusLabel(status: string | null) {
  return status === "ACTIVE" ? "Activo" : status === "DRAFT" ? "Borrador" : status === "ARCHIVED" ? "Archivado" : status === "DELETED" ? "Eliminado en Shopify" : status ?? "Sin estado";
}

function mediaCoverageLabel(status: string, imageCount: number, lastFullSyncAt: string | null) {
  const lastFullSync = lastFullSyncAt
    ? ` Última cobertura completa: ${new Date(lastFullSyncAt).toLocaleString("es-ES").toLowerCase()}.`
    : "";
  switch (status) {
    case "migration_pending": return "La galería estará disponible cuando se aplique el esquema de cobertura de medios.";
    case "running": return `La galería se está sincronizando. ${imageCount} imágenes visibles.${lastFullSync}`;
    case "complete": return `${imageCount} imágenes · galería completa.${lastFullSync}`;
    case "partial": return `${imageCount} imágenes observadas; la galería está incompleta y pueden faltar elementos.${lastFullSync}`;
    case "failed": return `${imageCount} imágenes guardadas; falló el último intento y podrían estar desactualizadas.${lastFullSync}`;
    case "unavailable": return "No se pudo consultar la cobertura; las imágenes visibles pueden estar desactualizadas.";
    default: return imageCount ? `${imageCount} imágenes guardadas; todavía no hay una cobertura completa registrada.` : "La ficha conserva el resto de los datos mientras se sincroniza la galería.";
  }
}

function changeText(current: number, previous: number | null) {
  if (previous == null) return "pedidos sincronizados";
  if (previous === 0) return current === 0 ? "igual que el periodo anterior" : "sin ventas en el periodo anterior";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${fmtNum(change, 0)} % vs. anterior`;
}

const coverChip = (days: number | null, available: number) =>
  available <= 0 ? { text: "agotada", tone: pulse.chipBad, color: "var(--bad)" }
  : days == null ? { text: "sin ritmo", tone: undefined, color: "var(--ink-3)" }
  : days <= 3 ? { text: `${Math.max(Math.round(days), 1)} ${Math.round(days) <= 1 ? "día" : "días"}`, tone: pulse.chipBad, color: "var(--bad)" }
  : days <= 7 ? { text: `${Math.round(days)} días`, tone: pulse.chipWarn, color: "var(--warn)" }
  : { text: days > 30 ? "+30 días" : `${Math.round(days)} días`, tone: pulse.chipGood, color: "var(--good)" };

function weekLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Coste de la variante: se carga por SKU (mismo endpoint que /shopify). */
function CostCell({ variant, currency, organizationId, onSaved }: { variant: CatalogVariant; currency: string | null; organizationId: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sku = variant.inventory?.sku ?? null;
  const cost = variant.inventory?.current_unit_cost ?? null;

  async function save() {
    if (!sku || value === "") return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/shopify/product-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, unitCost: Number(value) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
        setError(body?.message ?? body?.error ?? `HTTP ${response.status}`);
        return;
      }
      setEditing(false);
      setValue("");
      onSaved();
    } catch {
      setError("No se pudo guardar. Revisa la conexión.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div>
        <div className={s.costCell}>
          <input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} aria-label={`Coste de ${variant.title ?? "la variante"}`} placeholder="0,00" />
          <button type="button" className={cx(pulse.btn, pulse.sm)} disabled={saving || value === ""} onClick={() => void save()}>{saving ? "…" : "Guardar"}</button>
          <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} onClick={() => setEditing(false)}>Cancelar</button>
        </div>
        {error ? <p className={pulse.sub} style={{ color: "var(--bad)", textAlign: "right" }}>{error}</p> : null}
      </div>
    );
  }
  return (
    <div className={s.costCell}>
      {cost != null ? <span className={pulse.num}>{money(cost, variant.inventory?.cost_currency_code ?? currency)}</span> : null}
      {sku ? (
        <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} onClick={() => setEditing(true)}>{cost != null ? "Editar" : "Añadir coste"}</button>
      ) : cost == null ? (
        <span className={pulse.muted} title="El coste se carga por SKU">Sin SKU</span>
      ) : null}
    </div>
  );
}

function ProductDetail({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const params = useParams<{ productId: string }>();
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const ask = useCopilotAsk();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId && bootstrap.memberships.some((item) => item.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId
    ? (searchParams.get("connectionId") ?? "")
    : activeConnection.connectionId;
  const [page, setPage] = useState(1);
  const [periodDays, setPeriodDays] = useState<Period>(90);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  useEffect(() => setPage(1), [organizationId, connectionId, params.productId]);

  const queryParams = new URLSearchParams({ page: String(page), periodDays: String(periodDays) });
  if (connectionId) queryParams.set("connectionId", connectionId);
  const key = organizationId
    ? `/v1/organizations/${organizationId}/shopify/catalog/products/${encodeURIComponent(params.productId)}?${queryParams.toString()}`
    : null;
  const query = useCachedQuery<CatalogProductDetailResponse>(key);
  const data = query.data;
  const currency = data?.product.currency_code ?? null;
  const selectedMedia = data?.media.find((item) => item.external_media_id === selectedMediaId) ?? data?.media[0] ?? null;
  const totalPages = data ? Math.max(1, Math.ceil(data.variant_total / data.variant_page_size)) : 1;

  function returnToCatalog() {
    if (organizationId) activeOrganization.setOrganizationId(organizationId);
    activeConnection.setConnectionId(connectionId);
  }

  function reloadAfterCost() {
    if (!organizationId) return;
    invalidateApiGetCache();
    invalidateCachedQueries(`/v1/organizations/${organizationId}/shopify`);
    query.reload();
  }

  if (!organizationId) {
    return (
      <div className={pulse.root}>
        <Card title="Selecciona un cliente" description="Elige una organización en la barra superior." />
      </div>
    );
  }
  if (query.error && !data) {
    return (
      <div className={pulse.root}>
        <Card title="No se pudo abrir el producto"><ErrorBlock>{query.error}</ErrorBlock></Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className={pulse.root}>
        <AsyncState status="loading" loadingLabel="Cargando ficha del producto…" />
      </div>
    );
  }

  // ---- derivados ----
  const { product, variants, product_activity: activity, bundle_parent_activity: bundleActivity } = data;
  const pm = data.product_metrics ?? null;
  const observed = activity.status === "observed_only";
  const unitsOrdered = observed ? activity.units_ordered : null;
  const unitsRefunded = observed ? activity.units_refunded : null;
  const returnRate = unitsOrdered ? (unitsRefunded ?? 0) / unitsOrdered : null;
  const totalStock = pm?.stock_available ?? (variants.some((v) => v.inventory?.tracked) ? variants.reduce((sum, v) => sum + (v.cover?.available ?? 0), 0) : null);
  const paceDays = pm?.units_per_day_14d && pm.units_per_day_14d > 0 && totalStock != null ? totalStock / pm.units_per_day_14d : null;
  const prices = variants.map((v) => v.current_price).filter((value): value is number => value != null);
  const priceMin = pm?.price_min ?? (prices.length ? Math.min(...prices) : null);
  const priceMax = pm?.price_max ?? (prices.length ? Math.max(...prices) : null);
  const compareAt = variants.map((v) => v.compare_at_price).filter((value): value is number => value != null && priceMin != null && value > priceMin);
  const compareMax = compareAt.length ? Math.max(...compareAt) : null;
  const variantsWithoutCost = pm?.variants_without_cost ?? variants.filter((v) => v.inventory?.current_unit_cost == null).length;
  const trackedCount = variants.filter((v) => v.inventory?.tracked).length;
  const lastReading = variants.flatMap((v) => v.inventory_levels.map((level) => level.updated_at)).sort().at(-1) ?? null;
  const weekly = data.weekly ?? null;
  const weeklyMax = weekly ? Math.max(...weekly.map((w) => w.units_ordered + w.units_refunded), 1) : 1;

  const askCopilot = (question: string, focusLabel: string) =>
    ask({ question: `${question} (producto «${product.title}», últimos ${periodDays} días)`, focusLabel });

  // Matriz opcion 1 x opcion 2 (p. ej. color x talla) con las variantes de esta pagina.
  const optionNames = [...new Set(variants.flatMap((v) => v.selected_options.map((o) => o.name)))];
  const [rowName, colName] = optionNames;
  const optionValue = (variant: CatalogVariant, name: string) => variant.selected_options.find((o) => o.name === name)?.value ?? "";
  const rowValues = rowName ? [...new Set(variants.map((v) => optionValue(v, rowName)))] : [];
  const colValues = colName ? [...new Set(variants.map((v) => optionValue(v, colName)))] : [];
  const showMatrix = Boolean(rowName && colName) && rowValues.length > 0 && colValues.length > 0 && data.variant_total <= data.variant_page_size;
  const cell = (row: string, col: string) => {
    const group = variants.filter((v) => optionValue(v, rowName!) === row && optionValue(v, colName!) === col);
    if (!group.length) return null;
    return {
      units: group.reduce((sum, v) => sum + (v.activity?.units_ordered ?? 0), 0),
      available: group.reduce((sum, v) => sum + (v.cover?.available ?? 0), 0),
      tracked: group.some((v) => v.inventory?.tracked),
    };
  };
  const matrixMax = Math.max(1, ...rowValues.flatMap((row) => colValues.map((col) => cell(row, col)?.units ?? 0)));

  // Stock por ubicacion, sumando las variantes de esta pagina.
  const byLocation = new Map<string, { available: number; committed: number; incoming: number }>();
  for (const variant of variants) {
    for (const level of variant.inventory_levels) {
      const row = byLocation.get(level.location_name) ?? { available: 0, committed: 0, incoming: 0 };
      row.available += level.available_quantity ?? 0;
      row.committed += level.committed_quantity ?? 0;
      row.incoming += level.incoming_quantity ?? 0;
      byLocation.set(level.location_name, row);
    }
  }

  const coverRows = variants
    .filter((v) => v.cover?.tracked)
    .map((v) => ({ id: v.id, title: v.title || "Variante predeterminada", cover: v.cover! }))
    .sort((a, b) => (a.cover.available <= 0 ? -1 : a.cover.days_of_cover ?? 9999) - (b.cover.available <= 0 ? -1 : b.cover.days_of_cover ?? 9999))
    .slice(0, 8);

  const hasBundleComponents = variants.some((variant) => variant.bundle_components?.length);
  const copurchase = data.copurchase;

  return (
    <div className={pulse.root}>
      <nav className={s.crumb} aria-label="Ruta">
        <a href="/shopify">Shopify</a>
        <span aria-hidden="true">/</span>
        <Link href="/shopify/productos" onClick={returnToCatalog}>Productos</Link>
        <span aria-hidden="true">/</span>
        <span>{product.title}</span>
      </nav>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.fHero} aria-labelledby="producto-titulo">
        <div className={s.gal}>
          <div className={s.main}>
            {selectedMedia?.source_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedMedia.source_url} alt={selectedMedia.alt_text || product.title} />
            ) : (
              data.media.length ? "No se pudo cargar esta imagen" : "Sin imágenes sincronizadas"
            )}
          </div>
          {data.media.length > 1 ? (
            <div className={s.thumbs} role="group" aria-label="Galería">
              {data.media.slice(0, 10).map((item) => (
                <button key={item.external_media_id} type="button" aria-label={`Ver ${item.alt_text || product.title}`} aria-pressed={selectedMedia?.external_media_id === item.external_media_id} onClick={() => setSelectedMediaId(item.external_media_id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.source_url ? <img src={item.source_url} alt="" loading="lazy" decoding="async" /> : null}
                </button>
              ))}
            </div>
          ) : null}
          <p className={s.galNote}>{mediaCoverageLabel(data.media_coverage, data.media.length, data.media_sync.last_successful_full_sync_at)}</p>
          {data.media_coverage === "failed" && data.media_sync.error_code ? <p className={s.galNote}>Referencia del error: {data.media_sync.error_code}</p> : null}
        </div>
        <div className={s.info}>
          <div className={s.heroMeta}>
            <span>{product.store_name}</span>
            <span>{[product.vendor || "Sin proveedor", product.shopify_category_name || product.product_type || "Sin tipo"].join(" · ")}</span>
            {product.external_updated_at ? <span>Actualizado {new Date(product.external_updated_at).toLocaleDateString("es-ES")}</span> : null}
          </div>
          <div>
            <div className={s.chips}>
              <span className={cx(pulse.chip, product.status === "ACTIVE" ? pulse.chipGood : product.status === "DRAFT" ? pulse.chipWarn : undefined)}>{statusLabel(product.status)}</span>
              <span className={pulse.chip}>{fmtNum(data.variant_total)} variante{data.variant_total === 1 ? "" : "s"}</span>
              {byLocation.size ? <span className={pulse.chip}>{byLocation.size} ubicación{byLocation.size === 1 ? "" : "es"}</span> : null}
            </div>
            <h1 id="producto-titulo">{product.title}</h1>
          </div>
          <div className={s.priceL}>
            <strong>{priceMin == null ? "—" : priceMax != null && priceMax !== priceMin ? `${money(priceMin, currency)} – ${money(priceMax, currency)}` : money(priceMin, currency)}</strong>
            {compareMax != null && priceMin != null ? (
              <>
                <s>{money(compareMax, currency)}</s>
                <span className={cx(pulse.chip, pulse.chipAcc)}>−{fmtNum(((compareMax - priceMin) / compareMax) * 100, 0)} % comparado</span>
              </>
            ) : null}
          </div>
          <dl className={s.dl}>
            <div>
              <dt>Vendidas · {periodDays} d</dt>
              <dd>{unitsOrdered == null ? "—" : fmtNum(unitsOrdered)}<small>{unitsOrdered == null ? "sin datos de actividad" : changeText(unitsOrdered, pm?.previous_units_ordered ?? null)}</small></dd>
            </div>
            <div>
              <dt>Devueltas</dt>
              <dd>{unitsRefunded == null ? "—" : fmtNum(unitsRefunded)}<small>{returnRate == null ? "sin ventas" : `${fmtNum(returnRate * 100, 1)} % de lo vendido`}</small></dd>
            </div>
            <div>
              <dt>Stock total</dt>
              <dd>{totalStock == null ? "—" : fmtNum(totalStock)}<small>{totalStock == null ? "sin seguimiento" : paceDays != null ? `≈ ${fmtNum(paceDays, 0)} días al ritmo actual` : "sin ritmo de ventas reciente"}</small></dd>
            </div>
            <div>
              <dt>Margen</dt>
              <dd>{pm?.margin_pct != null ? `${fmtNum(pm.margin_pct * 100, 0)} %` : "—"}<small>{pm?.margin_pct != null ? "sobre ventas netas" : variantsWithoutCost > 0 ? "falta el coste" : "sin ventas para calcularlo"}</small></dd>
            </div>
            <div>
              <dt>Último pedido</dt>
              <dd>{activity.last_order_at ? new Date(activity.last_order_at).toLocaleDateString("es-ES") : "—"}<small>{activity.last_order_at ? new Date(activity.last_order_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "sin pedidos observados"}</small></dd>
            </div>
            <div>
              <dt>Como pack</dt>
              <dd>{bundleActivity.status === "observed_only" || bundleActivity.status === "partial" ? fmtNum(bundleActivity.bundles_sold) : "—"}<small>{bundleActivity.status === "observed_only" || bundleActivity.status === "partial" ? "packs vendidos" : "sin datos de packs"}</small></dd>
            </div>
          </dl>
          {product.tags.length ? (
            <ul className={s.tags} aria-label="Etiquetas">
              {product.tags.slice(0, 8).map((tag) => <li key={tag}><span className={pulse.chip}>{tag}</span></li>)}
            </ul>
          ) : null}
          <div className={s.actions}>
            <button type="button" className={cx(pulse.btn, pulse.acc)} onClick={() => askCopilot("Explícame cómo va este producto y qué haría primero", "Ficha de producto")}>
              <span className={pulse.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>IA</span>
              Preguntar qué haría
            </button>
            <Link className={cx(pulse.btn, pulse.ghost)} href="/shopify/productos" onClick={returnToCatalog}>Volver al catálogo</Link>
          </div>
        </div>
      </section>

      {/* ------------------------------ Fiabilidad ------------------------------ */}
      <div className={s.checks} role="group" aria-label="Fiabilidad de los datos">
        <div className={s.check}>
          <div className={s.checkH}><span>Coste</span><span className={cx(pulse.chip, variantsWithoutCost > 0 ? pulse.chipWarn : pulse.chipGood)}>{variantsWithoutCost > 0 ? "falta" : "OK"}</span></div>
          <p>{variantsWithoutCost > 0 ? `${variantsWithoutCost} de ${pm?.variants_total ?? variants.length} variantes sin coste: el margen no se puede calcular.` : "Todas las variantes tienen coste."}</p>
          {variantsWithoutCost > 0 ? <a href="#variantes">Completar coste</a> : null}
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Inventario</span><span className={cx(pulse.chip, trackedCount === variants.length && variants.length > 0 ? pulse.chipGood : pulse.chipWarn)}>{trackedCount === variants.length && variants.length > 0 ? "OK" : "parcial"}</span></div>
          <p>{`${trackedCount} de ${variants.length} variantes llevan seguimiento.${lastReading ? ` Última lectura ${new Date(lastReading).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}.` : ""}`}</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Pedidos</span><span className={cx(pulse.chip, pulse.chipWarn)}>{observed ? "parciales" : "sin datos"}</span></div>
          <p>{observed ? "Solo pedidos sincronizados; el historial completo de Shopify no está garantizado." : activity.status === "migration_pending" ? "Disponible cuando se aplique la migración de actividad." : "No se pudo consultar la actividad."}</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Promociones</span><span className={cx(pulse.chip, data.promotion_target_coverage.status === "complete" ? pulse.chipGood : pulse.chipWarn)}>{data.promotion_target_coverage.status === "complete" ? "completa" : data.promotion_target_coverage.status === "migration_pending" ? "pendiente" : "parcial"}</span></div>
          <p>{data.promotion_target_coverage.status === "complete" ? "Todas las reglas de descuento se han revisado." : "Pueden faltar reglas, sobre todo las administradas por una app."}</p>
        </div>
      </div>

      <nav className={s.snav} aria-label="Secciones">
        <a href="#actividad">Ventas</a>
        <a href="#variantes">Variantes</a>
        <a href="#stock">Stock</a>
        <a href="#promos">Promociones y packs</a>
        <a href="#descripcion">Descripción</a>
      </nav>

      {/* ------------------------------ Ventas ------------------------------ */}
      <section id="actividad" className={pulse.sec}>
        <div className={pulse.secHead} style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
          <h2>Ventas</h2>
          <p className={pulse.aiLine}>{observed ? `${fmtNum(activity.units_ordered)} unidades en los últimos ${periodDays} días, según los pedidos sincronizados.` : ""}</p>
          <div className={pulse.seg} role="group" aria-label="Periodo de actividad del producto">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={periodDays === p} onClick={() => setPeriodDays(p)}>{p === 365 ? "1 año" : `${p} días`}</button>
            ))}
          </div>
        </div>
        {observed ? (
          <div className={pulse.two}>
            <div className={pulse.panel}>
              <div className={pulse.panelH}>
                <div>
                  <h3>Unidades por semana</h3>
                  <p className={pulse.sub}>Pedidas y reembolsadas en pedidos sincronizados</p>
                </div>
              </div>
              {weekly && weekly.some((w) => w.units_ordered > 0) ? (
                <>
                  <div className={s.bars} role="img" aria-label="Unidades pedidas por semana, con las reembolsadas">
                    {weekly.map((week) => (
                      <div key={week.week_start} title={`Semana del ${weekLabel(week.week_start)}: ${week.units_ordered} pedidas, ${week.units_refunded} reembolsadas`}>
                        {week.units_refunded > 0 ? <i className="r" style={{ height: `${(week.units_refunded / weeklyMax) * 100}%`, background: "var(--bad)" }} /> : null}
                        <i style={{ height: `${(week.units_ordered / weeklyMax) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className={s.barsL}>
                    {weekly.map((week, index) => <span key={week.week_start}>{index % Math.max(Math.ceil(weekly.length / 6), 1) === 0 ? weekLabel(week.week_start) : ""}</span>)}
                  </div>
                  <div className={s.leg}>
                    <span><i className={pulse.sw} style={{ background: "var(--store)" }} />Unidades pedidas</span>
                    <span><i className={pulse.sw} style={{ background: "var(--bad)" }} />Reembolsadas</span>
                  </div>
                </>
              ) : (
                <Empty>{data.metrics_coverage === "migration_pending" ? "La serie semanal estará disponible al aplicar la migración de métricas del catálogo." : data.metrics_coverage === "unavailable" ? "No se pudo cargar la serie semanal." : "Sin ventas en pedidos sincronizados en este periodo."}</Empty>
              )}
              <p className={pulse.sub} style={{ marginTop: 12 }}>{activity.coverage_note} Muestra unidades, no importes ni ventas netas.</p>
            </div>
            <div className={s.minis}>
              <div className={s.mini}><span className={pulse.lbl}>Unidades pedidas</span><span>{fmtNum(activity.units_ordered)}</span><small>{changeText(activity.units_ordered, pm?.previous_units_ordered ?? null)}</small></div>
              <div className={s.mini}><span className={pulse.lbl}>Reembolsadas</span><span style={{ color: activity.units_refunded ? "var(--warn)" : undefined }}>{fmtNum(activity.units_refunded)}</span><small>{returnRate == null ? "sin ventas" : `${fmtNum(returnRate * 100, 1)} % de lo vendido`}</small></div>
              <div className={s.mini}><span className={pulse.lbl}>Pedidos</span><span>{pm ? fmtNum(pm.orders_count) : "—"}</span><small>{pm && pm.orders_count > 0 ? `${fmtNum(activity.units_ordered / pm.orders_count, 2)} uds. por pedido` : "sin pedidos"}</small></div>
              <div className={s.mini}><span className={pulse.lbl}>Ritmo actual</span><span>{pm?.units_per_day_14d != null ? `${fmtNum(pm.units_per_day_14d, 1)}/día` : "—"}</span><small>últimos 14 días</small></div>
              <div className={cx(s.mini, s.wide)}>
                <span className={pulse.lbl}>Se compra junto a</span>
                {copurchase && copurchase.items.length ? (
                  <>
                    <span style={{ fontSize: 14 }}>{copurchase.items.slice(0, 3).map((item) => item.title).join(" · ")}</span>
                    <small>{copurchase.items[0]?.share != null ? `${copurchase.items[0].title} aparece en el ${fmtNum((copurchase.items[0].share ?? 0) * 100, 0)} % de sus pedidos` : ""}</small>
                  </>
                ) : (
                  <small>{copurchase?.status === "migration_pending" ? "Disponible al aplicar la migración de métricas." : copurchase?.status === "unavailable" ? "No se pudo consultar." : "Sin otros productos en sus pedidos de este periodo."}</small>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={pulse.panel}>
            <Empty>{activity.status === "migration_pending" ? "La actividad estará disponible cuando se aplique la migración de actividad de catálogo." : "No se pudo consultar la actividad de este producto. Los datos de catálogo siguen disponibles."}</Empty>
          </div>
        )}
      </section>

      {/* ------------------------------ Variantes ------------------------------ */}
      <section id="variantes" className={pulse.sec}>
        <SectionHead
          id="variantes-titulo"
          title="Variantes"
          ai={null}
          fallback={showMatrix ? `Ventas y stock por ${rowName?.toLowerCase()} y ${colName?.toLowerCase()}.` : "Precio, coste y stock de cada variante."}
          onAsk={() => askCopilot("¿Qué variantes se venden más, cuáles se me van a agotar y cuáles sobran?", "Variantes")}
        />
        {data.selected_options_coverage === "migration_pending" ? (
          <p className={s.note}>Las opciones estructuradas de variante (como color o talla) aparecerán cuando esté disponible la migración de opciones de Shopify.</p>
        ) : null}
        {showMatrix ? (
          <div className={pulse.panel}>
            <div className={pulse.panelH}>
              <div>
                <h3>Ventas y stock por combinación</h3>
                <p className={pulse.sub}>Arriba, unidades pedidas en {periodDays} días; abajo, disponibles. Más oscuro, más ventas.</p>
              </div>
            </div>
            <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
              <table className={s.mx}>
                <thead>
                  <tr>
                    <th className="rh" style={{ textAlign: "left" }}>{rowName} \ {colName}</th>
                    {colValues.map((col) => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rowValues.map((row) => (
                    <tr key={row}>
                      <th style={{ textAlign: "left" }}>{row}</th>
                      {colValues.map((col) => {
                        const c = cell(row, col);
                        if (!c) return <td key={col} style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>—</td>;
                        const intensity = c.units / matrixMax;
                        return (
                          <td key={col} style={{ background: `color-mix(in srgb, var(--store) ${Math.round(intensity * 85)}%, var(--surface-2))`, color: intensity > 0.5 ? "#fff" : "var(--ink)" }}>
                            <b>{observed ? fmtNum(c.units) : "—"}</b>
                            <span>{!c.tracked ? "sin seguimiento" : c.available <= 0 ? "agotada" : `${fmtNum(c.available)} disp.`}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <div className={pulse.panel}>
          <div className={pulse.panelH}>
            <div>
              <h3>Precios, coste y stock por variante</h3>
              <p className={pulse.sub}>El precio de comparación no confirma una promoción aplicada. El stock es la última lectura sincronizada, no tiempo real.</p>
            </div>
            <span className={pulse.chip}>{fmtNum(data.variant_total)} variantes</span>
          </div>
          {variants.length === 0 ? (
            <Empty>Este producto todavía no tiene variantes sincronizadas.</Empty>
          ) : (
            <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
              <table className={pulse.tbl}>
                <thead>
                  <tr>
                    <th>Variante</th>
                    <th>SKU</th>
                    <th style={{ textAlign: "right" }}>Precio</th>
                    <th style={{ textAlign: "right" }}>Comparado</th>
                    <th style={{ textAlign: "right" }}>Coste</th>
                    <th style={{ textAlign: "right" }}>Vendidas / devueltas</th>
                    <th>Stock por ubicación</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => {
                    const maxLevel = Math.max(...variant.inventory_levels.map((level) => level.available_quantity ?? 0), 10);
                    return (
                      <tr key={variant.id}>
                        <td>
                          <div className={s.vn}>
                            <span className={s.vimg}>
                              {variant.image?.source_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={variant.image.source_url} alt={variant.image.alt_text || variant.title || product.title} loading="lazy" decoding="async" />
                              ) : null}
                            </span>
                            <span>
                              <b style={{ fontWeight: 600 }}>{variant.title || "Variante predeterminada"}</b>
                              {variant.selected_options.length ? (
                                <>
                                  <br />
                                  <span className={pulse.muted} style={{ fontSize: 11.5 }}>{variant.selected_options.map((option) => `${option.name}: ${option.value}`).join(" · ")}</span>
                                </>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className={pulse.muted}>{variant.inventory?.sku || "—"}</td>
                        <td className={pulse.tdN}>{money(variant.current_price, currency)}</td>
                        <td className={cx(pulse.tdN, pulse.muted)}>{money(variant.compare_at_price, currency)}</td>
                        <td className={pulse.tdN}>
                          <CostCell variant={variant} currency={currency} organizationId={organizationId} onSaved={reloadAfterCost} />
                        </td>
                        <td className={pulse.tdN}>{observed && variant.activity ? `${fmtNum(variant.activity.units_ordered)} / ${fmtNum(variant.activity.units_refunded)}` : "—"}</td>
                        <td>
                          {!variant.inventory ? (
                            <span className={pulse.muted}>Sin dato</span>
                          ) : !variant.inventory.tracked ? (
                            <span className={pulse.muted}>Sin seguimiento</span>
                          ) : data.inventory_levels_coverage === "available" && variant.inventory_levels.length ? (
                            <div className={s.loc}>
                              {variant.inventory_levels.map((level) => (
                                <div key={level.location_id} className={s.locR} title={level.updated_at ? `Última lectura ${new Date(level.updated_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}` : undefined}>
                                  <span>{level.location_name}</span>
                                  <i><b style={{ width: `${Math.min((level.available_quantity ?? 0) / maxLevel, 1) * 100}%`, background: (level.available_quantity ?? 0) <= 0 ? "var(--bad)" : "var(--store)" }} /></i>
                                  <span className={pulse.num} style={{ color: (level.available_quantity ?? 0) <= 0 ? "var(--bad)" : undefined }}>{level.available_quantity ?? "—"}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={pulse.muted}>{data.inventory_levels_coverage === "available" ? "Sin niveles activos importados" : "Seguimiento activo"}</span>
                          )}
                        </td>
                        <td><span className={cx(pulse.chip, variant.is_active ? pulse.chipGood : undefined)}>{variant.is_active ? "Activa" : "Inactiva"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.variant_total > data.variant_page_size ? (
            <div className={s.pager} style={{ marginTop: 14 }}>
              <span className={pulse.muted} style={{ fontSize: 12.5 }}>Página {page} de {totalPages}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
                <button type="button" className={cx(pulse.btn, pulse.ghost, pulse.sm)} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------ Stock ------------------------------ */}
      <section id="stock" className={pulse.sec}>
        <SectionHead
          id="stock-titulo"
          title="Stock"
          ai={null}
          fallback="Cuántos días aguanta cada variante al ritmo de ventas de los últimos 30 días."
          onAsk={() => askCopilot("¿Qué variantes debería reponer primero y cuánto?", "Stock del producto")}
        />
        <div className={pulse.two}>
          <div className={pulse.panel}>
            <div className={pulse.panelH}>
              <div>
                <h3>Días de cobertura por variante</h3>
                <p className={pulse.sub}>Stock disponible ÷ ventas diarias de los últimos 30 días</p>
              </div>
            </div>
            {coverRows.length ? (
              <div className={s.cover}>
                {coverRows.map((row) => {
                  const chip = coverChip(row.cover.days_of_cover, row.cover.available);
                  const width = row.cover.available <= 0 ? 0 : row.cover.days_of_cover == null ? 100 : Math.min(row.cover.days_of_cover / 30, 1) * 100;
                  return (
                    <div key={row.id} className={s.coverR}>
                      <span>{row.title}</span>
                      <i><b style={{ width: `${width}%`, background: chip.color }} /></i>
                      <span className={cx(pulse.chip, chip.tone)}>{chip.text}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty>{variants.length ? "Ninguna variante lleva seguimiento de inventario, así que no se puede calcular la cobertura." : "Sin variantes sincronizadas."}</Empty>
            )}
            <p className={pulse.sub} style={{ marginTop: 12 }}>Una variante sin ventas en 30 días aparece «sin ritmo»: no hay con qué dividir el stock.</p>
          </div>
          <div className={pulse.panel}>
            <div className={pulse.panelH}>
              <div>
                <h3>Por ubicación</h3>
                <p className={pulse.sub}>Disponible, comprometido y entrante</p>
              </div>
            </div>
            {data.inventory_levels_coverage === "migration_pending" ? (
              <p className={s.note}>El detalle de stock por ubicación estará disponible cuando se aplique la migración de estado actual de inventario.</p>
            ) : byLocation.size ? (
              <table className={pulse.tbl}>
                <thead><tr><th>Ubicación</th><th style={{ textAlign: "right" }}>Disponible</th><th style={{ textAlign: "right" }}>Comprometido</th><th style={{ textAlign: "right" }}>Entrante</th></tr></thead>
                <tbody>
                  {[...byLocation.entries()].map(([name, row]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className={pulse.tdN}>{fmtNum(row.available)}</td>
                      <td className={pulse.tdN}>{fmtNum(row.committed)}</td>
                      <td className={pulse.tdN}>{row.incoming > 0 ? <span className={cx(pulse.chip, pulse.chipGood)}>+{fmtNum(row.incoming)}</span> : <span className={pulse.muted}>0</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>Sin niveles de stock activos importados.</Empty>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------ Promociones y packs ------------------------------ */}
      <section id="promos" className={pulse.sec}>
        <SectionHead
          id="promos-titulo"
          title="Promociones y packs"
          ai={null}
          fallback="Reglas de Shopify que incluyen este producto y su composición como pack."
          onAsk={() => askCopilot("¿Qué promociones afectan a este producto y me conviene mantenerlas?", "Promociones del producto")}
        />
        <div className={pulse.two}>
          <div className={pulse.panel}>
            <div className={pulse.panelH}>
              <div>
                <h3>Promociones que lo incluyen</h3>
                <p className={pulse.sub}>Por la configuración de Shopify; no garantiza que el carrito cumpla códigos, segmentos, mínimos u otras condiciones</p>
              </div>
              <span className={pulse.chip}>{data.related_promotions.length}</span>
            </div>
            {data.promotion_target_coverage.status !== "complete" ? (
              <p className={s.note} style={{ marginBottom: 12 }}>
                {data.promotion_target_coverage.status === "migration_pending"
                  ? "La relación entre promociones y productos estará disponible al aplicar la migración de objetivos."
                  : `Cobertura ${data.promotion_target_coverage.status}: pueden faltar reglas, especialmente si Shopify las administra mediante una app.`}
              </p>
            ) : null}
            {data.related_promotions.length ? (
              <ul>
                {data.related_promotions.map((promotion) => (
                  <li key={`${promotion.id}:${promotion.matched_rule_side}`} className={s.promo}>
                    <div className={s.promoH}>
                      <b style={{ fontWeight: 600 }}>{promotion.title || "Promoción sin título"}</b>
                      <span className={cx(pulse.chip, promotion.status === "ACTIVE" ? pulse.chipGood : promotion.status === "SCHEDULED" ? pulse.chipWarn : undefined)}>{promotion.status || "Sin estado"}</span>
                    </div>
                    <p className={pulse.sub} style={{ margin: 0 }}>
                      {promotion.matched_rule_side === "gets" ? "Lo incluye como beneficio" : "Lo incluye entre los productos requeridos"}
                      {promotion.matched_targets.length ? ` · ${promotion.matched_targets.map((target) => target.title || (target.target_type === "all" ? "Todos los productos" : target.target_type)).join(", ")}` : ""}
                    </p>
                    <p className={pulse.sub} style={{ margin: 0 }}>
                      {promotion.codes.length ? `Código${promotion.codes.length === 1 ? "" : "s"}: ${promotion.codes.join(", ")}` : "Automática o sin código"}
                      {promotion.configuration_coverage === "app_managed" ? " · Configuración administrada por una app" : ""}
                    </p>
                    {promotion.summary ? <p style={{ fontSize: 13 }}>{promotion.summary}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{data.promotion_target_coverage.status === "complete" ? "No hay reglas de promoción con un objetivo que incluya este producto o sus variantes." : "No hay coincidencias verificadas en las reglas disponibles. La cobertura actual no permite confirmar que no exista una promoción aplicable."}</Empty>
            )}
          </div>
          <div className={pulse.panel}>
            <div className={pulse.panelH}>
              <div>
                <h3>Packs</h3>
                <p className={pulse.sub}>Un pack nativo se cuenta una vez por grupo de líneas; las ventas siguen atribuidas a sus componentes para no duplicar el total</p>
              </div>
            </div>
            {bundleActivity.status === "observed_only" || bundleActivity.status === "partial" ? (
              <div className={s.minis} style={{ marginBottom: 14 }}>
                <div className={s.mini}><span className={pulse.lbl}>Packs vendidos</span><span>{fmtNum(bundleActivity.bundles_sold)}</span><small>{bundleActivity.last_order_at ? `último ${new Date(bundleActivity.last_order_at).toLocaleDateString("es-ES")}` : "sin packs observados"}</small></div>
                <div className={s.mini}><span className={pulse.lbl}>Grupos en pedidos</span><span>{fmtNum(bundleActivity.bundle_group_count)}</span>{bundleActivity.status === "partial" ? <small>{fmtNum(bundleActivity.unclassified_line_count)} líneas sin clasificar: cifras parciales</small> : <small>pedidos sincronizados</small>}</div>
              </div>
            ) : (
              <p className={s.note} style={{ marginBottom: 14 }}>{bundleActivity.status === "migration_pending" ? "La captura de packs en pedidos estará disponible al aplicar la migración y completar una sincronización." : "No se pudo consultar la actividad de packs; los datos del producto siguen disponibles."}</p>
            )}
            {hasBundleComponents ? (
              <div>
                {data.bundle_coverage.status !== "complete" ? <p className={s.note} style={{ marginBottom: 8 }}>Cobertura {data.bundle_coverage.status}: se muestran las relaciones conocidas, pero puede faltar alguna.</p> : null}
                {variants.filter((variant) => variant.bundle_components?.length).map((variant) => (
                  <div key={variant.id} style={{ marginBottom: 10 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{variant.title || "Variante predeterminada"}</p>
                    {variant.bundle_components?.map((component) => (
                      <div key={component.external_component_variant_id} className={s.pack}>
                        <span className={s.qty}>{component.quantity}×</span>
                        <span>
                          {component.product_title || (component.verification_status === "unresolved_component" ? "Componente no sincronizado" : "Producto sin título")}
                          {component.variant_title ? <span className={pulse.muted}> · {component.variant_title}</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className={pulse.sub}>
                {data.bundle_coverage.status === "complete"
                  ? "Sin componentes de pack nativo confirmados para este producto. Solo se muestran componentes que Shopify relaciona explícitamente con una variante."
                  : data.bundle_coverage.status === "migration_pending"
                    ? "La composición se mostrará cuando esté disponible el esquema de packs."
                    : data.bundle_coverage.status === "pending"
                      ? "La tienda aún no tiene una sincronización de packs registrada."
                      : `Cobertura ${data.bundle_coverage.status}: no se puede confirmar que la composición esté completa.`}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------ Descripción ------------------------------ */}
      <section id="descripcion" className={pulse.sec}>
        <SectionHead
          id="descripcion-titulo"
          title="Descripción y clasificación"
          ai={null}
          fallback="Descripción en texto seguro, etiquetas y categoría estándar leídas de Shopify."
          onAsk={() => askCopilot("¿Cómo mejorarías la descripción y las etiquetas de este producto?", "Descripción del producto")}
        />
        {product.metadata_coverage !== "complete" ? (
          <p className={s.note}>
            {product.metadata_coverage === "migration_pending"
              ? "La descripción y clasificación se mostrarán cuando esté disponible su migración."
              : `Cobertura de metadata: ${product.metadata_coverage}.`}
          </p>
        ) : null}
        <div className={pulse.two}>
          <div className={pulse.panel}>
            <p className={s.desc}>{product.description_text || "Shopify no devuelve una descripción para este producto."}</p>
          </div>
          <div className={pulse.panel} style={{ display: "grid", gap: 14 }}>
            <div><p className={pulse.lbl}>Categoría Shopify</p><p style={{ marginTop: 4 }}>{product.shopify_category_name || "Sin categoría estándar asignada"}</p></div>
            <div><p className={pulse.lbl}>Proveedor</p><p style={{ marginTop: 4 }}>{product.vendor || "Sin proveedor"}</p></div>
            <div>
              <p className={pulse.lbl}>Etiquetas</p>
              {product.tags.length ? (
                <ul style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{product.tags.map((tag) => <li key={tag}><span className={pulse.chip}>{tag}</span></li>)}</ul>
              ) : <p className={pulse.muted} style={{ marginTop: 4 }}>Sin etiquetas</p>}
            </div>
          </div>
        </div>
      </section>

      <footer className={s.foot}>
        <span>Datos de catálogo e inventario de Shopify; ventas observadas en los pedidos sincronizados, en unidades.</span>
        <Link href="/shopify/productos" onClick={returnToCatalog}>← Volver al catálogo</Link>
      </footer>
    </div>
  );
}

export default function ShopifyProductPage() {
  return <PortalShell title="Ficha de producto">{(bootstrap) => <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando producto…" />}><ProductDetail bootstrap={bootstrap} /></Suspense>}</PortalShell>;
}
