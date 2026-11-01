import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { credentialKeyVersion, decryptCredential, encryptCredential } from "./credential-crypto.js";
import { createKlaviyoClient } from "./klaviyo-client.js";
import { getValidKlaviyoAccessToken } from "./klaviyo-token-store.js";
import { enqueueIntegrationSync } from "./integration-sync-queue.js";
import { wakeShopifyWebhooks } from "./shopify-webhook-queue.js";
import { acceptsWebhookIngest, shopifyWebhookRetryAt, WEBHOOK_DRAIN_MAX_ATTEMPTS } from "./shopify-webhook-handler.js";

const SECRET_KIND = "klaviyo_webhook_secret";
const service = (env: LoadedApiEnv) => createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

export function verifyKlaviyoWebhookSignature(body: Buffer, timestamp: string | undefined, signature: string | undefined, secret: string, now = Date.now()) {
  if (!timestamp || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > 5 * 60_000) return false;
  const expected = createHmac("sha256", secret).update(body).update(timestamp).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

/** Only identifiers survive ingestion. Personal event properties stay at the provider. */
export function parseKlaviyoWebhook(body: Buffer) {
  try {
    const value = JSON.parse(body.toString("utf8")) as { data?: Array<{ external_id?: unknown; topic?: unknown }>; meta?: { klaviyo_account_id?: unknown; klaviyo_webhook_id?: unknown } };
    if (!Array.isArray(value.data) || value.data.length < 1 || value.data.length > 1000 ||
      typeof value.meta?.klaviyo_account_id !== "string" || typeof value.meta.klaviyo_webhook_id !== "string" ||
      value.data.some((item) => !item || typeof item.external_id !== "string" || typeof item.topic !== "string")) return null;
    return { accountId: value.meta.klaviyo_account_id, webhookId: value.meta.klaviyo_webhook_id,
      events: value.data.map((item) => ({ id: item.external_id as string, topic: item.topic as string })) };
  } catch { return null; }
}

export async function ensureKlaviyoWebhooks(env: LoadedApiEnv, connectionId: string) {
  const client = service(env);
  const { data: connection, error } = await client.from("integration_connections")
    .select("id, metadata").eq("id", connectionId).eq("provider", "klaviyo").single();
  if (error || !connection) throw new Error(`klaviyo_webhook_connection_failed:${error?.message}`);
  const endpoint = env.INTEGRATION_WEBHOOK_BASE_URL ? `${new URL(env.INTEGRATION_WEBHOOK_BASE_URL).origin}/v1/klaviyo/webhooks/${connectionId}` : null;
  const previous = connection.metadata?.webhooks as { status?: string; checked_at?: string; callback_url?: string } | undefined;
  const enabled = env.KLAVIYO_SYSTEM_WEBHOOKS_ENABLED === "true";
  if (previous?.callback_url === endpoint && previous?.status === (enabled ? "healthy" : "polling") && Date.now() - Date.parse(previous?.checked_at ?? "") < 3_600_000) return;
  let health: Record<string, unknown> = { status: "polling", reason: "system_webhooks_not_enabled", checked_at: new Date().toISOString(), callback_url: endpoint };
  if (enabled && endpoint?.startsWith("https://")) {
    try {
      const api = createKlaviyoClient(await getValidKlaviyoAccessToken(env, connectionId));
      const topics = await api.listAll("/webhook-topics");
      const selected = topics.filter((topic) => /email|order|subscribed|unsubscribed/.test(topic.id));
      if (!selected.length) throw new Error("klaviyo_no_supported_webhook_topics");
      const { data: stored, error: readError } = await client.schema("private").from("integration_credentials")
        .select("encrypted_payload").eq("connection_id", connectionId).eq("credential_kind", SECRET_KIND).maybeSingle();
      if (readError) throw readError;
      const saved = stored?.encrypted_payload ? JSON.parse(decryptCredential(stored.encrypted_payload, env, connectionId)) as { secret: string; webhookId?: string } : null;
      const secret = saved?.secret ?? randomBytes(32).toString("hex");
      const { error: secretError } = await client.schema("private").from("integration_credentials").upsert({
        connection_id: connectionId, credential_kind: SECRET_KIND,
        encrypted_payload: encryptCredential(JSON.stringify({ secret, webhookId: saved?.webhookId }), env, connectionId),
        encryption_key_version: credentialKeyVersion(env), rotated_at: new Date().toISOString(),
      }, { onConflict: "connection_id,credential_kind" });
      if (secretError) throw secretError;
      const hooks = await api.listAll("/webhooks");
      const existing = hooks.find((hook) => hook.id === saved?.webhookId || hook.attributes?.name === `E-NORA ${connectionId}`);
      const payload = { data: {
        type: "webhook", ...(existing ? { id: existing.id } : {}),
        attributes: { name: `E-NORA ${connectionId}`, endpoint_url: endpoint, secret_key: secret, ...(existing ? { enabled: true } : {}) },
        relationships: { "webhook-topics": { data: selected.map((topic) => ({ type: "webhook-topic", id: topic.id })) } },
      } };
      const result = await api.request<{ data: { id: string } }>(existing ? `/webhooks/${existing.id}` : "/webhooks", {
        method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const { error: saveError } = await client.schema("private").from("integration_credentials").update({
        encrypted_payload: encryptCredential(JSON.stringify({ secret, webhookId: result.data.id }), env, connectionId),
      }).eq("connection_id", connectionId).eq("credential_kind", SECRET_KIND);
      if (saveError) throw saveError;
      health = { ...health, status: "healthy", reason: null, topics: selected.length };
    } catch (error) {
      health = { ...health, reason: "webhook_access_unavailable_using_polling" };
      console.warn("Klaviyo system webhooks unavailable; scheduled sync remains active", { connection_id: connectionId, error: error instanceof Error ? error.message : "registration_failed" });
    }
  }
  const { error: storeError } = await client.rpc("set_integration_webhook_health", { target_connection: connectionId, health });
  if (storeError) throw new Error(`klaviyo_webhook_health_store_failed:${storeError.message}`);
}

export async function handleKlaviyoWebhookRequest(env: LoadedApiEnv, connectionId: string, headers: Record<string, string | string[] | undefined>, body: Buffer) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectionId)) return { statusCode: 400, body: { error: "invalid_connection_id" } };
  const client = service(env);
  const { data: connection, error } = await client.from("integration_connections")
    .select("id, organization_id, provider_account_id, status").eq("id", connectionId).eq("provider", "klaviyo").maybeSingle();
  if (error) return { statusCode: 503, body: { error: "klaviyo_connection_lookup_failed" } };
  if (!connection || !acceptsWebhookIngest(connection.status)) return { statusCode: 401, body: { error: "inactive_connection" } };
  const { data: credential, error: credentialError } = await client.schema("private").from("integration_credentials")
    .select("encrypted_payload").eq("connection_id", connectionId).eq("credential_kind", SECRET_KIND).maybeSingle();
  if (credentialError) return { statusCode: 503, body: { error: "klaviyo_webhook_secret_unavailable" } };
  let secret: { secret: string; webhookId?: string } | null = null;
  try { if (credential) secret = JSON.parse(decryptCredential(credential.encrypted_payload, env, connectionId)); } catch { /* reject unreadable secrets */ }
  const header = (name: string) => typeof headers[name] === "string" ? headers[name] as string : undefined;
  if (!secret || !verifyKlaviyoWebhookSignature(body, header("klaviyo-timestamp"), header("klaviyo-signature"), secret.secret)) {
    return { statusCode: 401, body: { error: "invalid_signature" } };
  }
  const parsed = parseKlaviyoWebhook(body);
  if (!parsed) return { statusCode: 400, body: { error: "invalid_payload" } };
  if (parsed.webhookId !== header("klaviyo-webhook-id") || (secret.webhookId && parsed.webhookId !== secret.webhookId) || parsed.accountId !== connection.provider_account_id) {
    return { statusCode: 401, body: { error: "webhook_account_mismatch" } };
  }
  const fingerprint = createHash("sha256").update(`${connectionId}:${parsed.events.map((event) => event.id).sort().join(",")}`).digest("hex");
  const { error: insertError } = await client.schema("private").from("webhook_events").insert({
    connection_id: connectionId, organization_id: connection.organization_id, provider: "klaviyo", topic: "events/changed",
    fingerprint, signature_valid: true, status: "queued", payload: { events: parsed.events }, headers: {},
  });
  if (insertError && insertError.code !== "23505") return { statusCode: 503, body: { error: "webhook_persist_failed" } };
  await wakeShopifyWebhooks(env).catch(() => {});
  return { statusCode: 202, body: { status: "queued" } };
}

