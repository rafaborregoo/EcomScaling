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
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  chunkText,
  instagramImageAnalysisToMarkdown,
  createRagEmbeddingProvider,
} from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  requireOperationalOrganization,
  isOperationalOrganizationError,
  createUserScopedClient,
  type AuthContext,
} from "./auth-context.js";
import { embedChunksInOrder } from "./embedding-batching.js";
import {
  attachVisualAssetSources,
  buildVisualAnalysisFingerprint,
  isOwnedVisualStoragePath,
} from "./visual-asset-sources.js";
import { downloadMetaStaticImage, META_IMAGE_MAX_BYTES } from "./meta-static-image.js";
import { resolveMetaVisualRepresentation } from "./meta-visual-asset.js";
import {
  analyzeInstagramImage,
  canAccessMarketingWorkspace,
  checkOrganizationDailyBudget,
  checkOrganizationProviderCircuit,
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
        "Necesitas ser propietario o manager de la organización, consultor o administrador de plataforma.",
    };
  }
  return { ok: true as const };
}

const IMAGE_COLUMNS =
  "id, public_url, storage_bucket, storage_path, original_filename, content_type, byte_size, status, analysis, analysis_fingerprint, markdown, knowledge_document_id, error_reason, attempts, analyzed_at, created_at, updated_at";

async function resolveBankImageUrls(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  rows: Array<Record<string, unknown>>,
) {
  const urls = new Map<string, string>();
  const privateRows: Array<{ id: string; path: string; cacheKey: string }> = [];
  const now = Date.now();
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : "";
    const bucket = typeof row.storage_bucket === "string" ? row.storage_bucket : BUCKET;
    if (!id) continue;
    if (bucket === BUCKET) {
      if (typeof row.public_url === "string") urls.set(id, row.public_url);
      continue;
    }
    if (bucket !== PRIVATE_SOURCE_BUCKET || typeof row.storage_path !== "string") {
      return { ok: false as const, error: "visual_asset_storage_bucket_invalid" };
    }
    const path = row.storage_path;
    if (!isOwnedVisualStoragePath(organizationId, path)) {
      return { ok: false as const, error: "visual_asset_storage_scope_invalid" };
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
      return { ok: false as const, error: error?.message ?? "visual_asset_signed_url_failed" };
    }
    const signedByPath = new Map<string, string>();
    for (const result of data) {
      if (result.error || !result.path || !result.signedUrl) {
        return { ok: false as const, error: "visual_asset_signed_url_failed" };
      }
      signedByPath.set(result.path, result.signedUrl);
    }
    const expiresAt = now + SIGNED_IMAGE_URL_CACHE_MS;
    for (const row of privateRows) {
      const url = signedByPath.get(row.path);
      if (!url) return { ok: false as const, error: "visual_asset_signed_url_missing" };
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
  return { ok: true as const, urls };
}

async function getActiveA15Fingerprint(supabase: ReturnType<typeof createServiceClient>) {
  const { data, error } = await supabase
    .from("agent_versions")
    .select("version, model, prompt_code, prompt_version, agent_definitions!inner(code)")
    .eq("agent_definitions.code", "a15_analista_imagenes")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: error?.message ?? "a15_version_not_found" };
  return {
    ok: true as const,
    fingerprint: buildVisualAnalysisFingerprint({
      agentVersion: data.version as string,
      model: data.model as string,
      promptCode: data.prompt_code as string,
      promptVersion: data.prompt_version as string,
    }),
  };
}

