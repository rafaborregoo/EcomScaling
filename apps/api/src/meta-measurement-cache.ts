import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMetaMeasurementStatus,
  META_MEASUREMENT_VERDICT_VERSION,
  META_MEASUREMENT_SOURCE_MAX_AGE_MS,
  unknownMetaMeasurementVerdict,
} from "./meta-measurement-verdict.js";

export const META_MEASUREMENT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Read the same scoped, versioned gate for specialists and consultant tools. */
export async function loadMetaMeasurementVerdict(
  supabase: SupabaseClient,
  organizationId: string,
  storeId: string | null,
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
) {
  if (!storeId) return unknownMetaMeasurementVerdict("store_scope_missing");
  if (![periodStart, periodEnd, now].every((date) => Number.isFinite(date.getTime())) || periodStart > periodEnd)
    return unknownMetaMeasurementVerdict("invalid_measurement_window");
  const start = periodStart.toISOString().slice(0, 10);
  const end = periodEnd.toISOString().slice(0, 10);
  const db = supabase as SupabaseClient<any>;
  const { data, error } = await db
    .from("meta_measurement_verdict_cache")
    .select("verdict, verdict_status, verdict_version, evaluated_at, expires_at, source_fingerprint")
    .eq("organization_id", organizationId)
    .eq("store_id", storeId)
    .eq("period_start", start)
    .eq("period_end", end)
    .eq("verdict_version", META_MEASUREMENT_VERDICT_VERSION)
    .gt("expires_at", now.toISOString())
    .lte("evaluated_at", now.toISOString())
    .maybeSingle();
  const evaluatedAt = typeof data?.evaluated_at === "string" ? Date.parse(data.evaluated_at) : NaN;
  const expiresAt = typeof data?.expires_at === "string" ? Date.parse(data.expires_at) : NaN;
  if (
    error || !data || data.verdict_version !== META_MEASUREMENT_VERDICT_VERSION ||
    typeof data.source_fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(data.source_fingerprint) ||
    !Number.isFinite(evaluatedAt) || !Number.isFinite(expiresAt) ||
    evaluatedAt > now.getTime() || expiresAt <= now.getTime() || expiresAt <= evaluatedAt ||
    expiresAt - evaluatedAt > META_MEASUREMENT_CACHE_TTL_MS ||
    !data.verdict || typeof data.verdict !== "object" || Array.isArray(data.verdict)
  ) return unknownMetaMeasurementVerdict("fresh_verdict_unavailable");

  const verdict = data.verdict as Record<string, unknown>;
  const status = data.verdict_status;
  const currentAccounts = await db.from("meta_ad_accounts").select("id, connection_id, last_synced_at")
    .eq("organization_id", organizationId).eq("store_id", storeId)
    .eq("is_active", true).eq("is_selected", true).order("id");
  const scope = verdict.scope && typeof verdict.scope === "object" && !Array.isArray(verdict.scope)
    ? verdict.scope as Record<string, unknown> : {};
  const window = verdict.window && typeof verdict.window === "object" && !Array.isArray(verdict.window)
    ? verdict.window as Record<string, unknown> : {};
  const cachedIds = Array.isArray(scope.account_ids) ? scope.account_ids : [];
  const selectedIds = (currentAccounts.data ?? []).map((row: { id: string }) => row.id).sort();
  if (
    currentAccounts.error || !isMetaMeasurementStatus(status) || verdict.status !== status ||
    scope.organization_id !== organizationId || scope.store_id !== storeId ||
    !cachedIds.length || cachedIds.some((id) => typeof id !== "string" || !id) ||
    new Set(cachedIds).size !== cachedIds.length || !selectedIds.length ||
    JSON.stringify([...cachedIds].sort()) !== JSON.stringify(selectedIds) ||
    window.start !== start || window.end !== end || window.timezone !== "UTC" || window.complete_days !== true
  ) return unknownMetaMeasurementVerdict("scope_or_payload_changed");

  const sourceIsUnchangedAndFresh = (value: unknown) => {
    const syncedAt = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(syncedAt) && syncedAt <= evaluatedAt &&
      now.getTime() - syncedAt <= META_MEASUREMENT_SOURCE_MAX_AGE_MS;
  };
  const accounts = currentAccounts.data as Array<{ connection_id: string | null; last_synced_at: string | null }>;
  if (accounts.some((account) => !account.connection_id || !sourceIsUnchangedAndFresh(account.last_synced_at)))
    return unknownMetaMeasurementVerdict("sources_changed_or_unavailable");
  const connectionIds = [...new Set(accounts.map((account) => account.connection_id))];
  const connections = await db.from("integration_connections")
    .select("id, provider, status, last_sync_at, last_error_at")
    .eq("organization_id", organizationId).in("id", connectionIds).order("id");
  if (
    connections.error || connections.data?.length !== connectionIds.length ||
    connections.data.some((connection: { provider: string; status: string; last_sync_at: string | null; last_error_at: string | null }) => {
      const errorAt = connection.last_error_at === null ? null : Date.parse(connection.last_error_at);
      return connection.provider !== "meta_ads" || connection.status !== "connected" || !sourceIsUnchangedAndFresh(connection.last_sync_at) ||
        (errorAt !== null && (!Number.isFinite(errorAt) || errorAt > evaluatedAt));
    })
  ) return unknownMetaMeasurementVerdict("sources_changed_or_unavailable");
  return {
    ...verdict,
    status,
    provenance: {
      source: "meta_measurement_verdict_cache",
      evaluated_at: data.evaluated_at,
      expires_at: data.expires_at,
      verdict_version: data.verdict_version,
      source_fingerprint: data.source_fingerprint,
      store_id: storeId,
      period_start: start,
      period_end: end,
      fresh: true,
    },
  };
}
