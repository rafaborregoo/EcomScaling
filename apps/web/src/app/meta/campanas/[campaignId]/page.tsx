"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCopilotAsk } from "@/components/copilot-ask";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { AsyncState, Card, ErrorBlock } from "@/components/ui";
import { cx, Empty, SectionHead } from "../../../dashboard/client-pulse";
import { fmtNum } from "../../../dashboard/client-pulse-model";
import pulse from "../../../dashboard/client-pulse.module.css";
import s from "../../../shopify/productos/catalogo.module.css";
import m from "../../campanas.module.css";
import type { MetaCampaignDetailResponse } from "../../campaign-types";
import { adSetAlert, budgetText, campaignState, learningLabel, money, PERIODS, type Period, roasText } from "../../campaign-model";

type ShopifyFinance = { financial: { breakeven_roas: number | null; items_without_cost: number; has_settings: boolean } };

const RANKING_LABEL: Record<string, string> = { ABOVE_AVERAGE: "Por encima", AVERAGE: "Media", BELOW_AVERAGE_10: "Por debajo", BELOW_AVERAGE_20: "Por debajo", BELOW_AVERAGE_35: "Muy por debajo" };
function rankingLabel(value: string | null) {
  return value ? RANKING_LABEL[value] ?? value : "Sin veredicto";
}
function rankingTone(value: string | null): "good" | "bad" | undefined {
  if (value === "ABOVE_AVERAGE") return "good";
  if (value?.startsWith("BELOW_AVERAGE")) return "bad";
  return undefined;
}

