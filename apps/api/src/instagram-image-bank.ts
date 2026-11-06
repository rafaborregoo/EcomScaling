// Banco de imágenes de Instagram (módulo Marketing, vista cliente).
//
// El cliente sube imágenes -> cada una entra en cola (`status: 'queued'`) -> el
// worker llama al procesador cada minuto -> el agente de visión a15 extrae la
// ficha -> se guarda como markdown y se indexa como documento RAG
// (`source_type: 'visual_asset'`) para que el generador de contenido la cite.
//
// ADR-0006: estado actual = esta tabla con upsert in-place (unique por
// checksum). Escrituras por service role + chequeo manual de rol; la RLS de la
// tabla solo permite select a `authenticated`.
import crypto from "node:crypto";
import { cropOverlayImage, renderOverlayImage, overlayRatioSchema, overlaySlidesSchema, overlayFingerprint, overlayEditorBlocks, OVERLAY_DIMS, OVERLAY_RENDER_VERSION } from "./overlay-composition.js";
import { getAgentModelDecision } from "@e-nora/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  chunkText,
  instagramImageAnalysisToMarkdown,
  createRagEmbeddingProvider,
  instagramOverlayDraftSchema,
} from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import { loadDisabledAgents } from "./ai-agent-groups.js";
import { requireMailingAccess } from "./marketing-mailing-access.js";
import {
  requireOperationalOrganization,
  isOperationalOrganizationError,
  createUserScopedClient,
  membershipCoversStore,
  type AuthContext,
} from "./auth-context.js";
import { embedChunksInOrder } from "./embedding-batching.js";
import {
  attachVisualAssetSources,
  buildVisualAnalysisFingerprint,
  isOwnedVisualStoragePath,
} from "./visual-asset-sources.js";
import { downloadMetaStaticImage, downloadMetaVideo, META_IMAGE_MAX_BYTES } from "./meta-static-image.js";
import { resolveMetaVisualRepresentation } from "./meta-visual-asset.js";
import { extractMetaVideoFrames } from "./meta-video-frames.js";
import { getValidMetaAccessToken } from "./meta.js";
import { metaGraphGet } from "./meta-client.js";
import {
  analyzeInstagramImage,
  canAccessMarketingWorkspace,
  checkOrganizationDailyBudget,
  checkOrganizationProviderCircuit,
  settleOrganizationDailyBudgetReservation,
  recordAiRunMetrics,
  draftInstagramOverlay,
  runMarketingContentDraft,
  sniffImageMime,
  MARKETING_ASSET_EXT,
  MARKETING_ASSET_MAX_BYTES,
} from "./ai-runtime.js";

type ApiEnv = LoadedApiEnv;

const BUCKET = "marketing-assets";
const PRIVATE_SOURCE_BUCKET = "marketing-source-assets";
const SIGNED_IMAGE_URL_SECONDS = 5 * 60;
const SIGNED_IMAGE_URL_CACHE_MS = 4 * 60 * 1000;
const signedImageUrlCache = new Map<string, { url: string; expiresAt: number }>();
const MAX_ATTEMPTS = 3;
const QUEUE_BATCH = 3;
const MAX_MARKDOWN_CHARS = 20_000;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requireBankAccess(context: AuthContext, organizationId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(access)) return access;
  if (!canAccessMarketingWorkspace(context, access.membership.role)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "marketing_access_required",
      message:
        "Necesitas ser propietario o gestor de la tienda, o su consultor.",
    };
  }
  return { ok: true as const };
}

const IMAGE_COLUMNS =
  "id, public_url, storage_bucket, storage_path, original_filename, content_type, byte_size, pixel_width, pixel_height, representation_kind, store_id, content_revision, checksum, status, analysis, analysis_fingerprint, markdown, knowledge_document_id, index_status, error_reason, attempts, analyzed_at, created_at, updated_at";

async function resolveBankImageUrls(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  rows: Array<Record<string, unknown>>,
) {
  const urls = new Map<string, string>();
  const errors = new Map<string, string>();
  const privateRows: Array<{ id: string; path: string; cacheKey: string }> = [];
  const now = Date.now();
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : "";
    const bucket = typeof row.storage_bucket === "string" ? row.storage_bucket : BUCKET;
    if (!id) continue;
    if (bucket === BUCKET) {
      if (typeof row.public_url === "string") urls.set(id, row.public_url);
      else errors.set(id, "visual_asset_public_url_missing");
      continue;
    }
    if (bucket !== PRIVATE_SOURCE_BUCKET || typeof row.storage_path !== "string") {
      errors.set(id, "visual_asset_storage_bucket_invalid");
      continue;
    }
    const path = row.storage_path;
    if (!isOwnedVisualStoragePath(organizationId, path)) {
      errors.set(id, "visual_asset_storage_scope_invalid");
      continue;
    }
    const cacheKey = `${organizationId}:${path}`;
    const cached = signedImageUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > now + 30_000) {
      urls.set(id, cached.url);
    } else {
      privateRows.push({ id, path, cacheKey });
    }
  }

  if (privateRows.length > 0) {
    const uniquePaths = [...new Set(privateRows.map((row) => row.path))];
    const { data, error } = await supabase.storage
      .from(PRIVATE_SOURCE_BUCKET)
      .createSignedUrls(uniquePaths, SIGNED_IMAGE_URL_SECONDS);
    if (error || !data) {
      for (const row of privateRows) errors.set(row.id, error?.message ?? "visual_asset_signed_url_failed");
      return { ok: true as const, urls, errors };
    }
    const signedByPath = new Map<string, string>();
    for (const result of data) {
      if (result.error || !result.path || !result.signedUrl) {
        if (result.path) for (const row of privateRows.filter((item) => item.path === result.path)) errors.set(row.id, "visual_asset_signed_url_failed");
        continue;
      }
      signedByPath.set(result.path, result.signedUrl);
    }
    const expiresAt = now + SIGNED_IMAGE_URL_CACHE_MS;
    for (const row of privateRows) {
      const url = signedByPath.get(row.path);
      if (!url) { errors.set(row.id, "visual_asset_signed_url_missing"); continue; }
      urls.set(row.id, url);
      signedImageUrlCache.set(row.cacheKey, { url, expiresAt });
    }
    for (const [key, entry] of signedImageUrlCache) {
      if (entry.expiresAt <= now) signedImageUrlCache.delete(key);
    }
    while (signedImageUrlCache.size > 5000) {
      const oldest = signedImageUrlCache.keys().next().value;
      if (!oldest) break;
      signedImageUrlCache.delete(oldest);
    }
  }
  return { ok: true as const, urls, errors };
}

export async function resolveVisualBankPreviewUrls(
  env: ApiEnv,
  organizationId: string,
  rows: Array<Record<string, unknown>>,
) {
  return resolveBankImageUrls(createServiceClient(env), organizationId, rows);
}

async function getActiveA15Fingerprint(supabase: ReturnType<typeof createServiceClient>, image?: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("agent_versions")
    .select("version, model, prompt_code, prompt_version, agent_definitions!inner(code)")
    .eq("agent_definitions.code", "a15_analista_imagenes")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: error?.message ?? "a15_version_not_found" };
  const { data: prompt } = await supabase
    .from("prompt_versions")
    .select("content")
    .eq("code", data.prompt_code as string)
    .eq("version", data.prompt_version as string)
    .maybeSingle();
  if (!prompt?.content) return { ok: false as const, error: "a15_prompt_not_found" };
  return {
    ok: true as const,
    fingerprint: buildVisualAnalysisFingerprint({
      agentVersion: data.version as string,
      model: getAgentModelDecision("a15_analista_imagenes")?.model ?? data.model as string,
      promptCode: data.prompt_code as string,
      promptVersion: data.prompt_version as string,
      promptSha256: crypto.createHash("sha256").update(prompt.content as string).digest("hex"),
      schemaVersion: "a15-visual-schema-v4",
      ...(typeof image?.checksum === "string" ? { contentChecksum: image.checksum } : {}),
      ...(typeof image?.representation_kind === "string" ? { representationKind: image.representation_kind } : {}),
    }),
  };
}

export async function isCurrentA15VisualAnalysis(
  supabase: ReturnType<typeof createServiceClient>,
  image: Record<string, unknown>,
): Promise<boolean> {
  if (image.status !== "analyzed" || !image.analysis || typeof image.analysis !== "object") return false;
  const active = await getActiveA15Fingerprint(supabase, image);
  return active.ok && image.analysis_fingerprint === active.fingerprint;
}

