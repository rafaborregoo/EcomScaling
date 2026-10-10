import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveReportDocument, buildPortfolioReportDocument, buildSampleReportDocument, reportDigest } from "./report-data.js";
import { renderReportPdf } from "./report-pdf.js";
import { REPORT_TEMPLATES, type ReportTemplateId } from "./report-templates.js";

const sourceStatus = {
  Shopify: { status: "partial" as const, detail: "Hay periodos sin sincronizar." },
  "Meta Ads": { status: "available" as const, detail: "Datos sincronizados." },
  Klaviyo: { status: "unavailable" as const, detail: "Sin eventos en el periodo." },
};

test("all reusable templates produce a populated native PDF sample", async () => {
  for (const template of REPORT_TEMPLATES) {
    const report = buildSampleReportDocument(template.id);
    const pdf = await renderReportPdf(report);
    assert.equal(report.sample, true, `${template.id} must be visibly marked as sample data`);
    assert.ok(report.sections.length >= 2, `${template.id} should have report sections`);
    assert.ok(report.sections.some((section) => section.kind === "chart"), `${template.id} should include source-backed visual data`);
    assert.ok(report.sections.some((section) => section.kind === "table"), `${template.id} should include a detailed data table`);
    assert.ok(pdf.length > 3_000, `${template.id} should contain rendered PDF content`);
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  }
});

test("multichannel report keeps observed sales and platform attribution in separate sections", () => {
  const report = buildLiveReportDocument({
    templateId: "resumen_multicanal",
    organizationName: "Demo",
    storeName: "Tienda principal",
    currencyCode: "EUR",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    previousPeriodStart: "2026-08-01",
    previousPeriodEnd: "2026-08-31",
    generatedAt: "2026-10-05T09:00:00.000Z",
    data: {
      shopify: { net_sales: 10_000 },
      finance: { net_profit: 2_000 },
      meta: { purchase_value: 7_000 },
      klaviyo: [{ revenue: 5_000, delivered: 10, opens_unique: 5, clicks_unique: 2, unsubscribes: 1 }],
    },
    sourceStatus,
  });

  const sectionTitles = report.sections.map((section) => section.title);
  assert.ok(sectionTitles.includes("Ventas observadas · Shopify"));
  assert.ok(sectionTitles.includes("Publicidad · datos atribuidos por Meta"));
  assert.ok(sectionTitles.includes("Email · datos atribuidos por Klaviyo"));
  assert.equal(report.sections.some((section) => /ventas totales.*multicanal/i.test(section.title)), false);
  assert.deepEqual(report.sources.map((source) => source.status), ["partial", "available", "unavailable"]);
});

test("Klaviyo delivery rates use delivered messages as denominator", () => {
  const report = buildLiveReportDocument({
    templateId: "klaviyo_email",
    organizationName: "Demo",
    storeName: "Alcance conectado",
    currencyCode: "EUR",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    previousPeriodStart: "2026-08-01",
    previousPeriodEnd: "2026-08-31",
    generatedAt: "2026-10-05T09:00:00.000Z",
    data: {
      klaviyo: [
        { entity_id: "a", entity_type: "campaign", entity_name: "Campaña A", revenue: 900, conversions: 9, delivered: 20, opens_unique: 10, clicks_unique: 5, unsubscribes: 1 },
        { entity_id: "b", entity_type: "campaign", entity_name: "Campaña B", revenue: 100, conversions: 1, delivered: 80, opens_unique: 40, clicks_unique: 15, unsubscribes: 3 },
      ],
    },
    sourceStatus,
  });
  const kpis = report.sections.find((section) => section.kind === "metrics");
  assert.ok(kpis && kpis.kind === "metrics");
  const values = new Map(kpis.metrics.map((metric) => [metric.label, metric.value]));
  assert.equal(values.get("Ingresos atribuidos"), 1_000);
  assert.equal(values.get("Conversiones atribuidas"), 10);
  assert.equal(values.get("Tasa de apertura"), 50);
  assert.equal(values.get("Tasa de clic"), 20);
  assert.equal(values.get("Tasa de baja"), 4);
  const detail = report.sections.find((section) => section.kind === "table" && section.title === "Entregabilidad y respuesta");
  assert.ok(detail && detail.kind === "table");
  assert.equal(detail.table.rows[0]?.delivered, 20);
});

