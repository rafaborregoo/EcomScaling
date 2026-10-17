import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import type { AuthContext } from "./auth-context.js";
import { isQuietHour, localClock } from "./notification-email.js";
import { DEFAULT_SETTINGS, type NotificationSettings } from "./notification-settings.js";

/**
 * Push a la app móvil. Reutiliza `notifications` (la campana): lo que ya avisa
 * allí llega también al móvil, sin reglas nuevas. El worker llama cada 2 minutos
 * (`/v1/internal/notifications/push-tick`). `notifications.push_sent_at` = ya se
 * decidió su push (enviado o descartado). Los avisos de más de 1 h no se envían:
 * un push tardío es ruido. En horario de silencio solo pasan las alertas críticas.
 */

type ApiEnv = LoadedApiEnv;
const logger = createLogger("mobile-push");
const LOOKBACK_MS = 3_600_000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH = 100;

type PendingRow = { id: string; user_id: string; type: string; title: string; message: string | null; created_at: string };
export type PushMessage = { to: string; title: string; body: string; sound: "default"; priority: "high"; data: { notificationId: string; type: string } };

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const isExpoToken = (token: unknown): token is string => typeof token === "string" && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);

export async function registerPushToken(env: ApiEnv, context: AuthContext, body: { token?: unknown; platform?: unknown }) {
  if (!isExpoToken(body.token)) return { ok: false as const, statusCode: 400, error: "invalid_push_token" };
  const platform = body.platform === "android" ? "android" : "ios";
  const { error } = await createServiceClient(env)
    .from("mobile_push_tokens")
    .upsert({ token: body.token, user_id: context.user.id, platform, last_seen_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) return { ok: false as const, statusCode: 500, error: "push_token_save_failed" };
  return { ok: true as const, data: { ok: true } };
}

// Solo borra el token si es de quien lo pide: nadie puede desregistrar el dispositivo de otra persona.
export async function removePushToken(env: ApiEnv, context: AuthContext, body: { token?: unknown }) {
  if (!isExpoToken(body.token)) return { ok: false as const, statusCode: 400, error: "invalid_push_token" };
  await createServiceClient(env).from("mobile_push_tokens").delete().eq("token", body.token).eq("user_id", context.user.id);
  return { ok: true as const, data: { ok: true } };
}

/** Un mensaje por aviso y dispositivo. Función pura para poder probarla sin red. */
export function buildPushMessages(rows: PendingRow[], tokensByUser: Map<string, string[]>, quietUsers: Set<string>): PushMessage[] {
  const out: PushMessage[] = [];
  for (const row of rows) {
    if (quietUsers.has(row.user_id) && row.type !== "alert_critical") continue;
    for (const to of tokensByUser.get(row.user_id) ?? []) {
      out.push({ to, title: row.title, body: row.message ?? "", sound: "default", priority: "high", data: { notificationId: row.id, type: row.type } });
    }
  }
  return out;
}

export async function runMobilePush(env: ApiEnv, now = new Date()) {
  const supabase = createServiceClient(env);
  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, message, created_at")
    .is("push_sent_at", null)
    .gt("created_at", new Date(now.getTime() - LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`mobile_push_load_failed: ${error.message}`);
  const rows = (pending ?? []) as PendingRow[];
  if (rows.length === 0) return { status: "ok" as const, notifications: 0, sent: 0 };

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const [{ data: tokenRows }, { data: settingRows }] = await Promise.all([
    supabase.from("mobile_push_tokens").select("token, user_id").in("user_id", userIds),
    supabase.from("notification_settings").select("user_id, timezone, quiet_enabled, quiet_from, quiet_to").in("user_id", userIds),
  ]);

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows ?? []) tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.token]);
  const quietUsers = new Set<string>();
  for (const userId of userIds) {
    const settings = { ...DEFAULT_SETTINGS, ...((settingRows ?? []).find((row) => row.user_id === userId) as Partial<NotificationSettings> | undefined) };
    if (isQuietHour(localClock(now, settings.timezone).hour, settings)) quietUsers.add(userId);
  }

  const messages = buildPushMessages(rows, tokensByUser, quietUsers);
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await response.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
      (json.data ?? []).forEach((ticket, index) => {
        if (ticket.status === "ok") sent += 1;
        else if (ticket.details?.error === "DeviceNotRegistered" && batch[index]) dead.push(batch[index].to);
      });
    } catch (sendError) {
      logger.error("mobile_push_send_failed", { error: sendError instanceof Error ? sendError.message : String(sendError) });
    }
  }
  if (dead.length > 0) await supabase.from("mobile_push_tokens").delete().in("token", dead);
  // ponytail: si Expo falla, el aviso se da por decidido igual (el reintento llegaría tarde); reintentar con backoff si molesta.
  await supabase.from("notifications").update({ push_sent_at: now.toISOString() }).in("id", rows.map((row) => row.id));

  return { status: "ok" as const, notifications: rows.length, sent };
}
