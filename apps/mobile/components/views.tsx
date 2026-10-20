import { useState } from "react";
import { Text, View } from "react-native";
import { Send } from "lucide-react-native";
import { useApi } from "../lib/use-api";
import { c, fmtCurrency, fmtNum, font, klaviyo } from "../lib/theme";
import { Bars, RateBars, Strip, Tunnel } from "./bloques";
import { AllClear, Block, ChannelRow, Hero, MoreLink, TODAY, TopBar, type HeroMetric } from "./inicio";
import { Sheet } from "./sheet";
import { Note, Screen, ShareBar, SheetList, Status, SummaryRow } from "./ui";
import { StockAlert, stockCount, type StockForecast } from "./stock";
import { MetricsAlert, badMetrics, useAnalyst } from "./analista";
import { AlertsWidget, sortAlerts, type Alert } from "./alerts";
import { ProposalsWidget, pendingDiagnostics, type Diagnostic } from "./proposals";
import { TasksWidget, sortTasks, type Task } from "./tasks";
import { ZoneNotesWidget } from "./zone-notes";

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
const pctDelta = (now: number | null | undefined, before: number | null | undefined) => (now == null || !before ? null : ((now - before) / Math.abs(before)) * 100);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const dec = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2).replace(".", ","));
const pct = (ratio: number | null | undefined, d = 1) => (ratio == null ? "—" : `${(ratio * 100).toFixed(d).replace(".", ",")} %`);
const money = (v: number | null | undefined, cur: string | null | undefined, d = 0) => (cur ? fmtCurrency(v, cur, d) : v == null ? "—" : fmtNum(Math.round(v)));

// Mismas condiciones que canShowProfit de la web: sin costes completos el beneficio engaña, y no se enseña.
export function profitOf(d: ShopifyMetrics) {
  const ok = d.financial_currency_coverage?.status === "compatible" && d.financial.has_settings && d.financial.items_without_cost === 0 && d.margin.lines_without_metrics === 0;
  return ok ? d.financial : null;
}


/** Navegación desde Inicio: abrir la vista de un canal o su detalle en Métricas. */
export type HomeNav = { onTab: (tab: TabKey) => void; onMetrics: (tab: TabKey) => void };

const SHOPIFY = "#008060";
const META = "#0866ff";
// La web enseña los importes de Klaviyo en € sin moneda en la respuesta; se mantiene igual.
const eur = (v: number) => fmtCurrency(v, "EUR");
const SAME_DAY = "el mismo día de la semana pasada";
/** Con "Hoy" elegido, lo que no tiene corte a medianoche (Meta, Klaviyo, stock) se pide de las últimas 24 h. */
const spanOf = (days: number) => (days === TODAY ? 1 : days);
const compareOf = (days: number) => (days === TODAY ? SAME_DAY : `${days} días anteriores`);

// /shopify/today (ver apps/api/src/shopify-today.ts): desde las 00:00 de la tienda frente al mismo tramo de hace 7 días.
type SalesNow = { net_sales: number; orders_count: number; aov: number };
type ShopifyToday = { currency_code: string | null; today: SalesNow; same_day_last_week: SalesNow | null };

function todayMetrics(t: ShopifyToday): HeroMetric[] {
  const cur = t.currency_code;
  const before = t.same_day_last_week;
  return [
    { key: "ventas", label: "Ventas de hoy", value: money(t.today.net_sales, cur), delta: pctDelta(t.today.net_sales, before?.net_sales) },
    { key: "pedidos", label: "Pedidos de hoy", value: fmtNum(t.today.orders_count), delta: pctDelta(t.today.orders_count, before?.orders_count) },
    { key: "ticket", label: "Ticket medio de hoy", value: money(t.today.aov, cur, 2), delta: pctDelta(t.today.aov, before?.aov) },
  ];
}

/** Variación de una tasa en puntos porcentuales. */
const ppDelta = (now: number | null | undefined, before: number | null | undefined) => (now == null || before == null ? null : (now - before) * 100);

