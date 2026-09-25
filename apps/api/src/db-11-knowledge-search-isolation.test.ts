/**
 * DB-11/AI-06: "contaminacion cross-tenant" en retrieval semantico estaba
 * listado como gap sin dataset de evaluacion. `knowledge_search` (funcion SQL
 * `stable`, sin `security definer`) confia en que el backend le pase el
 * `target_organization_id` correcto -- no hay RLS de por medio porque se
 * llama con `service_role`. Este test confirma contra el Supabase remoto
 * real que un documento de conocimiento privado de una organizacion NUNCA
 * aparece en una busqueda hecha con el `target_organization_id` de otra
 * organizacion, usando un vector sintetico (no hace falta un embedding real
 * de Voyage para probar aislamiento: la exclusion es por WHERE, no por
 * ranking de similitud).
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

// Vector determinista (no aleatorio) para que el test sea reproducible: un
// impulso en una sola dimension, normalizado. Cosine distance a si mismo = 0,
// asi que si aparece en los resultados sera siempre el mas similar posible.
const SYNTHETIC_EMBEDDING = `[${Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)).join(",")}]`;

let orgOwner = "";
let orgOther = "";
let documentId = "";

before(async () => {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .insert([
      {
        display_name: `DB-11 Owner Org ${RUN_TAG}`,
        slug: `db11-owner-org-${RUN_TAG}`,
        status: "active",
      },
      {
        display_name: `DB-11 Other Org ${RUN_TAG}`,
        slug: `db11-other-org-${RUN_TAG}`,
        status: "active",
      },
    ])
    .select("id, slug");

  if (orgsError || !orgs || orgs.length !== 2) {
    throw new Error(
      `No se pudieron crear las organizaciones de prueba: ${orgsError?.message}`,
    );
  }
  orgOwner = orgs.find((org) => org.slug.startsWith("db11-owner"))!.id;
  orgOther = orgs.find((org) => org.slug.startsWith("db11-other"))!.id;

  const { data: doc, error: docError } = await admin
    .from("knowledge_documents")
    .insert({
      organization_id: orgOwner,
      title: `Documento privado de prueba ${RUN_TAG}`,
      source_type: "manual",
      visibility: "organization",
      checksum: `db11-test-checksum-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    throw new Error(
      `No se pudo crear el documento de prueba: ${docError?.message}`,
    );
  }
  documentId = doc.id;

  const { error: chunkError } = await admin.from("knowledge_chunks").insert({
    document_id: documentId,
    organization_id: orgOwner,
    chunk_index: 0,
    content:
      "Contenido privado de prueba para aislamiento cross-tenant de RAG.",
    embedding: SYNTHETIC_EMBEDDING,
  });

  if (chunkError) {
    throw new Error(
      `No se pudo crear el chunk de prueba: ${chunkError.message}`,
    );
  }
});

after(async () => {
  await admin.from("organizations").delete().in("id", [orgOwner, orgOther]);
});

test("knowledge_search no devuelve conocimiento privado de otra organizacion", async () => {
  const { data, error } = await admin.rpc("knowledge_search", {
    target_organization_id: orgOther,
    query_embedding: SYNTHETIC_EMBEDDING,
    audience_allowed: ["client_visible"],
    match_count: 50,
  });

  assert.equal(error, null);
  const leaked = (data ?? []).some(
    (row: { document_id: string }) => row.document_id === documentId,
  );
  assert.equal(
    leaked,
    false,
    "el documento privado de otra organizacion aparecio en la busqueda",
  );
});

test("knowledge_search si devuelve el conocimiento privado de su propia organizacion", async () => {
  const { data, error } = await admin.rpc("knowledge_search", {
    target_organization_id: orgOwner,
    query_embedding: SYNTHETIC_EMBEDDING,
    audience_allowed: ["client_visible"],
    match_count: 50,
  });

  assert.equal(error, null);
  const found = (data ?? []).some(
    (row: { document_id: string }) => row.document_id === documentId,
  );
  assert.ok(
    found,
    "el documento propio no aparecio en la busqueda de su propia organizacion",
  );
});

// AI-07 (criterio de cierre): una nota consultant_only nunca es recuperada
// en una conversacion de cliente (audience_allowed=['client_visible']).
test("knowledge_search excluye documentos consultant_only cuando audience_allowed solo trae client_visible", async () => {
  const { error: updateError } = await admin
    .from("knowledge_documents")
    .update({ audience: "consultant_only" })
    .eq("id", documentId);
  assert.equal(updateError, null);

  const clientView = await admin.rpc("knowledge_search", {
    target_organization_id: orgOwner,
    query_embedding: SYNTHETIC_EMBEDDING,
    audience_allowed: ["client_visible"],
    match_count: 50,
  });
  assert.equal(clientView.error, null);
  const leakedToClient = (clientView.data ?? []).some(
    (row: { document_id: string }) => row.document_id === documentId,
  );
  assert.equal(
    leakedToClient,
    false,
    "una nota consultant_only aparecio con audience_allowed=['client_visible']",
  );

  const consultantView = await admin.rpc("knowledge_search", {
    target_organization_id: orgOwner,
    query_embedding: SYNTHETIC_EMBEDDING,
    audience_allowed: ["client_visible", "consultant_only"],
    match_count: 50,
  });
  assert.equal(consultantView.error, null);
  const visibleToConsultant = (consultantView.data ?? []).some(
    (row: { document_id: string }) => row.document_id === documentId,
  );
  assert.ok(
    visibleToConsultant,
    "el documento consultant_only no aparecio cuando si esta permitido",
  );
});

// AI-07 (criterio de cierre): una memoria con scope store nunca aparece al
// consultar otra tienda de la misma organizacion.
test("knowledge_search excluye documentos de otra tienda de la misma organizacion", async () => {
  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .insert({
      organization_id: orgOwner,
      provider: "shopify",
      status: "connected",
    })
    .select("id")
    .single();
  assert.equal(connectionError, null);

  const { data: store, error: storeError } = await admin
    .from("shopify_stores")
    .insert({
      organization_id: orgOwner,
      connection_id: connection!.id,
      external_shop_id: `db11-store-${RUN_TAG}`,
      myshopify_domain: `db11-store-${RUN_TAG}.myshopify.com`,
      shop_name: `DB-11 store ${RUN_TAG}`,
    })
    .select("id")
    .single();
  assert.equal(storeError, null);

  const { error: updateError } = await admin
    .from("knowledge_documents")
    .update({ audience: "client_visible", store_id: store!.id })
    .eq("id", documentId);
  assert.equal(updateError, null);

  const otherStoreView = await admin.rpc("knowledge_search", {
    target_organization_id: orgOwner,
    query_embedding: SYNTHETIC_EMBEDDING,
    audience_allowed: ["client_visible"],
    target_store_id: "00000000-0000-0000-0000-000000000000",
    match_count: 50,
  });
  assert.equal(otherStoreView.error, null);
  const leakedToOtherStore = (otherStoreView.data ?? []).some(
    (row: { document_id: string }) => row.document_id === documentId,
  );
  assert.equal(
    leakedToOtherStore,
    false,
    "una memoria de tienda aparecio al consultar otra tienda",
  );

  const sameStoreView = await admin.rpc("knowledge_search", {
    target_organization_id: orgOwner,
    query_embedding: SYNTHETIC_EMBEDDING,
    audience_allowed: ["client_visible"],
    target_store_id: store!.id,
    match_count: 50,
  });
  assert.equal(sameStoreView.error, null);
  const foundInOwnStore = (sameStoreView.data ?? []).some(
    (row: { document_id: string }) => row.document_id === documentId,
  );
  assert.ok(
    foundInOwnStore,
    "la memoria de la tienda no aparecio al consultar su propia tienda",
  );
});
