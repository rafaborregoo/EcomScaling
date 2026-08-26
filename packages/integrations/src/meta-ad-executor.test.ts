import assert from "node:assert/strict";
import test from "node:test";
import { buildMetaAdCreationPlan } from "./meta-ad-write-contract.js";
import { executeMetaAdCreationPlan } from "./meta-ad-executor.js";

const planResult = buildMetaAdCreationPlan({
  adAccountId: "123456789",
  campaignName: "Campaign",
  campaignObjective: "OUTCOME_SALES",
  adSetName: "Ad set",
  dailyBudgetMinor: 1000,
  creativeName: "Creative",
  creativeSpec: { headline: "Headline" },
  adName: "Ad",
  idempotencyKey: "meta-exec:org-1:20260826",
});
assert.equal(planResult.ok, true);
const plan = planResult.ok
  ? planResult.plan
  : (() => {
      throw new Error("test_plan_invalid");
    })();

function operations(calls: string[]) {
  return {
    createCampaign: async (_input: typeof plan.input, context: { idempotencyKey: string }) => {
      calls.push(`campaign:${context.idempotencyKey}`);
      return "campaign-1";
    },
    createAdSet: async (_input: typeof plan.input) => {
      calls.push("adset");
      return "adset-1";
    },
    createCreative: async (_input: typeof plan.input) => {
      calls.push("creative");
      return "creative-1";
    },
    createAd: async (_input: typeof plan.input) => {
      calls.push("ad");
      return "ad-1";
    },
  };
}

test("exige aprobación explícita antes de ejecutar la jerarquía", async () => {
  const result = await executeMetaAdCreationPlan(plan, null, operations([]));
  assert.deepEqual(result, {
    ok: false,
    error: "meta_approval_required",
    completedSteps: [],
    ids: { campaignId: "", adSetId: "", creativeId: "", adId: "" },
  });
});

test("ejecuta en orden y propaga la idempotencia del plan", async () => {
  const calls: string[] = [];
  const result = await executeMetaAdCreationPlan(
    plan,
    { approved: true, approvedBy: "user-1", approvalId: "approval-1" },
    operations(calls),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    "campaign:meta-exec:org-1:20260826",
    "adset",
    "creative",
    "ad",
  ]);
});

test("reanuda desde IDs existentes sin repetir llamadas ya completadas", async () => {
  const calls: string[] = [];
  const resumedPlan = {
    ...plan,
    existingExternalIds: {
      campaignId: "campaign-1",
      adSetId: "adset-1",
      creativeId: null,
      adId: null,
    },
  };
  const result = await executeMetaAdCreationPlan(
    resumedPlan,
    { approved: true, approvedBy: "user-1" },
    operations(calls),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["creative", "ad"]);
});

test("devuelve los pasos completados si falla una operación", async () => {
  const result = await executeMetaAdCreationPlan(
    plan,
    { approved: true, approvedBy: "user-1" },
    {
      ...operations([]),
      createAdSet: async () => {
        throw new Error("transient_provider_error");
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "meta_execution_failed",
    completedSteps: ["campaign"],
    ids: { campaignId: "campaign-1", adSetId: "", creativeId: "", adId: "" },
  });
});
