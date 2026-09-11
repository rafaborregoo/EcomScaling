/**
 * El reranking falla callando por los dos lados.
 *
 * Si se aplica mal el orden, la cita que ve el consultor apunta a un fragmento
 * distinto del que el modelo leyó — y nada da error. Si se trata como una
 * dependencia en vez de como una mejora, un 429 del proveedor deja la búsqueda
 * de conocimiento vacía y el agente responde "no tengo información" con el
 * índice lleno.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyRerank,
  normalizeRerankResults,
  RAG_RERANK_PROFILE,
  RERANK_RESILIENCE_POLICY,
} from "./index.js";

const rows = ["cero", "uno", "dos", "tres"];

test("el orden del reranker manda sobre el del retrieval", () => {
  const ranked = normalizeRerankResults(
    [
      { index: 2, relevance_score: 0.9 },
      { index: 0, relevance_score: 0.4 },
    ],
    rows.length,
    2,
  );
  assert.deepEqual(applyRerank(rows, ranked, 2), ["dos", "cero"]);
});

test("se reordena aunque la respuesta llegue desordenada", () => {
  // El contrato de la API es que devuelve los mejores, no en qué orden los
  // serializa: el orden se reimpone aquí.
  const ranked = normalizeRerankResults(
    [
      { index: 1, relevance_score: 0.2 },
      { index: 3, relevance_score: 0.95 },
    ],
    rows.length,
    2,
  );
  assert.deepEqual(applyRerank(rows, ranked, 2), ["tres", "uno"]);
});

test("un indice fuera de rango se descarta en vez de colar un hueco", () => {
  // Sin este filtro, applyRerank metería `undefined` en la lista y el
  // fragmento saldría vacío en una cita, sin error en ningún sitio.
  const ranked = normalizeRerankResults(
    [
      { index: 99, relevance_score: 0.99 },
      { index: -1, relevance_score: 0.98 },
      { index: 1, relevance_score: 0.5 },
    ],
    rows.length,
    3,
  );
  assert.deepEqual(ranked, [{ index: 1, score: 0.5 }]);
  assert.deepEqual(applyRerank(rows, ranked, 3), ["uno"]);
});

test("una puntuacion no numerica descarta ese candidato", () => {
  const ranked = normalizeRerankResults(
    [
      { index: 0, relevance_score: "muy relevante" },
      { index: 2, relevance_score: 0.7 },
    ],
    rows.length,
    2,
  );
  assert.deepEqual(ranked, [{ index: 2, score: 0.7 }]);
});

test("sin reranking utilizable se conserva el orden del retrieval", () => {
  // Este es el caso del proveedor caído o sin cuota: peor orden, nunca vacío.
  assert.deepEqual(applyRerank(rows, [], 2), ["cero", "uno"]);
  assert.deepEqual(
    applyRerank(rows, normalizeRerankResults(undefined, rows.length, 2), 2),
    ["cero", "uno"],
  );
});

test("nunca se devuelven mas filas de las pedidas", () => {
  const ranked = normalizeRerankResults(
    rows.map((_, index) => ({ index, relevance_score: 1 - index / 10 })),
    rows.length,
    rows.length,
  );
  assert.equal(applyRerank(rows, ranked, 2).length, 2);
  assert.equal(applyRerank(rows, [], 2).length, 2);
});

test("el perfil de reranking no puede pedir mas candidatos de los que da el SQL", () => {
  // knowledge_search_hybrid corta en 50: pedir mas seria pagar latencia por
  // filas que la funcion no va a devolver nunca.
  assert.ok(RAG_RERANK_PROFILE.maxCandidates <= 50);
  assert.ok(RAG_RERANK_PROFILE.candidateFactor > 1);
});

test("el reranker no puede colgar una busqueda", () => {
  // Está en la latencia de cada búsqueda: si tarda más que el propio
  // retrieval, ordenar mejor sale peor.
  assert.ok(RERANK_RESILIENCE_POLICY.timeoutMs <= 10_000);
  assert.ok(RERANK_RESILIENCE_POLICY.maxRetries <= 1);
});
