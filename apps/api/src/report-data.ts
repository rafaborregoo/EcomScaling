import {
  formatReportMetric,
  getReportTemplate,
  metricChangePct,
  type ReportAnalysis,
  type ReportDocument,
  type ReportMetric,
  type ReportSection,
  type ReportTemplateId,
  type ReportTrend,
} from "./report-templates.js";

type Row = Record<string, unknown>;
export type ReportDataSets = {
  shopify?: Row;
  previousShopify?: Row;
  finance?: Row;
  previousFinance?: Row;
  customer?: Row;
  cohorts?: Row[];
  products?: Row[];
  meta?: Row;
  previousMeta?: Row;
  metaCurrencyCode?: string;
  campaigns?: Row[];
  metaCampaigns?: Row[];
  klaviyo?: Row[];
  /** Series diarias: shopify_sales_daily, meta_spend_daily, klaviyo_daily_revenue. */
  salesDaily?: Row[];
  previousSalesDaily?: Row[];
  metaDaily?: Row[];
  klaviyoDaily?: Row[];
  /** La inversión publicitaria del motor financiero no está en la moneda de la tienda. */
  adsCurrencyWarning?: string;
  previousKlaviyo?: Row[];
  /** Moneda de los ingresos atribuidos de Klaviyo; sin ella se usa la del informe. */
  klaviyoCurrencyCode?: string;
};

const n = (row: Row | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
};
const str = (value: unknown) => typeof value === "string" ? value : "";
const m = (label: string, value: number | null, format: ReportMetric["format"], previous?: number | null, currencyCode?: string, decimalPlaces?: number): ReportMetric => ({ label, value, format, ...(previous === undefined ? {} : { previous }), ...(currencyCode ? { currencyCode } : {}), ...(decimalPlaces === undefined ? {} : { decimalPlaces }) });
const metrics = (title: string, values: ReportMetric[]): ReportSection => ({ kind: "metrics", title, metrics: values });
const note = (title: string, body: string, tone: "info" | "warning" = "info"): ReportSection => ({ kind: "note", title, body, tone });
const table = (title: string, columns: Array<{ key: string; label: string; align?: "left" | "right"; width?: number }>, rows: Array<Record<string, string | number | null>>): ReportSection => ({ kind: "table", title, table: { title, columns, rows, emptyMessage: "La fuente no devolvió filas para este periodo." } });

const chart = (title: string, unit: "currency" | "number" | "percent" | "ratio", items: Array<{ label: string; value: number | null }>, currencyCode?: string): ReportSection | null => {
  const validItems = items.filter((item): item is { label: string; value: number } => item.value !== null && Number.isFinite(item.value));
  return validItems.length ? { kind: "chart", title, chart: { title, unit, items: validItems, ...(currencyCode ? { currencyCode } : {}) } } : null;
};
/** Serie diaria; null si no hay ni un día con actividad (no se pinta una línea plana en cero). */
const trend = (title: string, unit: ReportTrend["unit"], rows: Row[] | undefined, dateKey: string, value: (row: Row) => number, currencyCode?: string, previousRows?: Row[]): ReportSection | null => {
  const current = (rows ?? []).filter((row) => str(row[dateKey]));
  if (current.length < 2 || !current.some((row) => value(row) !== 0)) return null;
  const series: ReportTrend["series"] = [{ label: "Periodo", values: current.map(value), style: "solid" }];
  const previous = (previousRows ?? []).filter((row) => str(row[dateKey]));
  if (previous.some((row) => value(row) !== 0)) series.push({ label: "Periodo anterior", values: previous.slice(0, current.length).map(value), style: "dashed" });
  return { kind: "trend", title, trend: { unit, ...(currencyCode ? { currencyCode } : {}), dates: current.map((row) => str(row[dateKey]).slice(0, 10)), series } };
};

/** Triángulo de cohortes: fila = mes de alta, columna = meses después; % de clientes que vuelven. */
function cohortTriangle(rows: Row[]): ReportSection {
  const offsets = [1, 2, 3, 4, 5, 6];
  const byCohort = new Map<string, Row[]>();
  for (const row of rows) {
    const cohort = str(row.cohort_month).slice(0, 7);
    if (cohort) byCohort.set(cohort, [...(byCohort.get(cohort) ?? []), row]);
  }
  const cohorts = [...byCohort.keys()].sort().slice(-12);
  const section = table("Retención por cohorte · % de clientes que vuelven a comprar", [
    { key: "cohort", label: "Cohorte", width: 1 },
    { key: "size", label: "Clientes", align: "right", width: 0.8 },
    ...offsets.map((offset) => ({ key: `m${offset}`, label: `Mes ${offset}`, align: "right" as const, width: 0.7 })),
  ], cohorts.map((cohort) => {
    const cohortRows = byCohort.get(cohort) ?? [];
    const size = n(cohortRows[0], "cohort_customers");
    const cells: Record<string, string | number | null> = { cohort, size };
    for (const offset of offsets) {
      const hit = cohortRows.find((row) => n(row, "month_offset") === offset);
      cells[`m${offset}`] = hit && size ? ((n(hit, "customers") ?? 0) / size) * 100 : null;
    }
    return cells;
  }));
  if (section.kind === "table") section.table.heatColumns = offsets.map((offset) => `m${offset}`);
  return section;
}

const money = (value: number | null, currencyCode: string) => value === null ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(value);

