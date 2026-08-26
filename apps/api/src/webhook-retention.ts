import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const DEFAULT_RETENTION_DAYS = 30;
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

export function webhookRetentionCutoff(
  now = new Date(),
  retentionDays = DEFAULT_RETENTION_DAYS,
) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error("webhook_retention_days_out_of_range");
  }
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export async function purgeProcessedWebhookEvents(
  env: ApiEnv,
  options: { now?: Date; retentionDays?: number; limit?: number } = {},
) {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error("webhook_retention_limit_out_of_range");
  }

  const cutoff = webhookRetentionCutoff(options.now, options.retentionDays);
  const client = createServiceClient(env);
  const { data, error } = await client.schema("private").rpc(
    "purge_processed_webhook_events",
    { p_before: cutoff.toISOString(), p_limit: limit },
  );
  if (error) throw new Error(`webhook_retention_purge_failed:${error.message}`);

  return {
    deleted: typeof data === "number" ? data : Number(data ?? 0),
    cutoff: cutoff.toISOString(),
    retentionDays: options.retentionDays ?? DEFAULT_RETENTION_DAYS,
  };
}
