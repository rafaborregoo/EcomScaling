"use client";

import { useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { cx, Delta, Empty, Kpi, MONTHS, ago, niceStep } from "../dashboard/client-pulse";
import { fmtEur, fmtNum } from "../dashboard/client-pulse-model";
import { salesChangePct } from "../dashboard/store-pulse";
import pulse from "../dashboard/client-pulse.module.css";
import k from "./analytics.module.css";
import {
  clickTone,
  DELIVERY_RATES,
  groupInventory,
  linkLabel,
  openTone,
  rateState,
  rateZones,
  type Entity,
  type EmailReport,
  type Insights,
  type InventoryGroup,
  type Tone,
} from "./analytics-model";

/**
 * Analítica de email de un cliente (/klaviyo).
 *
 * Mismo lenguaje que Pulso y /meta (tokens de client-pulse.module.css); el color
 * lleva significado: verde petróleo = serie de datos, azafrán = campañas,
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
    <div className={cx(k.alert, tone === "bad" ? k.alertBad : tone === "good" ? k.alertGood : k.alertWarn)}>
      <span className={k.ic} aria-hidden="true">
        {tone === "good" ? "✓" : "!"}
      </span>
      <div>
        <b>{title}</b>
        {text ? <p>{text}</p> : null}
      </div>
    </div>
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

function Hero({ report, organizationName, periodLabel }: { report: EmailReport; organizationName: string; periodLabel: string }) {
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
          <p className={pulse.heroMeta}>
            {organizationName} · EUR atribuidos por Klaviyo · {periodLabel}
          </p>
          <p className={k.heroBig}>{fmtEur(totals.revenue)}</p>
          <p className={k.heroRow}>
            <Delta change={previous ? salesChangePct(totals.revenue, previous.revenue) : null} />
            {previous ? <span>frente a {fmtEur(previous.revenue)} del periodo anterior</span> : null}
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
          <p className={k.caveat}>Atribución de Klaviyo en su propia ventana de conversión. No es venta Shopify y no se suma a Meta ni a Google.</p>
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
  const { totals: t, previous: p } = report;
  return (
    <div className={k.kpis} role="group" aria-label="Cifras de email">
      <Kpi
        label="€ por destinatario"
        value={t.revenue_per_recipient != null ? fmtEur(t.revenue_per_recipient, 2) : "—"}
        delta={<Delta change={p ? salesChangePct(t.revenue_per_recipient ?? 0, p.revenue_per_recipient) : null} />}
        vs={p?.revenue_per_recipient != null ? fmtEur(p.revenue_per_recipient, 2) : null}
        slot={<p className={pulse.trackTxt}>Lo que vale cada envío</p>}
      />
      <Kpi
        label="Apertura"
        value={pct(t.open_rate)}
        delta={<Delta change={ppChange(t.open_rate, p?.open_rate)} suffix="pp" />}
        vs={p ? pct(p.open_rate) : null}
        slot={<p className={pulse.trackTxt}>Aperturas únicas / entregados</p>}
      />
      <Kpi
        label="Clic"
        value={pct(t.click_rate, 2)}
        delta={<Delta change={ppChange(t.click_rate, p?.click_rate)} suffix="pp" />}
        vs={p ? pct(p.click_rate, 2) : null}
        slot={<p className={pulse.trackTxt}>Clics únicos / entregados</p>}
      />
      <Kpi
        label="Clic sobre apertura"
        value={pct(t.ctor)}
        delta={<Delta change={ppChange(t.ctor, p?.ctor)} suffix="pp" />}
        vs={p ? pct(p.ctor) : null}
        slot={<p className={pulse.trackTxt}>Calidad del contenido</p>}
      />
      <Kpi
        label="Conversiones"
        value={fmtNum(t.conversions)}
        delta={<Delta change={p ? salesChangePct(t.conversions, p.conversions) : null} />}
        vs={p ? fmtNum(p.conversions) : null}
        slot={<p className={pulse.trackTxt}>{fmtNum(t.recipients)} destinatarios</p>}
      />
    </div>
  );
}

function Reliability({ insights, loading }: { insights: Insights | undefined; loading: boolean }) {
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
                  ? "Ninguno de estos emails añade UTM a sus enlaces."
                  : `${fmtNum(h.emails_sin_utm)} de ${fmtNum(h.emails_total)} emails no añaden UTM a sus enlaces.`,
              text: "Su tráfico llega a Shopify y a Analytics sin atribuir: la venta existe, pero nadie sabe que la trajo el email. Se activa en las opciones de seguimiento de cada campaña o flujo.",
            });
          }
          if (h.emails_sin_seguimiento_clics > 0) {
            alerts.push({
              tone: "warn",
              title: `${fmtNum(h.emails_sin_seguimiento_clics)} de ${fmtNum(h.emails_total)} emails sin seguimiento de clics.`,
              text: "Sus clics no se registran, así que sus ventas no se pueden atribuir.",
            });
          }
          if (h.emails_sin_cuerpo > 0) {
            alerts.push({
              tone: "warn",
              title: `${fmtNum(h.emails_sin_cuerpo)} email${h.emails_sin_cuerpo === 1 ? "" : "s"} sin cuerpo descargado.`,
              text: "Suele significar que su plantilla se borró en Klaviyo.",
            });
          }
          if (h.emails_sin_asunto > 0) {
            alerts.push({ tone: "warn", title: `${fmtNum(h.emails_sin_asunto)} email${h.emails_sin_asunto === 1 ? "" : "s"} sin asunto.` });
          }
          if (h.recursos_no_traidos) {
            alerts.push({
              tone: "warn",
              title: `El último sync dejó recursos sin traer (${h.recursos_no_traidos}).`,
              text: "El inventario puede estar incompleto: que algo no aparezca no prueba que no exista.",
            });
          }
          return (
            <>
              <div className={pulse.panelH}>
                <div>
                  <h3 id="kl-rel">Fiabilidad de las cifras</h3>
                  <p className={pulse.sub}>Si esto está roto, lo de abajo mide otra cosa.</p>
                </div>
                {alerts.length ? (
                  <span className={cx(pulse.chip, pulse.chipWarn)}>
                    {alerts.length} aviso{alerts.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className={cx(pulse.chip, pulse.chipGood)}>sin avisos</span>
                )}
              </div>
              <div className={k.rel}>
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
                <div className={k.alerts}>
                  {alerts.length ? (
                    alerts.map((alert) => <AlertRow key={alert.title} {...alert} />)
                  ) : (
                    <AlertRow tone="good" title={`Los ${fmtNum(h.emails_total)} emails están bien configurados para medir.`} />
                  )}
                </div>
              </div>
              <p className={k.foot}>
                Métrica de conversión: {h.metrica_conversion ?? "sin elegir"}.
                {h.ultimo_sync ? ` Última sincronización ${new Date(h.ultimo_sync).toLocaleString("es-ES")}.` : " Sin sincronizar todavía."}
              </p>
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
          <h3 id="kl-subjects">Asuntos de campaña</h3>
          <p className={pulse.sub}>
            Media del periodo: apertura {pct(avgOpen)} · clic {pct(avgClick)}
          </p>
        </div>
        {isConsultant ? (
          <div className={pulse.seg} role="group" aria-label="Orden">
            <button type="button" aria-pressed={mode === "rev"} onClick={() => setMode("rev")}>
              Más ingresos
            </button>
            <button type="button" aria-pressed={mode === "low"} onClick={() => setMode("low")}>
              A revisar
            </button>
          </div>
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
              <span>{mode === "rev" ? "Ingresos" : "Apertura vs. media"}</span>
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

function Traits({ report }: { report: EmailReport }) {
  const traits = report.subject_traits;
  const max = Math.max(...(traits ?? []).flatMap((t) => [t.with_open_rate ?? 0, t.without_open_rate ?? 0]), 0.01);
  return (
    <section className={pulse.panel} aria-labelledby="kl-traits">
      <div className={pulse.panelH}>
        <div>
          <h3 id="kl-traits">Qué funciona en el asunto</h3>
          <p className={pulse.sub}>Apertura con y sin cada rasgo.</p>
        </div>
      </div>
      {traits == null ? (
        <p className={pulse.error}>No se pudo analizar los asuntos.</p>
      ) : traits.length === 0 ? (
        <Empty>Hace falta más variedad de envíos para comparar asuntos.</Empty>
      ) : (
        <div>
          {traits.map((t) => {
            const diff = t.with_open_rate != null && t.without_open_rate != null ? (t.with_open_rate - t.without_open_rate) * 100 : null;
            const tone: Tone = t.better === "con" ? "good" : t.better === "sin" ? "bad" : "";
            return (
              <div key={t.trait} className={k.trait}>
                <b>{t.label}</b>
                {t.better && diff != null ? (
                  <span className={cx(pulse.chip, toneChip(tone))}>
                    abre {diff >= 0 ? "+" : "−"}
                    {fmtNum(Math.abs(diff))} pp
                  </span>
                ) : (
                  <span className={pulse.chip}>pocos envíos</span>
                )}
                <div className={k.pair}>
                  <div className={k.pr}>
                    <span className={k.w}>Con</span>
                    <div className={k.tr}>
                      <i className={tone || "mute"} style={{ width: `${((t.with_open_rate ?? 0) / max) * 100}%` }} />
                    </div>
                    <span className={k.n}>
                      {pct(t.with_open_rate)} <small>· {t.with_emails}</small>
                    </span>
                  </div>
                  <div className={k.pr}>
                    <span className={k.w}>Sin</span>
                    <div className={k.tr}>
                      <i className="mute" style={{ width: `${((t.without_open_rate ?? 0) / max) * 100}%` }} />
                    </div>
                    <span className={k.n}>
                      {pct(t.without_open_rate)} <small>· {t.without_emails}</small>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Links({ report }: { report: EmailReport }) {
  const links = report.top_links;
  const max = Math.max(...(links ?? []).map((l) => l.clicks), 1);
  return (
    <section className={pulse.panel} aria-labelledby="kl-links">
      <div className={pulse.panelH}>
        <h3 id="kl-links">Enlaces más pulsados</h3>
      </div>
      {links == null ? (
        <p className={pulse.error}>No se pudieron cargar los enlaces.</p>
      ) : links.length === 0 ? (
        <Empty>Todavía no hay clics registrados en este periodo.</Empty>
      ) : (
        <>
          <div className={k.lh}>
            <span>Enlace</span>
            <span />
            <span>Clics</span>
            <span>Pers.</span>
          </div>
          {links.slice(0, 6).map((l, i) => (
            <div key={l.url} className={k.link}>
              <span className={k.lk} title={l.url}>
                {linkLabel(l.url)}
              </span>
              <div className={k.tr}>
                <i className={i ? "soft" : undefined} style={{ width: `${(l.clicks / max) * 100}%` }} />
              </div>
              <span className={k.c}>{fmtNum(l.clicks)}</span>
              <span className={cx(k.c, k.m)}>{fmtNum(l.personas)}</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function Flows({ report }: { report: EmailReport }) {
  const flows = report.flows.slice().sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(...flows.map((f) => f.revenue), 1);
  return (
    <section className={pulse.panel} aria-labelledby="kl-flows">
      <div className={pulse.panelH}>
        <div>
          <h3 id="kl-flows">Flujos automáticos</h3>
          <p className={pulse.sub}>Por ingresos atribuidos.</p>
        </div>
      </div>
      {flows.length === 0 ? (
        <Empty>No hay flujos sincronizados con datos.</Empty>
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

function Issues({ group }: { group: InventoryGroup }) {
  if (!group.sinUtm && !group.sinCuerpo) return <span className={cx(pulse.chip, pulse.chipGood)}>todo en orden</span>;
  return (
    <>
      {group.sinUtm ? <span className={cx(pulse.chip, pulse.chipBad)}>{group.sinUtm} sin UTM</span> : null}
      {group.sinCuerpo ? <span className={cx(pulse.chip, pulse.chipWarn)}>{group.sinCuerpo} sin cuerpo</span> : null}
    </>
  );
}

function Inventory({ insights, loading }: { insights: Insights | undefined; loading: boolean }) {
  const groups = groupInventory(insights?.emails ?? []);
  return (
    <section id="klaviyo-emails" className={pulse.sec} aria-labelledby="kl-inv">
      <SecHead id="kl-inv" title="Qué emails hay" line="El problema se ve en el título de cada bloque, sin abrirlo." />
      {insights?.unavailable.includes("emails") ? (
        <p className={pulse.error}>No se ha podido calcular el inventario de emails. El resto de la página sí es fiable.</p>
      ) : groups.length === 0 ? (
        <div className={pulse.panel}>
          <Empty>{loading ? "Cargando los emails…" : "Todavía no hay emails sincronizados. Aparecerán tras la primera sincronización con contenido en Klaviyo."}</Empty>
        </div>
      ) : (
        <div className={k.inv}>
          {groups.map((group) => (
            <details key={group.key}>
              <summary>
                <b>{group.name}</b>
                {group.status ? <span className={cx(pulse.chip, group.status === "live" ? pulse.chipGood : undefined)}>{group.status === "live" ? "activo" : group.status}</span> : null}
                {group.trigger ? <span className={k.tg}>se dispara con: {group.trigger}</span> : null}
                <span className={k.sp}>
                  <span className={pulse.chip}>
                    {group.emails.length} email{group.emails.length === 1 ? "" : "s"}
                  </span>
                  <Issues group={group} />
                </span>
              </summary>
              {group.emails.map((email) => (
                <div key={email.message_id} className={k.em}>
                  <span className={k.o}>{email.source === "flow" ? `${email.position_in_parent}º` : group.source === "campaign" ? "—" : ""}</span>
                  <div className={k.s}>
                    <b title={email.subject ?? undefined}>{email.subject ?? "sin asunto"}</b>
                    {email.source === "campaign" ? <span>{email.parent_name}</span> : email.preview_text ? <span>{email.preview_text}</span> : null}
                  </div>
                  <span className={cx(k.kb, !email.body_chars && k.none)}>{email.body_chars ? `${Math.round(email.body_chars / 1024)} KB` : "sin cuerpo"}</span>
                  <span className={k.u}>
                    <span className={cx(pulse.chip, email.adds_utm ? pulse.chipGood : pulse.chipBad)}>UTM {email.adds_utm ? "sí" : "no"}</span>
                  </span>
                </div>
              ))}
            </details>
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
          <a key={tile.section} className={k.workTile} href={`/marketing?section=${tile.section}&${scope}`}>
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
  const report = reportQuery.data;
  const insights = insightsQuery.data;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  if (!report) {
    return (
      <div className={pulse.root}>
        <div className={pulse.hero}>
          <p className={pulse.heroMeta}>{organizationName} · Klaviyo</p>
          <p className={pulse.headline}>{reportQuery.error ? "No hemos podido cargar Klaviyo." : "Cargando el email marketing…"}</p>
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
              <a className={cx(pulse.btn, pulse.acc)} href="/integraciones">
                Conectar Klaviyo
              </a>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const lastSync = insights?.health?.ultimo_sync ?? null;

  return (
    <div className={pulse.root}>
      <header className={k.top}>
        <div>
          <h1>Klaviyo</h1>
          <p>Qué emails salen, qué dicen y qué se puede medir de ellos.</p>
        </div>
        <div className={k.topR}>
          {insights?.health ? (
            <span className={cx(pulse.chip, lastSync ? pulse.chipGood : pulse.chipWarn)}>{lastSync ? `Sincronizado ${ago(lastSync)}` : "Sin sincronizar"}</span>
          ) : null}
          <div className={pulse.seg} role="group" aria-label="Periodo">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" aria-pressed={p.key === period} onClick={() => setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <Hero report={report} organizationName={organizationName} periodLabel={periodLabel} />
      <Figures report={report} />
      {isConsultant ? <KlaviyoWork organizationId={organizationId} connectionId={connectionId} /> : null}
      <Reliability insights={insights} loading={insightsQuery.isLoading} />
      {isConsultant ? <Delivery report={report} /> : null}

      <div className={k.two}>
        <Subjects report={report} isConsultant={isConsultant} />
        <Traits report={report} />
      </div>
      <div className={cx(k.two, isConsultant ? k.twoEven : k.one)}>
        <Links report={report} />
        {isConsultant ? <Flows report={report} /> : null}
      </div>

      <Inventory insights={insights} loading={insightsQuery.isLoading} />
    </div>
  );
}
