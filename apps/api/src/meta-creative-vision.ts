export const A23_MAX_VISION_ADS = 2;
export const A23_MAX_VISION_IMAGE_BYTES = 1_350_000;
export const A23_PRIVATE_IMAGE_BUCKET = "marketing-source-assets";
export const A23_PRIVATE_IMAGE_PREFIX = "marketing-visual-bank/";

export type A23VisualFailureStage =
  | "ad_assignment_metadata"
  | "creative_asset_metadata"
  | "private_bank_linkage"
  | "image_bank_metadata"
  | "private_storage_read"
  | "unexpected";

export function a23VisualFailureCoverage(
  stage: A23VisualFailureStage,
  adsConsidered: number,
) {
  return {
    status: "visual_evidence_unavailable" as const,
    ads_considered: Math.max(0, Math.floor(adsConsidered)),
    images_attached: 0 as const,
    failure_stage: stage,
    note: "No se pudo verificar la evidencia visual; esto no significa que el anuncio carezca de activos importados.",
  };
}

export type A23PerformanceCandidate = { ad_id?: unknown; spend?: unknown };

export function selectA23VisionAdIds(
  rows: readonly A23PerformanceCandidate[],
  limit = A23_MAX_VISION_ADS,
): string[] {
  const spendByAd = new Map<string, number>();
  for (const row of rows) {
    if (typeof row.ad_id !== "string" || !/^[0-9a-f-]{36}$/i.test(row.ad_id)) continue;
    const spend = typeof row.spend === "number" ? row.spend : Number(row.spend);
    if (!Number.isFinite(spend) || spend <= 0) continue;
    spendByAd.set(row.ad_id, Math.max(spendByAd.get(row.ad_id) ?? 0, spend));
  }
  return [...spendByAd.entries()]
    .sort(([leftId, leftSpend], [rightId, rightSpend]) => rightSpend - leftSpend || leftId.localeCompare(rightId))
    .slice(0, Math.max(0, Math.min(A23_MAX_VISION_ADS, Math.floor(limit))))
    .map(([adId]) => adId);
}

export function validateA23PrivateImageMetadata(input: {
  organizationId: string;
  bucket: unknown;
  path: unknown;
  contentType: unknown;
  byteSize: unknown;
}): input is {
  organizationId: string;
  bucket: typeof A23_PRIVATE_IMAGE_BUCKET;
  path: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
} {
  if (
    input.bucket !== A23_PRIVATE_IMAGE_BUCKET ||
    typeof input.path !== "string" ||
    !input.path.startsWith(`${input.organizationId}/${A23_PRIVATE_IMAGE_PREFIX}`) ||
    input.path.split("/").some((part) => part === "" || part === "." || part === "..") ||
    !["image/png", "image/jpeg", "image/webp"].includes(String(input.contentType)) ||
    typeof input.byteSize !== "number" ||
    !Number.isInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > A23_MAX_VISION_IMAGE_BYTES
  ) return false;
  return true;
}