type KlaviyoTotals = { revenue: number; conversions: number; delivered: number; opens: number; clicks: number; unsubscribes: number };
function klaviyoTotals(rows: Row[]): KlaviyoTotals {
  return rows.reduce<KlaviyoTotals>((sum, row) => ({
    revenue: sum.revenue + (n(row, "revenue") ?? 0),
    conversions: sum.conversions + (n(row, "conversions") ?? 0),
    delivered: sum.delivered + (n(row, "delivered") ?? 0),
    opens: sum.opens + (n(row, "opens_unique") ?? 0),
    clicks: sum.clicks + (n(row, "clicks_unique") ?? 0),
    unsubscribes: sum.unsubscribes + (n(row, "unsubscribes") ?? 0),
  }), { revenue: 0, conversions: 0, delivered: 0, opens: 0, clicks: 0, unsubscribes: 0 });
}

function groupKlaviyoEntities(rows: Row[]) {
  const grouped = new Map<string, Row>();
  for (const row of rows) {
    const key = `${str(row.entity_type)}:${str(row.entity_id) || str(row.entity_name)}`;
    const existing = grouped.get(key) ?? { ...row, revenue: 0, conversions: 0, recipients: 0, delivered: 0, opens_unique: 0, clicks_unique: 0, unsubscribes: 0, bounced: 0, spam_complaints: 0 };
    existing.revenue = (n(existing, "revenue") ?? 0) + (n(row, "revenue") ?? 0);
    existing.conversions = (n(existing, "conversions") ?? 0) + (n(row, "conversions") ?? 0);
    for (const field of ["recipients", "delivered", "opens_unique", "clicks_unique", "unsubscribes", "bounced", "spam_complaints"]) {
      existing[field] = (n(existing, field) ?? 0) + (n(row, field) ?? 0);
    }
    grouped.set(key, existing);
  }
  return [...grouped.values()];
}

