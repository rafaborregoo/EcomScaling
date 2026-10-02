import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRetentionCrmEvidence,
  buildRetentionCrmPlaybookContext,
} from "./retention-crm-engine.js";

test("P05 distingue base/repeat observable de cohortes y LTV", () => {
  const context = buildRetentionCrmPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyRetentionCrmEvidence(context, {
    customers: { customer_count: 10, repeat_customers: 4, stateful_customers: 10 },
    sales: { orders_count: 14, refunds: 1 },
    margin: {
      items_with_cost: 8,
      gross_margin: 120,
      lines_with_exact_metrics: 8,
      lines_with_estimated_metrics: 0,
      lines_without_metrics: 0,
    },
    crm: { account_count: 1, flows_count: 3, campaigns_count: 2 },
    consent: { consent_events: 10 },
  });
  assert.equal(enriched.facts?.["retention.customer_base.available"], "TRUE");
  assert.equal(enriched.facts?.["retention.repeat.observed"], "TRUE");
  assert.equal(enriched.facts?.["retention.economics.contribution.available"], "TRUE");
  assert.equal(enriched.facts?.["retention.cohorts.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.ltv.observed"], "UNKNOWN");
});

test("P05 conserva UNKNOWN para suscripción, incrementalidad y calidad; el umbral de churn ya está decidido", () => {
  const context = buildRetentionCrmPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyRetentionCrmEvidence(context, { customers: null, crm: null });
  assert.equal(enriched.facts?.["retention.churn.threshold_defined"], "TRUE");
  assert.equal(enriched.facts?.["retention.subscription.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.incrementality.supported"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.customer_quality.available"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.consent.observed"], "UNKNOWN");
});

test("P05 lee Klaviyo: flujos activos, envios y medicion fiable solo con UTM y clics en todos", () => {
  const context = buildRetentionCrmPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const klaviyo = { active_flows: 2, recipients: 1800, emails_total: 12, emails_without_utm: 0, emails_without_click_tracking: 0, last_sync_status: "succeeded" };
  const ok = applyRetentionCrmEvidence(context, { klaviyo });
  assert.equal(ok.facts?.["retention.crm.lifecycle_flows_active"], "TRUE");
  assert.equal(ok.facts?.["retention.crm.sending_observed"], "TRUE");
  assert.equal(ok.facts?.["retention.crm.measurement_reliable"], "TRUE");

  const sinUtm = applyRetentionCrmEvidence(context, { klaviyo: { ...klaviyo, emails_without_utm: 3 } });
  assert.equal(sinUtm.facts?.["retention.crm.measurement_reliable"], "FALSE");

  const syncFallido = applyRetentionCrmEvidence(context, { klaviyo: { ...klaviyo, last_sync_status: "failed" } });
  assert.equal(syncFallido.facts?.["retention.crm.measurement_reliable"], "FALSE");

  const enCurso = applyRetentionCrmEvidence(context, { klaviyo: { ...klaviyo, last_sync_status: "running" } });
  assert.equal(enCurso.facts?.["retention.crm.measurement_reliable"], "TRUE");

  const sinKlaviyo = applyRetentionCrmEvidence(context, { klaviyo: null });
  assert.equal(sinKlaviyo.facts?.["retention.crm.sending_observed"], "UNKNOWN");
  assert.equal(sinKlaviyo.facts?.["retention.crm.measurement_reliable"], "UNKNOWN");
});

test("P05 LTV observado solo con cohorte madura y margen calculable", () => {
  const context = buildRetentionCrmPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const hito = { milestone_days: 365, cohort_customers: 40, avg_revenue: 90, avg_contribution: 30, items_without_cost: 0, cohort_cac: 20 };
  assert.equal(applyRetentionCrmEvidence(context, { lifetime: [hito] }).facts?.["retention.ltv.observed"], "TRUE");
  assert.equal(applyRetentionCrmEvidence(context, { lifetime: [{ ...hito, avg_contribution: null, items_without_cost: 3 }] }).facts?.["retention.ltv.observed"], "UNKNOWN");
  assert.equal(applyRetentionCrmEvidence(context, { lifetime: [{ ...hito, cohort_customers: 0 }] }).facts?.["retention.ltv.observed"], "UNKNOWN");
});
