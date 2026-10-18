import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, requireOperationalOrganization } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { resolveShopifyStoreScope } from "./shopify-store-scope.js";

/**
 * Notas del consultor ancladas a una tarjeta del panel (cifra o bloque).
 *
 * La clave de anclaje es la misma en la vista del cliente y en la del
 * consultor: las dos leen la misma nota. El consultor escribe (con duracion
 * opcional) y archiva; el cliente solo la marca como vista, y entonces deja de
 * resaltarse su tarjeta. Es un aviso ligero: no genera notificacion en la
 * campana, la tarjeta sombreada ya lo es.
 */

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type ZoneNote = {
  id: string;
  anchor: string;
  body: string;
  expires_at: string | null;
  seen_at: string | null;
  created_at: string;
};

const ANCHOR_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,119}$/;
const NOTE_COLUMNS = "id, anchor, body, expires_at, seen_at, created_at";

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

function isConsultantOrAdmin(context: AuthContext) {
  return ["consultant", "platform_admin"].includes(context.profile.platform_role);
}

// Las notas son por tienda: la de la conexion elegida en la cabecera, o la
// unica que tenga el cliente. null = cliente sin tienda Shopify.
async function storeFor(supabase: ReturnType<typeof createServiceClient>, organizationId: string, connectionId?: string | null) {
  const scope = await resolveShopifyStoreScope(supabase, organizationId, connectionId || undefined);
  if (scope.status === "ready") return { ok: true as const, storeId: scope.storeId };
  return {
    ok: false as const,
    statusCode: scope.status === "not_found" ? 404 : 409,
    error: scope.status === "not_found" ? "store_not_found" : "store_selection_required",
    message: scope.status === "not_found" ? "No encuentro esa tienda." : "Elige una tienda en la cabecera: las notas son de cada tienda.",
  };
}

/** Notas vivas (sin archivar ni caducar). El cliente solo ve las que no ha visto. */
export async function listZoneNotes(env: ApiEnv, context: AuthContext, organizationId: string, connectionId?: string | null) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const store = await storeFor(supabase, organizationId, connectionId);
  // Varias tiendas sin elegir: no hay tarjetas de una tienda que anotar.
  if (!store.ok) return { ok: true as const, data: { notes: [] as ZoneNote[] } };
  let query = supabase
    .from("zone_notes")
    .select(NOTE_COLUMNS)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(200);
  query = store.storeId ? query.eq("store_id", store.storeId) : query.is("store_id", null);
  if (!isConsultantOrAdmin(context)) query = query.is("seen_at", null);

  const { data, error } = await query;
  if (error) {
    return { ok: false as const, statusCode: 500, error: "zone_notes_load_failed", detail: error.message };
  }
  return { ok: true as const, data: { notes: (data ?? []) as ZoneNote[] } };
}

export async function createZoneNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: { anchor?: string; body?: string; expiresAt?: string | null; connectionId?: string | null },
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  if (!isConsultantOrAdmin(context)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "zone_note_denied",
      message: "Solo el consultor puede dejar notas en las tarjetas del cliente.",
    };
  }

  const anchor = input.anchor?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!ANCHOR_PATTERN.test(anchor)) {
    return { ok: false as const, statusCode: 400, error: "invalid_zone_anchor" };
  }
  if (!body || body.length > 2000) {
    return { ok: false as const, statusCode: 400, error: "invalid_zone_note_body", message: "La nota debe tener entre 1 y 2000 caracteres." };
  }
  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const time = Date.parse(input.expiresAt);
    if (!Number.isFinite(time) || time <= Date.now()) {
      return { ok: false as const, statusCode: 400, error: "invalid_zone_note_expiry", message: "La fecha de fin tiene que ser futura." };
    }
    expiresAt = new Date(time).toISOString();
  }

  const supabase = createServiceClient(env);
  const store = await storeFor(supabase, organizationId, input.connectionId);
  if (!store.ok) return store;
  // Una nota viva por tarjeta y tienda: la nueva sustituye a la anterior (vista o no).
  let replace = supabase
    .from("zone_notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("anchor", anchor)
    .is("archived_at", null);
  replace = store.storeId ? replace.eq("store_id", store.storeId) : replace.is("store_id", null);
  const { error: replaceError } = await replace;
  if (replaceError) {
    return { ok: false as const, statusCode: 500, error: "zone_note_replace_failed", detail: replaceError.message };
  }
  const { data, error } = await supabase
    .from("zone_notes")
    .insert({ organization_id: organizationId, store_id: store.storeId, anchor, body, expires_at: expiresAt, author_user_id: context.user.id })
    .select(NOTE_COLUMNS)
    .single();
  if (error || !data) {
    return { ok: false as const, statusCode: 500, error: "zone_note_create_failed", detail: error?.message };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "zone_notes.create",
    entityType: "zone_note",
    entityId: data.id,
    newData: { anchor, store_id: store.storeId, expires_at: expiresAt },
  });
  return { ok: true as const, data: data as ZoneNote };
}

/** El cliente confirma que la ha visto: deja de resaltar la tarjeta. */
export async function markZoneNoteSeen(env: ApiEnv, context: AuthContext, organizationId: string, noteId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  if (access.membership.accessSource === "consultant_assignment" || isConsultantOrAdmin(context)) {
    return { ok: false as const, statusCode: 403, error: "zone_note_seen_denied", message: "Solo el cliente marca una nota como vista." };
  }

  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("zone_notes")
    .update({ seen_at: new Date().toISOString(), seen_by: context.user.id })
    .eq("id", noteId)
    .eq("organization_id", organizationId)
    .is("seen_at", null)
    .select(NOTE_COLUMNS)
    .maybeSingle();
  if (error) {
    return { ok: false as const, statusCode: 500, error: "zone_note_update_failed", detail: error.message };
  }
  if (!data) return { ok: false as const, statusCode: 404, error: "zone_note_not_found" };
  return { ok: true as const, data: data as ZoneNote };
}

/** El consultor la retira antes de que caduque. */
export async function archiveZoneNote(env: ApiEnv, context: AuthContext, organizationId: string, noteId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  if (!isConsultantOrAdmin(context)) {
    return { ok: false as const, statusCode: 403, error: "zone_note_denied" };
  }

  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("zone_notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false as const, statusCode: 500, error: "zone_note_update_failed", detail: error.message };
  }
  if (!data) return { ok: false as const, statusCode: 404, error: "zone_note_not_found" };
  return { ok: true as const, data: { id: data.id as string } };
}

/** Para el copiloto: las notas vivas, en una linea cada una. */
export async function zoneNotesForContext(env: ApiEnv, organizationId: string, storeId?: string | null): Promise<string[]> {
  const supabase = createServiceClient(env);
  let query = supabase
    .from("zone_notes")
    .select("anchor, body, seen_at, created_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (storeId) query = query.or(`store_id.eq.${storeId},store_id.is.null`);
  const { data } = await query;
  return (data ?? []).map(
    (note) => `[${note.anchor}] ${String(note.body).replace(/\s+/g, " ").slice(0, 300)}${note.seen_at ? " (vista por el cliente)" : ""}`,
  );
}
