/**
 * Chat con la IA dentro del Estudio de contenido (email): una conversacion en
 * la que la IA contesta y, cuando se lo piden, cambia el diseno que ves.
 *
 * El endpoint no guarda nada: recibe el diseno actual y la charla, y devuelve
 * una respuesta mas una lista de operaciones (cambiar propiedades de un bloque,
 * anadir, borrar, mover, asunto/preheader). Quien aplica es la pantalla, sobre
 * su propio borrador y con su propio deshacer; el autoguardado hace el resto.
 * Editar el borrador no escribe en el dominio, asi que no hay aprobacion.
 *
 * La IA no inventa datos: las imagenes solo pueden ser las del banco, las de
 * los productos o las que ya estan en el email, y los productos entran por id
 * con su precio real.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { OutputContract } from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { requireOperationalOrganization, type AuthContext } from "./auth-context.js";
import { runCampaignEditorAgent } from "./ai-runtime.js";
import { canUpgradePlan, loadCopilotBalance } from "./copilot-saldo.js";
import { resolveCopilotModel } from "./copilot-tokens.js";
import { resolveMarketingBrandProfile } from "./marketing-brand-profile.js";
import { listStudioProducts, studioAccess } from "./marketing-studio.js";
import { resolveVisualBankPreviewUrls } from "./instagram-image-bank.js";

const logger = createLogger("studio-ai-chat");

export const STUDIO_CHAT_PER_DAY = 60;
const MAX_OPS = 12;
const OBJECTIVE_PREFIX = "Estudio de contenido:";
const BRAND_PROFILE_CACHE_TTL_MS = 5_000;
const brandProfileCache = new Map<string, { expiresAt: number; value: Record<string, unknown> | null }>();

function cachedBrandProfile(key: string) {
  const entry = brandProfileCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    brandProfileCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheBrandProfile(key: string, value: Record<string, unknown> | null) {
  if (brandProfileCache.size >= 256) brandProfileCache.delete(brandProfileCache.keys().next().value!);
  brandProfileCache.set(key, { value, expiresAt: Date.now() + BRAND_PROFILE_CACHE_TTL_MS });
}

const BLOCK_TYPES = [
  "header", "hero", "heading", "text", "button", "image", "products", "coupon",
  "countdown", "review", "columns", "video", "divider", "spacer", "social", "footer", "html",
] as const;

// ---------------------------------------------------------------------------
// Entrada y salida
// ---------------------------------------------------------------------------

export const studioChatInputSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
      .max(14)
      .default([]),
    subject: z.string().max(255).default(""),
    preheader: z.string().max(255).default(""),
    blocks: z.array(z.object({ id: z.string().max(80), type: z.string().max(40), props: z.record(z.string(), z.unknown()) })).max(60),
    brand: z.record(z.string(), z.unknown()).default({}),
    selected_id: z.string().max(80).nullable().optional(),
    connection_id: z.string().max(80).nullable().optional(),
    draft_id: z.string().uuid().nullable().optional(),
    draft_version: z.number().int().positive().nullable().optional(),
    document_revision: z.number().int().nonnegative().optional(),
    request_id: z.string().uuid(),
    /** "sonnet" | "opus"; lo que el plan no incluya se atiende con el modelo por defecto. */
    model: z.string().max(20).optional(),
  })
  .strict();

const rawOpSchema = z.object({
  op: z.enum(["set", "add", "remove", "move", "header"]),
  block_id: z.string().max(80),
  type: z.string().max(40),
  after_id: z.string().max(80),
  field: z.string().max(20),
  value: z.string().max(500),
  props_json: z.string().max(20_000),
});

const outputSchema = z.object({
  answer: z.string().min(1).max(2000),
  ops: z.array(rawOpSchema).max(MAX_OPS),
});

const outputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "ops"],
  properties: {
    answer: { type: "string", description: "Tu respuesta en la conversacion: natural, breve, en segunda persona." },
    ops: {
      type: "array",
      maxItems: MAX_OPS,
      description: "Cambios a aplicar YA en el email. Vacio si solo conversas, preguntas o aconsejas.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "block_id", "type", "after_id", "field", "value", "props_json"],
        properties: {
          op: { type: "string", enum: ["set", "add", "remove", "move", "header"] },
          block_id: { type: "string", description: "Id del bloque (set, remove, move). Vacio en el resto." },
          type: { type: "string", description: "Tipo del bloque nuevo (add). Vacio en el resto." },
          after_id: { type: "string", description: "add/move: id del bloque tras el que queda; «inicio» = el primero; vacio = el ultimo." },
          field: { type: "string", description: "header: «subject» o «preheader». Vacio en el resto." },
          value: { type: "string", description: "header: el texto nuevo. Vacio en el resto." },
          props_json: { type: "string", description: "set/add: objeto JSON como texto SOLO con las propiedades que cambian. «{}» en el resto." },
        },
      },
    },
  },
} as const;

export function studioChatContract(): OutputContract<unknown> {
  return {
    jsonSchema: outputJsonSchema as unknown as Record<string, unknown>,
    schema: outputSchema as unknown as OutputContract<unknown>["schema"],
  };
}

export type StudioProductRef = { id: string; title: string; price: string; image: string; url: string };

export function selectedStudioProductIds(blocks: Array<{ type: string; props: Record<string, unknown> }>): string[] {
  return [...new Set(blocks.flatMap((block) => {
    if (block.type !== "products") return [];
    const items = Array.isArray(block.props.items) ? block.props.items : [];
    const ids = Array.isArray(block.props.product_ids) ? block.props.product_ids : [];
    return [...items.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).id : null), ...ids]
      .filter((id): id is string => typeof id === "string" && z.string().uuid().safeParse(id).success);
  }))].slice(0, 24);
}

export type StudioOp =
  | { op: "set"; block_id: string; props: Record<string, unknown> }
  | { op: "add"; type: string; props: Record<string, unknown>; after_id: string | null }
  | { op: "remove"; block_id: string }
  | { op: "move"; block_id: string; after_id: string | null }
  | { op: "header"; field: "subject" | "preheader"; value: string };

// ---------------------------------------------------------------------------
// Reglas puras
// ---------------------------------------------------------------------------

const IMAGE_KEYS = new Set(["img", "src", "logo"]);
const LINK_KEYS = new Set(["url"]);
const BLOCK_PROP_KEYS: Record<string, Set<string>> = {
  header: new Set(["logo", "tagline", "align", "bg"]), hero: new Set(["img", "alt", "title", "text", "cta", "url", "height", "overlay", "utm"]),
  heading: new Set(["text", "level", "size", "weight", "align", "color", "spacing"]), text: new Set(["text", "size", "lh", "align", "color"]),
  button: new Set(["label", "url", "style", "bg", "radius", "full", "align"]), image: new Set(["src", "alt", "url"]),
  products: new Set(["cols", "price", "cta", "product_ids", "items", "source"]), coupon: new Set(["text", "code", "until"]),
  countdown: new Set(["label", "until"]), review: new Set(["quote", "author", "stars"]), columns: new Set(["items"]),
  video: new Set(["url", "caption"]), divider: new Set(["width", "color"]), spacer: new Set(["h"]), social: new Set(["links"]),
  footer: new Set(["address"]), html: new Set(["html"]),
};