export function buildLiveReportDocument(input: {
  templateId: ReportTemplateId;
  organizationName: string;
  storeName: string;
  currencyCode: string;
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  generatedAt: string;
  data: ReportDataSets;
  sourceStatus: Record<string, { status: "available" | "partial" | "unavailable"; detail: string }>;
  analysis?: ReportAnalysis;
  preparedBy?: string;
}): ReportDocument {
  const template = getReportTemplate(input.templateId);
  if (!template) throw new Error("Unknown report template");
  const d = input.data;
  const sales = d.shopify;
  const previous = d.previousShopify;
  const finance = d.finance;
  const customer = d.customer;
  const meta = d.meta;
  const previousFinance = d.previousFinance;
  const previousMeta = d.previousMeta;
  const klaviyoCurrency = d.klaviyoCurrencyCode ?? input.currencyCode;
  const email = klaviyoTotals(d.klaviyo ?? []);
  const previousEmail = d.previousKlaviyo ? klaviyoTotals(d.previousKlaviyo) : null;
  const rate = (part: number, total: number) => total > 0 ? (part / total) * 100 : null;
  const emailOpenRate = rate(email.opens, email.delivered);
  const emailClickRate = rate(email.clicks, email.delivered);
  const emailUnsubscribeRate = rate(email.unsubscribes, email.delivered);
  const sections: ReportSection[] = [];
  const salesSection = (title = "Ventas observadas en Shopify") => metrics(title, [
    m("Ventas netas", n(sales, "net_sales"), "currency", n(previous, "net_sales")),
    m("Ventas brutas", n(sales, "gross_sales"), "currency", n(previous, "gross_sales")),
    m("Pedidos", n(sales, "orders_count"), "number", n(previous, "orders_count")),
    m("Ticket medio", n(sales, "aov"), "currency", n(previous, "aov")),
    m("Descuentos", n(sales, "discounts"), "currency", n(previous, "discounts")),
    m("Reembolsos", n(sales, "refunds"), "currency", n(previous, "refunds")),
  ]);
  const metaSection = (title = "Resultados atribuidos por Meta") => metrics(title, [
    m("Inversión", n(meta, "spend", "amount_spent"), "currency", n(previousMeta, "spend", "amount_spent"), d.metaCurrencyCode),
    m("Valor de compra atribuido", n(meta, "purchase_value", "value", "conversion_value"), "currency", n(previousMeta, "purchase_value", "value", "conversion_value"), d.metaCurrencyCode),
    m("ROAS atribuido", n(meta, "roas"), "ratio", n(previousMeta, "roas")),
    m("Compras atribuidas", n(meta, "purchases", "conversions"), "number", n(previousMeta, "purchases", "conversions")),
    m("CAC atribuido", n(meta, "cac"), "currency", n(previousMeta, "cac"), d.metaCurrencyCode),
    m("Impresiones", n(meta, "impressions"), "number", n(previousMeta, "impressions")),
  ]);
  const emailSection = (title = "Rendimiento atribuido por Klaviyo") => metrics(title, [
    m("Ingresos atribuidos", email.revenue, "currency", previousEmail?.revenue, klaviyoCurrency),
    m("Conversiones atribuidas", email.conversions, "number", previousEmail?.conversions),
    m("Entregados", email.delivered, "number", previousEmail?.delivered),
    m("Tasa de apertura", emailOpenRate, "percent", previousEmail ? rate(previousEmail.opens, previousEmail.delivered) : undefined),
    m("Tasa de clic", emailClickRate, "percent", previousEmail ? rate(previousEmail.clicks, previousEmail.delivered) : undefined),
    m("Tasa de baja", emailUnsubscribeRate, "percent", previousEmail ? rate(previousEmail.unsubscribes, previousEmail.delivered) : undefined),
  ]);
  const salesTrend = () => trend("Ventas netas por día · Shopify", "currency", d.salesDaily, "bucket_date", (row) => n(row, "net_sales") ?? 0, input.currencyCode, d.previousSalesDaily);
  const adsWarning = () => d.adsCurrencyWarning ? note("Moneda de la inversión publicitaria", d.adsCurrencyWarning, "warning") : null;
  const push = (...items: Array<ReportSection | null>) => { for (const item of items) if (item) sections.push(item); };
  const metaCampaignTable = () => table("Desglose de campañas Meta", [{ key: "name", label: "Campaña", width: 2 }, { key: "spend", label: "Inversión", align: "right", width: 1 }, { key: "purchases", label: "Compras", align: "right", width: 0.7 }, { key: "clicks", label: "Clics", align: "right", width: 0.7 }, { key: "roas", label: "ROAS", align: "right", width: 0.7 }], (d.metaCampaigns ?? []).slice(0, 8).map((row) => ({ name: str(row.campaign_name ?? row.name) || "Campaña", spend: money(n(row, "spend"), d.metaCurrencyCode ?? input.currencyCode), purchases: n(row, "purchases"), clicks: n(row, "clicks"), roas: n(row, "roas") === null ? "—" : `${n(row, "roas")?.toFixed(2)}×` })));
  const emailEntityTable = () => table("Desglose de campañas y flows", [{ key: "name", label: "Envío", width: 1.8 }, { key: "type", label: "Tipo", width: 0.6 }, { key: "revenue", label: "Ingresos", align: "right", width: 1 }, { key: "conversions", label: "Conversiones", align: "right", width: 0.8 }, { key: "delivered", label: "Entregados", align: "right", width: 0.8 }], groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 8).map((row) => ({ name: str(row.entity_name) || "Sin nombre", type: str(row.entity_type) === "flow" ? "Flow" : "Campaña", revenue: money(n(row, "revenue"), klaviyoCurrency), conversions: n(row, "conversions"), delivered: n(row, "delivered") })));
  const productDetailTable = () => table("Productos destacados", [{ key: "name", label: "Producto", width: 1.9 }, { key: "units", label: "Unidades", align: "right", width: 0.8 }, { key: "revenue", label: "Ventas", align: "right", width: 1.1 }, { key: "exact", label: "Exactas", align: "right", width: 0.7 }, { key: "estimated", label: "Estimadas", align: "right", width: 0.8 }, { key: "missing", label: "Sin dato", align: "right", width: 0.7 }], (d.products ?? []).slice(0, 8).map((row) => ({ name: str(row.title) || "Producto", units: n(row, "quantity_sold"), revenue: money(n(row, "revenue"), input.currencyCode), exact: n(row, "lines_with_exact_metrics"), estimated: n(row, "lines_with_estimated_metrics"), missing: n(row, "lines_without_metrics") })));

  if (input.templateId === "shopify_comercial") {
    sections.push(salesSection());
    push(salesTrend());
    const productRows = (d.products ?? []).slice(0, 8);
    const productChart = chart("Ventas por producto destacado", "currency", productRows.slice(0, 6).map((row) => ({ label: str(row.title) || "Producto", value: n(row, "revenue") })), input.currencyCode);
    if (productChart) sections.push(productChart);
    sections.push(table("Detalle por producto", [{ key: "product", label: "Producto", width: 2.1 }, { key: "units", label: "Unidades", align: "right", width: 0.8 }, { key: "revenue", label: "Ventas", align: "right", width: 1.2 }, { key: "share", label: "% del top", align: "right", width: 0.8 }, { key: "exact", label: "Líneas exactas", align: "right", width: 1 }, { key: "estimated", label: "Estimadas", align: "right", width: 0.8 }], productRows.map((row) => {
      const revenue = n(row, "revenue");
      const total = productRows.reduce((sum, item) => sum + (n(item, "revenue") ?? 0), 0);
      return { product: str(row.title) || "Producto", units: n(row, "quantity_sold") ?? "—", revenue: money(revenue, input.currencyCode), share: revenue !== null && total > 0 ? `${(revenue / total * 100).toFixed(1)} %` : "—", exact: n(row, "lines_with_exact_metrics") ?? "—", estimated: n(row, "lines_with_estimated_metrics") ?? "—" };
    })));
    sections.push(note("Cobertura", "Las métricas y productos se calculan con datos de Shopify sincronizados para el periodo solicitado."));
  } else if (input.templateId === "shopify_rentabilidad") {
    push(adsWarning());
    sections.push(metrics("Cuenta de resultados", [
      m("Ingresos netos sin IVA", n(finance, "net_revenue_ex_tax", "net_sales"), "currency", n(previousFinance, "net_revenue_ex_tax", "net_sales")),
      m("Coste de producto (COGS)", n(finance, "cogs", "total_cogs"), "currency", n(previousFinance, "cogs", "total_cogs")),
      m("Margen bruto", n(finance, "gross_margin"), "currency", n(previousFinance, "gross_margin")),
      m("Comisiones de pago", n(finance, "payment_fees"), "currency", n(previousFinance, "payment_fees")),
      m("Coste de envío", n(finance, "shipping_costs"), "currency", n(previousFinance, "shipping_costs")),
      m("Costes fijos", n(finance, "fixed_costs"), "currency", n(previousFinance, "fixed_costs")),
      m("Inversión publicitaria", n(finance, "ads_spend"), "currency", n(previousFinance, "ads_spend")),
      m("Beneficio neto", n(finance, "net_profit"), "currency", n(previousFinance, "net_profit")),
      m("Margen neto", n(finance, "net_margin_pct"), "percent", n(previousFinance, "net_margin_pct")),
    ]));
    const pnlChart = chart("Componentes del resultado", "currency", [
      { label: "Ingresos netos", value: n(finance, "net_revenue_ex_tax", "net_sales") },
      { label: "COGS", value: n(finance, "cogs", "total_cogs") },
      { label: "Margen bruto", value: n(finance, "gross_margin") },
      { label: "Comisiones", value: n(finance, "payment_fees") },
      { label: "Envíos", value: n(finance, "shipping_costs") },
      { label: "Costes fijos", value: n(finance, "fixed_costs") },
      { label: "Publicidad", value: n(finance, "ads_spend") },
      { label: "Beneficio neto", value: n(finance, "net_profit") },
    ]);
    if (pnlChart) sections.push(pnlChart);
    push(salesTrend());
    sections.push(table("Desglose financiero", [{ key: "concept", label: "Concepto", width: 2.2 }, { key: "amount", label: "Importe", align: "right", width: 1.2 }, { key: "detail", label: "Detalle", width: 1.4 }], [
      { concept: "Ingresos netos sin IVA", amount: money(n(finance, "net_revenue_ex_tax"), input.currencyCode), detail: "Base para beneficio" },
      { concept: "Impuestos cobrados", amount: money(n(finance, "tax_collected"), input.currencyCode), detail: "Informativo; no ingreso" },
      { concept: "Envío cobrado al cliente", amount: money(n(finance, "shipping_charged"), input.currencyCode), detail: "Shopify" },
      { concept: "Coste real de envío", amount: money(n(finance, "shipping_costs"), input.currencyCode), detail: "Configuración financiera" },
      { concept: "Costes fijos mensuales", amount: money(n(finance, "monthly_fixed_costs"), input.currencyCode), detail: `${n(finance, "fixed_expenses_count") ?? "Sin dato"} conceptos` },
      { concept: "Punto de equilibrio", amount: money(n(finance, "break_even_monthly_revenue"), input.currencyCode), detail: "Estimación mensual" },
      { concept: "Artículos sin coste", amount: n(finance, "items_without_cost"), detail: "Cobertura de COGS" },
      { concept: "CAC de equilibrio / pedido", amount: money(n(finance, "breakeven_cac_per_order"), input.currencyCode), detail: "Techo estimado" },
    ]));
    const missingCosts = finance?.has_settings === false || (n(finance, "items_without_cost") ?? 0) > 0;
    sections.push(missingCosts
      ? note("Cobertura financiera", `El beneficio es parcial: ${finance?.has_settings === false ? "falta la configuración de costes de la tienda (pasarela y envío)" : `${n(finance, "items_without_cost")} artículos vendidos no tienen coste de producto`}. Complétalo en Configuración › Costes para que la cifra sea fiable.`, "warning")
      : note("Cobertura financiera", "Costes de producto y configuración financiera completos para el periodo."));
  } else if (input.templateId === "shopify_clientes") {
    sections.push(metrics("Clientes y recompra · historial sincronizado", [
      m("Clientes identificados", n(customer, "customers", "customers_count", "customer_count", "total_customers"), "number"),
      m("Pedidos con cliente", n(customer, "orders_with_customer"), "number"),
      m("Pedidos de invitado", n(customer, "guest_orders"), "number"),
      m("Pedidos por cliente", n(customer, "avg_orders_per_customer"), "number", undefined, undefined, 2),
      m("Ingreso medio por cliente", n(customer, "avg_revenue_per_customer"), "currency"),
      m("Mediana de ingreso por cliente", n(customer, "median_revenue_per_customer"), "currency"),
    ]));
    const cohortRows = d.cohorts ?? [];
    const retentionChart = chart("Clientes que repiten al mes siguiente de su primera compra", "percent", [...new Set(cohortRows.map((row) => str(row.cohort_month).slice(0, 7)))].sort().slice(-8).map((cohort) => {
      const row = cohortRows.find((item) => str(item.cohort_month).startsWith(cohort) && n(item, "month_offset") === 1);
      const size = n(row, "cohort_customers") ?? 0;
      return { label: cohort, value: row && size > 0 ? ((n(row, "customers") ?? 0) / size) * 100 : null };
    }));
    if (retentionChart) sections.push(retentionChart);
    sections.push(cohortTriangle(cohortRows));
    sections.push(note("Límite de identificación", "La base de clientes resume el historial sincronizado; cohortes muestran retención por mes de alta. Los pedidos de invitado no se atribuyen a un cliente.", "warning"));
  } else if (input.templateId === "meta_publicidad") {
    sections.push(metaSection());
    push(trend("Inversión diaria en Meta", "currency", d.metaDaily, "bucket_date", (row) => n(row, "spend") ?? 0, d.metaCurrencyCode ?? input.currencyCode));
    sections.push(table("Campañas con mayor inversión", [{ key: "campaign_name", label: "Campaña", width: 2.2 }, { key: "spend", label: "Inversión", align: "right", width: 1.3 }, { key: "purchases", label: "Compras", align: "right", width: 1 }, { key: "roas", label: "ROAS", align: "right", width: 0.8 }], (d.metaCampaigns ?? []).slice(0, 8).map((row) => ({ campaign_name: str(row.campaign_name ?? row.name) || "Campaña", spend: new Intl.NumberFormat("es-ES", { style: "currency", currency: d.metaCurrencyCode ?? input.currencyCode, maximumFractionDigits: 0 }).format(n(row, "spend") ?? 0), purchases: n(row, "purchases") ?? 0, roas: n(row, "roas") === null ? "—" : `${n(row, "roas")?.toFixed(2)}×` }))));
    const metaRoasChart = chart("ROAS por campaña", "ratio", (d.metaCampaigns ?? []).slice(0, 8).map((row) => ({ label: str(row.campaign_name ?? row.name) || "Campaña", value: n(row, "roas") })));
    if (metaRoasChart) sections.push(metaRoasChart);
    sections.push(table("Entrega y tráfico por campaña", [{ key: "name", label: "Campaña", width: 2.1 }, { key: "impressions", label: "Impresiones", align: "right", width: 1 }, { key: "clicks", label: "Clics", align: "right", width: 0.7 }, { key: "ctr", label: "CTR", align: "right", width: 0.7 }, { key: "days", label: "Días", align: "right", width: 0.6 }], (d.metaCampaigns ?? []).slice(0, 8).map((row) => {
      const impressions = n(row, "impressions");
      const clicks = n(row, "clicks");
      return { name: str(row.campaign_name ?? row.name) || "Campaña", impressions: impressions ?? "—", clicks: clicks ?? "—", ctr: impressions && clicks !== null ? `${(clicks / impressions * 100).toFixed(2)} %` : "—", days: n(row, "days_with_data") ?? "—" };
    })));
    sections.push(note("Atribución", "Las compras y el valor son atribuciones reportadas por Meta; no equivalen a ventas incrementales ni a ventas confirmadas por Shopify.", "warning"));
  } else if (input.templateId === "klaviyo_email") {
    sections.push(emailSection());
    push(trend("Ingresos atribuidos por día · Klaviyo", "currency", d.klaviyoDaily, "day", (row) => (n(row, "flow_revenue") ?? 0) + (n(row, "campaign_revenue") ?? 0), klaviyoCurrency));
    sections.push(table("Campañas y automatizaciones", [{ key: "entity_name", label: "Envío", width: 2.4 }, { key: "entity_type", label: "Tipo", width: 0.8 }, { key: "revenue", label: "Ingresos atribuidos", align: "right", width: 1.4 }, { key: "conversions", label: "Conversiones", align: "right", width: 1 }], groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 8).map((row) => ({ entity_name: str(row.entity_name) || "Sin nombre", entity_type: str(row.entity_type) === "flow" ? "Flow" : "Campaña", revenue: money(n(row, "revenue") ?? 0, klaviyoCurrency), conversions: n(row, "conversions") ?? 0 }))));
    const klaviyoEntities = groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0));
    const emailChart = chart("Ingresos atribuidos por envío", "currency", klaviyoEntities.slice(0, 8).map((row) => ({ label: str(row.entity_name) || "Sin nombre", value: n(row, "revenue") })), klaviyoCurrency);
    if (emailChart) sections.push(emailChart);
    sections.push(table("Entregabilidad y respuesta", [{ key: "name", label: "Envío", width: 1.8 }, { key: "type", label: "Tipo", width: 0.6 }, { key: "delivered", label: "Entregados", align: "right", width: 0.8 }, { key: "open", label: "Apertura", align: "right", width: 0.7 }, { key: "click", label: "Clic", align: "right", width: 0.6 }, { key: "bounce", label: "Rebote", align: "right", width: 0.7 }], klaviyoEntities.slice(0, 8).map((row) => {
      const delivered = n(row, "delivered") ?? 0;
      const rate = (key: string) => delivered > 0 ? `${((n(row, key) ?? 0) / delivered * 100).toFixed(2)} %` : "—";
      return { name: str(row.entity_name) || "Sin nombre", type: str(row.entity_type) === "flow" ? "Flow" : "Campaña", delivered, open: rate("opens_unique"), click: rate("clicks_unique"), bounce: rate("bounced") };
    })));
    sections.push(note("Atribución", "Ingresos y conversiones atribuidos por Klaviyo. No equivalen a ventas incrementales; las aperturas pueden verse afectadas por protecciones de privacidad.", "warning"));
  } else if (input.templateId === "adquisicion_multicanal") {
    sections.push(salesSection("Shopify · ventas observadas"));
    sections.push(metaSection("Meta Ads · atribución de plataforma"));
    sections.push(emailSection("Klaviyo · atribución de plataforma"));
    const metaChannelChart = chart("Meta · ROAS de campañas", "ratio", (d.metaCampaigns ?? []).slice(0, 6).map((row) => ({ label: str(row.campaign_name ?? row.name) || "Campaña", value: n(row, "roas") })));
    const klaviyoChannelChart = chart("Klaviyo · ingresos atribuidos", "currency", groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 6).map((row) => ({ label: str(row.entity_name) || "Sin nombre", value: n(row, "revenue") })), klaviyoCurrency);
    push(salesTrend());
    if (metaChannelChart) sections.push(metaChannelChart);
    if (klaviyoChannelChart) sections.push(klaviyoChannelChart);
    sections.push(productDetailTable(), metaCampaignTable(), emailEntityTable());
    sections.push(note("No sumar atribuciones", "Shopify muestra ventas observadas. Meta y Klaviyo aplican modelos de atribución distintos y pueden atribuir la misma compra. Sus valores se mantienen separados.", "warning"));
  } else {
    sections.push(salesSection("Ventas observadas · Shopify"));
    sections.push(metrics("Rentabilidad estimada · Shopify", [
      m("Ingresos netos sin IVA", n(finance, "net_revenue_ex_tax", "net_sales"), "currency", n(previousFinance, "net_revenue_ex_tax", "net_sales")),
      m("Margen bruto", n(finance, "gross_margin"), "currency", n(previousFinance, "gross_margin")),
      m("Beneficio neto", n(finance, "net_profit"), "currency", n(previousFinance, "net_profit")),
      m("Margen neto", n(finance, "net_margin_pct"), "percent", n(previousFinance, "net_margin_pct")),
    ]));
    sections.push(metaSection("Publicidad · datos atribuidos por Meta"));
    sections.push(emailSection("Email · datos atribuidos por Klaviyo"));
    const executiveMetaChart = chart("Meta · ROAS de campañas", "ratio", (d.metaCampaigns ?? []).slice(0, 6).map((row) => ({ label: str(row.campaign_name ?? row.name) || "Campaña", value: n(row, "roas") })));
    const executiveEmailChart = chart("Klaviyo · ingresos atribuidos", "currency", groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 6).map((row) => ({ label: str(row.entity_name) || "Sin nombre", value: n(row, "revenue") })), klaviyoCurrency);
    push(salesTrend(), adsWarning());
    if (executiveMetaChart) sections.push(executiveMetaChart);
    if (executiveEmailChart) sections.push(executiveEmailChart);
    sections.push(productDetailTable(), metaCampaignTable(), emailEntityTable());
    sections.push(note("Lectura ejecutiva", "Las ventas observadas de Shopify y los resultados atribuidos de Meta y Klaviyo se muestran por separado. El beneficio depende de la cobertura de costes configurada.", "warning"));
  }

  // Abre el informe: primero la lectura del copiloto (si la hay), luego los
  // cambios más grandes frente al periodo anterior, calculados aquí.
  const changes = keyChanges(sections, input.currencyCode);
  const opening: ReportSection[] = [];
  if (input.analysis?.highlights.length) {
    opening.push({ kind: "summary", title: "Lectura del periodo", points: input.analysis.highlights, author: "copilot" });
  }
  if (input.analysis?.recommendations.length) {
    opening.push({ kind: "summary", title: "Recomendaciones", points: input.analysis.recommendations, author: "copilot" });
  }
  if (changes.length) opening.push({ kind: "summary", title: "Cambios principales frente al periodo anterior", points: changes, author: "data" });
  sections.unshift(...opening);

  const sources = template.applications.map((provider) => {
    const state = input.sourceStatus[provider] ?? { status: "unavailable" as const, detail: "La fuente no devolvió datos para este periodo." };
    return { provider, ...state, asOf: input.generatedAt };
  });
  return {
    templateId: input.templateId,
    templateVersion: template.version,
    title: template.name,
    subtitle: template.description,
    organizationName: input.organizationName,
    storeName: input.storeName,
    currencyCode: input.currencyCode,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    previousPeriodStart: input.previousPeriodStart,
    previousPeriodEnd: input.previousPeriodEnd,
    generatedAt: input.generatedAt,
    sample: false,
    ...(input.preparedBy ? { preparedBy: input.preparedBy } : {}),
    sections,
    sources,
  };
}

