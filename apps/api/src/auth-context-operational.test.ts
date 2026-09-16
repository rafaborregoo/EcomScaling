import assert from "node:assert/strict";
import test from "node:test";
import {
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import { classifyOperationalOrganization } from "./operational-organization.js";

function context(
  organizationStatus: string,
  subscriptionStatus: string | null = "active",
): AuthContext {
  return {
    user: { id: "user-1" },
    profile: {
      id: "user-1",
      full_name: null,
      avatar_url: null,
      platform_role: "user",
      is_active: true,
    },
    memberships: [
      {
        organization_id: "org-1",
        role: "owner",
        accessSource: "membership",
        organization: {
          id: "org-1",
          display_name: "Test",
          slug: "test",
          status: organizationStatus,
          timezone: "Europe/Madrid",
          currency_code: "EUR",
          kind: "client",
        },
      },
    ],
    subscriptions:
      subscriptionStatus === null
        ? []
        : [
            {
              id: "subscription-1",
              organization_id: "org-1",
              plan_code: "pilot",
              status: subscriptionStatus,
              starts_at: null,
              ends_at: null,
            },
          ],
  };
}

test("permite operar una organizacion activa con suscripcion valida", () => {
  assert.equal(
    requireOperationalOrganization(context("active"), "org-1").ok,
    true,
  );
  assert.equal(
    requireOperationalOrganization(context("onboarding", null), "org-1").ok,
    true,
  );
});

test("bloquea organizaciones suspendidas o en purga", () => {
  for (const status of ["suspended", "cancelled", "pending_deletion"]) {
    const result = requireOperationalOrganization(context(status), "org-1");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "organization_not_operational");
  }
});

test("bloquea una suscripcion no activa en una organizacion activa", () => {
  for (const status of ["pending", "paused", "cancelled", "expired"]) {
    const result = requireOperationalOrganization(
      context("active", status),
      "org-1",
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "subscription_not_active");
  }
});

test("bloquea una organizacion fuera del contexto del usuario", () => {
  const result = requireOperationalOrganization(context("active"), "other-org");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "organization_access_denied");
});

test("el guard de workers clasifica el estado antes de escribir", () => {
  assert.equal(classifyOperationalOrganization("active", "active").ok, true);
  assert.equal(classifyOperationalOrganization("onboarding", null).ok, true);
  const suspended = classifyOperationalOrganization("suspended", "active");
  assert.equal(suspended.ok, false);
  if (!suspended.ok)
    assert.equal(suspended.error, "organization_not_operational");
  const paused = classifyOperationalOrganization("active", "paused");
  assert.equal(paused.ok, false);
  if (!paused.ok) assert.equal(paused.error, "subscription_not_active");
});
