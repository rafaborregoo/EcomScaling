import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@e-nora/observability";
import {
  mergeNotification,
  notificationGroups,
  renderNotification,
  type NotificationData,
  type NotificationType,
} from "@e-nora/contracts";

export { listTitles, mergeLines, plural } from "@e-nora/contracts";

/**
 * Emisión de avisos (ADR-0028). El servicio que hace la acción aporta el tipo,
 * los DATOS y a quién; el texto, el destino, la entidad y la agrupación salen
 * de la plantilla del tipo (packages/contracts/src/notification-templates.ts).
 *
 * - Nunca avisa a quien hace la acción.
 * - Agrupar: si la plantilla define `merge` y la persona ya tiene un aviso SIN
 *   LEER del mismo tipo y entidad, se reescribe ese y sube arriba.
 * - Best-effort: un aviso que falla nunca tumba la acción que lo origina.
 */

const logger = createLogger("notify");

type Db = Pick<SupabaseClient, "from">;

export type NotifyInput<T extends NotificationType> = {
  type: T;
  data: NotificationData[T];
  organizationId: string | null;
  recipients: Iterable<string>;
  /** Quien hace la acción: nunca se avisa a sí mismo. */
  actorUserId?: string | null;
};

export async function notify<T extends NotificationType>(supabase: Db, input: NotifyInput<T>): Promise<number> {
  try {
    const recipients = new Set([...input.recipients].filter(Boolean));
    if (input.actorUserId) recipients.delete(input.actorUserId);
    if (recipients.size === 0) return 0;

    const rendered = renderNotification(input.type, input.data, input.organizationId);
    const row = {
      organization_id: input.organizationId,
      type: input.type,
      title: rendered.title.slice(0, 255),
      message: rendered.message,
      action_url: rendered.url,
      entity_type: rendered.entityType,
      entity_id: rendered.entityId,
    };

    const pending = [...recipients];
    if (notificationGroups(input.type) && rendered.entityId) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id, user_id, title, message")
        .eq("type", input.type)
        .eq("entity_id", rendered.entityId)
        .eq("status", "unread")
        .in("user_id", pending);
      for (const previous of (existing ?? []) as Array<{ id: string; user_id: string; title: string; message: string | null }>) {
        if (!recipients.has(previous.user_id)) continue;
        const merged = mergeNotification(input.type, input.data, previous, rendered);
        if (!merged) continue;
        const { error } = await supabase
          .from("notifications")
          .update({
            title: merged.title.slice(0, 255),
            message: merged.message,
            action_url: rendered.url,
            created_at: new Date().toISOString(),
          })
          .eq("id", previous.id);
        if (!error) recipients.delete(previous.user_id);
      }
    }
    if (recipients.size === 0) return pending.length;

    const { error } = await supabase
      .from("notifications")
      .insert([...recipients].map((userId) => ({ ...row, user_id: userId })));
    if (error) {
      logger.error("notify_insert_failed", { type: input.type, organization_id: input.organizationId, error: error.message });
      return 0;
    }
    return pending.length;
  } catch (error) {
    logger.error("notify_threw", {
      type: input.type,
      organization_id: input.organizationId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return 0;
  }
}

export async function consultantsOf(supabase: Db, organizationId: string): Promise<string[]> {
  const { data } = await supabase
    .from("consultant_assignments")
    .select("consultant_user_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  return [...new Set((data ?? []).map((row) => row.consultant_user_id as string))];
}

/** Owners y managers: quien decide en la tienda. */
export async function clientManagersOf(supabase: Db, organizationId: string): Promise<string[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role", ["owner", "manager"]);
  return (data ?? []).map((row) => row.user_id as string);
}

export async function organizationName(supabase: Db, organizationId: string): Promise<string> {
  const { data } = await supabase
    .from("organizations")
    .select("display_name")
    .eq("id", organizationId)
    .maybeSingle();
  return ((data?.display_name as string | null | undefined) ?? "").trim() || "Tu cliente";
}

/** Nombre de pila de una persona; `fallback` si no lo tiene. */
export async function firstNameOf(supabase: Db, userId: string, fallback: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const full = ((data?.full_name as string | null | undefined) ?? "").trim();
  return full ? full.split(/\s+/)[0]! : fallback;
}