/** Ventas, pedidos y ticket de Shopify; con `conversion`, también la conversión. */
function salesMetrics(d: ShopifyMetrics, conversion: boolean): HeroMetric[] {
  const cur = d.currency_code;
  const prev = d.previous_period?.sales;
  const out: HeroMetric[] = [
    { key: "ventas", label: "Ventas netas", value: money(d.sales.net_sales, cur), delta: pctDelta(d.sales.net_sales, prev?.net_sales), points: d.daily.map((p) => ({ label: dayLabel(p.date), y: p.net_sales })), format: (v) => money(v, cur) },
    { key: "pedidos", label: "Pedidos", value: fmtNum(d.sales.orders_count), delta: pctDelta(d.sales.orders_count, prev?.orders_count), points: d.daily.map((p) => ({ label: dayLabel(p.date), y: p.orders_count })), format: (v) => fmtNum(Math.round(v)) },
    { key: "ticket", label: "Ticket medio", value: money(d.sales.aov, cur, 2), delta: pctDelta(d.sales.aov, prev?.aov), points: d.daily.map((p) => ({ label: dayLabel(p.date), y: p.orders_count > 0 ? p.net_sales / p.orders_count : null })), format: (v) => money(v, cur, 2) },
  ];
  if (conversion && d.funnel?.has_sessions && d.funnel_daily.some((p) => p.conversion_rate_own != null)) {
    out.push({
      key: "conv",
      label: "Conversión",
      value: pct(d.funnel.conversion_rate_own, 2),
      delta: ppDelta(d.funnel.conversion_rate_own, d.previous_period?.conversion_rate_own),
      pp: true,
      points: d.funnel_daily.map((p) => ({ label: dayLabel(p.date), y: p.conversion_rate_own == null ? null : p.conversion_rate_own * 100 })),
      format: (v) => `${v.toFixed(2).replace(".", ",")} %`,
    });
  }
  return out;
}

/**
 * La cifra del negocio, no de un canal: el beneficio neto si los costes están completos (mismas condiciones que la
 * web) y, si no, cuánto se vende por cada euro de publicidad (MER). El MER sale de ventas propias y gasto real,
 * no de lo atribuido, así que sí se puede calcular entre plataformas (ADR-0021). `d2`: el doble de días, para el
 * periodo anterior por resta (la API no lo trae).
 */
function businessMetric(d: ShopifyMetrics, d2: ShopifyMetrics | null | undefined): HeroMetric | null {
  const cur = d.currency_code;
  const months = d.financial_monthly.filter((m) => m.net_revenue_ex_tax > 0 || m.ads_spend > 0);
  const profit = profitOf(d);
  if (profit) {
    return { key: "beneficio", label: "Beneficio neto", value: money(profit.net_profit, cur), delta: pctDelta(profit.net_profit, d.previous_period?.financial.net_profit), points: months.map((m) => ({ label: monthLabel(m.month), y: m.net_profit })), format: (v) => money(v, cur) };
  }
  const f = d.financial;
  if (f.ads_spend <= 0) return null;
  const f2 = d2?.financial;
  const before = f2 ? ratio(f2.net_revenue_ex_tax - f.net_revenue_ex_tax, f2.ads_spend - f.ads_spend) : null;
  return {
    key: "mer",
    label: "Ventas por € en anuncios",
    value: dec(ratio(f.net_revenue_ex_tax, f.ads_spend)),
    delta: pctDelta(ratio(f.net_revenue_ex_tax, f.ads_spend), before),
    points: months.map((m) => ({ label: monthLabel(m.month), y: ratio(m.net_revenue_ex_tax, m.ads_spend) })),
    format: dec,
  };
}

/** Meta del periodo anterior: la API no lo trae, así que se pide el doble de días y se resta (igual que Métricas). */
function metaBefore(s: MetaInsights["summary"], s2: MetaInsights["summary"] | undefined) {
  if (!s || !s2) return null;
  const spend = s2.spend - s.spend;
  const purchases = s2.purchases - s.purchases;
  return { spend, purchases, roas: ratio(s2.purchase_value - s.purchase_value, spend), cac: ratio(spend, purchases) };
}

