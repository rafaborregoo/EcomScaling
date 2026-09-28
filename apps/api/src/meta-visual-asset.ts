export type MetaVisualRepresentation = "static_image" | "video_thumbnail";

/** Returns only image URLs. A video can enter the image-analysis pipeline only via its still thumbnail. */
export function resolveMetaVisualRepresentation(input: {
  assetType: unknown;
  mediaUrl: unknown;
  thumbnailUrl: unknown;
}): { kind: MetaVisualRepresentation; imageUrl: string } | null {
  const thumbnailUrl =
    typeof input.thumbnailUrl === "string" && input.thumbnailUrl.trim()
      ? input.thumbnailUrl.trim()
      : null;
  if (input.assetType === "video") {
    return thumbnailUrl
      ? { kind: "video_thumbnail", imageUrl: thumbnailUrl }
      : null;
  }
  if (input.assetType !== "image") return null;
  const mediaUrl =
    typeof input.mediaUrl === "string" && input.mediaUrl.trim()
      ? input.mediaUrl.trim()
      : null;
  const imageUrl = mediaUrl ?? thumbnailUrl;
  return imageUrl ? { kind: "static_image", imageUrl } : null;
}