async function queueImageIfAnalysisIsStale(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  image: Record<string, unknown>,
) {
  if (image.status !== "analyzed" && image.status !== "failed") {
    return { ok: true as const, image };
  }
  const active = await getActiveA15Fingerprint(supabase, image);
  if (!active.ok) return active;
  if (image.analysis_fingerprint === active.fingerprint) {
    return { ok: true as const, image };
  }

  const { data: queued, error } = await supabase
    .from("instagram_image_bank")
    .update({
      status: "queued",
      analysis_fingerprint: null,
      error_reason: null,
      attempts: 0,
      next_attempt_at: null,
      claim_token: null,
      claim_expires_at: null,
    })
    .eq("id", image.id as string)
    .eq("organization_id", organizationId)
    .eq("status", image.status as string)
    .select(IMAGE_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (queued) return { ok: true as const, image: queued as Record<string, unknown> };
  const { data: current, error: reloadError } = await supabase
    .from("instagram_image_bank")
    .select(IMAGE_COLUMNS)
    .eq("id", image.id as string)
    .eq("organization_id", organizationId)
    .single();
  if (reloadError || !current) {
    return { ok: false as const, error: reloadError?.message ?? "visual_asset_reload_failed" };
  }
  return { ok: true as const, image: current as Record<string, unknown> };
}

function storeAccess(context: AuthContext, organizationId: string, storeId: string | null) {
  const membership = context.memberships.find((item) => item.organization_id === organizationId);
  if (!membership) return { ok: false as const, statusCode: 403, error: "visual_asset_store_access_denied" };
  if (storeId && !membershipCoversStore(membership, storeId)) {
    return { ok: false as const, statusCode: 403, error: "visual_asset_store_access_denied" };
  }
  const allowedStoreIds = membership.accessSource === "membership" && membership.access_scope === "store"
    ? [...new Set(membership.store_ids ?? (membership.store_id ? [membership.store_id] : []))]
    : null;
  if (allowedStoreIds && allowedStoreIds.length === 0) return { ok: false as const, statusCode: 403, error: "visual_asset_store_scope_empty" };
  return { ok: true as const, allowedStoreIds };
}

export async function listVisualAssetStores(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const scope = storeAccess(context, organizationId, null);
  if (!scope.ok) return scope;
  const token = authorization.slice("Bearer ".length);
  let query = createUserScopedClient(env, token).from("shopify_stores")
    .select("id, shop_name, myshopify_domain")
    .eq("organization_id", organizationId).eq("is_active", true).order("shop_name");
  if (scope.allowedStoreIds) query = query.in("id", scope.allowedStoreIds);
  const { data, error } = await query;
  if (error) return { ok: false as const, statusCode: 500, error: "visual_asset_store_list_failed", detail: error.message };
  return { ok: true as const, data: { stores: data ?? [] } };
}

function imageDimensions(buffer: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === "image/png" && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mime === "image/gif" && buffer.length >= 10) return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  if (mime === "image/webp" && buffer.length >= 30 && buffer.toString("ascii", 12, 16) === "VP8X") {
    const width = buffer.readUIntLE(24, 3);
    const height = buffer.readUIntLE(27, 3);
    return width === undefined || height === undefined ? null : { width: 1 + width, height: 1 + height };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const size = buffer.readUInt16BE(offset + 2);
      if (marker !== undefined && [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (size < 2) break;
      offset += size + 2;
    }
  }
  return null;
}

function strictBase64Buffer(input: string): Buffer | null {
  const compact = input.replace(/\s/g, "");
  if (!compact || compact.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) return null;
  const buffer = Buffer.from(compact, "base64");
  return buffer.toString("base64") === compact ? buffer : null;
}

async function ensureInstagramImageSource(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  imageId: string,
  channels: string[] = ["instagram"],
  storeId: string | null = null,
) {
  for (const channel of [...new Set(channels.filter((item) => item === "instagram" || item === "meta"))]) {
    const { error } = await supabase.from("marketing_visual_asset_sources").upsert(
      {
        organization_id: organizationId,
        image_id: imageId,
        channel,
        source_kind: "manual_upload",
        origin_key: `${imageId}:manual:${channel}`,
        store_id: storeId,
        representation_kind: "static_image",
        source_metadata: { origin: "manual_upload", intended_channel: channel },
      },
      { onConflict: "organization_id,channel,origin_key" },
    );
    if (error) return error;
  }
  return null;
}

async function ensureMetaImageSource(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    organizationId: string;
    imageId: string;
    assetId: string;
    originHost: string;
    assetHash: string | null;
    assetLabel: string | null;
    externalAssetId: string | null;
    assetType: "image" | "video";
    representationKind?: "static_image" | "static_thumbnail" | "video_frame" | "carousel_slide";
    storeId?: string | null;
    contentChecksum?: string | null;
    creativeId?: string | null;
    carouselPosition?: number | null;
    originKey?: string | null;
    frameTimestampSeconds?: number | null;
    sourceVideoChecksum?: string | null;
    sourceVideoDurationSeconds?: number | null;
  },
) {
  const { data: previous } = await supabase.from("marketing_visual_asset_sources")
    .select("source_revision, source_metadata")
    .eq("organization_id", params.organizationId).eq("channel", "meta")
    .eq("origin_key", params.originKey ?? params.assetId).maybeSingle();
  const previousMetadata = previous?.source_metadata && typeof previous.source_metadata === "object"
    ? previous.source_metadata as Record<string, unknown>
    : {};
  const sourceRevision = !previous
    ? 1
    : previousMetadata.content_checksum === params.contentChecksum
      ? Number(previous.source_revision ?? 1)
      : Number(previous.source_revision ?? 1) + 1;
  const { error } = await supabase.from("marketing_visual_asset_sources").upsert(
    {
      organization_id: params.organizationId,
      image_id: params.imageId,
      channel: "meta",
      source_kind: "meta_creative_asset",
      origin_key: params.originKey ?? params.assetId,
      meta_asset_id: params.assetId,
      origin_host: params.originHost,
      source_metadata: {
        asset_hash: params.assetHash,
        asset_label: params.assetLabel?.slice(0, 180) ?? null,
        external_asset_id: params.externalAssetId?.slice(0, 255) ?? null,
        asset_type: params.assetType,
        imported_representation: params.representationKind ?? (params.assetType === "video" ? "static_thumbnail" : "static_image"),
        content_checksum: params.contentChecksum ?? null,
        creative_id: params.creativeId ?? null,
        carousel_position: params.carouselPosition ?? null,
        frame_timestamp_seconds: params.frameTimestampSeconds ?? null,
        source_video_checksum: params.sourceVideoChecksum ?? null,
        source_video_duration_seconds: params.sourceVideoDurationSeconds ?? null,
      },
      representation_kind: params.representationKind ?? (params.assetType === "video" ? "static_thumbnail" : "static_image"),
      store_id: params.storeId ?? null,
      source_revision: sourceRevision,
    },
    { onConflict: "organization_id,channel,origin_key" },
  );
  return error;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listMetaVisualImageCandidates(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  requestedStoreId: string | null = null,
  options: { cursor?: string; limit?: number } = {},
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const scope = storeAccess(context, organizationId, requestedStoreId);
  if (!scope.ok) return scope;

  const supabase = createServiceClient(env);
  let scopedCreativeIds: string[] | null = null;
  if (requestedStoreId || scope.allowedStoreIds) {
    const accountQuery = supabase.from("meta_ad_accounts").select("id").eq("organization_id", organizationId);
    const accounts = requestedStoreId
      ? await accountQuery.eq("store_id", requestedStoreId)
      : await accountQuery.in("store_id", scope.allowedStoreIds ?? []);
    if (accounts.error) return { ok: false as const, statusCode: 500, error: "meta_visual_account_scope_failed", detail: accounts.error.message };
    const accountIds = (accounts.data ?? []).map((item) => item.id as string);
    const { data: creatives, error: creativeScopeError } = accountIds.length
      ? await supabase.from("meta_creatives").select("id").eq("organization_id", organizationId).in("ad_account_id", accountIds)
      : { data: [], error: null };
    if (creativeScopeError) return { ok: false as const, statusCode: 500, error: "meta_visual_creative_scope_failed", detail: creativeScopeError.message };
    scopedCreativeIds = (creatives ?? []).map((item) => item.id as string);
  }
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
  let assetQuery = supabase
    .from("meta_creative_assets")
    .select("id, creative_id, asset_type, position, asset_label, asset_hash, external_asset_id, media_url, thumbnail_url, created_at")
    .eq("organization_id", organizationId)
    .eq("is_current", true)
    .in("asset_type", ["image", "video"])
    .or("media_url.not.is.null,thumbnail_url.not.is.null,external_asset_id.not.is.null")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (scopedCreativeIds) {
    if (scopedCreativeIds.length === 0) return { ok: true as const, data: { candidates: [], next_cursor: null } };
    assetQuery = assetQuery.in("creative_id", scopedCreativeIds);
  }
  if (options.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")) as { created_at?: string; id?: string };
      if (!cursor.created_at || !isUuid(cursor.id)) throw new Error("invalid_cursor");
      assetQuery = assetQuery.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    } catch {
      return { ok: false as const, statusCode: 400, error: "meta_visual_cursor_invalid" };
    }
  }
  const { data: assets, error } = await assetQuery.limit(limit + 1);
  if (error) {
    return { ok: false as const, statusCode: 500, error: "meta_visual_assets_load_failed", detail: error.message };
  }
  const pageAssets = (assets ?? []).slice(0, limit);
  const rows = pageAssets.filter((asset) => {
    if (scopedCreativeIds && !scopedCreativeIds.includes(asset.creative_id as string)) return false;
    const visual = resolveMetaVisualRepresentation({ assetType: asset.asset_type, mediaUrl: asset.media_url, thumbnailUrl: asset.thumbnail_url });
    return visual !== null || (asset.asset_type === "video" && Boolean(asset.external_asset_id));
  });
  const creativeIds = [...new Set(rows.map((row) => row.creative_id as string))];
  const { data: creatives, error: creativeError } = creativeIds.length
    ? await supabase
        .from("meta_creatives")
        .select("id, name, external_creative_id")
        .eq("organization_id", organizationId)
        .in("id", creativeIds)
    : { data: [], error: null };
  if (creativeError) {
    return { ok: false as const, statusCode: 500, error: "meta_visual_creatives_load_failed", detail: creativeError.message };
  }
  const creativeById = new Map((creatives ?? []).map((creative) => [creative.id as string, creative]));
  return {
    ok: true as const,
    data: {
      candidates: rows.map((asset) => ({
        id: asset.id,
        creative_id: asset.creative_id,
        creative_name: creativeById.get(asset.creative_id as string)?.name ?? null,
        position: asset.position,
        asset_type: asset.asset_type,
        visual_kind: resolveMetaVisualRepresentation({
          assetType: asset.asset_type,
          mediaUrl: asset.media_url,
          thumbnailUrl: asset.thumbnail_url,
        })?.kind ?? "video_thumbnail",
        label: asset.asset_label,
        asset_hash: asset.asset_hash,
        created_at: asset.created_at,
        available: Boolean(resolveMetaVisualRepresentation({
          assetType: asset.asset_type,
          mediaUrl: asset.media_url,
          thumbnailUrl: asset.thumbnail_url,
        })),
        can_extract_video: asset.asset_type === "video" && Boolean(asset.external_asset_id),
      })),
      has_more: (assets ?? []).length > limit,
      next_cursor: (assets ?? []).length > limit && pageAssets.length
        ? Buffer.from(JSON.stringify({ created_at: pageAssets[pageAssets.length - 1]!.created_at, id: pageAssets[pageAssets.length - 1]!.id })).toString("base64url")
        : null,
    },
  };
}

