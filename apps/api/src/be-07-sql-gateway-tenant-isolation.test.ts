/**
 * BE-07/AI-03: "sin evals adversariales: intento cross-tenant" era un gap
 * listado sin ningun test. El diseno de dos capas (`sql-gateway.ts` valida el
 * AST en Node; las vistas de `ai.*` filtran SIEMPRE por
 * `private.gateway_org_id()` a nivel de base de datos) esta pensado para que
 * ni un bug en la validacion de Node pueda filtrar datos cross-tenant. Este
 * test llama a `agent_sql_gateway` **directamente por RPC, sin pasar por la
 * validacion Node** -- exactamente el escenario "si la validacion de Node
 * fallara" que describe el comentario de la migracion -- y confirma que la
 * capa de base de datos sola ya es suficiente.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Ejecutar
 * con `npm run test:remote -w @e-nora/api` en un proyecto aislado.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";

const env = loadApiEnv(process.env);

const admin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const RUN_TAG = `${Date.now()}`;

let orgA = "";
let orgB = "";
let storeAId = "";
let storeBId = "";

async function createStore(organizationId: string, label: string) {
  const shopDomain = `be07-gateway-test-${label}-${RUN_TAG}.myshopify.com`;

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .insert({
      organization_id: organizationId,
      provider: "shopify",
      provider_account_id: shopDomain,
      status: "connected",
    })
    .select("id")
    .single();

  if (connectionError || !connection) {
    throw new Error(
      `No se pudo crear la conexion de prueba (${label}): ${connectionError?.message}`,
    );
  }

  const { data: store, error: storeError } = await admin
    .from("shopify_stores")
    .insert({
      organization_id: organizationId,
      connection_id: connection.id,
      external_shop_id: `be07-test-shop-${label}-${RUN_TAG}`,
      myshopify_domain: shopDomain,
      shop_name: `BE-07 Gateway Test Store ${label} ${RUN_TAG}`,
    })
    .select("id")
    .single();

  if (storeError || !store) {
    throw new Error(
      `No se pudo crear la tienda de prueba (${label}): ${storeError?.message}`,
    );
  }

  return store.id as string;
}

before(async () => {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .insert([
      {
        display_name: `BE-07 Gateway Org A ${RUN_TAG}`,
        slug: `be07-gateway-org-a-${RUN_TAG}`,
        status: "active",
      },
      {
        display_name: `BE-07 Gateway Org B ${RUN_TAG}`,
        slug: `be07-gateway-org-b-${RUN_TAG}`,
        status: "active",
      },
    ])
    .select("id, slug");

  if (orgsError || !orgs || orgs.length !== 2) {
    throw new Error(
      `No se pudieron crear las organizaciones de prueba: ${orgsError?.message}`,
    );
  }
  orgA = orgs.find((org) => org.slug.startsWith("be07-gateway-org-a"))!.id;
  orgB = orgs.find((org) => org.slug.startsWith("be07-gateway-org-b"))!.id;

  storeAId = await createStore(orgA, "a");
  storeBId = await createStore(orgB, "b");
});

after(async () => {
  await admin.from("organizations").delete().in("id", [orgA, orgB]);
});

test("agent_sql_gateway con target_organization_id=A nunca devuelve la tienda de B, aunque el SQL la pida por id explicito", async () => {
  const { data, error } = await admin.rpc("agent_sql_gateway", {
    target_organization_id: orgA,
    query_sql: `select * from shopify_stores where id = '${storeBId}'`,
    max_rows: 50,
  });

  assert.equal(error, null);
  const rows = (data as { rows: unknown[] }).rows;
  assert.deepEqual(
    rows,
    [],
    "el filtro de tenant de la vista ai.shopify_stores debe ganar sobre el WHERE del atacante",
  );
});

test("agent_sql_gateway con target_organization_id=A solo devuelve las tiendas de A", async () => {
  const { data, error } = await admin.rpc("agent_sql_gateway", {
    target_organization_id: orgA,
    query_sql: "select id from shopify_stores",
    max_rows: 50,
  });

  assert.equal(error, null);
  const ids = (data as { rows: Array<{ id: string }> }).rows.map(
    (row) => row.id,
  );
  assert.deepEqual(ids, [storeAId]);
});

// AI-03: el gap documentado era que ningun test automatizado ejecutara dos
// llamadas RPC consecutivas de organizaciones distintas sobre el mismo
// cliente/conexion, para confirmar que el GUC de tenant fijado dentro de
// `agent_sql_gateway` (set_config con is_local => true, una transaccion por
// invocacion) no puede sobrevivir de una llamada a la siguiente. Este test
// alterna A/B/A varias veces seguidas sobre el mismo `admin` client.
test("llamadas RPC consecutivas de A y B, alternadas, nunca filtran el GUC de tenant entre si", async () => {
  const asOrg = async (organizationId: string, expectedStoreId: string) => {
    const { data, error } = await admin.rpc("agent_sql_gateway", {
      target_organization_id: organizationId,
      query_sql: "select id from shopify_stores",
      max_rows: 50,
    });

    assert.equal(error, null);
    const ids = (data as { rows: Array<{ id: string }> }).rows.map(
      (row) => row.id,
    );
    assert.deepEqual(ids, [expectedStoreId]);
  };

  await asOrg(orgA, storeAId);
  await asOrg(orgB, storeBId);
  await asOrg(orgA, storeAId);
  await asOrg(orgB, storeBId);
  await asOrg(orgA, storeAId);
});
