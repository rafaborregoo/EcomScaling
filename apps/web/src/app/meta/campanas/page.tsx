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
import s from "../../shopify/productos/catalogo.module.css";
import m from "../campanas.module.css";
import type { MetaCampaignListRow, MetaCampaignsResponse } from "../campaign-types";
import { budgetText, campaignAlert, campaignHref, campaignState, money, PERIODS, type Period, roasText } from "../campaign-model";

type ShopifyFinance = { financial: { breakeven_roas: number | null; items_without_cost: number; has_settings: boolean } };
type View = "grid" | "table";
type Filter = "" | "rejected" | "learning";
type Sort = "spend" | "roas" | "name";

const STATUSES: Array<{ value: string; label: string; count: (summary: MetaCampaignsResponse["summary"]) => number }> = [
  { value: "ACTIVE", label: "Activas", count: (summary) => summary.active },
  { value: "PAUSED", label: "En pausa", count: (summary) => summary.paused },
  { value: "", label: "Todas", count: (summary) => summary.total },
];

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "spend", label: "Más gasto" },
  { value: "roas", label: "Mejor ROAS" },
  { value: "name", label: "Nombre" },
];

function RoasGauge({ value, breakeven }: { value: number | null; breakeven: number | null }) {
  const max = Math.max(5, breakeven ?? 0, value ?? 0, 1) * 1.1;
  const pct = Math.min((value ?? 0) / max, 1);
  const bePct = breakeven != null ? Math.min(breakeven / max, 1) : null;
  const color = value == null ? "var(--ink-3)" : breakeven != null && value < breakeven ? "var(--bad)" : "var(--good)";
  return (
    <div className={m.gauge} title={breakeven != null ? `Equilibrio ${roasText(breakeven)}` : undefined}>
      <b style={{ width: `${pct * 100}%`, background: color }} />
      {bePct != null ? <i style={{ left: `${bePct * 100}%` }} /> : null}
    </div>
  );
}

function CampaignCard({ row, href, breakeven, currency }: { row: MetaCampaignListRow; href: string; breakeven: number | null; currency: string | null }) {
  const state = campaignState(row.effective_status);
  const alert = campaignAlert(row, breakeven);
  const off = row.effective_status !== "ACTIVE";
  return (
    <a className={s.card} href={href} aria-label={`Abrir ficha de ${row.name}`}>
      <div className={cx(m.cover, off && m.off)}>
        <span className={cx(pulse.chip, state.tone === "good" ? pulse.chipGood : undefined, m.st)}>{state.label}</span>
        {alert ? <span className={cx(pulse.chip, alert.tone === "bad" ? pulse.chipBad : alert.tone === "warn" ? pulse.chipWarn : alert.tone === "acc" ? pulse.chipAcc : undefined, m.warn)}>{alert.text}</span> : null}
        <span className={m.big}>{roasText(row.roas)}</span>
        <span className={m.kind}>ROAS atribuido</span>
        <RoasGauge value={row.roas} breakeven={breakeven} />
      </div>
      <div className={s.body}>
        <div>
          <p className={s.name}>{row.name}</p>
          <p className={s.meta}>{row.ad_set_count} conjunto{row.ad_set_count === 1 ? "" : "s"} · {row.ad_count} anuncio{row.ad_count === 1 ? "" : "s"} · {budgetText(row.budget, currency)}</p>
        </div>
        <div className={s.price}>
          <b>{row.spend ? money(row.spend, currency) : "—"}</b>
          <span className={pulse.chip}>{row.spend ? `${money(row.purchase_value, currency)} atribuidos` : "sin gasto en el periodo"}</span>
        </div>
        <div className={s.stats}>
          <div><span>Compras</span><span>{row.purchases ? fmtNum(row.purchases) : "—"}</span></div>
          <div><span>CPM</span><span>{row.cpm != null ? money(row.cpm, currency) : "—"}</span></div>
          <div><span>CPC</span><span>{row.cpc != null ? money(row.cpc, currency) : "—"}</span></div>
        </div>
        {row.daily_spend.some((d) => d.spend > 0) ? <Spark values={row.daily_spend.map((d) => d.spend)} /> : null}
      </div>
    </a>
  );
}

function CampaignsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
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
  const [sort, setSort] = useState<Sort>("spend");
  const [view, setView] = useState<View>("grid");
  const [periodDays, setPeriodDays] = useState<Period>(30);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [organizationId, connectionId]);
  useEffect(() => { setDraftSearch(requestedSearch); setSearch(requestedSearch); }, [requestedSearch, organizationId, connectionId]);

  const params = new URLSearchParams({ page: String(page), sort, periodDays: String(periodDays) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (filter) params.set("filter", filter);
  const key = organizationId ? `/v1/organizations/${organizationId}/meta/campaigns?${params.toString()}` : null;
  const query = useCachedQuery<MetaCampaignsResponse>(key);
  const data = query.data;
  const financeKey = organizationId ? `/v1/organizations/${organizationId}/shopify/metrics?days=${periodDays}` : null;
  const finance = useCachedQuery<ShopifyFinance>(financeKey);
  const breakeven = finance.data?.financial.has_settings && finance.data.financial.items_without_cost === 0 ? finance.data.financial.breakeven_roas : null;

  const summary = data?.summary ?? null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const rows = data?.campaigns ?? [];
  const from = data && data.total ? (page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(page * data.page_size, data.total) : 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  }

  function pickFilter(next: Filter) {
    setFilter((current) => (current === next ? "" : next));
    setPage(1);
  }

  const tiles: Array<{ key: Filter; label: string; value: string; hint: string; tone?: string; pressable: boolean }> = summary
    ? [
        { key: "", label: "Inversión", value: money(summary.spend, data?.currency ?? null), hint: `${summary.active} activas · ${summary.paused} en pausa`, pressable: false },
        { key: "rejected", label: "Con rechazos", value: fmtNum(summary.rejected), hint: "anuncios que no se publican", tone: summary.rejected ? "var(--bad)" : undefined, pressable: true },
        { key: "learning", label: "En aprendizaje", value: fmtNum(summary.learning), hint: "limitado o aprendiendo", tone: summary.learning ? "var(--warn)" : undefined, pressable: true },
        { key: "", label: "Atribuido", value: money(summary.purchase_value, data?.currency ?? null), hint: "lo que Meta se atribuye", pressable: false },
        { key: "", label: "ROAS de la cartera", value: summary.spend ? roasText(summary.purchase_value / summary.spend) : "—", hint: breakeven != null ? `equilibrio ${roasText(breakeven)}` : "sin costes para el equilibrio", pressable: false },
      ]
    : [];

  return (
    <div className={pulse.root}>
      <header className={s.top}>
        <div>
          <nav className={s.crumb} aria-label="Ruta" style={{ padding: 0 }}>
            <a href="/shopify">Analítica</a>
            <span aria-hidden="true">/</span>
            <a href="/meta">Meta Ads</a>
            <span aria-hidden="true">/</span>
            <span>Campañas</span>
          </nav>
          <h1>Campañas</h1>
          <div className={s.topMeta}>
            <span className={pulse.chip}>{connectionId ? "Tienda seleccionada" : "Todas las tiendas"}</span>
            {data ? <span className={pulse.chip}>{fmtNum(data.total)} campañas</span> : null}
          </div>
        </div>
        <a className={cx(pulse.btn, pulse.ghost)} href="/meta">Volver a Meta Ads</a>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona un cliente" hint="Elige una organización en la barra superior para consultar sus campañas." />
      ) : (
        <>
          {tiles.length ? (
            <div className={s.sum} role="group" aria-label="Resumen de campañas">
              {tiles.map((tile, index) => (
                <button key={`${tile.label}-${index}`} type="button" className={s.sumC} disabled={!tile.pressable} style={tile.pressable ? undefined : { cursor: "default" }} aria-pressed={tile.pressable && filter === tile.key} onClick={() => tile.pressable && pickFilter(tile.key)}>
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
              <input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar por nombre" aria-label="Buscar campañas" />
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
              <div className={pulse.seg} role="group" aria-label="Periodo">
                {PERIODS.map((value) => (
                  <button key={value} type="button" aria-pressed={periodDays === value} onClick={() => { setPeriodDays(value); setPage(1); }}>
                    {value === 365 ? "1 año" : `${value} d`}
                  </button>
                ))}
              </div>
              <div className={pulse.seg} role="group" aria-label="Vista">
                <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Tarjetas</button>
                <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Tabla</button>
              </div>
            </div>
          </div>

          {query.error && !data ? <ErrorBlock>{query.error}</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando campañas…" /> : null}

          {data && rows.length === 0 ? (
            <div className={pulse.panel}>
              <p className={pulse.empty}>No hay campañas con estos filtros.</p>
            </div>
          ) : null}

          {data && rows.length && view === "grid" ? (
            <div className={s.grid}>
              {rows.map((row) => <CampaignCard key={row.campaign_id} row={row} breakeven={breakeven ?? null} currency={data.currency} href={campaignHref(row.campaign_id, organizationId, connectionId)} />)}
            </div>
          ) : null}

          {data && rows.length && view === "table" ? (
            <div className={pulse.panel}>
              <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
                <table className={pulse.tbl}>
                  <thead>
                    <tr>
                      <th>Campaña</th>
                      <th>Estado</th>
                      <th style={{ textAlign: "right" }}>Gasto</th>
                      <th style={{ textAlign: "right" }}>Atribuido</th>
                      <th style={{ textAlign: "right" }}>ROAS</th>
                      <th style={{ textAlign: "right" }}>Compras</th>
                      <th style={{ textAlign: "right" }}>CTR</th>
                      <th>Aviso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const state = campaignState(row.effective_status);
                      const alert = campaignAlert(row, breakeven ?? null);
                      const belowBreakeven = breakeven != null && row.roas != null && row.roas < breakeven;
                      return (
                        <tr key={row.campaign_id}>
                          <td>
                            <a className={s.prod} href={campaignHref(row.campaign_id, organizationId, connectionId)} aria-label={`Abrir ficha de ${row.name}`}>
                              <span>
                                <b style={{ fontWeight: 600 }}>{row.name}</b>
                                <br />
                                <span className={pulse.muted} style={{ fontSize: 12 }}>{row.objective ?? "Sin objetivo"} · {row.ad_set_count} conjuntos</span>
                              </span>
                            </a>
                          </td>
                          <td><span className={cx(pulse.chip, state.tone === "good" ? pulse.chipGood : undefined)}>{state.label}</span></td>
                          <td className={pulse.tdN}>{money(row.spend, data.currency)}</td>
                          <td className={pulse.tdN}>{money(row.purchase_value, data.currency)}</td>
                          <td className={pulse.tdN} style={{ color: belowBreakeven ? "var(--bad)" : undefined }}>{roasText(row.roas)}</td>
                          <td className={pulse.tdN}>{fmtNum(row.purchases)}</td>
                          <td className={pulse.tdN}>{row.impressions ? `${fmtNum((row.clicks / row.impressions) * 100, 2)} %` : "—"}</td>
                          <td>{alert ? <span className={cx(pulse.chip, alert.tone === "bad" ? pulse.chipBad : pulse.chipWarn)}>{alert.text}</span> : null}</td>
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
            <span>Gasto, compras e ingresos son los que Meta se atribuye con su ventana; no son ventas de la tienda y no se suman a otras plataformas.</span>
          </footer>
        </>
      )}
    </div>
  );
}

export default function MetaCampaignsPage() {
  return (
    <PortalShell title="Campañas Meta Ads">
      {(bootstrap) => (
        <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando campañas…" />}>
          <CampaignsContent bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