/** Un enlace vale si es http(s), una etiqueta de Klaviyo o esta vacio. */
function safeLink(value: unknown): boolean {
  return typeof value === "string" && (value === "" || /^https?:\/\//i.test(value) || value.startsWith("{{") || value.startsWith("{%"));
}

/**
 * Deja pasar solo lo que la IA puede decidir sola. Imagenes: unicamente las
 * que conocemos. Productos: por id y con el precio de la tienda, nunca el que
 * diga el modelo. Enlaces: http(s) o etiquetas de Klaviyo.
 */
export function cleanOpProps(
  raw: unknown,
  known: { images: Set<string>; products: Map<string, StudioProductRef> },
  blockType?: string,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (blockType && !BLOCK_PROP_KEYS[blockType]?.has(key)) continue;
    if (key === "items" && blockType === "products") {
      if (!Array.isArray(value) || value.length > 6 || value.some((item) => !item || typeof item !== "object" || !("id" in item))) continue;
      const items = (value as Array<{ id: unknown }>).map((item) => known.products.get(String(item.id)));
      if (items.length && items.every((item): item is StudioProductRef => Boolean(item))) props.items = items;
      continue;
    }
    if (key === "product_ids" && Array.isArray(value)) {
      const items = value.map((id) => known.products.get(String(id))).filter((product): product is StudioProductRef => Boolean(product));
      if (items.length) {
        props.items = items;
        props.source = "manual";
      }
      continue;
    }
    if (IMAGE_KEYS.has(key) && typeof value === "string" && value !== "" && !known.images.has(value)) continue;
    if (LINK_KEYS.has(key) && !safeLink(value)) continue;
    if (key === "html") continue;
    if (key === "columns" || key === "links") {
      if (!Array.isArray(value) || value.length > 6) continue;
      const valid = value.every((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const row = item as Record<string, unknown>;
        return Object.entries(row).every(([field, part]) =>
          (field === "url" ? safeLink(part) : ["t", "d", "name", "label"].includes(field) && typeof part === "string" && part.length <= 1000),
        );
      });
      if (!valid) continue;
      props[key] = value;
      continue;
    }
    if (key === "product_ids") continue;
    if (typeof value === "string" && value.length > 12000) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (value !== null && typeof value === "object") continue;
    props[key] = value;
  }
  return props;
}

export function normalizeStudioOps(
  output: z.infer<typeof outputSchema>,
  design: { blocks: Array<{ id: string; type: string }> },
  known: { images: Set<string>; products: Map<string, StudioProductRef> },
): StudioOp[] {
  const ids = new Set(design.blocks.map((block) => block.id));
  const types = new Set<string>(BLOCK_TYPES);
  const ops: StudioOp[] = [];
  const parse = (text: string, type?: string) => {
    try {
      return cleanOpProps(JSON.parse(text || "{}"), known, type);
    } catch {
      return null;
    }
  };
  const after = (value: string) => (value === "" ? null : value === "inicio" ? "inicio" : value);
  for (const raw of output.ops) {
    if (raw.op === "header") {
      if ((raw.field === "subject" || raw.field === "preheader") && raw.value.trim()) {
        ops.push({ op: "header", field: raw.field, value: raw.value.trim() });
      }
    } else if (raw.op === "add") {
      const props = parse(raw.props_json, raw.type);
      if (types.has(raw.type) && props && (raw.after_id === "" || raw.after_id === "inicio" || ids.has(raw.after_id))) {
        ops.push({ op: "add", type: raw.type, props, after_id: after(raw.after_id) });
      }
    } else if (!ids.has(raw.block_id)) {
      continue;
    } else if (raw.op === "set") {
      const block = design.blocks.find((item) => item.id === raw.block_id);
      const props = parse(raw.props_json, block?.type);
      if (props && Object.keys(props).length) ops.push({ op: "set", block_id: raw.block_id, props });
    } else if (raw.op === "remove") {
      ops.push({ op: "remove", block_id: raw.block_id });
      ids.delete(raw.block_id);
    } else if (raw.op === "move" && raw.block_id !== raw.after_id && (raw.after_id === "" || raw.after_id === "inicio" || ids.has(raw.after_id))) {
      ops.push({ op: "move", block_id: raw.block_id, after_id: after(raw.after_id) });
    }
  }
  return ops.slice(0, MAX_OPS);
}

