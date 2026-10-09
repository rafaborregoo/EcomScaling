/**
 * Editar una campaña ya creada con A05: la IA propone, una persona aplica.
 *
 * Cuando el calendario ya esta lleno, el consultor (o el cliente, sobre lo
 * suyo) abre una campaña y le pide a la IA un cambio: «acorta el asunto»,
 * «aplica lo que pidio el cliente». A05 lee la campaña, su pieza, las
 * correcciones abiertas del hilo y la marca, y devuelve cambios CONCRETOS por
 * campo. Nada se escribe hasta que una persona pulsa «Aplicar»: entonces cada
 * cambio pasa por la herramienta de siempre (editar la pieza -> version nueva y
 * vuelta a revision; mover la fecha -> actualizar el item del calendario).
 *
 * Criterio "ver vs escribir": analizar y proponer no necesita aprobacion;
 * escribir en el dominio si.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";
import type { OutputContract } from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { requireOperationalOrganization, type AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { hasAssignedConsultant } from "./client-autonomy.js";
import {
  isStaffActor,
  notifyCampaignEvent,
  resolveThreadActor,
  reviewStatusAfterClientActivity,
  type NoteTarget,
  type ReviewStatus,
  type ThreadActor,
} from "./campaign-review.js";
import { updateCampaignCalendarItem } from "./campaign-planning.js";
import { runCampaignEditorAgent, updateMarketingContentDraft } from "./ai-runtime.js";
import { resolveMarketingBrandProfile } from "./marketing-brand-profile.js";
import { emailHtmlToPlainText } from "./email-body-text.js";

const logger = createLogger("campaign-ai-edit");

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

// ---------------------------------------------------------------------------
// Campos editables y contrato de salida
// ---------------------------------------------------------------------------

export type PieceKind = "email" | "meta" | "none";

export type EditField =
  | "subject"
  | "preheader"
  | "body"
  | "headline"
  | "description"
  | "primary_text"
  | "destination_url"
  | "starts_at";

export const EDIT_FIELD_LABEL: Record<EditField, string> = {
  subject: "Asunto",
  preheader: "Preheader",
  body: "Texto del email",
  headline: "Titular del anuncio",
  description: "Descripción del anuncio",
  primary_text: "Texto principal del anuncio",
  destination_url: "Enlace de destino",
  starts_at: "Fecha y hora",
};

/** Que correcciones del hilo cierra aplicar un campo. */
export const EDIT_FIELD_TARGETS: Record<EditField, NoteTarget[]> = {
  subject: ["subject"],
  preheader: ["preheader"],
  body: ["body", "cta"],
  headline: ["creative"],
  description: ["creative"],
  primary_text: ["creative"],
  destination_url: ["cta", "creative"],
  starts_at: ["schedule"],
};

export function allowedFieldsFor(kind: PieceKind): EditField[] {
  if (kind === "email") return ["subject", "preheader", "body", "starts_at"];
  if (kind === "meta") return ["headline", "description", "primary_text", "destination_url", "starts_at"];
  return ["starts_at"];
}

const ALL_FIELDS = Object.keys(EDIT_FIELD_LABEL) as [EditField, ...EditField[]];

const MAX_EDITS = 6;
const MAX_WHY = 400;
export const AI_EDITS_PER_ITEM_PER_DAY = 10;

const editorOutputSchema = z.object({
  answer: z.string().min(1).max(1500),
  edits: z
    .array(
      z.object({
        field: z.enum(ALL_FIELDS),
        now: z.string().min(1).max(200_000),
        why: z.string().max(1000),
      }),
    )
    .max(MAX_EDITS),
});

export type EditorOutput = z.infer<typeof editorOutputSchema>;

const editorJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "edits"],
  properties: {
    answer: {
      type: "string",
      description: "Una o dos frases para quien lo va a leer: que has cambiado y por que. Si no puedes, dilo aqui.",
    },
    edits: {
      type: "array",
      maxItems: MAX_EDITS,
      description: "Cambios concretos, uno por campo. Vacio si no hay nada que cambiar o no se puede.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "now", "why"],
        properties: {
          field: { type: "string", enum: ALL_FIELDS },
          now: { type: "string", description: "Valor COMPLETO nuevo del campo, no un diff." },
          why: { type: "string", description: "Una frase con el motivo del cambio." },
        },
      },
    },
  },
} as const;

