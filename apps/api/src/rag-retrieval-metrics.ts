/** Document-level retrieval metrics for a query with human-labelled evidence. */
export function scoreRetrievalAtK(
  retrievedDocumentIds: readonly string[],
  relevantDocumentIds: readonly string[],
  k: number,
) {
  if (!Number.isInteger(k) || k < 1) throw new Error("k must be a positive integer");
  const relevant = new Set(relevantDocumentIds);
  if (relevant.size === 0) throw new Error("positive queries need at least one relevant document");
  const top = [...new Set(retrievedDocumentIds)].slice(0, k);
  const hits = top.filter((id) => relevant.has(id)).length;
  const firstRelevantRank = top.findIndex((id) => relevant.has(id)) + 1;
  return {
    precision: hits / k,
    recall: hits / relevant.size,
    reciprocalRank: firstRelevantRank ? 1 / firstRelevantRank : 0,
    hits,
  };
}
