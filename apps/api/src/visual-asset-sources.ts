export type VisualAssetSourceSummary = {
  channel: string;
  source_kind: string;
};

export function buildVisualAnalysisFingerprint(input: {
  agentVersion: string;
  model: string;
  promptCode: string;
  promptVersion: string;
}): string {
  return [
    input.agentVersion,
    input.model,
    input.promptCode,
    input.promptVersion,
  ].map((part) => encodeURIComponent(part)).join("|");
}

export function isOwnedVisualStoragePath(organizationId: string, path: string): boolean {
  return path.startsWith(`${organizationId}/`);
}

export function attachVisualAssetSources<
  T extends { id: string },
>(
  images: T[],
  sourceRows: Array<{
    image_id: string;
    channel: string;
    source_kind: string;
  }>,
): Array<T & { sources: VisualAssetSourceSummary[] }> {
  const byImage = new Map<string, VisualAssetSourceSummary[]>();
  for (const row of sourceRows) {
    const sources = byImage.get(row.image_id) ?? [];
    if (!sources.some((source) => source.channel === row.channel && source.source_kind === row.source_kind)) {
      sources.push({ channel: row.channel, source_kind: row.source_kind });
    }
    byImage.set(row.image_id, sources);
  }

  return images.map((image) => ({
    ...image,
    sources: byImage.get(image.id) ?? [],
  }));
}