export function editorOutputContract(): OutputContract<unknown> {
  return {
    jsonSchema: editorJsonSchema as unknown as Record<string, unknown>,
    schema: editorOutputSchema as unknown as OutputContract<unknown>["schema"],
  };
}

export const CAMPAIGN_EDITOR_GUIDANCE = `

EDICION DE UNA CAMPAÑA EXISTENTE — ESTA INSTRUCCION PREVALECE sobre las anteriores del prompt. En esta tarea no planificas calendario ni haces estrategia: te piden cambiar una pieza que ya existe y SI debes escribir el texto nuevo. La regla de planificación de «no generar HTML ni copy final» NO se aplica aquí: el copy nuevo es exactamente lo que se te pide, siempre como PROPUESTA; nada se escribe hasta que una persona las aplica. Lees «Campaña», «Pieza actual», «Correcciones abiertas», «Hilo reciente» y «Marca», y devuelves en edits[] los cambios concretos. Si la petición o una corrección abierta se puede cumplir con un campo de «Campos editables», DEBES devolver el edit correspondiente; solo dejas edits vacío si es imposible y entonces lo explicas en answer. Reglas: (1) cada edit toca UN campo de «Campos editables» y trae su valor COMPLETO nuevo, no un diff; (2) cambia solo lo que la petición o una corrección abierta pide y deja el resto exactamente igual; (3) body es el HTML completo del email: conserva estructura, estilos, imágenes y enlaces, cambia solo los textos o el atributo pedido y no añadas scripts; (4) respeta la marca (tono, vocabulario preferido y evitado, afirmaciones restringidas) y no inventes ofertas, plazos, precios ni datos que no estén en el contexto; (5) un asunto cabe en unos 60 caracteres salvo que se pida otra cosa; (6) answer son una o dos frases en segunda persona dirigidas a quien lo lee (campo «Petición.dirigido_a») sobre qué has cambiado y por qué, sin decir que «quedan pendientes» ni repetir esta mecánica; why es una frase por cambio con un motivo comprobable.`;

// ---------------------------------------------------------------------------
// Reglas puras
// ---------------------------------------------------------------------------

export function aiEditLimitExceeded(proposalsToday: number): boolean {
  return proposalsToday >= AI_EDITS_PER_ITEM_PER_DAY;
}

export type ProposedEdit = {
  field: EditField;
  label: string;
  was: string;
  now: string;
  why: string;
  state: "open" | "applied" | "dismissed";
};

/**
 * Limpia lo que devuelve el modelo: solo campos de esa pieza, sin repetidos, sin
 * cambios que no cambian nada y con el valor anterior calculado por nosotros
 * (el modelo no es quien dice que habia antes).
 */
