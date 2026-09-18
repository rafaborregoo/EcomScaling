import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMeasurementExperimentationEvidence,
  buildMeasurementExperimentationPlaybookContext,
} from "./measurement-experimentation-engine.js";

test("P09 distingue cobertura observada de calidad, reconciliación y causalidad", () => {
  const context = buildMeasurementExperimentationPlaybookContext(
    "org-1",
    [],
    null,
    "2026-09-18T10:00:00.000Z",
  );
  const enriched = applyMeasurementExperimentationEvidence(context, {
    sales: { available: true, orders_count: 12 },
    funnel: {
      available: true,
      has_sessions: true,
      sessions: 500,
      has_funnel_steps: true,
      purchases: 10,
    },
    daily: { available: true, days: 30 },
  });

  assert.equal(enriched.facts?.["measurement.orders.observed"], "TRUE");
  assert.equal(enriched.facts?.["measurement.sessions.observed"], "TRUE");
  assert.equal(enriched.facts?.["measurement.funnel.steps_observed"], "TRUE");
  assert.equal(enriched.facts?.["measurement.baseline.observed"], "TRUE");
  assert.equal(enriched.facts?.["measurement.reconciliation.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["measurement.data_quality.completeness_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["measurement.tracking.event_semantics_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["measurement.causal_evidence.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["measurement.experimentation.capability_observed"], "UNKNOWN");
});

test("P09 conserva UNKNOWN cuando no hay cobertura de medición utilizable", () => {
  const context = buildMeasurementExperimentationPlaybookContext(
    "org-1",
    [],
    null,
    "2026-09-18T10:00:00.000Z",
  );
  const enriched = applyMeasurementExperimentationEvidence(context, {
    sales: null,
    funnel: null,
    daily: null,
  });

  assert.equal(enriched.facts?.["measurement.orders.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["measurement.sessions.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["measurement.baseline.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 0);
});
