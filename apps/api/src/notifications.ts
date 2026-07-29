import { createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

/** RLS (`notifications_select_own`/`_update_own`) ya filtra por
 * `user_id = auth.uid()` -- no hace falta chequeo de organizacion aqui, el
 * cliente user-scoped es suficiente y evita duplicar esa regla en Node. */
export async function listNotifications(
  env: ApiEnv,
  authorization: string,
  statusFilter: string | undefined,
) {
  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  let query = supabase
    .from("notifications")
    .select("id, organization_id, type, title, message, action_url, entity_type, entity_id, status, read_at, archived_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (statusFilter === "unread") {
    query = query.eq("status", "unread");
  } else if (statusFilter !== "all") {
    // Por defecto se ocultan las archivadas -- "todas" es el unico caso que las incluye.
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false as const, statusCode: 500, error: "notifications_load_failed", detail: error.message };
  }

  const { count: unreadCount, error: countError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread");

  if (countError) {
    return { ok: false as const, statusCode: 500, error: "notifications_count_failed", detail: countError.message };
  }

  return { ok: true as const, data: { notifications: data ?? [], unread_count: unreadCount ?? 0 } };
}

const NOTIFICATION_STATUSES = ["unread", "read", "archived"];

export async function updateNotificationStatus(
  env: ApiEnv,
  authorization: string,
  notificationId: string,
  statusInput: string | undefined,
) {
  if (!statusInput || !NOTIFICATION_STATUSES.includes(statusInput)) {
    return { ok: false as const, statusCode: 400, error: "invalid_notification_status" };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { status: statusInput };
  if (statusInput === "read") {
    patch.read_at = now;
  } else if (statusInput === "archived") {
    patch.archived_at = now;
  }

  // RLS (notifications_update_own) ya limita el update a las notificaciones
  // del propio usuario; el filtro por id aqui solo acota la fila objetivo.
  const { data, error } = await supabase
    .from("notifications")
    .update(patch)
    .eq("id", notificationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "notification_update_failed", detail: error.message };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "notification_not_found" };
  }

  return { ok: true as const, data: { id: data.id, status: statusInput } };
}

export async function markAllNotificationsRead(env: ApiEnv, authorization: string) {
  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: now })
    .eq("status", "unread");

  if (error) {
    return { ok: false as const, statusCode: 500, error: "notifications_mark_all_read_failed", detail: error.message };
  }

  return { ok: true as const, data: { ok: true } };
}
