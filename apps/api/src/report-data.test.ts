import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveReportDocument, buildSampleReportDocument } from "./report-data.js";
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