test("reports omit charts when their source contains no plottable observations", () => {
  const report = buildLiveReportDocument({
    templateId: "shopify_comercial",
    organizationName: "Demo",
    storeName: "Tienda principal",
    currencyCode: "EUR",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    previousPeriodStart: "2026-08-01",
    previousPeriodEnd: "2026-08-31",
    generatedAt: "2026-10-05T09:00:00.000Z",
    data: { shopify: { net_sales: 0 }, products: [] },
    sourceStatus,
  });
  assert.equal(report.sections.some((section) => section.kind === "chart"), false);
});

test("product detail reports data-quality counts supplied by Shopify", () => {
  const report = buildSampleReportDocument("shopify_comercial");
  const detail = report.sections.find((section) => section.kind === "table" && section.title === "Detalle por producto");
  assert.ok(detail && detail.kind === "table");
  assert.equal(detail.table.rows[0]?.exact, 42);
  assert.equal(detail.table.rows[0]?.estimated, 0);
  assert.equal("orders" in (detail.table.rows[0] ?? {}), false);
});

test("only catalog template IDs are selectable", () => {
  const validIds = new Set<ReportTemplateId>(REPORT_TEMPLATES.map((item) => item.id));
  assert.equal(validIds.size, 7);
});

test("report opens with the copilot reading and the largest changes vs. the previous period", async () => {
  const report = buildLiveReportDocument({
    templateId: "resumen_multicanal",
    organizationName: "Demo",
    storeName: "Tienda principal",
    currencyCode: "EUR",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    previousPeriodStart: "2026-08-01",
    previousPeriodEnd: "2026-08-31",
    generatedAt: "2026-10-05T09:00:00.000Z",
    data: {
      shopify: { net_sales: 12_000, orders_count: 100 },
      previousShopify: { net_sales: 10_000, orders_count: 100 },
      meta: { spend: 1_000 },
      previousMeta: { spend: 2_000 },
      klaviyo: [{ revenue: 500, delivered: 100 }],
      previousKlaviyo: [{ revenue: 400, delivered: 100 }],
      klaviyoCurrencyCode: "USD",
      metaCurrencyCode: "EUR",
    },
    sourceStatus,
    analysis: { highlights: ["Las ventas suben un 20 %."], recommendations: ["Mantener la inversión."] },
  });
  const [reading, actions, changes] = report.sections;
  assert.ok(reading?.kind === "summary" && reading.author === "copilot" && reading.points[0] === "Las ventas suben un 20 %.");
  assert.ok(actions?.kind === "summary" && actions.title === "Recomendaciones");
  assert.ok(changes?.kind === "summary" && changes.author === "data");
  // La mayor variación (Meta −50 %) va primero; pedidos sin cambio no aparece.
  assert.match(changes.points[0]!, /^Inversión: .* \(-50 %\)\.$/);
  assert.equal(changes.points.some((point) => point.startsWith("Pedidos")), false);
  const digest = reportDigest(report);
  const klaviyoRevenue = digest.find((item) => item.label === "Ingresos atribuidos");
  assert.match(klaviyoRevenue?.value ?? "", /US\$|USD/);
  assert.equal(klaviyoRevenue?.change_pct, 25);
  const pdf = await renderReportPdf(report);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
});

