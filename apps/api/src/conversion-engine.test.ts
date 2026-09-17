import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConversionFunnelFacts,
  buildConversionPlaybookContext,
} from "./conversion-engine.js";

test("P03 conserva unknowns CRO y no inventa una fuga", () => {
  const context = buildConversionPlaybookContext(
    "org-1",
    [],
    null,
    "2026-09-17T10:00:00.000Z",
  );
  const facts = context.facts ?? {};
  assert.equal(facts["conversion_cro.funnel.measurement.sufficient"], "UNKNOWN");
  assert.equal(facts["conversion_cro.economics.available"], "UNKNOWN");
  assert.deepEqual(context.evidence_refs, []);
});

test("P03 marca solo cobertura que el embudo realmente tiene", () => {
  const context = buildConversionPlaybookContext(
    "org-1",
    [],
    null,
    "2026-09-17T10:00:00.000Z",
  );
  const enriched = applyConversionFunnelFacts(
    context,
    { sessions: 120, days_with_sessions: 5, funnel_data_since: "2026-08-01" },
    "2026-08-18T00:00:00.000Z",
    "shopify_funnel_summary:org-1:2026-09-17",
  );
  assert.equal(enriched.facts?.["conversion_cro.funnel.sessions.available"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.funnel.steps.available"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.funnel.measurement.sufficient"], "TRUE");
  assert.ok(enriched.evidence_refs?.includes("shopify_funnel_summary:org-1:2026-09-17"));
});

test("P03 no pinta como cero un embudo sin cobertura completa", () => {
  const context = buildConversionPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyConversionFunnelFacts(
    context,
    { sessions: 120, days_with_sessions: 5, funnel_data_since: "2026-09-10" },
    "2026-08-18T00:00:00.000Z",
  );
  assert.equal(enriched.facts?.["conversion_cro.funnel.sessions.available"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.funnel.steps.available"], "UNKNOWN");
  assert.equal(enriched.facts?.["conversion_cro.funnel.measurement.sufficient"], "UNKNOWN");
});