export async function importMetaVisualImage(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const assetId = payload.asset_id;
  if (!isUuid(assetId)) {
    return { ok: false as const, statusCode: 400, error: "meta_asset_id_invalid" };
  }

  const supabase = createServiceClient(env);
  const { data: asset, error: assetError } = await supabase
    .from("meta_creative_assets")
    .select("id, creative_id, asset_type, position, metadata, asset_hash, asset_label, external_asset_id, media_url, thumbnail_url")
    .eq("id", assetId)
    .eq("organization_id", organizationId)
    .eq("is_current", true)
    .maybeSingle();
  if (assetError || !asset) {
    return { ok: false as const, statusCode: 404, error: "meta_visual_asset_not_found" };
  }
  if (asset.asset_type !== "image" && asset.asset_type !== "video") {
    return { ok: false as const, statusCode: 422, error: "meta_visual_asset_static_image_required" };
  }
  const assetType = asset.asset_type;
  // Video records are never downloaded: only their provider-supplied still
  // thumbnail is eligible for the existing SSRF-safe image pipeline.
  const representation = resolveMetaVisualRepresentation({
    assetType,
    mediaUrl: asset.media_url,
    thumbnailUrl: asset.thumbnail_url,
  });
  if (!representation) {
    return { ok: false as const, statusCode: 409, error: "meta_visual_asset_media_unavailable" };
  }
  const sourceUrl = representation.imageUrl;
  const assetMetadata = asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
    ? asset.metadata as Record<string, unknown>
    : {};
  const representationKind = asset.asset_type === "image" && assetMetadata.representation === "carousel_slide"
    ? "carousel_slide"
    : representation.kind === "static_image" ? "static_image" : "static_thumbnail";
  const { data: creative } = await supabase
    .from("meta_creatives")
    .select("ad_account_id")
    .eq("id", asset.creative_id as string)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const { data: adAccount } = creative?.ad_account_id
    ? await supabase.from("meta_ad_accounts").select("store_id").eq("id", creative.ad_account_id as string).eq("organization_id", organizationId).maybeSingle()
    : { data: null };
  const storeId = typeof adAccount?.store_id === "string" ? adAccount.store_id : null;
  const storeScope = storeAccess(context, organizationId, storeId);
  if (!storeScope.ok) return storeScope;

  let downloaded: Awaited<ReturnType<typeof downloadMetaStaticImage>>;
  try {
    downloaded = await downloadMetaStaticImage(sourceUrl);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "meta_asset_download_failed";
    return {
      ok: false as const,
      statusCode: 502,
      error: "meta_visual_asset_download_failed",
      detail: code.slice(0, 120),
    };
  }
  if (downloaded.buffer.length === 0 || downloaded.buffer.length > META_IMAGE_MAX_BYTES) {
    return { ok: false as const, statusCode: 422, error: "meta_visual_asset_size_invalid" };
  }

  const checksum = crypto.createHash("sha256").update(downloaded.buffer).digest("hex");
  const { data: existing, error: existingError } = await supabase
    .from("instagram_image_bank")
    .select(IMAGE_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("checksum", checksum)
    .maybeSingle();
  if (existingError) {
    return { ok: false as const, statusCode: 500, error: "visual_asset_dedupe_failed", detail: existingError.message };
  }
  if (existing) {
    const refreshed = await queueImageIfAnalysisIsStale(
      supabase,
      organizationId,
      existing as Record<string, unknown>,
    );
    if (!refreshed.ok) {
      return { ok: false as const, statusCode: 500, error: "visual_analysis_refresh_failed", detail: refreshed.error };
    }
    const sourceError = await ensureMetaImageSource(supabase, {
      organizationId,
      imageId: refreshed.image.id as string,
      assetId,
      originHost: downloaded.originHost,
      assetHash: asset.asset_hash as string | null,
      assetLabel: asset.asset_label as string | null,
      externalAssetId: asset.external_asset_id as string | null,
      assetType,
      representationKind,
      storeId,
      contentChecksum: checksum,
      creativeId: asset.creative_id as string,
      carouselPosition: representationKind === "carousel_slide" ? Number(asset.position ?? 0) : null,
    });
    if (sourceError) {
      return { ok: false as const, statusCode: 500, error: "visual_asset_source_save_failed", detail: sourceError.message };
    }
    return { ok: true as const, data: { image: refreshed.image, deduped: true } };
  }

  const extension = downloaded.mime === "image/png" ? "png" : downloaded.mime === "image/webp" ? "webp" : "jpg";
  const storagePath = `${organizationId}/marketing-visual-bank/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage
    .from(PRIVATE_SOURCE_BUCKET)
    .upload(storagePath, downloaded.buffer, {
      contentType: downloaded.mime,
      cacheControl: "60",
      upsert: false,
    });
  if (upload.error) {
    return { ok: false as const, statusCode: 502, error: "visual_asset_upload_failed", detail: upload.error.message };
  }
  const safeLabel = typeof asset.asset_label === "string" && asset.asset_label.trim()
    ? asset.asset_label.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").slice(0, 150)
    : `meta-${assetId.slice(0, 8)}`;
  const { data: image, error: insertError } = await supabase
    .from("instagram_image_bank")
    .insert({
      organization_id: organizationId,
      storage_path: storagePath,
      public_url: "",
      storage_bucket: PRIVATE_SOURCE_BUCKET,
      original_filename: `${safeLabel}.${extension}`,
      content_type: downloaded.mime,
      byte_size: downloaded.buffer.length,
      checksum,
      representation_kind: representationKind,
      store_id: storeId,
      status: "queued",
      created_by: context.user.id,
    })
    .select(IMAGE_COLUMNS)
    .single();
  if (insertError || !image) {
    await supabase.storage.from(PRIVATE_SOURCE_BUCKET).remove([storagePath]);
    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("instagram_image_bank")
        .select(IMAGE_COLUMNS)
        .eq("organization_id", organizationId)
        .eq("checksum", checksum)
        .maybeSingle();
      if (raced) {
        const refreshed = await queueImageIfAnalysisIsStale(
          supabase,
          organizationId,
          raced as Record<string, unknown>,
        );
        if (!refreshed.ok) {
          return { ok: false as const, statusCode: 500, error: "visual_analysis_refresh_failed", detail: refreshed.error };
        }
        const sourceError = await ensureMetaImageSource(supabase, {
          organizationId,
          imageId: refreshed.image.id as string,
          assetId,
          originHost: downloaded.originHost,
          assetHash: asset.asset_hash as string | null,
          assetLabel: asset.asset_label as string | null,
          externalAssetId: asset.external_asset_id as string | null,
          assetType,
          representationKind,
          storeId,
          contentChecksum: checksum,
          creativeId: asset.creative_id as string,
          carouselPosition: representationKind === "carousel_slide" ? Number(asset.position ?? 0) : null,
        });
        if (!sourceError) return { ok: true as const, data: { image: refreshed.image, deduped: true } };
      }
    }
    return { ok: false as const, statusCode: 500, error: "visual_asset_import_failed", detail: insertError?.message };
  }

  const sourceError = await ensureMetaImageSource(supabase, {
    organizationId,
    imageId: image.id as string,
    assetId,
    originHost: downloaded.originHost,
    assetHash: asset.asset_hash as string | null,
    assetLabel: asset.asset_label as string | null,
    externalAssetId: asset.external_asset_id as string | null,
    assetType,
    representationKind,
    storeId: storeId ?? null,
    contentChecksum: checksum,
    creativeId: asset.creative_id as string,
    carouselPosition: representationKind === "carousel_slide" ? Number(asset.position ?? 0) : null,
  });
  if (sourceError) {
    await supabase.from("instagram_image_bank").delete().eq("id", image.id);
      await supabase.storage.from(PRIVATE_SOURCE_BUCKET).remove([storagePath]);
    return { ok: false as const, statusCode: 500, error: "visual_asset_source_save_failed", detail: sourceError.message };
  }
  return { ok: true as const, data: { image } };
}

export async function importMetaVideoFrames(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const assetId = payload.asset_id;
  if (!isUuid(assetId)) return { ok: false as const, statusCode: 400, error: "meta_asset_id_invalid" };

  const supabase = createServiceClient(env);
  const { data: asset, error: assetError } = await supabase.from("meta_creative_assets")
    .select("id, creative_id, asset_type, external_asset_id")
    .eq("id", assetId).eq("organization_id", organizationId).eq("is_current", true).maybeSingle();
  if (assetError || !asset) return { ok: false as const, statusCode: 404, error: "meta_visual_asset_not_found" };
  if (asset.asset_type !== "video" || !asset.external_asset_id) {
    return { ok: false as const, statusCode: 422, error: "meta_visual_asset_video_required" };
  }

  const { data: creative } = await supabase.from("meta_creatives")
    .select("ad_account_id").eq("id", asset.creative_id as string).eq("organization_id", organizationId).maybeSingle();
  const { data: account } = creative?.ad_account_id
    ? await supabase.from("meta_ad_accounts").select("store_id, connection_id")
      .eq("id", creative.ad_account_id as string).eq("organization_id", organizationId).maybeSingle()
    : { data: null };
  if (!account?.connection_id) return { ok: false as const, statusCode: 409, error: "meta_video_connection_unavailable" };
  const storeId = typeof account.store_id === "string" ? account.store_id : null;
  const storeScope = storeAccess(context, organizationId, storeId);
  if (!storeScope.ok) return storeScope;
  const token = await getValidMetaAccessToken(env, account.connection_id as string);
  if (!token) return { ok: false as const, statusCode: 409, error: "meta_video_connection_expired" };

  let sourceUrl: string | null = null;
  try {
    const video = await metaGraphGet<{ source?: string }>(
      String(asset.external_asset_id), token, { fields: "source" }, env.META_APP_SECRET,
    );
    sourceUrl = typeof video.source === "string" ? video.source : null;
  } catch {
    return {
      ok: false as const,
      statusCode: 409,
      error: "meta_video_source_unavailable",
      message: "Meta no permite descargar el vídeo de esta creatividad con los permisos actuales. Puedes importar la miniatura disponible.",
    };
  }
  if (!sourceUrl) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "meta_video_source_unavailable",
      message: "Meta no ha entregado el archivo de vídeo para esta creatividad. Puedes importar la miniatura disponible.",
    };
  }

  let downloaded: Awaited<ReturnType<typeof downloadMetaVideo>>;
  try {
    downloaded = await downloadMetaVideo(sourceUrl);
  } catch (cause) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "meta_video_download_failed",
      detail: (cause instanceof Error ? cause.message : "meta_video_download_failed").slice(0, 120),
    };
  }

  let extracted: Awaited<ReturnType<typeof extractMetaVideoFrames>>;
  try {
    extracted = await extractMetaVideoFrames(downloaded.buffer);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "meta_video_extraction_failed";
    const statusCode = code === "meta_video_extractor_unavailable" ? 503
      : code === "meta_video_duration_out_of_range" ? 422 : 422;
    return { ok: false as const, statusCode, error: code };
  }

  const videoChecksum = crypto.createHash("sha256").update(downloaded.buffer).digest("hex");
  const frames: Array<{ image_id: string; timestamp_seconds: number; deduped: boolean }> = [];
  for (const [index, frame] of extracted.frames.entries()) {
    const seconds = Math.round(frame.timestampSeconds * 10) / 10;
    const imageResult = await enqueueInstagramImage(env, context, organizationId, {
      filename: `meta-video-${String(asset.external_asset_id).slice(-8)}-frame-${String(index + 1).padStart(2, "0")}.jpg`,
      content_base64: frame.buffer.toString("base64"),
      destination_channels: ["meta"],
      ...(storeId ? { store_id: storeId } : {}),
    });
    if (!imageResult.ok) {
      return {
        ok: false as const,
        statusCode: imageResult.statusCode,
        error: "meta_video_frame_save_failed",
        detail: imageResult.error,
        data: { extracted: frames.length, duration_seconds: extracted.durationSeconds },
      };
    }
    const image = imageResult.data.image as Record<string, unknown>;
    if (!imageResult.data.deduped) {
      const { error: representationError } = await supabase.from("instagram_image_bank")
        .update({ representation_kind: "video_frame" })
        .eq("id", image.id as string).eq("organization_id", organizationId);
      if (representationError) {
        return { ok: false as const, statusCode: 500, error: "meta_video_frame_metadata_failed", detail: representationError.message };
      }
    }
    const { error: manualSourceError } = await supabase.from("marketing_visual_asset_sources").delete()
      .eq("organization_id", organizationId).eq("image_id", image.id as string)
      .eq("channel", "meta").eq("origin_key", `${image.id}:manual:meta`);
    if (manualSourceError) {
      return { ok: false as const, statusCode: 500, error: "meta_video_frame_source_reconcile_failed", detail: manualSourceError.message };
    }
    const sourceError = await ensureMetaImageSource(supabase, {
      organizationId,
      imageId: image.id as string,
      assetId: asset.id as string,
      originHost: downloaded.originHost,
      assetHash: null,
      assetLabel: `Fotograma ${index + 1}`,
      externalAssetId: String(asset.external_asset_id),
      assetType: "video",
      representationKind: "video_frame",
      storeId,
      contentChecksum: crypto.createHash("sha256").update(frame.buffer).digest("hex"),
      originKey: `${asset.id}:video:${videoChecksum}:${index}`,
      frameTimestampSeconds: seconds,
      sourceVideoChecksum: videoChecksum,
      sourceVideoDurationSeconds: extracted.durationSeconds,
    });
    if (sourceError) {
      return { ok: false as const, statusCode: 500, error: "meta_video_frame_source_save_failed", detail: sourceError.message };
    }
    frames.push({ image_id: image.id as string, timestamp_seconds: seconds, deduped: Boolean(imageResult.data.deduped) });
  }
  return {
    ok: true as const,
    data: { video_asset_id: asset.id as string, duration_seconds: extracted.durationSeconds, frames },
  };
}

// --------------------------------------------------------------------------
// Importar una imagen a la cola
// --------------------------------------------------------------------------

export async function enqueueInstagramImage(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const filename =
    typeof payload.filename === "string" && payload.filename.trim()
      ? payload.filename.trim().slice(0, 255)
      : "imagen";
  const raw =
    typeof payload.content_base64 === "string" ? payload.content_base64 : "";
  const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  if (!base64.trim()) {
    return { ok: false as const, statusCode: 400, error: "imagen_vacia" };
  }

  const buffer = strictBase64Buffer(base64);
  if (!buffer) {
    return { ok: false as const, statusCode: 400, error: "base64_invalido" };
  }
  if (buffer.length === 0 || buffer.length > MARKETING_ASSET_MAX_BYTES) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "imagen_demasiado_grande",
      message: "La imagen debe pesar menos de 5 MB.",
    };
  }

  const mime = sniffImageMime(buffer);
  if (!mime) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "formato_no_soportado",
      message: "Solo PNG, JPG, GIF o WebP.",
    };
  }
  const dimensions = imageDimensions(buffer, mime);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > 100_000_000) {
    return { ok: false as const, statusCode: 422, error: "imagen_invalida_o_demasiado_grande" };
  }

  if (payload.store_id !== undefined && !isUuid(payload.store_id)) return { ok: false as const, statusCode: 400, error: "visual_asset_store_id_invalid" };
  let storeId = isUuid(payload.store_id) ? payload.store_id : null;
  const storePermission = storeAccess(context, organizationId, storeId);
  if (!storePermission.ok) return storePermission;
  if (!storeId && storePermission.allowedStoreIds) {
    if (storePermission.allowedStoreIds.length !== 1) return { ok: false as const, statusCode: 400, error: "visual_asset_store_required" };
    storeId = storePermission.allowedStoreIds[0] ?? null;
  }
  if (storeId) {
    const { data: store } = await createServiceClient(env).from("shopify_stores")
      .select("id").eq("id", storeId).eq("organization_id", organizationId).maybeSingle();
    if (!store) return { ok: false as const, statusCode: 404, error: "visual_asset_store_not_found" };
  }
  const destinationChannels = Array.isArray(payload.destination_channels)
    ? [...new Set(payload.destination_channels.filter((channel): channel is string => channel === "instagram" || channel === "meta"))]
    : ["instagram"];
  if (destinationChannels.length === 0) return { ok: false as const, statusCode: 400, error: "visual_asset_destination_required" };

  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const supabase = createServiceClient(env);

  // Upsert in-place: si esta imagen exacta ya está en el banco, no la
  // reprocesamos.
  const { data: existing } = await supabase
    .from("instagram_image_bank")
    .select(IMAGE_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("checksum", checksum)
    .maybeSingle();
  if (existing) {
    const refreshed = await queueImageIfAnalysisIsStale(
      supabase,
      organizationId,
      existing as Record<string, unknown>,
    );
    if (!refreshed.ok) {
      return { ok: false as const, statusCode: 500, error: "visual_analysis_refresh_failed", detail: refreshed.error };
    }
    const sourceError = await ensureInstagramImageSource(
      supabase,
      organizationId,
      refreshed.image.id as string,
      destinationChannels,
      storeId,
    );
    if (sourceError) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "visual_asset_source_save_failed",
        detail: sourceError.message,
      };
    }
    return { ok: true as const, data: { image: refreshed.image, deduped: true } };
  }

  const path = `${organizationId}/marketing-visual-bank/${crypto.randomUUID()}.${MARKETING_ASSET_EXT[mime]}`;
  const upload = await supabase.storage
    .from(PRIVATE_SOURCE_BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (upload.error) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "asset_upload_failed",
      detail: upload.error.message,
    };
  }
  const { data: inserted, error: insertError } = await supabase
    .from("instagram_image_bank")
    .insert({
      organization_id: organizationId,
      storage_path: path,
      public_url: "",
      storage_bucket: PRIVATE_SOURCE_BUCKET,
      original_filename: filename,
      content_type: mime,
      byte_size: buffer.length,
      checksum,
      pixel_width: dimensions.width,
      pixel_height: dimensions.height,
      store_id: storeId,
      representation_kind: "static_image",
      status: "queued",
      created_by: context.user.id,
    })
    .select(IMAGE_COLUMNS)
    .single();

  if (insertError || !inserted) {
    // Carrera: otra petición insertó el mismo checksum entre el select y aquí.
    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("instagram_image_bank")
        .select(IMAGE_COLUMNS)
        .eq("organization_id", organizationId)
        .eq("checksum", checksum)
        .maybeSingle();
      await supabase.storage.from(PRIVATE_SOURCE_BUCKET).remove([path]);
      if (raced) {
        const refreshed = await queueImageIfAnalysisIsStale(
          supabase,
          organizationId,
          raced as Record<string, unknown>,
        );
        if (!refreshed.ok) {
          return { ok: false as const, statusCode: 500, error: "visual_analysis_refresh_failed", detail: refreshed.error };
        }
        const sourceError = await ensureInstagramImageSource(
          supabase,
          organizationId,
          refreshed.image.id as string,
          destinationChannels,
          storeId,
        );
        if (sourceError) {
          return {
            ok: false as const,
            statusCode: 500,
            error: "visual_asset_source_save_failed",
            detail: sourceError.message,
          };
        }
        return { ok: true as const, data: { image: refreshed.image, deduped: true } };
      }
    }
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_image_enqueue_failed",
      detail: insertError?.message,
    };
  }

  const sourceError = await ensureInstagramImageSource(
    supabase,
    organizationId,
    inserted.id as string,
    destinationChannels,
    storeId,
  );
  if (sourceError) {
    await supabase.from("instagram_image_bank").delete().eq("id", inserted.id);
    await supabase.storage.from(PRIVATE_SOURCE_BUCKET).remove([path]);
    return {
      ok: false as const,
      statusCode: 500,
      error: "visual_asset_source_save_failed",
      detail: sourceError.message,
    };
  }

  return { ok: true as const, data: { image: inserted } };
}

// --------------------------------------------------------------------------
// Listado (RLS: cliente scoped)
// --------------------------------------------------------------------------

export async function listInstagramImageBank(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  options: { storeId?: string; storeConnectionId?: string; cursor?: string; limit?: number; search?: string } = {},
) {
  if (options.storeConnectionId) {
    if (!isUuid(options.storeConnectionId)) return { ok: false as const, statusCode: 400, error: "visual_asset_store_id_invalid" };
    const store = await createServiceClient(env).from("shopify_stores").select("id").eq("organization_id", organizationId)
      .eq("connection_id", options.storeConnectionId).eq("is_active", true).maybeSingle();
    if (store.error) return { ok: false as const, statusCode: 503, error: "visual_asset_store_scope_load_failed" };
    if (!store.data || options.storeId && options.storeId !== store.data.id) return { ok: false as const, statusCode: 404, error: "visual_asset_store_not_available" };
    options = { ...options, storeId: store.data.id };
  }
  const access = options.storeConnectionId ? requireMailingAccess(context, organizationId, options.storeId!) : requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  if (options.storeId && !isUuid(options.storeId)) return { ok: false as const, statusCode: 400, error: "visual_asset_store_id_invalid" };
  const scope = options.storeConnectionId ? { ok: true as const, allowedStoreIds: [options.storeId!] }
    : storeAccess(context, organizationId, options.storeId ?? null);
  if (!scope.ok) return scope;

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
  const selectedStoreIds = options.storeId ? [options.storeId] : scope.allowedStoreIds;
  const scopedImageIds = selectedStoreIds
    ? await supabase.from("marketing_visual_asset_sources").select("image_id").eq("organization_id", organizationId).in("store_id", selectedStoreIds)
    : { data: [], error: null };
  if (scopedImageIds.error) return { ok: false as const, statusCode: 500, error: "visual_asset_store_scope_load_failed", detail: scopedImageIds.error.message };
  let query = supabase
    .from("instagram_image_bank")
    .select(IMAGE_COLUMNS)
    .eq("organization_id", organizationId)
    .neq("status", "deleting")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (selectedStoreIds) {
    const sourceImageIds = [...new Set((scopedImageIds.data ?? []).map((row) => row.image_id as string))];
    if (sourceImageIds.length) {
      const storeClause = options.storeId ? `store_id.eq.${options.storeId}` : `store_id.in.(${selectedStoreIds.join(",")})`;
      query = query.or(`${storeClause},id.in.(${sourceImageIds.join(",")})`);
    } else if (options.storeId) query = query.eq("store_id", options.storeId);
    else query = query.in("store_id", selectedStoreIds);
  }
  if (options.search?.trim()) {
    const term = options.search.trim().slice(0, 120).replace(/[(),%_*]/g, " ").replace(/\s+/g, " ").trim();
    if (term) {
      const pattern = `*${term.replace(/ /g, "*")}*`;
      query = query.or(`markdown.ilike.${pattern},original_filename.ilike.${pattern}`);
    }
  }
  if (options.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")) as { created_at?: string; id?: string };
      if (!cursor.created_at || !isUuid(cursor.id)) throw new Error("invalid_cursor");
      query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    } catch {
      return { ok: false as const, statusCode: 400, error: "visual_asset_cursor_invalid" };
    }
  }
  const { data, error } = await query.limit(limit + 1);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_image_bank_list_failed",
      detail: error.message,
    };
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const images = rows.slice(0, limit);
  const ids = images.map((image) => image.id as string);
  const { data: sources, error: sourceError } = ids.length
    ? await supabase
        .from("marketing_visual_asset_sources")
        .select("image_id, channel, source_kind, store_id, representation_kind, source_metadata")
        .eq("organization_id", organizationId)
        .in("image_id", ids)
        .then((result) => selectedStoreIds ? { ...result, data: (result.data ?? []).filter((source) => source.store_id === null || selectedStoreIds.includes(source.store_id as string)) } : result)
    : { data: [], error: null };
  if (sourceError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "visual_asset_sources_load_failed",
      detail: sourceError.message,
    };
  }
  const signedUrls = await resolveBankImageUrls(
    createServiceClient(env),
    organizationId,
    images as Array<Record<string, unknown>>,
  );
  const imagesWithPreview = images.map((image) => {
    const { storage_bucket: _storageBucket, storage_path: _storagePath, ...safeImage } = image;
    return {
      ...safeImage,
      public_url: signedUrls.urls.get(image.id as string) ?? image.public_url,
      preview_error: signedUrls.errors.get(image.id as string) ?? null,
    };
  });
  const last = images.at(-1) as Record<string, unknown> | undefined;
  const nextCursor = hasMore && last
    ? Buffer.from(JSON.stringify({ created_at: last.created_at, id: last.id })).toString("base64url")
    : null;
  return {
    ok: true as const,
    data: { images: attachVisualAssetSources(imagesWithPreview, sources ?? []), next_cursor: nextCursor, has_more: hasMore },
  };
}

export async function getInstagramImagePreview(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  imageId: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const { data: row, error } = await supabase.from("instagram_image_bank")
    .select("id, organization_id, storage_bucket, storage_path, public_url, store_id")
    .eq("id", imageId).eq("organization_id", organizationId).maybeSingle();
  if (error || !row) return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  const scope = storeAccess(context, organizationId, row.store_id as string | null);
  if (!scope.ok) return scope;
  const resolved = await resolveBankImageUrls(supabase, organizationId, [row as Record<string, unknown>]);
  const url = resolved.urls.get(imageId);
  if (!url) return { ok: false as const, statusCode: 502, error: "visual_asset_preview_url_failed", detail: resolved.errors.get(imageId) };
  return { ok: true as const, data: { image_id: imageId, url, expires_in: SIGNED_IMAGE_URL_SECONDS } };
}

// --------------------------------------------------------------------------
// Editar la ficha (markdown) que va a RAG
// --------------------------------------------------------------------------

export async function updateInstagramImageMarkdown(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  imageId: string,
  payload: Record<string, unknown>,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const markdown =
    typeof payload.markdown === "string" ? payload.markdown.trim() : "";
  if (!markdown) {
    return { ok: false as const, statusCode: 400, error: "markdown_requerido" };
  }
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "markdown_demasiado_largo",
    };
  }

  const supabase = createServiceClient(env);
  const { data: row, error: loadError } = await supabase
    .from("instagram_image_bank")
    .select("id, organization_id, original_filename, created_by, knowledge_document_id, checksum, content_revision, store_id")
    .eq("id", imageId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (loadError || !row) {
    return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  }

  const expectedRevision = typeof payload.expected_revision === "number" ? payload.expected_revision : row.content_revision as number;
  if (expectedRevision !== row.content_revision) return { ok: false as const, statusCode: 409, error: "visual_asset_revision_conflict", current_revision: row.content_revision };
  let knowledgeDocumentId = row.knowledge_document_id as string | null;
  let indexStatus = "failed";
  try {
    knowledgeDocumentId = await reindexImageMarkdown(env, supabase, {
      organizationId,
      createdBy: row.created_by as string,
      filename: row.original_filename as string,
      previousDocumentId: row.knowledge_document_id as string | null,
      markdown,
      imageId,
      sourceChecksum: row.checksum as string,
      storeId: row.store_id as string | null,
      sourceRevision: expectedRevision + 1,
    });
    indexStatus = knowledgeDocumentId ? "indexed" : "not_configured";
  } catch {
    // Saving a human correction is independent from RAG availability.
  }

  const { data: updated, error: updateError } = await supabase
    .from("instagram_image_bank")
    .update({
      markdown,
      knowledge_document_id: knowledgeDocumentId,
      index_status: indexStatus,
      content_revision: expectedRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", imageId)
    .eq("organization_id", organizationId)
    .eq("content_revision", expectedRevision)
    .select(IMAGE_COLUMNS)
    .single();
  if (updateError || !updated) {
    return {
      ok: false as const,
      statusCode: updateError?.code === "PGRST116" ? 409 : 500,
      error: updateError?.code === "PGRST116" ? "visual_asset_revision_conflict" : "instagram_image_update_failed",
      detail: updateError?.message,
    };
  }
  await supabase.from("instagram_image_analysis_revisions").upsert({
    organization_id: organizationId,
    image_id: imageId,
    revision: expectedRevision + 1,
    actor_user_id: context.user.id,
    change_kind: "human_edit",
    analysis: null,
    markdown,
    analysis_fingerprint: null,
    source_checksum: row.checksum as string,
  }, { onConflict: "image_id,revision" });
  return { ok: true as const, data: { image: updated } };
}

// --------------------------------------------------------------------------
// Reintentar / re-analizar
// --------------------------------------------------------------------------

export async function retryInstagramImage(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  imageId: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: updated, error } = await supabase
    .from("instagram_image_bank")
    .update({ status: "queued", error_reason: null, attempts: 0, next_attempt_at: null, claim_token: null, claim_expires_at: null })
    .eq("id", imageId)
    .eq("organization_id", organizationId)
    .in("status", ["failed", "analyzed"])
    .select(IMAGE_COLUMNS)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_image_retry_failed",
      detail: error.message,
    };
  }
  if (!updated) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "imagen_no_reintentable",
      message: "La imagen no existe o ya está en cola / analizándose.",
    };
  }
  return { ok: true as const, data: { image: updated } };
}

export async function reindexInstagramImage(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  imageId: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const { data: row, error } = await supabase.from("instagram_image_bank")
    .select("id, organization_id, original_filename, created_by, knowledge_document_id, markdown, checksum, content_revision, store_id, status")
    .eq("id", imageId).eq("organization_id", organizationId).maybeSingle();
  if (error || !row) return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  if (row.status !== "analyzed" || typeof row.markdown !== "string" || !row.markdown.trim()) {
    return { ok: false as const, statusCode: 409, error: "visual_asset_analysis_required" };
  }
  let documentId: string | null = null;
  try {
    documentId = await reindexImageMarkdown(env, supabase, {
      organizationId,
      createdBy: row.created_by as string,
      filename: row.original_filename as string,
      previousDocumentId: row.knowledge_document_id as string | null,
      markdown: row.markdown as string,
      imageId,
      sourceChecksum: row.checksum as string,
      sourceRevision: row.content_revision as number,
      storeId: row.store_id as string | null,
    });
  } catch (cause) {
    const { error: stateError } = await supabase.from("instagram_image_bank")
      .update({ index_status: "failed", error_reason: cause instanceof Error ? cause.message.slice(0, 500) : "visual_index_failed" })
      .eq("id", imageId).eq("organization_id", organizationId);
    if (stateError) return { ok: false as const, statusCode: 500, error: "visual_index_state_save_failed", detail: stateError.message };
    return { ok: false as const, statusCode: 503, error: "visual_index_failed", detail: cause instanceof Error ? cause.message : "unknown_error" };
  }
  const { data: updated, error: updateError } = await supabase.from("instagram_image_bank")
    .update({ knowledge_document_id: documentId, index_status: documentId ? "indexed" : "not_configured", error_reason: null })
    .eq("id", imageId).eq("organization_id", organizationId).eq("content_revision", row.content_revision as number)
    .select(IMAGE_COLUMNS).maybeSingle();
  if (updateError || !updated) return { ok: false as const, statusCode: 409, error: "visual_asset_revision_conflict", detail: updateError?.message };
  return { ok: true as const, data: { image: updated, indexed: Boolean(documentId) } };
}

// --------------------------------------------------------------------------
// Borrar (imagen + objeto de storage + documento RAG)
// --------------------------------------------------------------------------

export async function deleteInstagramImage(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  imageId: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: row } = await supabase
    .from("instagram_image_bank")
    .select("id, storage_bucket, storage_path, knowledge_document_id, status")
    .eq("id", imageId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!row) {
    return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  }

  // Tombstone first. This fences any in-flight worker through its claim token,
  // and keeps enough metadata to retry cleanup if Storage or RAG is offline.
  const { data: tombstonedRow, error: tombstoneError } = await supabase.from("instagram_image_bank")
    .update({ status: "deleting", claim_token: null, claim_expires_at: null, next_attempt_at: null })
    .eq("id", imageId).eq("organization_id", organizationId)
    .select("id, storage_bucket, storage_path, knowledge_document_id")
    .maybeSingle();
  if (tombstoneError) return { ok: false as const, statusCode: 500, error: "instagram_image_delete_prepare_failed", detail: tombstoneError.message };
  if (!tombstonedRow) return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };

  if (tombstonedRow.storage_path) {
    const bucket = tombstonedRow.storage_bucket === PRIVATE_SOURCE_BUCKET ? PRIVATE_SOURCE_BUCKET : BUCKET;
    const { error } = await supabase.storage.from(bucket).remove([tombstonedRow.storage_path as string]);
    if (error) return { ok: false as const, statusCode: 503, error: "instagram_image_storage_cleanup_pending", detail: error.message };
    signedImageUrlCache.delete(`${organizationId}:${tombstonedRow.storage_path}`);
  }
  if (tombstonedRow.knowledge_document_id) {
    // cascade borra los chunks
    const { error } = await supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", tombstonedRow.knowledge_document_id as string);
    if (error) return { ok: false as const, statusCode: 503, error: "instagram_image_rag_cleanup_pending", detail: error.message };
  }
  const { error } = await supabase
    .from("instagram_image_bank")
    .delete()
    .eq("id", imageId)
    .eq("organization_id", organizationId);
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_image_delete_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: { deleted: imageId } };
}

// --------------------------------------------------------------------------
// Procesador de cola (interno, sin auth) -- lo dispara el worker cada minuto
// --------------------------------------------------------------------------

export async function processInstagramImageQueue(env: ApiEnv) {
  const supabase = createServiceClient(env);

  const { data: candidates, error: pickError } = await supabase.rpc("claim_a15_visual_jobs", {
    p_limit: QUEUE_BATCH,
    p_lease_seconds: 900,
  });
  if (pickError) {
    return { status: "error" as const, detail: pickError.message, processed: 0 };
  }
  if (!candidates || candidates.length === 0) {
    return { status: "idle" as const, processed: 0 };
  }

  const claimedRows = (candidates ?? []) as Array<Record<string, unknown>>;
  const claimedIds = claimedRows.map((row) => row.id as string);
  const claimedOrganizations = [...new Set(claimedRows.map((row) => row.organization_id as string))];
  const visualSourceResult = claimedIds.length
    ? await supabase
        .from("marketing_visual_asset_sources")
        .select("organization_id, image_id, channel, source_kind, store_id, representation_kind, source_metadata")
        .in("organization_id", claimedOrganizations)
        .in("image_id", claimedIds)
    : { data: [] };
  const visualSources = (visualSourceResult.data ?? []) as Array<Record<string, unknown>>;
  const disabledAgents = await loadDisabledAgents(supabase, claimedOrganizations);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Una a una: cada imagen es una llamada de visión independiente.
  for (const row of claimedRows) {
    const organizationId = row.organization_id as string;
    const sources = (visualSources ?? []).filter((source) => source.organization_id === organizationId && source.image_id === row.id);
    const sourceChannels = [...new Set(
      sources.map((source) => source.channel as string),
    )];

    if (disabledAgents.get(organizationId)?.has("a15_analista_imagenes")) {
      await supabase.from("instagram_image_bank")
        .update({
          status: "queued",
          attempts: Math.max(0, Number(row.attempts ?? 1) - 1),
          error_reason: "agent_disabled_for_organization",
          next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          claim_token: null,
          claim_expires_at: null,
        })
        .eq("id", row.id as string)
        .eq("claim_token", row.claim_token as string);
      skipped += 1;
      continue;
    }

    const budget = await checkOrganizationDailyBudget(supabase, organizationId);
    const circuit = await checkOrganizationProviderCircuit(
      supabase,
      organizationId,
    );
    if (budget.ok === false || circuit.ok === false) {
      // Devuélvela a la cola sin gastar un intento; se reintenta al siguiente tick.
      await supabase
        .from("instagram_image_bank")
        .update({
          status: "queued",
          attempts: Math.max(0, (row.attempts as number) - 1),
          error_reason:
            budget.ok === false ? budget.message : circuit.ok === false ? circuit.message : null,
          next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          claim_token: null,
          claim_expires_at: null,
        })
        .eq("id", row.id as string)
        .eq("claim_token", row.claim_token as string);
      skipped += 1;
      continue;
    }

    const imageUrls = await resolveBankImageUrls(supabase, organizationId, [row as Record<string, unknown>]);
    const imageUrl = imageUrls.urls.get(row.id as string) ?? null;
    if (!imageUrl) {
      const previewError = imageUrls.errors.get(row.id as string) ?? "visual_asset_signed_url_missing";
      await supabase
        .from("instagram_image_bank")
        .update({ status: "failed", error_reason: previewError, claim_token: null, claim_expires_at: null })
        .eq("id", row.id as string)
        .eq("organization_id", organizationId)
        .eq("claim_token", row.claim_token as string);
      failed += 1;
      continue;
    }

    const heartbeat = setInterval(() => {
      void supabase.from("instagram_image_bank")
        .update({ claim_expires_at: new Date(Date.now() + 15 * 60_000).toISOString() })
        .eq("id", row.id as string)
        .eq("claim_token", row.claim_token as string);
    }, 45_000);
    let result: Awaited<ReturnType<typeof analyzeInstagramImage>>;
    try {
      result = await analyzeInstagramImage(env, {
      organizationId,
      actorUserId: row.created_by as string,
      imageUrl,
      filename: row.original_filename as string,
      contentType: row.content_type as string,
      sourceChannels,
      sourceAssetId: row.id as string,
      sourceChecksum: row.checksum as string,
      representationKind: row.representation_kind as "static_image" | "static_thumbnail" | "video_frame" | "carousel_slide",
      storeId: typeof row.store_id === "string" ? row.store_id : null,
      triggerType: "manual",
        deferRunCompletion: true,
        sources: sources.map((source) => ({
        channel: source.channel as string,
        source_kind: source.source_kind as string,
        representation_kind: source.representation_kind as string,
        store_id: source.store_id as string | null,
        source_metadata: source.source_metadata,
        })),
      });
    } finally {
      clearInterval(heartbeat);
    }

    const nextAttempts = row.attempts as number;

    if (!result.ok) {
      const budgetPaused = result.error === "organization_daily_budget_exceeded" || result.error === "organization_daily_budget_reservation_unavailable";
      if (budgetPaused) {
        await supabase.from("instagram_image_bank").update({
          status: "queued",
          attempts: Math.max(0, nextAttempts - 1),
          error_reason: result.detail.slice(0, 500),
          next_attempt_at: new Date(Date.now() + (result.error === "organization_daily_budget_exceeded" ? 30 : 5) * 60_000).toISOString(),
          claim_token: null,
          claim_expires_at: null,
        }).eq("id", row.id as string).eq("claim_token", row.claim_token as string);
        skipped += 1;
        continue;
      }
      const giveUp = nextAttempts >= MAX_ATTEMPTS || !result.retriable;
      await supabase
        .from("instagram_image_bank")
        .update({
          status: giveUp ? "failed" : "queued",
          attempts: nextAttempts,
          error_reason: result.detail.slice(0, 500),
          next_attempt_at: giveUp ? null : new Date(Date.now() + Math.min(60, 2 ** nextAttempts) * 60_000).toISOString(),
          claim_token: null,
          claim_expires_at: null,
        })
        .eq("id", row.id as string)
        .eq("claim_token", row.claim_token as string);
      failed += 1;
      continue;
    }

    const markdown = instagramImageAnalysisToMarkdown(result.analysis, {
      filename: row.original_filename as string,
    });

    let knowledgeDocumentId: string | null = null;
    try {
      knowledgeDocumentId = await reindexImageMarkdown(env, supabase, {
        organizationId,
        createdBy: row.created_by as string,
        filename: row.original_filename as string,
        previousDocumentId: row.knowledge_document_id as string | null,
        markdown,
        imageId: row.id as string,
        sourceChecksum: row.checksum as string,
      });
    } catch {
      // El RAG es best-effort: la ficha ya vive en el banco aunque no se indexe.
      knowledgeDocumentId = null;
    }

    const { data: finalized, error: finalizeError } = await supabase
      .from("instagram_image_bank")
      .update({
        status: "analyzed",
        analysis: result.analysis,
        analysis_fingerprint: result.analysisFingerprint,
        markdown,
        knowledge_document_id: knowledgeDocumentId ?? row.knowledge_document_id as string | null,
        index_status: knowledgeDocumentId ? "indexed" : env.VOYAGE_API_KEY ? "failed" : "not_configured",
        agent_run_id: result.runId,
        analyzed_at: new Date().toISOString(),
        attempts: nextAttempts,
        content_revision: (row.content_revision as number) + 1,
        error_reason: null,
        claim_token: null,
        claim_expires_at: null,
      })
      .eq("id", row.id as string)
      .eq("claim_token", row.claim_token as string)
      .eq("content_revision", row.content_revision as number)
      .select("id")
      .maybeSingle();
    if (finalizeError || !finalized) {
      await supabase.from("agent_runs").update({ status: "failed", error_message: (finalizeError?.message ?? "visual_asset_finalize_conflict").slice(0, 500), finished_at: new Date().toISOString() }).eq("id", result.runId).eq("organization_id", organizationId);
      await settleOrganizationDailyBudgetReservation(supabase, organizationId, result.runId);
      recordAiRunMetrics("a15_analista_imagenes", "failed");
      failed += 1;
      continue;
    }
    const { error: runFinalizeError } = await supabase.from("agent_runs")
      .update(result.completionFields ?? { status: "succeeded", finished_at: new Date().toISOString() })
      .eq("id", result.runId).eq("organization_id", organizationId);
    await settleOrganizationDailyBudgetReservation(supabase, organizationId, result.runId);
    if (runFinalizeError) recordAiRunMetrics("a15_analista_imagenes", "failed");
    else recordAiRunMetrics("a15_analista_imagenes", "succeeded", result.estimatedCostUsd);
    const { data: latest } = await supabase.from("instagram_image_bank").select("content_revision, markdown, analysis_fingerprint").eq("id", row.id as string).maybeSingle();
    if (latest) await supabase.from("instagram_image_analysis_revisions").upsert({
      organization_id: organizationId,
      image_id: row.id as string,
      revision: latest.content_revision as number,
      actor_user_id: null,
      change_kind: "ai_analysis",
      analysis: result.analysis,
      markdown,
      analysis_fingerprint: result.analysisFingerprint,
      source_checksum: row.checksum as string,
      agent_run_id: result.runId,
    }, { onConflict: "image_id,revision" });
    processed += 1;
  }

  return { status: "ok" as const, processed, failed, skipped };
}

// --------------------------------------------------------------------------
// RAG: (re)indexa el markdown de una imagen como documento de conocimiento.
// Borra la versión anterior (cascade sobre chunks) y crea una nueva. Devuelve
// el id del documento, o null si no hay proveedor de embeddings configurado.
// --------------------------------------------------------------------------

async function reindexImageMarkdown(
  env: ApiEnv,
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    createdBy: string;
    filename: string;
    previousDocumentId: string | null;
    markdown: string;
    imageId?: string;
    sourceChecksum?: string | null;
    storeId?: string | null;
    contentChecksum?: string | null;
    sourceRevision?: number;
  },
): Promise<string | null> {
  if (!env.VOYAGE_API_KEY) return null;

  const provider = createRagEmbeddingProvider(env.VOYAGE_API_KEY);
  const chunks = chunkText(input.markdown);
  if (chunks.length === 0) return null;
  const vectors = await embedChunksInOrder(chunks, provider);

  const checksum = crypto
    .createHash("sha256")
    .update(input.markdown)
    .digest("hex");

  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .insert({
      organization_id: input.organizationId,
      title: `Activo visual · ${input.filename}`.slice(0, 255),
      description: "Ficha visual multicanal del banco de marketing (extracción IA).",
      source_type: "visual_asset",
      visibility: "organization",
      audience: "client_visible",
      origin: "ai_generated",
      authority: "contextual",
      ingested_by: "system",
      status: "active",
      checksum,
      embedding_model: provider.model,
      created_by: input.createdBy,
      source_entity_type: input.imageId ? "instagram_image_bank" : null,
      source_entity_id: input.imageId ?? null,
      source_version: input.sourceRevision ?? (input.imageId ? 1 : null),
      store_id: input.storeId ?? null,
    })
    .select("id")
    .single();
  if (documentError || !document) {
    throw new Error(
      `instagram_image_knowledge_document_failed: ${documentError?.message}`,
    );
  }

  const { error: chunksError } = await supabase.from("knowledge_chunks").insert(
    chunks.map((chunk, index) => ({
      document_id: document.id,
      organization_id: input.organizationId,
      chunk_index: index,
      content: chunk,
      token_count: Math.ceil(chunk.length / 4),
      embedding: JSON.stringify(vectors[index]),
    })),
  );
  if (chunksError) {
    await supabase.from("knowledge_documents").delete().eq("id", document.id);
    throw new Error(
      `instagram_image_knowledge_chunks_failed: ${chunksError.message}`,
    );
  }

  if (input.previousDocumentId && input.previousDocumentId !== document.id) {
    const { error: supersedeError } = await supabase
      .from("knowledge_documents")
      .update({ status: "superseded" })
      .eq("id", input.previousDocumentId)
      .eq("organization_id", input.organizationId);
    if (supersedeError) throw new Error(`instagram_image_old_index_supersede_failed: ${supersedeError.message}`);
  }

  return document.id as string;
}

// ==========================================================================
// Piezas estáticas: texto sobre una imagen del banco
// ==========================================================================

const OVERLAY_COLUMNS =
  "id, image_id, name, format, ratio, slides, creative_brief, channel, created_at, updated_at";

async function authorizedOverlay(env: ApiEnv, context: AuthContext, organizationId: string, overlayId: string) {
  const access = requireBankAccess(context, organizationId);
  if (!access.ok) return access;
  const supabase = createServiceClient(env);
  const { data: overlay, error } = await supabase.from("instagram_image_overlays")
    .select(`${OVERLAY_COLUMNS}, organization_id`).eq("id", overlayId).eq("organization_id", organizationId).maybeSingle();
  if (error || !overlay) return { ok: false as const, statusCode: 404, error: "pieza_no_encontrada" };
  const slides = overlaySlidesSchema.safeParse(overlay.slides);
  if (!slides.success) return { ok: false as const, statusCode: 422, error: "overlay_layout_invalid" };
  const ids = slides.data.flatMap(slide => slide.image_id ? [slide.image_id] : []);
  const images = ids.length ? await supabase.from("instagram_image_bank").select(IMAGE_COLUMNS).eq("organization_id", organizationId).in("id", ids) : { data: [], error: null };
  if (images.error || ids.some(id => !images.data?.some(image => image.id === id))) return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  const scope = storeAccess(context, organizationId, null);
  if (!scope.ok) return scope;
  const sourceStores = ids.length ? await supabase.from("marketing_visual_asset_sources").select("image_id,store_id").eq("organization_id", organizationId).in("image_id", ids) : { data: [], error: null };
  if (sourceStores.error) return { ok: false as const, statusCode: 503, error: "visual_asset_store_scope_load_failed" };
  const stores = new Set<string>();
  for (const image of images.data ?? []) {
    const imageStores = image.store_id ? [image.store_id as string] : [...new Set((sourceStores.data ?? []).filter(source => source.image_id === image.id && source.store_id).map(source => source.store_id as string))];
    for (const storeId of imageStores) { const permitted = storeAccess(context, organizationId, storeId); if (!permitted.ok) return permitted; }
    if (scope.allowedStoreIds && (!imageStores.length || imageStores.some(store => !scope.allowedStoreIds!.includes(store)))) return { ok: false as const, statusCode: 403, error: "visual_asset_store_access_denied" };
    for (const store of imageStores) stores.add(store);
  }
  if (stores.size > 1) return { ok: false as const, statusCode: 409, error: "overlay_mixed_stores" };
  const storeId = [...stores][0] ?? null;
  const store = storeId ? await supabase.from("shopify_stores").select("connection_id").eq("organization_id", organizationId).eq("id", storeId).maybeSingle() : { data: null };
  return { ok: true as const, supabase, overlay, slides: slides.data, images: images.data ?? [], storeId, connectionId: store.data?.connection_id as string | null };
}

async function overlaySourceBytes(supabase: SupabaseClient, organizationId: string, image: Record<string, unknown>) {
  const bucket = image.storage_bucket ?? BUCKET;
  const path = image.storage_path;
  if (![BUCKET, PRIVATE_SOURCE_BUCKET].includes(String(bucket)) || typeof path !== "string" || !isOwnedVisualStoragePath(organizationId, path)) throw new Error("visual_asset_storage_scope_invalid");
  const { data, error } = await supabase.storage.from(String(bucket)).download(path);
  if (error || !data || data.size > META_IMAGE_MAX_BYTES) throw new Error("visual_asset_download_failed");
  return Buffer.from(await data.arrayBuffer());
}

export async function renderInstagramOverlay(env: ApiEnv, context: AuthContext, organizationId: string, overlayId: string, slideIndex: number) {
  const loaded = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!loaded.ok) return loaded;
  const slide = loaded.slides[slideIndex];
  const image = loaded.images.find(image => image.id === slide?.image_id);
  if (!Number.isInteger(slideIndex) || !slide || !image) return { ok: false as const, statusCode: 404, error: "slide_sin_imagen" };
  const ratio = overlayRatioSchema.parse(loaded.overlay.ratio);
  try {
    const source = await overlaySourceBytes(loaded.supabase, organizationId, image);
    const png = await renderOverlayImage(source, ratio, slide.blocks);
    return { ok: true as const, data: { png, hash: crypto.createHash("sha256").update(png).digest("hex"), ratio, image_id: image.id } };
  } catch (error) { return { ok: false as const, statusCode: 422, error: error instanceof Error ? error.message : "overlay_render_failed", message:error instanceof Error && error.message === "overlay_text_overflow" ? "El texto se sale de la imagen. Reduce su tamaño, acorta el texto o muévelo antes de descargar." : "No se pudo preparar esta imagen. Revisa el archivo y la composición." }; }
}

/** Immutable private PNGs linked to the exact saved composition. No model call. */
export async function prepareOverlayForMarketing(env: ApiEnv, context: AuthContext, organizationId: string, overlayId: string, generateMissing = false, usage?: string) {
  let loaded = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!loaded.ok) return loaded;
  if (generateMissing) {
    for (let index = 0; index < loaded.slides.length; index++) {
      if (!loaded.slides[index]?.image_id || loaded.slides[index]!.blocks.length) continue;
      const result = await draftInstagramOverlayText(env, context, organizationId, overlayId, { slide_index: index, usage, idempotency_key: `compose:${overlayFingerprint(loaded.overlay)}:${index}` });
      if (!result.ok) return result;
      loaded = await authorizedOverlay(env, context, organizationId, overlayId);
      if (!loaded.ok) return loaded;
    }
  }
  const revision = overlayFingerprint({ ratio: loaded.overlay.ratio, slides: loaded.slides, brief: loaded.overlay.creative_brief, renderer: OVERLAY_RENDER_VERSION });
  const assets = [];
  for (let index = 0; index < loaded.slides.length; index++) {
    if (!loaded.slides[index]?.image_id) continue;
    const rendered = await renderInstagramOverlay(env, context, organizationId, overlayId, index);
    if (!rendered.ok) return rendered;
    const path = `${organizationId}/overlays/${overlayId}/${revision}-${index}.png`;
    const upload = await loaded.supabase.storage.from(PRIVATE_SOURCE_BUCKET).upload(path, rendered.data.png, { contentType: "image/png", upsert: false });
    if (upload.error && !["409", "Duplicate"].includes(String((upload.error as { statusCode?: string }).statusCode)) && !/already exists|duplicate/i.test(upload.error.message)) return { ok: false as const, statusCode: 503, error: "overlay_asset_save_failed" };
    const signed = await loaded.supabase.storage.from(PRIVATE_SOURCE_BUCKET).createSignedUrl(path, 3600);
    if (signed.error || !signed.data) return { ok: false as const, statusCode: 503, error: "overlay_asset_preview_failed" };
    const source = loaded.images.find(image => image.id === rendered.data.image_id);
    const alt = (source?.analysis as { alt_text?: string } | null)?.alt_text ?? String(source?.original_filename ?? "Imagen de campaña");
    assets.push({ storage_bucket: PRIVATE_SOURCE_BUCKET, storage_path: path, image_id: rendered.data.image_id, generation_run_id:loaded.slides[index]!.generation_run_id ?? null, slide_index: index, sha256: rendered.data.hash, url: signed.data.signedUrl, alt_text: `${alt}. ${overlayTextOf(loaded.slides[index]!.blocks)}`.slice(0, 800), ...OVERLAY_DIMS[rendered.data.ratio] });
  }
  if (!assets.length) return { ok: false as const, statusCode: 422, error: "pieza_sin_imagenes" };
  const current = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!current.ok) return current;
  if (overlayFingerprint({ ratio: current.overlay.ratio, slides: current.slides, brief: current.overlay.creative_brief, renderer: OVERLAY_RENDER_VERSION }) !== revision) return { ok: false as const, statusCode: 409, error: "overlay_changed_during_render" };
  return { ok: true as const, data: { overlay_id: overlayId, revision, store_id: loaded.storeId, connection_id: loaded.connectionId, renderer: OVERLAY_RENDER_VERSION, assets } };
}

type OverlayFormat = "single" | "carousel" | "story";
const MAX_SLIDES = 10;

function normalizeFormat(value: unknown): OverlayFormat {
  return value === "carousel" || value === "story" ? value : "single";
}

function ratioForFormat(format: OverlayFormat, requested: unknown): string {
  if (format === "story") return "9:16";
  return requested === "1:1" ? "1:1" : "4:5";
}

export async function listInstagramOverlays(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  imageId?: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const scope = storeAccess(context, organizationId, null);
  if (!scope.ok) return scope;
  const supabase = createServiceClient(env);
  let allowedImageIds: string[] | null = null;
  if (scope.allowedStoreIds) {
    const { data: images, error: imageError } = await supabase
      .from("instagram_image_bank")
      .select("id")
      .eq("organization_id", organizationId)
      .in("store_id", scope.allowedStoreIds);
    if (imageError) return { ok: false as const, statusCode: 500, error: "visual_asset_scope_lookup_failed", detail: imageError.message };
    allowedImageIds = (images ?? []).map((image) => image.id as string);
    if (imageId && !allowedImageIds.includes(imageId)) {
      return { ok: false as const, statusCode: 403, error: "visual_asset_store_access_denied" };
    }
    if (allowedImageIds.length === 0) return { ok: true as const, data: { overlays: [] } };
  }
  let query = supabase
    .from("instagram_image_overlays")
    .select(OVERLAY_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (imageId) query = query.eq("image_id", imageId);
  else if (allowedImageIds) query = query.in("image_id", allowedImageIds);
  const { data, error } = await query;
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_overlays_list_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: { overlays: data ?? [] } };
}

async function assertImagesInOrg(
  supabase: SupabaseClient,
  organizationId: string,
  imageIds: string[],
  context?: AuthContext,
): Promise<boolean> {
  if (imageIds.length === 0) return true;
  const { data } = await supabase
    .from("instagram_image_bank")
    .select("id,store_id")
    .eq("organization_id", organizationId)
    .in("id", imageIds);
  const found = new Set((data ?? []).map((row) => row.id as string));
  if (context) {
    const scope = storeAccess(context, organizationId, null);
    if (!scope.ok) return false;
    for (const row of data ?? []) {
      if (row.store_id && !storeAccess(context, organizationId, row.store_id).ok) return false;
      if (!row.store_id && scope.allowedStoreIds) {
        const linked = await supabase.from("marketing_visual_asset_sources").select("image_id").eq("organization_id", organizationId).eq("image_id", row.id).in("store_id", scope.allowedStoreIds).limit(1);
        if (linked.error || !linked.data?.length) return false;
      }
    }
  }
  return imageIds.every((id) => found.has(id));
}

export async function createInstagramOverlay(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const format = normalizeFormat(payload.format);
  const name =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim().slice(0, 160)
      : "Pieza sin título";
  const creativeBrief =
    typeof payload.creative_brief === "string"
      ? payload.creative_brief.trim().slice(0, 2000)
      : "";
  const channel = payload.channel === "meta_ads" ? "meta_ads" : "instagram_organic";
  // Acepta image_ids[] (nuevo) o image_id (compat).
  const rawIds = Array.isArray(payload.image_ids)
    ? (payload.image_ids as unknown[])
    : typeof payload.image_id === "string"
      ? [payload.image_id]
      : [];
  const imageIds = rawIds
    .filter((id): id is string => typeof id === "string")
    .slice(0, MAX_SLIDES);

  const supabase = createServiceClient(env);
  if (!(await assertImagesInOrg(supabase, organizationId, imageIds, context))) {
    return { ok: false as const, statusCode: 400, error: "imagen_no_encontrada" };
  }

  const slides = imageIds.map((imageId) => ({ image_id: imageId, blocks: [] }));

  const { data: inserted, error } = await supabase
    .from("instagram_image_overlays")
    .insert({
      organization_id: organizationId,
      image_id: imageIds[0] ?? null,
      name,
      format,
      ratio: ratioForFormat(format, payload.ratio),
      slides,
      creative_brief: creativeBrief,
      channel,
      created_by: context.user.id,
    })
    .select(OVERLAY_COLUMNS)
    .single();
  if (error || !inserted) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_overlay_create_failed",
      detail: error?.message,
    };
  }
  return { ok: true as const, data: { overlay: inserted } };
}

export async function updateInstagramOverlay(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  overlayId: string,
  payload: Record<string, unknown>,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const authorized = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!authorized.ok) return authorized;

  const patch: Record<string, unknown> = {};
  if (typeof payload.name === "string" && payload.name.trim()) {
    patch.name = payload.name.trim().slice(0, 160);
  }
  if (typeof payload.creative_brief === "string") {
    if (payload.creative_brief.length > 2000) {
      return { ok: false as const, statusCode: 400, error: "brief_demasiado_largo" };
    }
    patch.creative_brief = payload.creative_brief.trim();
  }
  if (payload.channel === "instagram_organic" || payload.channel === "meta_ads") patch.channel = payload.channel;

  let nextFormat: OverlayFormat | null = null;
  if (
    payload.format === "single" ||
    payload.format === "carousel" ||
    payload.format === "story"
  ) {
    nextFormat = payload.format;
    patch.format = payload.format;
  }
  if (
    payload.ratio === "1:1" ||
    payload.ratio === "4:5" ||
    payload.ratio === "9:16"
  ) {
    patch.ratio = payload.ratio;
  }
  // Historia siempre 9:16, gane quien gane arriba.
  if (nextFormat === "story") patch.ratio = "9:16";

  if (Array.isArray(payload.slides)) {
    const slidesRaw = payload.slides as unknown[];
    if (slidesRaw.length > MAX_SLIDES) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "demasiados_slides",
        message: `Máximo ${MAX_SLIDES} imágenes por pieza.`,
      };
    }
    const slides: Array<{ image_id: string | null; blocks: unknown[]; generation_run_id?: string }> = [];
    for (const entry of slidesRaw) {
      if (typeof entry !== "object" || entry === null) {
        return { ok: false as const, statusCode: 400, error: "slide_invalido" };
      }
      const imageId = (entry as { image_id?: unknown }).image_id;
      const blocks = (entry as { blocks?: unknown }).blocks;
      if (imageId !== null && typeof imageId !== "string") {
        return { ok: false as const, statusCode: 400, error: "slide_invalido" };
      }
      if (!Array.isArray(blocks) || blocks.length > 12) {
        return {
          ok: false as const,
          statusCode: 400,
          error: "demasiados_bloques",
          message: "Máximo 12 bloques de texto por imagen.",
        };
      }
      const origin = authorized.slides[slides.length];
      slides.push({ image_id: (imageId as string) ?? null, blocks, ...(origin?.image_id === imageId && origin.generation_run_id ? { generation_run_id: origin.generation_run_id } : {}) });
    }
    if (JSON.stringify(slides).length > 120_000) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "layout_demasiado_grande",
      };
    }
    const supabaseCheck = createServiceClient(env);
    const ids = slides
      .map((slide) => slide.image_id)
      .filter((id): id is string => typeof id === "string");
    if (!(await assertImagesInOrg(supabaseCheck, organizationId, ids, context))) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "imagen_no_encontrada",
      };
    }
    const validSlides = overlaySlidesSchema.safeParse(slides);
    if (!validSlides.success) return { ok: false as const, statusCode: 400, error: "overlay_layout_invalid" };
    patch.slides = validSlides.data;
    patch.image_id = slides[0]?.image_id ?? null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "sin_cambios" };
  }

  const supabase = createServiceClient(env);
  const { data: updated, error } = await supabase
    .from("instagram_image_overlays")
    .update(patch)
    .eq("id", overlayId)
    .eq("organization_id", organizationId)
    .select(OVERLAY_COLUMNS)
    .maybeSingle();
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_overlay_update_failed",
      detail: error.message,
    };
  }
  if (!updated) {
    return { ok: false as const, statusCode: 404, error: "pieza_no_encontrada" };
  }
  return { ok: true as const, data: { overlay: updated } };
}

export async function deleteInstagramOverlay(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  overlayId: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const authorized = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!authorized.ok) return authorized;

  const supabase = createServiceClient(env);
  const { error } = await supabase
    .from("instagram_image_overlays")
    .delete()
    .eq("id", overlayId)
    .eq("organization_id", organizationId);
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_overlay_delete_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: { deleted: overlayId } };
}

type OverlaySlide = { image_id: string | null; blocks: unknown[] };

function readSlides(overlay: { slides?: unknown }): OverlaySlide[] {
  return Array.isArray(overlay.slides)
    ? (overlay.slides as OverlaySlide[])
    : [];
}

// Texto de los bloques que el usuario ha colocado sobre una imagen, en orden.
function overlayTextOf(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) =>
      block &&
      typeof block === "object" &&
      typeof (block as { text?: unknown }).text === "string"
        ? (block as { text: string }).text.trim()
        : "",
    )
    .filter((text) => text.length > 0)
    .join(" · ")
    .slice(0, 600);
}

export async function draftInstagramOverlayText(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  overlayId: string,
  payload: Record<string, unknown>,
  options: { beforeModel?: Parameters<typeof draftInstagramOverlay>[1]["beforeModel"] } = {},
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const authorized = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!authorized.ok) return authorized;

  const supabase = createServiceClient(env);
  const { data: overlay } = await supabase
    .from("instagram_image_overlays")
    .select("id, format, ratio, slides, creative_brief, channel")
    .eq("id", overlayId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!overlay) {
    return { ok: false as const, statusCode: 404, error: "pieza_no_encontrada" };
  }

  const slides = readSlides(overlay);
  const slideIndex =
    typeof payload.slide_index === "number" &&
    Number.isInteger(payload.slide_index)
      ? payload.slide_index
      : 0;
  const slide = slides[slideIndex];
  if (!slide || !slide.image_id) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "slide_sin_imagen",
      message: "Ese slide no tiene una imagen del banco asociada.",
    };
  }

  const { data: image } = await supabase
    .from("instagram_image_bank")
    .select("id, public_url, storage_bucket, storage_path, original_filename, markdown, store_id")
    .eq("id", slide.image_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!image) {
    return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  }
  const imageScope = storeAccess(context, organizationId, image.store_id as string | null);
  if (!imageScope.ok) return imageScope;

  let productContext: string | null = null;
  if (authorized.storeId) {
    const { data: sources } = await supabase
      .from("marketing_visual_asset_sources")
      .select("channel, store_id, source_metadata")
      .eq("organization_id", organizationId)
      .eq("image_id", image.id)
      .eq("store_id", authorized.storeId);
    const productId = (sources ?? []).map((source) => {
      const metadata = source.source_metadata && typeof source.source_metadata === "object"
        ? source.source_metadata as Record<string, unknown>
        : {};
      const isShopifySource = source.channel === "shopify" || metadata.source === "shopify_catalog";
      return isShopifySource && typeof metadata.product_id === "string" ? metadata.product_id : null;
    }).find((id): id is string => Boolean(id));
    if (productId) {
      const { data: product } = await supabase
        .from("shopify_products")
        .select("title, product_type, description_html, tags")
        .eq("id", productId)
        .eq("organization_id", organizationId)
        .eq("store_id", authorized.storeId)
        .maybeSingle();
      if (product) {
        const description = typeof product.description_html === "string"
          ? product.description_html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim().slice(0, 1200)
          : "";
        productContext = [
          `Nombre: ${product.title}`,
          product.product_type ? `Tipo: ${product.product_type}` : null,
          description ? `Descripción de Shopify: ${description}` : null,
          Array.isArray(product.tags) && product.tags.length ? `Etiquetas verificadas: ${product.tags.join(", ")}` : null,
          "No se han proporcionado precio, promoción, stock ni resultados comerciales.",
        ].filter(Boolean).join("\n");
      }
    }
  }

  const ratio = overlayRatioSchema.parse(overlay.ratio);
  const storeId = authorized.storeId;
  let brandQuery = supabase.from("marketing_brand_profiles").select("brand_name,palette,available_fonts,tone_guidelines,preferred_vocabulary,avoided_vocabulary,required_texts,claim_restrictions,image_guidelines").eq("organization_id", organizationId);
  const brand = storeId ? await brandQuery.eq("store_id", storeId).maybeSingle() : await brandQuery.is("store_id", null).maybeSingle();
  if (brand.error) return { ok: false as const, statusCode: 503, error: "marketing_brand_profile_load_failed" };
  const fallbackBrand = !brand.data && storeId ? await supabase.from("marketing_brand_profiles").select("brand_name,palette,available_fonts,tone_guidelines,preferred_vocabulary,avoided_vocabulary,required_texts,claim_restrictions,image_guidelines").eq("organization_id", organizationId).is("store_id", null).maybeSingle() : null;
  if (fallbackBrand?.error) return { ok: false as const, statusCode: 503, error: "marketing_brand_profile_load_failed" };
  const compositionContext = {
    overlay_id: overlayId, slide_index: slideIndex, ratio,
    brand: brand.data ?? fallbackBrand?.data ?? { status: "not_configured" },
    slides: authorized.slides.map((item, index) => ({ index, image_id: item.image_id,
      source_revision: authorized.images.find(row => row.id === item.image_id)?.content_revision,
      source_sha256: authorized.images.find(row => row.id === item.image_id)?.checksum,
      description: authorized.images.find(row => row.id === item.image_id)?.markdown,
      saved_copy: index === slideIndex ? null : overlayTextOf(item.blocks),
    })),
    instruction: "Mantén la narrativa y la voz de la pieza completa. No repitas titulares de otros slides. La imagen adjunta principal YA tiene el recorte final; coloca el texto en ese lienzo. Respeta texto literal indicado en el brief.",
  };
  const objective = typeof payload.objective === "string" ? payload.objective.trim().slice(0, 2000) : String(overlay.creative_brief ?? "");
  const inputHash = overlayFingerprint({ compositionContext, productContext, objective, usage:payload.usage, source: authorized.images.map(row => [row.id, row.checksum, row.content_revision]), renderer:OVERLAY_RENDER_VERSION, model: getAgentModelDecision("a16_texto_sobre_imagen")?.model });
  if (payload.idempotency_key !== undefined && (typeof payload.idempotency_key !== "string" || !payload.idempotency_key.trim() || payload.idempotency_key.length > 160)) return { ok: false as const, statusCode: 400, error: "overlay_idempotency_key_invalid" };
  const key = typeof payload.idempotency_key === "string" ? payload.idempotency_key : `implicit:${inputHash}`;
  const hash = overlayFingerprint([organizationId, context.user.id, overlayId, slideIndex, key]);
  const runId = `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  const prior = await supabase.from("agent_runs").select("status,started_at,agent_outputs(output),agent_context_snapshots(snapshot)").eq("id", runId).eq("organization_id", organizationId).maybeSingle();
  if (prior.error) return { ok: false as const, statusCode: 503, error: "overlay_generation_lookup_failed" };
  const priorOutput = prior.data?.agent_outputs as unknown as { output: unknown } | Array<{ output: unknown }> | null;
  const cached = Array.isArray(priorOutput) ? priorOutput[0]?.output : priorOutput?.output;
  const snapshots = prior.data?.agent_context_snapshots as unknown as { snapshot: { blocks?: Array<{ data?: { input_hash?: string } }> } } | Array<{ snapshot: { blocks?: Array<{ data?: { input_hash?: string } }> } }> | null;
  const snapshot = Array.isArray(snapshots) ? snapshots[0]?.snapshot : snapshots?.snapshot;
  const previousInputHash = snapshot?.blocks?.find(block => block.data?.input_hash)?.data?.input_hash;
  if (prior.data && previousInputHash && previousInputHash !== inputHash) return { ok: false as const, statusCode: 409, error: "overlay_request_changed", message: "La pieza cambió desde esta petición. Actualiza la vista antes de generar otra propuesta." };
  const inProgress = prior.data && ["running", "queued"].includes(prior.data.status);
  const resilience = getAgentModelDecision("a16_texto_sobre_imagen")!.resilience;
  const staleAfter = resilience.timeoutMs * (resilience.maxRetries + 1) + 120_000;
  if (inProgress && !cached && Date.now() - Date.parse(prior.data!.started_at) > staleAfter) {
    const expired = await supabase.from("agent_runs").update({ status:"timeout", finished_at:new Date().toISOString(), error_message:"a16_generation_lease_expired" }).eq("id",runId).eq("organization_id",organizationId).eq("status",prior.data!.status).select("id").maybeSingle();
    if (expired.error) return { ok:false as const,statusCode:503,error:"overlay_generation_lookup_failed" };
    if (expired.data) return { ok:false as const,statusCode:422,error:"overlay_generation_failed",message:"La ejecución anterior agotó su tiempo. Se conservan los slides terminados; vuelve a pulsar para generar el pendiente." };
  }
  if (prior.data && !cached) return { ok: false as const, statusCode: inProgress ? 409 : 422, error: inProgress ? "overlay_generation_in_progress" : "overlay_generation_failed", message: inProgress ? "La propuesta sigue generándose. Espera y vuelve a pulsar para recuperar esa misma respuesta." : "La generación anterior falló. Puedes volver a intentarlo; se conservan los slides terminados." };
  const parsedCache = cached ? instagramOverlayDraftSchema.safeParse(cached) : null;
  if (parsedCache && !parsedCache.success) return { ok: false as const, statusCode: 422, error: "overlay_cached_output_invalid" };
  let draft = parsedCache?.success ? parsedCache.data : undefined;
  if (!draft) {
  let imageUrl: string;
  const neighborImages = [];
  try {
    const crop = await cropOverlayImage(await overlaySourceBytes(supabase, organizationId, image), ratio);
    imageUrl = `data:image/png;base64,${crop.toString("base64")}`;
    for (const index of [slideIndex - 1, slideIndex + 1]) {
      const neighbor = authorized.images.find(row => row.id === authorized.slides[index]?.image_id);
      if (!neighbor) continue;
      const bytes = await cropOverlayImage(await overlaySourceBytes(supabase, organizationId, neighbor), ratio);
      neighborImages.push({ url: `data:image/png;base64,${bytes.toString("base64")}`, role: `slide vecino ${index + 1}; solo contexto` });
    }
  } catch { return { ok: false as const, statusCode: 502, error: "overlay_source_load_failed" }; }

  const result = await draftInstagramOverlay(env, {
    organizationId,
    actorUserId: context.user.id,
    imageUrl,
    filename: image.original_filename as string,
    fichaMarkdown: (image.markdown as string | null) ?? null,
    productContext,
    runId, storeId, compositionContext:{...compositionContext,input_hash:inputHash}, neighborImages,
    ...(options.beforeModel ? { beforeModel: options.beforeModel } : {}),
    objective:
      `${payload.usage === "email_klaviyo" ? "Imagen para un mailing" : overlay.channel === "meta_ads" ? "Anuncio de Meta Ads" : "Contenido orgánico de Instagram"}. ${(typeof payload.objective === "string" ? payload.objective.trim() : "").slice(0, 500) ||
      (overlay.creative_brief as string | null) ||
      ""}`,
    format: normalizeFormat(overlay.format),
    ratio,
    slideIndex,
    slideCount: slides.length || 1,
  });
  if (!result.ok) {
    return {
      ok: false as const,
      statusCode: result.statusCode,
      error: result.error,
      detail: result.detail,
    };
  }
  draft = result.draft;
  }
  const blocks = overlayEditorBlocks(draft);
  const current = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!current.ok) return current;
  if (current.slides[slideIndex]?.image_id !== image.id || current.overlay.ratio !== overlay.ratio || current.overlay.creative_brief !== authorized.overlay.creative_brief) return { ok: false as const, statusCode: 409, error: "overlay_changed_during_generation" };
  if (!cached && overlayFingerprint(current.slides[slideIndex]?.blocks) !== overlayFingerprint(authorized.slides[slideIndex]?.blocks)) return { ok: false as const, statusCode: 409, error: "overlay_changed_during_generation" };
  const nextSlides = current.slides.map((item,index) => index === slideIndex ? { ...item, blocks, generation_run_id:runId } : item);
  const saved = await supabase.from("instagram_image_overlays").update({ slides: nextSlides }).eq("id", overlayId).eq("organization_id", organizationId).eq("updated_at", current.overlay.updated_at).select("id").maybeSingle();
  if (saved.error || !saved.data) return { ok: false as const, statusCode: 409, error: "overlay_changed_during_generation" };
  return {
    ok: true as const,
    data: {
      draft, editor_blocks: blocks,
      run_id: runId, recovered: Boolean(cached),
    },
  };
}

