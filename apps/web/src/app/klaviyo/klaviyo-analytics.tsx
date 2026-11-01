"use client";

import { buttonVariants } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { useCachedQuery, useKeepPrevious } from "@/lib/use-cached-query";
import { cx, Delta, Empty, Kpi, MONTHS, ago, niceStep } from "../dashboard/client-pulse";
import { fmtNum } from "../dashboard/client-pulse-model";
import { salesChangePct } from "../dashboard/store-pulse";
import pulse from "../dashboard/client-pulse.module.css";
import k from "./analytics.module.css";
import {
  clickTone,
  DELIVERY_RATES,
  openTone,
  rateState,
  rateZones,
  type Entity,
  type EmailReport,
  type Insights,
  type Tone,
} from "./analytics-model";

/**
 * Analítica de email de un cliente (/klaviyo).
 *
 * Mismo lenguaje que Pulso y /meta (tokens de client-pulse.module.css); el color
 * lleva significado: verde grafito = serie de datos, azafrán = campañas,
 * verde/ámbar/rojo = solo estado. Todo ingreso es "atribuido por Klaviyo"
 * (ADR-0021): nunca se suma a lo que atribuye otra plataforma.
 *
 * Las tasas de entrega, los asuntos a revisar y la tabla de flujos son del
 * consultor; el cliente ve el resultado.
 */

const PERIODS = [
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
  { key: "180", label: "6 meses" },
  { key: "365", label: "1 año" },
  { key: "all", label: "Todo" },
] as const;
type Period = (typeof PERIODS)[number]["key"];

