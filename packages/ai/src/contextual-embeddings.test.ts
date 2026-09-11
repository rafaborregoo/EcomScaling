/**
 * El aplanado de embeddings contextualizados es el punto del RAG donde un
 * fallo es invisible y permanente.
 *
 * La respuesta llega anidada (documentos -> fragmentos) y hay que devolverla
 * como una lista plana EN EL ORDEN en que se mandaron los fragmentos, porque
 * quien llama hace `chunks[i] -> vectors[i]`. Si falta un vector o el orden
 * baila, el fragmento 5 se guarda con el vector del 6: Postgres lo acepta, la
 * busqueda funciona, y los resultados quedan sutilmente equivocados para
 * siempre sin un solo error en los logs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createRagEmbeddingProvider,
  flattenContextualEmbeddings,
  RAG_EMBEDDING_PROFILE,
  VoyageContextualEmbeddingProvider,
  VoyageEmbeddingProvider,
} from "./index.js";

const DIMS = 4;
const vector = (seed: number) => [seed, seed, seed, seed];

test("aplana documento -> fragmentos en el orden en que se mandaron", () => {
  const flat = flattenContextualEmbeddings(
    [
      {
        index: 0,
        data: [
          { index: 0, embedding: vector(1) },
          { index: 1, embedding: vector(2) },
          { index: 2, embedding: vector(3) },
        ],
      },
    ],
    3,
    DIMS,
  );

  assert.deepEqual(flat, [vector(1), vector(2), vector(3)]);
});

test("reordena si la respuesta llega desordenada", () => {
  // El orden se reimpone por `index` en vez de confiar en la serializacion:
  // es exactamente el fallo que desalinea chunk y vector.
  const flat = flattenContextualEmbeddings(
    [
      {
        index: 0,
        data: [
          { index: 2, embedding: vector(3) },
          { index: 0, embedding: vector(1) },
          { index: 1, embedding: vector(2) },
        ],
      },
    ],
    3,
    DIMS,
  );

  assert.deepEqual(flat, [vector(1), vector(2), vector(3)]);
});

test("un vector de menos revienta en vez de desalinear en silencio", () => {
  assert.throws(
    () =>
      flattenContextualEmbeddings(
        [{ index: 0, data: [{ index: 0, embedding: vector(1) }] }],
        2,
        DIMS,
      ),
    /count_mismatch: pedidos 2, devueltos 1/,
  );
});

test("un ancho distinto revienta antes de llegar a la columna vector", () => {
  // Sin esto el error saldria de Postgres, a mitad de una ingesta, sin decir
  // que fragmento ni con que ancho.
  assert.throws(
    () =>
      flattenContextualEmbeddings(
        [
          {
            index: 0,
            data: [
              { index: 0, embedding: vector(1) },
              { index: 1, embedding: [1, 2] },
            ],
          },
        ],
        2,
        DIMS,
      ),
    /dimension_mismatch: fragmento 1 con 2 dimensiones, se esperaban 4/,
  );
});

test("una respuesta vacia no se cuela como exito", () => {
  assert.throws(
    () => flattenContextualEmbeddings(undefined, 1, DIMS),
    /count_mismatch/,
  );
  assert.deepEqual(flattenContextualEmbeddings([], 0, DIMS), []);
});

test("la fabrica elige el proveedor por el modelo, no por configuracion aparte", () => {
  // Si esto se equivoca, /v1/embeddings devuelve 400 para los context-* y la
  // ingesta entera falla; al reves, un modelo clasico contra el endpoint
  // contextualizado tambien.
  assert.ok(
    createRagEmbeddingProvider("k", "voyage-context-4") instanceof
      VoyageContextualEmbeddingProvider,
  );
  assert.ok(
    createRagEmbeddingProvider("k", "voyage-4") instanceof
      VoyageEmbeddingProvider,
  );
});

test("por defecto la fabrica usa el modelo del perfil del indice", () => {
  // La pregunta y los documentos tienen que embeberse con el MISMO modelo: el
  // default es lo que garantiza que los cuatro sitios que la llaman coincidan.
  const provider = createRagEmbeddingProvider("k");
  assert.equal(provider.model, RAG_EMBEDDING_PROFILE.model);
  assert.equal(provider.dimensions, RAG_EMBEDDING_PROFILE.dimensions);
});