function weekdayLabels(values: Array<{ date: string }>) {
  return values.map((row) => new Date(`${row.date}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }));
}

function RoasGauge({ value, breakeven, dark }: { value: number | null; breakeven: number | null; dark?: boolean }) {
  const max = Math.max(5, breakeven ?? 0, value ?? 0, 1) * 1.1;
  const pct = Math.min((value ?? 0) / max, 1);
  const bePct = breakeven != null ? Math.min(breakeven / max, 1) : null;
  const color = value == null ? "var(--ink-3)" : breakeven != null && value < breakeven ? (dark ? "#ff9aae" : "var(--bad)") : dark ? "#5fd3a8" : "var(--good)";
  return (
    <div className={dark ? m.hGauge : undefined}>
      <div className={m.gauge}>
        <b style={{ width: `${pct * 100}%`, background: color }} />
        {bePct != null ? <i style={{ left: `${bePct * 100}%` }} /> : null}
      </div>
      {dark ? <div className={m.gaugeEnds}><span>0</span><span>Equilibrio {roasText(breakeven)}</span><span>{fmtNum(max, 0)}×</span></div> : null}
    </div>
  );
}

function CampaignDetail({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const params = useParams<{ campaignId: string }>();
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const ask = useCopilotAsk();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId && bootstrap.memberships.some((item) => item.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId ? (searchParams.get("connectionId") ?? "") : activeConnection.connectionId;
  const [periodDays, setPeriodDays] = useState<Period>(30);
  useEffect(() => setPeriodDays(30), [organizationId, connectionId, params.campaignId]);

  const queryParams = new URLSearchParams({ periodDays: String(periodDays) });
  if (connectionId) queryParams.set("connectionId", connectionId);
  const key = organizationId ? `/v1/organizations/${organizationId}/meta/campaigns/${encodeURIComponent(params.campaignId)}?${queryParams.toString()}` : null;
  const query = useCachedQuery<MetaCampaignDetailResponse>(key);
  const data = query.data;
  const financeKey = organizationId ? `/v1/organizations/${organizationId}/shopify/metrics?days=${periodDays}` : null;
  const finance = useCachedQuery<ShopifyFinance>(financeKey);
  const breakeven = finance.data?.financial.has_settings && finance.data.financial.items_without_cost === 0 ? finance.data.financial.breakeven_roas : null;

  const backParams = new URLSearchParams();
  if (organizationId) backParams.set("organizationId", organizationId);
  if (connectionId) backParams.set("connectionId", connectionId);
  const backHref = `/meta/campanas${backParams.size ? `?${backParams.toString()}` : ""}`;

  function returnToCampaigns() {
    if (organizationId) activeOrganization.setOrganizationId(organizationId);
    activeConnection.setConnectionId(connectionId);
  }

  if (!organizationId) return <div className={pulse.root}><Card title="Selecciona un cliente" description="Elige una organización en la barra superior." /></div>;
  if (query.error && !data) return <div className={pulse.root}><Card title="No se pudo abrir la campaña"><ErrorBlock>{query.error}</ErrorBlock></Card></div>;
  if (!data) return <div className={pulse.root}><AsyncState status="loading" loadingLabel="Cargando ficha de campaña…" /></div>;

  const { campaign } = data;
  const currency = data.currency;
  const state = campaignState(campaign.effective_status);
  const belowBreakeven = campaign.effective_status === "ACTIVE" && breakeven != null && campaign.roas != null && campaign.roas < breakeven;
  const daily = data.daily;
  const dayLabels = weekdayLabels(daily);
  const spendMax = Math.max(...daily.map((row) => row.spend), 1);
  const revenueMax = Math.max(...daily.map((row) => row.purchase_value), 1);
  const avgSpendPerDay = daily.length ? campaign.spend / daily.length : null;
  const adSets = data.ad_sets.slice().sort((a, b) => b.spend_in_period - a.spend_in_period);
  const ads = data.ads;
  const adMax = Math.max(...ads.map((ad) => ad.spend), 1);
  const colorFor = (index: number) => ["var(--store)", "var(--meta)", "var(--klaviyo)", "var(--warn)", "var(--good)"][index % 5];

  const askCopilot = (question: string, focusLabel: string) =>
    ask({ question: `${question} (campaña «${campaign.name}», últimos ${periodDays} días)`, focusLabel });

  return (
    <div className={pulse.root}>
      <nav className={s.crumb} aria-label="Ruta">
        <a href="/meta">Meta Ads</a>
        <span aria-hidden="true">/</span>
        <Link href={backHref} onClick={returnToCampaigns}>Campañas</Link>
        <span aria-hidden="true">/</span>
        <span>{campaign.name}</span>
      </nav>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.fHero} aria-labelledby="campaign-titulo">
        <div className={m.fLeft}>
          <div><p className={m.fKind}>{campaign.objective ?? "Sin objetivo"} · {budgetText(campaign.budget, currency)}</p></div>
          <div className={m.fBig}>{roasText(campaign.roas)}<small>ROAS atribuido por Meta en {periodDays} días</small></div>
          <RoasGauge value={campaign.roas} breakeven={breakeven} dark />
        </div>
        <div className={s.info}>
          <div className={s.heroMeta}>
            <span>Meta Ads</span>
            <span>Campaña</span>
            {campaign.external_created_at ? <span>Creada {new Date(campaign.external_created_at).toLocaleDateString("es-ES")}</span> : null}
          </div>
          <div>
            <div className={s.chips}>
              <span className={cx(pulse.chip, state.tone === "good" ? pulse.chipGood : undefined)}>{state.label}</span>
              <span className={pulse.chip}>{campaign.ad_set_count} conjunto{campaign.ad_set_count === 1 ? "" : "s"} · {campaign.ad_count} anuncio{campaign.ad_count === 1 ? "" : "s"}</span>
              {belowBreakeven ? <span className={cx(pulse.chip, pulse.chipBad)}>Bajo el equilibrio</span> : null}
            </div>
            <h1 id="campaign-titulo">{campaign.name}</h1>
          </div>
          <p className={s.desc} style={{ maxWidth: "62ch" }}>
            {campaign.roas == null
              ? `Sin gasto en los últimos ${periodDays} días.`
              : breakeven == null
                ? "Completa los costes de producto en Shopify para ver el ROAS de equilibrio."
                : campaign.roas >= breakeven
                  ? `Rinde por encima del equilibrio (${roasText(breakeven)}): según Meta, se paga con el margen de lo que vende.`
                  : `Está por debajo del equilibrio (${roasText(breakeven)}): según Meta, cuesta más de lo que deja el margen.`}
          </p>
          <dl className={s.dl}>
            <div><dt>Gasto</dt><dd>{money(campaign.spend, currency)}</dd><small>{avgSpendPerDay != null ? `${money(avgSpendPerDay, currency)} al día` : "sin datos"}</small></div>
            <div><dt>Ingresos atribuidos</dt><dd>{money(campaign.purchase_value, currency)}</dd><small>según Meta</small></div>
            <div><dt>Compras</dt><dd>{fmtNum(campaign.purchases)}</dd><small>atribuidas</small></div>
            <div><dt>CPM</dt><dd>{campaign.cpm != null ? money(campaign.cpm, currency) : "—"}</dd><small>por 1.000 impresiones</small></div>
            <div><dt>CPC</dt><dd>{campaign.cpc != null ? money(campaign.cpc, currency) : "—"}</dd><small>por clic</small></div>
            <div><dt>CTR</dt><dd>{campaign.impressions ? `${fmtNum((campaign.clicks / campaign.impressions) * 100, 2)} %` : "—"}</dd><small>clics / impresiones</small></div>
          </dl>
          <div className={s.actions}>
            <button type="button" className={cx(pulse.btn, pulse.acc)} onClick={() => askCopilot("Explícame cómo va esta campaña y qué haría primero", "Ficha de campaña")}>
              <span className={pulse.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>IA</span>
              Preguntar qué haría
            </button>
            <Link className={cx(pulse.btn, pulse.ghost)} href={backHref} onClick={returnToCampaigns}>Volver a campañas</Link>
          </div>
        </div>
      </section>

      {/* ------------------------------ Fiabilidad ------------------------------ */}
      <div className={s.checks} role="group" aria-label="Fiabilidad de los datos">
        <div className={s.check}>
          <div className={s.checkH}><span>Atribución</span><span className={cx(pulse.chip, pulse.chipWarn)}>de Meta</span></div>
          <p>{campaign.purchase_action_type ? `Cuenta como compra: ${campaign.purchase_action_type}.` : "Compras según la definición de Meta."} No se suma a otras plataformas.</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Aprendizaje</span><span className={cx(pulse.chip, adSets.some((row) => row.learning_stage_status === "LEARNING_LIMITED") ? pulse.chipWarn : pulse.chipGood)}>{adSets.some((row) => row.learning_stage_status === "LEARNING_LIMITED") ? "limitado" : "OK"}</span></div>
          <p>{adSets.filter((row) => row.learning_stage_status).length} de {adSets.length} conjuntos en aprendizaje.</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Revisión</span><span className={cx(pulse.chip, data.issues.length ? pulse.chipBad : pulse.chipGood)}>{data.issues.length ? `${data.issues.length} rechazado${data.issues.length === 1 ? "" : "s"}` : "OK"}</span></div>
          <p>{data.issues.length ? "Hay anuncios que no se publican por políticas de Meta." : "Todos los anuncios aprobados."}</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Equilibrio</span><span className={cx(pulse.chip, breakeven == null ? pulse.chipWarn : pulse.chipGood)}>{breakeven == null ? "sin calcular" : "OK"}</span></div>
          <p>{breakeven == null ? "Faltan costes de producto en Shopify para calcular el ROAS de equilibrio." : `Se paga sola a partir de ${roasText(breakeven)}.`}</p>
        </div>
      </div>

      <nav className={s.snav} aria-label="Secciones">
        <a href="#rendimiento">Rendimiento</a>
        <a href="#conjuntos">Conjuntos</a>
        <a href="#anuncios">Anuncios</a>
        <a href="#cambios">Cambios</a>
      </nav>

      {/* ------------------------------ Rendimiento ------------------------------ */}
      <section id="rendimiento" className={pulse.sec}>
        <div className={pulse.secHead} style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
          <h2>Rendimiento</h2>
          <p className={pulse.aiLine}>{daily.length ? `Gasta ${money(avgSpendPerDay, currency)} al día y Meta se atribuye ${money(daily.reduce((sum, row) => sum + row.purchase_value, 0) / Math.max(daily.length, 1), currency)}.` : "Sin gasto en el periodo."}</p>
          <div className={pulse.seg} role="group" aria-label="Periodo del rendimiento">
            {PERIODS.map((value) => <button key={value} type="button" aria-pressed={periodDays === value} onClick={() => setPeriodDays(value)}>{value === 365 ? "1 año" : `${value} d`}</button>)}
          </div>
        </div>
        <div className={pulse.two}>
          <div className={pulse.panel}>
            <div className={pulse.panelH}><div><h3>Gasto por día</h3><p className={pulse.sub}>Últimos {periodDays} días</p></div></div>
            {daily.some((row) => row.spend > 0) ? (
              <>
                <div className={s.bars} role="img" aria-label="Gasto por día">
                  {daily.map((row, index) => <div key={row.date} title={`${dayLabels[index]}: ${money(row.spend, currency)}`}><i style={{ height: `${(row.spend / spendMax) * 100}%`, background: "var(--meta)" }} /></div>)}
                </div>
                <div className={s.barsL}>{dayLabels.map((label, index) => <span key={`${label}-${index}`}>{index % Math.max(Math.ceil(dayLabels.length / 8), 1) === 0 ? label : ""}</span>)}</div>
              </>
            ) : <Empty>Sin gasto en el periodo.</Empty>}
          </div>
          <div className={pulse.panel}>
            <div className={pulse.panelH}><div><h3>Ingresos atribuidos por día</h3><p className={pulse.sub}>Según Meta, misma ventana</p></div></div>
            {daily.some((row) => row.purchase_value > 0) ? (
              <>
                <div className={s.bars} role="img" aria-label="Ingresos atribuidos por día">
                  {daily.map((row, index) => <div key={row.date} title={`${dayLabels[index]}: ${money(row.purchase_value, currency)}`}><i style={{ height: `${(row.purchase_value / revenueMax) * 100}%`, background: "var(--good)" }} /></div>)}
                </div>
                <div className={s.barsL}>{dayLabels.map((label, index) => <span key={`${label}-${index}`}>{index % Math.max(Math.ceil(dayLabels.length / 8), 1) === 0 ? label : ""}</span>)}</div>
              </>
            ) : <Empty>Sin compras atribuidas en el periodo.</Empty>}
          </div>
        </div>
      </section>

      {/* ------------------------------ Conjuntos ------------------------------ */}
      <section id="conjuntos" className={pulse.sec}>
        <SectionHead id="conjuntos-titulo" title="Conjuntos de anuncios" ai={null} fallback="Dónde se reparte el presupuesto y en qué fase de aprendizaje está cada uno." onAsk={() => askCopilot("¿Qué conjunto de anuncios tocaría primero?", "Conjuntos de la campaña")} />
        <div className={pulse.panel}>
          {adSets.length ? (
            <div className={pulse.tblWrap}>
              <table className={pulse.tbl}>
                <thead><tr><th>Conjunto</th><th>Estado</th><th>Aprendizaje</th><th style={{ textAlign: "right" }}>Gasto</th><th style={{ textAlign: "right" }}>ROAS</th><th>Frente al equilibrio</th></tr></thead>
                <tbody>
                  {adSets.map((row) => {
                    const alert = adSetAlert(row);
                    return (
                      <tr key={row.ad_set_id}>
                        <td><b style={{ fontWeight: 600 }}>{row.ad_set_name}</b></td>
                        <td><span className={cx(pulse.chip, row.effective_status === "ACTIVE" ? pulse.chipGood : undefined)}>{row.effective_status ?? "—"}</span></td>
                        <td>{alert ? <span className={cx(pulse.chip, alert.tone === "warn" ? pulse.chipWarn : pulse.chipAcc)}>{alert.text}</span> : <span className={pulse.muted}>{learningLabel(row.learning_stage_status)}</span>}</td>
                        <td className={pulse.tdN}>{money(row.spend_in_period, currency)}</td>
                        <td className={pulse.tdN}>{roasText(row.roas_in_period)}</td>
                        <td style={{ minWidth: 130 }}><RoasGauge value={row.roas_in_period} breakeven={breakeven} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty>Sin conjuntos con actividad en el periodo.</Empty>}
        </div>
      </section>

      {/* ------------------------------ Anuncios ------------------------------ */}
      <section id="anuncios" className={pulse.sec}>
        <SectionHead id="anuncios-titulo" title="Anuncios" ai={null} fallback="Qué pieza funciona y cuál quema presupuesto, según el gasto y el veredicto de Meta." onAsk={() => askCopilot("¿Qué anuncio de esta campaña pausarías?", "Anuncios de la campaña")} />
        <div className={pulse.panel}>
          {ads.length ? (
            <div className={m.adGrid}>
              {ads.map((ad, index) => (
                <div key={ad.ad_id} className={m.ad}>
                  <div className={m.adImg} style={{ background: colorFor(index) }}>{ad.has_video ? "Vídeo" : "Imagen"}</div>
                  <b style={{ fontWeight: 600, fontSize: 13 }}>{ad.ad_name}</b>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span className={pulse.muted}>{ad.spend ? money(ad.spend, ad.spend_currency) : "sin gasto"}</span>
                    <b className={pulse.num}>{roasText(ad.roas)}</b>
                  </div>
                  <div className={m.meter}><b style={{ width: `${(ad.spend / adMax) * 100}%`, background: "var(--meta)" }} /></div>
                  {ad.enough_volume ? (
                    <div className={m.rank}>
                      <span className={cx(pulse.chip, rankingTone(ad.quality_ranking) === "good" ? pulse.chipGood : rankingTone(ad.quality_ranking) === "bad" ? pulse.chipBad : undefined)} title="Calidad">C: {rankingLabel(ad.quality_ranking)}</span>
                      <span className={cx(pulse.chip, rankingTone(ad.engagement_rate_ranking) === "good" ? pulse.chipGood : rankingTone(ad.engagement_rate_ranking) === "bad" ? pulse.chipBad : undefined)} title="Interacción">I: {rankingLabel(ad.engagement_rate_ranking)}</span>
                      <span className={cx(pulse.chip, rankingTone(ad.conversion_rate_ranking) === "good" ? pulse.chipGood : rankingTone(ad.conversion_rate_ranking) === "bad" ? pulse.chipBad : undefined)} title="Conversión">V: {rankingLabel(ad.conversion_rate_ranking)}</span>
                    </div>
                  ) : <p className={pulse.muted} style={{ fontSize: 11.5 }}>Sin volumen suficiente ({fmtNum(data.min_impressions_for_rates)} impresiones)</p>}
                </div>
              ))}
            </div>
          ) : <Empty>Sin anuncios con gasto en el periodo.</Empty>}
        </div>
      </section>

      {/* ------------------------------ Cambios ------------------------------ */}
      <section id="cambios" className={pulse.sec}>
        <SectionHead id="cambios-titulo" title="Cambios y su efecto" ai={null} fallback={`Compara ${data.change_window_days} días antes y después de cada cambio sobre la misma campaña, conjunto o anuncio.`} onAsk={() => askCopilot("¿Qué cambio reciente explica mejor el rendimiento?", "Cambios de la campaña")} />
        <div className={pulse.panel}>
          {data.changes.length ? (
            <ol className={m.tl}>
              {data.changes.map((change, index) => (
                <li key={`${change.event_time}-${index}`}>
                  <time>{new Date(change.event_time).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</time>
                  <i aria-hidden="true" />
                  <span>
                    <b style={{ fontWeight: 600 }}>{change.translated_event_type ?? change.event_type}{change.object_name ? ` · ${change.object_name}` : ""}</b>
                    <small>
                      Gasto {money(change.spend_before, currency)} → {money(change.spend_after, currency)}
                      {change.roas_delta_pct != null ? `, ROAS ${change.roas_delta_pct > 0 ? "+" : ""}${fmtNum(change.roas_delta_pct)} %` : ""}
                      {change.actor_name ? ` · ${change.actor_name}` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          ) : <Empty>Sin cambios con suficiente gasto a los dos lados en el periodo.</Empty>}
        </div>
        {data.issues.length ? (
          <div className={pulse.panel}>
            <div className={pulse.panelH}><div><h3>Anuncios con incidencia</h3><p className={pulse.sub}>Motivo que da Meta</p></div></div>
            <ul style={{ display: "grid", gap: 10 }}>
              {data.issues.map((issue) => (
                <li key={`${issue.ad_id}-${issue.error_type}`}>
                  <b style={{ fontWeight: 600 }}>{issue.ad_name}</b>
                  <p className={pulse.sub} style={{ margin: 0 }}>{issue.error_summary ?? issue.error_type ?? "Sin detalle"}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <footer className={s.foot}>
        <span>Gasto, compras e ingresos atribuidos por Meta con su ventana; no son ventas de la tienda.</span>
        <Link href={backHref} onClick={returnToCampaigns}>← Volver a campañas</Link>
      </footer>
    </div>
  );
}

export default function MetaCampaignDetailPage() {
  return (
    <PortalShell title="Ficha de campaña Meta Ads">
      {(bootstrap) => (
        <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando campaña…" />}>
          <CampaignDetail bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