// "Todo": lo primero que se ve al abrir la app, y por eso arranca en "Hoy". Una cifra, lo que pide atención y un
// acceso a cada canal. Lo atribuido por Meta y Klaviyo va en la fila de cada uno, nunca sumado (ADR-0021).
export function TodoView({ org, nav }: { org: Org; nav: HomeNav }) {
  const [days, setDays] = useState(TODAY);
  const span = spanOf(days);
  const base = `/v1/organizations/${org.id}`;
  const shop = useApi<ShopifyMetrics>(withStore(org, `${base}/shopify/metrics?days=${span}`));
  const today = useApi<ShopifyToday>(days === TODAY ? withStore(org, `${base}/shopify/today`) : null);
  const d = shop.data;
  const profit = d ? profitOf(d) : null;
  // Solo hace falta el doble de días para la variación del MER (sin costes completos y con un periodo de días).
  const shop2 = useApi<ShopifyMetrics>(d && !profit && days !== TODAY ? withStore(org, `${base}/shopify/metrics?days=${days * 2}`) : null);
  const meta = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${span}`));
  const meta2 = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${span * 2}`));
  const mail = useApi<EmailReport>(withStore(org, `${base}/klaviyo/email-report?days=${span}`));
  const ops = useApi<{ tasks: Task[]; alerts: Alert[] }>(`${base}/operations`);
  const stock = useApi<StockForecast>(withStore(org, `${base}/shopify/stock-forecast`));
  // Veredictos por reglas (sin IA) del periodo de Métricas: lo que esté en rojo sale en Para hoy.
  const analyst = useAnalyst(org, 30);
  // Los tres agentes que proponen tareas (igual que el Dashboard de la web). Son lecturas de su último análisis.
  const monitor = useApi<Diagnostic>(`${base}/ai/monitor?days=30&view=overview`);
  const stockAi = useApi<Diagnostic>(`${base}/ai/stock-planner?days=30`);
  const emailAi = useApi<Diagnostic>(withStore(org, `${base}/ai/email-analyst`));
  const reloadProposals = () => void Promise.all([monitor.reload(), stockAi.reload(), emailAi.reload(), ops.reload()]);

  const ms = meta.data?.summary ?? null;
  const mb = metaBefore(ms, meta2.data?.summary);
  const mt = mail.data?.connected ? mail.data.totals : null;
  const f = d?.funnel;
  const conv = f?.has_sessions ? f.conversion_rate_own : null;
  const tail = days === TODAY ? " · 24 h" : "";

  const business = d && days !== TODAY ? businessMetric(d, shop2.data) : null;
  const metrics: HeroMetric[] = days === TODAY ? (today.data ? todayMetrics(today.data) : []) : d ? [...(business ? [business] : []), ...salesMetrics(d, false)] : [];

  const diagnostics = [monitor.data, stockAi.data, emailAi.data];
  // Propuestas de la IA y reponer stock son del cliente: el consultor no los ve en su Pulso.
  const pendingCount = org.isConsultant ? 0 : pendingDiagnostics(diagnostics).length;
  const alertCount = ops.data ? sortAlerts(ops.data.alerts ?? []).length : 0;
  // Las tareas del cliente (vencidas o no) no son ruido que el consultor deba ver en su Pulso: viven en Trabajo.
  const taskCount = ops.data && !org.isConsultant ? sortTasks(ops.data.tasks).length : 0;
  const clear = !!ops.data && pendingCount + alertCount + taskCount + (org.isConsultant ? 0 : stockCount(stock.data)) + badMetrics(analyst).length === 0;

  return (
    <Screen flat title="Pulso" onRefresh={async () => void (await Promise.all([shop.reload(), today.reload(), shop2.reload(), meta.reload(), meta2.reload(), mail.reload(), ops.reload(), stock.reload(), analyst.reload(), monitor.reload(), stockAi.reload(), emailAi.reload()]))}>
      <TopBar name={org.isConsultant ? "" : org.name} options={[TODAY, 7, 30, 90]} days={days} onChange={setDays} />
      <Status error={(days === TODAY ? today.error : null) ?? shop.error} loading={metrics.length === 0} retry={() => { shop.retry(); today.retry(); }} />
      {metrics.length > 0 && <Hero key={days === TODAY ? "hoy" : "periodo"} metrics={metrics} compare={compareOf(days)} />}

      {ops.data && (
        <Block title="Para hoy">
          {!org.isConsultant && <ZoneNotesWidget orgId={org.id} connectionId={org.connectionId} />}
          {!org.isConsultant && <ProposalsWidget orgId={org.id} diagnostics={diagnostics} onDone={reloadProposals} />}
          <AlertsWidget orgId={org.id} alerts={ops.data.alerts ?? []} onChanged={() => void ops.reload()} />
          {!org.isConsultant && <StockAlert stock={stock.data} />}
          <MetricsAlert analyst={analyst} />
          {!org.isConsultant && <TasksWidget orgId={org.id} tasks={ops.data.tasks} onChanged={() => void ops.reload()} />}
          {clear && <AllClear />}
        </Block>
      )}

      <Block title="Canales">
        <ChannelRow
          first
          name="Shopify"
          color={SHOPIFY}
          caption={!d ? "Cargando…" : (conv != null ? "Conversión" : "Unidades vendidas") + tail}
          value={!d ? undefined : conv != null ? pct(conv, 2) : fmtNum(d.sales.units_sold)}
          delta={conv != null ? ppDelta(conv, d?.previous_period?.conversion_rate_own) : null}
          pp={conv != null}
          onPress={() => nav.onTab("shopify")}
        />
        <ChannelRow
          name="Meta Ads"
          color={META}
          caption={!meta.data ? "Cargando…" : ms ? `ROAS atribuido por Meta${tail}` : "Sin datos en este periodo"}
          value={ms ? dec(ms.roas) : undefined}
          delta={ms ? pctDelta(ms.roas, mb?.roas) : null}
          onPress={() => nav.onTab("meta")}
        />
        <ChannelRow
          name="Klaviyo"
          color={klaviyo.mint}
          caption={!mail.data ? "Cargando…" : mt ? `Atribuido por Klaviyo${tail}` : "No conectado"}
          value={mt ? eur(mt.revenue) : undefined}
          delta={mt ? pctDelta(mt.revenue, mail.data?.previous?.revenue) : null}
          onPress={() => nav.onTab("klaviyo")}
        />
      </Block>

      {d && <MoreLink onPress={() => nav.onMetrics("todo")} />}
    </Screen>
  );
}

