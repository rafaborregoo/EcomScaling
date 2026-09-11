import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeKnowledgeSearch } from "./knowledge.js";

const input = {
  targetOrganizationId: "org-1",
  queryEmbedding: "[0.1,0.2]",
  queryText: "margen de contribución",
  audienceAllowed: ["client_visible"],
  targetStoreId: "store-1",
  matchCount: 8,
};

function fakeSupabase(rpc: (...args: any[]) => Promise<unknown>) {
  return { rpc } as unknown as SupabaseClient;
}

test("usa el RPC híbrido cuando la migración ya está disponible", async () => {
  const calls: string[] = [];
  const result = await executeKnowledgeSearch(
    fakeSupabase(async (name) => {
      calls.push(name);
      return { data: [{ chunk_id: "chunk-1" }], error: null };
    }),
    input,
  );

  assert.deepEqual(calls, ["knowledge_search_hybrid"]);
  assert.equal(result.error, null);
});

test("cae al RPC anterior solo cuando el híbrido aún no existe", async () => {
  const calls: string[] = [];
  const result = await executeKnowledgeSearch(
    fakeSupabase(async (name) => {
      calls.push(name);
      if (name === "knowledge_search_hybrid") {
        return { data: null, error: { message: "Could not find the function public.knowledge_search_hybrid in the schema cache" } };
      }
      return { data: [{ chunk_id: "chunk-legacy" }], error: null };
    }),
    input,
  );

  assert.deepEqual(calls, ["knowledge_search_hybrid", "knowledge_search"]);
  assert.equal(result.error, null);
  assert.equal(result.data?.[0]?.chunk_id, "chunk-legacy");
});

test("no oculta errores reales del RPC híbrido", async () => {
  const calls: string[] = [];
  const result = await executeKnowledgeSearch(
    fakeSupabase(async (name) => {
      calls.push(name);
      return { data: null, error: { message: "permission denied for function knowledge_search_hybrid" } };
    }),
    input,
  );

  assert.deepEqual(calls, ["knowledge_search_hybrid"]);
  assert.match(result.error?.message ?? "", /permission denied/);
});

// --- Retrieval de dos fases -------------------------------------------------
//
// El reranker vive dentro de este limite compartido para que la busqueda
// humana y la tool del agente ordenen igual. Lo que se prueba aqui es lo que
// falla callando: cuantos candidatos se piden, que el orden se aplique de
// verdad, y que un reranker caido devuelva peor orden y no una busqueda vacia.

function rerankerThatPicks(order: number[], seen: { count?: number } = {}) {
  return {
    async rerank(_query: string, documents: string[], topK: number) {
      seen.count = documents.length;
      return order
        .slice(0, topK)
        .map((index, position) => ({ index, score: 1 - position / 10 }));
    },
  };
}

test("sin reranker se pide exactamente lo que se va a devolver", async () => {
  let asked: number | undefined;
  await executeKnowledgeSearch(
    fakeSupabase(async (_name, args: any) => {
      asked = args.match_count;
      return { data: [], error: null };
    }),
    input,
  );

  assert.equal(asked, 8);
});

test("con reranker se piden mas candidatos de los que se devuelven", async () => {
  let asked: number | undefined;
  const rows = Array.from({ length: 32 }, (_, index) => ({
    chunk_id: `chunk-${index}`,
    content: `fragmento ${index}`,
  }));
  const seen: { count?: number } = {};

  const result = await executeKnowledgeSearch(
    fakeSupabase(async (_name, args: any) => {
      asked = args.match_count;
      return { data: rows, error: null };
    }),
    input,
    rerankerThatPicks([5, 1, 0], seen),
  );

  // 8 finales x factor 4 = 32 candidatos, y el reranker los ve todos.
  assert.equal(asked, 32);
  assert.equal(seen.count, 32);
  // El orden del reranker manda: el quinto candidato pasa a ser el primero.
  assert.deepEqual(
    (result.data ?? []).map((row: any) => row.chunk_id),
    ["chunk-5", "chunk-1", "chunk-0"],
  );
});

test("un reranker caido devuelve peor orden, nunca una busqueda vacia", async () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    chunk_id: `chunk-${index}`,
    content: `fragmento ${index}`,
  }));

  const result = await executeKnowledgeSearch(
    fakeSupabase(async () => ({ data: rows, error: null })),
    input,
    {
      async rerank() {
        throw Object.assign(new Error("voyage_rerank_failed: 429"), {
          status: 429,
        });
      },
    },
  );

  assert.equal(result.error, null);
  // Los 8 de siempre, en el orden del retrieval.
  assert.equal(result.data?.length, 8);
  assert.equal(result.data?.[0]?.chunk_id, "chunk-0");
});

test("el reranker no se llama cuando no hay nada que ordenar", async () => {
  let called = false;
  const result = await executeKnowledgeSearch(
    fakeSupabase(async () => ({ data: [{ chunk_id: "solo", content: "x" }], error: null })),
    input,
    {
      async rerank() {
        called = true;
        return [];
      },
    },
  );

  assert.equal(called, false);
  assert.equal(result.data?.length, 1);
});

test("un error del RPC no se enmascara por tener reranker", async () => {
  const result = await executeKnowledgeSearch(
    fakeSupabase(async () => ({
      data: null,
      error: { message: "permission denied for function knowledge_search_hybrid" },
    })),
    input,
    rerankerThatPicks([0]),
  );

  assert.match(result.error?.message ?? "", /permission denied/);
});
