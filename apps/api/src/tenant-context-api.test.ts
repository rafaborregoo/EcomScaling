import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "./auth-context.js";
import { canDeclareContext } from "./tenant-context-api.js";

const ORG = "org-1";

function ctx(
  platformRole: string,
  membership: { role: string; accessSource: string } | null,
): AuthContext {
  return {
    user: { id: "u-1" },
    profile: {
      id: "u-1",
      full_name: null,
      avatar_url: null,
      platform_role: platformRole,
      is_active: true,
    },
    memberships: membership
      ? [{ organization_id: ORG, organization: { status: "active" }, ...membership }]
      : [],
    subscriptions: [],
  } as unknown as AuthContext;
}

test("D02: el propietario y un manager declaran el contexto de su tienda", () => {
  assert.equal(canDeclareContext(ctx("client", { role: "owner", accessSource: "membership" }), ORG).ok, true);
  assert.equal(canDeclareContext(ctx("client", { role: "manager", accessSource: "membership" }), ORG).ok, true);
});

test("D02: un viewer no declara, y sin acceso a la tienda tampoco", () => {
  assert.equal(canDeclareContext(ctx("client", { role: "viewer", accessSource: "membership" }), ORG).ok, false);
  assert.equal(canDeclareContext(ctx("client", null), ORG).ok, false);
});

test("D02: el consultor asignado declara por su cliente", () => {
  assert.equal(
    canDeclareContext(ctx("consultant", { role: "consultant", accessSource: "consultant_assignment" }), ORG).ok,
    true,
  );
});
