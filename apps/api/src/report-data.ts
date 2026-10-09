import {
  getReportTemplate,
  type ReportDocument,
  type ReportMetric,
  type ReportSection,
  type ReportTemplateId,
} from "./report-templates.js";

type Row = Record<string, unknown>;
export type ReportDataSets = {
  shopify?: Row;
  previousShopify?: Row;
  finance?: Row;
  customer?: Row;
  cohorts?: Row[];
  products?: Row[];
  meta?: Row;
  metaCurrencyCode?: string;
  campaigns?: Row[];
  metaCampaigns?: Row[];
  klaviyo?: Row[];
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
}): ReportDocument {
  const template = getReportTemplate(input.templateId);
  if (!template) throw new Error("Unknown report template");
  const d = input.data;
  const sales = d.shopify;
  const previous = d.previousShopify;
  const finance = d.finance;
  const customer = d.customer;
  const meta = d.meta;
  const email = klaviyoTotals(d.klaviyo ?? []);
  const emailOpenRate = email.delivered > 0 ? (email.opens / email.delivered) * 100 : null;
  const emailClickRate = email.delivered > 0 ? (email.clicks / email.delivered) * 100 : null;
  const emailUnsubscribeRate = email.delivered > 0 ? (email.unsubscribes / email.delivered) * 100 : null;
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
    m("Inversión", n(meta, "spend", "amount_spent"), "currency", undefined, d.metaCurrencyCode),
    m("Valor de compra atribuido", n(meta, "purchase_value", "value", "conversion_value"), "currency", undefined, d.metaCurrencyCode),
    m("ROAS atribuido", n(meta, "roas"), "ratio"),
    m("Compras atribuidas", n(meta, "purchases", "conversions"), "number"),
    m("CAC atribuido", n(meta, "cac"), "currency", undefined, d.metaCurrencyCode),
    m("Impresiones", n(meta, "impressions"), "number"),
  ]);
  const emailSection = (title = "Rendimiento atribuido por Klaviyo") => metrics(title, [
    m("Ingresos atribuidos", email.revenue, "currency"),
    m("Conversiones atribuidas", email.conversions, "number"),
    m("Entregados", email.delivered, "number"),
    m("Tasa de apertura", emailOpenRate, "percent"),
    m("Tasa de clic", emailClickRate, "percent"),
    m("Tasa de baja", emailUnsubscribeRate, "percent"),
  ]);
  const metaCampaignTable = () => table("Desglose de campañas Meta", [{ key: "name", label: "Campaña", width: 2 }, { key: "spend", label: "Inversión", align: "right", width: 1 }, { key: "purchases", label: "Compras", align: "right", width: 0.7 }, { key: "clicks", label: "Clics", align: "right", width: 0.7 }, { key: "roas", label: "ROAS", align: "right", width: 0.7 }], (d.metaCampaigns ?? []).slice(0, 8).map((row) => ({ name: str(row.campaign_name ?? row.name) || "Campaña", spend: money(n(row, "spend"), d.metaCurrencyCode ?? input.currencyCode), purchases: n(row, "purchases"), clicks: n(row, "clicks"), roas: n(row, "roas") === null ? "—" : `${n(row, "roas")?.toFixed(2)}×` })));
  const emailEntityTable = () => table("Desglose de campañas y flows", [{ key: "name", label: "Envío", width: 1.8 }, { key: "type", label: "Tipo", width: 0.6 }, { key: "revenue", label: "Ingresos", align: "right", width: 1 }, { key: "conversions", label: "Conversiones", align: "right", width: 0.8 }, { key: "delivered", label: "Entregados", align: "right", width: 0.8 }], groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 8).map((row) => ({ name: str(row.entity_name) || "Sin nombre", type: str(row.entity_type) === "flow" ? "Flow" : "Campaña", revenue: money(n(row, "revenue"), input.currencyCode), conversions: n(row, "conversions"), delivered: n(row, "delivered") })));
  const productDetailTable = () => table("Productos destacados", [{ key: "name", label: "Producto", width: 1.9 }, { key: "units", label: "Unidades", align: "right", width: 0.8 }, { key: "revenue", label: "Ventas", align: "right", width: 1.1 }, { key: "exact", label: "Exactas", align: "right", width: 0.7 }, { key: "estimated", label: "Estimadas", align: "right", width: 0.8 }, { key: "missing", label: "Sin dato", align: "right", width: 0.7 }], (d.products ?? []).slice(0, 8).map((row) => ({ name: str(row.title) || "Producto", units: n(row, "quantity_sold"), revenue: money(n(row, "revenue"), input.currencyCode), exact: n(row, "lines_with_exact_metrics"), estimated: n(row, "lines_with_estimated_metrics"), missing: n(row, "lines_without_metrics") })));

  if (input.templateId === "shopify_comercial") {
    sections.push(salesSection());
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
    sections.push(metrics("Cuenta de resultados", [
      m("Ingresos netos sin IVA", n(finance, "net_revenue_ex_tax", "net_sales"), "currency"),
      m("Coste de producto (COGS)", n(finance, "cogs", "total_cogs"), "currency"),
      m("Margen bruto", n(finance, "gross_margin"), "currency"),
      m("Comisiones de pago", n(finance, "payment_fees"), "currency"),
      m("Coste de envío", n(finance, "shipping_costs"), "currency"),
      m("Costes fijos", n(finance, "fixed_costs"), "currency"),
      m("Inversión publicitaria", n(finance, "ads_spend"), "currency"),
      m("Beneficio neto", n(finance, "net_profit"), "currency"),
      m("Margen neto", n(finance, "net_margin_pct"), "percent"),
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
    sections.push(note("Cobertura financiera", "Los valores disponibles dependen de los costes y la configuración financiera de la tienda. Sin datos de costes, la rentabilidad se considera parcial.", "warning"));
  } else if (input.templateId === "shopify_clientes") {
    sections.push(metrics("Clientes y recompra · historial sincronizado", [
      m("Clientes identificados", n(customer, "customers", "customers_count", "customer_count", "total_customers"), "number"),
      m("Pedidos con cliente", n(customer, "orders_with_customer"), "number"),
      m("Pedidos de invitado", n(customer, "guest_orders"), "number"),
      m("Pedidos por cliente", n(customer, "avg_orders_per_customer"), "number", undefined, undefined, 2),
      m("Ingreso medio por cliente", n(customer, "avg_revenue_per_customer"), "currency"),
      m("Mediana de ingreso por cliente", n(customer, "median_revenue_per_customer"), "currency"),
    ]));
    sections.push(table("Cohortes de clientes", [{ key: "cohort_month", label: "Cohorte", width: 1.1 }, { key: "cohort_customers", label: "Clientes", align: "right", width: 0.9 }, { key: "month_offset", label: "Mes", align: "right", width: 0.7 }, { key: "customers", label: "Activos", align: "right", width: 0.7 }, { key: "retention", label: "Retención", align: "right", width: 0.8 }, { key: "revenue", label: "Ingresos", align: "right", width: 1.2 }], (d.cohorts ?? []).slice(0, 12).map((row) => ({ cohort_month: str(row.cohort_month).slice(0, 7), cohort_customers: n(row, "cohort_customers") ?? "—", month_offset: n(row, "month_offset") ?? "—", customers: n(row, "customers") ?? "—", retention: (n(row, "cohort_customers") ?? 0) > 0 ? `${(((n(row, "customers") ?? 0) / (n(row, "cohort_customers") ?? 1)) * 100).toFixed(1)} %` : "—", revenue: money(n(row, "revenue"), input.currencyCode) }))));
    const cohortRows = d.cohorts ?? [];
    const cohortOffsets = cohortRows.map((row) => n(row, "month_offset")).filter((value): value is number => value !== null);
    const cohortOffset = cohortOffsets.includes(1) ? 1 : Math.min(...cohortOffsets, Number.POSITIVE_INFINITY);
    const retentionChart = chart(`Retención de cohortes · mes ${Number.isFinite(cohortOffset) ? cohortOffset : 0}`, "percent", cohortRows.filter((row) => n(row, "month_offset") === cohortOffset).slice(0, 8).map((row) => ({ label: str(row.cohort_month).slice(0, 7), value: (n(row, "cohort_customers") ?? 0) > 0 ? ((n(row, "customers") ?? 0) / (n(row, "cohort_customers") ?? 1)) * 100 : null })));
    if (retentionChart) sections.push(retentionChart);
    sections.push(table("Actividad de cohortes", [{ key: "cohort", label: "Cohorte", width: 1.1 }, { key: "month", label: "Mes", align: "right", width: 0.6 }, { key: "customers", label: "Clientes", align: "right", width: 0.8 }, { key: "orders", label: "Pedidos", align: "right", width: 0.8 }, { key: "frequency", label: "Pedidos / cliente", align: "right", width: 0.9 }, { key: "revenue", label: "Ingresos", align: "right", width: 1.1 }], cohortRows.slice(0, 16).map((row) => ({ cohort: str(row.cohort_month).slice(0, 7), month: n(row, "month_offset") ?? "—", customers: n(row, "customers") ?? "—", orders: n(row, "orders") ?? "—", frequency: (n(row, "customers") ?? 0) > 0 && n(row, "orders") !== null ? ((n(row, "orders") ?? 0) / (n(row, "customers") ?? 1)).toFixed(2) : "—", revenue: money(n(row, "revenue"), input.currencyCode) }))));
    sections.push(note("Límite de identificación", "La base de clientes resume el historial sincronizado; cohortes muestran retención por mes de alta. Los pedidos de invitado no se atribuyen a un cliente.", "warning"));
  } else if (input.templateId === "meta_publicidad") {
    sections.push(metaSection());
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
    sections.push(table("Campañas y automatizaciones", [{ key: "entity_name", label: "Envío", width: 2.4 }, { key: "entity_type", label: "Tipo", width: 0.8 }, { key: "revenue", label: "Ingresos atribuidos", align: "right", width: 1.4 }, { key: "conversions", label: "Conversiones", align: "right", width: 1 }], groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 8).map((row) => ({ entity_name: str(row.entity_name) || "Sin nombre", entity_type: str(row.entity_type) === "flow" ? "Flow" : "Campaña", revenue: new Intl.NumberFormat("es-ES", { style: "currency", currency: input.currencyCode, maximumFractionDigits: 0 }).format(n(row, "revenue") ?? 0), conversions: n(row, "conversions") ?? 0 }))));
    const klaviyoEntities = groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0));
    const emailChart = chart("Ingresos atribuidos por envío", "currency", klaviyoEntities.slice(0, 8).map((row) => ({ label: str(row.entity_name) || "Sin nombre", value: n(row, "revenue") })), input.currencyCode);
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
    const shopifyChannelChart = chart("Shopify · ventas del periodo", "currency", [{ label: "Ventas netas", value: n(sales, "net_sales") }, { label: "Ventas brutas", value: n(sales, "gross_sales") }], input.currencyCode);
    const metaChannelChart = chart("Meta · ROAS de campañas", "ratio", (d.metaCampaigns ?? []).slice(0, 6).map((row) => ({ label: str(row.campaign_name ?? row.name) || "Campaña", value: n(row, "roas") })));
    const klaviyoChannelChart = chart("Klaviyo · ingresos atribuidos", "currency", groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 6).map((row) => ({ label: str(row.entity_name) || "Sin nombre", value: n(row, "revenue") })), input.currencyCode);
    if (shopifyChannelChart) sections.push(shopifyChannelChart);
    if (metaChannelChart) sections.push(metaChannelChart);
    if (klaviyoChannelChart) sections.push(klaviyoChannelChart);
    sections.push(productDetailTable(), metaCampaignTable(), emailEntityTable());
    sections.push(note("No sumar atribuciones", "Shopify muestra ventas observadas. Meta y Klaviyo aplican modelos de atribución distintos y pueden atribuir la misma compra. Sus valores se mantienen separados.", "warning"));
  } else {
    sections.push(salesSection("Ventas observadas · Shopify"));
    sections.push(metrics("Rentabilidad estimada · Shopify", [
      m("Ingresos netos sin IVA", n(finance, "net_revenue_ex_tax", "net_sales"), "currency"),
      m("Margen bruto", n(finance, "gross_margin"), "currency"),
      m("Beneficio neto", n(finance, "net_profit"), "currency"),
      m("Margen neto", n(finance, "net_margin_pct"), "percent"),
    ]));
    sections.push(metaSection("Publicidad · datos atribuidos por Meta"));
    sections.push(emailSection("Email · datos atribuidos por Klaviyo"));
    const executiveSalesChart = chart("Shopify · ventas observadas", "currency", [{ label: "Ventas netas", value: n(sales, "net_sales") }, { label: "Ventas brutas", value: n(sales, "gross_sales") }], input.currencyCode);
    const executiveMetaChart = chart("Meta · ROAS de campañas", "ratio", (d.metaCampaigns ?? []).slice(0, 6).map((row) => ({ label: str(row.campaign_name ?? row.name) || "Campaña", value: n(row, "roas") })));
    const executiveEmailChart = chart("Klaviyo · ingresos atribuidos", "currency", groupKlaviyoEntities(d.klaviyo ?? []).sort((a, b) => (n(b, "revenue") ?? 0) - (n(a, "revenue") ?? 0)).slice(0, 6).map((row) => ({ label: str(row.entity_name) || "Sin nombre", value: n(row, "revenue") })), input.currencyCode);
    if (executiveSalesChart) sections.push(executiveSalesChart);
    if (executiveMetaChart) sections.push(executiveMetaChart);
    if (executiveEmailChart) sections.push(executiveEmailChart);
    sections.push(productDetailTable(), metaCampaignTable(), emailEntityTable());
    sections.push(note("Lectura ejecutiva", "Las ventas observadas de Shopify y los resultados atribuidos de Meta y Klaviyo se muestran por separado. El beneficio depende de la cobertura de costes configurada.", "warning"));
  }

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
    sections,
    sources,
  };
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
      cohorts: [
        { cohort_month: "2026-06-01", cohort_customers: 184, month_offset: 1, customers: 83, orders: 121, revenue: 9210 },
        { cohort_month: "2026-07-01", cohort_customers: 212, month_offset: 1, customers: 87, orders: 130, revenue: 10840 },
        { cohort_month: "2026-08-01", cohort_customers: 196, month_offset: 1, customers: 74, orders: 105, revenue: 7830 },
      ],
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
  });
  return { ...report, sample: true };
}