async function queueImageIfAnalysisIsStale(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  image: Record<string, unknown>,
) {
  if (image.status !== "analyzed" && image.status !== "failed") {
    return { ok: true as const, image };
  }
  const active = await getActiveA15Fingerprint(supabase);
  if (!active.ok) return active;
  if (image.analysis_fingerprint === active.fingerprint) {
    return { ok: true as const, image };
  }

  const previousDocumentId = image.knowledge_document_id;
  if (typeof previousDocumentId === "string") {
    const { error: deleteDocumentError } = await supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", previousDocumentId)
      .eq("organization_id", organizationId);
    if (deleteDocumentError) {
      return { ok: false as const, error: deleteDocumentError.message };
    }
  }

  const { data: queued, error } = await supabase
    .from("instagram_image_bank")
    .update({
      status: "queued",
      analysis: null,
      analysis_fingerprint: null,
      markdown: null,
      knowledge_document_id: null,
      analyzed_at: null,
      error_reason: null,
      attempts: 0,
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

async function ensureInstagramImageSource(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  imageId: string,
) {
  const { error } = await supabase.from("marketing_visual_asset_sources").upsert(
    {
      organization_id: organizationId,
      image_id: imageId,
      channel: "instagram",
      source_kind: "manual_upload",
      origin_key: imageId,
    },
    { onConflict: "organization_id,channel,origin_key" },
  );
  return error;
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
  },
) {
  const { error } = await supabase.from("marketing_visual_asset_sources").upsert(
    {
      organization_id: params.organizationId,
      image_id: params.imageId,
      channel: "meta",
      source_kind: "meta_creative_asset",
      origin_key: params.assetId,
      meta_asset_id: params.assetId,
      origin_host: params.originHost,
      source_metadata: {
        asset_hash: params.assetHash,
        asset_label: params.assetLabel?.slice(0, 180) ?? null,
        external_asset_id: params.externalAssetId?.slice(0, 255) ?? null,
        asset_type: params.assetType,
        imported_representation: params.assetType === "video" ? "static_thumbnail_only" : "static_image",
      },
    },
    { onConflict: "organization_id,channel,origin_key", ignoreDuplicates: true },
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
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: assets, error } = await supabase
    .from("meta_creative_assets")
    .select("id, creative_id, asset_type, position, asset_label, asset_hash, external_asset_id, media_url, thumbnail_url, created_at")
    .eq("organization_id", organizationId)
    .in("asset_type", ["image", "video"])
    .or("media_url.not.is.null,thumbnail_url.not.is.null")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return { ok: false as const, statusCode: 500, error: "meta_visual_assets_load_failed", detail: error.message };
  }
  const rows = (assets ?? []).filter((asset) => resolveMetaVisualRepresentation({
    assetType: asset.asset_type,
    mediaUrl: asset.media_url,
    thumbnailUrl: asset.thumbnail_url,
  }) !== null);
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
        })?.kind ?? "static_image",
        label: asset.asset_label,
        asset_hash: asset.asset_hash,
        created_at: asset.created_at,
        available: Boolean(resolveMetaVisualRepresentation({
          assetType: asset.asset_type,
          mediaUrl: asset.media_url,
          thumbnailUrl: asset.thumbnail_url,
        })),
      })),
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
    .select("id, creative_id, asset_type, asset_hash, asset_label, external_asset_id, media_url, thumbnail_url")
    .eq("id", assetId)
    .eq("organization_id", organizationId)
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
  });
  if (sourceError) {
    await supabase.from("instagram_image_bank").delete().eq("id", image.id);
      await supabase.storage.from(PRIVATE_SOURCE_BUCKET).remove([storagePath]);
    return { ok: false as const, statusCode: 500, error: "visual_asset_source_save_failed", detail: sourceError.message };
  }
  return { ok: true as const, data: { image } };
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

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
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

  const path = `${organizationId}/instagram-bank/${crypto.randomUUID()}.${MARKETING_ASSET_EXT[mime]}`;
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (upload.error) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "asset_upload_failed",
      detail: upload.error.message,
    };
  }
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  const { data: inserted, error: insertError } = await supabase
    .from("instagram_image_bank")
    .insert({
      organization_id: organizationId,
      storage_path: path,
      public_url: publicUrlData.publicUrl,
      storage_bucket: BUCKET,
      original_filename: filename,
      content_type: mime,
      byte_size: buffer.length,
      checksum,
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
      await supabase.storage.from(BUCKET).remove([path]);
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
  );
  if (sourceError) {
    await supabase.from("instagram_image_bank").delete().eq("id", inserted.id);
    await supabase.storage.from(BUCKET).remove([path]);
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
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const { data, error } = await supabase
    .from("instagram_image_bank")
    .select(IMAGE_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_image_bank_list_failed",
      detail: error.message,
    };
  }
  const images = data ?? [];
  const ids = images.map((image) => image.id as string);
  const { data: sources, error: sourceError } = ids.length
    ? await supabase
        .from("marketing_visual_asset_sources")
        .select("image_id, channel, source_kind")
        .eq("organization_id", organizationId)
        .in("image_id", ids)
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
  if (!signedUrls.ok) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "visual_asset_preview_url_failed",
      detail: signedUrls.error,
    };
  }
  const imagesWithPreview = images.map((image) => {
    const { storage_bucket: _storageBucket, storage_path: _storagePath, ...safeImage } = image;
    return {
      ...safeImage,
      public_url: signedUrls.urls.get(image.id as string) ?? image.public_url,
    };
  });
  return {
    ok: true as const,
    data: { images: attachVisualAssetSources(imagesWithPreview, sources ?? []) },
  };
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
    .select("id, organization_id, original_filename, created_by, knowledge_document_id")
    .eq("id", imageId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (loadError || !row) {
    return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  }

  const knowledgeDocumentId = await reindexImageMarkdown(env, supabase, {
    organizationId,
    createdBy: row.created_by as string,
    filename: row.original_filename as string,
    previousDocumentId: row.knowledge_document_id as string | null,
    markdown,
  });

  const { data: updated, error: updateError } = await supabase
    .from("instagram_image_bank")
    .update({
      markdown,
      knowledge_document_id: knowledgeDocumentId,
    })
    .eq("id", imageId)
    .eq("organization_id", organizationId)
    .select(IMAGE_COLUMNS)
    .single();
  if (updateError || !updated) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "instagram_image_update_failed",
      detail: updateError?.message,
    };
  }
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
    .update({ status: "queued", error_reason: null, attempts: 0 })
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
    .select("id, storage_bucket, storage_path, knowledge_document_id")
    .eq("id", imageId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!row) {
    return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  }

  if (row.storage_path) {
    const bucket = row.storage_bucket === PRIVATE_SOURCE_BUCKET ? PRIVATE_SOURCE_BUCKET : BUCKET;
    await supabase.storage.from(bucket).remove([row.storage_path as string]);
  }
  if (row.knowledge_document_id) {
    // cascade borra los chunks
    await supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", row.knowledge_document_id as string);
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

  const { data: candidates, error: pickError } = await supabase
    .from("instagram_image_bank")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(QUEUE_BATCH);
  if (pickError) {
    return { status: "error" as const, detail: pickError.message, processed: 0 };
  }
  if (!candidates || candidates.length === 0) {
    return { status: "idle" as const, processed: 0 };
  }

  const ids = candidates.map((row) => row.id as string);
  const { data: claimed } = await supabase
    .from("instagram_image_bank")
    .update({ status: "analyzing" })
    .in("id", ids)
    .eq("status", "queued")
    .select(
        "id, organization_id, public_url, storage_bucket, storage_path, original_filename, content_type, created_by, attempts, knowledge_document_id",
    );

  const claimedRows = claimed ?? [];
  const claimedIds = claimedRows.map((row) => row.id as string);
  const claimedOrganizations = [...new Set(claimedRows.map((row) => row.organization_id as string))];
  const { data: visualSources } = claimedIds.length
    ? await supabase
        .from("marketing_visual_asset_sources")
        .select("organization_id, image_id, channel")
        .in("organization_id", claimedOrganizations)
        .in("image_id", claimedIds)
    : { data: [] };

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Una a una: cada imagen es una llamada de visión independiente.
  for (const row of claimedRows) {
    const organizationId = row.organization_id as string;
    const sourceChannels = [...new Set(
      (visualSources ?? [])
        .filter((source) => source.organization_id === organizationId && source.image_id === row.id)
        .map((source) => source.channel as string),
    )];

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
          error_reason:
            budget.ok === false ? budget.message : circuit.ok === false ? circuit.message : null,
        })
        .eq("id", row.id as string);
      skipped += 1;
      continue;
    }

    const imageUrls = await resolveBankImageUrls(supabase, organizationId, [row as Record<string, unknown>]);
    const imageUrl = imageUrls.ok ? imageUrls.urls.get(row.id as string) : null;
    if (!imageUrls.ok || !imageUrl) {
      await supabase
        .from("instagram_image_bank")
        .update({ status: "failed", error_reason: imageUrls.ok ? "visual_asset_signed_url_missing" : imageUrls.error })
        .eq("id", row.id as string)
        .eq("organization_id", organizationId);
      failed += 1;
      continue;
    }

    const result = await analyzeInstagramImage(env, {
      organizationId,
      actorUserId: row.created_by as string,
      imageUrl,
      filename: row.original_filename as string,
      contentType: row.content_type as string,
      sourceChannels,
      sourceAssetId: row.id as string,
    });

    const nextAttempts = (row.attempts as number) + 1;

    if (!result.ok) {
      const giveUp = nextAttempts >= MAX_ATTEMPTS || !result.retriable;
      await supabase
        .from("instagram_image_bank")
        .update({
          status: giveUp ? "failed" : "queued",
          attempts: nextAttempts,
          error_reason: result.detail.slice(0, 500),
        })
        .eq("id", row.id as string);
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
      });
    } catch {
      // El RAG es best-effort: la ficha ya vive en el banco aunque no se indexe.
      knowledgeDocumentId = null;
    }

    await supabase
      .from("instagram_image_bank")
      .update({
        status: "analyzed",
        analysis: result.analysis,
        analysis_fingerprint: result.analysisFingerprint,
        markdown,
        knowledge_document_id: knowledgeDocumentId,
        agent_run_id: result.runId,
        analyzed_at: new Date().toISOString(),
        attempts: nextAttempts,
        error_reason: null,
      })
      .eq("id", row.id as string);
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
  },
): Promise<string | null> {
  if (input.previousDocumentId) {
    await supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", input.previousDocumentId);
  }

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
      origin: "human_approved_ai",
      authority: "contextual",
      ingested_by: "system",
      status: "active",
      checksum,
      embedding_model: provider.model,
      created_by: input.createdBy,
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

  return document.id as string;
}

