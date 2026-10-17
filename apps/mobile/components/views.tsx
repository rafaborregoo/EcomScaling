import { useState } from "react";
import { Text, View } from "react-native";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, fmtNum, font, klaviyo } from "../lib/theme";
import { ChartCarousel, type ChartTab } from "./chart";
import { RateBars, Strip, Tunnel, smallTitle } from "./bloques";
import { ListCard, ListRow, MetricList, Note, PeriodChips, RowMeta, RowTitle, Screen, Status } from "./ui";
import { StockAlert } from "./stock";
import { AlertsWidget, type Alert } from "./alerts";
import { ProposalsWidget, type Diagnostic } from "./proposals";
import { TasksWidget, type Task } from "./tasks";

// `connectionId`: tienda Shopify elegida en Configuración; vacío = todas las tiendas del cliente.
export type Org = { id: string; name: string; isConsultant: boolean; connectionId?: string };

/** Añade la tienda elegida a la URL de un endpoint que reparte las cifras por tienda. */
export const withStore = (org: Org, url: string) => (org.connectionId ? `${url}${url.includes("?") ? "&" : "?"}connectionId=${encodeURIComponent(org.connectionId)}` : url);
export type TabKey = "todo" | "shopify" | "meta" | "klaviyo";

// Subconjuntos de lo que devuelve la API (ver apps/web/src/app/dashboard/client-*.tsx). Solo lo que pinta la móvil.
export type ShopifyMetrics = {
  currency_code?: string | null;
  financial_currency_coverage?: { status: "compatible" | "incompatible" | "unknown" };
  sales: { net_sales: number; gross_sales: number; discounts: number; refunds: number; units_sold: number; orders_count: number; aov: number };
  stock: { tracked_items: number; low_stock_items: number; out_of_stock_items: number };
  top_products: Array<{ product_id: string; title: string; quantity_sold: number; revenue: number }>;
  financial: { has_settings: boolean; items_without_cost: number; cogs: number; payment_fees: number; shipping_costs: number; fixed_costs: number; net_profit: number; net_margin_pct: number; net_revenue_ex_tax: number; ads_spend: number; ads_by_platform: Record<string, number>; new_customers: number; cac_blended: number | null; contribution_per_order: number; breakeven_cac_per_order: number; breakeven_roas: number | null; mbee: number; break_even_monthly_revenue: number | null };
  margin: { lines_without_metrics: number; margin_pct: number; items_without_cost: number };
  previous_period: { sales: { net_sales: number; orders_count: number; aov: number; discounts: number; refunds: number }; financial: { net_profit: number }; conversion_rate_own: number | null } | null;
  daily: Array<{ date: string; net_sales: number; orders_count: number }>;
  funnel: { has_sessions: boolean; sessions: number; cart_additions: number; checkouts_reached: number; purchases: number; has_funnel_steps: boolean; conversion_rate_own: number | null; revenue_per_session: number | null; cart_rate: number | null; checkout_rate: number | null; checkout_to_purchase_rate: number | null } | null;
  funnel_daily: Array<{ date: string; conversion_rate_own: number | null }>;
  financial_monthly: Array<{ month: string; orders_count: number; net_revenue_ex_tax: number; net_profit: number; ads_spend: number; new_customers: number }>;
};

export type MetaInsights = {
  currency: string | null;
  summary: { spend: number; impressions: number; clicks: number; purchases: number; purchase_value: number; roas: number | null; cac: number | null; cpm: number | null; cpc: number | null; days_with_data: number } | null;
  daily_spend: Array<{ bucket_date: string; spend: number }>;
  daily_roas: Array<{ bucket_date: string; roas: number | null }>;
};