export function ShopifyView({ org, nav }: { org: Org; nav: HomeNav }) {
  const [days, setDays] = useState(30);
  const base = `/v1/organizations/${org.id}`;
  const { data: d, error, reload, retry } = useApi<ShopifyMetrics>(withStore(org, `${base}/shopify/metrics?days=${spanOf(days)}`));
  const today = useApi<ShopifyToday>(days === TODAY ? withStore(org, `${base}/shopify/today`) : null);
  const profit = d ? profitOf(d) : null;
  const f = d?.funnel;
  const cur = d?.currency_code;
  const top = d ? d.top_products.slice(0, 5) : [];
  const topRevenue = Math.max(1, ...top.map((p) => p.revenue));
  const stock = useApi<StockForecast>(withStore(org, `${base}/shopify/stock-forecast`));
  const metrics = days === TODAY ? (today.data ? todayMetrics(today.data) : []) : d ? salesMetrics(d, true) : [];
  const tail = days === TODAY ? " (24 h)" : "";

  return (
    <Screen flat title="Shopify" theme="shopify" onRefresh={async () => void (await Promise.all([reload(), today.reload(), stock.reload()]))}>
      <TopBar name={org.isConsultant ? "" : org.name} options={[TODAY, 7, 30, 90]} days={days} onChange={setDays} />
      <Status error={(days === TODAY ? today.error : null) ?? error} loading={!d || metrics.length === 0} retry={() => { retry(); today.retry(); }} />
      {d && metrics.length > 0 && (
        <>
          <Hero key={days === TODAY ? "hoy" : "periodo"} metrics={metrics} compare={compareOf(days)} />

          {!org.isConsultant && (
            <Block title="Para hoy">
              <StockAlert stock={stock.data} />
              {stock.data && stockCount(stock.data) === 0 && <AllClear />}
            </Block>
          )}

          <SheetList
            title="Detalle"
            items={[
              profit && {
                title: `Beneficio neto${tail}`,
                summary: money(profit.net_profit, cur),
                theme: "shopify",
                content: (
                  <Bars
                    title="Dónde se queda cada euro"
                    rows={[
                      { label: "Ventas sin IVA", value: profit.net_revenue_ex_tax, shown: money(profit.net_revenue_ex_tax, cur), color: SHOPIFY },
                      { label: "Coste de producto", value: profit.cogs, shown: money(profit.cogs, cur), color: c.muted },
                      { label: "Publicidad", value: profit.ads_spend, shown: money(profit.ads_spend, cur), color: c.muted },
                      { label: "Envíos", value: profit.shipping_costs, shown: money(profit.shipping_costs, cur), color: c.muted },
                      { label: "Comisiones de pago", value: profit.payment_fees, shown: money(profit.payment_fees, cur), color: c.muted },
                      { label: "Costes fijos", value: profit.fixed_costs, shown: money(profit.fixed_costs, cur), color: c.muted },
                      { label: "Beneficio neto", value: profit.net_profit, shown: money(profit.net_profit, cur), color: profit.net_profit >= 0 ? SHOPIFY : c.danger, strong: true },
                    ]}
                  />
                ),
              },
              top.length > 0 && {
                title: `Más vendidos${tail}`,
                summary: `Top ${top.length}`,
                theme: "shopify",
                content: top.map((p) => (
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
                )),
              },
              !!f?.has_sessions && f.has_funnel_steps && f.sessions > 0 && {
                title: `Del visitante al pedido${tail}`,
                summary: `${fmtNum(f.sessions)} sesiones`,
                theme: "shopify",
                content: (
                  <Tunnel
                    title="Embudo"
                    steps={[
                      { label: "Sesiones", value: fmtNum(f.sessions), rate: 1 },
                      { label: "Carrito", value: fmtNum(f.cart_additions), rate: f.cart_additions / f.sessions },
                      { label: "Pago", value: fmtNum(f.checkouts_reached), rate: f.checkouts_reached / f.sessions },
                      { label: "Compra", value: fmtNum(f.purchases), rate: f.purchases / f.sessions },
                    ]}
                  />
                ),
              },
            ]}
          />

          <MoreLink onPress={() => nav.onMetrics("shopify")} />
        </>
      )}
    </Screen>
  );
}