// ==========================================================================
// Piezas estáticas: texto sobre una imagen del banco
// ==========================================================================

const OVERLAY_COLUMNS =
  "id, image_id, name, format, ratio, slides, creative_brief, created_at, updated_at";

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
  authorization: string,
  context: AuthContext,
  organizationId: string,
  imageId?: string,
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  let query = supabase
    .from("instagram_image_overlays")
    .select(OVERLAY_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (imageId) query = query.eq("image_id", imageId);
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
): Promise<boolean> {
  if (imageIds.length === 0) return true;
  const { data } = await supabase
    .from("instagram_image_bank")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", imageIds);
  const found = new Set((data ?? []).map((row) => row.id as string));
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
  if (!(await assertImagesInOrg(supabase, organizationId, imageIds))) {
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
    const slides: Array<{ image_id: string | null; blocks: unknown[] }> = [];
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
      slides.push({ image_id: (imageId as string) ?? null, blocks });
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
    if (!(await assertImagesInOrg(supabaseCheck, organizationId, ids))) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "imagen_no_encontrada",
      };
    }
    patch.slides = slides;
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
) {
  const access = requireBankAccess(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: overlay } = await supabase
    .from("instagram_image_overlays")
    .select("id, format, ratio, slides, creative_brief")
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
    .select("id, public_url, storage_bucket, storage_path, original_filename, markdown")
    .eq("id", slide.image_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!image) {
    return { ok: false as const, statusCode: 404, error: "imagen_no_encontrada" };
  }

  const resolvedImageUrl = await resolveBankImageUrls(supabase, organizationId, [image as Record<string, unknown>]);
  const imageUrl = resolvedImageUrl.ok ? resolvedImageUrl.urls.get(image.id as string) : null;
  if (!resolvedImageUrl.ok || !imageUrl) {
    return { ok: false as const, statusCode: 502, error: "visual_asset_preview_url_failed", detail: resolvedImageUrl.ok ? "missing_signed_url" : resolvedImageUrl.error };
  }

  const result = await draftInstagramOverlay(env, {
    organizationId,
    actorUserId: context.user.id,
    imageUrl,
    filename: image.original_filename as string,
    fichaMarkdown: (image.markdown as string | null) ?? null,
    objective:
      (typeof payload.objective === "string" ? payload.objective.trim() : "").slice(0, 500) ||
      (overlay.creative_brief as string | null) ||
      "",
    format: normalizeFormat(overlay.format),
    ratio:
      overlay.ratio === "1:1" || overlay.ratio === "9:16" ? overlay.ratio : "4:5",
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
  return {
    ok: true as const,
    data: {
      draft: result.draft,
      run_id: result.runId,
      ...(result.judgment ? { judgment: result.judgment } : {}),
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

  const supabase = createServiceClient(env);
  const { data: overlay } = await supabase
    .from("instagram_image_overlays")
    .select("id, name, format, slides, creative_brief")
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
    `FORMATO DE PUBLICACIÓN: ${formatLabel}.`,
    sharedBrief ? `Brief editorial compartido con A16: ${sharedBrief}` : "Brief editorial: no especificado.",
    `Pieza: ${overlay.name}`,
    "FICHAS DE LAS IMÁGENES (en orden de publicación), cada una con su análisis y el texto que ya lleva encima:",
    fichas,
    "Redacta el caption, hashtags y CTA coherentes con este formato, con lo que se ve en cada imagen y con el texto que ya llevan sobreimpreso. No repitas ese texto tal cual y no inventes datos que no estén en las fichas o el objetivo.",
  ].join("\n\n");

  return runMarketingContentDraft(env, context, organizationId, {
    content_type: "campaign",
    channel: "instagram_organic",
    brief,
  });
}
