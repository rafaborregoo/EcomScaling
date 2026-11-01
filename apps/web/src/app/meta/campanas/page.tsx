"use client";

import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { PortalShell } from "@/components/portal-shell";
import { Select, AsyncState, Pagination, EmptyState, ErrorBlock, ToggleGroup, ToggleGroupItem } from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { cx, Spark } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import r from "../../shopify/legible.module.css";
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
    <div className={m.gauge} title={breakeven != null ? `Tu mínimo ${roasText(breakeven)}` : undefined}>
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
        <span className={m.kind}>vuelven por cada 1 € (según Meta)</span>
        <RoasGauge value={row.roas} breakeven={breakeven} />
      </div>
      <div className={s.body}>
        <div>
          <p className={s.name}>{row.name}</p>
          <p className={s.meta}>{row.ad_set_count} conjunto{row.ad_set_count === 1 ? "" : "s"} · {row.ad_count} anuncio{row.ad_count === 1 ? "" : "s"}{row.budget ? ` · ${budgetText(row.budget, currency)}` : ""}</p>
        </div>
        <div className={s.price}>
          <b>{row.spend ? money(row.spend, currency) : "—"}</b>
          <span className={pulse.chip}>{row.spend ? `${money(row.purchase_value, currency)} en ventas según Meta` : "sin gasto en el periodo"}</span>
        </div>
        <div className={s.stats} style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div><span>Compras</span><span>{row.purchases ? fmtNum(row.purchases) : "—"}</span></div>
          <div><span>Coste por compra</span><span>{row.spend && row.purchases ? money(row.spend / row.purchases, currency) : "—"}</span></div>
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
  // Todas por defecto: con "Activas" y todo en pausa la página se abría vacía.
  const [status, setStatus] = useState("");
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
        // Rechazos y aprendizaje son avisos: solo ocupan sitio cuando hay alguno
        ...(summary.rejected ? [{ key: "rejected" as Filter, label: "Con rechazos", value: fmtNum(summary.rejected), hint: "anuncios que no se publican", tone: "var(--bad)", pressable: true }] : []),
        ...(summary.learning ? [{ key: "learning" as Filter, label: "Aprendiendo", value: fmtNum(summary.learning), hint: "resultados aún inestables", tone: "var(--warn)", pressable: true }] : []),
        { key: "", label: "Ventas según Meta", value: money(summary.purchase_value, data?.currency ?? null), hint: "no son las ventas de tu tienda", pressable: false },
        { key: "", label: "ROAS", value: summary.spend ? roasText(summary.purchase_value / summary.spend) : "—", hint: breakeven != null ? `tu mínimo: ${roasText(breakeven)}` : "faltan costes para tu mínimo", pressable: false },
      ]
    : [];

  return (
    <div className={`${pulse.root} ${r.pg} ${r.min} nora-min`}>
      <header className={`${s.top} client-sr-title`}>
        <div>
          <h1>Campañas</h1>
        </div>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona un cliente" hint="Elige una organización en la barra superior para consultar sus campañas." />
      ) : (
        <>
          {tiles.length ? (
            <div className={s.sum} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }} role="group" aria-label="Resumen de campañas">
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
              <ToggleGroup aria-label="Estado" value={status} onValueChange={(value) => { setStatus(value); setFilter(""); setPage(1); }}>
                {STATUSES.map((item) => (
                  <ToggleGroupItem key={item.value || "all"} value={item.value}>
                    {item.label}
                    {summary ? <span className="text-xs text-muted tabular-nums">{fmtNum(item.count(summary))}</span> : null}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <label className={s.selectL}>
                Ordenar
                <Select className="w-auto" value={sort} onChange={(value) => { setSort(value as Sort); setPage(1); }} aria-label="Ordenar por" options={SORTS} />
              </label>
              <ToggleGroup aria-label="Periodo" value={periodDays} onValueChange={(value) => { setPeriodDays(value); setPage(1); }}>
                {PERIODS.map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {value === 365 ? "1 año" : `${value} días`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ToggleGroup aria-label="Vista" value={view} onValueChange={setView}>
                <ToggleGroupItem value="grid">Tarjetas</ToggleGroupItem>
                <ToggleGroupItem value="table">Tabla</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {query.error && !data ? <ErrorBlock onRetry={() => query.reload()}>No se han podido cargar los datos. Inténtalo de nuevo en unos segundos.</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando campañas…" /> : null}

          {data && rows.length === 0 ? (
            <div className={pulse.panel}>
              <p className={pulse.empty}>{search ? `Ninguna campaña con «${search}».` : status === "ACTIVE" ? "Ahora mismo no tienes ninguna campaña activa." : status === "PAUSED" ? "No tienes campañas en pausa." : "No hay campañas en este periodo."}</p>
            </div>
          ) : null}

          {data && rows.length && view === "grid" ? (
            <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
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
                      <th style={{ textAlign: "right" }}>Ventas según Meta</th>
                      <th style={{ textAlign: "right" }}>ROAS</th>
                      <th style={{ textAlign: "right" }}>Compras</th>
                      <th style={{ textAlign: "right" }}>Coste por compra</th>
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
                                <span className={pulse.muted} style={{ fontSize: 12 }}>{row.ad_set_count} conjunto{row.ad_set_count === 1 ? "" : "s"}</span>
                              </span>
                            </a>
                          </td>
                          <td><span className={cx(pulse.chip, state.tone === "good" ? pulse.chipGood : undefined)}>{state.label}</span></td>
                          <td className={pulse.tdN} style={{ textAlign: "right" }}>{money(row.spend, data.currency)}</td>
                          <td className={pulse.tdN} style={{ textAlign: "right" }}>{money(row.purchase_value, data.currency)}</td>
                          <td className={pulse.tdN} style={{ textAlign: "right", color: belowBreakeven ? "var(--bad)" : undefined }}>{roasText(row.roas)}</td>
                          <td className={pulse.tdN} style={{ textAlign: "right" }}>{fmtNum(row.purchases)}</td>
                          <td className={pulse.tdN} style={{ textAlign: "right" }}>{row.purchases ? money(row.spend / row.purchases, data.currency) : "—"}</td>
                          <td>{alert ? <span className={cx(pulse.chip, alert.tone === "bad" ? pulse.chipBad : pulse.chipWarn)}>{alert.text}</span> : null}</td>
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
              <span className={pulse.muted}>
                {data.total ? `Mostrando ${fmtNum(from)}–${fmtNum(to)} de ${fmtNum(data.total)}` : "Sin resultados"}
              </span>
              <Pagination page={page} pageCount={totalPages} onChange={setPage} />
            </div>
          ) : null}

          <footer className={s.foot}>
            <span>Compras y ventas según Meta: no son las ventas de tu tienda ni se suman a otros canales.</span>
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
