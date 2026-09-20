import assert from "node:assert/strict";
import test from "node:test";
import type { LoadedApiEnv } from "@ecomscaling/config";
import type { AuthContext } from "./auth-context.js";
import {
  getClientOverview,
  upsertOrganizationMember,
} from "./consultant.js";

/**
 * /admin/clientes ficha 360: la lectura de la ficha y la edicion de miembros
 * que se hace desde ella. Sin base de datos solo se puede comprobar lo que
 * pasa antes de tocarla, que es justo lo que no puede fallar: el guard de
 * platform_admin y la validacion del payload.
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

const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";

test("getClientOverview rechaza a quien no es platform_admin sin tocar la base de datos", async () => {
  const result = await getClientOverview(
    fakeEnv,
    fakeContext("user"),
    ORGANIZATION_ID,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.statusCode, 403);
    assert.equal(result.error, "platform_admin_required");
  }
});

test("upsertOrganizationMember sigue rechazando un rol inventado", async () => {
  const result = await upsertOrganizationMember(
    fakeEnv,
    fakeContext("platform_admin"),
    ORGANIZATION_ID,
    { user_id: USER_ID, role: "superadmin" },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.statusCode, 400);
    assert.equal(result.error, "invalid_member_payload");
  }
});

/**
 * El bug que arreglo la ficha: quitar el acceso manda {user_id, is_active},
 * sin `role`, y la validacion lo rechazaba con 400 siempre -- el boton
 * "Quitar" de /consultor no funciono nunca. Aqui no hay base de datos, asi
 * que la senal de que el payload ya pasa la validacion es que la funcion
 * llegue a construir el cliente de Supabase y reviente por el env vacio.
 */
test("upsertOrganizationMember acepta desactivar sin repetir el rol", async () => {
  await assert.rejects(
    upsertOrganizationMember(fakeEnv, fakeContext("platform_admin"), ORGANIZATION_ID, {
      user_id: USER_ID,
      is_active: false,
    }),
    (thrown: unknown) => {
      assert.ok(
        thrown instanceof Error && !/invalid_member_payload/.test(thrown.message),
      );
      return true;
    },
  );
});
