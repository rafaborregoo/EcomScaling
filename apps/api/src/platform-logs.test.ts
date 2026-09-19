import assert from "node:assert/strict";
import test from "node:test";
import type { LoadedApiEnv } from "@ecomscaling/config";
import type { AuthContext } from "./auth-context.js";
import { retryPlatformSyncError } from "./platform-logs.js";

/**
 * /admin/logs/errores-sync: el boton "Reintentar" pasa por aqui. Lo unico
 * que importa sin tocar la base de datos es que el guard de platform_admin
 * bloquee antes de intentar nada -- si esto se rompe, cualquier owner podria
 * relanzar el sync de una organizacion ajena.
 */

function fakeContext(platformRole: "user" | "platform_admin"): AuthContext {
  return {
    user: { id: "11111111-1111-1111-1111-111111111111" },
    profile: {
      id: "11111111-1111-1111-1111-111111111111",
      full_name: null,
      avatar_url: null,
      phone: null,
      platform_role: platformRole,
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [],
    subscriptions: [],
  } as unknown as AuthContext;
}

const fakeEnv = {} as LoadedApiEnv;

test("retryPlatformSyncError rechaza a quien no es platform_admin sin tocar la base de datos", async () => {
  const result = await retryPlatformSyncError(
    fakeEnv,
    fakeContext("user"),
    "22222222-2222-2222-2222-222222222222",
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.statusCode, 403);
    assert.equal(result.error, "platform_admin_required");
  }
});