export async function processQueuedKlaviyoWebhooks(env: LoadedApiEnv) {
  const client = service(env);
  const { data: events, error } = await client.schema("private").from("webhook_events")
    .select("id, connection_id, organization_id, retry_count").eq("provider", "klaviyo")
    .in("status", ["queued", "failed"]).lt("retry_count", WEBHOOK_DRAIN_MAX_ATTEMPTS)
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`).order("received_at").limit(100);
  if (error) throw new Error(`klaviyo_webhook_queue_load_failed:${error.message}`);
  const connections = new Set<string>();
  for (const event of events ?? []) {
    try {
      if (!connections.has(event.connection_id)) {
        const { data: current, error: currentError } = await client.from("integration_connections").select("status").eq("id", event.connection_id).single();
        if (currentError) throw currentError;
        if (!acceptsWebhookIngest(current?.status)) {
          await client.schema("private").from("webhook_events").update({ status: "ignored_duplicate", processed_at: new Date().toISOString() }).eq("id", event.id);
          continue;
        }
        const queued = await enqueueIntegrationSync(env, { provider: "klaviyo", connectionId: event.connection_id, organizationId: event.organization_id, mode: "incremental", force: true });
        if (queued.status === "running") continue;
        connections.add(event.connection_id);
      }
      const { error: doneError } = await client.schema("private").from("webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString(), error_message: null }).eq("id", event.id);
      if (doneError) throw doneError;
    } catch (error) {
      const retry = Number(event.retry_count) + 1;
      await client.schema("private").from("webhook_events").update({ status: "failed", retry_count: retry,
        next_retry_at: shopifyWebhookRetryAt(retry), error_message: error instanceof Error ? error.message : "queue_unavailable" }).eq("id", event.id);
    }
  }
  return { candidates: events?.length ?? 0, queued: connections.size };
}
