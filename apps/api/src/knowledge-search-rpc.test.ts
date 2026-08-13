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
