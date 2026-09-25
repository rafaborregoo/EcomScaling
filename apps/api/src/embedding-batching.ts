import type { EmbeddingProvider } from "@e-nora/ai";
import { mapWithConcurrency } from "./async-concurrency.js";

/**
 * Con el modelo contextualizado del perfil RAG, un lote no es solo una unidad
 * de red: es la VENTANA de contexto. Los fragmentos de una misma llamada se
 * embeben sabiendo unos de otros, y los de lotes distintos no se ven.
 *
 * ponytail: contextualizacion por ventanas de 64 fragmentos (~96k caracteres,
 * unas 30 paginas de contexto alrededor de cada fragmento). Un documento de
 * 2.700 fragmentos se embebe en ~43 ventanas independientes, no como un todo.
 * Es la mayor parte de la ganancia -- el contexto que importa es el vecino --
 * pero si algun dia hace falta contexto de documento completo, hay que subir
 * el lote y comprobar el tope de la peticion del proveedor.
 */
export const EMBEDDING_BATCH_SIZE = 64;
export const EMBEDDING_BATCH_CONCURRENCY = 2;

export async function embedChunksInOrder(
  chunks: readonly string[],
  provider: Pick<EmbeddingProvider, "embed">,
  batchSize = EMBEDDING_BATCH_SIZE,
  concurrency = EMBEDDING_BATCH_CONCURRENCY,
): Promise<number[][]> {
  if (chunks.length === 0) return [];
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const batches: string[][] = [];
  for (let offset = 0; offset < chunks.length; offset += safeBatchSize) {
    batches.push(chunks.slice(offset, offset + safeBatchSize));
  }
  const embeddedBatches = await mapWithConcurrency(
    batches,
    concurrency,
    (batch) => provider.embed(batch, "document"),
  );
  return embeddedBatches.flat();
}
