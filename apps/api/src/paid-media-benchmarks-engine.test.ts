import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPaidMediaBenchmarksEvidence,
  buildPaidMediaBenchmarksPlaybookContext,
} from "./paid-media-benchmarks-engine.js";

test("F6.04 observa la cadena que existe y no convierte atribución en incrementalidad", () => {
  const context = buildPaidMediaBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyPaidMediaBenchmarksEvidence(context, {
    media: { available: true, spend: 100, impressions: 10000, clicks: 100, days: 30 },
    ecommerce: { available: true, sessions: 1000, orders_count: 40, revenue: 2400 },
    economics: { available: true, contribution: 800 },
    attribution: { available: true, attributed_revenue: 1800, roas: 18 },
  }, ["meta_spend_summary:org-1:2026-09-18"]);

  assert.equal(enriched.facts?.["paid_media.delivery.observed"], "TRUE");
  assert.equal(enriched.facts?.["paid_media.traffic.observed"], "TRUE");
  assert.equal(enriched.facts?.["paid_media.economics.observed"], "TRUE");
  assert.equal(enriched.facts?.["paid_media.attribution.observed"], "TRUE");
  assert.equal(enriched.facts?.["paid_media.incrementality.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["paid_media.confidence.observed"], "UNKNOWN");
  assert.deepEqual(enriched.evidence_refs, ["meta_spend_summary:org-1:2026-09-18"]);
});

test("F6.04 conserva UNKNOWN cuando no hay inversión ni contexto de campaña", () => {
  const context = buildPaidMediaBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyPaidMediaBenchmarksEvidence(context, {});
  assert.equal(enriched.facts?.["paid_media.objective.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["paid_media.delivery.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["paid_media.scale.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["paid_media.guardrails.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length ?? 0, 0);
});