function metricSections(sections: ReportSection[]) {
  return sections.flatMap((section) => section.kind === "metrics" ? section.metrics.map((metric) => ({ section: section.title, metric })) : []);
}

/** Las 4 variaciones más grandes, en frase. Sin juicio: subir no siempre es bueno (reembolsos, CAC). */
function keyChanges(sections: ReportSection[], currencyCode: string): string[] {
  const seen = new Set<string>();
  return metricSections(sections)
    .map(({ metric }) => ({ metric, change: metricChangePct(metric) }))
    .filter((item): item is { metric: ReportMetric; change: number } => item.change !== null && Math.abs(item.change) >= 1)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .filter(({ metric }) => !seen.has(metric.label) && Boolean(seen.add(metric.label)))
    .slice(0, 4)
    .map(({ metric, change }) => {
      const previous = formatReportMetric({ ...metric, value: metric.previous ?? null }, currencyCode);
      const pct = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, signDisplay: "always" }).format(change);
      return `${metric.label}: ${formatReportMetric(metric, currencyCode)} frente a ${previous} (${pct} %).`;
    });
}

/**
 * Cifras del informe para el copiloto: con ellas redacta la lectura y la
 * confirmación en el chat sin inventar números. Solo indicadores, no tablas.
 */
export function reportDigest(report: ReportDocument) {
  return metricSections(report.sections).slice(0, 30).map(({ section, metric }) => {
    const change = metricChangePct(metric);
    return {
      section,
      label: metric.label,
      value: formatReportMetric(metric, report.currencyCode),
      previous: metric.previous === undefined || metric.previous === null ? null : formatReportMetric({ ...metric, value: metric.previous }, report.currencyCode),
      change_pct: change === null ? null : Math.round(change * 10) / 10,
    };
  });
}

