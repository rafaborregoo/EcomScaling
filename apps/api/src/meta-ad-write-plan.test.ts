import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "./auth-context.js";
import { prepareMetaAdCreationPlan } from "./meta-ad-write-plan.js";

function context(role: string, platformRole = "user"): AuthContext {
  return {
    user: { id: "user-1" },
    profile: {
      id: "user-1",
      full_name: null,
      avatar_url: null,
      platform_role: platformRole,
      is_active: true,
    },
    memberships: [
      {
        organization_id: "org-1",
        role,
        accessSource: "membership",
        organization: {
          id: "org-1",
          display_name: "Test",
          slug: "test",
          status: "active",
          timezone: "Europe/Madrid",
          currency_code: "EUR",
          kind: "client",
        },
      },
    ],
    subscriptions: [
      {
        id: "sub-1",
        organization_id: "org-1",
        plan_code: "growth",
        status: "active",
        starts_at: null,
        ends_at: null,
      },
    ],
  };
}

const validPayload = {
  adAccountId: "123456789",
  campaignName: "Summer launch",
  campaignObjective: "OUTCOME_SALES",
  adSetName: "Spain prospecting",
  dailyBudgetMinor: 2500,
  creativeName: "Summer creative",
  creativeSpec: { headline: "Discover the collection" },
  adName: "Summer ad 01",
  idempotencyKey: "meta-plan:org-1:20260826",
};

test("prepara un plan Meta dry-run para owner sin crear objetos externos", () => {
  const result = prepareMetaAdCreationPlan(context("owner"), "org-1", validPayload);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.mode, "dry_run");
    assert.equal(result.data.executionReady, false);
    assert.equal((result.data.plan as { status: string }).status, "PAUSED");
  }
});

test("rechaza la preparación Meta a miembros sin permisos de gestión", () => {
  const result = prepareMetaAdCreationPlan(context("member"), "org-1", validPayload);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "meta_write_access_denied");
});

test("permite a un consultor preparar el dry-run sin activar la ejecución", () => {
  const result = prepareMetaAdCreationPlan(
    context("member", "consultant"),
    "org-1",
    validPayload,
  );

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.executionReady, false);
});

test("no permite secretos en el creative spec", () => {
  const result = prepareMetaAdCreationPlan(context("owner"), "org-1", {
    ...validPayload,
    creativeSpec: { access_token: "must-never-enter-a-plan" },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "meta_write_plan_must_not_contain_secrets");
  }
});

test("rechaza el objetivo comercial interno antes de crear el plan", () => {
  const result = prepareMetaAdCreationPlan(context("owner"), "org-1", {
    ...validPayload,
    campaignObjective: "conversion",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "meta_campaign_objective_invalid");
});
