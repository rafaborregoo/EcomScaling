import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeCampaignMailingLearnings,
  templateIsAvailableInMailingScope,
} from "./marketing-mailing-learnings.js";

const now = new Date("2026-09-29T12:00:00.000Z");

const row = (values: Partial<Parameters<typeof summarizeCampaignMailingLearnings>[0][number]>) => ({
  bucket_month: "2026-08-01",
  entity_type: "campaign",
  entity_id: "campaign-1",
  entity_name: "Campaña",
  subject: "Asunto",
  revenue: 0,
  delivered: 0,
  opens_unique: 0,
  clicks_unique: 0,
  unsubscribes: 0,
  ...values,
});

test("A27 ranks only completed and mature months with the minimum delivery sample", () => {
  const result = summarizeCampaignMailingLearnings([
    row({ entity_id: "small", entity_name: "Muestra pequeña", revenue: 9_000, delivered: 12 }),
    row({ entity_id: "eligible", entity_name: "Muestra suficiente", revenue: 800, delivered: 100, clicks_unique: 20 }),
    row({ bucket_month: "2026-09-01", entity_id: "recent", entity_name: "Mes reciente", revenue: 99_000, delivered: 1_000 }),
    row({ entity_type: "flow", entity_id: "flow-1", revenue: 500_000, delivered: 1_000 }),
  ], now);

  assert.deepEqual(result.mejores_por_ingreso.map((item) => item.campana), ["Muestra suficiente"]);
  assert.deepEqual(result.mejores_por_clic.map((item) => item.campana), ["Muestra suficiente"]);
  assert.deepEqual(result.alertas_bajo_engagement.map((item) => item.campana), ["Muestra suficiente"]);
  assert.equal(result.campaigns_observed, 3);
  assert.equal(result.mature_campaigns, 2);
  assert.equal(result.comparable_campaigns, 1);
  assert.equal(result.omitted_immature_campaigns, 1);
  assert.equal(result.omitted_low_sample_campaigns, 1);
  assert.equal(result.criteria.interpretation, "descriptive_only_no_causal_or_significance_claim");
});

test("A27 template scope permits global templates and blocks another store's template", () => {
  assert.equal(templateIsAvailableInMailingScope(null, "store-a"), true);
  assert.equal(templateIsAvailableInMailingScope("store-a", "store-a"), true);
  assert.equal(templateIsAvailableInMailingScope("store-b", "store-a"), false);
  assert.equal(templateIsAvailableInMailingScope("store-a", null), false);
  assert.equal(templateIsAvailableInMailingScope(undefined, null), true);
});