export const STUDIO_CHAT_GUIDANCE = `

CHAT DE EDICION DEL ESTUDIO — ESTA INSTRUCCION PREVALECE sobre las anteriores del prompt. Eres el copiloto del Estudio de contenido: conversas con la persona mientras ve su email y, cuando te lo pide, lo CAMBIAS tu directamente. No planificas calendario ni haces estrategia general. Lees «Email actual», «Marca», «Banco de imágenes», «Productos», «Conversación» y «Mensaje», y respondes con answer + ops.
Cómo conversar: (1) habla como una persona, breve y en segunda persona; si la petición es ambigua o te falta un dato que no puedes inventar (cupón, plazo, precio), pregunta en answer y deja ops vacío; (2) si solo preguntan o piden opinión (tono, asunto, qué mejorarías), contesta y propone, pero NO cambies nada hasta que lo pidan; (3) si piden un cambio, hazlo con ops y dilo en answer en una o dos frases («He acortado el título a… y el botón ahora es verde»), sin repetir toda la mecánica; (4) el «Bloque seleccionado» es el que la persona tiene delante: «este», «el título», «aquí» se refieren a él salvo que digan otra cosa.
Operaciones (ops): set = cambia propiedades de un bloque (props_json solo con las que cambian); add = añade un bloque (type + props_json con sus propiedades, y after_id); remove = borra; move = mueve tras after_id; header = cambia subject o preheader. Usa los id de «Email actual». Una operación por cambio, máximo ${MAX_OPS}.
Reglas duras: (a) no inventes precios, descuentos, códigos, plazos ni reseñas: si no están en el contexto o en la conversación, pregunta; un cupón o una fecha solo con datos que te den; (b) imágenes: SOLO una url de «Banco de imágenes», de «Productos» o ya presente en el email; nunca inventes ni modifiques una url; elige por lo que dice la descripción de cada imagen; (c) productos: en un bloque products pon product_ids con ids de «Productos»; el precio lo pone el sistema; (d) respeta la marca (tono, vocabulario preferido y evitado, afirmaciones restringidas); (e) un asunto cabe en unos 50 caracteres salvo que pidan otra cosa; (f) colores: un rol (primary, accent, text, bg, card, white) o un hex; (g) no uses el bloque html salvo que lo pidan expresamente; (h) cambia solo lo pedido y deja el resto igual.
Propiedades por bloque: header{logo,tagline,align,bg}; hero{img,alt,title,text,cta,url,height,overlay}; heading{text,level(h1|h2|h3),size,weight(400|600|700|800),align,color,spacing}; text{text,size,lh,align,color}; button{label,url,style(solid|outline|link),bg,radius,full,align}; image{src,alt,url}; products{cols("2"|"3"),price,cta,product_ids}; coupon{text,code,until(AAAA-MM-DD)}; countdown{label,until(AAAA-MM-DDTHH:MM)}; review{quote,author,stars}; columns{items:[{t,d}]}; video{url,caption}; divider{width,color}; spacer{h}; social{links:[{name,url}]}; footer{address}. align = left|center|right. El texto puede llevar etiquetas de Klaviyo como {{ first_name|default:"" }}.`;

// ---------------------------------------------------------------------------
// Contexto: banco de imagenes, productos, marca
// ---------------------------------------------------------------------------

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function describeImage(row: { original_filename: string | null; analysis: unknown; markdown: string | null }): string {
  const analysis = row.analysis && typeof row.analysis === "object" ? JSON.stringify(row.analysis) : "";
  const text = (row.markdown || analysis || row.original_filename || "").replace(/\s+/g, " ").trim();
  return text.slice(0, 280);
}

type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string; can_upgrade?: boolean };

function productNeedle(message: string) {
  const match = message.match(/(?:producto|productos|art[ií]culo|art[ií]culos|buscar|busca|muestra|incluye)\s+(?:que\s+)?(.{2,80})/iu);
  const value = match?.[1]?.replace(/[¿?!.]/g, " ").replace(/\s+/g, " ").trim();
  return value ? value.split(" ").slice(0, 5).join(" ") : null;
}

