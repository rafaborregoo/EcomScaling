"use client";

import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { PortalShell } from "@/components/portal-shell";
import { AsyncState, EmptyState, ErrorBlock } from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { cx, Spark } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import s from "../productos/catalogo.module.css";
import p from "./promociones.module.css";
import type { CatalogDiscount, CatalogDiscountsResponse } from "../catalog-types";
import { benefitBig, classLabel, discountAlerts, discountHref, discountState, money, PERIODS, type Period, usageText, validity } from "./promo-model";

type View = "grid" | "table";
type Filter = "" | "ending" | "limit" | "app";
type Sort = "recent" | "usage" | "ending" | "name";

const STATUSES: Array<{ value: string; label: string; count: (summary: NonNullable<CatalogDiscountsResponse["summary"]>) => number }> = [
  { value: "ACTIVE", label: "Activas", count: (summary) => summary.active },
  { value: "SCHEDULED", label: "Programadas", count: (summary) => summary.scheduled },
  { value: "EXPIRED", label: "Finalizadas", count: (summary) => summary.expired },
  { value: "DISABLED", label: "Desactivadas", count: (summary) => summary.disabled },
  { value: "", label: "Todas", count: (summary) => summary.total },
];

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "recent", label: "Más recientes" },
  { value: "usage", label: "Más usadas" },
  { value: "ending", label: "Acaban antes" },
  { value: "name", label: "Nombre" },
];

function CodeLine({ discount }: { discount: CatalogDiscount }) {
  const codeIsTitle = discount.codes[0] != null && discount.codes[0] === discount.title;
  return (
    <p className={p.metaRow}>
      {discount.codes.length ? (codeIsTitle ? <span>Código</span> : <span className={p.code}>{discount.codes[0]}</span>) : <span>Automática</span>}
      {discount.codes.length > 1 ? <span>+{discount.codes.length - 1}</span> : null}
      {discount.codes_coverage === "partial" ? <span className={cx(pulse.chip, pulse.chipWarn)}>Códigos parciales</span> : null}
      <span aria-hidden="true">·</span>
      <span>{validity(discount)}</span>
    </p>
  );
}

function PromoCard({ discount, href, metricsOn }: { discount: CatalogDiscount; href: string; metricsOn: boolean }) {
  const state = discountState(discount.status);
  const alert = discountAlerts(discount)[0] ?? null;
  const off = ["EXPIRED", "DISABLED"].includes(discount.status?.toUpperCase() ?? "");
  const m = metricsOn ? discount.metrics : null;
  const used = discount.usage_limit ? Math.min(discount.usage_count / discount.usage_limit, 1) : 0;
  return (
    <a className={s.card} href={href} aria-label={`Abrir ficha de ${discount.title || discount.code || "promoción"}`}>
      <div className={cx(p.coupon, off && p.off)}>
        <span className={cx(pulse.chip, state.tone === "good" ? pulse.chipGood : state.tone === "warn" ? pulse.chipWarn : undefined, p.st)}>{state.label}</span>
        {alert ? <span className={cx(pulse.chip, alert.tone === "bad" ? pulse.chipBad : alert.tone === "warn" ? pulse.chipWarn : alert.tone === "acc" ? pulse.chipAcc : undefined, p.warn)}>{alert.text}</span> : null}
        <span className={p.big}>{benefitBig(discount)}</span>
      </div>
      <div className={s.body}>
        <div>
          <p className={s.name}>{discount.title || discount.code || "Promoción sin título"}</p>
          <CodeLine discount={discount} />
        </div>
        {m?.orders ? (
          <div className={s.price}>
            <b>{m.discount_amount == null ? "parcial" : money(m.discount_amount, discount.currency_code)}</b>
            <span className={pulse.chip}>{m.net_revenue ? `${fmtNum(((m.discount_amount ?? 0) / (m.net_revenue + (m.discount_amount ?? 0))) * 100, 1)} % de lo que vende` : "descontado"}</span>
          </div>
        ) : null}
        <div className={s.stats}>
          <div><span>Usos</span><span>{usageText(discount)}</span></div>
          <div><span>Pedidos</span><span>{m?.orders ? fmtNum(m.orders) : "—"}</span></div>
          <div><span>Gasto medio</span><span>{m?.aov != null ? money(m.aov, discount.currency_code) : "—"}</span></div>
        </div>
        {discount.usage_limit ? (
          <div className={p.limit}>
            <span>{fmtNum(Math.max(discount.usage_limit - discount.usage_count, 0))} usos restantes</span>
            <i className={p.meter}><b style={{ width: `${used * 100}%`, background: used >= 0.8 ? "var(--bad)" : "var(--store)" }} /></i>
          </div>
        ) : null}
        {discount.weekly_orders && discount.weekly_orders.some((value) => value > 0) ? <Spark values={discount.weekly_orders} /> : null}
      </div>
    </a>
  );
}

function PromotionsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId && bootstrap.memberships.some((item) => item.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId ? (searchParams.get("connectionId") ?? "") : activeConnection.connectionId;
  const requestedSearch = searchParams.get("q") ?? "";

  const [draftSearch, setDraftSearch] = useState(requestedSearch);
  const [search, setSearch] = useState(requestedSearch);
  const [status, setStatus] = useState("ACTIVE");
  const [filter, setFilter] = useState<Filter>("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<View>("grid");
  const [periodDays, setPeriodDays] = useState<Period>(90);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [organizationId, connectionId]);
  useEffect(() => { setDraftSearch(requestedSearch); setSearch(requestedSearch); }, [requestedSearch, organizationId, connectionId]);

  const params = new URLSearchParams({ page: String(page), sort, periodDays: String(periodDays) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (filter) params.set("filter", filter);
  const key = organizationId ? `/v1/organizations/${organizationId}/shopify/catalog/discounts?${params.toString()}` : null;
  const query = useCachedQuery<CatalogDiscountsResponse>(key);
  const data = query.data;
  const summary = data?.summary ?? null;
  const metricsOn = data?.metrics_coverage === "observed_only";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const rows = data?.discounts ?? [];
  const from = data && data.total ? (page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(page * data.page_size, data.total) : 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  }

  function pickFilter(next: Filter) {
    setFilter((current) => (current === next ? "" : next));
    if (next) setStatus("");
    setPage(1);
  }

  const tiles: Array<{ key: Filter; label: string; value: string; hint: string; tone?: string; pressable: boolean }> = summary
    ? [
        { key: "", label: "Promociones", value: fmtNum(summary.total), hint: `${summary.active} activas · ${summary.scheduled} programadas · ${summary.closed} cerradas`, pressable: false },
        { key: "ending", label: "Acaban en 7 días", value: fmtNum(summary.ending_soon), hint: "revisa si renovarlas", tone: summary.ending_soon ? "var(--warn)" : undefined, pressable: true },
        { key: "limit", label: "Cerca del límite", value: fmtNum(summary.near_limit), hint: "80 % o más de los usos", tone: summary.near_limit ? "var(--bad)" : undefined, pressable: true },
        ...(summary.app_managed ? [{ key: "app" as Filter, label: "Gestionadas por una app", value: fmtNum(summary.app_managed), hint: "sus reglas no se ven aquí", tone: "var(--warn)", pressable: true }] : []),
        {
          key: "",
          label: "Descuento concedido",
          value: summary.discount_amount == null ? "—" : fmtNum(summary.discount_amount),
          hint: metricsOn ? `últimos ${periodDays} días · pedidos sincronizados${summary.discount_amount == null ? " · importes parciales" : ""}` : "disponible al aplicar la migración de métricas",
          pressable: false,
        },
      ]
    : [];

  return (
    <div className={pulse.root}>
      <header className={s.top}>
        <div>
          <h1>Promociones</h1>
        </div>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona un cliente" hint="Elige una organización en la barra superior para consultar sus promociones." />
      ) : (
        <>
          {tiles.length ? (
            <div className={s.sum} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }} role="group" aria-label="Resumen de promociones">
              {tiles.map((tile) => (
                <button key={tile.label} type="button" className={s.sumC} disabled={!tile.pressable} style={tile.pressable ? undefined : { cursor: "default" }} aria-pressed={tile.pressable && filter === tile.key} onClick={() => tile.pressable && pickFilter(tile.key)}>
                  <span className={pulse.lbl}>{tile.label}</span>
                  <strong style={{ color: tile.tone }}>{tile.value}</strong>
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
              <input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar por título o código" aria-label="Buscar promociones" />
            </form>
            <div className={s.barR}>
              <div className={pulse.seg} role="group" aria-label="Estado">
                {STATUSES.map((item) => (
                  <button key={item.value || "all"} type="button" aria-pressed={status === item.value} onClick={() => { setStatus(item.value); setFilter(""); setPage(1); }}>
                    {item.label}
                    {summary ? <b>{fmtNum(item.count(summary))}</b> : null}
                  </button>
                ))}
              </div>
              <label className={s.selectL}>
                Ordenar
                <select value={sort} onChange={(event) => { setSort(event.target.value as Sort); setPage(1); }} aria-label="Ordenar por">
                  {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <div className={pulse.seg} role="group" aria-label="Periodo de pedidos">
                {PERIODS.map((value) => (
                  <button key={value} type="button" aria-pressed={periodDays === value} onClick={() => { setPeriodDays(value); setPage(1); }}>
                    {value === 365 ? "1 año" : `${value} días`}
                  </button>
                ))}
              </div>
              <div className={pulse.seg} role="group" aria-label="Vista">
                <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Tarjetas</button>
                <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Tabla</button>
              </div>
            </div>
          </div>

          {data?.details_coverage === "migration_pending" ? (
            <p className={pulse.error}>Se muestran los campos básicos. Aplica la migración de catálogo para ver códigos y el resumen ampliado de reglas.</p>
          ) : null}
          {data?.metrics_coverage === "migration_pending" ? (
            <p className={pulse.error}>Pedidos, descuento concedido y ticket medio por promoción estarán disponibles cuando se aplique la migración de métricas de promociones.</p>
          ) : null}
          {data?.metrics_coverage === "unavailable" ? (
            <p className={pulse.error}>No se pudieron cargar las métricas de las promociones. No significa que no tengan pedidos: reintenta en un rato.</p>
          ) : null}
          {query.error && !data ? <ErrorBlock>{query.error}</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando promociones…" /> : null}

          {data && rows.length === 0 ? (
            <div className={pulse.panel}>
              <p className={pulse.empty}>No hay promociones con estos filtros. Si acabas de conectar la tienda, revisa la sincronización.</p>
            </div>
          ) : null}

          {data && rows.length && view === "grid" ? (
            <div className={s.grid}>
              {rows.map((discount) => <PromoCard key={discount.id} discount={discount} metricsOn={metricsOn} href={discountHref(discount.id, organizationId, connectionId)} />)}
            </div>
          ) : null}

          {data && rows.length && view === "table" ? (
            <div className={pulse.panel}>
              <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
                <table className={pulse.tbl}>
                  <thead>
                    <tr>
                      <th>Promoción</th>
                      <th>Estado</th>
                      <th>Beneficio</th>
                      <th>Código</th>
                      <th style={{ textAlign: "right" }}>Usos</th>
                      <th style={{ textAlign: "right" }}>Pedidos</th>
                      <th style={{ textAlign: "right" }}>Descuento</th>
                      <th style={{ textAlign: "right" }}>Ticket medio</th>
                      <th>Vigencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((discount) => {
                      const state = discountState(discount.status);
                      const m = metricsOn ? discount.metrics : null;
                      return (
                        <tr key={discount.id}>
                          <td>
                            <a className={s.prod} href={discountHref(discount.id, organizationId, connectionId)} aria-label={`Abrir ficha de ${discount.title || discount.code || "promoción"}`}>
                              <span>
                                <b style={{ fontWeight: 600 }}>{discount.title || discount.code || "Promoción sin título"}</b>
                                <br />
                                <span className={pulse.muted} style={{ fontSize: 12 }}>{classLabel(discount)} · {discount.store_name}</span>
                              </span>
                            </a>
                          </td>
                          <td><span className={cx(pulse.chip, state.tone === "good" ? pulse.chipGood : state.tone === "warn" ? pulse.chipWarn : undefined)}>{state.label}</span></td>
                          <td className={pulse.num}>{benefitBig(discount)}</td>
                          <td>{discount.codes.length ? <><span className={p.code}>{discount.codes[0]}</span>{discount.codes.length > 1 ? <span className={pulse.muted}> +{discount.codes.length - 1}</span> : null}</> : <span className={pulse.muted}>Automática</span>}</td>
                          <td className={pulse.tdN}>{usageText(discount)}</td>
                          <td className={pulse.tdN}>{m?.orders ? fmtNum(m.orders) : "—"}</td>
                          <td className={pulse.tdN}>{m?.orders ? (m.discount_amount == null ? "parcial" : money(m.discount_amount, discount.currency_code)) : "—"}</td>
                          <td className={pulse.tdN}>{m?.aov != null ? money(m.aov, discount.currency_code) : "—"}</td>
                          <td className={pulse.muted} style={{ whiteSpace: "nowrap" }}>{discount.starts_at ? new Date(discount.starts_at).toLocaleDateString("es-ES") : "Sin inicio"} – {discount.ends_at ? new Date(discount.ends_at).toLocaleDateString("es-ES") : "Sin fin"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {data && totalPages > 1 ? (
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
            <span>Usos: contador de Shopify. Pedidos y gasto medio: últimos {periodDays} días.</span>
          </footer>
        </>
      )}
    </div>
  );
}

export default function ShopifyPromotionsPage() {
  return (
    <PortalShell title="Promociones Shopify">
      {(bootstrap) => (
        <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando promociones…" />}>
          <PromotionsContent bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
