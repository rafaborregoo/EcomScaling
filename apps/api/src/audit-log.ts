import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@ecomscaling/observability";

const logger = createLogger("audit-log");

/**
 * SQO-03/R-013: `public.audit_logs` existe en el esquema desde DB-02 pero
 * ningun endpoint escribia en ella -- una tabla de auditoria vacia. Este
 * helper es el unico punto de escritura, para no repetir la forma del insert
 * en cada endpoint sensible. Nunca lanza: un fallo al auditar no debe romper
 * la operacion que se esta auditando, solo queda registrado por logger.
 */
export async function recordAuditLog(
  supabase: SupabaseClient,
  entry: {
    organizationId: string | null;
    actorUserId: string | null;
    action: string;
    entityType?: string;
    entityId?: string | null;
    oldData?: unknown;
    newData?: unknown;
    requestId?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: entry.organizationId,
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
    request_id: entry.requestId ?? null,
  });

  if (error) {
    logger.error("audit_log_insert_failed", { action: entry.action, error: error.message });
  }
}
