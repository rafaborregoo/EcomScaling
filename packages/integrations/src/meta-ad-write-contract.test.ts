import assert from "node:assert/strict";
import test from "node:test";
import { buildMetaAdCreationPlan, normalizeMetaAdAccountId } from "./meta-ad-write-contract.js";

const input = {
  adAccountId: "12345",
  campaignName: "Q4 prospecting",
  campaignObjective: "OUTCOME_SALES",
  adSetName: "Broad ES",
  dailyBudgetMinor: 2500,
  creativeName: "UGC 01",
  creativeSpec: { object_story_spec: { page_id: "page-1" } },
  adName: "UGC 01 primary",
  idempotencyKey: "meta-plan-2026-08-24-0001",
};

test("normaliza cuentas Meta y conserva la jerarquía oficial", () => {
  assert.equal(normalizeMetaAdAccountId("12345"), "act_12345");
  const result = buildMetaAdCreationPlan(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.plan.steps, ["campaign", "adset", "creative", "ad"]);
  assert.equal(result.plan.status, "PAUSED");
  assert.equal(result.plan.approvalRequired, true);
});

test("rechaza presupuestos, ids y secretos inválidos", () => {
  assert.equal(buildMetaAdCreationPlan({ ...input, dailyBudgetMinor: 0 }).ok, false);
  assert.equal(buildMetaAdCreationPlan({ ...input, idempotencyKey: "short" }).ok, false);
  assert.equal(buildMetaAdCreationPlan({ ...input, access_token: "secret" } as never).ok, false);
  assert.equal(buildMetaAdCreationPlan({ ...input, creativeSpec: { app_secret: "secret" } }).ok, false);
});

test("permite reanudar una propuesta con ids ya creados sin cambiar estado", () => {
  const result = buildMetaAdCreationPlan(input, {
    campaignId: "cmp-1",
    adSetId: "adset-1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.existingExternalIds.campaignId, "cmp-1");
  assert.equal(result.plan.existingExternalIds.adSetId, "adset-1");
  assert.equal(result.plan.status, "PAUSED");
});

