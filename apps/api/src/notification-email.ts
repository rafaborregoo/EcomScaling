import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import {
  DEFAULT_EMAIL,
  DEFAULT_SETTINGS,
  type EmailMode,
  type NotificationCategory,
  type NotificationSettings,
  notificationCategory,
} from "./notification-settings.js";

/**
 * Avisos por email. El worker llama cada 10 minutos
 * (`/v1/internal/notifications/email-tick`):
 * - «Al momento»: sale en la siguiente pasada, salvo en horario de silencio
 *   (las alertas críticas lo saltan; el resto espera a que acabe).
 * - «En el resumen»: se junta y sale a la hora y el día que eligió la persona.
 * - «Nunca»: se marca como decidido para no volver a mirarlo.
 * `notifications.email_sent_at` = ya se decidió su email (enviado o descartado).
 */

type ApiEnv = LoadedApiEnv;
const logger = createLogger("notification-email");
const LOOKBACK_MS = 8 * 86_400_000; // el resumen semanal + un día de margen

type PendingRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  action_url: string | null;
  status: string;
  created_at: string;
};

export function localClock(now: Date, timeZone: string): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const hourPart = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekdayName) + 1;
  return { hour: hourPart, weekday };
}

export function isQuietHour(hourNow: number, settings: Pick<NotificationSettings, "quiet_enabled" | "quiet_from" | "quiet_to">) {
  if (!settings.quiet_enabled || settings.quiet_from === settings.quiet_to) return false;
  return settings.quiet_from > settings.quiet_to
    ? hourNow >= settings.quiet_from || hourNow < settings.quiet_to
    : hourNow >= settings.quiet_from && hourNow < settings.quiet_to;
}

export function isDigestDue(
  clock: { hour: number; weekday: number },
  settings: Pick<NotificationSettings, "digest_frequency" | "digest_hour" | "digest_weekday">,
  lastDigestAt: Date | null,
  now: Date,
) {
  if (settings.digest_frequency === "never" || clock.hour !== settings.digest_hour) return false;
  if (settings.digest_frequency === "weekly" && clock.weekday !== settings.digest_weekday) return false;
  // El tick corre varias veces dentro de la misma hora: una sola vez.
  return !lastDigestAt || now.getTime() - lastDigestAt.getTime() > 20 * 3_600_000;
}