/** Aviso de Meta: el ROAS atribuido no llega al mínimo con el que cada venta cubre sus costes. */
function BreakEvenAlert({ roas, breakeven }: { roas: number; breakeven: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SummaryRow title="ROAS bajo el mínimo rentable" summary={`${dec(roas)} de ${dec(breakeven)}`} color={c.danger} dot={c.danger} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="ROAS bajo el mínimo">
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 24 }}>
          <View>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>Atribuido</Text>
            <Text style={{ fontSize: 34, fontFamily: font.semibold, color: c.danger }}>{dec(roas)}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>Mínimo</Text>
            <Text style={{ fontSize: 34, fontFamily: font.semibold, color: c.ink }}>{dec(breakeven)}</Text>
          </View>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.accentTint }}>
          <View style={{ width: `${Math.max(2, Math.min(100, (roas / breakeven) * 100))}%`, height: 8, borderRadius: 4, backgroundColor: c.danger }} />
        </View>
        <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Por debajo del mínimo, cada euro en Meta pierde dinero.</Text>
      </Sheet>
    </>
  );
}

// ADR-0021: lo que Meta se atribuye es "atribuido por Meta", nunca "generado", y no se suma con otras plataformas.
export function MetaView({ org, nav }: { org: Org; nav: HomeNav }) {
  const [days, setDays] = useState(30);
  const base = `/v1/organizations/${org.id}`;
  const { data, error, reload, retry } = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${days}`));
  const prev = useApi<MetaInsights>(withStore(org, `${base}/meta/insights?days=${days * 2}`));
  // El mínimo rentable sale de los costes de la tienda; sin costes completos no hay mínimo fiable y no se avisa.
  const shop = useApi<ShopifyMetrics>(withStore(org, `${base}/shopify/metrics?days=${days}`));
  const s = data?.summary;
  const cur = data?.currency;
  const before = metaBefore(s ?? null, prev.data?.summary);
  const breakeven = shop.data ? profitOf(shop.data)?.breakeven_roas ?? null : null;

  const metrics: HeroMetric[] = data && s
    ? [
        { key: "gasto", label: "Inversión", value: money(s.spend, cur), delta: pctDelta(s.spend, before?.spend), neutral: true, points: data.daily_spend.map((p) => ({ label: dayLabel(p.bucket_date), y: p.spend })), format: (v) => money(v, cur, 2) },
        { key: "roas", label: "ROAS atribuido", value: dec(s.roas), delta: pctDelta(s.roas, before?.roas), points: data.daily_roas.map((p) => ({ label: dayLabel(p.bucket_date), y: p.roas })), format: dec },
      ]
    : [];

  return (
    <Screen flat title="Meta Ads" theme="meta" onRefresh={async () => void (await Promise.all([reload(), prev.reload(), shop.reload()]))}>
      <TopBar name={org.isConsultant ? "" : org.name} options={[7, 30, 90]} days={days} onChange={setDays} />
      <Status error={error} loading={!data} retry={retry} />
      {data && !s && <Note flat text="Meta Ads no tiene datos en este periodo. Si aún no está conectado, se hace desde la web." />}
      {data && s && (
        <>
          <Hero metrics={metrics} compare={compareOf(days)} />
          {breakeven != null && s.roas != null && (
            <Block title="Para hoy">{s.roas < breakeven ? <BreakEvenAlert roas={s.roas} breakeven={breakeven} /> : <AllClear />}</Block>
          )}
          <SheetList
            title="Detalle"
            items={[
              {
                title: "Resultado atribuido",
                summary: money(s.purchase_value, cur),
                theme: "meta",
                content: (
                  <>
                    <Strip
                      color={META}
                      items={[
                        { label: "Compras", value: fmtNum(s.purchases), delta: pctDelta(s.purchases, before?.purchases) },
                        { label: "CAC", value: money(s.cac, cur, 2), delta: pctDelta(s.cac, before?.cac), lowerIsBetter: true },
                        { label: "Atribuido por Meta", value: money(s.purchase_value, cur) },
                      ]}
                    />
                    <Note flat text="Es lo que Meta se atribuye: no se suma a Klaviyo ni coincide con las ventas de Shopify." />
                  </>
                ),
              },
            ]}
          />
          <MoreLink label="Ver campañas y cifras" onPress={() => nav.onMetrics("meta")} />
        </>
      )}
    </Screen>
  );
}

// Subconjunto de /marketing/klaviyo (el mismo que lee Marketing, así que comparten caché).
type KlaviyoCampaign = { id: string; name: string; status: string | null; send_time: string | null };
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
// Mismo criterio que campaignStatus de Marketing: programada o enviándose, no borrador ni cancelada.
const isOutgoing = (status: string | null) => {
  const v = (status ?? "").toLowerCase();
  return !v.includes("cancel") && (v.includes("scheduled") || v.includes("sending") || v.includes("queued") || v.includes("preparing"));
};
const hourOf = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

/** Campañas que salen hoy: lo único de Klaviyo que pide mirarse el mismo día. */
function OutgoingToday({ campaigns }: { campaigns: KlaviyoCampaign[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SummaryRow title="Salen hoy" summary={`${campaigns.length} campaña${campaigns.length > 1 ? "s" : ""}`} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Salen hoy" count={campaigns.length}>
        {campaigns.map((x, i) => (
          <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
            <Send size={16} color={c.muted} />
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{x.name}</Text>
            <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{hourOf(x.send_time!)}</Text>
          </View>
        ))}
      </Sheet>
    </>
  );
}

export function KlaviyoView({ org, nav }: { org: Org; nav: HomeNav }) {
  const [days, setDays] = useState(30);
  const { data, error, reload, retry } = useApi<EmailReport>(withStore(org, `/v1/organizations/${org.id}/klaviyo/email-report?days=${days}`));
  const ws = useApi<{ connected: boolean; campaigns?: KlaviyoCampaign[] }>(withStore(org, `/v1/organizations/${org.id}/marketing/klaviyo?days=30`));
  const t = data?.totals;
  const p = data?.previous;
  const outgoing = (ws.data?.campaigns ?? []).filter((x) => x.send_time && isToday(x.send_time) && isOutgoing(x.status)).sort((a, b) => a.send_time!.localeCompare(b.send_time!));

  // Flujos + campañas sí se suman: son la misma plataforma (lo que no se suma es Klaviyo con Meta).
  const metrics: HeroMetric[] = data && t
    ? [{ key: "ingresos", label: "Atribuido por Klaviyo", value: eur(t.revenue), delta: pctDelta(t.revenue, p?.revenue), points: data.trend.map((m) => ({ label: monthLabel(m.month), y: m.flow_revenue + m.campaign_revenue })), format: eur }]
    : [];

  return (
    <Screen flat title="Klaviyo" theme="klaviyo" onRefresh={async () => void (await Promise.all([reload(), ws.reload()]))}>
      <TopBar name={org.isConsultant ? "" : org.name} options={[30, 90]} days={days} onChange={setDays} />
      <Status error={error} loading={!data} retry={retry} />
      {data && !data.connected && <Note flat text="Klaviyo no está conectado. Se conecta desde la web." />}
      {data && data.connected && t && (
        <>
          <Hero metrics={metrics} compare="periodo anterior" />
          {ws.data?.connected && <Block title="Para hoy">{outgoing.length > 0 ? <OutgoingToday campaigns={outgoing} /> : <AllClear />}</Block>}
          <SheetList
            title="Detalle"
            items={[
              {
                title: "Flujos y campañas",
                summary: t.revenue > 0 ? `${Math.round((t.flow_revenue / t.revenue) * 100)} % flujos` : undefined,
                theme: "klaviyo",
                content: <ShareBar title="De dónde sale lo atribuido" format={eur} parts={[{ label: "Flujos automáticos", value: t.flow_revenue, color: klaviyo.mint }, { label: "Campañas", value: t.campaign_revenue, color: c.ink }]} />,
              },
              {
                title: "Interacción",
                summary: `${pct(t.open_rate)} aperturas`,
                theme: "klaviyo",
                content: (
                  <>
                    <RateBars title="Del envío al clic" steps={[{ label: "Aperturas", rate: t.open_rate, value: pct(t.open_rate) }, { label: "Clics", rate: t.click_rate, value: pct(t.click_rate, 2) }]} />
                    <Strip items={[{ label: "Conversiones", value: fmtNum(t.conversions), delta: pctDelta(t.conversions, p?.conversions) }]} />
                  </>
                ),
              },
            ]}
          />
          <MoreLink label="Ver campañas y cifras" onPress={() => nav.onMetrics("klaviyo")} />
        </>
      )}
    </Screen>
  );
}
