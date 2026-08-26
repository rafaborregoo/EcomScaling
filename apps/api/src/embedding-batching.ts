import type { EmbeddingProvider } from "@ecomscaling/ai";
import { mapWithConcurrency } from "./async-concurrency.js";

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
