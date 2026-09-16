import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import type { FathomWebhookEventRow } from "@ecomscaling/db";
import type { AuthContext } from "./auth-context.js";
import { runCallAnalyst } from "./ai-runtime.js";
import {
  fathomWebhookDeduplicationKey,
  parseFathomMeetingWebhook,
  verifyFathomWebhookSignature,
  type FathomWebhookHeaders,
} from "./fathom-webhook.js";

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export async function handleFathomWebhookRequest(
  env: LoadedApiEnv,
  connectionId: string,
  headers: FathomWebhookHeaders,
  rawBody: Buffer,
) {
  if (!env.FATHOM_WEBHOOK_SECRET) {
    return { statusCode: 503, body: { error: "fathom_webhook_not_configured" } };
  }

  const body = rawBody.toString("utf8");
  const valid = verifyFathomWebhookSignature(
    env.FATHOM_WEBHOOK_SECRET,
    headers,
    body,
  );
  if (!valid) {
    return { statusCode: 401, body: { error: "fathom_webhook_signature_invalid" } };
  }

  let payload;
  try {
    payload = parseFathomMeetingWebhook(body);
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        error: error instanceof Error ? error.message : "fathom_webhook_payload_invalid",
      },
    };
  }

  const supabase = createServiceClient(env);
  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider, status")
    .eq("id", connectionId)
    .eq("provider", "fathom")
    .eq("status", "connected")
    .maybeSingle();

  if (connectionError || !connection) {
    return { statusCode: 404, body: { error: "fathom_connection_not_found" } };
  }

  const externalEventId = headers["webhook-id"]?.trim() || payload.recording_id;
  const fingerprint = crypto.createHash("sha256").update(rawBody).digest("hex");
  const deduplicationKey = fathomWebhookDeduplicationKey(headers, payload);
  const { data: event, error: insertError } = await supabase
    .schema("private")
    .from("webhook_events")
    .insert({
      connection_id: connection.id,
      organization_id: connection.organization_id,
      provider: "fathom",
      topic: "meeting.completed",
      external_event_id: externalEventId,
      fingerprint: `${deduplicationKey}:${fingerprint}`,
      signature_valid: true,
      status: "queued",
      payload,
      headers,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    const { data: duplicate } = await supabase
      .schema("private")
      .from("webhook_events")
      .select("id")
      .eq("provider", "fathom")
      .eq("external_event_id", externalEventId)
      .maybeSingle();
    if (duplicate) {
      return { statusCode: 200, body: { status: "duplicate", event_id: duplicate.id } };
    }
    return { statusCode: 503, body: { error: "fathom_webhook_persist_failed" } };
  }

  return { statusCode: 202, body: { status: "queued", event_id: event?.id ?? null } };
}

function backoffSeconds(attempt: number) {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
}

export function buildFathomConnectionHealthPatch(
  outcome: "processed" | "failed",
  now = new Date(),
  errorMessage?: string,
) {
  const timestamp = now.toISOString();
  if (outcome === "processed") {
    return {
      last_sync_at: timestamp,
      last_error_at: null,
      last_error_message: null,
      updated_at: timestamp,
    } as const;
  }

  return {
    last_error_at: timestamp,
    last_error_message: (errorMessage ?? "fathom_event_processing_failed").slice(0, 500),
    updated_at: timestamp,
  } as const;
}

function buildSystemContext(
  connectedBy: string,
  organization: Record<string, unknown>,
): AuthContext {
  return {
    user: { id: connectedBy, email: "fathom-webhook@ecomscaling.internal" },
    profile: {
      id: connectedBy,
      full_name: null,
      avatar_url: null,
      platform_role: "consultant",
      is_active: true,
    },
    memberships: [
      {
        organization_id: String(organization.id),
        role: "manager",
        accessSource: "membership",
        organization: {
          id: String(organization.id),
          display_name: String(organization.display_name ?? ""),
          slug: String(organization.slug ?? ""),
          status: String(organization.status ?? "active"),
          timezone: String(organization.timezone ?? "UTC"),
          currency_code: String(organization.currency_code ?? "EUR"),
          kind: String(organization.kind ?? "client"),
        },
      },
    ],
    subscriptions: [],
  };
}

