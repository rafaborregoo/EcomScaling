/**
 * Piezas del Consultor IA que no son triviales y que fallan en silencio si se
 * rompen:
 *
 *  1. `rankOrdersByStore`: el ranking de TIENDAS del Dashboard ordena por
 *     numero de pedidos, no por facturacion (que es lo que hace el ranking de
 *     clientes). Si alguien "unifica" los dos criterios, el widget sigue
 *     pintando filas y nadie se entera de que ya no responde la pregunta.
 *  2. `sanitizeChatViewContext`: frontera de confianza. Lo que llega es del
 *     cliente, asi que acotar longitudes y numero de metricas es la unica
 *     defensa contra un contexto inflado, y devolver null cuando no hay
 *     contenido evita meter un bloque vacio en el prompt.
 *  3. `resolveChatKnowledgeAudience` y el gate de `createKnowledgeDocument`:
 *     los dos extremos del material `consultant_only` (AI-07). Si el primero
 *     se relaja, el owner de un cliente extrae notas internas preguntandole al
 *     chat; si el segundo se relaja, puede fabricarlas. Ninguno de los dos
 *     fallos da error visible: simplemente se filtra o se oculta de mas.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { rankOrdersByStore } from "./consultant.js";
import {
  resolveChatKnowledgeAudience,
  resolveChatStoreSelection,
  sanitizeChatViewContext,
} from "./ai-runtime.js";
import { createKnowledgeDocument } from "./knowledge.js";
import type { AuthContext } from "./auth-context.js";

const organizations = [
  { id: "org-1", display_name: "Tienda Norte" },
  { id: "org-2", display_name: "Tienda Sur" },
];

test("el ranking de tiendas ordena por pedidos, no por facturacion", () => {
  const rows = rankOrdersByStore(organizations, [
    {
      store_id: "store-caro",
      organization_id: "org-1",
      shop_name: "Caro",
      myshopify_domain: "caro.myshopify.com",
      currency_code: "EUR",
      orders_count: 10,
      net_sales: 5000,
      units_sold: 12,
    },
    {
      store_id: "store-volumen",
      organization_id: "org-2",
      shop_name: "Volumen",
      myshopify_domain: "volumen.myshopify.com",
      currency_code: "EUR",
      orders_count: 40,
      net_sales: 2000,
      units_sold: 90,
    },
    {
      store_id: "store-sin-pedidos",
      organization_id: "org-1",
      shop_name: "Parada",
      myshopify_domain: "parada.myshopify.com",
      currency_code: "EUR",
      orders_count: 0,
      net_sales: 0,
      units_sold: 0,
    },
  ]);

  assert.deepEqual(
    rows.map((row) => row.store_id),
    ["store-volumen", "store-caro"],
    "la tienda con mas pedidos va primera aunque facture menos",
  );
  assert.equal(rows[0]?.organization_name, "Tienda Sur");
  assert.equal(rows[0]?.aov, 50);
  assert.equal(rows[1]?.aov, 500);
});

test("el ranking de tiendas empata por facturacion y tolera numeros como texto", () => {
  const rows = rankOrdersByStore(organizations, [
    {
      store_id: "store-a",
      organization_id: "org-1",
      shop_name: "A",
      myshopify_domain: null,
      currency_code: null,
      orders_count: "7",
      net_sales: "100",
      units_sold: "7",
    },
    {
      store_id: "store-b",
      organization_id: "org-1",
      shop_name: "B",
      myshopify_domain: null,
      currency_code: null,
      orders_count: 7,
      net_sales: 900,
      units_sold: 7,
    },
  ]);

  assert.deepEqual(
    rows.map((row) => row.store_id),
    ["store-b", "store-a"],
  );
  assert.equal(rows[1]?.currency_code, "EUR", "sin divisa se asume EUR");
});

test("el contexto de vista se acota y descarta metricas incompletas", () => {
  const view = sanitizeChatViewContext({
    route: "/dashboard",
    title: "Dashboard",
    store_label: "tienda.myshopify.com",
    period: "Últimos 30 días",
    metrics: [
      { label: "Ventas netas", value: "12.000 €" },
      { label: "Sin valor" },
      { value: "Sin etiqueta" },
      ...Array.from({ length: 30 }, (_, index) => ({
        label: `Relleno ${index}`,
        value: "1",
      })),
    ],
    notes: "x".repeat(2000),
  });

  assert.ok(view);
  assert.equal(view.route, "/dashboard");
  assert.equal(view.metrics.length, 12, "como maximo 12 metricas");
  assert.equal(view.metrics[0]?.label, "Ventas netas");
  assert.ok(
    view.metrics.every((metric) => metric.label && metric.value),
    "las metricas a medias no viajan al modelo",
  );
  assert.equal(view.notes?.length, 500, "las notas se recortan a 500 chars");
});

test("un contexto de vista sin contenido util no genera bloque", () => {
  assert.equal(sanitizeChatViewContext(undefined), null);
  assert.equal(sanitizeChatViewContext({}), null);
  assert.equal(
    sanitizeChatViewContext({ route: "   ", metrics: [] }),
    null,
    "solo espacios en blanco no es contexto",
  );
  assert.equal(
    sanitizeChatViewContext({ route: 42, metrics: "no-es-lista" }),
    null,
    "tipos que no son los esperados se ignoran en vez de reventar",
  );
});

test("A09 conserva una tienda seleccionada y no confunde IDs inválidos con todas las tiendas", () => {
  const connectionId = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(resolveChatStoreSelection(undefined), { kind: "none" });
  assert.deepEqual(resolveChatStoreSelection({ store_id: null }), { kind: "none" });
  assert.deepEqual(resolveChatStoreSelection({ store_id: connectionId }), {
    kind: "selected",
    connectionId,
  });
  assert.deepEqual(resolveChatStoreSelection({ store_id: "not-a-uuid" }), {
    kind: "invalid",
  });
  assert.deepEqual(resolveChatStoreSelection({ store_id: 42 }), {
    kind: "invalid",
  });

  const view = sanitizeChatViewContext({ store_id: connectionId });
  assert.equal(view?.store_id, connectionId, "la tienda por sí sola cuenta como contexto útil");
});

// --- AI-07: quien pregunta decide que conocimiento se recupera -------------

test("solo consultor y platform admin amplian la audiencia a consultant_only", () => {
  assert.deepEqual(resolveChatKnowledgeAudience("consultant"), [
    "client_visible",
    "consultant_only",
  ]);
  assert.deepEqual(resolveChatKnowledgeAudience("platform_admin"), [
    "client_visible",
    "consultant_only",
  ]);
  // El chat del Consultor IA lo abre cualquier miembro de la organizacion,
  // incluido el owner del cliente: para el, el material interno no existe.
  for (const role of ["owner", "client", "member", ""]) {
    assert.deepEqual(
      resolveChatKnowledgeAudience(role),
      ["client_visible"],
      `el rol ${role || "(vacio)"} no puede leer notas internas`,
    );
  }
});

// --- Marcar un documento como interno al subirlo ---------------------------

const knowledgeOrganizationId = "org-conocimiento";
const knowledgeEnv = {} as Parameters<typeof createKnowledgeDocument>[0];

function knowledgeContext(platformRole: string): AuthContext {
  return {
    user: { id: "user-conocimiento" },
    profile: {
      id: "user-conocimiento",
      full_name: null,
      avatar_url: null,
      platform_role: platformRole,
      is_active: true,
    },
    memberships: [
      {
        organization_id: knowledgeOrganizationId,
        role: "owner",
        accessSource: "membership",
        organization: null,
      },
    ],
    subscriptions: [],
  } as unknown as AuthContext;
}

const internalDocument = {
  title: "Criterios internos de pricing",
  content: "No compartir con el cliente.",
  source_type: "upload",
  audience: "consultant_only",
};

test("un owner del cliente no puede crear conocimiento oculto para su propia organizacion", async () => {
  const result = await createKnowledgeDocument(
    knowledgeEnv,
    knowledgeContext("owner"),
    knowledgeOrganizationId,
    internalDocument,
  );

  assert.equal(result.ok, false);
  assert.equal(result.ok === false ? result.statusCode : null, 403);
  assert.equal(
    result.ok === false ? result.error : null,
    "consultant_only_denied",
  );
});

test("un consultor si puede, y una audiencia inventada se rechaza antes de tocar nada", async () => {
  // Sin VOYAGE_API_KEY el flujo se para en los embeddings: llegar hasta ahi ya
  // demuestra que el gate de audiencia dejo pasar al consultor.
  const allowed = await createKnowledgeDocument(
    knowledgeEnv,
    knowledgeContext("consultant"),
    knowledgeOrganizationId,
    internalDocument,
  );
  assert.equal(allowed.ok, false);
  assert.equal(
    allowed.ok === false ? allowed.error : null,
    "embeddings_not_configured",
    "el consultor paso el gate de audiencia",
  );

  const invalid = await createKnowledgeDocument(
    knowledgeEnv,
    knowledgeContext("consultant"),
    knowledgeOrganizationId,
    { ...internalDocument, audience: "system_only" },
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.ok === false ? invalid.error : null, "audience_invalida");
});
