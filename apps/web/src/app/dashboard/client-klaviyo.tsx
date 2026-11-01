"use client";

import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { MetricVerdict, useMetricAnalysis } from "@/components/metric-verdict";
import { useCopilotAsk } from "@/components/copilot-ask";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import { Skeleton, ToggleGroup, ToggleGroupItem, toast } from "@/components/ui";
import { BarRows } from "@/components/data-bars";
import { salesChangePct } from "./store-pulse";
import { fmtEur, fmtNum } from "./client-pulse-model";
import {
  cx,
  a02FindingText,
  Delta,
  Empty,
  findingFor,
  Kpi,
  A02MetricNotice,
  MONTHS,
  prioClass,
  SectionHead,
  DiagnosticScopeNote,
  dayLabel,
  type Diagnostic,
} from "./client-pulse";
import s from "./client-pulse.module.css";
import { DashboardSections } from "./dashboard-sections";

/**
 * Pestaña Klaviyo del panel del cliente.
 *
 * El email no factura en línea diaria sino a golpes (un envío, un pico), así
 * que el centro de esta vista no es una curva: es de dónde sale el dinero mes
 * a mes, flujos automáticos frente a campañas. Esa es la pregunta que decide
 * el trabajo: si el motor automático sostiene el canal o todo depende de
 * seguir enviando.
 *
 * Todo ingreso es "atribuido por Klaviyo" (ADR-0021): se enseña junto a lo que
 * vende la tienda para dar escala, nunca sumado a otras plataformas.
 */

const PERIODS = [
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
  { key: "all", label: "Todo" },
] as const;

type Totals = {
  revenue: number;
  campaign_revenue: number;
  flow_revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  unsubscribes: number;
  bounced: number;
  spam_complaints: number;
  open_rate: number | null;
  click_rate: number | null;
  ctor: number | null;
  conversion_rate: number | null;
  revenue_per_recipient: number | null;
  unsub_rate: number | null;
  bounce_rate: number | null;
  spam_rate: number | null;
};

type Entity = {
  id: string;
  name: string;
  subject: string | null;
  trigger_type: string | null;
  send_time: string | null;
  revenue: number;
  conversions: number;
  recipients: number;
  open_rate: number | null;
  click_rate: number | null;
  revenue_per_recipient: number | null;
};

type EmailReport = {
  connected: boolean;
  totals: Totals;
  previous: Totals | null;
  trend: Array<{ month: string; campaign_revenue: number; flow_revenue: number }>;
  campaigns: Entity[];
  flows: Entity[];
  subject_traits?: Array<{
    trait: string;
    label: string;
    with_emails: number;
    without_emails: number;
    with_open_rate: number | null;
    without_open_rate: number | null;
    better: "con" | "sin" | null;
  }> | null;
  top_links?: Array<{ url: string; clicks: number; personas: number; mensajes: number }> | null;
};

type KlaviyoInsights = {
  health: {
    emails_total: number;
    emails_sin_asunto: number;
    emails_sin_cuerpo: number;
    emails_sin_utm: number;
    emails_sin_seguimiento_clics: number;
    flujos_activos: number;
    campanas_enviadas: number;
    listas: number;
    segmentos: number;
    metrica_conversion: string | null;
    ultimo_sync: string | null;
    ultimo_sync_estado: string | null;
  } | null;
  unavailable: string[];
};

type StoreSales = { sales: { net_sales: number } };

