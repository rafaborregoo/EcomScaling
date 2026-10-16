import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, fmtNum, font } from "../lib/theme";
import { useAnalyst } from "./analista";
import { ChartCarousel, type ChartTab } from "./chart";
import { ListCard, BigNumber, ListRow, MetricList, Meters, Note, PeriodChips, RowMeta, RowTitle, Screen, ShareBar, SheetList, Status } from "./ui";
import { dayLabel, monthLabel, profitOf, type EmailReport, type MetaInsights, type Org, type ShopifyMetrics, withStore } from "./views";

// Métricas = las cifras de fondo del negocio, en rejilla y con su variación; Inicio es el pulso con gráficos.
// Mismas vistas que el selector del Dashboard. ADR-0021: lo atribuido por Meta y por Klaviyo va siempre con su
// nombre y nunca se suma entre plataformas; el MER usa ventas propias de Shopify, no atribución.
export const METRICAS_SECTIONS = [
  { key: "todo", label: "Todo" },
  { key: "shopify", label: "Shopify" },
  { key: "meta", label: "Meta" },
  { key: "klaviyo", label: "Klaviyo" },
] as const;
export type MetricasSection = (typeof METRICAS_SECTIONS)[number]["key"];

const money = (v: number | null | undefined, cur: string | null | undefined, d = 0) => (cur ? fmtCurrency(v, cur, d) : v == null ? "—" : fmtNum(Math.round(v)));
const pct = (r: number | null | undefined, d = 1) => (r == null ? "—" : `${(r * 100).toFixed(d).replace(".", ",")} %`);
const pctOf = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} %`);
const dec = (v: number | null | undefined, d = 2) => (v == null ? "—" : v.toFixed(d).replace(".", ","));
const delta = (now: number | null | undefined, before: number | null | undefined) => (now == null || !before ? null : ((now - before) / Math.abs(before)) * 100);
const eur = (v: number | null | undefined, d = 0) => fmtCurrency(v, "EUR", d);

// Subconjunto de /shopify/insights (ver apps/api/src/shopify-insights.ts). Cada bloque es null si su consulta falla.
type Insights = {
  recurrence: { repeat_order_rate: number | null; new_revenue: number; returning_revenue: number } | null;
  customer_value: { customers: number; avg_orders_per_customer: number | null; avg_revenue_per_customer: number | null; median_revenue_per_customer: number | null; p90_revenue_per_customer: number | null } | null;
  checkout_recovery: { recovery_rate: number | null; lost_value: number; recovered_value: number; avg_hours_to_recover: number | null } | null;
  delivery: { avg_hours_to_ship: number | null; avg_days_to_deliver: number | null; avg_delay_days: number | null; with_estimate: number; late_deliveries: number } | null;
  lifetime: { ltv: { milestone_days: number; avg_revenue: number | null } | null; payback: { status: "PAID_BACK"; days: number } | { status: "NOT_WITHIN_HORIZON" } | { status: "UNKNOWN" } } | null;
  churn: { churn_days: number; churn_rate: number | string | null } | null;
};

export function MetricasModule({ org, section }: { org: Org; section: MetricasSection }) {
  return section === "todo" ? <Todo org={org} /> : section === "shopify" ? <Shopify org={org} /> : section === "meta" ? <Meta org={org} /> : <Klaviyo org={org} />;
}

// --- Todo: todas las plataformas unidas ---------------------------------------------
// Métricas "blended" (de todo el negocio, no de una plataforma): MER, aMER, CAC de cliente nuevo y peso de la
// publicidad. Salen de ventas propias de Shopify y del gasto real en anuncios, así que sí se pueden unir.
// Lo atribuido por cada plataforma va aparte, en barras independientes que nunca se suman (ADR-0021).
//
// La API no trae el periodo anterior de gasto ni de clientes nuevos. Como son sumas, se pide el doble de días y
// se resta: (últimos 2N días) − (últimos N días) = los N días de antes.

const BRAND = { shopify: "#008060", meta: "#0866ff", klaviyo: "#232426", returning: "#95bf47", other: "#9a9a9f" };
const PLATFORM_LABEL: Record<string, string> = { meta: "Meta", google: "Google", tiktok: "TikTok" };
const ratioOr = (a: number, b: number) => (b > 0 ? a / b : null);

function Todo({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const base = `/v1/organizations/${org.id}`;
  const shop = useApi<ShopifyMetrics>(withStore(org, `${base}/shopify/metrics?days=${days}`));
  const shop2 = useApi<ShopifyMetrics>(withStore(org, `${base}/shopify/metrics?days=${days * 2}`));
  const ins = useApi<Insights>(withStore(org, `${base}/shopify/insights?days=${days}`));
  const meta = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${days}`));
  const meta2 = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${days * 2}`));
  const mail = useApi<EmailReport>(withStore(org, `${base}/klaviyo/email-report?days=${days}`));
  const analyst = useAnalyst(org.id, days);

  const d = shop.data;
  const cur = d?.currency_code;
  const profit = d ? profitOf(d) : null;
  const prev = d?.previous_period;
  const fin = d?.financial;
  const ms = meta.data?.summary;
  const rec = ins.data?.recurrence;
  const mailOk = mail.data?.connected ? mail.data : null;

  // Periodo anterior por resta (ver arriba). Null mientras no llega la segunda llamada.
  const f2 = shop2.data?.financial;
  const before = fin && f2 ? { revenue: f2.net_revenue_ex_tax - fin.net_revenue_ex_tax, spend: f2.ads_spend - fin.ads_spend, newCustomers: f2.new_customers - fin.new_customers } : null;
  const mer = fin ? ratioOr(fin.net_revenue_ex_tax, fin.ads_spend) : null;
  const merBefore = before ? ratioOr(before.revenue, before.spend) : null;
  const ncac = fin ? ratioOr(fin.ads_spend, fin.new_customers) : null;
  const ncacBefore = before ? ratioOr(before.spend, before.newCustomers) : null;
  const adShare = fin ? ratioOr(fin.ads_spend, fin.net_revenue_ex_tax) : null;
  const adShareBefore = before ? ratioOr(before.spend, before.revenue) : null;
  const amer = fin && rec ? ratioOr(rec.new_revenue, fin.ads_spend) : null;
  const s2 = meta2.data?.summary;
  const roasBefore = ms && s2 ? ratioOr(s2.purchase_value - ms.purchase_value, s2.spend - ms.spend) : null;

  // Hoy el gasto en anuncios solo viene de Meta (ads_spend_summary): entonces su serie diaria ES la inversión total.
  const onlyMeta = fin ? Object.keys(fin.ads_by_platform ?? {}).every((k) => k === "meta") : false;
  const spendByDay = new Map((meta.data?.daily_spend ?? []).map((p) => [p.bucket_date.slice(0, 10), p.spend]));
  const dailySpend = onlyMeta && spendByDay.size > 0;
  const months = (d?.financial_monthly ?? []).filter((m) => m.net_revenue_ex_tax > 0 || m.ads_spend > 0);

  const charts: ChartTab[] = [];
  if (d) {
    charts.push({
      key: "ventas-inversion",
      label: `Ventas e inversión · ${days} días`,
      series: [
        { name: "Ventas", color: BRAND.shopify, points: d.daily.map((p) => ({ label: dayLabel(p.date), y: p.net_sales })) },
        ...(dailySpend ? [{ name: "Inversión", color: BRAND.meta, points: d.daily.map((p) => ({ label: dayLabel(p.date), y: spendByDay.get(p.date.slice(0, 10)) ?? 0 })) }] : []),
      ],
      format: (v) => money(v, cur),
      summary: `${money(d.sales.net_sales, cur)} vendidos`,
    });
    if (dailySpend) {
      charts.push({
        key: "mer-diario",
        label: `MER diario · ${days} días`,
        series: [{ name: "MER", color: BRAND.shopify, points: d.daily.map((p) => { const s = spendByDay.get(p.date.slice(0, 10)) ?? 0; return { label: dayLabel(p.date), y: s > 0 ? p.net_sales / s : null }; }) }],
        format: (v) => dec(v),
        summary: dec(mer),
      });
    }
    if (months.length > 1) {
      charts.push(
        {
          key: "mer-mes",
          label: "MER por mes",
          series: [{ name: "MER", color: BRAND.shopify, points: months.map((m) => ({ label: monthLabel(m.month), y: m.ads_spend > 0 ? m.net_revenue_ex_tax / m.ads_spend : null })) }],
          format: (v) => dec(v),
          summary: "Ventas ÷ inversión, 12 meses",
        },
        {
          key: "ncac-mes",
          label: "CAC de cliente nuevo por mes",
          series: [{ name: "CAC", color: BRAND.meta, points: months.map((m) => ({ label: monthLabel(m.month), y: m.new_customers > 0 ? m.ads_spend / m.new_customers : null })) }],
          format: (v) => money(v, cur, 2),
          summary: "Inversión ÷ clientes nuevos",
        },
      );
      if (profit) {
        charts.push({
          key: "beneficio-mes",
          label: "Ventas y beneficio por mes",
          series: [
            { name: "Ventas", color: BRAND.shopify, points: months.map((m) => ({ label: monthLabel(m.month), y: m.net_revenue_ex_tax })) },
            { name: "Beneficio", color: BRAND.returning, points: months.map((m) => ({ label: monthLabel(m.month), y: m.net_profit })) },
          ],
          format: (v) => money(v, cur),
          summary: "Sin IVA, 12 meses",
        });
      }
    }
  }

  const sales = d?.sales.net_sales ?? 0;
  const attributed = [
    ...(ms && sales > 0 ? [{ label: "Meta se atribuye", ratio: ms.purchase_value / sales, color: BRAND.meta }] : []),
    ...(mailOk && sales > 0 ? [{ label: "Klaviyo se atribuye", ratio: mailOk.totals.revenue / sales, color: BRAND.klaviyo }] : []),
  ];

  return (
    <Screen flat title="Todo el negocio" subtitle={org.name} onRefresh={async () => void (await Promise.all([shop.reload(), shop2.reload(), ins.reload(), meta.reload(), meta2.reload(), mail.reload(), analyst.reload()]))}>
      <PeriodChips options={[7, 30, 90]} value={days} onChange={setDays} />
      <Status error={shop.error} loading={!d} retry={shop.retry} />
      {d && fin && (
        <>
          <BigNumber label="Ventas netas" value={money(d.sales.net_sales, cur)} delta={delta(d.sales.net_sales, prev?.sales.net_sales)} />

          <ChartCarousel tabs={charts} height={190} />

          <MetricList
            rows={[
              profit ? { label: "Beneficio neto", value: money(profit.net_profit, cur), delta: delta(profit.net_profit, prev?.financial.net_profit) } : { label: "Pedidos", value: fmtNum(d.sales.orders_count), delta: delta(d.sales.orders_count, prev?.sales.orders_count) },
              { ...analyst.kpi("mer"), label: "MER", value: dec(mer), delta: delta(mer, merBefore), hint: "Ventas ÷ inversión en anuncios" },
              { label: "Inversión en anuncios", value: money(fin.ads_spend, cur), delta: delta(fin.ads_spend, before?.spend), neutral: true },
            ]}
          />

          <SheetList
            items={[
              {
                title: "Eficiencia de la publicidad",
                summary: `CAC ${money(ncac, cur, 2)}`,
                content: (
                  <MetricList
                    rows={[
                      { ...analyst.kpi("cac_new"), label: "CAC cliente nuevo", value: money(ncac, cur, 2), delta: delta(ncac, ncacBefore), lowerIsBetter: true },
                      { label: "Clientes nuevos", value: fmtNum(fin.new_customers), delta: delta(fin.new_customers, before?.newCustomers) },
                      { label: "aMER", value: dec(amer), hint: "Ventas de clientes nuevos ÷ inversión" },
                      { label: "Publicidad sobre ventas", value: pct(adShare), delta: delta(adShare, adShareBefore), lowerIsBetter: true },
                    ]}
                  />
                ),
              },
              profit && { title: "Punto de equilibrio", summary: `${money(profit.mbee, cur, 2)} / pedido`, content: <BreakEven d={d} /> },
              { title: "Shopify", summary: money(d.sales.net_sales, cur), theme: "shopify", content: <ShopifyGroups compact d={d} i={ins.data} analyst={analyst} /> },
              ms && { title: "Meta Ads", summary: `ROAS ${dec(ms.roas)}`, theme: "meta", content: <MetaGroups compact s={ms} cur={meta.data?.currency} roasDelta={delta(ms.roas, roasBefore)} analyst={analyst} /> },
              mailOk && { title: "Klaviyo", summary: eur(mailOk.totals.revenue), theme: "klaviyo", content: <KlaviyoGroups compact t={mailOk.totals} p={mailOk.previous} analyst={analyst} /> },
              {
                title: "Reparto de ventas e inversión",
                content: (
                  <>
                    {rec && (
                      <ShareBar
                        title="De dónde salen las ventas"
                        parts={[
                          { label: "Clientes nuevos", value: rec.new_revenue, color: BRAND.shopify },
                          { label: "Clientes que repiten", value: rec.returning_revenue, color: BRAND.returning },
                        ]}
                        format={(v) => money(v, cur)}
                      />
                    )}
                    <ShareBar
                      title="En qué se invierte"
                      parts={Object.entries(fin.ads_by_platform ?? {}).map(([k, v]) => ({ label: PLATFORM_LABEL[k] ?? k, value: v, color: k === "meta" ? BRAND.meta : BRAND.other }))}
                      format={(v) => money(v, cur)}
                    />
                    <Meters title="Ventas que se atribuye cada plataforma" items={attributed} note="Cada plataforma se atribuye ventas por su cuenta y se solapan: no se suman." />
                  </>
                ),
              },
            ]}
          />
        </>
      )}
      {analyst.sheet}
    </Screen>
  );
}

// --- Cifras por plataforma -------------------------------------------------------------
// Estilo limpio: una lista corta a la vista y el resto en hojas inferiores (SheetList). Las usan la pantalla de
// cada plataforma (detalle completo) y "Todo" (solo lo importante, con `compact`).
type Analyst = ReturnType<typeof useAnalyst>;

// "Punto de equilibrio": cuánto hay que vender y cuánto se puede gastar en publicidad para no perder dinero. Cada fila
// dice en llano qué es y se compara con la cifra real de ahora; el tono dice si se está por el lado bueno.
function BreakEven({ d }: { d: ShopifyMetrics }) {
  const p = profitOf(d);
  if (!p) return null;
  const cur = d.currency_code;
  const mer = p.ads_spend > 0 ? p.net_revenue_ex_tax / p.ads_spend : null;
  const cac = p.new_customers > 0 ? p.ads_spend / p.new_customers : null;
  const merOk = mer != null && p.breakeven_roas != null ? mer >= p.breakeven_roas : null;
  return (
    <MetricList
      rows={[
        { label: "Ventas mínimas al mes", value: money(p.break_even_monthly_revenue, cur), hint: "Con menos que esto el negocio pierde dinero" },
        { label: "Máximo a pagar por pedido", value: money(p.breakeven_cac_per_order, cur, 2), hint: cac == null ? "Lo que puedes gastar en publicidad por pedido sin perder" : `Ahora pagas ${money(cac, cur, 2)} por cliente nuevo`, tone: cac == null ? undefined : cac <= p.breakeven_cac_per_order ? "good" : "bad" },
        { label: "Rendimiento mínimo de la publicidad", value: dec(p.breakeven_roas), hint: mer == null || merOk == null ? "Ventas ÷ inversión que hay que superar (ROAS/MER)" : `Ahora: ${dec(mer)}${merOk ? " · la publicidad sale rentable" : " · la publicidad pierde dinero"}`, tone: merOk == null ? undefined : merOk ? "good" : "bad" },
        { label: "Te queda por pedido tras publicidad", value: money(p.mbee, cur, 2), hint: p.mbee >= 0 ? "Cada pedido deja dinero" : "Cada pedido cuesta dinero", tone: p.mbee >= 0 ? "good" : "bad" },
        { label: "Contribución por pedido", value: money(p.contribution_per_order, cur, 2), hint: "Lo que deja cada pedido antes de publicidad" },
      ]}
    />
  );
}

function ShopifyGroups({ d, i, analyst, compact }: { d: ShopifyMetrics; i: Insights | null | undefined; analyst: Analyst; compact?: boolean }) {
  const cur = d.currency_code;
  const profit = profitOf(d);
  const prev = d.previous_period;
  const f = d.funnel;
  const churn = i?.churn?.churn_rate == null ? null : Number(i.churn.churn_rate);
  const ltv = i?.lifetime?.ltv;
  if (compact) {
    return (
      <MetricList
        rows={[
          { label: "Ventas netas", value: money(d.sales.net_sales, cur), delta: delta(d.sales.net_sales, prev?.sales.net_sales) },
          profit && { label: "Beneficio neto", value: money(profit.net_profit, cur), delta: delta(profit.net_profit, prev?.financial.net_profit) },
          { label: "Ticket medio", value: money(d.sales.aov, cur, 2), delta: delta(d.sales.aov, prev?.sales.aov) },
          f?.has_sessions && { ...analyst.kpi("conversion"), label: "Conversión", value: pct(f.conversion_rate_own, 2), delta: delta(f.conversion_rate_own, prev?.conversion_rate_own) },
          { label: "Pedidos que repiten", value: pct(i?.recurrence?.repeat_order_rate) },
          { label: ltv ? `LTV a ${ltv.milestone_days} días` : "LTV", value: money(ltv?.avg_revenue, cur) },
        ]}
      />
    );
  }
  return (
    <>
      <MetricList
        title="Ventas"
        rows={[
          { label: "Ventas netas", value: money(d.sales.net_sales, cur), delta: delta(d.sales.net_sales, prev?.sales.net_sales) },
          { label: "Ventas brutas", value: money(d.sales.gross_sales, cur) },
          { label: "Descuentos", value: money(d.sales.discounts, cur), delta: delta(d.sales.discounts, prev?.sales.discounts), lowerIsBetter: true },
          { label: "Devoluciones", value: money(d.sales.refunds, cur), delta: delta(d.sales.refunds, prev?.sales.refunds), lowerIsBetter: true },
          { label: "Unidades", value: fmtNum(d.sales.units_sold) },
          { label: "Ticket medio", value: money(d.sales.aov, cur, 2), delta: delta(d.sales.aov, prev?.sales.aov) },
        ]}
      />
      {!profit && <Note flat text="Beneficio y márgenes aparecen cuando todos los productos tienen coste. Se completa desde la web." />}
      <SheetList
        items={[
          f?.has_sessions && {
            title: "Embudo",
            summary: `Conversión ${pct(f.conversion_rate_own, 2)}`,
            content: (
              <MetricList
                rows={[
                  { label: "Sesiones", value: fmtNum(f.sessions) },
                  f.has_funnel_steps && { label: "Añaden al carrito", value: pct(f.cart_rate), bar: f.cart_rate },
                  f.has_funnel_steps && { label: "Llegan al pago", value: pct(f.checkout_rate), bar: f.checkout_rate },
                  f.has_funnel_steps && { label: "Pagan tras el checkout", value: pct(f.checkout_to_purchase_rate), bar: f.checkout_to_purchase_rate },
                  { ...analyst.kpi("conversion"), label: "Conversión", value: pct(f.conversion_rate_own, 2), delta: delta(f.conversion_rate_own, prev?.conversion_rate_own), bar: f.conversion_rate_own },
                  { label: "Ingreso por sesión", value: money(f.revenue_per_session, cur, 2) },
                ]}
              />
            ),
          },
          profit && {
            title: "Rentabilidad",
            summary: money(profit.net_profit, cur),
            content: (
              <MetricList
                rows={[
                  { label: "Beneficio neto", value: money(profit.net_profit, cur), delta: delta(profit.net_profit, prev?.financial.net_profit) },
                  { label: "Margen neto", value: pctOf(profit.net_margin_pct) },
                  { label: "Margen bruto", value: pctOf(d.margin.margin_pct) },
                  { label: "Coste de producto", value: money(profit.cogs, cur) },
                  { label: "Comisiones de pago", value: money(profit.payment_fees, cur) },
                  { label: "Envíos pagados", value: money(profit.shipping_costs, cur) },
                  { label: "Costes fijos del periodo", value: money(profit.fixed_costs, cur) },
                ]}
              />
            ),
          },
          profit && { title: "Punto de equilibrio", summary: `${money(profit.mbee, cur, 2)} / pedido`, content: <BreakEven d={d} /> },
          i && {
            title: "Clientes",
            summary: ltv ? `LTV ${money(ltv.avg_revenue, cur)}` : `${fmtNum(d.financial.new_customers)} nuevos`,
            content: (
              <MetricList
                rows={[
                  { label: "Clientes nuevos", value: fmtNum(d.financial.new_customers) },
                  { label: "Pedidos que repiten", value: pct(i.recurrence?.repeat_order_rate) },
                  { label: "Pedidos por cliente", value: dec(i.customer_value?.avg_orders_per_customer) },
                  { label: "Valor por cliente", value: money(i.customer_value?.avg_revenue_per_customer, cur) },
                  { label: "Cliente típico (mediana)", value: money(i.customer_value?.median_revenue_per_customer, cur), hint: "La mitad de tus clientes gasta menos que esto" },
                  { label: "Mejores clientes (10 %)", value: money(i.customer_value?.p90_revenue_per_customer, cur), hint: "El 10 % que más gasta supera esta cifra" },
                  { label: ltv ? `LTV a ${ltv.milestone_days} días` : "LTV", value: money(ltv?.avg_revenue, cur) },
                  { label: `Se van a ${i.churn?.churn_days ?? 180} días`, value: pct(churn) },
                  i.lifetime?.payback && { label: "Recuperas lo que costó captarlo", value: i.lifetime.payback.status === "PAID_BACK" ? `${i.lifetime.payback.days} días` : i.lifetime.payback.status === "NOT_WITHIN_HORIZON" ? "> 1 año" : "—" },
                ]}
              />
            ),
          },
          i && (i.checkout_recovery || i.delivery) && {
            title: "Operativa",
            summary: `Carritos recuperados ${pct(i.checkout_recovery?.recovery_rate)}`,
            content: (
              <MetricList
                rows={[
                  { label: "Carritos recuperados", value: pct(i.checkout_recovery?.recovery_rate) },
                  { label: "Perdido en carritos", value: money(i.checkout_recovery?.lost_value, cur) },
                  { label: "Recuperado en carritos", value: money(i.checkout_recovery?.recovered_value, cur) },
                  { label: "Horas hasta recuperar", value: i.checkout_recovery?.avg_hours_to_recover == null ? "—" : dec(i.checkout_recovery.avg_hours_to_recover, 1) },
                  { label: "Horas hasta enviar", value: i.delivery?.avg_hours_to_ship == null ? "—" : dec(i.delivery.avg_hours_to_ship, 1) },
                  { label: "Días hasta entregar", value: i.delivery?.avg_days_to_deliver == null ? "—" : dec(i.delivery.avg_days_to_deliver, 1) },
                  { label: "Retraso medio", value: i.delivery?.avg_delay_days == null ? "—" : `${dec(i.delivery.avg_delay_days, 1)} días`, hint: "En las entregas que llegan tarde" },
                  { label: "Entregas tarde", value: i.delivery?.with_estimate ? pct(i.delivery.late_deliveries / i.delivery.with_estimate) : "—" },
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}

function MetaGroups({ s, cur, analyst, roasDelta, compact }: { s: NonNullable<MetaInsights["summary"]>; cur: string | null | undefined; analyst: Analyst; roasDelta?: number | null; compact?: boolean }) {
  return (
    <>
      <MetricList
        title={compact ? undefined : "Rendimiento"}
        rows={[
          { label: "Inversión", value: money(s.spend, cur) },
          { ...analyst.kpi("meta_roas"), label: "ROAS", value: dec(s.roas), delta: roasDelta },
          { label: "Compras", value: fmtNum(s.purchases) },
          { label: "CAC", value: money(s.cac, cur, 2) },
          { label: "Atribuido por Meta", value: money(s.purchase_value, cur) },
          !compact && { label: "Ticket atribuido", value: s.purchases > 0 ? money(s.purchase_value / s.purchases, cur, 2) : "—" },
        ]}
      />
      {!compact && (
        <SheetList
          items={[
            {
              title: "Tráfico",
              summary: `CTR ${s.impressions > 0 ? pct(s.clicks / s.impressions, 2) : "—"}`,
              content: (
                <MetricList
                  rows={[
                    { label: "Impresiones", value: fmtNum(s.impressions) },
                    { label: "CTR", value: s.impressions > 0 ? pct(s.clicks / s.impressions, 2) : "—" },
                    { label: "CPM", value: money(s.cpm, cur, 2) },
                    { label: "CPC", value: money(s.cpc, cur, 2) },
                  ]}
                />
              ),
            },
          ]}
        />
      )}
    </>
  );
}

function KlaviyoGroups({ t, p, analyst, compact }: { t: EmailReport["totals"]; p: EmailReport["previous"] | undefined; analyst: Analyst; compact?: boolean }) {
  const open = { ...analyst.kpi("email_open_rate"), label: "Aperturas", value: pct(t.open_rate), delta: delta(t.open_rate, p?.open_rate) };
  const clicks = { label: "Clics", value: pct(t.click_rate, 2), delta: delta(t.click_rate, p?.click_rate) };
  const unsub = { label: "Bajas", value: pct(t.unsub_rate, 2), delta: delta(t.unsub_rate, p?.unsub_rate), lowerIsBetter: true };
  const revenue = { label: "Atribuido por Klaviyo", value: eur(t.revenue), delta: delta(t.revenue, p?.revenue) };
  const flows = { label: "Desde flows", value: t.revenue > 0 ? pct(t.flow_revenue / t.revenue, 0) : "—" };
  if (compact) return <MetricList rows={[revenue, flows, open, clicks, unsub]} />;
  return (
    <>
      <MetricList
        title="Ingresos"
        rows={[
          revenue,
          flows,
          { label: "Conversiones", value: fmtNum(t.conversions), delta: delta(t.conversions, p?.conversions) },
          { label: "Ingreso por email", value: eur(t.revenue_per_recipient, 2), delta: delta(t.revenue_per_recipient, p?.revenue_per_recipient) },
        ]}
      />
      <SheetList
        items={[
          {
            title: "Interacción",
            summary: `Aperturas ${pct(t.open_rate)}`,
            content: <MetricList rows={[open, clicks, { label: "Clics por apertura", value: pct(t.ctor) }, { label: "Conversión", value: pct(t.conversion_rate, 2) }]} />,
          },
          {
            title: "Salud de la lista",
            summary: `Bajas ${pct(t.unsub_rate, 2)}`,
            content: <MetricList rows={[unsub, { label: "Rebotes", value: pct(t.bounce_rate, 2) }, { label: "Spam", value: pct(t.spam_rate, 3) }, { label: "Emails enviados", value: fmtNum(t.recipients) }]} />,
          },
        ]}
      />
    </>
  );
}

// --- Shopify ---------------------------------------------------------------------

function Shopify({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const base = `/v1/organizations/${org.id}`;
  const shop = useApi<ShopifyMetrics>(withStore(org, `${base}/shopify/metrics?days=${days}`));
  const ins = useApi<Insights>(withStore(org, `${base}/shopify/insights?days=${days}`));
  const analyst = useAnalyst(org.id, days);
  const d = shop.data;
  const i = ins.data;

  return (
    <Screen flat title="Shopify" theme="shopify" subtitle={org.name} onRefresh={async () => void (await Promise.all([shop.reload(), ins.reload()]))}>
      <PeriodChips options={[7, 30, 90]} value={days} onChange={setDays} />
      <Status error={shop.error} loading={!d} retry={shop.retry} />
      {d && (
        <>
          <ShopifyGroups d={d} i={i} analyst={analyst} />
          <TopProducts org={org} days={days} />
        </>
      )}
      {analyst.sheet}
    </Screen>
  );
}

type Product = {
  id: string;
  title: string;
  primary_image_url: string | null;
  metrics?: { units_ordered: number; stock_available: number | null; margin_pct: number | null; margin_complete: boolean; variants_out: number } | null;
};

function TopProducts({ org, days }: { org: Org; days: number }) {
  const { data } = useApi<{ products: Product[] }>(withStore(org, `/v1/organizations/${org.id}/shopify/catalog/products?sort=sales&status=ACTIVE&periodDays=${days}&page=1`));
  const rows = data?.products.slice(0, 5) ?? [];
  if (rows.length === 0) return null;
  return (
    <ListCard flat title="Más vendidos">
      {rows.map((p, idx) => {
        const m = p.metrics;
        const meta = [m ? `${fmtNum(m.units_ordered)} uds` : null, m?.stock_available != null ? `stock ${fmtNum(m.stock_available)}` : null, m?.margin_complete && m.margin_pct != null ? `margen ${m.margin_pct.toFixed(0)} %` : null].filter(Boolean).join(" · ");
        const thumb = { width: 40, height: 40, borderRadius: 8, backgroundColor: c.surface };
        return (
          <ListRow flat key={p.id} first={idx === 0} right={m && m.variants_out > 0 ? <Text style={{ fontSize: 12, fontFamily: font.medium, color: c.danger }}>Agotado</Text> : null}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {p.primary_image_url ? <Image source={{ uri: p.primary_image_url }} style={thumb} /> : <View style={{ ...thumb, borderWidth: 1, borderColor: c.edge }} />}
              <View style={{ flex: 1 }}>
                <RowTitle>{p.title}</RowTitle>
                {meta ? <RowMeta>{meta}</RowMeta> : null}
              </View>
            </View>
          </ListRow>
        );
      })}
    </ListCard>
  );
}

// --- Meta --------------------------------------------------------------------------

type MetaRow = { campaign_id: string; name: string; effective_status: string | null; spend: number; purchases: number; roas: number | null };
type MetaCampaigns = { currency: string | null; campaigns: MetaRow[]; total: number; summary: { active: number; paused: number } };

function Meta({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const base = `/v1/organizations/${org.id}`;
  const ins = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${days}`));
  const analyst = useAnalyst(org.id, days);
  const camps = useApi<MetaCampaigns>(withStore(org, `${base}/meta/campaigns?page=1&sort=spend&periodDays=${days}`));
  const s = ins.data?.summary;
  const cur = ins.data?.currency;
  const list = camps.data?.campaigns.slice(0, 5) ?? [];

  return (
    <Screen flat title="Meta Ads" theme="meta" subtitle={org.name} onRefresh={async () => void (await Promise.all([ins.reload(), camps.reload()]))}>
      <PeriodChips options={[7, 30, 90]} value={days} onChange={setDays} />
      <Status error={ins.error} loading={!ins.data} retry={ins.retry} />
      {ins.data && !s && <Note flat text="Meta Ads no tiene datos en este periodo. Si aún no está conectado, se hace desde la web." />}
      {s && (
        <>
          <MetaGroups s={s} cur={cur} analyst={analyst} />
        </>
      )}
      {list.length > 0 && (
        <ListCard flat title={`Campañas · ${camps.data!.summary.active} activas`}>
          {list.map((r, i) => (
            <ListRow flat key={r.campaign_id} first={i === 0} right={<Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{money(r.spend, camps.data!.currency)}</Text>}>
              <RowTitle>{r.name}</RowTitle>
              <RowMeta>{`${r.effective_status === "ACTIVE" ? "Activa" : "En pausa"} · ROAS ${dec(r.roas)} · ${fmtNum(r.purchases)} compras`}</RowMeta>
            </ListRow>
          ))}
        </ListCard>
      )}
      {s && <Note flat text="Compras, ROAS y valor son los que Meta se atribuye; no se suman a los de otros canales." />}
      {analyst.sheet}
    </Screen>
  );
}