/** Claims and consumes a bounded batch. Safe to call from a repeatable worker. */
export async function processQueuedFathomWebhookEvents(
  env: LoadedApiEnv,
  limit = 10,
) {
  const supabase = createServiceClient(env);
  const now = new Date();
  const { data: candidates, error } = await supabase
    .schema("private")
    .from("webhook_events")
    .select("id, connection_id, organization_id, payload, attempt_count")
    .eq("provider", "fathom")
    .eq("status", "queued")
    .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`)
    .order("received_at", { ascending: true })
    .limit(Math.min(50, Math.max(1, limit)));

  if (error) throw error;
  let processed = 0;
  let retried = 0;
  let failed = 0;

  // Supabase typegen currently omits the private schema and INT-04 columns;
  // keep the boundary explicit until the official typegen gate is available.
  const typedCandidates = (candidates ?? []) as unknown as Array<
    Pick<FathomWebhookEventRow, "id" | "connection_id" | "organization_id" | "payload" | "attempt_count">
  >;
  for (const candidate of typedCandidates) {
    const attempt = Number(candidate.attempt_count ?? 0) + 1;
    const { data: claimed } = await supabase
      .schema("private")
      .from("webhook_events")
      .update({ status: "processing", claimed_at: now.toISOString(), attempt_count: attempt })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const { data: connection } = await supabase
        .from("integration_connections")
        .select("id, organization_id, connected_by, organizations(id, display_name, slug, status, timezone, currency_code, kind)")
        .eq("id", candidate.connection_id)
        .eq("provider", "fathom")
        .maybeSingle();
      const organization = Array.isArray(connection?.organizations)
        ? connection?.organizations[0]
        : connection?.organizations;
      const payload = candidate.payload as Record<string, unknown>;
      const parsed = parseFathomMeetingWebhook(JSON.stringify(payload));
      if (!connection || !organization || !connection.connected_by) {
        throw new Error("fathom_connection_context_missing");
      }

      let { data: call } = await supabase
        .from("consulting_calls")
        .select("id")
        .eq("organization_id", connection.organization_id)
        .eq("external_recording_id", parsed.recording_id)
        .maybeSingle();
      if (!call) {
        const { data: created, error: createError } = await supabase
          .from("consulting_calls")
          .insert({
            organization_id: connection.organization_id,
            consultant_user_id: connection.connected_by,
            title: (parsed.meeting_title ?? parsed.title ?? `Reunión Fathom ${parsed.recording_id}`).slice(0, 255),
            status: "held",
            held_at: parsed.created_at,
            recording_url: parsed.share_url ?? parsed.url,
            recording_provider: "fathom",
            external_recording_id: parsed.recording_id,
            created_by: connection.connected_by,
          })
          .select("id")
          .single();
        if (createError || !created) throw createError ?? new Error("fathom_call_create_failed");
        call = created;
      }

      const transcriptText = parsed.transcript
        .map((segment) => {
          const speaker = segment.speaker?.display_name?.trim();
          const text = segment.text?.trim();
          return text ? `${speaker ? `${speaker}: ` : ""}${text}` : null;
        })
        .filter((line): line is string => Boolean(line))
        .join("\n");

      if (transcriptText) {
        const { data: currentTranscript } = await supabase
          .from("call_transcripts")
          .select("id")
          .eq("call_id", call.id)
          .eq("is_current", true)
          .maybeSingle();
        if (!currentTranscript) {
          const { data: latest } = await supabase
            .from("call_transcripts")
            .select("version")
            .eq("call_id", call.id)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          const { error: transcriptError } = await supabase.from("call_transcripts").insert({
            call_id: call.id,
            organization_id: connection.organization_id,
            content: transcriptText,
            source: "fathom",
            version: Number(latest?.version ?? 0) + 1,
            is_current: true,
            created_by: connection.connected_by,
          });
          if (transcriptError) throw transcriptError;
          const analysis = await runCallAnalyst(
            env,
            buildSystemContext(String(connection.connected_by), organization as Record<string, unknown>),
            connection.organization_id,
            call.id,
          );
          if (analysis.ok === false) {
            throw new Error(`fathom_a01_failed:${analysis.error}`);
          }
        }
      }

      await supabase.schema("private").from("webhook_events").update({
        status: "processed",
        processed_at: new Date().toISOString(),
        processing_result: { call_id: call.id, transcript_available: Boolean(transcriptText) },
      }).eq("id", candidate.id).eq("status", "processing");
      await supabase.from("integration_connections").update(
        buildFathomConnectionHealthPatch("processed", new Date()),
      ).eq("id", connection.id).eq("provider", "fathom").eq("status", "connected");
      processed += 1;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "fathom_event_processing_failed";
      const shouldRetry = attempt < 5 && !message.includes("context_missing");
      await supabase.schema("private").from("webhook_events").update({
        status: shouldRetry ? "queued" : "failed",
        next_retry_at: shouldRetry ? new Date(Date.now() + backoffSeconds(attempt) * 1000).toISOString() : null,
        error_message: message.slice(0, 500),
      }).eq("id", candidate.id).eq("status", "processing");
      await supabase.from("integration_connections").update(
        buildFathomConnectionHealthPatch("failed", new Date(), message),
      ).eq("id", candidate.connection_id).eq("provider", "fathom").eq("status", "connected");
      if (shouldRetry) retried += 1;
      else failed += 1;
    }
  }

  return { scanned: candidates?.length ?? 0, processed, retried, failed };
}