const pct = (ratio: number | null | undefined, digits = 1) => (ratio == null ? "—" : `${fmtNum(ratio * 100, digits)} %`);
const monthShort = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)} ${iso.slice(2, 4)}`;

function linkLabel(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

/** Cambio de una tasa en puntos porcentuales, para <Delta suffix="pp">. */
function ppChange(current: number | null, previous: number | null | undefined) {
  return current == null || previous == null ? null : (current - previous) * 100;
}

// Umbrales habituales de entregabilidad: por encima, los proveedores de correo
// empiezan a mandar a spam. Son de sector, no de esta cuenta.
const SPAM_LIMIT = 0.001;
const BOUNCE_LIMIT = 0.02;
const UNSUB_LIMIT = 0.005;

export function ClientKlaviyo({ organizationId, organizationName, connectionId, hasConsultant, asConsultant = false }: {
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
  /** Con consultor, las propuestas del analista de email las filtra él y no llegan a Prioridades. */
  hasConsultant: boolean;
  /** Oculta enlaces a la configuración del cliente en el portal consultor. */
  asConsultant?: boolean;
}) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("30");
  const ask = useCopilotAsk();
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const verdictOf = useMetricAnalysis(organizationId, period === "all" ? "all" : Number(period), connectionId);

  const report = useCachedQuery<EmailReport>(`${base}/klaviyo/email-report?days=${period}${scope}`);
  const insights = useCachedQuery<KlaviyoInsights>(`${base}/klaviyo/insights?days=${period}${scope}`);
  const store = useCachedQuery<StoreSales>(`${base}/shopify/metrics?days=${period}${scope}`);
  const emailAi = useCachedQuery<Diagnostic>(`${base}/ai/email-analyst${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=klaviyo${scope}`);


  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";
  const askCopilot = (question: string, focusLabel: string) => ask({ question: `${question} (Klaviyo, ${periodLabel})`, focusLabel, reference: { period_label: periodLabel, filters: { days: period } } });
  const data = report.data;

  if (report.isLoading && !data) {
    return (
      <div className={s.root}>
        <div className={s.hero} role="status" aria-busy="true">
          <p className={s.heroMeta}>{organizationName} · Klaviyo</p>
          <p className={s.headline}>Cargando tu email marketing…</p>
          <Skeleton className="h-32 w-full" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!data || !data.connected) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <p className={s.heroMeta}>{organizationName} · Klaviyo</p>
          <h1 className={s.headline}>{report.error && !data ? "No hemos podido cargar Klaviyo" : "Klaviyo todavía no está conectado"}</h1>
          <p className={s.headlineDetail}>
            {asConsultant
              ? "Las integraciones de este cliente no están disponibles desde el portal consultor."
              : "Conecta tu cuenta para ver cuánto generan tus emails, qué flujos funcionan y qué asuntos se abren más."}
          </p>
          {!asConsultant ? (
            <div className={s.heroActions}>
              <a className={buttonVariants()} href="/integraciones/klaviyo">
                {report.error ? "Revisar conexión de Klaviyo" : "Conectar Klaviyo"}
              </a>
            </div>
          ) : null}
          {report.error ? <div className={s.heroActions}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={report.reload}>Reintentar la carga</button></div> : null}
        </div>
      </div>
    );
  }

  // ---- derivados ----
  const { totals, previous } = data;
  const emailDiag = emailAi.data;
  const a02KlaviyoFinding = findingFor(monitor.data, /email|klaviyo|crm|flujo|newsletter/i);
  const klaviyoFindingFor = (pattern: RegExp) => findingFor(emailDiag, pattern) ?? findingFor(monitor.data, pattern);
  const klaviyoFindingText = (pattern: RegExp) => klaviyoFindingFor(pattern)?.title ?? a02FindingText(monitor.data, pattern);
  const aiHeadline =
    emailDiag?.output.headline ?? emailDiag?.output.findings?.[0]?.title ?? a02KlaviyoFinding?.title ?? null;
  const channelRevenue = totals.flow_revenue + totals.campaign_revenue;
  const flowShare = channelRevenue > 0 ? totals.flow_revenue / channelRevenue : null;
  const storeSales = store.data?.sales.net_sales ?? null;
  const storeShare = storeSales ? totals.revenue / storeSales : null;
  const headline =
    aiHeadline ??
    (flowShare !== null
      ? `El email te trae ${fmtEur(totals.revenue)} según Klaviyo, y ${fmtNum(flowShare * 10, 0)} de cada 10 € llegan solos, desde flujos automáticos.`
      : `Klaviyo se atribuye ${fmtEur(totals.revenue)} en este periodo.`);
  const trend = data.trend.slice(-12);
  const trendMax = Math.max(...trend.map((t) => t.flow_revenue + t.campaign_revenue), 1);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const flows = data.flows.slice().sort((a, b) => b.revenue - a.revenue);
  const flowMax = Math.max(...flows.map((f) => f.revenue), 1);
  const weakestFlow = flows
    .filter((f) => f.recipients >= 100 && f.revenue_per_recipient != null)
    .sort((a, b) => (a.revenue_per_recipient ?? 0) - (b.revenue_per_recipient ?? 0))[0];
  const campaigns = data.campaigns
    .slice()
    .sort((a, b) => Date.parse(b.send_time ?? "") - Date.parse(a.send_time ?? ""))
    .slice(0, 10);
  const bestCampaign = campaigns
    .filter((c) => c.recipients >= 100 && c.revenue_per_recipient != null)
    .sort((a, b) => (b.revenue_per_recipient ?? 0) - (a.revenue_per_recipient ?? 0))[0];
  const health = insights.data?.health ?? null;

  return (
    <div className={s.root}>
      <DashboardSections items={[{"id":"kl-headline","label":"Resumen"},{"id":"kl-flows","label":"Flujos"},{"id":"kl-camp","label":"Campañas"},{"id":"kl-subj","label":"Contenido"},{"id":"kl-health","label":"Salud del canal"}]} />
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.hero} aria-labelledby="kl-headline">
        <div className={s.heroTop}>
          <div>
            <div className={s.heroMeta} style={{ alignItems: "center" }}>
              <span>{organizationName} · Klaviyo</span>
              <ToggleGroup aria-label="Periodo" value={period} onValueChange={setPeriod}>
                {PERIODS.map((p) => (
                  <ToggleGroupItem key={p.key} value={p.key}>
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <h1 id="kl-headline" className={`${s.headline} client-sr-title`}>
              Klaviyo: email y retención
            </h1>
            <p className={s.headlineDetail}>{aiHeadline ? <span className={s.ia}>{(emailDiag?.output.headline ?? emailDiag?.output.findings[0]?.title) ? "A12" : "A02"}</span> : null}{headline}</p>
            <p className={s.headlineDetail}>
              {fmtNum(totals.conversions)} compras atribuidas a {fmtNum(totals.recipients)} envíos. Es lo que Klaviyo se atribuye con su ventana de conversión, no ventas exclusivas del email.
            </p>
            <div className={s.heroActions}>
              <button type="button" className={buttonVariants()} onClick={() => askCopilot("En el periodo analizado, ¿qué email o flujo de Klaviyo revisaría primero y qué métrica lo justifica? Cita la fuente y ventana; distingue ingresos atribuidos de ventas de Shopify.", "Klaviyo")}>
                <span className={s.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>
                  IA
                </span>
                Preguntar qué mejorar
              </button>
              <Link className={buttonVariants({ variant: "secondary" })} href="/klaviyo">
                Analítica completa
              </Link>
            </div>
          </div>
          <aside className={s.heroSide} aria-label="Cómo se reparte">
            <p>
              <strong>De dónde sale</strong>
            </p>
            <div className={s.compare}>
              <div>
                <span>Flujos automáticos</span>
                <span className={s.num}>
                  {fmtEur(totals.flow_revenue)} · {pct(flowShare, 0)}
                </span>
              </div>
              <div>
                <span>Campañas</span>
                <span className={s.num}>
                  {fmtEur(totals.campaign_revenue)} · {pct(flowShare === null ? null : 1 - flowShare, 0)}
                </span>
              </div>
              <div>
                <span>Frente a tu tienda</span>
                <span className={s.num}>{storeShare !== null ? pct(storeShare, 0) : "—"}</span>
              </div>
              <div>
                <span>Cambio</span>
                <Delta change={previous ? salesChangePct(totals.revenue, previous.revenue) : null} />
              </div>
            </div>
            {storeShare !== null ? (
              <p>Lo atribuido a Klaviyo como parte de las ventas netas de tu tienda. Puede solaparse con Meta.</p>
            ) : null}
          </aside>
        </div>

        {trend.length > 1 ? (
          <>
            <div className={s.engine} aria-label="Ingresos atribuidos por Klaviyo por mes, flujos y campañas">
              {trend.map((t) => {
                const total = t.flow_revenue + t.campaign_revenue;
                return (
                  <div
                    key={t.month}
                    className={cx(s.engineCol, t.month.slice(0, 7) === currentMonth && s.engineCur)}
                    title={`${monthShort(t.month)}: flujos ${fmtEur(t.flow_revenue)}, campañas ${fmtEur(t.campaign_revenue)}`}
                  >
                    <span style={{ bottom: `calc(${(total / trendMax) * 100}% + 6px)` }}>{fmtNum(total / 1000, 1).replace(",0", "")}k</span>
                    <i style={{ height: `${(t.campaign_revenue / trendMax) * 100}%`, background: "var(--hero-prev)" }} />
                    <i style={{ height: `${(t.flow_revenue / trendMax) * 100}%`, background: "var(--hero-series)" }} />
                  </div>
                );
              })}
            </div>
            <div className={s.engineLab}>
              {trend.map((t) => (
                <span key={t.month}>{monthShort(t.month)}</span>
              ))}
            </div>
            <div className={s.legend} aria-hidden="true" style={{ marginTop: 0 }}>
              <span>
                <i className={s.lgPin} style={{ background: "var(--hero-series)", borderRadius: 3 }} />
                Flujos automáticos
              </span>
              <span>
                <i className={s.lgPin} style={{ background: "var(--hero-prev)", borderRadius: 3 }} />
                Campañas
              </span>
              <span>Ingresos atribuidos por Klaviyo, por mes</span>
            </div>
          </>
        ) : null}
      </section>

      <section className={s.sec} aria-label="Lectura ejecutiva de Klaviyo">
        <div className={s.panel}>
          <h2 className={s.readingTitle}><span className={s.ia}>A02</span> {monitor.data?.result_scope === "overview" ? "Lectura general del negocio" : "Lectura de Klaviyo"}</h2>
          <p className={s.headlineDetail}>
            {monitor.data?.result_scope === "overview"
              ? a02KlaviyoFinding?.title ?? "La lectura general de A02 no tiene datos suficientes para señalar un hallazgo específico de Klaviyo."
              : monitor.data?.output.headline ?? "El análisis específico de Klaviyo aparecerá aquí cuando termine su primera ejecución."}
          </p>
          <DiagnosticScopeNote diagnostic={monitor.data} />
        </div>
      </section>

      <AiDiagnosticSection
        organizationId={organizationId}
        title="A12 · Analista de email"
        description="Compara el último mes completo con el anterior usando informes mensuales de Klaviyo. La página solo consulta el resultado guardado; las propuestas se revisan antes de convertirse en tareas."
        getPath="/ai/email-analyst"
        runPath="/ai/email-analyst-run"
        loadingLabel="Cargando el análisis de email…"
        tasksLabelSingular="tarea"
        variant="summary"
      />

      {/* ------------------------------ Cifras ------------------------------ */}
      <div className={cx(s.kpis, s.kpis4)} aria-label="Cifras de email">
        <Kpi
          label="Ingresos atribuidos"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Ingresos atribuidos a Klaviyo" metricKey="klaviyo_attributed_revenue" pattern={/ingresos.*klaviyo|email.*revenue|ingresos atribuid/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={fmtEur(totals.revenue)}
          delta={<Delta change={previous ? salesChangePct(totals.revenue, previous.revenue) : null} />}
          vs={previous ? fmtEur(previous.revenue) : null}
          slot={<p className={s.trackTxt}>Según Klaviyo</p>}
        />
        <Kpi
          label="Compras atribuidas"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Compras atribuidas a Klaviyo" metricKey="klaviyo_attributed_purchases" pattern={/compras.*klaviyo|conversiones.*email|compras atribuid/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={fmtNum(totals.conversions)}
          delta={<Delta change={previous ? salesChangePct(totals.conversions, previous.conversions) : null} />}
          vs={previous ? fmtNum(previous.conversions) : null}
          slot={<p className={s.trackTxt}>{totals.conversion_rate != null ? `${pct(totals.conversion_rate, 2)} de los destinatarios` : " "}</p>}
        />
        <Kpi
          label="Ingresos por destinatario"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Ingresos por destinatario" metricKey="klaviyo_revenue_per_recipient" pattern={/ingresos por destinatario|revenue per recipient|valor.*email/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={totals.revenue_per_recipient != null ? fmtEur(totals.revenue_per_recipient, 2) : "—"}
          delta={<Delta change={previous ? salesChangePct(totals.revenue_per_recipient ?? 0, previous.revenue_per_recipient) : null} />}
          vs={previous?.revenue_per_recipient != null ? fmtEur(previous.revenue_per_recipient, 2) : null}
          slot={<p className={s.trackTxt}>Lo que vale cada email enviado</p>}
        />
        <Kpi
          label="Destinatarios"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Destinatarios" metricKey="klaviyo_recipients" pattern={/destinatarios|recipients|entregabilidad/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={fmtNum(totals.recipients)}
          delta={<Delta change={previous ? salesChangePct(totals.recipients, previous.recipients) : null} />}
          vs={previous ? fmtNum(previous.recipients) : null}
          slot={<p className={s.trackTxt}>{fmtNum(totals.delivered)} entregados</p>}
        />
        <Kpi
          verdict={<MetricVerdict analysis={verdictOf("email_open_rate")} />}
          anchorId="insight-metric-email_open_rate"
          label="Apertura"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Tasa de apertura" metricKey="klaviyo_open_rate" pattern={/apertura|open rate|email.*open/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={pct(totals.open_rate)}
          delta={<Delta change={ppChange(totals.open_rate, previous?.open_rate)} suffix="pp" />}
          vs={previous ? pct(previous.open_rate) : null}
          slot={<p className={s.trackTxt}>Aperturas únicas / entregados</p>}
        />
        <Kpi
          label="Clics"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Clics de email" metricKey="klaviyo_click_rate" pattern={/clic|click rate|ctr/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={pct(totals.click_rate, 2)}
          delta={<Delta change={ppChange(totals.click_rate, previous?.click_rate)} suffix="pp" />}
          vs={previous ? pct(previous.click_rate, 2) : null}
          slot={<p className={s.trackTxt}>{totals.ctor != null ? `${pct(totals.ctor)} de los que abren` : " "}</p>}
        />
        <Kpi
          label="Bajas"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Bajas de email" metricKey="klaviyo_unsubscribe_rate" pattern={/bajas|unsubscribe|cancelaci/i} audience={asConsultant ? "consultor" : "cliente"} />}
          tag={totals.unsub_rate != null && totals.unsub_rate > UNSUB_LIMIT ? "alto" : undefined}
          value={pct(totals.unsub_rate, 2)}
          delta={<Delta change={ppChange(totals.unsub_rate, previous?.unsub_rate)} suffix="pp" invert />}
          vs={previous ? pct(previous.unsub_rate, 2) : null}
          slot={<p className={s.trackTxt}>{fmtNum(totals.unsubscribes)} personas se dieron de baja</p>}
        />
        <Kpi
          label="Quejas de spam"
          aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Quejas de spam" metricKey="klaviyo_spam_rate" pattern={/spam|rebote|bounce|queja/i} audience={asConsultant ? "consultor" : "cliente"} />}
          tag={(totals.spam_rate ?? 0) > SPAM_LIMIT || (totals.bounce_rate ?? 0) > BOUNCE_LIMIT ? "revisar" : undefined}
          value={pct(totals.spam_rate, 2)}
          slot={<p className={s.trackTxt}>Rebotes: {pct(totals.bounce_rate, 1)}</p>}
        />
      </div>

      {/* ------------------------------ Flujos ------------------------------ */}
      <section className={s.sec} aria-labelledby="kl-flows">
        <SectionHead
          id="kl-flows"
          title="Flujos"
          ai={klaviyoFindingText(/flujo|flow|automat|bienvenida|carrito/i)}
          tag="A12"
          fallback={
            weakestFlow
              ? `El flujo que menos rinde por destinatario es «${weakestFlow.name}» (${fmtEur(weakestFlow.revenue_per_recipient ?? 0, 2)}).`
              : "Los emails que se envían solos cuando alguien hace algo."
          }
          onAsk={() => askCopilot("¿Qué flujo automático muestra la oportunidad más clara de mejora según sus métricas? Cita el nombre, la métrica y la ventana; si no hay volumen suficiente, indícalo antes de recomendar un cambio.", "Flujos de Klaviyo")}
        />
        <div className={s.panel}>
          {flows.length === 0 ? (
            <Empty>No hay flujos con envíos en este periodo. Un flujo de bienvenida y otro de carrito abandonado suelen ser lo primero.</Empty>
          ) : (
            <div className={s.tblWrap} role="region" aria-label="Flujos de email; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
              <table className={s.tbl} aria-label="Resultados de los flujos de email">
                <thead>
                  <tr>
                    <th scope="col">Flujo</th>
                    <th scope="col">Ingresos atribuidos</th>
                    <th scope="col">Destinatarios</th>
                    <th scope="col">Apertura</th>
                    <th scope="col">Clics</th>
                    <th scope="col">€ / destinatario</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((f) => (
                    <tr key={f.id}>
                      <td style={{ minWidth: 180 }}>
                        <b style={{ fontWeight: 600 }}>{f.name}</b>
                        {f.trigger_type ? (
                          <span className={s.muted} style={{ display: "block", fontSize: 11.5 }}>
                            Se activa con: {f.trigger_type}
                          </span>
                        ) : null}
                      </td>
                      <td className={s.tdN}>
                        {fmtEur(f.revenue)}
                        <span className={s.shareBar}>
                          <i style={{ width: `${(f.revenue / flowMax) * 100}%`, background: "var(--klaviyo)" }} />
                        </span>
                      </td>
                      <td className={s.tdN}>{fmtNum(f.recipients)}</td>
                      <td className={s.tdN}>{pct(f.open_rate)}</td>
                      <td className={s.tdN}>{pct(f.click_rate, 2)}</td>
                      <td className={s.tdN}>
                        {f.revenue_per_recipient != null ? fmtEur(f.revenue_per_recipient, 2) : "—"}{" "}
                        {weakestFlow?.id === f.id && flows.length > 1 ? <span className={cx(s.chip, s.chipWarn)} title="Menor ingreso atribuido por destinatario en este periodo">Menor retorno</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------ Campañas ------------------------------ */}
      <section className={s.sec} aria-labelledby="kl-camp">
        <SectionHead
          id="kl-camp"
          title="Campañas"
          ai={klaviyoFindingText(/campa|env[ií]o|newsletter|frecuen/i)}
          tag="A12"
          fallback={bestCampaign ? `La que más rindió por destinatario fue «${bestCampaign.name}».` : "Los envíos puntuales a tu lista, del más reciente al más antiguo."}
          onAsk={() => askCopilot("¿Qué rasgos comparten las campañas con mejores resultados observados y qué elemento convendría probar de nuevo? Cita campañas y métricas comparables; no atribuyas causalidad a una diferencia aislada.", "Campañas de Klaviyo")}
        />
        <div className={s.panel}>
          {campaigns.length === 0 ? (
            <Empty>No hay campañas enviadas en este periodo.</Empty>
          ) : (
            <div className={s.tblWrap} role="region" aria-label="Campañas de email; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
              <table className={s.tbl} aria-label="Resultados de las campañas de email">
                <thead>
                  <tr>
                    <th scope="col">Enviada</th>
                    <th scope="col">Campaña</th>
                    <th scope="col">Destinatarios</th>
                    <th scope="col">Apertura</th>
                    <th scope="col">Clics</th>
                    <th scope="col">Ingresos atribuidos</th>
                    <th scope="col">€ / destinatario</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className={s.tdN}>{c.send_time ? dayLabel(c.send_time, true) : "—"}</td>
                      <td style={{ minWidth: 200 }}>
                        <b style={{ fontWeight: 600 }}>{c.name}</b>
                        {c.subject ? (
                          <span className={s.muted} style={{ display: "block", fontSize: 11.5 }}>
                            «{c.subject}»
                          </span>
                        ) : null}
                      </td>
                      <td className={s.tdN}>{fmtNum(c.recipients)}</td>
                      <td className={s.tdN}>{pct(c.open_rate)}</td>
                      <td className={s.tdN}>{pct(c.click_rate, 2)}</td>
                      <td className={s.tdN}>{fmtEur(c.revenue)}</td>
                      <td className={s.tdN}>
                        {c.revenue_per_recipient != null ? fmtEur(c.revenue_per_recipient, 2) : "—"}{" "}
                        {bestCampaign?.id === c.id && campaigns.length > 1 ? <span className={cx(s.chip, s.chipGood)} title="Mayor ingreso atribuido por destinatario en este periodo">Mayor retorno</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------ Asuntos y enlaces ------------------------------ */}
      <section className={s.sec} aria-labelledby="kl-subj">
        <SectionHead
          id="kl-subj"
          title="Qué funciona"
          ai={klaviyoFindingText(/asunto|subject|apertura|enlace|clic/i)}
          tag="A12"
          fallback="Qué rasgos de tus asuntos se abren más y dónde hace clic la gente."
          onAsk={() => askCopilot("¿Qué asuntos tienen mejores aperturas en una comparación válida? Cita el tamaño o periodo disponible y propone una dirección para el próximo asunto sin asegurar que vaya a mejorar el resultado.", "Asuntos de email")}
        />
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Asuntos</h3>
                <p className={s.sub}>Apertura de tus emails con y sin cada rasgo</p>
              </div>
            </div>
            {data.subject_traits == null ? (
              <p className={s.error}>No se pudo analizar los asuntos.</p>
            ) : data.subject_traits.length === 0 ? (
              <Empty>Hace falta más variedad de envíos para comparar asuntos.</Empty>
            ) : (
              <ul>
                {data.subject_traits.map((t) => {
                  const max = Math.max(t.with_open_rate ?? 0, t.without_open_rate ?? 0, 0.01);
                  return (
                    <li key={t.trait} className={s.exc}>
                      <div className={s.qiM} style={{ marginTop: 0, justifyContent: "space-between" }}>
                        <b style={{ fontWeight: 600 }}>{t.label}</b>
                        {t.better ? (
                          <span className={cx(s.chip, t.better === "con" ? s.chipGood : s.chipWarn)}>{t.better === "con" ? "Mejor con él" : "Mejor sin él"}</span>
                        ) : (
                          <span className={s.chip}>Sin diferencia clara</span>
                        )}
                      </div>
                      <BarRows
                        size="sm"
                        max={max}
                        ariaLabel={`Apertura con y sin ${t.label}`}
                        rows={[
                          { key: "con", label: `Con (${t.with_emails})`, value: t.with_open_rate ?? 0, display: pct(t.with_open_rate), color: "var(--klaviyo)" },
                          { key: "sin", label: `Sin (${t.without_emails})`, value: t.without_open_rate ?? 0, display: pct(t.without_open_rate), color: "var(--ink-3)" },
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Enlaces más pulsados</h3>
                <p className={s.sub}>A dónde va la gente desde tus emails</p>
              </div>
            </div>
            {data.top_links == null ? (
              <p className={s.error}>No se pudieron cargar los enlaces.</p>
            ) : data.top_links.length === 0 ? (
              <Empty>Todavía no hay clics registrados en este periodo.</Empty>
            ) : (
              <div className={s.tblWrap} role="region" aria-label="Enlaces de email; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Clics en enlaces de email">
                  <thead>
                    <tr>
                      <th scope="col">Enlace</th>
                      <th scope="col">Clics</th>
                      <th scope="col">Personas</th>
                      <th scope="col">Emails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_links.slice(0, 8).map((l) => (
                      <tr key={l.url}>
                        <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.url}>
                          {linkLabel(l.url)}
                        </td>
                        <td className={s.tdN}>{fmtNum(l.clicks)}</td>
                        <td className={s.tdN}>{fmtNum(l.personas)}</td>
                        <td className={s.tdN}>{fmtNum(l.mensajes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------ Salud ------------------------------ */}
      <section className={s.sec} aria-labelledby="kl-health">
        <SectionHead
          id="kl-health"
          title="Salud de la cuenta"
          ai={klaviyoFindingText(/entregab|spam|rebote|baja|utm|seguimiento|medici/i)}
          tag="A12"
          fallback="Lo que hace que tus emails lleguen a la bandeja y que sus ventas se puedan medir."
          onAsk={() => askCopilot("¿Qué señales verificables afectan a la entregabilidad o a la medición de Klaviyo? Cita el indicador y la fecha; distingue problemas confirmados de datos que todavía no se han recibido.", "Salud de Klaviyo")}
        />
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Entregabilidad</h3>
                <p className={s.sub}>Comparado con los límites que vigilan Gmail y Outlook</p>
              </div>
            </div>
            <ul>
              {[
                { label: "Quejas de spam", v: totals.spam_rate, limit: SPAM_LIMIT, digits: 3 },
                { label: "Rebotes", v: totals.bounce_rate, limit: BOUNCE_LIMIT, digits: 1 },
                { label: "Bajas", v: totals.unsub_rate, limit: UNSUB_LIMIT, digits: 2 },
              ].map((row) => {
                const over = row.v != null && row.v > row.limit;
                return (
                  <li key={row.label} className={s.finding}>
                    <span className={cx(s.pr, over ? s.prUrgent : undefined)} aria-hidden="true" style={over ? undefined : { background: row.v == null ? "var(--ink-3)" : "var(--good)", boxShadow: "none" }} />
                    <div>
                      <div className={s.secondT}>
                        <b style={{ fontWeight: 600 }}>{row.label}</b>
                        <span className={s.num} style={{ color: over ? "var(--bad)" : undefined }}>
                          {pct(row.v, row.digits)}
                        </span>
                      </div>
                      <p className={s.trackTxt}>
                        {row.v == null ? "Sin datos suficientes para evaluar esta tasa." : `${over ? "Por encima" : "Por debajo"} del ${pct(row.limit, row.digits)} a partir del cual empieza a afectar a que lleguen`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Medición y configuración</h3>
                <p className={s.sub}>
                  {health?.ultimo_sync ? `Sincronizado ${dayLabel(health.ultimo_sync, true)}` : "Estado de la cuenta"}
                  {health?.metrica_conversion ? ` · conversión: ${health.metrica_conversion}` : ""}
                </p>
              </div>
            </div>
            {!health ? (
              insights.isLoading ? <p className={s.empty}>Cargando…</p> : <p className={s.error}>No se pudo cargar el estado de la cuenta.</p>
            ) : (
              <>
                <div className={s.minis}>
                  <div className={s.mini}>
                    <span className={s.lbl}>Flujos activos</span>
                    <span className={s.num}>{fmtNum(health.flujos_activos)}</span>
                  </div>
                  <div className={s.mini}>
                    <span className={s.lbl}>Campañas enviadas</span>
                    <span className={s.num}>{fmtNum(health.campanas_enviadas)}</span>
                  </div>
                  <div className={s.mini}>
                    <span className={s.lbl}>Listas</span>
                    <span className={s.num}>{fmtNum(health.listas)}</span>
                  </div>
                  <div className={s.mini}>
                    <span className={s.lbl}>Segmentos</span>
                    <span className={s.num}>{fmtNum(health.segmentos)}</span>
                  </div>
                </div>
                <ul className={s.findings}>
                  {[
                    { n: health.emails_sin_seguimiento_clics, text: "sin seguimiento de clics: sus ventas no se pueden atribuir" },
                    { n: health.emails_sin_utm, text: "sin UTM: tu tienda no sabe que la visita vino del email" },
                    { n: health.emails_sin_asunto, text: "sin asunto" },
                    { n: health.emails_sin_cuerpo, text: "sin contenido" },
                  ]
                    .filter((row) => row.n > 0)
                    .map((row) => (
                      <li key={row.text} className={s.finding}>
                        <span className={cx(s.pr, prioClass("high"))} aria-hidden="true" />
                        <p>
                          <b className={s.num}>{fmtNum(row.n)}</b> de {fmtNum(health.emails_total)} emails {row.text}.
                        </p>
                      </li>
                    ))}
                  {health.emails_sin_seguimiento_clics + health.emails_sin_utm + health.emails_sin_asunto + health.emails_sin_cuerpo === 0 ? (
                    <li className={s.finding}>
                      <span className={s.pr} aria-hidden="true" style={{ background: "var(--good)", boxShadow: "none" }} />
                      <p>Tus {fmtNum(health.emails_total)} emails están bien configurados para medir.</p>
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </div>
        </div>
        {!hasConsultant && emailDiag?.output_status === "pending_approval" && (emailDiag.output.proposed_writes?.length ?? 0) > 0 ? (
          <p className={s.aiNote}>
            <span className={s.ia}>A12</span>
            El analista de email propone {emailDiag.output.proposed_writes?.length ?? 0} mejora(s). Apruébalas en <a href="/dashboard?tab=todo#pulse-hoy">Prioridades</a>.
          </p>
        ) : null}
      </section>
    </div>
  );
}