export type EmailTotals = { revenue: number; campaign_revenue: number; flow_revenue: number; conversions: number; recipients: number; open_rate: number | null; click_rate: number | null; ctor: number | null; conversion_rate: number | null; revenue_per_recipient: number | null; unsub_rate: number | null; bounce_rate: number | null; spam_rate: number | null };
export type EmailReport = {
  connected: boolean;
  totals: EmailTotals;
  previous: EmailTotals | null;
  trend: Array<{ month: string; campaign_revenue: number; flow_revenue: number }>;
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""}`;
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${iso.slice(2, 4)}`;
const pctDelta = (now: number, before: number | null | undefined) => (before ? ((now - before) / before) * 100 : null);
const pct = (ratio: number | null | undefined, d = 1) => (ratio == null ? "—" : `${(ratio * 100).toFixed(d).replace(".", ",")} %`);
const money = (v: number | null | undefined, cur: string | null | undefined, d = 0) => (cur ? fmtCurrency(v, cur, d) : v == null ? "—" : fmtNum(Math.round(v)));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Mismas condiciones que canShowProfit de la web: sin costes completos el beneficio engaña, y no se enseña.
export function profitOf(d: ShopifyMetrics) {
  const ok = d.financial_currency_coverage?.status === "compatible" && d.financial.has_settings && d.financial.items_without_cost === 0 && d.margin.lines_without_metrics === 0;
  return ok ? d.financial : null;
}

function salesTabs(d: ShopifyMetrics): ChartTab[] {
  const cur = d.currency_code;
  const tabs: ChartTab[] = [
    {
      key: "ventas",
      label: "Ventas netas",
      series: [{ name: "Ventas", color: "accent", points: d.daily.map((p) => ({ label: dayLabel(p.date), y: p.net_sales })) }],
      format: (v) => money(v, cur),
      summary: money(d.sales.net_sales, cur),
    },
    {
      key: "pedidos",
      label: "Pedidos",
      series: [{ name: "Pedidos", color: "accent", points: d.daily.map((p) => ({ label: dayLabel(p.date), y: p.orders_count })) }],
      format: (v) => fmtNum(v),
      summary: fmtNum(d.sales.orders_count),
    },
    {
      key: "ticket",
      label: "Ticket medio",
      series: [{ name: "Ticket medio", color: "accent", points: d.daily.map((p) => ({ label: dayLabel(p.date), y: p.orders_count > 0 ? p.net_sales / p.orders_count : null })) }],
      format: (v) => money(v, cur, 2),
      summary: money(d.sales.aov, cur, 2),
    },
  ];
  if (d.funnel?.has_sessions && d.funnel_daily.some((p) => p.conversion_rate_own != null)) {
    tabs.push({
      key: "conv",
      label: "Conversión",
      series: [{ name: "Conversión", color: "accent", points: d.funnel_daily.map((p) => ({ label: dayLabel(p.date), y: p.conversion_rate_own == null ? null : p.conversion_rate_own * 100 })) }],
      format: (v) => `${v.toFixed(2).replace(".", ",")} %`,
      summary: pct(d.funnel.conversion_rate_own, 2),
    });
  }
  return tabs;
}

function metaTabs(data: MetaInsights): ChartTab[] {
  const s = data.summary;
  const cur = data.currency;
  return [
    {
      key: "gasto",
      label: "Inversión en Meta",
      series: [{ name: "Inversión", color: "accent", points: data.daily_spend.map((p) => ({ label: dayLabel(p.bucket_date), y: p.spend })) }],
      format: (v) => money(v, cur, 2),
      summary: money(s?.spend ?? sum(data.daily_spend.map((p) => p.spend)), cur),
    },
    {
      key: "roas",
      label: "ROAS de Meta",
      series: [{ name: "ROAS", color: "accent", points: data.daily_roas.map((p) => ({ label: dayLabel(p.bucket_date), y: p.roas })) }],
      format: (v) => v.toFixed(2).replace(".", ","),
      summary: s?.roas == null ? "—" : s.roas.toFixed(2).replace(".", ","),
    },
  ];
}

// La web enseña los importes de Klaviyo en € sin moneda en la respuesta; se mantiene igual.
const eur = (v: number) => fmtCurrency(v, "EUR");

function mailTabs(data: EmailReport): ChartTab[] {
  return [
    {
      key: "ingresos",
      label: "Atribuido por Klaviyo",
      series: [
        { name: "Flujos", color: "accent", points: data.trend.map((p) => ({ label: monthLabel(p.month), y: p.flow_revenue })) },
        { name: "Campañas", color: "secondary", points: data.trend.map((p) => ({ label: monthLabel(p.month), y: p.campaign_revenue })) },
      ],
      format: eur,
      summary: "Por mes",
    },
  ];
}

