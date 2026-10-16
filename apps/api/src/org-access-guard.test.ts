import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CONSULTANT_PERMISSIONS,
  consultantPermissionFor,
  decideOrgAccess,
} from "./org-access-guard.js";

const base = {
  consultantPermissions: null,
  requireMfa: false,
  aal: "aal1",
};
const member = (role: string) => ({ role, accessSource: "membership" });
const consultant = { role: "consultant", accessSource: "consultant_assignment" };

test("solo lectura no escribe, pero lee y pregunta al copiloto", () => {
  const write = { ...base, method: "POST", routeUrl: "/v1/organizations/:organizationId/tasks" };
  assert.equal(decideOrgAccess({ ...write, membership: member("readonly") })?.error, "readonly_role");
  assert.equal(decideOrgAccess({ ...write, membership: member("member") }), null);
  assert.equal(
    decideOrgAccess({ ...base, method: "GET", routeUrl: write.routeUrl, membership: member("readonly") }),
    null,
  );
  assert.equal(
    decideOrgAccess({
      ...base,
      method: "POST",
      routeUrl: "/v1/organizations/:organizationId/consultant-chat",
      membership: member("readonly"),
    }),
    null,
  );
});

test("el consultor necesita el permiso de cada familia de rutas", () => {
  assert.equal(
    consultantPermissionFor("POST", "/v1/organizations/:organizationId/marketing/klaviyo/campaigns"),
    "marketing_publish",
  );
  assert.equal(
    consultantPermissionFor("PATCH", "/v1/organizations/:organizationId/marketing/drafts/:draftId"),
    "marketing_drafts",
  );
  assert.equal(
    consultantPermissionFor("POST", "/v1/consultant/organizations/:organizationId/client-access/invite"),
    "invite_members",
  );
  assert.equal(
    consultantPermissionFor("PUT", "/v1/organizations/:organizationId/ai-settings"),
    "edit_config",
  );
  assert.equal(consultantPermissionFor("GET", "/v1/organizations/:organizationId/tasks"), null);

  const publish = {
    ...base,
    method: "POST",
    routeUrl: "/v1/organizations/:organizationId/marketing/klaviyo/campaigns",
    membership: consultant,
  };
  assert.equal(decideOrgAccess(publish)?.error, "consultant_permission_denied");
  assert.equal(
    decideOrgAccess({
      ...publish,
      consultantPermissions: { ...DEFAULT_CONSULTANT_PERMISSIONS, marketing_publish: true },
    }),
    null,
  );
  // Un miembro real no pasa por los permisos del consultor.
  assert.equal(decideOrgAccess({ ...publish, membership: member("owner") }), null);
});

test("2FA obligatoria bloquea a miembros sin AAL2, no al consultor", () => {
  const read = {
    ...base,
    requireMfa: true,
    method: "GET",
    routeUrl: "/v1/organizations/:organizationId/tasks",
  };
  assert.equal(decideOrgAccess({ ...read, membership: member("owner") })?.error, "mfa_required");
  assert.equal(decideOrgAccess({ ...read, aal: "aal2", membership: member("owner") }), null);
  assert.equal(decideOrgAccess({ ...read, membership: consultant }), null);
});