/** Importes en la moneda de la cuenta de Klaviyo (sin cuenta conocida, euros como hasta ahora). */
const moneyIn = (code: string | null | undefined) => {
  const currency = code || "EUR";
  return (value: number, decimals = 0) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: "always" }).format(value);
};
const pct = (ratio: number | null | undefined, digits = 1) => (ratio == null ? "—" : `${fmtNum(ratio * 100, digits)} %`);
const monthShort = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)} ${iso.slice(2, 4)}`;
/** Cambio de una tasa en puntos porcentuales, para <Delta suffix="pp">. */
const ppChange = (current: number | null, previous: number | null | undefined) =>
  current == null || previous == null ? null : (current - previous) * 100;
const toneChip = (tone: Tone) => (tone === "good" ? pulse.chipGood : tone === "warn" ? pulse.chipWarn : tone === "bad" ? pulse.chipBad : undefined);
const axisLabel = (value: number) => (value === 0 ? "0" : value >= 1000 ? `${fmtNum(value / 1000, value % 1000 ? 1 : 0)} k` : fmtNum(value));

type Alert = { tone: "warn" | "bad"; title: string; text?: string };

function AlertRow({ tone, title, text }: { tone: "warn" | "bad" | "good"; title: string; text?: string }) {
  return (
    <Banner tone={tone === "bad" ? "danger" : tone === "good" ? "success" : "warn"} title={title}>
      {text}
    </Banner>
  );
}

function SecHead({ id, title, line }: { id: string; title: string; line: string }) {
  return (
    <div className={pulse.secHead}>
      <h2 id={id}>{title}</h2>
      <p className={pulse.aiLine}>{line}</p>
    </div>
  );
}

function Hero({ report, periodLabel }: { report: EmailReport; periodLabel: string }) {
  const fmtEur = moneyIn(report.currency_code);
  const { totals, previous } = report;
  const trend = report.trend.slice(-12);
  const channel = totals.flow_revenue + totals.campaign_revenue;
  const flowShare = channel > 0 ? (totals.flow_revenue / channel) * 100 : null;
  const maxTotal = Math.max(...trend.map((t) => t.flow_revenue + t.campaign_revenue), 1);
  const step = niceStep(maxTotal / 3);
  const top = Math.ceil(maxTotal / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <section id="klaviyo-rendimiento" className={pulse.hero} aria-label="Ingresos atribuidos por Klaviyo">
      <div className={k.heroGrid}>
        <div>
          <p className={pulse.heroMeta}>Ventas que Klaviyo atribuye a tus emails · {periodLabel}</p>
          <p className={k.heroBig}>{fmtEur(totals.revenue)}</p>
          <p className={k.heroRow}>
            <Delta change={previous?.revenue ? salesChangePct(totals.revenue, previous.revenue) : null} />
            {previous?.revenue ? <span>frente a {fmtEur(previous.revenue)} del periodo anterior</span> : null}
          </p>
          {flowShare !== null ? (
            <>
              <div className={k.split} aria-hidden="true">
                <i className={k.flowColor} style={{ width: `${flowShare}%` }} />
                <i className={k.campColor} style={{ width: `${100 - flowShare}%` }} />
              </div>
              <div className={k.splitL}>
                <div>
                  <span className={cx(k.sw, k.flowColor)} />
                  <span>Flujos automáticos</span>
                  <b>{fmtEur(totals.flow_revenue)}</b>
                  <span className={k.m}>{fmtNum(flowShare)} %</span>
                </div>
                <div>
                  <span className={cx(k.sw, k.campColor)} />
                  <span>Campañas</span>
                  <b>{fmtEur(totals.campaign_revenue)}</b>
                  <span className={k.m}>{fmtNum(100 - flowShare)} %</span>
                </div>
              </div>
            </>
          ) : null}
          <p className={k.caveat}>Es la cuenta de Klaviyo, no la de tu tienda: no la sumes a lo que dice Meta.</p>
        </div>

        {trend.length > 1 ? (
          <div className={k.chart} role="img" aria-label="Ingresos atribuidos por mes, flujos y campañas">
            <div className={k.y}>
              {ticks.map((t) => (
                <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>
                  {axisLabel(t)}
                </span>
              ))}
            </div>
            <div className={k.plot}>
              {ticks.map((t) => (
                <div key={t} className={k.gl} style={{ bottom: `${(t / top) * 100}%` }} />
              ))}
              {trend.map((t) => {
                const total = t.flow_revenue + t.campaign_revenue;
                return (
                  <div key={t.month} className={k.col} title={`${monthShort(t.month)}: flujos ${fmtEur(t.flow_revenue)}, campañas ${fmtEur(t.campaign_revenue)}`}>
                    <div className={k.stack} style={{ height: `${(total / top) * 100}%` }}>
                      <span className={k.tot}>{fmtEur(total)}</span>
                      <i className={k.campColor} style={{ height: `${total ? (t.campaign_revenue / total) * 100 : 0}%` }} />
                      <i className={k.flowColor} style={{ height: `${total ? (t.flow_revenue / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={k.xl}>
              {trend.map((t) => (
                <span key={t.month}>{monthShort(t.month)}</span>
              ))}
            </div>
            <div className={k.legend} aria-hidden="true">
              <span>
                <i className={cx(k.sw, k.flowColor)} />
                Flujos automáticos
              </span>
              <span>
                <i className={cx(k.sw, k.campColor)} />
                Campañas
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Figures({ report }: { report: EmailReport }) {
  const fmtEur = moneyIn(report.currency_code);
  const { totals: t, previous: p } = report;
  return (
    <div className={k.kpis} role="group" aria-label="Cifras de email">
      <Kpi
        label="Ventas por email"
        value={t.revenue_per_recipient != null ? fmtEur(t.revenue_per_recipient, 2) : "—"}
        delta={<Delta change={p ? salesChangePct(t.revenue_per_recipient ?? 0, p.revenue_per_recipient) : null} />}
        vs={p?.revenue_per_recipient != null ? fmtEur(p.revenue_per_recipient, 2) : null}
        slot={<p className={pulse.trackTxt}>Lo que vende cada email enviado</p>}
      />
      <Kpi
        label="Apertura"
        value={pct(t.open_rate)}
        delta={<Delta change={ppChange(t.open_rate, p?.open_rate)} suffix="pp" />}
        vs={p ? pct(p.open_rate) : null}
        slot={<p className={pulse.trackTxt}>De cada 100 que lo reciben, cuántos lo abren</p>}
      />
      <Kpi
        label="Clic"
        value={pct(t.click_rate, 2)}
        delta={<Delta change={ppChange(t.click_rate, p?.click_rate)} suffix="pp" />}
        vs={p ? pct(p.click_rate, 2) : null}
        slot={<p className={pulse.trackTxt}>De cada 100 que lo reciben, cuántos pulsan un enlace</p>}
      />
      <Kpi
        label="Compras"
        value={fmtNum(t.conversions)}
        delta={<Delta change={p ? salesChangePct(t.conversions, p.conversions) : null} />}
        vs={p ? fmtNum(p.conversions) : null}
        slot={<p className={pulse.trackTxt}>{fmtNum(t.recipients)} emails enviados</p>}
      />
    </div>
  );
}

function Reliability({ insights, loading, isConsultant }: { insights: Insights | undefined; loading: boolean; isConsultant: boolean }) {
  const h = insights?.health ?? null;
  return (
    <section id="klaviyo-medicion" className={pulse.panel} aria-labelledby="kl-rel">
      {!h ? (
        loading ? (
          <p className={pulse.empty}>Cargando la medición…</p>
        ) : (
          <p className={pulse.error}>No se ha podido calcular el estado de la medición. El resto de la página sí es fiable.</p>
        )
      ) : (
        (() => {
          const alerts: Alert[] = [];
          if (h.emails_sin_utm > 0) {
            alerts.push({
              tone: h.emails_sin_utm === h.emails_total ? "bad" : "warn",
              title:
                h.emails_sin_utm === h.emails_total
                  ? "Tus emails no marcan sus enlaces (UTM)."
                  : `${fmtNum(h.emails_sin_utm)} de ${fmtNum(h.emails_total)} emails no marcan sus enlaces (UTM).`,
              text: "Las ventas que traen llegan a tu tienda sin firma: nadie sabe que vinieron del email. Se activa en Klaviyo, en el seguimiento de cada campaña o flujo.",
            });
          }
          if (h.emails_sin_seguimiento_clics > 0) {
            alerts.push({
              tone: "warn",
              title: `${fmtNum(h.emails_sin_seguimiento_clics)} de ${fmtNum(h.emails_total)} emails no cuentan los clics.`,
              text: "Sin clics contados, sus ventas no se pueden atribuir al email.",
            });
          }
          if (h.emails_sin_cuerpo > 0) {
            alerts.push({
              tone: "warn",
              title: `No vemos el contenido de ${fmtNum(h.emails_sin_cuerpo)} email${h.emails_sin_cuerpo === 1 ? "" : "s"}.`,
              text: "Suele pasar cuando su plantilla se borró en Klaviyo.",
            });
          }
          if (h.emails_sin_asunto > 0) {
            alerts.push({ tone: "warn", title: `${fmtNum(h.emails_sin_asunto)} email${h.emails_sin_asunto === 1 ? "" : "s"} sin asunto.` });
          }
          if (h.recursos_no_traidos) {
            alerts.push({
              tone: "warn",
              title: "La última sincronización no trajo todo.",
              text: "Si echas algo en falta, puede que aún no haya llegado.",
            });
          }
          if (!alerts.length && !isConsultant) {
            return <p id="kl-rel" className={k.okLine}>✓ Tus emails están bien preparados para medir lo que venden.</p>;
          }
          return (
            <>
              <div className={pulse.panelH}>
                <div>
                  <h3 id="kl-rel">Revisa esto en Klaviyo</h3>
                  <p className={pulse.sub}>Mientras siga así, las cifras de arriba se quedan cortas.</p>
                </div>
                {alerts.length ? (
                  <span className={cx(pulse.chip, pulse.chipWarn)}>
                    {alerts.length} aviso{alerts.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className={cx(pulse.chip, pulse.chipGood)}>sin avisos</span>
                )}
              </div>
              <div className={isConsultant ? k.rel : undefined}>
                {isConsultant ? (
                <div className={k.counts}>
                  <div className={k.count}>
                    <span className={pulse.lbl}>Emails</span>
                    <b>{fmtNum(h.emails_total)}</b>
                  </div>
                  <div className={k.count}>
                    <span className={pulse.lbl}>Flujos activos</span>
                    <b>{fmtNum(h.flujos_activos)}</b>
                  </div>
                  <div className={k.count}>
                    <span className={pulse.lbl}>Listas</span>
                    <b>{fmtNum(h.listas)}</b>
                  </div>
                  <div className={k.count}>
                    <span className={pulse.lbl}>Segmentos</span>
                    <b>{fmtNum(h.segmentos)}</b>
                  </div>
                </div>
                ) : null}
                <div className={k.alerts}>
                  {alerts.length ? (
                    alerts.map((alert) => <AlertRow key={alert.title} {...alert} />)
                  ) : (
                    <AlertRow tone="good" title={`Los ${fmtNum(h.emails_total)} emails están bien configurados para medir.`} />
                  )}
                </div>
              </div>
              {isConsultant ? (
              <p className={k.foot}>
                Métrica de conversión: {h.metrica_conversion ?? "sin elegir"}.
                {h.ultimo_sync ? ` Última sincronización ${new Date(h.ultimo_sync).toLocaleString("es-ES")}.` : " Sin sincronizar todavía."}
              </p>
              ) : null}
            </>
          );
        })()
      )}
    </section>
  );
}

function Delivery({ report }: { report: EmailReport }) {
  return (
    <section className={pulse.sec} aria-labelledby="kl-delivery">
      <SecHead id="kl-delivery" title="Entrega" line="Dónde cae cada tasa frente a su umbral." />
      <div className={k.gauges}>
        {DELIVERY_RATES.map((rate) => {
          const value = report.totals[rate.key];
          if (value == null) return null;
          const state = rateState(value, rate.warn, rate.bad);
          const zones = rateZones(value, rate.warn, rate.bad);
          const stateClass = state === "bad" ? k.stateBad : state === "warn" ? k.stateWarn : k.stateGood;
          const label = state === "bad" ? "fuera del límite" : state === "warn" ? "cerca del límite" : "dentro del objetivo";
          return (
            <div key={rate.key} className={cx(k.gauge, stateClass)}>
              <div className={k.gaugeT}>
                <span>{rate.label}</span>
                <span className={cx(pulse.chip, toneChip(state))}>{label}</span>
              </div>
              <p className={k.gaugeV}>{pct(value, rate.digits)}</p>
              <div className={k.zwrap}>
                <div className={k.zones} aria-hidden="true">
                  <i className={k.zg} style={{ width: `${zones.good}%` }} />
                  <i className={k.zw} style={{ width: `${zones.amber}%` }} />
                  <i className={k.zb} style={{ width: `${zones.red}%` }} />
                </div>
                <span className={k.mk} style={{ left: `${zones.marker}%` }} />
              </div>
              <p className={k.zl}>
                <span>objetivo &lt; {pct(rate.warn, rate.digits)}</span>
                <span>límite {pct(rate.bad, rate.digits)}</span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Subjects({ report, isConsultant }: { report: EmailReport; isConsultant: boolean }) {
  const fmtEur = moneyIn(report.currency_code);
  const [mode, setMode] = useState<"rev" | "low">("rev");
  const avgOpen = report.totals.open_rate;
  const avgClick = report.totals.click_rate;
  const sent = report.campaigns.filter((c) => c.recipients > 0);
  const rows: Entity[] =
    mode === "rev"
      ? sent.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 6)
      : sent
          .filter((c) => c.open_rate != null)
          .sort((a, b) => (a.open_rate ?? 0) - (b.open_rate ?? 0))
          .slice(0, 5);
  const maxRevenue = Math.max(...sent.map((c) => c.revenue), 1);

  return (
    <section className={pulse.panel} aria-labelledby="kl-subjects">
      <div className={pulse.panelH}>
        <div>
          <h3 id="kl-subjects">Tus campañas</h3>
          <p className={pulse.sub}>
            Lo que vendió cada envío. De media, abren el {pct(avgOpen)} y pulsan el {pct(avgClick)}.
          </p>
        </div>
        {isConsultant ? (
          <ToggleGroup aria-label="Orden" value={mode} onValueChange={setMode}>
            <ToggleGroupItem value="rev">Más ingresos</ToggleGroupItem>
            <ToggleGroupItem value="low">A revisar</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <Empty>Aún no hay campañas con envíos en este periodo.</Empty>
      ) : (
        <div className={k.scroll}>
          <div style={{ minWidth: 520 }}>
            <div className={k.rowsH}>
              <span>#</span>
              <span>Asunto</span>
              <span>{mode === "rev" ? "Ventas" : "Apertura vs. media"}</span>
              <span>Apertura</span>
              <span>Clic</span>
            </div>
            {rows.map((c, i) => {
              const tone = openTone(c.open_rate, avgOpen);
              return (
                <div key={c.id} className={k.row}>
                  <span className={k.rk}>{i + 1}</span>
                  <div className={k.nm}>
                    <b title={c.subject || c.name}>{c.subject || c.name}</b>
                    <span>{fmtNum(c.recipients)} destinatarios</span>
                  </div>
                  <div className={k.bar}>
                    <div className={k.tr}>
                      {mode === "rev" ? (
                        <i style={{ width: `${(c.revenue / maxRevenue) * 100}%` }} />
                      ) : (
                        <>
                          <i className={tone || "mute"} style={{ width: `${Math.min(((c.open_rate ?? 0) / 0.6) * 100, 100)}%` }} />
                          {avgOpen != null ? <u style={{ left: `${(avgOpen / 0.6) * 100}%` }} title={`media ${pct(avgOpen)}`} /> : null}
                        </>
                      )}
                    </div>
                    <span className={k.bv}>{fmtEur(c.revenue)}</span>
                  </div>
                  <span className={k.rate}>
                    <span className={cx(pulse.chip, toneChip(tone))}>{pct(c.open_rate)}</span>
                  </span>
                  <span className={k.rate}>
                    <span className={cx(pulse.chip, toneChip(clickTone(c.click_rate, avgClick)))}>{pct(c.click_rate)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Flows({ report, activeFlows }: { report: EmailReport; activeFlows: number | null }) {
  const fmtEur = moneyIn(report.currency_code);
  const flows = report.flows.slice().sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(...flows.map((f) => f.revenue), 1);
  return (
    <section className={pulse.panel} aria-labelledby="kl-flows">
      <div className={pulse.panelH}>
        <div>
          <h3 id="kl-flows">Flujos automáticos</h3>
          <p className={pulse.sub}>Emails que salen solos. Ordenados por lo que venden.</p>
        </div>
      </div>
      {flows.length === 0 ? (
        <Empty>
          {activeFlows === 0
            ? "Aún no tienes ninguno. Bienvenida, carrito abandonado o después de la compra: salen solos y suelen ser lo que más vende del email."
            : "Tus flujos no han enviado nada en este periodo."}
        </Empty>
      ) : (
        <div>
          {flows.map((f) => (
            <div key={f.id} className={k.flow}>
              <div className={k.nm}>
                <b title={f.name}>{f.name}</b>
                {f.trigger_type ? <span>{f.trigger_type}</span> : null}
              </div>
              <div className={k.bar}>
                <div className={k.tr}>
                  <i style={{ width: `${(f.revenue / max) * 100}%` }} />
                </div>
                <span className={k.bv}>{fmtEur(f.revenue)}</span>
              </div>
              <span className={k.rate}>
                {f.recipients > 0 ? (
                  <span className={cx(pulse.chip, toneChip(openTone(f.open_rate, report.totals.open_rate)))}>{pct(f.open_rate)}</span>
                ) : (
                  <span className={cx(pulse.chip, pulse.chipWarn)}>sin datos</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Trabajo en Klaviyo, sin salir de NORA (solo consultor). Cada entrada abre la
 * sección de Marketing que ya hace ese trabajo, con el cliente y la tienda de
 * esta pantalla puestos: campañas (crear, programar, cancelar), flows
 * (constructor), plantillas (estudio) y audiencias (listas y segmentos).
 */
function KlaviyoWork({ organizationId, connectionId }: { organizationId: string; connectionId: string | null }) {
  const scope = `organizationId=${encodeURIComponent(organizationId)}${connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : ""}`;
  const tiles = [
    { section: "campanas", title: "Campañas", text: "Crear, revisar con el cliente, programar y cancelar envíos." },
    { section: "flows", title: "Flows", text: "Diseñar un flow y dejarlo en Klaviyo como borrador." },
    { section: "plantillas", title: "Plantillas", text: "Elegir una plantilla y escribir la pieza en el estudio." },
    { section: "audiencias", title: "Audiencias", text: "Listas y segmentos para decidir a quién se escribe." },
  ];
  return (
    <section aria-labelledby="kl-work" className={k.work}>
      <h3 id="kl-work">Trabajar en Klaviyo</h3>
      <p>Todo se hace desde NORA: no hace falta abrir Klaviyo.</p>
      <div className={k.workTiles}>
        {tiles.map((tile) => (
          <a key={tile.section} className={`${k.workTile} task-lift`} href={`/marketing?section=${tile.section}&${scope}`}>
            <b>{tile.title}</b>
            <span>{tile.text}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function KlaviyoAnalytics({
  organizationId,
  organizationName,
  connectionId,
  isConsultant,
}: {
  organizationId: string;
  organizationName: string;
  // Tienda activa: la cuenta de Klaviyo cuelga de ella, así que sin esto un
  // cliente con dos tiendas vería los emails de las dos mezclados.
  connectionId: string | null;
  isConsultant: boolean;
}) {
  const [period, setPeriod] = useState<Period>("90");
  const base = `/v1/organizations/${organizationId}/klaviyo`;
  const query = `days=${period}${connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : ""}`;
  const reportQuery = useCachedQuery<EmailReport>(`${base}/email-report?${query}`);
  const insightsQuery = useCachedQuery<Insights>(`${base}/insights?${query}`);
  const report = useKeepPrevious(reportQuery.data, `${organizationId}|${connectionId}`);
  const insights = insightsQuery.data;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";
  const lastSync = insights?.health?.ultimo_sync ?? null;
  const header = (
    <header className={k.top}>
      <div className="client-sr-title">
        <h1>Klaviyo</h1>
        <p>Lo que venden tus emails.</p>
      </div>
      <div className={k.topR}>
        {insights?.health ? (
          <span className={cx(pulse.chip, lastSync ? pulse.chipGood : pulse.chipWarn)}>{lastSync ? `Sincronizado ${ago(lastSync)}` : "Sin sincronizar"}</span>
        ) : null}
        <ToggleGroup aria-label="Periodo" value={period} onValueChange={setPeriod}>
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p.key} value={p.key}>
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </header>
  );

  if (!report) {
    return (
      <div className={pulse.root}>
        {header}
        <div className={pulse.hero}>
          <p className={pulse.headline}>{reportQuery.error ? "No hemos podido cargar Klaviyo." : "Cargando tus emails…"}</p>
        </div>
      </div>
    );
  }

  if (!report.connected) {
    return (
      <div className={pulse.root}>
        <div className={pulse.hero}>
          <p className={pulse.heroMeta}>{organizationName} · Klaviyo</p>
          <p className={pulse.headline}>Klaviyo todavía no está conectado.</p>
          <p className={pulse.headlineDetail}>
            {isConsultant
              ? "Las integraciones de este cliente se conectan desde su cuenta."
              : "Conecta tu cuenta para ver cuánto generan tus emails, qué flujos funcionan y qué asuntos se abren más."}
          </p>
          {!isConsultant ? (
            <div className={pulse.heroActions}>
              <a className={buttonVariants()} href="/integraciones">
                Conectar Klaviyo
              </a>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={pulse.root} aria-busy={reportQuery.data === undefined} style={reportQuery.data === undefined ? { opacity: 0.55, transition: "opacity 0.2s" } : undefined}>
      {header}

      <Hero report={report} periodLabel={periodLabel} />
      <Figures report={report} />
      {isConsultant ? <KlaviyoWork organizationId={organizationId} connectionId={connectionId} /> : null}
      <Reliability insights={insights} loading={insightsQuery.isLoading} isConsultant={isConsultant} />
      {isConsultant ? <Delivery report={report} /> : null}

      <div className={cx(k.two, k.twoEven)}>
        <Flows report={report} activeFlows={insights?.health?.flujos_activos ?? null} />
        <Subjects report={report} isConsultant={isConsultant} />
      </div>
    </div>
  );
}
