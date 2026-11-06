import test from "node:test";
import assert from "node:assert/strict";
import { assessEmailCampaign, campaignMetricTotals } from "./email-campaign-assessment.js";
import type { EmailCampaignDossier } from "@e-nora/contracts";
const message: EmailCampaignDossier["messages"][number] = { id: "message", subject: "Producto", preheader: null, html: "<p>Producto</p>", text: "Producto", content_hash: "hash", source_revision: "1", provenance: "current", historical_observation: false, issues: [] };
const review: EmailCampaignDossier["reviews"][number] = { id: "r", message_id: "message", dimension: "subject", claim_type: "editorial_hypothesis", observation: "Puede ser más concreto", quote: "Producto", change: "Probar un asunto centrado en el producto", criterion: "Prueba con audiencia comparable", limitation: "No demuestra incremento de ventas", status: "proposed", current_version: true, created_at: "2026-11-03", draft_id: null, task_id: null };
const metrics = campaignMetricTotals([{ revenue: 0, conversions: 0, delivered: 10, recipients: 12, opens_unique: 4, clicks_unique: 2, unsubscribes: 0, bounced: 2, spam_complaints: 0 }]);
const base = { metrics, metricStatus: "available" as const, messages: [message], reviews: [], noChangeVerified: false };
test("missing results remain unknown, partial coverage never becomes zero", () => {
  assert.equal(campaignMetricTotals([]).revenue, null);
  assert.equal(campaignMetricTotals([{ revenue: 4 }, { revenue: null }]).revenue, null);
  assert.equal(metrics.revenue, 0); assert.equal(metrics.click_rate, 0.2);
});
test("zero sales alone never bans reuse or judges design bad", () => {
  assert.equal(assessEmailCampaign(base).status, "insufficient_evidence");
  assert.equal(assessEmailCampaign({ ...base, noChangeVerified: true }).status, "reuse");
});
test("an unusable observed CTA requires correction, regardless of revenue", () => {
  assert.equal(assessEmailCampaign({ ...base, messages: [{ ...message, issues: ["CTA vacío"] }] }).status, "fix_before_reuse");
});
test("current editorial hypothesis proposes testing, without claiming causality", () => {
  assert.equal(assessEmailCampaign({ ...base, reviews: [review] }).status, "improve_and_test");
  assert.equal(assessEmailCampaign({ ...base, reviews: [{ ...review, current_version: false }] }).status, "insufficient_evidence");
  assert.equal(assessEmailCampaign({ ...base, reviews: [{ ...review, status: "rejected" }] }).status, "insufficient_evidence");
});
test("no-change only permits an editorial reuse candidate with content and measured deliveries", () => {
  assert.equal(assessEmailCampaign({ ...base, noChangeVerified: true, messages: [] }).status, "insufficient_evidence");
  const result = assessEmailCampaign({ ...base, noChangeVerified: true });
  assert.equal(result.status, "reuse"); assert.equal(result.mature_attribution_verified, false); assert.match(result.reasons.join(" "), /no declara/);
});
