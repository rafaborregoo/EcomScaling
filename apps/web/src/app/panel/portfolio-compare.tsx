"use client";

import { CAC_MIN_NEW_CUSTOMERS, panelMoney, panelNumber, panelPct, type ProfitStoreRow } from "@e-nora/contracts";
import Link from "next/link";
import { AreaChart, BarChart } from "@/components/ui";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { Panel, Section } from "./panel-parts";
import { monthLabel } from "./panel-view-model";
import type { PanelNav, ProfitabilityPayload } from "./panel-data";
import s from "./panel.module.css";

/**
 * Vista general: todas las tiendas de la cartera, una al lado de la otra.
 * Los importes solo comparan tiendas en la moneda de los totales (no se suman
 * ni se ponen en el mismo eje divisas distintas); los porcentajes, todas.
 */

const STORE_COLORS = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
  "var(--chart-series-6)",
  "var(--chart-series-7)",
  "var(--chart-series-8)",
];

const REVENUE = "#2563eb";
const PROFIT = "#60a5fa";
const GOAL = "#a9aeb7";

/** Las gráficas de muchas tiendas se leen mal: las 12 que más venden y el resto en la tabla. */
const MAX_STORES = 12;

const compact = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });
const pctAxis = (value: number) => `${compact.format(value)} %`;