test("daily trend and cohort triangle replace the flat bar charts and mixed cohort rows", async () => {
  const sales = buildSampleReportDocument("shopify_comercial");
  const salesTrend = sales.sections.find((section) => section.kind === "trend");
  assert.ok(salesTrend?.kind === "trend");
  assert.equal(salesTrend.trend.dates.length, 30);
  assert.deepEqual(salesTrend.trend.series.map((serie) => serie.style), ["solid", "dashed"]);

  const customers = buildSampleReportDocument("shopify_clientes");
  const triangle = customers.sections.find((section) => section.kind === "table" && section.title.startsWith("Retención por cohorte"));
  assert.ok(triangle?.kind === "table");
  assert.deepEqual(triangle.table.heatColumns, ["m1", "m2", "m3", "m4", "m5", "m6"]);
  // La cohorte más reciente solo tiene mes 1; el resto de celdas quedan vacías, no a cero.
  const latest = triangle.table.rows.at(-1)!;
  assert.equal(latest.cohort, "2026-08");
  assert.equal(typeof latest.m1, "number");
  assert.equal(latest.m2, null);

  // Sin actividad diaria no se pinta una línea plana.
  const empty = buildLiveReportDocument({
    templateId: "shopify_comercial", organizationName: "Demo", storeName: "T", currencyCode: "EUR",
    periodStart: "2026-09-01", periodEnd: "2026-09-02", previousPeriodStart: "2026-08-30", previousPeriodEnd: "2026-08-31",
    generatedAt: "2026-10-05T09:00:00.000Z",
    data: { salesDaily: [{ bucket_date: "2026-09-01", net_sales: 0 }, { bucket_date: "2026-09-02", net_sales: 0 }] },
    sourceStatus,
  });
  assert.equal(empty.sections.some((section) => section.kind === "trend"), false);
  assert.equal(sales.preparedBy, "Consultora de ejemplo");
  const pdf = await renderReportPdf(customers);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
});

test("portfolio report keeps other-currency clients out of the totals chart and labels tiers", async () => {
  const report = buildPortfolioReportDocument({
    consultoraName: "Consultora Demo",
    periodStart: "2026-09-10", periodEnd: "2026-10-09", previousPeriodStart: "2026-08-11", previousPeriodEnd: "2026-09-09",
    generatedAt: "2026-10-10T09:00:00.000Z",
    totals: {
      currency_code: "EUR", stores_excluded: 1, revenue: 20_000, net_profit: 3_000, margin_pct: 15, orders: 400, aov: 50, ads_spend: 2_000,
      prev_revenue: 16_000, prev_profit: 2_000, orders_change_pct: 25, aov_change_pct: 0,
      counts: { clients: 3, pierde: 1, datos: 0, bajo: 1, ok: 1, over_cac: 0 },
    },
    clients: [
      { name: "Alfa", currency_code: "EUR", revenue: 12_000, net_profit: 2_500, margin_pct: 20.8, margin_target: 18, revenue_change_pct: 10, tier: "ok" },
      { name: "Beta", currency_code: "EUR", revenue: 8_000, net_profit: -500, margin_pct: -6.2, margin_target: null, revenue_change_pct: -4, tier: "pierde" },
      { name: "Gamma", currency_code: "USD", revenue: 5_000, net_profit: 900, margin_pct: 18, margin_target: null, revenue_change_pct: null, tier: "bajo" },
    ],
    monthly: [{ month: "2026-09-01", revenue: 18_000, profit: 2_600 }],
    failedStores: 0,
  });
  assert.equal(report.templateId, "cartera");
  const profitChart = report.sections.find((section) => section.kind === "chart" && section.title === "Beneficio neto por cliente");
  assert.ok(profitChart?.kind === "chart");
  assert.deepEqual(profitChart.chart.items.map((item) => item.label), ["Alfa", "Beta"]);
  const clients = report.sections.find((section) => section.kind === "table");
  assert.ok(clients?.kind === "table");
  assert.equal(clients.table.rows[1]?.tier, "Pierde dinero");
  assert.match(String(clients.table.rows[2]?.revenue), /US\$|USD/);
  const changes = report.sections[0];
  assert.ok(changes?.kind === "summary" && changes.points.some((point) => point.startsWith("Beneficio neto")));
  // Pedidos +25 %: el valor anterior se reconstruye a partir de la variación.
  assert.ok(changes.points.some((point) => point.startsWith("Pedidos: 400 frente a 320")));
  const pdf = await renderReportPdf(report);
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
});