// --- Klaviyo -------------------------------------------------------------------------

type Entity = { id: string; name: string; revenue: number; open_rate: number | null; click_rate: number | null };
type KlaviyoReport = EmailReport & { campaigns: Entity[]; flows: Entity[] };

function Klaviyo({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const { data, error, reload, retry } = useApi<KlaviyoReport>(withStore(org, `/v1/organizations/${org.id}/klaviyo/email-report?days=${days}`));
  const analyst = useAnalyst(org.id, days);
  const t = data?.totals;
  const p = data?.previous;
  const top = (title: string, items: Entity[]) =>
    items.length > 0 && (
      <ListCard flat title={title}>
        {[...items]
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map((e, i) => (
            <ListRow flat key={e.id} first={i === 0} right={<Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{eur(e.revenue)}</Text>}>
              <RowTitle>{e.name}</RowTitle>
              <RowMeta>{`Aperturas ${pct(e.open_rate)} · clics ${pct(e.click_rate)}`}</RowMeta>
            </ListRow>
          ))}
      </ListCard>
    );

  return (
    <Screen flat title="Klaviyo" theme="klaviyo" subtitle={org.name} onRefresh={reload}>
      <PeriodChips options={[30, 90]} value={days} onChange={setDays} />
      <Status error={error} loading={!data} retry={retry} />
      {data && !data.connected && <Note flat text="Klaviyo no está conectado. Se conecta desde la web." />}
      {data?.connected && t && (
        <>
          <KlaviyoGroups t={t} p={p} analyst={analyst} />
          {top("Flows que más ingresan", data.flows)}
          {top("Campañas que más ingresan", data.campaigns)}
          <Note flat text="Los ingresos son los que Klaviyo se atribuye; no se suman a los de otros canales." />
        </>
      )}
      {analyst.sheet}
    </Screen>
  );
}
