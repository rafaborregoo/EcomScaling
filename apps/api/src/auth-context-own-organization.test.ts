import assert from "node:assert/strict";
import test from "node:test";
import {
  requireOwnOrganizationAccess,
  type AuthContext,
} from "./auth-context.js";

function context(accessSource: "membership" | "consultant_assignment" | "platform_admin"): AuthContext {
  return {
    user: { id: "user-1" },
    profile: {
      id: "user-1",
      full_name: null,
      avatar_url: null,
      platform_role: accessSource === "consultant_assignment" ? "consultant" : "user",
      is_active: true,
    },
    memberships: [
      {
        organization_id: "org-1",
        role: accessSource === "membership" ? "owner" : "consultant",
        accessSource,
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
    subscriptions: [],
  };
}

test("permite a una membership real ver sus integraciones", () => {
  assert.equal(
    requireOwnOrganizationAccess(context("membership"), "org-1").ok,
    true,
  );
});

test("permite a platform_admin (no es el caso que se bloquea)", () => {
  assert.equal(
    requireOwnOrganizationAccess(context("platform_admin"), "org-1").ok,
    true,
  );
});

test("bloquea a un consultor viendo integraciones de un cliente asignado", () => {
  const result = requireOwnOrganizationAccess(
    context("consultant_assignment"),
    "org-1",
  );
  assert.equal(result.ok, false);
  if (!result.ok)
    assert.equal(result.error, "consultant_integrations_access_denied");
});
