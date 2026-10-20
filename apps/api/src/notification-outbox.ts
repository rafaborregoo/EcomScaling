import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { clientManagersOf, consultantsOf, notify } from "./notify.js";

/**
 * Eventos que nacen en la base de datos (ADR-0028): un trigger o una función
 * SQL no escribe avisos, deja un evento en `private.notification_outbox`. Esto
 * los recoge cada minuto (worker `notification-outbox`) y los emite con
 * `notify()`, igual que cualquier otro aviso: plantilla, agrupación y destino.
 */

type ApiEnv = LoadedApiEnv;
const logger = createLogger("notification-outbox");

type OutboxRow = {
  id: number;
  type: string;
  organization_id: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export async function runNotificationOutbox(env: ApiEnv) {
  const supabase = createServiceClient(env);
  const { data, error } = await supabase.schema("private").rpc("take_notification_outbox", { p_limit: 200 });
  if (error) throw new Error(`notification_outbox_take_failed: ${error.message}`);
  const rows = (data ?? []) as OutboxRow[];

  let emitted = 0;
  for (const row of rows) {
    try {
      // Una integración afecta a quien decide en la tienda y a su consultor.
      const recipients = new Set([
        ...(await clientManagersOf(supabase, row.organization_id)),
        ...(await consultantsOf(supabase, row.organization_id)),
      ]);
      const payload = row.payload ?? {};
      if (row.type === "integration_error" && row.entity_id) {
        emitted += await notify(supabase, {
          type: "integration_error",
          organizationId: row.organization_id,
          recipients,
          data: { connectionId: row.entity_id, provider: str(payload.provider) ?? "integración", accountName: str(payload.account_name) },
        });
      } else if (row.type === "integration_expiring" && row.entity_id && str(payload.expires_at)) {
        emitted += await notify(supabase, {
          type: "integration_expiring",
          organizationId: row.organization_id,
          recipients,
          data: {
            connectionId: row.entity_id,
            provider: str(payload.provider) ?? "meta_ads",
            accountName: str(payload.account_name),
            expiresAt: str(payload.expires_at)!,
          },
        });
      } else {
        logger.error("notification_outbox_unknown_event", { id: row.id, type: row.type });
      }
    } catch (rowError) {
      logger.error("notification_outbox_event_failed", {
        id: row.id,
        type: row.type,
        error: rowError instanceof Error ? rowError.message : String(rowError),
      });
    }
  }
  return { status: "ok" as const, events: rows.length, notified: emitted };
}