export async function chatStudioEdit(
  env: LoadedApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  payload: unknown,
): Promise<{ ok: true; data: { answer: string; ops: StudioOp[]; request_id: string | null; draft_id: string | null; draft_version: number | null; document_revision: number | null; remaining_today: number } } | Failure> {
  const denied = studioAccess(context, organizationId);
  if (denied) return denied;
  const parsed = studioChatInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, statusCode: 400, error: "invalid_studio_chat", detail: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  }
  const input = parsed.data;
  if (JSON.stringify(input.blocks).length > 120_000) {
    return { ok: false, statusCode: 413, error: "studio_design_too_large", message: "El email es demasiado grande para la IA." };
  }
  const supabase = serviceClient(env);
  if (input.draft_id) {
    const { data: source, error: sourceError } = await supabase.from("marketing_content_drafts").select("id, version, status, request").eq("id", input.draft_id).eq("organization_id", organizationId).maybeSingle();
    if (sourceError) return { ok: false, statusCode: 503, error: "studio_chat_document_unavailable" };
    if (!source || source.status === "published") return { ok: false, statusCode: 409, error: "studio_chat_document_changed", message: "La pieza ya no está disponible para editar." };
    if (input.draft_version !== undefined && input.draft_version !== null && Number(source.version ?? 1) !== input.draft_version) return { ok: false, statusCode: 409, error: "studio_chat_document_stale", message: "La pieza cambió desde que abriste el copiloto. Recarga antes de aplicar cambios." };
    const sourceRequest = source.request && typeof source.request === "object" ? source.request as Record<string, unknown> : {};
    if (input.connection_id && sourceRequest.store_id && sourceRequest.store_id !== input.connection_id) return { ok: false, statusCode: 409, error: "studio_chat_store_mismatch", message: "La tienda del email cambió. Recarga la pieza." };
  }

  let modelOverride: string | undefined;
  try {
    const balance = await loadCopilotBalance(supabase, context, organizationId);
    if (input.model) modelOverride = resolveCopilotModel({ requested: input.model, tier: balance.tier, remainingTokens: balance.remaining, openai: Boolean(env.OPENAI_API_KEY) }).model.anthropicModel;
    if (balance.exhausted) {
      return { ok: false, statusCode: 402, error: "copilot_balance_exhausted", message: "Se ha agotado el saldo de IA de este mes.", can_upgrade: canUpgradePlan(context, organizationId) };
    }
  } catch (error) {
    logger.error("studio_chat_balance_unavailable", error);
    return { ok: false, statusCode: 503, error: "copilot_balance_unavailable", message: "No se pudo comprobar el saldo de IA. Inténtalo de nuevo." };
  }

  const currentProductTitle = input.blocks.flatMap((block) => Array.isArray(block.props.items) ? block.props.items : []).map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).title : null).find((title): title is string => typeof title === "string" && Boolean(title.trim()));
  const selectedProductIds = selectedStudioProductIds(input.blocks);
  const productQuery = productNeedle(input.message) ?? (currentProductTitle?.trim().slice(0, 80) || null);
  const wantsProductContext = Boolean(productQuery) || /producto|cat[aá]logo|precio|variante|art[ií]culo/i.test(input.message);
  const wantsImageContext = /imagen|foto|fotograf[ií]a|visual|banner|creativo|logo/i.test(input.message);
  const imageTerms = wantsImageContext
    ? [...new Set(input.message.toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !["imagen", "imagenes", "foto", "fotografia", "visual", "quiero", "necesito", "cambia", "cambiar", "poner", "ponme", "email", "correo"].includes(word)))].slice(0, 4).join(" ")
    : "";
  const orgProfileCacheKey = `org:${organizationId}:brand`;
  const cachedOrgProfile = cachedBrandProfile(orgProfileCacheKey);
  let bankQuery = supabase
    .from("instagram_image_bank")
    .select("id, public_url, storage_bucket, storage_path, store_id, original_filename, analysis, markdown")
    .eq("organization_id", organizationId)
    .eq("status", "analyzed")
    .order("created_at", { ascending: false })
    .limit(40);
  if (imageTerms) {
    const escapedTerms = imageTerms.split(" ").map((word) => word.replace(/[(),%_]/g, "")).filter(Boolean);
    if (escapedTerms.length) {
      const pattern = `%${escapedTerms.join("%")}%`;
      bankQuery = bankQuery.or(`markdown.ilike.${pattern},original_filename.ilike.${pattern}`);
    }
  }
  const [orgProfile, storeProfile, best, news, searched] = await Promise.all([
    cachedOrgProfile !== undefined ? Promise.resolve({ data: cachedOrgProfile, error: null }) : supabase
      .from("marketing_brand_profiles")
      .select("brand_name, tone_guidelines, preferred_vocabulary, avoided_vocabulary, required_texts, claim_restrictions, legal_footer")
      .eq("organization_id", organizationId)
      .is("store_id", null)
      .maybeSingle(),
    input.connection_id
      ? supabase.from("shopify_stores").select("id").eq("organization_id", organizationId).eq("connection_id", input.connection_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    wantsProductContext ? listStudioProducts(env, authorization, context, organizationId, { source: "best", ...(input.connection_id ? { connection_id: input.connection_id } : {}) }) : Promise.resolve({ ok: true as const, data: { products: [] } }),
    wantsProductContext ? listStudioProducts(env, authorization, context, organizationId, { source: "new", ...(input.connection_id ? { connection_id: input.connection_id } : {}) }) : Promise.resolve({ ok: true as const, data: { products: [] } }),
    wantsProductContext && productQuery ? listStudioProducts(env, authorization, context, organizationId, { source: "search", q: productQuery, ...(input.connection_id ? { connection_id: input.connection_id } : {}) }) : Promise.resolve({ ok: true as const, data: { products: [] } }),
  ]);
  if (cachedOrgProfile === undefined && !orgProfile.error) cacheBrandProfile(orgProfileCacheKey, orgProfile.data as Record<string, unknown> | null);
  if (input.connection_id && (!storeProfile.data || storeProfile.error)) return { ok: false, statusCode: 409, error: "studio_store_invalid", message: "La tienda seleccionada ya no está disponible. Recarga el estudio." };
  if (storeProfile.data?.id) {
    const { data: scopedVisualSources, error: sourceScopeError } = await supabase
      .from("marketing_visual_asset_sources")
      .select("image_id")
      .eq("organization_id", organizationId)
      .eq("store_id", storeProfile.data.id);
    if (sourceScopeError) return { ok: false, statusCode: 503, error: "studio_visual_scope_unavailable", message: "No se pudo comprobar el alcance de los creativos de esa tienda." };
    const scopedImageIds = [...new Set((scopedVisualSources ?? []).map((source) => source.image_id as string))];
    const sourceClause = scopedImageIds.length ? `,id.in.(${scopedImageIds.join(",")})` : "";
    bankQuery = bankQuery.or(`store_id.is.null,store_id.eq.${storeProfile.data.id}${sourceClause}`);
  }
  else bankQuery = bankQuery.is("store_id", null);
  const bankRows = wantsImageContext
    ? await bankQuery
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (bankRows.error) return { ok: false, statusCode: 503, error: "studio_visual_bank_unavailable", message: "No se pudo buscar en la biblioteca de creativos." };
  const storeBrandCacheKey = storeProfile.data?.id ? `store:${organizationId}:${storeProfile.data.id}:brand` : "";
  const cachedStoreBrand = storeBrandCacheKey ? cachedBrandProfile(storeBrandCacheKey) : undefined;
  const storeBrand = storeProfile.data?.id
    ? cachedStoreBrand !== undefined
      ? { data: cachedStoreBrand, error: null }
      : await supabase.from("marketing_brand_profiles").select("brand_name, tone_guidelines, preferred_vocabulary, avoided_vocabulary, required_texts, claim_restrictions, legal_footer").eq("organization_id", organizationId).eq("store_id", storeProfile.data.id).maybeSingle()
    : { data: null, error: null };
  if (storeBrandCacheKey && cachedStoreBrand === undefined && !storeBrand.error) cacheBrandProfile(storeBrandCacheKey, storeBrand.data as Record<string, unknown> | null);
  if (storeBrand.error) return { ok: false, statusCode: 503, error: "studio_brand_unavailable", message: "No se pudo cargar la guía de marca de esa tienda." };
  const brand = resolveMarketingBrandProfile((orgProfile.data as Record<string, unknown> | null) ?? null, (storeBrand.data as Record<string, unknown> | null) ?? null);

  const products = new Map<string, StudioProductRef>();
  const exact = selectedProductIds.length
    ? await supabase.rpc("marketing_studio_products_by_ids", {
        target_organization_id: organizationId,
        target_store_id: storeProfile.data?.id ?? null,
        target_product_ids: selectedProductIds,
      })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (exact.error) return { ok: false, statusCode: 503, error: "studio_selected_products_unavailable", message: "No se pudieron verificar los productos que ya están en el email." };
  const exactResult = { ok: true as const, data: { products: exact.data ?? [] } };
  for (const result of [exactResult, best, news, searched]) {
    if (!result.ok) return { ok: false, statusCode: result.statusCode, error: result.error, ...(result.message ? { message: result.message } : {}) };
    for (const row of (result.data.products ?? []) as Array<Record<string, unknown>>) {
      const id = String(row.product_id ?? "");
      if (!id || products.has(id)) continue;
      const price = row.price === null || row.price === undefined ? "" : Number(row.price);
      products.set(id, {
        id,
        title: String(row.title ?? ""),
        price: price === "" || !Number.isFinite(price) ? "" : new Intl.NumberFormat("es-ES", { style: "currency", currency: String(row.currency_code || "EUR") }).format(price),
        image: String(row.image_url ?? ""),
        url: String(row.product_url ?? ""),
      });
    }
  }
  const bank = (bankRows.data ?? []) as Array<Record<string, unknown>>;
  const signedBank = await resolveVisualBankPreviewUrls(env, organizationId, bank);

  const images = new Set<string>();
  for (const row of bank) {
    const url = signedBank.urls.get(row.id as string);
    if (url) images.add(url);
  }
  for (const product of products.values()) if (product.image) images.add(product.image);
  for (const block of input.blocks) {
    for (const key of IMAGE_KEYS) {
      const value = block.props[key];
      if (typeof value === "string" && value) images.add(value);
    }
  }
  const logoUrl = input.brand.logoUrl;
  if (typeof logoUrl === "string" && logoUrl) images.add(logoUrl);

  const contextBlocks = [
    {
      label: "Email actual",
      data: { asunto: input.subject, preheader: input.preheader, bloques: input.blocks },
    },
    { label: "Marca", data: { guia: brand.profile ?? "Sin perfil de marca guardado.", colores_y_fuente_del_email: input.brand } },
    { label: "Bloque seleccionado", data: input.selected_id ? { id: input.selected_id, incluido_en: "Email actual" } : "ninguno" },
    {
      label: "Banco de imágenes (consultado solo cuando el mensaje requiere activos visuales)",
      data: wantsImageContext && bank.length
        ? bank.filter((row) => row.public_url).map((row) => ({ url: row.public_url, descripcion: describeImage({ original_filename: typeof row.original_filename === "string" ? row.original_filename : null, analysis: row.analysis, markdown: typeof row.markdown === "string" ? row.markdown : null }) }))
        : wantsImageContext ? "El banco está vacío: solo hay imágenes de productos o las que ya tiene el email." : "No consultado: el mensaje no solicita activos visuales.",
    },
    {
      label: "Productos",
      data: [...products.values()].map((product) => ({ id: product.id, titulo: product.title, precio: product.price, imagen: product.image, url: product.url })),
    },
    { label: "Conversación", data: input.history.slice(-12) },
    { label: "Mensaje", data: input.message },
  ];

  const fingerprint = createHash("sha256").update(JSON.stringify({
    draft_id: input.draft_id ?? null, draft_version: input.draft_version ?? null,
    document_revision: input.document_revision ?? null, message: input.message,
    history: input.history, subject: input.subject, preheader: input.preheader,
    blocks: input.blocks, brand: input.brand, selected_id: input.selected_id ?? null,
    connection_id: input.connection_id ?? null, model: modelOverride ?? null,
  })).digest("hex");
  const { data: reservation, error: reservationError } = await supabase.rpc("reserve_a11_studio_chat_request", {
    p_organization_id: organizationId, p_actor_user_id: context.user.id,
    p_request_id: input.request_id, p_fingerprint: fingerprint, p_daily_cap: STUDIO_CHAT_PER_DAY,
  });
  if (reservationError || !reservation || typeof reservation !== "object") return { ok: false, statusCode: 503, error: "studio_chat_usage_unavailable", message: "No se pudo reservar el turno de IA. Inténtalo de nuevo." };
  const reservationData = reservation as Record<string, unknown>;
  if (reservationData.status === "daily_cap") return { ok: false, statusCode: 429, error: "studio_chat_daily_cap", message: `Has llegado a ${STUDIO_CHAT_PER_DAY} mensajes con la IA del estudio hoy. Se reactiva mañana.` };
  if (reservationData.status === "key_reused") return { ok: false, statusCode: 409, error: "studio_chat_request_id_reused" };
  if (reservationData.status === "running") return { ok: false, statusCode: 409, error: "studio_chat_request_in_progress", message: "Este mensaje ya se está procesando." };
  if (reservationData.status === "completed") {
    const previous = reservationData.response as Record<string, unknown> | null;
    if (previous && typeof previous.error === "string") return previous as unknown as Failure;
    if (previous && previous.ok === true && previous.data && typeof previous.data === "object") return previous as unknown as { ok: true; data: { answer: string; ops: StudioOp[]; request_id: string | null; draft_id: string | null; draft_version: number | null; document_revision: number | null; remaining_today: number } };
    return { ok: false, statusCode: 503, error: "studio_chat_replay_unavailable" };
  }
  if (reservationData.status !== "reserved") return { ok: false, statusCode: 503, error: "studio_chat_reservation_invalid" };
  const used = Number(reservationData.used ?? 0);

  const run = await runCampaignEditorAgent(env, context, organizationId, {
    storeId: typeof storeProfile.data?.id === "string" ? storeProfile.data.id : null,
    objective: `${OBJECTIVE_PREFIX} ${input.message}`.slice(0, 1800),
    contextBlocks,
    guidance: STUDIO_CHAT_GUIDANCE,
    contract: studioChatContract(),
    agentCode: "a11_generador_marketing",
    trigger: "chat",
    ...(modelOverride ? { modelOverride } : {}),
  });
  if (run.ok === false) {
    const failure = run as Failure;
    const { error: finishError } = await supabase.rpc("finish_a11_studio_chat_request", { p_organization_id: organizationId, p_actor_user_id: context.user.id, p_request_id: input.request_id, p_fingerprint: fingerprint, p_response: failure });
    if (finishError) logger.error("studio_chat_failure_replay_persist_failed", finishError);
    return failure;
  }

  const output = outputSchema.safeParse(run.data.output);
  if (!output.success) {
    const failure: Failure = { ok: false, statusCode: 502, error: "studio_chat_invalid_output", detail: output.error.message };
    await supabase.rpc("finish_a11_studio_chat_request", { p_organization_id: organizationId, p_actor_user_id: context.user.id, p_request_id: input.request_id, p_fingerprint: fingerprint, p_response: failure });
    return failure;
  }
  const ops = normalizeStudioOps(output.data, { blocks: input.blocks }, { images, products });
  logger.info("studio_chat_answered", {
    organization_id: organizationId,
    raw_ops: output.data.ops.length,
    kept_ops: ops.length,
    bank_images: bank.length,
  });
  const dropped = output.data.ops.length - ops.length;
  if (dropped > 0 && ops.length === 0 && input.draft_id && input.draft_version) {
    const { error: rejectedAuditError } = await supabase.from("marketing_studio_operation_audits").insert({
      organization_id: organizationId, draft_id: input.draft_id, actor_user_id: context.user.id,
      request_id: input.request_id, base_version: input.draft_version, final_version: input.draft_version,
      source: "ai", accepted_operations: [],
      rejected_operations: Array.from({ length: Math.min(dropped, MAX_OPS) }, () => ({ reason: "not_verified" })),
    });
    if (rejectedAuditError) logger.error("studio_chat_rejected_ops_audit_failed", rejectedAuditError);
  }
  const answer = dropped === output.data.ops.length && dropped > 0
    ? `No he aplicado ningún cambio porque no pude verificar las ${dropped} operación(es) propuestas. Puedes pedirme otra versión más concreta.`
    : dropped
      ? `${output.data.answer} He omitido ${dropped} cambio(s) que no pude verificar con seguridad.`
      : output.data.answer;
  const result = { ok: true as const, data: { answer, ops, rejected_operations: Array.from({ length: Math.min(dropped, MAX_OPS) }, () => ({ reason: "not_verified" })), request_id: input.request_id, draft_id: input.draft_id ?? null, draft_version: input.draft_version ?? null, document_revision: input.document_revision ?? null, remaining_today: Math.max(0, STUDIO_CHAT_PER_DAY - used) } };
  const { error: finishError } = await supabase.rpc("finish_a11_studio_chat_request", { p_organization_id: organizationId, p_actor_user_id: context.user.id, p_request_id: input.request_id, p_fingerprint: fingerprint, p_response: result });
  if (finishError) logger.error("studio_chat_response_replay_persist_failed", finishError);
  return result;
}
