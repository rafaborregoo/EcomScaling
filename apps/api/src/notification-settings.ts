import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@e-nora/contracts";

/**
 * Preferencias de aviso de cada persona: por categoría, campana sí/no y email
 * (al momento, en el resumen, nunca); y sus ajustes de resumen y silencio.
 * La campana la filtra el trigger `private.skip_muted_notification`; el email,
 * `notification-email.ts`. Ver 20261219110000.
 */

type ApiEnv = LoadedApiEnv;

// Tipos y categorías viven en el catálogo (packages/contracts/notification-catalog.ts).
export { NOTIFICATION_CATEGORIES, notificationCategory, type NotificationCategory } from "@e-nora/contracts";

export const EMAIL_MODES = ["instant", "digest", "off"] as const;
export type EmailMode = (typeof EMAIL_MODES)[number];

/** Sin fila guardada: lo urgente llega al momento, el resto en el resumen. */
export const DEFAULT_EMAIL: Record<NotificationCategory, EmailMode> = {
  alert_critical: "instant",
  alert: "digest",
  task_assigned: "digest",
  message: "instant",
  campaign_review: "digest",
  integration: "instant",
  client: "digest",
  other: "off",
};

export type NotificationSettings = {
  digest_frequency: "daily" | "weekly" | "never";
  digest_weekday: number;
  digest_hour: number;
  timezone: string;
  quiet_enabled: boolean;
  quiet_from: number;
  quiet_to: number;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  digest_frequency: "weekly",
  digest_weekday: 1,
  digest_hour: 8,
  timezone: "Europe/Madrid",
  quiet_enabled: false,
  quiet_from: 21,
  quiet_to: 8,
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function categoriesFor(context: AuthContext): NotificationCategory[] {
  const isStaff = ["consultant", "platform_admin"].includes(context.profile.platform_role);
  // «Clientes» (altas y cambios de permisos) solo le llega al consultor.
  return NOTIFICATION_CATEGORIES.filter((category) => isStaff || category !== "client");
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function getNotificationSettings(env: ApiEnv, context: AuthContext) {
  const supabase = createServiceClient(env);
  const [prefs, settings] = await Promise.all([
    supabase.from("notification_preferences").select("category, in_app, email").eq("user_id", context.user.id),
    supabase.from("notification_settings").select("*").eq("user_id", context.user.id).maybeSingle(),
  ]);
  if (prefs.error || settings.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "notification_settings_load_failed",
      detail: prefs.error?.message ?? settings.error?.message,
    };
  }
  const byCategory = new Map((prefs.data ?? []).map((row) => [row.category as string, row]));
  const row = (settings.data ?? {}) as Partial<NotificationSettings>;
  return {
    ok: true as const,
    data: {
      preferences: categoriesFor(context).map((category) => ({
        category,
        in_app: (byCategory.get(category)?.in_app as boolean | undefined) ?? true,
        email: (byCategory.get(category)?.email as EmailMode | undefined) ?? DEFAULT_EMAIL[category],
      })),
      settings: {
        digest_frequency: row.digest_frequency ?? DEFAULT_SETTINGS.digest_frequency,
        digest_weekday: row.digest_weekday ?? DEFAULT_SETTINGS.digest_weekday,
        digest_hour: row.digest_hour ?? DEFAULT_SETTINGS.digest_hour,
        timezone: row.timezone ?? DEFAULT_SETTINGS.timezone,
        quiet_enabled: row.quiet_enabled ?? DEFAULT_SETTINGS.quiet_enabled,
        quiet_from: row.quiet_from ?? DEFAULT_SETTINGS.quiet_from,
        quiet_to: row.quiet_to ?? DEFAULT_SETTINGS.quiet_to,
      } satisfies NotificationSettings,
      email: context.user.email ?? null,
    },
  };
}

const hour = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 23 ? (value as number) : undefined);

export async function setNotificationSettings(
  env: ApiEnv,
  context: AuthContext,
  body: {
    preferences?: Array<{ category?: unknown; in_app?: unknown; email?: unknown }>;
    settings?: Partial<Record<keyof NotificationSettings, unknown>>;
  },
) {
  const supabase = createServiceClient(env);
  const allowed = categoriesFor(context);

  if (Array.isArray(body.preferences) && body.preferences.length > 0) {
    const current = await getNotificationSettings(env, context);
    if (!current.ok) return current;
    const byCategory = new Map(current.data.preferences.map((pref) => [pref.category, pref]));
    const rows = [];
    for (const pref of body.preferences) {
      const category = pref.category as NotificationCategory;
      const base = byCategory.get(category);
      if (!allowed.includes(category) || !base) {
        return { ok: false as const, statusCode: 400, error: "invalid_category" };
      }
      if (pref.email !== undefined && !EMAIL_MODES.includes(pref.email as EmailMode)) {
        return { ok: false as const, statusCode: 400, error: "invalid_email_mode" };
      }
      rows.push({
        user_id: context.user.id,
        category,
        in_app: typeof pref.in_app === "boolean" ? pref.in_app : base.in_app,
        email: (pref.email as EmailMode | undefined) ?? base.email,
        updated_at: new Date().toISOString(),
      });
    }
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(rows, { onConflict: "user_id,category" });
    if (error) {
      return { ok: false as const, statusCode: 500, error: "notification_preferences_save_failed", detail: error.message };
    }
  }

  if (body.settings) {
    const input = body.settings;
    const patch: Partial<NotificationSettings> = {};
    if (input.digest_frequency !== undefined) {
      if (!["daily", "weekly", "never"].includes(input.digest_frequency as string)) {
        return { ok: false as const, statusCode: 400, error: "invalid_digest_frequency" };
      }
      patch.digest_frequency = input.digest_frequency as NotificationSettings["digest_frequency"];
    }
    if (input.digest_weekday !== undefined) {
      const weekday = input.digest_weekday as number;
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
        return { ok: false as const, statusCode: 400, error: "invalid_digest_weekday" };
      }
      patch.digest_weekday = weekday;
    }
    for (const key of ["digest_hour", "quiet_from", "quiet_to"] as const) {
      if (input[key] === undefined) continue;
      const value = hour(input[key]);
      if (value === undefined) return { ok: false as const, statusCode: 400, error: `invalid_${key}` };
      patch[key] = value;
    }
    if (input.quiet_enabled !== undefined) {
      if (typeof input.quiet_enabled !== "boolean") {
        return { ok: false as const, statusCode: 400, error: "invalid_quiet_enabled" };
      }
      patch.quiet_enabled = input.quiet_enabled;
    }
    if (input.timezone !== undefined) {
      if (!isValidTimeZone(input.timezone)) return { ok: false as const, statusCode: 400, error: "invalid_timezone" };
      patch.timezone = input.timezone;
    }
    const { error } = await supabase
      .from("notification_settings")
      .upsert({ user_id: context.user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      return { ok: false as const, statusCode: 500, error: "notification_settings_save_failed", detail: error.message };
    }
  }

  return getNotificationSettings(env, context);
}
