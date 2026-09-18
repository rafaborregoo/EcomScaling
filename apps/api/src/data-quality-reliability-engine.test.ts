import assert from "node:assert/strict";
import test from "node:test";
import { applyDataQualityReliabilityEvidence, buildDataQualityReliabilityPlaybookContext } from "./data-quality-reliability-engine.js";

test("F6.02 reconoce cobertura y trazabilidad observables sin convertirlas en confianza total", () => {
  const context = buildDataQualityReliabilityPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyDataQualityReliabilityEvidence(context, {
    assessments: { available: true, count: 3, with_coverage: 2, with_freshness: 3 },
    issues: { available: true, open_material: 0 },
    sales: { available: true, orders_count: 42, revenue: 1200 },
    funnel: { available: true, sessions: 900 },
  }, ["data_quality_assessments:org-1:2026-09-18"]);
  assert.equal(enriched.facts?.["data_quality.metric.observed"], "TRUE");
  assert.equal(enriched.facts?.["data_quality.source.observed"], "TRUE");
  assert.equal(enriched.facts?.["data_quality.completeness.observed"], "TRUE");
  assert.equal(enriched.facts?.["data_quality.freshness.observed"], "TRUE");
  assert.equal(enriched.facts?.["data_quality.traceability.observed"], "TRUE");
  assert.equal(enriched.facts?.["data_quality.definition.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["data_quality.confidence.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 1);
});

test("F6.02 conserva la diferencia entre cero issues y ausencia de evaluación", () => {
  const context = buildDataQualityReliabilityPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const noAssessment = applyDataQualityReliabilityEvidence(context, { issues: { available: true, open_material: 0 } });
  assert.equal(noAssessment.facts?.["data_quality.completeness.observed"], "UNKNOWN");
  assert.equal(noAssessment.facts?.["data_quality.issues.observed"], "TRUE");
  assert.equal(noAssessment.facts?.["data_quality.confidence.observed"], "UNKNOWN");
});
