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

const logger = createLogger("studio-ai-chat");

export const STUDIO_CHAT_PER_DAY = 60;
const MAX_OPS = 12;
const OBJECTIVE_PREFIX = "Estudio de contenido:";
const PUBLIC_BANK_BUCKET = "marketing-assets";

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
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === "items" && Array.isArray(value) && value.length && value.every((item) => item && typeof item === "object" && "id" in item)) {
      const items = (value as Array<{ id: unknown }>)
        .map((item) => known.products.get(String(item.id)))
        .filter((product): product is StudioProductRef => Boolean(product));
      if (items.length) props.items = items;
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
  const parse = (text: string) => {
    try {
      return cleanOpProps(JSON.parse(text || "{}"), known);
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
      const props = parse(raw.props_json);
      if (types.has(raw.type) && props && (raw.after_id === "" || raw.after_id === "inicio" || ids.has(raw.after_id))) {
        ops.push({ op: "add", type: raw.type, props, after_id: after(raw.after_id) });
      }
    } else if (!ids.has(raw.block_id)) {
      continue;
    } else if (raw.op === "set") {
      const props = parse(raw.props_json);
      if (props && Object.keys(props).length) ops.push({ op: "set", block_id: raw.block_id, props });
    } else if (raw.op === "remove") {
      ops.push({ op: "remove", block_id: raw.block_id });
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

export async function chatStudioEdit(
  env: LoadedApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  payload: unknown,
): Promise<{ ok: true; data: { answer: string; ops: StudioOp[]; remaining_today: number } } | Failure> {
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

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("actor_user_id", context.user.id)
    .like("objective", `${OBJECTIVE_PREFIX}%`)
    .gte("created_at", startOfDay.toISOString());
  const used = count ?? 0;
  if (used >= STUDIO_CHAT_PER_DAY) {
    return { ok: false, statusCode: 429, error: "studio_chat_daily_cap", message: `Has llegado a ${STUDIO_CHAT_PER_DAY} mensajes con la IA del estudio hoy. Se reactiva mañana.` };
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
  }

  const [orgProfile, bankRows, best, news] = await Promise.all([
    supabase
      .from("marketing_brand_profiles")
      .select("brand_name, tone_guidelines, preferred_vocabulary, avoided_vocabulary, required_texts, claim_restrictions, legal_footer")
      .eq("organization_id", organizationId)
      .is("store_id", null)
      .maybeSingle(),
    supabase
      .from("instagram_image_bank")
      .select("id, public_url, original_filename, analysis, markdown")
      .eq("organization_id", organizationId)
      .eq("storage_bucket", PUBLIC_BANK_BUCKET)
      .eq("status", "analyzed")
      .order("created_at", { ascending: false })
      .limit(40),
    listStudioProducts(env, authorization, context, organizationId, { source: "best", ...(input.connection_id ? { connection_id: input.connection_id } : {}) }),
    listStudioProducts(env, authorization, context, organizationId, { source: "new", ...(input.connection_id ? { connection_id: input.connection_id } : {}) }),
  ]);
  const brand = resolveMarketingBrandProfile((orgProfile.data as Record<string, unknown> | null) ?? null, null);

  const products = new Map<string, StudioProductRef>();
  for (const result of [best, news]) {
    if (!result.ok) continue;
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
  const bank = (bankRows.data ?? []) as Array<{ id: string; public_url: string | null; original_filename: string | null; analysis: unknown; markdown: string | null }>;

  const images = new Set<string>();
  for (const row of bank) if (row.public_url) images.add(row.public_url);
  for (const product of products.values()) if (product.image) images.add(product.image);
  for (const block of input.blocks) {
    for (const key of IMAGE_KEYS) {
      const value = block.props[key];
      if (typeof value === "string" && value) images.add(value);
    }
  }
  const logoUrl = input.brand.logoUrl;
  if (typeof logoUrl === "string" && logoUrl) images.add(logoUrl);

  const selected = input.blocks.find((block) => block.id === input.selected_id) ?? null;
  const contextBlocks = [
    {
      label: "Email actual",
      data: { asunto: input.subject, preheader: input.preheader, bloques: input.blocks },
    },
    { label: "Bloque seleccionado", data: selected ?? "ninguno" },
    { label: "Marca", data: { guia: brand.profile ?? "Sin perfil de marca guardado.", colores_y_fuente_del_email: input.brand } },
    {
      label: "Banco de imágenes",
      data: bank.length
        ? bank.filter((row) => row.public_url).map((row) => ({ url: row.public_url, descripcion: describeImage(row) }))
        : "El banco está vacío: solo hay imágenes de productos o las que ya tiene el email.",
    },
    {
      label: "Productos",
      data: [...products.values()].map((product) => ({ id: product.id, titulo: product.title, precio: product.price, imagen: product.image })),
    },
    { label: "Conversación", data: input.history.slice(-12) },
    { label: "Mensaje", data: input.message },
  ];

  const run = await runCampaignEditorAgent(env, context, organizationId, {
    storeId: null,
    objective: `${OBJECTIVE_PREFIX} ${input.message}`.slice(0, 1800),
    contextBlocks,
    guidance: STUDIO_CHAT_GUIDANCE,
    contract: studioChatContract(),
    ...(modelOverride ? { modelOverride } : {}),
  });
  if (run.ok === false) return run as Failure;

  const output = outputSchema.safeParse(run.data.output);
  if (!output.success) {
    return { ok: false, statusCode: 502, error: "studio_chat_invalid_output", detail: output.error.message };
  }
  const ops = normalizeStudioOps(output.data, { blocks: input.blocks }, { images, products });
  logger.info("studio_chat_answered", {
    organization_id: organizationId,
    raw_ops: output.data.ops.length,
    kept_ops: ops.length,
    bank_images: bank.length,
  });
  return { ok: true, data: { answer: output.data.answer, ops, remaining_today: Math.max(0, STUDIO_CHAT_PER_DAY - used - 1) } };
}
