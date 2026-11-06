import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export type OverlayAsset = { storage_bucket: string; storage_path: string; sha256: string; url: string; slide_index: number; width: number; height: number };
/** Resolve only paths from an already-authorized persisted draft. Never accept a URL to fetch. */
export async function resolveDraftOverlayAssets<T extends Record<string, unknown>>(client: SupabaseClient, organizationId: string, draft: T, publish = false): Promise<T> {
  const request = draft.request as Record<string, unknown> | null;
  const composition = request?.overlay_composition as { overlay_id?: string; assets?: OverlayAsset[] } | undefined;
  if (!composition?.assets?.length) return draft;
  if (publish && draft.status !== "approved") throw new Error("marketing_draft_not_approved");
  const replacements = new Map<string, string>();
  for (const asset of composition.assets) {
    if (asset.storage_bucket !== "marketing-source-assets" || !asset.storage_path.startsWith(`${organizationId}/overlays/${composition.overlay_id}/`) || asset.storage_path.includes("..") || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error("overlay_asset_scope_invalid");
    let url: string;
    if (publish) {
      const file = await client.storage.from(asset.storage_bucket).download(asset.storage_path);
      if (file.error || !file.data) throw new Error("overlay_asset_download_failed");
      const png = Buffer.from(await file.data.arrayBuffer());
      if (crypto.createHash("sha256").update(png).digest("hex") !== asset.sha256) throw new Error("overlay_asset_hash_mismatch");
      const path = `${organizationId}/compositions/${asset.sha256}.png`;
      const upload = await client.storage.from("marketing-assets").upload(path, png, { contentType: "image/png", upsert: false });
      if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw new Error("overlay_asset_delivery_failed");
      url = client.storage.from("marketing-assets").getPublicUrl(path).data.publicUrl;
    } else {
      const signed = await client.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 3600);
      if (signed.error || !signed.data) throw new Error("overlay_asset_preview_failed");
      url = signed.data.signedUrl;
    }
    replacements.set(`/${asset.storage_bucket}/${asset.storage_path}`, url);
  }
  const transform = (value: unknown): unknown => {
    if (typeof value === "string") return value.replace(/https?:\/\/[^\s"'<>]+/g, original => {
      try {
        const parsed = new URL(original.replaceAll("&amp;", "&"));
        const path = decodeURIComponent(parsed.pathname).replace(/^\/storage\/v1\/object\/(?:sign|public)/, "");
        return replacements.get(path) ?? original;
      } catch { return original; }
    });
    if (Array.isArray(value)) return value.map(transform);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, transform(item)]));
    return value;
  };
  return transform(draft) as T;
}