const barHeight = (rows: number, series = 1) => 44 + rows * (series > 1 ? 22 + series * 12 : 34);

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className={s.key}>
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function PortfolioCompare({
  data,
  days,
  nav,
  mode,
}: {
  data: ProfitabilityPayload;
  days: number;
  nav: PanelNav;
  mode: "costes" | "captacion";
}) {
  const currency = data.totals.currency_code;
  const money = (value: number) => panelMoney(value, currency);
  const moneyAxis = (value: number) => compact.format(value);

  // Lo peor primero manda en la tabla; aquí se ordena por tamaño, que es como se compara.
  const all = [...data.stores].sort((a, b) => b.revenue - a.revenue).slice(0, MAX_STORES);
  const same = all.filter((store) => store.currency_code === currency);
  const otherCurrency = all.length - same.length;
  const label = (store: ProfitStoreRow) => `${store.tier === "datos" ? "≈ " : ""}${store.shop_name}`;
  const colorOf = new Map(all.map((store, index) => [store.store_id, STORE_COLORS[index % STORE_COLORS.length]!]));
  const open = (row: Record<string, number | string>) => {
    const store = all.find((item) => item.store_id === row.store);
    if (store) nav.store(store.organization_id, store.connection_id);
  };
  const period = days === 365 ? "último año" : `últimos ${days} días`;

  // Peso de cada tienda en la cartera: qué parte pone de cada cosa.
  const shareRows = (() => {
    const metrics: Array<{ name: string; value: (store: ProfitStoreRow) => number }> = [
      { name: "Ingresos", value: (store) => store.revenue },
      { name: "Pedidos", value: (store) => store.orders },
      { name: "Publicidad", value: (store) => store.ads_spend },
      // Una tienda que pierde no pone beneficio: el reparto es de lo que se gana.
      { name: "Beneficio", value: (store) => Math.max(0, store.net_profit) },
    ];
    return metrics
      .map((metric) => {
        const total = same.reduce((sum, store) => sum + metric.value(store), 0);
        if (total <= 0) return null;
        const row: Record<string, number | string> = { name: metric.name };
        for (const store of same) row[store.store_id] = Math.round((metric.value(store) / total) * 1000) / 10;
        return row;
      })
      .filter((row): row is Record<string, number | string> => row !== null);
  })();
  const losing = same.filter((store) => store.net_profit < 0);

  // Ventas mes a mes de cada tienda, en la moneda de los totales.
  const series = new Map((data.store_monthly ?? []).map((entry) => [entry.store_id, entry.months]));
  const monthKeys = [...new Set(same.flatMap((store) => (series.get(store.store_id) ?? []).map((month) => month.month)))].sort();
  const monthly = monthKeys.map((month) => {
    const row: Record<string, number | string> = { month: monthLabel(month) };
    for (const store of same) row[store.store_id] = series.get(store.store_id)?.find((entry) => entry.month === month)?.revenue ?? 0;
    return row;
  });

  const withCac = same.filter((store) => store.cac !== null);
  const withSessions = all.filter((store) => store.conversion_pct !== null);
  const withoutSessions = all.filter((store) => store.conversion_pct === null);
  // El objetivo se fija por cliente en su Camino: un enlace por cliente, con sus tiendas.
  const withoutConversionTarget = [
    ...withSessions
      .filter((store) => store.conversion_target === null)
      .reduce((byOrg, store) => byOrg.set(store.organization_id, [...(byOrg.get(store.organization_id) ?? []), store.shop_name]), new Map<string, string[]>()),
  ].map(([organizationId, names]) => ({ organizationId, names }));
  const withPrevious = all.filter((store) => store.revenue_change_pct !== null || store.profit_change_pct !== null);
  const storeLegend = same.map((store) => ({ label: store.shop_name, color: colorOf.get(store.store_id)! }));

  const leader = same[0];
  const bestMargin = [...all].filter((store) => store.tier !== "datos").sort((a, b) => b.margin_pct - a.margin_pct)[0];
  const lead =
    all.length < 2
      ? "Con una sola tienda no hay con quién comparar: cuando haya más, aquí se ven una al lado de la otra."
      : [
          leader ? `${leader.shop_name} es la que más vende` : "",
          bestMargin && bestMargin !== leader ? `${bestMargin.shop_name} la que más margen deja` : "",
        ]
          .filter(Boolean)
          .join(" y ")
          .concat(". Pulsa una barra para abrir la tienda.");

  return (
    <Section id={mode === "costes" ? "comparar" : "captacion"} title={mode === "costes" ? "Tiendas frente a frente" : "Captación y ventas"} lead={mode === "costes" ? lead : "Publicidad, tráfico, conversión y ventas por tienda. Pulsa una barra para abrir su rentabilidad."}>
      <div className={s.eq}>
        {mode === "costes" ? (<>
<Panel title="Ingresos y beneficio" sub={`Por tienda, ${period} · sin IVA`}>
          {same.length === 0 ? (
            <p className={s.empty}>Ninguna tienda en {currency ?? "la moneda de la cartera"}.</p>
          ) : (
            <>
              <BarChart
                horizontal
                data={same.map((store) => ({ store: store.store_id, name: label(store), revenue: store.revenue, profit: store.net_profit }))}
                xKey="name"
                series={[
                  { key: "revenue", label: "Ingresos", color: REVENUE },
                  { key: "profit", label: "Beneficio neto", color: PROFIT },
                ]}
                height={barHeight(same.length, 2)}
                valueFormatter={money}
                axisValueFormatter={moneyAxis}
                onBarClick={open}
              />
              <Legend items={[{ label: "Ingresos", color: REVENUE }, { label: "Beneficio neto", color: PROFIT }]} />
            </>
          )}
        </Panel>

        <Panel title="Qué parte pone cada tienda" sub="Su peso en la cartera, en % de cada total">
          {shareRows.length === 0 || same.length === 0 ? (
            <p className={s.empty}>Sin cifras que repartir en este periodo.</p>
          ) : (
            <>
              <BarChart
                horizontal
                stacked
                data={shareRows}
                xKey="name"
                series={same.map((store) => ({ key: store.store_id, label: store.shop_name, color: colorOf.get(store.store_id) }))}
                height={barHeight(shareRows.length)}
                valueFormatter={(value) => panelPct(value)}
                axisValueFormatter={pctAxis}
                domain={[0, 100]}
              />
              <Legend items={storeLegend} />
              {losing.length > 0 ? (
                <p className={s.foot} style={{ marginTop: 10 }}>
                  {losing.map((store) => store.shop_name).join(", ")} {losing.length === 1 ? "pierde" : "pierden"} dinero: no {losing.length === 1 ? "pone" : "ponen"} beneficio.
                </p>
              ) : null}
            </>
          )}
        </Panel>

        <Panel title="Margen neto frente a su objetivo" sub="Beneficio sobre ingresos sin IVA · «≈» es estimado, faltan costes">
          <BarChart
            horizontal
            data={all.map((store) => ({
              store: store.store_id,
              name: label(store),
              margin: Math.round(store.margin_pct * 10) / 10,
              ...(store.margin_target !== null ? { target: store.margin_target } : {}),
            }))}
            xKey="name"
            series={[
              { key: "margin", label: "Margen neto", color: PROFIT },
              { key: "target", label: "Objetivo", color: GOAL },
            ]}
            height={barHeight(all.length, 2)}
            valueFormatter={(value) => panelPct(value)}
            axisValueFormatter={pctAxis}
            onBarClick={open}
          />
          <Legend items={[{ label: "Margen neto", color: PROFIT }, { label: "Objetivo que fijaste", color: GOAL }]} />
        </Panel>

        <Panel title="Cómo crecen" sub="Variación frente al periodo anterior de la misma duración">
          {withPrevious.length === 0 ? (
            <p className={s.empty}>Sin periodo anterior con el que comparar.</p>
          ) : (
            <>
              <BarChart
                horizontal
                data={withPrevious.map((store) => ({
                  store: store.store_id,
                  name: label(store),
                  ...(store.revenue_change_pct !== null ? { revenue: Math.round(store.revenue_change_pct * 10) / 10 } : {}),
                  ...(store.profit_change_pct !== null ? { profit: Math.round(store.profit_change_pct * 10) / 10 } : {}),
                }))}
                xKey="name"
                series={[
                  { key: "revenue", label: "Ingresos", color: REVENUE },
                  { key: "profit", label: "Beneficio neto", color: PROFIT },
                ]}
                height={barHeight(withPrevious.length, 2)}
                valueFormatter={(value) => panelPct(value)}
                axisValueFormatter={pctAxis}
                onBarClick={open}
              />
              <Legend items={[{ label: "Ingresos", color: REVENUE }, { label: "Beneficio neto", color: PROFIT }]} />
            </>
          )}
        </Panel>

        <Panel title="Qué se queda cada pedido" sub="Un pedido medio desglosado: la barra entera es el ticket medio sin IVA">
          {same.length === 0 ? (
            <p className={s.empty}>Ninguna tienda en {currency ?? "la moneda de la cartera"}.</p>
          ) : (
            <>
              <BarChart
                horizontal
                stacked
                data={same.map((store) => ({
                  store: store.store_id,
                  name: label(store),
                  cogs: store.per_order.cogs,
                  shipping: store.per_order.shipping,
                  fees: store.per_order.fees,
                  ads: store.per_order.ads,
                  fixed: store.per_order.fixed,
                  profit: store.per_order.profit,
                }))}
                xKey="name"
                series={PER_ORDER}
                height={barHeight(same.length)}
                valueFormatter={(value) => panelMoney(value, currency, 2)}
                axisValueFormatter={moneyAxis}
                onBarClick={open}
              />
              <Legend items={PER_ORDER} />
            </>
          )}
        </Panel>
</>) : null}

        {mode === "captacion" ? (<>
<Panel title="Publicidad" sub="Lo que se lleva de cada euro facturado · el gasto es real, la atribución no se suma">
          <BarChart
            horizontal
            data={all.map((store) => ({
              store: store.store_id,
              name: label(store),
              ads: store.revenue > 0 ? Math.round((store.ads_spend / store.revenue) * 1000) / 10 : 0,
            }))}
            xKey="name"
            series={[{ key: "ads", label: "Publicidad sobre ingresos", color: "var(--meta)" }]}
            height={barHeight(all.length)}
            valueFormatter={(value) => panelPct(value)}
            axisValueFormatter={pctAxis}
            onBarClick={open}
          />
        </Panel>

        <Panel title="Tráfico y conversión" sub="Sesiones del periodo y pedidos por cada 100 sesiones, frente a su objetivo">
          {withSessions.length === 0 ? (
            <p className={s.empty}>Ninguna tienda tiene informe de sesiones de Shopify en este periodo.</p>
          ) : (
            <>
              <BarChart
                horizontal
                data={withSessions.map((store) => ({ store: store.store_id, name: label(store), sessions: store.sessions ?? 0 }))}
                xKey="name"
                series={[{ key: "sessions", label: "Sesiones", color: REVENUE }]}
                height={barHeight(withSessions.length)}
                valueFormatter={(value) => panelNumber(value)}
                axisValueFormatter={(value) => compact.format(value)}
                onBarClick={open}
              />
              <p className={s.sub} style={{ margin: "18px 0 8px" }}>
                Conversión: pedidos entre sesiones
              </p>
              <BarChart
                horizontal
                data={withSessions.map((store) => ({
                  store: store.store_id,
                  name: label(store),
                  conversion: Math.round((store.conversion_pct ?? 0) * 100) / 100,
                  ...(store.conversion_target !== null ? { target: store.conversion_target } : {}),
                }))}
                xKey="name"
                series={[
                  { key: "conversion", label: "Conversión", color: PROFIT },
                  { key: "target", label: "Objetivo", color: GOAL },
                ]}
                height={barHeight(withSessions.length, 2)}
                valueFormatter={(value) => panelPct(value, 2)}
                axisValueFormatter={pctAxis}
                onBarClick={open}
              />
              <Legend items={[{ label: "Conversión", color: PROFIT }, { label: "Objetivo que fijaste", color: GOAL }]} />
            </>
          )}
          {withoutSessions.length > 0 ? (
            <p className={s.foot} style={{ marginTop: 10 }}>
              Sin informe de sesiones: {withoutSessions.map((store) => store.shop_name).join(", ")}.
            </p>
          ) : null}
          {withoutConversionTarget.length > 0 ? (
            <p className={s.foot} style={{ marginTop: 10 }}>
              Sin objetivo de conversión:{" "}
              {withoutConversionTarget.map((client, index) => (
                <span key={client.organizationId}>
                  {index > 0 ? ", " : ""}
                  <Link href={withPortalRouteContext("/camino?vista=objetivos&objetivo=conversion_rate", client.organizationId)}>
                    {client.names.join(", ")}
                  </Link>
                </span>
              ))}
              . El Camino propone uno con sus mejores semanas.
            </p>
          ) : null}
        </Panel>

        <Panel title="Coste por cliente nuevo" sub="Publicidad entre clientes nuevos (CAC), frente a su objetivo">
          {withCac.length > 0 ? (
            <>
              <BarChart
                horizontal
                data={withCac.map((store) => ({
                  store: store.store_id,
                  name: label(store),
                  cac: store.cac ?? 0,
                  ...(store.cac_target !== null ? { target: store.cac_target } : {}),
                }))}
                xKey="name"
                series={[
                  { key: "cac", label: "CAC", color: "var(--meta)" },
                  { key: "target", label: "Objetivo", color: GOAL },
                ]}
                height={barHeight(withCac.length, 2)}
                valueFormatter={(value) => panelMoney(value, currency, 2)}
                axisValueFormatter={moneyAxis}
                onBarClick={open}
              />
              <Legend items={[{ label: "CAC", color: "var(--meta)" }, { label: "Objetivo que fijaste", color: GOAL }]} />
            </>
          ) : (
            <p className={s.empty}>
              Ninguna tienda tiene clientes nuevos suficientes para leer su CAC: hacen falta al menos {CAC_MIN_NEW_CUSTOMERS} en el periodo.
            </p>
          )}
        </Panel>
</>) : null}
      </div>

      {mode === "captacion" && monthly.length > 1 && same.length > 0 ? (
        <Panel title="Ventas mes a mes" sub={`Ingresos sin IVA de cada tienda, doce meses · ${currency ?? ""}`}>
          <AreaChart
            data={monthly}
            xKey="month"
            series={same.map((store) => ({ key: store.store_id, label: store.shop_name, color: colorOf.get(store.store_id) }))}
            height={260}
            valueFormatter={money}
            axisValueFormatter={moneyAxis}
          />
          <Legend items={storeLegend} />
        </Panel>
      ) : null}

      {otherCurrency > 0 || data.stores.length > MAX_STORES ? (
        <p className={s.foot}>
          {otherCurrency > 0
            ? `${otherCurrency} ${otherCurrency === 1 ? "tienda vende" : "tiendas venden"} en otra moneda: entra en los porcentajes, no en los importes. `
            : ""}
          {data.stores.length > MAX_STORES ? `Las gráficas enseñan las ${MAX_STORES} que más venden; todas están en la tabla.` : ""}
        </p>
      ) : null}
    </Section>
  );
}

const PER_ORDER = [
  { key: "cogs", label: "Producto", color: "#3b3f45" },
  { key: "shipping", label: "Envíos", color: "#7d8187" },
  { key: "fees", label: "Comisiones", color: "#c4c6ca" },
  { key: "ads", label: "Publicidad", color: "var(--meta)" },
  { key: "fixed", label: "Gastos fijos", color: "#a9aeb7" },
  { key: "profit", label: "Beneficio", color: PROFIT },
];
