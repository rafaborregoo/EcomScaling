"use client";

import { useState } from "react";
import Link from "next/link";
import {
  buildStoreHeadline,
  overCacTarget,
  panelMoney,
  panelNumber,
  panelPct,
  type ProfitStoreRow,
} from "@e-nora/contracts";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useCopilotAsk } from "@/components/copilot-ask";
import { AsyncState, EmptyState } from "@/components/ui";
import {
  AiLine,
  Chip,
  CostStack,
  Delta,
  Hero,
  IaTag,
  Kpis,
  MonthlyChart,
  Panel,
  ScopeBar,
  Section,
  TIER_LABEL,
  cx,
} from "./panel-parts";
import { createLeverTask, useCallNotes, usePanelReading, useProfitability, type PanelNav } from "./panel-data";
import {
  deltaPct,
  funnelSteps,
  targetsByKey,
  type MetricTarget,
  type MonthlyRow,
  type PanelFinancial,
  type PanelFunnel,
} from "./panel-view-model";
import s from "./panel.module.css";

/**
 * Alcance 3 -- una tienda.
 *
 * Responde a "¿por qué esta tienda gana lo que gana?": un pedido medio en
 * cascada, comparado con la tienda hermana del mismo cliente, la publicidad con
 * su objetivo y su techo, y las palancas que terminan en una acción.
 */

type StoreMetrics = {
  margin: { items_with_estimated_cost: number };
  financial: PanelFinancial & {
    has_settings: boolean;
    fixed_expenses_count: number;
    items_without_cost: number;
    uses_shipping_rules: boolean;
    ads_days_with_data: number;
  };
  financial_monthly: MonthlyRow[];
  metric_targets: MetricTarget[];
  previous_period: { sales: { orders_count: number } } | null;
  previous_year: {
    orders_count: number;
    net_revenue_ex_tax: number;
    net_profit: number;
  } | null;
  funnel:
    | (PanelFunnel & {
        conversion_rate_own: number | null;
      })
    | null;
};

type MetaMetrics = { acquisition: { roas: number | null; days_with_data: number } };

/** "El pago es donde más se pierde": el paso intermedio con peor retención. */
function leakNote(funnel: StoreMetrics["funnel"]): string | null {
  if (!funnel?.has_funnel_steps) return null;
  const transitions = [
    { name: "Entre el carrito y el pago", from: funnel.cart_additions, to: funnel.checkouts_reached, miss: "no llegan a pagar" },
    { name: "El pago", from: funnel.checkouts_reached, to: funnel.purchases, miss: "no compran" },
  ].filter((step) => step.from > 0);
  if (transitions.length === 0) return null;
  const worst = [...transitions].sort((a, b) => a.to / a.from - b.to / b.from)[0]!;
  const lost = Math.round((1 - worst.to / worst.from) * 10);
  return `${worst.name} es donde más se pierde: ${lost} de cada 10 que llegan ${worst.miss}.`;
}

function cacReading(cac: number, target: number | null, ceiling: number, money: (v: number) => string) {
  if (ceiling > 0 && cac > ceiling) {
    return `Pagas más por cada cliente nuevo (${money(cac)}) que su techo (${money(ceiling)}): cada pedido captado así pierde dinero antes de gastos fijos.`;
  }
  if (target !== null && cac > target) {
    return `Todavía ganas con cada cliente nuevo, pero con ${money(ceiling - cac)} de colchón hasta el techo. Cada euro más de CAC sale directo del margen.`;
  }
  if (target !== null) {
    return `Dentro de tu objetivo (${money(target)}). El colchón hasta el techo es de ${money(ceiling - cac)}.`;
  }
  return "Esta tienda no tiene objetivo de CAC: fija uno en Configuración para ver el tramo verde.";
}