/** Qué hacer con cada aviso pendiente de una persona en esta pasada. */
export function planUserEmails(
  rows: PendingRow[],
  modeFor: (category: NotificationCategory) => EmailMode,
  quiet: boolean,
  digestDue: boolean,
) {
  const instant: PendingRow[] = [];
  const digest: PendingRow[] = [];
  const discard: PendingRow[] = [];
  for (const row of rows) {
    const category = notificationCategory(row.type);
    const mode = modeFor(category);
    if (mode === "off") discard.push(row);
    else if (mode === "instant") {
      if (!quiet || category === "alert_critical") instant.push(row);
    } else if (digestDue) {
      // Lo ya leído en la campana no hace falta repetirlo por email.
      if (row.status === "unread") digest.push(row);
      else discard.push(row);
    }
  }
  return { instant, digest, discard };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderNotificationEmail(rows: PendingRow[], kind: "instant" | "digest", webOrigin: string) {
  const link = (row: PendingRow) => `${webOrigin}${row.action_url?.startsWith("/") ? row.action_url : "/dashboard"}`;
  const subject =
    kind === "digest"
      ? `Resumen de E-NORA: ${rows.length} ${rows.length === 1 ? "aviso" : "avisos"}`
      : rows.length === 1
        ? rows[0]!.title
        : `${rows.length} avisos nuevos en E-NORA`;
  const text = [
    kind === "digest" ? "Lo que ha pasado desde el último resumen:" : "",
    ...rows.map((row) => `- ${row.title}${row.message ? `: ${row.message}` : ""}\n  ${link(row)}`),
    "",
    `Cambia qué te llega en ${webOrigin}/configuracion?section=notificaciones`,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#111827;max-width:560px">
${kind === "digest" ? `<h2 style="margin:0 0 16px;font-size:20px">Lo que ha pasado</h2>` : ""}
${rows
  .map(
    (row) => `<div style="padding:12px 0;border-bottom:1px solid #e5e7eb">
<a href="${escapeHtml(link(row))}" style="color:#111827;font-weight:600;text-decoration:none">${escapeHtml(row.title)}</a>
${row.message ? `<p style="margin:4px 0 0;color:#4b5563;font-size:14px">${escapeHtml(row.message)}</p>` : ""}
</div>`,
  )
  .join("\n")}
<p style="margin:16px 0 0;color:#6b7280;font-size:12px"><a href="${escapeHtml(`${webOrigin}/configuracion?section=notificaciones`)}" style="color:#6b7280">Cambia qué te llega por email</a></p>
</div>`;
  return { subject, text, html };
}

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export async function runNotificationEmails(env: ApiEnv, now = new Date()) {
  if (!env.SMTP_USER || !env.SMTP_BREVO) return { status: "skipped" as const, reason: "smtp_not_configured" };
  const supabase = createServiceClient(env);
  const webOrigin = (env.WEB_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "");
  const port = env.SMTP_PORT ?? 587;
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST ?? "smtp-relay.brevo.com",
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: { user: env.SMTP_USER, pass: env.SMTP_BREVO },
  });
  const from = `"${(env.SMTP_FROM_NAME ?? "E-NORA").replaceAll('"', "")}" <${env.SMTP_FROM_EMAIL ?? env.SMTP_USER}>`;

  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, message, action_url, status, created_at")
    .is("email_sent_at", null)
    .gt("created_at", new Date(now.getTime() - LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: true })
    // ponytail: los avisos «en el resumen» esperan sin marcar hasta su hora; con
    // más de 2000 pendientes en 8 días, los más nuevos (y sus «al momento») no
    // entran en la pasada. Hoy son unos pocos por semana; si crece, paginar por persona.
    .limit(2000);
  if (error) throw new Error(`notification_email_load_failed: ${error.message}`);

  const byUser = new Map<string, PendingRow[]>();
  for (const row of (pending ?? []) as PendingRow[]) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  }
  const userIds = [...byUser.keys()];
  if (userIds.length === 0) return { status: "ok" as const, users: 0, sent: 0, failed: 0 };

  const [{ data: prefRows }, { data: settingRows }, { data: profiles }] = await Promise.all([
    supabase.from("notification_preferences").select("user_id, category, email").in("user_id", userIds),
    supabase.from("notification_settings").select("*").in("user_id", userIds),
    supabase.from("profiles").select("id, is_active").in("id", userIds),
  ]);
  const activeIds = new Set((profiles ?? []).filter((row) => row.is_active).map((row) => row.id as string));

  let sent = 0;
  let failed = 0;
  for (const [userId, rows] of byUser) {
    const settingsRow = (settingRows ?? []).find((row) => row.user_id === userId) as
      | (NotificationSettings & { last_digest_at: string | null })
      | undefined;
    const settings = { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) };
    const modeFor = (category: NotificationCategory) =>
      ((prefRows ?? []).find((row) => row.user_id === userId && row.category === category)?.email as
        | EmailMode
        | undefined) ?? DEFAULT_EMAIL[category];
    const clock = localClock(now, settings.timezone);
    const digestDue = isDigestDue(clock, settings, settingsRow?.last_digest_at ? new Date(settingsRow.last_digest_at) : null, now);
    const plan = planUserEmails(rows, modeFor, isQuietHour(clock.hour, settings), digestDue);

    const done: string[] = plan.discard.map((row) => row.id);
    if (activeIds.has(userId) && (plan.instant.length > 0 || plan.digest.length > 0)) {
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      const to = user?.user?.email;
      for (const [kind, batch] of [
        ["instant", plan.instant],
        ["digest", plan.digest],
      ] as const) {
        if (batch.length === 0 || !to) continue;
        try {
          await transporter.sendMail({ from, to, ...renderNotificationEmail(batch, kind, webOrigin) });
          done.push(...batch.map((row) => row.id));
          sent += 1;
        } catch (sendError) {
          failed += 1;
          logger.error("notification_email_send_failed", {
            user_id: userId,
            kind,
            error: sendError instanceof Error ? sendError.message : String(sendError),
          });
        }
      }
      if (!to) done.push(...plan.instant.map((row) => row.id), ...plan.digest.map((row) => row.id));
    } else if (!activeIds.has(userId)) {
      done.push(...plan.instant.map((row) => row.id), ...plan.digest.map((row) => row.id));
    }

    if (done.length > 0) {
      await supabase.from("notifications").update({ email_sent_at: now.toISOString() }).in("id", done);
    }
    if (digestDue) {
      await supabase
        .from("notification_settings")
        .upsert({ user_id: userId, last_digest_at: now.toISOString() }, { onConflict: "user_id" });
    }
  }

  return { status: "ok" as const, users: userIds.length, sent, failed };
}