export function normalizeProposedEdits(
  output: EditorOutput,
  kind: PieceKind,
  current: Partial<Record<EditField, string>>,
): ProposedEdit[] {
  const allowed = new Set(allowedFieldsFor(kind));
  const seen = new Set<EditField>();
  const edits: ProposedEdit[] = [];
  for (const edit of output.edits) {
    if (!allowed.has(edit.field) || seen.has(edit.field)) continue;
    const now = edit.now.trim();
    const was = current[edit.field] ?? "";
    if (!now || now === was.trim()) continue;
    if (edit.field === "starts_at" && !Number.isFinite(Date.parse(now))) continue;
    if (edit.field === "destination_url" && !/^https?:\/\//i.test(now)) continue;
    seen.add(edit.field);
    edits.push({
      field: edit.field,
      label: EDIT_FIELD_LABEL[edit.field],
      was,
      now,
      why: edit.why.trim().slice(0, MAX_WHY),
      state: "open",
    });
  }
  return edits.slice(0, MAX_EDITS);
}

/** Cambios de pieza -> cuerpo del PATCH de la pieza (lo mismo que enviaria la pantalla). */
export function editsToDraftPatch(kind: PieceKind, edits: Array<Pick<ProposedEdit, "field" | "now">>) {
  const patch: Record<string, unknown> = {};
  for (const edit of edits) {
    if (kind === "email") {
      if (edit.field === "subject") patch.subject = edit.now;
      if (edit.field === "preheader") patch.preheader = edit.now;
      if (edit.field === "body") {
        patch.html = edit.now;
        patch.plain_text = emailHtmlToPlainText(edit.now) || edit.now.slice(0, 2000);
      }
    } else if (kind === "meta") {
      if (edit.field === "headline") patch.headline = edit.now;
      if (edit.field === "description") patch.description = edit.now;
      if (edit.field === "primary_text") patch.primary_text = edit.now;
      if (edit.field === "destination_url") patch.destination_url = edit.now;
    }
  }
  return patch;
}

/** Estado de la propuesta segun lo que queda por decidir. */
export function proposalResolution(
  edits: Array<Pick<ProposedEdit, "state">>,
): "applied" | "dismissed" | null {
  if (edits.some((edit) => edit.state === "open")) return null;
  return edits.some((edit) => edit.state === "applied") ? "applied" : "dismissed";
}

/** Un cliente con consultor solo toca lo suyo; sin consultor, todo lo visible. */
export function aiEditAccessDecision(input: {
  actor: ThreadActor;
  clientHasConsultant: boolean;
  item: { origin: string; created_by: string | null };
  userId: string;
}): boolean {
  if (isStaffActor(input.actor)) return true;
  if (!input.clientHasConsultant) return true;
  return input.item.origin === "client" && input.item.created_by === input.userId;
}

// ---------------------------------------------------------------------------
// Lectura de la campaña y su pieza
// ---------------------------------------------------------------------------

type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

type ItemRow = {
  id: string;
  organization_id: string;
  store_id: string | null;
  title: string;
  description: string | null;
  channel: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  origin: string;
  review_status: ReviewStatus | null;
  marketing_draft_id: string | null;
  created_by: string | null;
  is_visible_to_client: boolean;
};

type DraftRow = {
  id: string;
  status: string;
  version: number;
  request: Record<string, unknown> | null;
  subject: string | null;
  preheader: string | null;
  from_name: string | null;
  plain_text: string | null;
  html: string | null;
  blocks: unknown;
};

const ITEM_COLUMNS =
  "id, organization_id, store_id, title, description, channel, starts_at, ends_at, status, origin, review_status, marketing_draft_id, created_by, is_visible_to_client";
const DRAFT_COLUMNS = "id, status, version, request, subject, preheader, from_name, plain_text, html, blocks";

function pieceKindOf(draft: DraftRow | null): PieceKind {
  if (!draft) return "none";
  const channel = String((draft.request as { channel?: unknown } | null)?.channel ?? "");
  return ["meta_ads", "instagram_organic"].includes(channel) ? "meta" : "email";
}

function buttonHref(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  for (const block of blocks) {
    if (block && typeof block === "object" && (block as { type?: unknown }).type === "button") {
      const href = (block as { href?: unknown }).href;
      if (typeof href === "string") return href;
    }
  }
  return "";
}

function currentValues(kind: PieceKind, draft: DraftRow | null, item: ItemRow): Partial<Record<EditField, string>> {
  const values: Partial<Record<EditField, string>> = { starts_at: item.starts_at };
  if (!draft) return values;
  if (kind === "email") {
    values.subject = draft.subject ?? "";
    values.preheader = draft.preheader ?? "";
    values.body = draft.html ?? "";
  } else if (kind === "meta") {
    values.headline = draft.subject ?? "";
    values.description = draft.preheader ?? "";
    values.primary_text = draft.plain_text ?? "";
    values.destination_url = buttonHref(draft.blocks);
  }
  return values;
}

async function loadItemAndDraft(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  actor: ThreadActor,
): Promise<Result<{ item: ItemRow; draft: DraftRow | null }>> {
  const { data, error } = await supabase
    .from("campaign_calendar_items")
    .select(ITEM_COLUMNS)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, statusCode: 500, error: "campaign_item_load_failed", detail: error.message };
  const item = data as ItemRow | null;
  if (!item || (!isStaffActor(actor) && !item.is_visible_to_client)) {
    return { ok: false, statusCode: 404, error: "campaign_item_not_found" };
  }
  let draft: DraftRow | null = null;
  if (item.marketing_draft_id) {
    const { data: draftRow } = await supabase
      .from("marketing_content_drafts")
      .select(DRAFT_COLUMNS)
      .eq("id", item.marketing_draft_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    draft = (draftRow as DraftRow | null) ?? null;
  }
  return { ok: true, data: { item, draft } };
}

async function authorize(
  env: ApiEnv,
  supabase: SupabaseClient,
  context: AuthContext,
  organizationId: string,
  item: ItemRow,
): Promise<Failure | { ok: true; actor: ThreadActor }> {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const actor = resolveThreadActor(context, organizationId);
  if (!actor) return { ok: false, statusCode: 403, error: "campaign_thread_access_required" };
  const clientHasConsultant = isStaffActor(actor) ? true : await hasAssignedConsultant(supabase, organizationId);
  if (!aiEditAccessDecision({ actor, clientHasConsultant, item, userId: context.user.id })) {
    return {
      ok: false,
      statusCode: 403,
      error: "agenda_managed_by_consultant",
      message: "Tu consultor lleva el resto de campañas. Solo puedes editar con IA las que has creado tú.",
    };
  }
  return { ok: true, actor };
}

// ---------------------------------------------------------------------------
// Proponer
// ---------------------------------------------------------------------------

export type CampaignEditProposal = {
  note_id: string;
  answer: string;
  edits: ProposedEdit[];
  piece_kind: PieceKind;
};

export async function proposeCampaignEdit(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  input: { instruction?: unknown },
): Promise<Result<CampaignEditProposal>> {
  const instruction = typeof input.instruction === "string" ? input.instruction.trim().slice(0, 2000) : "";
  if (!instruction) return { ok: false, statusCode: 400, error: "instruction_required" };
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const preActor = resolveThreadActor(context, organizationId);
  if (!preActor) return { ok: false, statusCode: 403, error: "campaign_thread_access_required" };
  const loaded = await loadItemAndDraft(supabase, organizationId, itemId, preActor);
  if (loaded.ok === false) return loaded;
  const { item, draft } = loaded.data;
  const authorized = await authorize(env, supabase, context, organizationId, item);
  if (authorized.ok === false) return authorized;
  const actor = authorized.actor;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("campaign_item_notes")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId)
    .eq("organization_id", organizationId)
    .eq("kind", "ai_proposal")
    .gte("created_at", startOfDay.toISOString());
  if (aiEditLimitExceeded(count ?? 0)) {
    return {
      ok: false,
      statusCode: 429,
      error: "campaign_ai_edit_daily_cap",
      message: `Ya has pedido ${AI_EDITS_PER_ITEM_PER_DAY} propuestas a la IA sobre esta campaña hoy. Se reactiva mañana.`,
    };
  }

  const kind = pieceKindOf(draft);
  const current = currentValues(kind, draft, item);

  const [notesResult, profileResult] = await Promise.all([
    supabase
      .from("campaign_item_notes")
      .select("id, kind, author_kind, target, body, resolution, visible_to_client, created_at")
      .eq("item_id", itemId)
      .eq("organization_id", organizationId)
      .neq("kind", "ai_proposal")
      .order("created_at", { ascending: false })
      .limit(24),
    Promise.all([
      supabase
        .from("marketing_brand_profiles")
        .select("brand_name, tone_guidelines, preferred_vocabulary, avoided_vocabulary, required_texts, claim_restrictions, legal_footer")
        .eq("organization_id", organizationId)
        .is("store_id", null)
        .maybeSingle(),
      item.store_id
        ? supabase
            .from("marketing_brand_profiles")
            .select("brand_name, tone_guidelines, preferred_vocabulary, avoided_vocabulary, required_texts, claim_restrictions, legal_footer")
            .eq("organization_id", organizationId)
            .eq("store_id", item.store_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]),
  ]);
  const notes = (notesResult.data ?? []) as Array<{
    kind: string;
    author_kind: string;
    target: string | null;
    body: string;
    resolution: string | null;
    visible_to_client: boolean;
    created_at: string;
  }>;
  // Un cliente nunca llega a leer notas internas, y la IA que trabaja para el no debe usarlas.
  const visibleNotes = notes.filter((note) => isStaffActor(actor) || note.visible_to_client);
  const brand = resolveMarketingBrandProfile(
    (profileResult[0].data as Record<string, unknown> | null) ?? null,
    (profileResult[1].data as Record<string, unknown> | null) ?? null,
  );

  const contextBlocks = [
    {
      label: "Campaña",
      data: {
        titulo: item.title,
        canal: item.channel,
        fecha_y_hora_prevista: item.starts_at,
        estado_en_el_calendario: item.status,
        origen: item.origin,
        ficha_del_plan: (item.description ?? "").slice(0, 4000),
      },
    },
    {
      label: "Pieza actual",
      data:
        kind === "none"
          ? { tipo: "sin_pieza", aviso: "Esta campaña aún no tiene pieza escrita: solo se puede proponer una fecha." }
          : {
              tipo: kind === "email" ? "email" : "anuncio_meta",
              estado: draft?.status,
              version: draft?.version,
              ...(kind === "email"
                ? {
                    asunto: draft?.subject,
                    preheader: draft?.preheader,
                    remitente: draft?.from_name,
                    texto_plano: (draft?.plain_text ?? "").slice(0, 6000),
                    html: (draft?.html ?? "").slice(0, 40_000),
                  }
                : {
                    titular: draft?.subject,
                    descripcion: draft?.preheader,
                    texto_principal: draft?.plain_text,
                    enlace_de_destino: buttonHref(draft?.blocks),
                  }),
            },
    },
    {
      label: "Correcciones abiertas",
      data: visibleNotes
        .filter((note) => note.kind === "correction" && !note.resolution)
        .slice(0, 10)
        .map((note) => ({ apartado: note.target, de: note.author_kind, texto: note.body })),
    },
    {
      label: "Hilo reciente",
      data: visibleNotes
        .filter((note) => note.kind === "note")
        .slice(0, 8)
        .reverse()
        .map((note) => ({ de: note.author_kind, texto: note.body })),
    },
    { label: "Marca", data: brand.profile ?? { aviso: "Sin perfil de marca guardado." } },
    {
      label: "Campos editables",
      data: allowedFieldsFor(kind).map((field) => ({ campo: field, nombre: EDIT_FIELD_LABEL[field] })),
    },
    {
      label: "Petición",
      data: {
        instruccion: instruction,
        dirigido_a: isStaffActor(actor) ? "el consultor" : "el cliente",
      },
    },
  ];

  const run = await runCampaignEditorAgent(env, context, organizationId, {
    storeId: item.store_id,
    objective: `Editar la campaña «${item.title}»: ${instruction}`.slice(0, 1800),
    contextBlocks,
    guidance: CAMPAIGN_EDITOR_GUIDANCE,
    contract: editorOutputContract(),
  });
  if (run.ok === false) return run as Failure;

  const parsed = editorOutputSchema.safeParse(run.data.output);
  if (!parsed.success) {
    return { ok: false, statusCode: 502, error: "campaign_ai_edit_invalid_output", detail: parsed.error.message };
  }
  const edits = normalizeProposedEdits(parsed.data, kind, current);
  logger.info("campaign_ai_edit_proposed", {
    organization_id: organizationId,
    item_id: itemId,
    piece_kind: kind,
    raw_edits: parsed.data.edits.length,
    kept_edits: edits.length,
  });

  const { data: note, error } = await supabase
    .from("campaign_item_notes")
    .insert({
      organization_id: organizationId,
      item_id: itemId,
      author_user_id: context.user.id,
      author_kind: "ai",
      kind: "ai_proposal",
      body: parsed.data.answer.slice(0, 4000),
      // La propuesta de la IA de un consultor es de trabajo: el cliente la ve
      // si se aplica (lo deja dicho una linea de sistema), no antes.
      visible_to_client: !isStaffActor(actor),
      payload: {
        instruction,
        piece_kind: kind,
        run_id: run.data.run_id,
        output_id: run.data.output_id,
        requested_by: actor,
        edits,
      },
    })
    .select("id")
    .single();
  if (error || !note) {
    return { ok: false, statusCode: 500, error: "campaign_ai_proposal_save_failed", detail: error?.message };
  }
  // Una propuesta sin cambios no se queda abierta esperando una decision.
  if (edits.length === 0) {
    await supabase
      .from("campaign_item_notes")
      .update({ resolution: "dismissed", resolved_at: new Date().toISOString(), resolved_by: context.user.id })
      .eq("id", note.id);
  }
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "campaign_ai_edit.proposed",
    entityType: "campaign_calendar_item",
    entityId: itemId,
    oldData: null,
    newData: { note_id: note.id, fields: edits.map((edit) => edit.field), run_id: run.data.run_id },
  });
  return {
    ok: true,
    data: { note_id: note.id as string, answer: parsed.data.answer, edits, piece_kind: kind },
  };
}

