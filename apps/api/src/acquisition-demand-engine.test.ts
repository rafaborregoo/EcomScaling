import assert from "node:assert/strict";
import test from "node:test";
import { applyAcquisitionDemandEvidence, buildAcquisitionDemandPlaybookContext } from "./acquisition-demand-engine.js";

test("F6.03 observa ventas y economics disponibles sin llamar adquisición a todo revenue", () => {
  const context = buildAcquisitionDemandPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyAcquisitionDemandEvidence(context, {
    sales: { available: true, orders_count: 42, revenue: 1200 },
    margin: {
      available: true,
      contribution: 420,
      items_with_cost: 12,
      lines_with_exact_metrics: 12,
      lines_with_estimated_metrics: 0,
      lines_without_metrics: 0,
    },
    funnel: { available: true, sessions: 900 },
  }, ["shopify_sales_summary:org-1:2026-09-18"]);
  assert.equal(enriched.facts?.["acquisition.sales.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.economics.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.sample.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.new_customers.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.cac.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.incrementality.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.confidence.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 1);
});

// El motor ya pedía `shopify_financial_summary` entera y solo leía tres de sus
// columnas, así que CAC e inversión salían UNKNOWN con el dato en la mano. Este
// test falla si alguien vuelve a dejar de leerlas.
test("F6.03 observa CAC e inversión desde las columnas del resumen financiero", () => {
  const context = buildAcquisitionDemandPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyAcquisitionDemandEvidence(context, {
    financial: { available: true, cac_blended: 12.5, ads_spend: 2500, new_customers: 200 },
  });
  assert.equal(enriched.facts?.["acquisition.cac.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.spend.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.new_customers.observed"], "TRUE");
});

// Una tienda conectada que todavía no gasta en publicidad: el resumen llega,
// pero sin CAC. FALSE dice "lo miramos y no hay", que no es lo mismo que
// UNKNOWN ("no lo hemos mirado") -- la distinción que sostiene todo F3.
test("F6.03 distingue sin inversión de sin mirar", () => {
  const context = buildAcquisitionDemandPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyAcquisitionDemandEvidence(context, {
    financial: { available: true, cac_blended: null, ads_spend: null, new_customers: 0 },
  });
  assert.equal(enriched.facts?.["acquisition.cac.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.new_customers.observed"], "TRUE");
});

test("F6.03 conserva unknown sin inversión ni calidad de cliente", () => {
  const context = buildAcquisitionDemandPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyAcquisitionDemandEvidence(context, {});
  assert.equal(enriched.facts?.["acquisition.spend.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.customer_quality.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.concentration.observed"], "UNKNOWN");
});