// Datos sintéticos deterministas: ondulación semanal suave alrededor de una media.
function sampleDaily(month: string, mean: number, key: string, dateKey = "bucket_date"): Row[] {
  return Array.from({ length: 30 }, (_, index) => ({ [dateKey]: `${month}-${String(index + 1).padStart(2, "0")}`, [key]: Math.round(mean * (1 + 0.25 * Math.sin(index / 1.1) + index / 120)) }));
}

function sampleCohorts(): Row[] {
  return ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"].flatMap((cohort, index) => {
    const size = 180 + index * 9;
    return Array.from({ length: 6 - index }, (_, offset) => ({ cohort_month: `${cohort}-01`, cohort_customers: size, month_offset: offset + 1, customers: Math.round(size * (0.42 - offset * 0.05)), orders: 0, revenue: 0 }));
  });
}

export function buildSampleReportDocument(templateId: ReportTemplateId): ReportDocument {
  const generatedAt = "2026-10-05T09:00:00.000Z";
  const report = buildLiveReportDocument({
    templateId,
    organizationName: "Tienda de muestra · E-NORA Demo",
    storeName: "Casa Nómada",
    currencyCode: "EUR",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    previousPeriodStart: "2026-08-01",
    previousPeriodEnd: "2026-08-31",
    generatedAt,
    data: {
      shopify: { net_sales: 115980.2, gross_sales: 128430.52, orders_count: 1842, aov: 62.97, discounts: 4235.6, refunds: 2140.3 },
      previousShopify: { net_sales: 102450.7, gross_sales: 112350.9, orders_count: 1690, aov: 60.62, discounts: 3900, refunds: 1880 },
      finance: { net_revenue_ex_tax: 96240, tax_collected: 20150, cogs: 42180, gross_margin: 54060, payment_fees: 4200, shipping_costs: 8480, shipping_charged: 5940, fixed_costs: 2300, monthly_fixed_costs: 2300, fixed_expenses_count: 3, ads_spend: 18420, net_profit: 28640, net_margin_pct: 29.8, break_even_monthly_revenue: 68450, breakeven_cac_per_order: 15.54, has_settings: true, items_without_cost: 0 },
      customer: { customers: 2481, orders_with_customer: 6978, guest_orders: 812, avg_orders_per_customer: 2.81, avg_revenue_per_customer: 174.8, median_revenue_per_customer: 128.4 },
      cohorts: sampleCohorts(),
      salesDaily: sampleDaily("2026-09", 3866, "net_sales"),
      previousSalesDaily: sampleDaily("2026-08", 3415, "net_sales"),
      metaDaily: sampleDaily("2026-09", 614, "spend"),
      klaviyoDaily: sampleDaily("2026-09", 400, "flow_revenue", "day"),
      products: [
        { title: "Bolso Nómada", quantity_sold: 326, revenue: 19840, lines_with_exact_metrics: 42, lines_with_estimated_metrics: 0, lines_without_metrics: 0 },
        { title: "Lámpara Alba", quantity_sold: 281, revenue: 16280, lines_with_exact_metrics: 35, lines_with_estimated_metrics: 1, lines_without_metrics: 0 },
        { title: "Vela Costa", quantity_sold: 240, revenue: 8460, lines_with_exact_metrics: 29, lines_with_estimated_metrics: 0, lines_without_metrics: 0 },
        { title: "Jarra Bruma", quantity_sold: 174, revenue: 7120, lines_with_exact_metrics: 21, lines_with_estimated_metrics: 0, lines_without_metrics: 0 },
      ],
      meta: { spend: 18420, purchase_value: 83940, roas: 4.56, purchases: 1518, cac: 12.13, impressions: 1284900, days_with_data: 30 },
      metaCurrencyCode: "EUR",
      metaCampaigns: [
        { campaign_name: "Prospección · Catálogo", spend: 6840, impressions: 420000, clicks: 9810, purchases: 582, roas: 4.8, days_with_data: 30 },
        { campaign_name: "Remarketing · 30 días", spend: 4210, impressions: 284000, clicks: 8250, purchases: 492, roas: 6.1, days_with_data: 30 },
        { campaign_name: "UGC · Colección otoño", spend: 3780, impressions: 310000, clicks: 6940, purchases: 301, roas: 3.6, days_with_data: 28 },
      ],
      klaviyo: [
        { entity_id: "welcome", entity_type: "flow", entity_name: "Bienvenida · Email 1", revenue: 9840, conversions: 402, delivered: 120000, opens_unique: 50400, clicks_unique: 4100, unsubscribes: 220, bounced: 240 },
        { entity_id: "autumn", entity_type: "campaign", entity_name: "Novedades de otoño", revenue: 7210, conversions: 285, delivered: 160000, opens_unique: 67200, clicks_unique: 5472, unsubscribes: 304, bounced: 320 },
        { entity_id: "cart", entity_type: "flow", entity_name: "Carrito abandonado · Email 2", revenue: 6940, conversions: 244, delivered: 92000, opens_unique: 38640, clicks_unique: 3128, unsubscribes: 175, bounced: 184 },
      ],
    },
    sourceStatus: {
      Shopify: { status: "available", detail: "Datos sintéticos para previsualización. No pertenecen a una tienda real." },
      "Meta Ads": { status: "available", detail: "Datos sintéticos; importes ilustrativos expresados en EUR." },
      Klaviyo: { status: "available", detail: "Datos sintéticos; atribución solo ilustrativa." },
    },
    preparedBy: "Consultora de ejemplo",
    analysis: {
      highlights: ["Aquí va la lectura del copiloto: 3–5 conclusiones, cada una con la cifra del informe que la respalda.", "Si una fuente llega parcial o sin datos, lo dice en vez de interpretar ceros."],
      recommendations: ["Y aquí, 1–3 acciones concretas para el próximo periodo."],
    },
  });
  return { ...report, sample: true };
}

