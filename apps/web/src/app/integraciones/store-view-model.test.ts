/**
 * La lista de tiendas de /integraciones.
 *
 * Lo que importa comprobar es que ninguna tienda hereda el estado de otra: el
 * backend manda `provider.health` con el de su PEOR tienda, y la vista anterior
 * lo pintaba como si fuera el de todas. Una tienda sana salia en rojo por culpa
 * de la de al lado, y el consultor abria la que no era.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { IntegrationConnection, IntegrationsResponse } from "./shared";
import type { StoreScope } from "./store-scope-model";
import {
  buildStoreViews,
  explainError,
  explainHealth,
  looksLikeErrorCode,
  unassignedConnections,
} from "./store-view-model";

function connection(
  partial: Partial<IntegrationConnection> & { id: string },
): IntegrationConnection {
  return {
    provider_account_id: null,
    provider_account_name: null,
    status: "connected",
    scopes: [],
    api_version: null,
    connected_at: null,
    last_sync_at: null,
    last_error_message: null,
    latest_sync: null,
    health: { status: "healthy", lastSyncAt: null },
    activation: { ready: true, missing: [] },
    ...partial,
  };
}

function provider(
  id: string,
  connections: IntegrationConnection[],
  available = true,
) {
  return {
    id,
    name: id,
    phase: "",
    description: "",
    available,
    feature_flag: "",
    configuration: { status: "configured" as const, reason: "" },
    capabilities: {
      oauth: true,
      tokenRefresh: true,
      webhooks: true,
      initialSync: true,
      incrementalSync: true,
      assetSelection: true,
    },
    health: connections[0]?.health ?? { status: "unknown", lastSyncAt: null },
    activation: { ready: true, missing: [] },
    connection: connections[0] ?? null,
    connections,
    latest_sync: null,
  };
}

function payloadWith(providers: ReturnType<typeof provider>[]): IntegrationsResponse {
  return {
    organization_id: "org",
    schema_ready: true,
    shopify_custom_app_available: false,
    meta_app_available: true,
    klaviyo_app_available: true,
    providers,
  };
}

const scope: StoreScope = {
  stores: [
    {
      id: "store-a",
      connection_id: "conn-a",
      myshopify_domain: "a.myshopify.com",
      shop_name: "Tienda A",
    },
    {
      id: "store-b",
      connection_id: "conn-b",
      myshopify_domain: "b.myshopify.com",
      shop_name: "Tienda B",
    },
  ],
  meta_ad_accounts: [
    { id: "acc-meta", connection_id: "conn-meta-b", store_id: "store-b" },
  ],
  klaviyo_accounts: [],
  store_count: 2,
  unassigned_count: 0,
};

test("cada tienda lleva solo el estado de SU conexion de Shopify", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [
        connection({
          id: "conn-a",
          health: { status: "healthy", lastSyncAt: null },
        }),
        connection({
          id: "conn-b",
          health: {
            status: "reauthorization_required",
            reason: "authorization_revoked",
            lastSyncAt: null,
          },
        }),
      ]),
    ]),
    scope,
  );

  const a = views.find((view) => view.connectionId === "conn-a");
  const b = views.find((view) => view.connectionId === "conn-b");

  assert.equal(a?.providers[0].status, "healthy");
  // No usar Meta ni Klaviyo no es una incidencia de esta tienda.
  assert.equal(a?.severity, 0);
  assert.equal(b?.providers[0].status, "reauthorization_required");
  assert.equal(b?.providers[0].explanation.fix, "reconnect");
});

test("la peor tienda se lee la primera", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [
        connection({ id: "conn-a" }),
        connection({
          id: "conn-b",
          health: { status: "error", lastSyncAt: null },
        }),
      ]),
    ]),
    scope,
  );

  assert.equal(views[0].connectionId, "conn-b");
});

test("la cuenta de Meta se cuelga de la tienda a la que esta asignada", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [
        connection({ id: "conn-a" }),
        connection({ id: "conn-b" }),
      ]),
      provider("meta_ads", [connection({ id: "conn-meta-b" })]),
    ]),
    scope,
  );

  const a = views.find((view) => view.connectionId === "conn-a");
  const b = views.find((view) => view.connectionId === "conn-b");

  assert.deepEqual(
    a?.providers[1].connections.map((item) => item.id),
    [],
  );
  assert.equal(a?.providers[1].explanation.label, "Sin conectar");
  assert.deepEqual(
    b?.providers[1].connections.map((item) => item.id),
    ["conn-meta-b"],
  );
});

test("una tienda conectada sin fila en shopify_stores sigue apareciendo", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [
        connection({
          id: "conn-nueva",
          provider_account_id: "nueva.myshopify.com",
          status: "pending",
          health: {
            status: "unknown",
            reason: "authorization_pending",
            lastSyncAt: null,
          },
        }),
      ]),
    ]),
    scope,
  );

  assert.equal(views.length, 1);
  assert.equal(views[0].name, "nueva.myshopify.com");
});

test("autorizar ahora mismo no es una tienda rota", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [
        connection({
          id: "conn-a",
          status: "pending",
          connected_at: null,
          created_at: new Date(Date.now() - 60_000).toISOString(),
          health: {
            status: "unknown",
            reason: "authorization_pending",
            lastSyncAt: null,
          },
        }),
      ]),
    ]),
    scope,
  );

  assert.equal(views[0].providers[0].attempt, "in_progress");
  assert.equal(views[0].providers[0].explanation.label, "Autorización en curso");
  assert.equal(views[0].providers[0].explanation.fix, "wait");
  // Lo que no puede es contar como incidencia mientras la persona tiene la
  // pantalla de permisos de Shopify abierta delante.
  assert.equal(views[0].severity, 0);
});

test("un intento que nadie termino se ofrece para descartar", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [
        connection({
          id: "conn-a",
          status: "pending",
          connected_at: null,
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          health: {
            status: "unknown",
            reason: "authorization_pending",
            lastSyncAt: null,
          },
        }),
      ]),
    ]),
    scope,
  );

  assert.equal(views[0].providers[0].attempt, "abandoned");
  assert.equal(views[0].providers[0].explanation.label, "Sin terminar");
  assert.equal(views[0].providers[0].explanation.fix, "discard");
  assert.equal(views[0].providers[0].target?.id, "conn-a");
  assert.ok(views[0].severity > 0);
});

test("una tienda conectada de verdad nunca se ofrece para descartar", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [
        connection({
          id: "conn-a",
          status: "connected",
          connected_at: new Date(Date.now() - 86_400_000).toISOString(),
          created_at: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      ]),
    ]),
    scope,
  );

  assert.equal(views[0].providers[0].attempt, null);
  assert.notEqual(views[0].providers[0].explanation.fix, "discard");
});

test("una conexion sin tienda asignada no se cuenta como tienda", () => {
  const payload = payloadWith([
    provider("shopify", [connection({ id: "conn-a" })]),
    provider("meta_ads", [
      connection({ id: "conn-meta-b" }),
      connection({ id: "conn-meta-huerfana" }),
    ]),
  ]);

  assert.equal(buildStoreViews(payload, scope).length, 1);
  assert.deepEqual(
    unassignedConnections(payload, scope).map((item) => item.connection.id),
    ["conn-meta-huerfana"],
  );
});

test("con una sola tienda, lo que no esta asignado es de esa tienda", () => {
  const unaTienda: StoreScope = {
    stores: [scope.stores[0]],
    meta_ad_accounts: [
      { id: "acc-meta", connection_id: "conn-meta", store_id: null },
    ],
    klaviyo_accounts: [],
    store_count: 1,
    unassigned_count: 1,
  };
  const payload = payloadWith([
    provider("shopify", [connection({ id: "conn-a" })]),
    provider("meta_ads", [connection({ id: "conn-meta" })]),
  ]);

  const views = buildStoreViews(payload, unaTienda);

  assert.deepEqual(
    views[0].providers[1].connections.map((item) => item.id),
    ["conn-meta"],
  );
  // Y entonces no puede anunciarse a la vez como una cuenta huerfana.
  assert.deepEqual(unassignedConnections(payload, unaTienda), []);
});

test("con dos tiendas, lo que no esta asignado no se le adjudica a ninguna", () => {
  const dosTiendas: StoreScope = {
    ...scope,
    meta_ad_accounts: [
      { id: "acc-meta", connection_id: "conn-meta", store_id: null },
    ],
  };
  const payload = payloadWith([
    provider("shopify", [
      connection({ id: "conn-a" }),
      connection({ id: "conn-b" }),
    ]),
    provider("meta_ads", [connection({ id: "conn-meta" })]),
  ]);

  const views = buildStoreViews(payload, dosTiendas);

  assert.deepEqual(views[0].providers[1].connections, []);
  assert.deepEqual(views[1].providers[1].connections, []);
  assert.deepEqual(
    unassignedConnections(payload, dosTiendas).map(
      (item) => item.connection.id,
    ),
    ["conn-meta"],
  );
});

test("un conector cerrado no se anuncia como algo que arreglar", () => {
  const views = buildStoreViews(
    payloadWith([
      provider("shopify", [connection({ id: "conn-a" })]),
      provider("klaviyo", [], false),
    ]),
    scope,
  );

  assert.equal(views[0].providers[2].explanation.label, "Aún no disponible");
  assert.equal(views[0].providers[2].explanation.fix, null);
});

test("un codigo interno se traduce; una frase escrita se respeta", () => {
  assert.equal(looksLikeErrorCode("meta_sync_partial_failure"), true);
  assert.equal(looksLikeErrorCode("No se pudo renovar el token."), false);

  assert.match(
    explainError("meta_sync_partial_failure")!.text,
    /solo una parte de los datos/,
  );
  assert.equal(
    explainError("meta_sync_partial_failure")!.technical,
    "meta_sync_partial_failure",
  );

  const frase = "No se pudo renovar el token de Shopify. Reconecta la tienda.";
  assert.equal(explainError(frase)!.text, frase);
  assert.equal(explainError(frase)!.technical, null);

  assert.equal(explainError(null), null);
  assert.equal(explainError("   "), null);
});

test("un codigo desconocido no se le ensena a nadie en crudo", () => {
  const explained = explainError("klaviyo_weird_new_code")!;
  assert.doesNotMatch(explained.text, /klaviyo_weird_new_code/);
  assert.equal(explained.technical, "klaviyo_weird_new_code");
});

test("el antiguo fallo al guardar imagen de variante explica que hay que actualizar el worker", () => {
  const raw =
    'catalog: shopify_variant_media_upsert_failed: null value in column "organization_id" of relation "shopify_variants" violates not-null constraint';
  const explained = explainError(raw)!;
  assert.match(explained.text, /actualizar el worker de Shopify y repetir la sincronización/);
  assert.equal(explained.technical, raw);
});

test("sin reason conocido se cae al estado, nunca a un hueco en blanco", () => {
  const explained = explainHealth({ status: "algo_nuevo" });
  assert.equal(typeof explained.detail, "string");
  assert.notEqual(explained.label, "");
});