export function StoreLevel({
  organizationId,
  organizationName,
  connectionId,
  days,
  onDays,
  nav,
}: {
  organizationId: string;
  organizationName: string;
  connectionId: string;
  days: number;
  onDays: (days: number) => void;
  nav: PanelNav;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const profitability = useProfitability(days, organizationId);
  const metrics = useCachedQuery<StoreMetrics>(
    `${base}/shopify/metrics?days=${days}&connectionId=${encodeURIComponent(connectionId)}`,
  );
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=${days}`);
  // Con una sola tienda la lectura de la tienda es la del cliente entero: es la que genera el cron.
  const singleStore = profitability.data?.stores.length === 1;
  const reading = usePanelReading({ organizationId, connectionId: singleStore ? null : connectionId, days });
  const callNotes = useCallNotes(organizationId);
  const ask = useCopilotAsk();
  const [creating, setCreating] = useState<string | null>(null);

  const row = profitability.data?.stores.find((store) => store.connection_id === connectionId) ?? null;
  const shopName = row?.shop_name ?? "Tienda";
  const bar = <ScopeBar days={days} onDays={onDays} />;
  const shell = (content: React.ReactNode) => (
    <div className={s.stage}>
      <div className={s.wrap}>
        {bar}
        {content}
      </div>
    </div>
  );

  if (profitability.isLoading || metrics.isLoading) {
    return shell(<AsyncState status="loading" loadingLabel="Calculando la rentabilidad de la tienda…" />);
  }
  const failure = (profitability.error && !profitability.data ? profitability.error : null) ?? (metrics.error && !metrics.data ? metrics.error : null);
  if (failure) return shell(<AsyncState status="error" error={failure} />);
  const data = metrics.data;
  if (!row || !data) {
    return shell(
      <EmptyState
        title="Sin datos de la tienda"
        hint="Conecta Shopify en Integraciones o elige otra tienda en la cabecera."
      />,
    );
  }

  const f = data.financial;
  const p = row.per_order;
  const cur = row.currency_code;
  const money = (value: number, digits = 0) => panelMoney(value, cur, digits);
  const headline = buildStoreHeadline(row, days);
  const estimated = row.tier === "datos";
  const targets = targetsByKey(data.metric_targets);
  const siblings = (profitability.data?.stores ?? []).filter(
    (store) => store.store_id !== row.store_id && store.currency_code === row.currency_code && store.orders > 0,
  );
  const sibling: ProfitStoreRow | null = [...siblings].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const steps = funnelSteps(data.funnel);
  const leak = leakNote(data.funnel);

  // --- fiabilidad -----------------------------------------------------------
  const platforms = Object.keys(f.ads_by_platform ?? {});
  const reliability = [
    {
      label: "Coste de producto",
      ok: f.cogs > 0 && f.items_without_cost === 0,
      text: f.cogs <= 0 ? "Sin coste cargado" : f.items_without_cost > 0 ? `${f.items_without_cost} líneas sin coste` : "100 % de las líneas",
    },
    {
      label: "Gastos fijos",
      ok: f.fixed_expenses_count > 0,
      text: f.fixed_expenses_count > 0 ? `${f.fixed_expenses_count} ${f.fixed_expenses_count === 1 ? "concepto" : "conceptos"}` : "Sin gastos fijos",
    },
    {
      label: "Comisiones y envío",
      ok: f.has_settings,
      text: !f.has_settings ? "Sin configurar" : f.uses_shipping_rules ? "Reglas por tramo" : "Importe fijo",
    },
    {
      label: "Publicidad",
      ok: true,
      text: f.ads_spend > 0 ? platforms.join(", ") || "Conectada" : "Sin inversión",
    },
    {
      label: "Sesiones",
      ok: Boolean(data.funnel?.has_sessions),
      text: data.funnel?.has_sessions ? "Informes activos" : "Sin permiso de informes",
    },
  ];
  const allLoaded = reliability.slice(0, 3).every((item) => item.ok);

  // --- cascada del pedido ----------------------------------------------------
  const aov = p.aov_ex_tax;
  const costRows: Array<{ label: string; value: number; other: number | null; ads?: boolean }> = [
    { label: "− Producto", value: p.cogs, other: sibling?.per_order.cogs ?? null },
    { label: "− Envío", value: p.shipping, other: sibling?.per_order.shipping ?? null },
    { label: "− Comisiones de pago", value: p.fees, other: sibling?.per_order.fees ?? null },
    { label: "− Publicidad", value: p.ads, other: sibling?.per_order.ads ?? null, ads: true },
    { label: "− Gastos fijos", value: p.fixed, other: sibling?.per_order.fixed ?? null },
  ];
  let remaining = aov;
  const cascade = costRows.map((item) => {
    const before = remaining;
    remaining = before - item.value;
    const width = aov > 0 ? (Math.min(item.value, Math.max(0, before)) / aov) * 100 : 0;
    const left = aov > 0 ? (Math.max(0, remaining) / aov) * 100 : 0;
    return { ...item, left, width };
  });
  const left = (value: number | null) => (value === null ? "" : money(value, 2));
  const diff = (value: number, other: number | null, costLike: boolean) => {
    if (other === null) return null;
    const delta = value - other;
    if (Math.abs(delta) < 0.05) return <span className={cx(s.d, s.mut)}>=</span>;
    const bad = costLike ? delta > 0 : delta < 0;
    return (
      <span className={cx(s.d, bad ? s.neg : s.pos)}>
        {delta > 0 ? "+" : "−"}
        {money(Math.abs(delta), 2)}
      </span>
    );
  };
  const solo = sibling === null;
  const soloClass = solo ? s.wfSolo : undefined;

  // --- publicidad -----------------------------------------------------------
  const cac = row.cac;
  const ceiling = p.breakeven_cac;
  const target = row.cac_target;
  const gaugeMax = Math.max(cac ?? 0, ceiling, target ?? 0, 1) * 1.35;
  const greenEnd = target !== null && target < ceiling ? target : ceiling;
  const amberEnd = target !== null && target < ceiling ? ceiling : greenEnd;
  const roas = meta.data?.acquisition.roas ?? null;

  // --- palancas --------------------------------------------------------------
  const leversTotal = row.lever_total;
  const noConversionTarget = targets.conversion_rate === undefined;

  async function makeTask(key: string, title: string, description: string) {
    setCreating(key);
    await createLeverTask(organizationId, title, description);
    setCreating(null);
  }

  const aiLine = reading.text ? (
    <AiLine text={reading.text} generatedAt={reading.generatedAt} stale={reading.stale} />
  ) : !reading.supported ? (
    <span className={s.mut}>La lectura IA cubre 30 y 90 días.</span>
  ) : reading.isLoading ? (
    <span className={s.mut}>Leyendo la rentabilidad…</span>
  ) : (
    <span className={s.mut}>Sin lectura IA de esta tienda todavía.</span>
  );

  const ordersChange = data.previous_period
    ? deltaPct(row.orders, data.previous_period.sales.orders_count)
    : null;
  const yoy = data.previous_year;
  const aovTarget = targets.aov_ex_tax;
  const marginTarget = row.margin_target;

  return shell(
    <>
      <Hero
        id="h-tienda"
        tier={row.tier}
        meta={
          <>
            <span>Rentabilidad</span>
            <span>Tienda · {organizationName}</span>
            <span className={s.tier}>● {TIER_LABEL[row.tier]}</span>
            <span>Últimos {days === 365 ? "12 meses" : `${days} días`} · sin IVA</span>
          </>
        }
        title={headline.title}
        lines={[headline.detail, aiLine].filter(Boolean)}
        actions={
          <>
            <button
              type="button"
              className={cx(s.btn, s.acc)}
              onClick={() =>
                ask({
                  question: `¿Qué haría primero con la tienda ${shopName} de ${organizationName}? Parte de su rentabilidad por pedido, su CAC y sus palancas.`,
                  focusLabel: shopName,
                })
              }
            >
              <IaTag />
              ¿Qué haría primero con esta tienda?
            </button>
            <button
              type="button"
              className={cx(s.btn, s.ghost)}
              disabled={!callNotes.nextCall || callNotes.adding === "store"}
              title={callNotes.nextCall ? undefined : "Agenda una llamada con este cliente para llevar puntos"}
              onClick={() =>
                callNotes.add(
                  `${shopName} · ${headline.title}`,
                  "store",
                )
              }
            >
              Añadir a la llamada
            </button>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={nav.clientOfStore}>
              ← {organizationName}
            </button>
            {reading.supported ? (
              <button type="button" className={cx(s.btn, s.ghost)} disabled={reading.running} title="La lectura se actualiza sola dos veces al día. A mano, hasta dos veces al día." onClick={reading.run}>
                {reading.running ? "Leyendo…" : "Actualizar lectura IA"}
              </button>
            ) : null}
          </>
        }
        side={
          <aside className={s.side} aria-label="Fiabilidad de los datos">
            <h3>Fiabilidad de los datos</h3>
            {reliability.map((item) => (
              <div key={item.label} className={s.sRow}>
                <span>
                  <i className={item.ok ? undefined : s.w} />
                  {item.label}
                </span>
                <strong>{item.text}</strong>
              </div>
            ))}
            <p className={s.sideNote}>
              {allLoaded
                ? "Todo cargado: el beneficio de esta tienda se puede decir en voz alta."
                : "Hasta completarlo, el beneficio sale como «≈ estimado» y no entra en las palancas."}
            </p>
          </aside>
        }
      />

      <Kpis
        label={`Cifras de la tienda, últimos ${days} días`}
        items={[
          {
            label: "Beneficio neto",
            value: `${estimated ? "≈ " : ""}${money(row.net_profit)}`,
            foot: (
              <>
                <Delta value={row.profit_change_pct} suffix="vs anterior" />
                <Delta value={yoy ? deltaPct(row.net_profit, yoy.net_profit) : null} suffix="YoY" />
              </>
            ),
          },
          {
            label: "Ingresos (sin IVA)",
            value: money(row.revenue),
            foot: (
              <>
                <Delta value={row.revenue_change_pct} suffix="vs anterior" />
                <Delta value={yoy ? deltaPct(row.revenue, yoy.net_revenue_ex_tax) : null} suffix="YoY" />
              </>
            ),
          },
          {
            label: "Margen neto",
            value: panelPct(row.margin_pct),
            foot:
              marginTarget !== null ? (
                <Chip tone={row.margin_pct >= marginTarget ? "good" : "warn"}>
                  objetivo {panelNumber(marginTarget, Number.isInteger(marginTarget) ? 0 : 1)} %
                </Chip>
              ) : (
                <span>sin objetivo fijado</span>
              ),
          },
          {
            label: "Pedidos",
            value: panelNumber(row.orders),
            foot: (
              <>
                <Delta value={ordersChange} suffix="vs anterior" />
                <Delta value={yoy ? deltaPct(row.orders, yoy.orders_count) : null} suffix="YoY" />
              </>
            ),
          },
          {
            label: "Ticket medio",
            value: money(aov, 1),
            foot:
              aovTarget !== undefined ? (
                <Chip tone={aov >= aovTarget ? "good" : "warn"}>objetivo {money(aovTarget, 1)}</Chip>
              ) : (
                <span>sin objetivo fijado</span>
              ),
          },
          {
            label: "Clientes nuevos",
            value: panelNumber(row.new_customers),
            foot: <span>{row.orders > 0 ? `${panelNumber((row.new_customers / row.orders) * 100)} % de los pedidos` : "sin pedidos"}</span>,
          },
        ]}
      />

      <Section
        id="pedido"
        title="Un pedido medio"
        lead={
          sibling
            ? `De los ${money(aov, 2)} que paga el cliente a lo que te queda. Al lado, la otra tienda del mismo cliente: la diferencia suele estar en el envío y la publicidad.`
            : `De los ${money(aov, 2)} que paga el cliente a lo que te queda.`
        }
      >
        <div className={s.panel}>
          <div className={cx(s.wfH, soloClass)} aria-hidden="true">
            <span>Concepto</span>
            <span />
            <span style={{ textAlign: "right" }}>Por pedido</span>
            {sibling ? <span style={{ textAlign: "right" }}>{sibling.shop_name}</span> : null}
            {sibling ? <span style={{ textAlign: "right" }}>Diferencia</span> : null}
          </div>
          <div className={cx(s.wfR, s.total, soloClass)}>
            <span>Ticket medio</span>
            <div className={s.t}><i style={{ left: "0%", width: "100%" }} /></div>
            <span className={s.v}>{money(aov, 2)}</span>
            {sibling ? <span className={s.o}>{left(sibling.per_order.aov_ex_tax)}</span> : null}
            {sibling ? <span className={cx(s.d, s.mut)}>{money(aov - sibling.per_order.aov_ex_tax, 2)}</span> : null}
          </div>
          {cascade.map((item) => (
            <div key={item.label} className={cx(s.wfR, item.ads && s.ads, soloClass)}>
              <span>{item.label}</span>
              <div className={s.t}><i style={{ left: `${item.left}%`, width: `${item.width}%` }} /></div>
              <span className={s.v}>{money(item.value, 2)}</span>
              {sibling ? <span className={s.o}>{left(item.other)}</span> : null}
              {sibling ? diff(item.value, item.other, true) : null}
            </div>
          ))}
          <div className={cx(s.wfR, s.end, soloClass)}>
            <span>= Te quedan</span>
            <div className={s.t}>
              <i style={{ left: "0%", width: `${aov > 0 ? (Math.max(0, p.profit) / aov) * 100 : 0}%` }} />
            </div>
            <span className={cx(s.v, p.profit < 0 ? s.neg : undefined)}>{estimated ? "≈ " : ""}{money(p.profit, 2)}</span>
            {sibling ? <span className={s.o}>{left(sibling.per_order.profit)}</span> : null}
            {sibling ? diff(p.profit, sibling.per_order.profit, false) : null}
          </div>
          <div className={s.mini}>
            <div>
              <small>Deja, tras captarlo</small>
              <b>{money(p.contribution, 2)}</b>
              <em>ticket − producto − envío − publicidad</em>
            </div>
            <div>
              <small>Techo de CAC por pedido</small>
              <b>{money(p.breakeven_cac, 2)}</b>
              <em>lo máximo que puedes pagar sin perder dinero</em>
            </div>
            <div>
              <small>Beneficio por pedido</small>
              <b className={p.profit < 0 ? s.neg : estimated ? s.est : undefined}>{money(p.profit, 2)}</b>
              <em>tras fijos y comisiones</em>
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="ads"
        title="Publicidad"
        lead="Cuánto pagas por un cliente nuevo y dónde está el límite. El CAC real y el ROAS de Meta son cifras distintas: no se mezclan."
      >
        {f.ads_spend <= 0 ? (
          <div className={s.panel}>
            <p className={s.empty}>Sin inversión publicitaria en el periodo. Conecta Meta Ads en Integraciones para que entre en el beneficio.</p>
          </div>
        ) : (
          <div className={s.two}>
            <Panel
              title="CAC real frente a tu objetivo y tu techo"
              sub="Inversión de todas las plataformas entre clientes nuevos del periodo"
              aside={
                cac === null ? undefined : cac > ceiling && ceiling > 0 ? (
                  <Chip tone="bad">Sobre el techo</Chip>
                ) : target !== null && cac > target ? (
                  <Chip tone="warn">Sobre el objetivo</Chip>
                ) : target !== null ? (
                  <Chip tone="good">Dentro del objetivo</Chip>
                ) : (
                  <Chip>Sin objetivo</Chip>
                )
              }
            >
              {cac === null ? (
                <p className={s.empty}>Hay inversión pero ningún cliente nuevo en el periodo: no hay CAC que calcular.</p>
              ) : (
                <>
                  <div
                    className={s.gauge}
                    role="img"
                    aria-label={`CAC real de ${money(cac, 1)}${target !== null ? `, objetivo ${money(target, 1)}` : ""}, techo ${money(ceiling, 1)}`}
                  >
                    <i style={{ width: `${(greenEnd / gaugeMax) * 100}%` }} />
                    <i style={{ width: `${((amberEnd - greenEnd) / gaugeMax) * 100}%` }} />
                    <i style={{ width: `${((gaugeMax - amberEnd) / gaugeMax) * 100}%` }} />
                    <span className={s.pin} style={{ left: `${(cac / gaugeMax) * 100}%` }}>
                      {money(cac, 1)}
                    </span>
                  </div>
                  <div className={s.gScale} aria-hidden="true">
                    <span style={{ left: "0%" }}>0 €</span>
                    {target !== null ? <span style={{ left: `${(target / gaugeMax) * 100}%` }}>objetivo {money(target, 1)}</span> : null}
                    <span style={{ left: `${(ceiling / gaugeMax) * 100}%`, top: target !== null && Math.abs(target - ceiling) / gaugeMax < 0.2 ? 18 : 0 }}>
                      techo {money(ceiling, 1)}
                    </span>
                  </div>
                  <p className={s.aiNote} style={{ marginTop: 40 }}>
                    {cacReading(cac, target, ceiling, (value) => money(value, 1))}
                  </p>
                </>
              )}
            </Panel>

            <Panel title="Qué cuesta y qué atribuye cada cifra" sub="El gasto suma entre plataformas; la atribución, no">
              <ul>
                <li className={s.li}>
                  <div>
                    <b>Inversión</b>
                    <p>
                      {platforms.length
                        ? `${platforms.map((name) => `${name} ${money(f.ads_by_platform[name] ?? 0)}`).join(" · ")}. Entra entera en el beneficio.`
                        : "Entra entera en el beneficio."}
                    </p>
                  </div>
                  <div className={s.liR}><span className={s.big}>{money(f.ads_spend)}</span></div>
                </li>
                <li className={s.li}>
                  <div>
                    <b>CAC real</b>
                    <p>{money(f.ads_spend)} entre {row.new_customers} {row.new_customers === 1 ? "cliente nuevo" : "clientes nuevos"}, vengan de donde vengan.</p>
                  </div>
                  <div className={s.liR}>
                    <span className={cx(s.big, cac !== null && overCacTarget(row) ? s.neg : undefined)}>
                      {cac === null ? "—" : money(cac, 1)}
                    </span>
                  </div>
                </li>
                <li className={s.li}>
                  <div>
                    <b>
                      ROAS de Meta <span className={cx(s.chip, s.acc)} style={{ marginLeft: 6 }}>atribuido por Meta</span>
                    </b>
                    <p>
                      {f.breakeven_roas !== null
                        ? `Hay que batir ${panelNumber(f.breakeven_roas, 2)}× para no perder dinero.`
                        : "Sin margen positivo no hay ROAS que valga."}
                    </p>
                  </div>
                  <div className={s.liR}>
                    <span
                      className={cx(
                        s.big,
                        roas !== null && f.breakeven_roas !== null ? (roas >= f.breakeven_roas ? s.pos : s.neg) : undefined,
                      )}
                    >
                      {roas === null ? "n/a" : `${panelNumber(roas, 1)}×`}
                    </span>
                  </div>
                </li>
              </ul>
            </Panel>
          </div>
        )}
      </Section>

      <Section
        id="palancas"
        title="Dónde está el dinero"
        lead="Cada palanca sale de un objetivo que tú fijaste. Sin objetivo no hay escenario, y no nos inventamos medias del sector."
      >
        <div className={s.two}>
          <Panel title="Dinero sobre la mesa" sub="Beneficio extra al mes si cada métrica llegara a su objetivo">
            {estimated ? (
              <p className={s.empty}>
                Sin cálculo: con el beneficio estimado la cifra sería inventada. Completa los costes que faltan y aparecerá aquí.
              </p>
            ) : (
              <>
                <ul>
                  {row.levers.map((lever) => {
                    const key = lever.clave;
                    const note = `${shopName} · ${lever.palanca}: +${money(lever.eur_mes)}/mes (${lever.regla}).`;
                    return (
                      <li key={key} className={s.li}>
                        <div>
                          <b>{lever.palanca}</b>
                          <p>{lever.regla}</p>
                        </div>
                        <div className={s.liR}>
                          <span className={cx(s.big, s.pos)}>+{money(lever.eur_mes)}/mes</span>
                          <button
                            type="button"
                            className={cx(s.btn, s.ghost, s.sm)}
                            disabled={!callNotes.nextCall || callNotes.adding === key}
                            title={callNotes.nextCall ? undefined : "Agenda una llamada con este cliente para llevar puntos"}
                            onClick={() => callNotes.add(note, key)}
                          >
                            Añadir a la llamada
                          </button>
                          <button
                            type="button"
                            className={cx(s.btn, s.ghost, s.sm)}
                            disabled={creating === key}
                            onClick={() => makeTask(key, `${shopName} · ${lever.palanca}`, note)}
                          >
                            {creating === key ? "Creando…" : "Crear tarea"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {noConversionTarget ? (
                    <li className={s.li}>
                      <div>
                        <b className={s.mut}>Conversión al objetivo</b>
                        <p>Esta tienda no tiene objetivo de conversión: pon uno y aparece aquí.</p>
                      </div>
                      <div className={s.liR}>
                        <Link href="/configuracion?section=objetivos" className={cx(s.btn, s.ghost, s.sm, s.linkBtn)}>
                          Fijar objetivo
                        </Link>
                      </div>
                    </li>
                  ) : null}
                </ul>
                {row.levers.length === 0 && !noConversionTarget ? (
                  <p className={s.empty}>Todas las métricas con objetivo ya lo cumplen: no hay dinero sobre la mesa.</p>
                ) : null}
                {row.levers.length > 0 ? (
                  <div className={s.tot}>
                    <span>Todo junto</span>
                    <b className={s.pos}>+{money(leversTotal)}/mes</b>
                  </div>
                ) : null}
              </>
            )}
          </Panel>

          <Panel
            title="Embudo"
            sub={
              data.funnel?.conversion_rate_own != null
                ? `De la visita a la compra · conversión ${panelPct(data.funnel.conversion_rate_own * 100, 2)}`
                : "De la visita a la compra"
            }
          >
            {steps.length === 0 ? (
              <p className={s.empty}>
                Sin sesiones en el periodo. Las sesiones vienen de los informes de Shopify y necesitan ese permiso en la conexión.
              </p>
            ) : (
              <>
                <div className={s.fun}>
                  {steps.map((step) => (
                    <div key={step.paso} className={s.funR}>
                      <div className={s.funT}>
                        <span>{step.paso}</span>
                        <span>
                          {panelNumber(step.valor)}
                          {step.pct_del_anterior !== null ? <em>{panelNumber(step.pct_del_anterior, 2)} % del anterior</em> : null}
                        </span>
                      </div>
                      <div className={s.funB}>
                        <i style={{ width: `${Math.max(step.pct_del_total ?? 0, 1)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {leak ? <p className={s.aiNote}>{leak}</p> : null}
                <p className={s.foot} style={{ marginTop: 12 }}>
                  {data.funnel?.has_funnel_steps
                    ? `«Compró» son visitas que acabaron comprando: ${panelNumber(data.funnel.purchases)} de los ${panelNumber(row.orders)} pedidos. El resto llega por otros canales.`
                    : "Faltan los pasos intermedios: en este periodo todavía no pedíamos esas métricas a Shopify. No significa que nadie llenara el carrito. Se rellenan con una sincronización completa de la tienda."}
                </p>
              </>
            )}
          </Panel>
        </div>
      </Section>

      <Section
        id="evolucion"
        title="Cómo evoluciona"
        lead="Doce meses de la tienda y, a su lado, a dónde va cada euro facturado."
      >
        <div className={s.two}>
          <Panel title="Ingresos y beneficio por mes" sub="Doce meses · la parte verde de cada barra es el beneficio · miles de euros">
            {data.financial_monthly.length === 0 ? (
              <p className={s.empty}>Sin serie mensual.</p>
            ) : (
              <MonthlyChart
                months={data.financial_monthly.map((month) => ({
                  month: month.month,
                  revenue: Number(month.net_revenue_ex_tax) || 0,
                  profit: Number(month.net_profit) || 0,
                }))}
                label={`Ingresos y beneficio mensual de ${shopName}, doce meses`}
              />
            )}
          </Panel>
          <Panel title="A dónde va cada euro" sub={`Reparto de ${money(row.revenue)} de ingresos sin IVA`}>
            <CostStack
              costs={{
                cogs: p.cogs * row.orders,
                shipping: p.shipping * row.orders,
                fees: p.fees * row.orders,
                ads: row.ads_spend,
                fixed: p.fixed * row.orders,
              }}
              revenue={row.revenue}
              profit={row.net_profit}
              currency={cur}
              {...(estimated ? { profitTone: "est" as const } : {})}
            />
          </Panel>
        </div>
        {sibling || row.fixed_share < 1 ? (
          <p className={s.foot}>
            Los gastos fijos son del cliente: en esta pantalla se reparten entre sus tiendas según su facturación ({panelNumber(row.fixed_share * 100)} % para esta). La serie mensual lleva los fijos enteros.
          </p>
        ) : null}
        {data.margin.items_with_estimated_cost > 0 ? (
          <p className={s.foot}>
            {panelNumber(data.margin.items_with_estimated_cost)} líneas de pedido se valoran con el coste que Shopify reporta hoy, porque no hay coste cargado para la fecha de su pedido.
          </p>
        ) : null}
      </Section>
    </>,
  );
}