const TIER_LABEL: Record<string, string> = { pierde: "Pierde dinero", datos: "Datos incompletos", bajo: "Margen bajo", ok: "En objetivo" };

type PortfolioClient = {
  name: string;
  currency_code: string | null;
  revenue: number | null;
  net_profit: number | null;
  margin_pct: number | null;
  margin_target: number | null;
  revenue_change_pct: number | null;
  tier: string;
};

/**
 * Informe de cartera del consultor: una página por toda su cartera, con los
 * totales y el estado de cada cliente del Panel de rentabilidad. No recalcula:
 * recibe lo mismo que pinta /panel. Los clientes en otra moneda no suman.
 */
export function buildPortfolioReportDocument(input: {
  consultoraName: string;
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  generatedAt: string;
  totals: {
    currency_code: string | null;
    stores_excluded: number;
    revenue: number;
    net_profit: number;
    margin_pct: number;
    orders: number;
    aov: number;
    ads_spend: number;
    prev_revenue: number | null;
    prev_profit: number | null;
    orders_change_pct: number | null;
    aov_change_pct: number | null;
    counts: { clients: number; pierde: number; datos: number; bajo: number; ok: number; over_cac: number };
  };
  clients: PortfolioClient[];
  monthly: Array<{ month: string; revenue: number; profit: number }>;
  failedStores: number;
}): ReportDocument {
  const { totals } = input;
  const currency = totals.currency_code ?? "EUR";
  // El Panel da la variación de pedidos y ticket, no el valor anterior: se reconstruye.
  const fromChange = (value: number, change: number | null) => change === null || change <= -100 ? undefined : value / (1 + change / 100);
  const sections: ReportSection[] = [
    metrics("Cartera · resultados del periodo", [
      m("Facturación sin IVA", totals.revenue, "currency", totals.prev_revenue),
      m("Beneficio neto", totals.net_profit, "currency", totals.prev_profit),
      m("Margen neto", totals.margin_pct, "percent"),
      m("Pedidos", totals.orders, "number", fromChange(totals.orders, totals.orders_change_pct)),
      m("Ticket medio", totals.aov, "currency", fromChange(totals.aov, totals.aov_change_pct)),
      m("Inversión publicitaria", totals.ads_spend, "currency"),
    ]),
  ];
  sections.push(table("Clientes", [
    { key: "name", label: "Cliente", width: 1.8 },
    { key: "revenue", label: "Facturación", align: "right", width: 1.1 },
    { key: "profit", label: "Beneficio", align: "right", width: 1.1 },
    { key: "margin", label: "Margen", align: "right", width: 0.7 },
    { key: "target", label: "Objetivo", align: "right", width: 0.7 },
    { key: "change", label: "Δ fact.", align: "right", width: 0.7 },
    { key: "tier", label: "Estado", width: 1.1 },
  ], input.clients.map((client) => {
    const code = client.currency_code ?? currency;
    const pct = (value: number | null) => value === null ? "—" : `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)} %`;
    return {
      name: client.name,
      revenue: client.currency_code ? money(client.revenue, code) : "Varias monedas",
      profit: client.currency_code ? money(client.net_profit, code) : "—",
      margin: pct(client.margin_pct),
      target: pct(client.margin_target),
      change: client.revenue_change_pct === null ? "—" : `${client.revenue_change_pct > 0 ? "+" : ""}${pct(client.revenue_change_pct)}`,
      tier: TIER_LABEL[client.tier] ?? client.tier,
    };
  })));
  sections.push(
    metrics("Estado de los clientes", [
      m("Clientes", totals.counts.clients, "number"),
      m("Pierden dinero", totals.counts.pierde, "number"),
      m("Margen bajo", totals.counts.bajo, "number"),
      m("Datos incompletos", totals.counts.datos, "number"),
      m("En objetivo", totals.counts.ok, "number"),
      m("Por encima del CAC objetivo", totals.counts.over_cac, "number"),
    ]),
  );
  const sameCurrency = input.clients.filter((client) => client.currency_code === totals.currency_code);
  const profitChart = chart("Beneficio neto por cliente", "currency", [...sameCurrency].sort((a, b) => (b.net_profit ?? 0) - (a.net_profit ?? 0)).slice(0, 12).map((client) => ({ label: client.name, value: client.net_profit })), currency);
  if (profitChart) sections.push(profitChart);
  const monthlyChart = chart("Beneficio de la cartera por mes", "currency", input.monthly.slice(-6).map((row) => ({ label: row.month.slice(0, 7), value: row.profit })), currency);
  if (monthlyChart) sections.push(monthlyChart);
  const caveats = [
    totals.stores_excluded > 0 ? `${totals.stores_excluded === 1 ? "1 tienda factura" : `${totals.stores_excluded} tiendas facturan`} en otra moneda y no suman en los totales (sí aparecen en la tabla con su moneda).` : null,
    input.failedStores > 0 ? `${input.failedStores === 1 ? "1 tienda no se pudo leer y queda" : `${input.failedStores} tiendas no se pudieron leer y quedan`} fuera del informe.` : null,
    "El beneficio de un cliente con «Datos incompletos» no es fiable hasta completar sus costes.",
  ].filter((text): text is string => Boolean(text));
  sections.push(note("Cómo leer la cartera", caveats.join(" "), totals.stores_excluded > 0 || input.failedStores > 0 ? "warning" : "info"));

  const changes = keyChanges(sections, currency);
  if (changes.length) sections.unshift({ kind: "summary", title: "Cambios principales frente al periodo anterior", points: changes, author: "data" });
  return {
    templateId: "cartera",
    templateVersion: "v1",
    title: "Informe de cartera",
    subtitle: "Facturación, beneficio y estado de cada cliente, con las mismas cifras que el Panel de rentabilidad.",
    organizationName: input.consultoraName,
    storeName: `${totals.counts.clients} clientes`,
    currencyCode: currency,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    previousPeriodStart: input.previousPeriodStart,
    previousPeriodEnd: input.previousPeriodEnd,
    generatedAt: input.generatedAt,
    sample: false,
    preparedBy: input.consultoraName,
    sections,
    sources: [{ provider: "Shopify", status: input.failedStores > 0 ? "partial" : "available", detail: "Pedidos sincronizados y costes configurados de cada cliente (motor financiero del Panel).", asOf: input.generatedAt }],
  };
}
