import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const DEFAULT_RETENTION_DAYS = 180;
// AI-30: los eventos de seguridad viven mas que el contexto. 400 dias permite
// comparar un incidente con el mismo periodo del ano anterior, que es la
// ventana minima para distinguir un ataque de un pico estacional.
const DEFAULT_SECURITY_RETENTION_DAYS = 400;
const DEFAULT_BATCH_LIMIT = 1_000;
// AI-30: a partir de cuando una ejecucion en `running` esta muerta y no lenta.
// El turno mas largo observado en produccion fue de 8,5 minutos; el techo
// teorico son 16 llamadas al modelo con timeout de 45 s. 30 minutos deja margen
// de sobra para no cerrar a un agente que sigue trabajando.
const DEFAULT_STALLED_RUN_MINUTES = 30;

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

/**
 * AI-30: momento a partir del cual una ejecucion en `running` se considera
 * colgada y no lenta.
 *
 * Se valida el rango porque un umbral demasiado corto es destructivo: cerraria
 * como `timeout` ejecuciones que siguen vivas, y el panel diria que fallaron
 * cuando en realidad terminaron bien.
 */
export function stalledAgentRunCutoff(
  now = new Date(),
  stalledMinutes = DEFAULT_STALLED_RUN_MINUTES,
) {
  if (
    !Number.isInteger(stalledMinutes) ||
    stalledMinutes < 15 ||
    stalledMinutes > 1440
  ) {
    throw new Error("ai_stalled_run_minutes_out_of_range");
  }
  return new Date(now.getTime() - stalledMinutes * 60 * 1000);
}

export async function purgeExpiredAiContext(
  env: ApiEnv,
  options: {
    now?: Date;
    retentionDays?: number;
    securityRetentionDays?: number;
    stalledRunMinutes?: number;
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

  // AI-30: cerrar las ejecuciones que se quedaron en `running`. Va en esta
  // misma pasada y no en un job propio porque el coste es una llamada y el
  // criterio de frecuencia es el mismo: nada de esto es urgente, solo tiene que
  // pasar sin que nadie se acuerde.
  //
  // Su fallo NO tumba la purga: la retencion es una obligacion de privacidad y
  // limpiar filas colgadas es higiene del panel. Si hay que sacrificar una, no
  // es la retencion.
  const stalledCutoff = stalledAgentRunCutoff(
    options.now,
    options.stalledRunMinutes,
  );
  let reapedData: Record<string, number> = {};
  const { data: reaped, error: reapError } = await client
    .schema("private")
    .rpc("reap_stalled_agent_runs", {
      p_before: stalledCutoff.toISOString(),
      p_limit: limit,
    });
  if (reapError) {
    console.error("ai_stalled_agent_runs_reap_failed", reapError.message);
  } else {
    reapedData = (reaped as Record<string, number>) ?? {};
  }

  return {
    ...(data as Record<string, number>),
    ...(securityData as Record<string, number>),
    ...reapedData,
    stalledRunCutoff: stalledCutoff.toISOString(),
    cutoff: cutoff.toISOString(),
    retentionDays: options.retentionDays ?? DEFAULT_RETENTION_DAYS,
    securityCutoff: securityCutoff.toISOString(),
    securityRetentionDays:
      options.securityRetentionDays ?? DEFAULT_SECURITY_RETENTION_DAYS,
  };
}
