import assert from "node:assert/strict";
import { test } from "node:test";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { loadConsultantPermissions, listMyConsultantPermissions } from "./organization-settings.js";

const env = { SUPABASE_URL: "https://audit.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } as LoadedApiEnv;

test("permission lookup fails closed on a database error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "unavailable" }, { status: 400 }));
  await assert.rejects(loadConsultantPermissions(env, "client"), /consultant_permissions_unavailable/);
});

test("missing permission row still uses the documented defaults", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(null));
  const permissions = await loadConsultantPermissions(env, "client");
  assert.equal(permissions.manage_tasks, true);
  assert.equal(permissions.marketing_publish, false);
});

test("portfolio permissions resolve the client foreign key and surface lookup failures", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/consultant_assignments")) {
      assert.match(url.searchParams.get("select") ?? "", /organizations!consultant_assignments_organization_id_fkey/);
      return Response.json([{ organization_id: "client", organizations: { display_name: "Client" } }]);
    }
    return Response.json({ message: "unavailable" }, { status: 400 });
  });
  const result = await listMyConsultantPermissions(env, { user: { id: "consultant" } } as AuthContext);
  assert.equal(result.ok, false);
});
