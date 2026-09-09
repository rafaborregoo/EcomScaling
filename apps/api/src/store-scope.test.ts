import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "./auth-context.js";
import { assignStoreScope, parseStoreScopeInput } from "./store-scope.js";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
} as unknown as Parameters<typeof assignStoreScope>[0];

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
        accessSource: role === "consultant" ? "consultant_assignment" : "membership",
        organization: {
          id: "org-1",
          display_name: "Test",
          slug: "test",
          status: "active",
          timezone: "Europe/Madrid",
          currency_code: "EUR",
        },
      },
    ],
    subscriptions: [
      {
        id: "subscription-1",
        organization_id: "org-1",
        plan_code: "pilot",
        status: "active",
        starts_at: null,
        ends_at: null,
      },
    ],
  } as unknown as AuthContext;
}

test("recoge los ids de tienda de las dos tablas y deduplica", () => {
  const parsed = parseStoreScopeInput({
    meta_ad_accounts: [
      { id: "ad-1", store_id: "store-a" },
      { id: "ad-2", store_id: "store-b" },
      { id: "ad-3", store_id: "store-a" },
    ],
    klaviyo_accounts: [{ id: "kl-1", store_id: "store-b" }],
  });

  assert.equal(parsed.ok, true);
  if (parsed.ok !== true) return;
  assert.deepEqual([...parsed.storeIds].sort(), ["store-a", "store-b"]);
  assert.equal(parsed.entries.length, 2);
});

test("store_id null es una desasignacion valida, no un id a validar", () => {
  const parsed = parseStoreScopeInput({
    meta_ad_accounts: [{ id: "ad-1", store_id: null }],
  });

  assert.equal(parsed.ok, true);
  if (parsed.ok !== true) return;
  assert.deepEqual(parsed.storeIds, []);
});

test("rechaza un cuerpo vacio o sin filas", () => {
  assert.equal(parseStoreScopeInput({}).ok, false);
  assert.equal(
    parseStoreScopeInput({ meta_ad_accounts: [], klaviyo_accounts: [] }).ok,
    false,
  );
});

// Regresion: sin content-type: application/json, Fastify parsea el cuerpo con
// su parser de text/plain y el handler recibe la cadena JSON en crudo. Antes
// caia en "envia al menos una asignacion" y mandaba a buscar el fallo a la UI.
test("un cuerpo que no es objeto se distingue de un cuerpo sin filas", () => {
  const parsed = parseStoreScopeInput(
    '{"meta_ad_accounts":[]}' as unknown as Parameters<
      typeof parseStoreScopeInput
    >[0],
  );

  assert.equal(parsed.ok, false);
  if (parsed.ok !== false) return;
  assert.equal(parsed.error, "invalid_store_scope_body");
});

// El consultor tiene membership virtual con role "consultant": ve los datos del
// cliente pero no reescribe su atribucion. Misma regla que conectar Shopify.
test("un consultor no puede reasignar tiendas", async () => {
  const result = await assignStoreScope(env, context("consultant"), "org-1", {
    meta_ad_accounts: [{ id: "ad-1", store_id: "store-a" }],
  });

  assert.equal(result.ok, false);
  if (result.ok !== false) return;
  assert.equal(result.statusCode, 403);
  assert.equal(result.error, "organization_manage_denied");
});

test("un miembro sin permiso de gestion tampoco", async () => {
  const result = await assignStoreScope(env, context("member"), "org-1", {
    meta_ad_accounts: [{ id: "ad-1", store_id: "store-a" }],
  });

  assert.equal(result.ok, false);
  if (result.ok !== false) return;
  assert.equal(result.statusCode, 403);
});

// Se comprueba antes de tocar la base: el 400 llega sin abrir conexion.
test("el cuerpo vacio falla como 400 aunque el rol sea owner", async () => {
  const result = await assignStoreScope(env, context("owner"), "org-1", {});

  assert.equal(result.ok, false);
  if (result.ok !== false) return;
  assert.equal(result.statusCode, 400);
  assert.equal(result.error, "invalid_store_scope");
});