// Caption del post a partir de la publicación: pasa el formato + las fichas de
// todas las imágenes en orden al generador a11 (canal instagram_organic). El
// borrador cae en el flujo normal de revisión de /marketing.
export async function generatePublicationCaption(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  overlayId: string,
  payload: Record<string, unknown>,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;
  const authorized = await authorizedOverlay(env, context, organizationId, overlayId);
  if (!authorized.ok) return authorized;
  // Finish optional A16 stages before assembling A11's brief. A retry then
  // sees exactly the same saved text and produces the same A11 fingerprint.
  if (payload.compose_overlay === true) {
    const prepared = await prepareOverlayForMarketing(env, context, organizationId, overlayId, true, payload.channel === "email_klaviyo" ? "email_klaviyo" : undefined);
    if (!prepared.ok) return prepared;
  }

  const supabase = createServiceClient(env);
  const { data: overlay } = await supabase
    .from("instagram_image_overlays")
    .select("id, name, format, slides, creative_brief, channel")
    .eq("id", overlayId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!overlay) {
    return { ok: false as const, statusCode: 404, error: "pieza_no_encontrada" };
  }

  const slides = readSlides(overlay).filter(
    (slide): slide is { image_id: string; blocks: unknown[] } =>
      typeof slide.image_id === "string",
  );
  if (slides.length === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "pieza_sin_imagenes",
      message: "Añade al menos una imagen a la pieza.",
    };
  }

  const { data: rows } = await supabase
    .from("instagram_image_bank")
    .select("id, original_filename, markdown")
    .eq("organization_id", organizationId)
    .in(
      "id",
      slides.map((slide) => slide.image_id),
    );
  const byId = new Map(
    (rows ?? []).map((row) => [
      row.id as string,
      {
        filename: row.original_filename as string,
        markdown: (row.markdown as string | null) ?? null,
      },
    ]),
  );

  const format = normalizeFormat(overlay.format);
  const formatLabel =
    format === "carousel"
      ? `carrusel de ${slides.length} imágenes`
      : format === "story"
        ? `historia / secuencia de ${slides.length} historias`
        : "una sola imagen";

  const objective =
    typeof payload.objective === "string"
      ? payload.objective.trim().slice(0, 800)
      : "";
  const sharedBrief = objective || (overlay.creative_brief as string | null) || "";

  const fichas = slides
    .map((slide, index) => {
      const meta = byId.get(slide.image_id);
      const ficha = (meta?.markdown ?? "sin ficha (imagen aún sin analizar)")
        .trim()
        .slice(0, 1800);
      const overlayText = overlayTextOf(slide.blocks);
      return `--- Imagen ${index + 1}${
        meta?.filename ? ` (${meta.filename})` : ""
      } ---\n${ficha}${
        overlayText
          ? `\n\nTEXTO YA SOBREIMPRESO EN ESTA IMAGEN (el usuario lo ha colocado; no lo repitas literal en el caption, compleméntalo): ${overlayText}`
          : "\n\n(Sin texto sobreimpreso en esta imagen.)"
      }`;
    })
    .join("\n\n");

  const brief = [
    `${overlay.channel === "meta_ads" ? "FORMATO DE ANUNCIO META ADS" : "FORMATO DE PUBLICACIÓN ORGÁNICA DE INSTAGRAM"}: ${formatLabel}.`,
    sharedBrief ? `Brief editorial compartido con A16: ${sharedBrief}` : "Brief editorial: no especificado.",
    `Pieza: ${overlay.name}`,
    "FICHAS DE LAS IMÁGENES (en orden de publicación), cada una con su análisis y el texto que ya lleva encima:",
    fichas,
    "Redacta el caption, hashtags y CTA coherentes con este formato, con lo que se ve en cada imagen y con el texto que ya llevan sobreimpreso. No repitas ese texto tal cual y no inventes datos que no estén en las fichas o el objetivo.",
  ].join("\n\n");

  return runMarketingContentDraft(env, context, organizationId, {
    content_type: "campaign",
    channel: payload.channel === "email_klaviyo" ? "email_klaviyo" : overlay.channel === "meta_ads" ? "meta_ads" : "instagram_organic",
    overlay_id: overlayId,
    compose_overlay: false,
    ...(typeof payload.idempotency_key === "string" ? { idempotency_key: payload.idempotency_key } : {}),
    brief,
  });
}