// "Todo": la portada, una ruleta con las curvas de todos los canales. Las cifras de Meta y Klaviyo son atribuidas
// por cada plataforma (ADR-0021): cada una va en su gráfico, nunca sumadas.
export function TodoView({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const base = `/v1/organizations/${org.id}`;
  const shop = useApi<ShopifyMetrics>(withStore(org, `${base}/shopify/metrics?days=${days}`));
  const meta = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${days}`));
  const mail = useApi<EmailReport>(withStore(org, `${base}/klaviyo/email-report?days=${days}`));
  const ops = useApi<{ tasks: Task[]; alerts: Alert[] }>(`${base}/operations`);
  // Los tres agentes que proponen tareas (igual que el Dashboard de la web); solo lectura hasta que se decide.
  const monitor = useApi<Diagnostic>(`${base}/ai/monitor?days=30&view=overview`);
  const stockAi = useApi<Diagnostic>(`${base}/ai/stock-planner?days=30`);
  const emailAi = useApi<Diagnostic>(`${base}/ai/email-analyst?days=30`);
  const reloadProposals = () => void Promise.all([monitor.reload(), stockAi.reload(), emailAi.reload(), ops.reload()]);
  const d = shop.data;
  const tabs = [...(d ? salesTabs(d) : []), ...(meta.data?.summary ? metaTabs(meta.data) : []), ...(mail.data?.connected ? mailTabs(mail.data) : [])];

  return (
    <Screen flat title="Pulso" subtitle={org.name} onRefresh={async () => void (await Promise.all([shop.reload(), meta.reload(), mail.reload(), ops.reload(), monitor.reload(), stockAi.reload(), emailAi.reload()]))}>
      <PeriodChips options={[7, 30, 90]} value={days} onChange={setDays} />
      <Status error={shop.error} loading={!d} retry={shop.retry} />
      {d && <ChartCarousel tabs={tabs} suffix={` · ${days} días`} height={210} />}
      <View>
        {d && <StockAlert orgId={org.id} stock={d.stock} />}
        <ProposalsWidget orgId={org.id} diagnostics={[monitor.data, stockAi.data, emailAi.data]} onDone={reloadProposals} />
        {ops.data && <AlertsWidget alerts={ops.data.alerts ?? []} />}
        {ops.data && <TasksWidget tasks={ops.data.tasks} />}
      </View>
    </Screen>
  );
}

const SHOPIFY = "#008060";
const META = "#0866ff";

export function ShopifyView({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const { data: d, error, reload, retry } = useApi<ShopifyMetrics>(withStore(org, `/v1/organizations/${org.id}/shopify/metrics?days=${days}`));
  const profit = d ? profitOf(d) : null;
  const f = d?.funnel;
  const cur = d?.currency_code;
  const top = d ? d.top_products.slice(0, 5) : [];
  const topRevenue = Math.max(1, ...top.map((p) => p.revenue));

  return (
    <Screen flat title="Shopify" theme="shopify" subtitle={org.name} onRefresh={reload}>
      <PeriodChips options={[7, 30, 90]} value={days} onChange={setDays} />
      <Status error={error} loading={!d} retry={retry} />
      {d && (
        <>
          <ChartCarousel tabs={salesTabs(d)} suffix={` · ${days} días`} height={220} />
          <Strip
            color={SHOPIFY}
            items={[
              { label: "Pedidos", value: fmtNum(d.sales.orders_count) },
              { label: "Ticket medio", value: money(d.sales.aov, cur, 2) },
              profit ? { label: "Beneficio neto", value: money(profit.net_profit, cur) } : { label: "Unidades", value: fmtNum(d.sales.units_sold) },
            ]}
          />
          {f?.has_sessions && f.has_funnel_steps && f.sessions > 0 && (
            <Tunnel
              title="Del visitante al pedido"
              steps={[
                { label: "Sesiones", value: fmtNum(f.sessions), rate: 1 },
                { label: "Carrito", value: fmtNum(f.cart_additions), rate: f.cart_additions / f.sessions },
                { label: "Pago", value: fmtNum(f.checkouts_reached), rate: f.checkouts_reached / f.sessions },
                { label: "Compra", value: fmtNum(f.purchases), rate: f.purchases / f.sessions },
              ]}
            />
          )}
          <StockAlert orgId={org.id} stock={d.stock} />
          {top.length > 0 && (
            <View style={{ gap: 12 }}>
              <Text style={smallTitle}>Más vendidos</Text>
              {top.map((p) => (
                <View key={p.product_id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{p.title}</Text>
                      <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>{`${fmtNum(p.quantity_sold)} uds`}</Text>
                    </View>
                    <Text style={{ fontSize: 16, fontFamily: font.semibold, color: SHOPIFY }}>{money(p.revenue, cur)}</Text>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: "#e0f2ea" }}>
                    <View style={{ width: `${Math.max(2, (p.revenue / topRevenue) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: SHOPIFY }} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

// ADR-0021: lo que Meta se atribuye es "atribuido por Meta", nunca "generado", y no se suma con otras plataformas.
export function MetaView({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const { data, error, reload, retry } = useApi<MetaInsights>(withStore(org, `/v1/organizations/${org.id}/meta/insights?days=${days}`));
  const s = data?.summary;
  const cur = data?.currency;

  const tabs = data ? metaTabs(data) : [];

  return (
    <Screen flat title="Meta Ads" theme="meta" subtitle={org.name} onRefresh={reload}>
      <PeriodChips options={[7, 30, 90]} value={days} onChange={setDays} />
      <Status error={error} loading={!data} retry={retry} />
      {data && !s && <Note flat text="Meta Ads no tiene datos en este periodo. Si aún no está conectado, se hace desde la web." />}
      {data && s && (
        <>
          <ChartCarousel tabs={tabs} suffix={` · ${days} días`} height={220} />
          <Strip
            title="Resultado atribuido"
            color={META}
            items={[
              { label: "Compras", value: fmtNum(s.purchases) },
              { label: "CAC", value: money(s.cac, cur, 2) },
              { label: "Atribuido por Meta", value: money(s.purchase_value, cur) },
            ]}
          />
          <Note flat text="Las compras y el valor son los que Meta se atribuye; no se suman a los de Klaviyo ni coinciden con las ventas de Shopify." />
        </>
      )}
    </Screen>
  );
}

export function KlaviyoView({ org }: { org: Org }) {
  const [days, setDays] = useState(30);
  const { data, error, reload, retry } = useApi<EmailReport>(withStore(org, `/v1/organizations/${org.id}/klaviyo/email-report?days=${days}`));
  const t = data?.totals;
  const flowShare = t && t.revenue > 0 ? t.flow_revenue / t.revenue : null;

  const tabs = data ? mailTabs(data) : [];

  return (
    <Screen flat title="Klaviyo" theme="klaviyo" subtitle={org.name} onRefresh={reload}>
      <PeriodChips options={[30, 90]} value={days} onChange={setDays} />
      <Status error={error} loading={!data} retry={retry} />
      {data && !data.connected && <Note flat text="Klaviyo no está conectado. Se conecta desde la web." />}
      {data && data.connected && t && (
        <>
          <ChartCarousel tabs={tabs} height={220} />
          <Strip
            color={klaviyo.mint}
            items={[
              { label: "Atribuido por Klaviyo", value: eur(t.revenue) },
              { label: "Conversiones", value: fmtNum(t.conversions) },
            ]}
          />
          <RateBars
            title="Interacción"
            steps={[
              { label: "Aperturas", rate: t.open_rate, value: pct(t.open_rate) },
              { label: "Clics", rate: t.click_rate, value: pct(t.click_rate, 2) },
            ]}
          />
          {flowShare !== null && <Note flat text={`${Math.round(flowShare * 10)} de cada 10 € atribuidos llegan solos, desde flujos automáticos.`} />}
        </>
      )}
    </Screen>
  );
}
