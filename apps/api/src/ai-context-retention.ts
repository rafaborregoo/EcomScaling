import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const DEFAULT_RETENTION_DAYS = 180;
// AI-30: los eventos de seguridad viven mas que el contexto. 400 dias permite
// comparar un incidente con el mismo periodo del ano anterior, que es la
// ventana minima para distinguir un ataque de un pico estacional.
const DEFAULT_SECURITY_RETENTION_DAYS = 400;
const DEFAULT_BATCH_LIMIT = 1_000;

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export function aiContextRetentionCutoff(
  now = new Date(),
  retentionDays = DEFAULT_RETENTION_DAYS,
) {
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 30 ||
    retentionDays > 3650
  ) {
    throw new Error("ai_context_retention_days_out_of_range");
  }
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function aiSecurityEventRetentionCutoff(
  now = new Date(),
  retentionDays = DEFAULT_SECURITY_RETENTION_DAYS,
) {
  // El minimo es el horizonte del contexto: unos eventos de seguridad que
  // caducan antes que la evidencia operativa que explican no sirven de nada.
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < DEFAULT_RETENTION_DAYS ||
    retentionDays > 3650
  ) {
    throw new Error("ai_security_event_retention_days_out_of_range");
  }
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export async function purgeExpiredAiContext(
  env: ApiEnv,
  options: {
    now?: Date;
    retentionDays?: number;
    securityRetentionDays?: number;
    limit?: number;
  } = {},
) {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error("ai_context_retention_limit_out_of_range");
  }

  const cutoff = aiContextRetentionCutoff(options.now, options.retentionDays);
  const client = createServiceClient(env);
  const { data, error } = await client
    .schema("private")
    .rpc("purge_expired_ai_context", {
      p_before: cutoff.toISOString(),
      p_limit: limit,
    });
  if (error)
    throw new Error(`ai_context_retention_purge_failed:${error.message}`);

  // AI-30: los eventos de seguridad tienen su propio horizonte, mas largo. Van
  // en la misma pasada del cron para no anadir un job, pero con su cutoff: un
  // patron de ataque se ve comparando meses, y borrarlos junto con el contexto
  // operativo dejaria el analisis ciego justo donde hace falta memoria larga.
  const securityCutoff = aiSecurityEventRetentionCutoff(
    options.now,
    options.securityRetentionDays,
  );
  const { data: securityData, error: securityError } = await client
    .schema("private")
    .rpc("purge_expired_ai_security_events", {
      p_before: securityCutoff.toISOString(),
      p_limit: limit,
    });
  if (securityError) {
    throw new Error(
      `ai_security_events_retention_purge_failed:${securityError.message}`,
    );
  }

  return {
    ...(data as Record<string, number>),
    ...(securityData as Record<string, number>),
    cutoff: cutoff.toISOString(),
    retentionDays: options.retentionDays ?? DEFAULT_RETENTION_DAYS,
    securityCutoff: securityCutoff.toISOString(),
    securityRetentionDays:
      options.securityRetentionDays ?? DEFAULT_SECURITY_RETENTION_DAYS,
  };
}