// ---------------------------------------------------------------------------
// Aplicar / descartar
// ---------------------------------------------------------------------------

type ProposalNote = {
  id: string;
  item_id: string;
  kind: string;
  resolution: string | null;
  payload: { piece_kind?: PieceKind; edits?: ProposedEdit[] } | null;
};

async function loadProposal(supabase: SupabaseClient, organizationId: string, itemId: string, noteId: string) {
  const { data } = await supabase
    .from("campaign_item_notes")
    .select("id, item_id, kind, resolution, payload")
    .eq("id", noteId)
    .eq("item_id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const note = data as ProposalNote | null;
  if (!note || note.kind !== "ai_proposal") return null;
  return note;
}

export async function applyCampaignEditProposal(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  noteId: string,
  input: { fields?: unknown; dismiss?: unknown },
): Promise<Result<{ applied: EditField[]; dismissed: EditField[]; resolution: string | null; draft_version: number | null }>> {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const preActor = resolveThreadActor(context, organizationId);
  if (!preActor) return { ok: false, statusCode: 403, error: "campaign_thread_access_required" };
  const supabase = createServiceClient(env);
  const loaded = await loadItemAndDraft(supabase, organizationId, itemId, preActor);
  if (loaded.ok === false) return loaded;
  const { item, draft } = loaded.data;
  const authorized = await authorize(env, supabase, context, organizationId, item);
  if (authorized.ok === false) return authorized;
  const actor = authorized.actor;

  const note = await loadProposal(supabase, organizationId, itemId, noteId);
  if (!note) return { ok: false, statusCode: 404, error: "campaign_ai_proposal_not_found" };
  if (note.resolution) return { ok: false, statusCode: 409, error: "campaign_ai_proposal_already_decided" };
  const edits = note.payload?.edits ?? [];
  const kind = note.payload?.piece_kind ?? pieceKindOf(draft);
  const requested = Array.isArray(input.fields)
    ? (input.fields.filter((field): field is EditField => typeof field === "string" && field in EDIT_FIELD_LABEL))
    : edits.filter((edit) => edit.state === "open").map((edit) => edit.field);
  const dismiss = input.dismiss === true;
  const targets = edits.filter((edit) => edit.state === "open" && requested.includes(edit.field));
  if (targets.length === 0) return { ok: false, statusCode: 400, error: "campaign_ai_proposal_nothing_to_decide" };

  const applied: EditField[] = [];
  let draftVersion: number | null = draft?.version ?? null;
  if (!dismiss) {
    // Si la pieza cambio desde que la IA la leyo, el "antes" de la propuesta ya
    // no es verdad: se pide proponer de nuevo en vez de pisar el cambio de otro.
    const current = currentValues(kind, draft, item);
    const stale = targets.find((edit) => (current[edit.field] ?? "").trim() !== edit.was.trim());
    if (stale) {
      return {
        ok: false,
        statusCode: 409,
        error: "campaign_ai_proposal_stale",
        message: `«${stale.label}» ha cambiado desde que se hizo la propuesta. Pídele otra a la IA.`,
      };
    }

    const patch = editsToDraftPatch(kind, targets);
    if (Object.keys(patch).length > 0) {
      if (!draft) return { ok: false, statusCode: 409, error: "campaign_has_no_piece" };
      const result = await updateMarketingContentDraft(env, context, organizationId, draft.id, patch);
      if (result.ok === false) return result as Failure;
      draftVersion = Number((result.data as { draft?: { version?: number } }).draft?.version ?? draftVersion ?? 0) || null;
      for (const edit of targets) if (edit.field !== "starts_at") applied.push(edit.field);
    }
    const schedule = targets.find((edit) => edit.field === "starts_at");
    if (schedule) {
      const moved = await updateCampaignCalendarItem(env, context, organizationId, itemId, { startsAt: schedule.now });
      if (moved.ok === false) return moved as Failure;
      applied.push("starts_at");
    }
  }

  const decidedFields = new Set(targets.map((edit) => edit.field));
  const nextEdits = edits.map((edit) =>
    decidedFields.has(edit.field) ? { ...edit, state: dismiss ? ("dismissed" as const) : ("applied" as const) } : edit,
  );
  const resolution = proposalResolution(nextEdits);
  await supabase
    .from("campaign_item_notes")
    .update({
      payload: { ...(note.payload ?? {}), edits: nextEdits },
      ...(resolution ? { resolution, resolved_by: context.user.id, resolved_at: new Date().toISOString() } : {}),
    })
    .eq("id", noteId)
    .eq("organization_id", organizationId);

  if (!dismiss && applied.length > 0) {
    // Cierra las correcciones del hilo que estos cambios resuelven.
    const closes = [...new Set(applied.flatMap((field) => EDIT_FIELD_TARGETS[field]))];
    if (closes.length > 0) {
      await supabase
        .from("campaign_item_notes")
        .update({ resolution: "resolved", resolved_by: context.user.id, resolved_at: new Date().toISOString() })
        .eq("item_id", itemId)
        .eq("organization_id", organizationId)
        .eq("kind", "correction")
        .is("resolution", null)
        .in("target", closes);
    }
    await supabase.from("campaign_item_notes").insert({
      organization_id: organizationId,
      item_id: itemId,
      author_user_id: context.user.id,
      author_kind: "system",
      kind: "system",
      body: `La IA propuso ${applied.map((field) => `«${EDIT_FIELD_LABEL[field]}»`).join(", ")} y ${isStaffActor(actor) ? "el consultor" : "el cliente"} lo aplicó${draftVersion ? ` · versión ${draftVersion}` : ""}.`,
      visible_to_client: true,
    });
    if (isStaffActor(actor)) {
      await notifyCampaignEvent(supabase, {
        event: "consultant_note",
        organizationId,
        itemId,
        itemTitle: item.title,
        actorUserId: context.user.id,
      });
    } else {
      const next = reviewStatusAfterClientActivity(item.review_status, "edit");
      if (next && next !== item.review_status) {
        await supabase
          .from("campaign_calendar_items")
          .update({ review_status: next, review_requested_at: new Date().toISOString() })
          .eq("id", itemId)
          .eq("organization_id", organizationId);
      }
      await notifyCampaignEvent(supabase, {
        event: "client_edited",
        organizationId,
        itemId,
        itemTitle: item.title,
        actorUserId: context.user.id,
      });
    }
  }
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: dismiss ? "campaign_ai_edit.dismissed" : "campaign_ai_edit.applied",
    entityType: "campaign_calendar_item",
    entityId: itemId,
    oldData: null,
    newData: { note_id: noteId, fields: targets.map((edit) => edit.field), draft_version: draftVersion },
  });
  logger.info("campaign_ai_edit_decided", { organization_id: organizationId, item_id: itemId, dismiss, applied });
  return {
    ok: true,
    data: {
      applied,
      dismissed: dismiss ? targets.map((edit) => edit.field) : [],
      resolution,
      draft_version: draftVersion,
    },
  };
}
