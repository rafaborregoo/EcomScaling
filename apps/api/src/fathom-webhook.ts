import { createHmac, timingSafeEqual } from "node:crypto";

export type FathomWebhookHeaders = {
  "webhook-id"?: string | null;
  "webhook-timestamp"?: string | null;
  "webhook-signature"?: string | null;
};

export type FathomTranscriptSegment = {
  speaker?: { display_name?: string | null } | null;
  text?: string | null;
  timestamp?: string | null;
};

export type FathomMeetingWebhook = {
  recording_id: string;
  title: string | null;
  meeting_title: string | null;
  url: string | null;
  share_url: string | null;
  created_at: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  transcript: FathomTranscriptSegment[];
};

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;

function headerValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeWebhookSecret(secret: string) {
  const encoded = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  return Buffer.from(encoded, "base64");
}

/**
 * Verifies Fathom's signed webhook without parsing or normalising the body.
 * Multiple `v1,...` signatures are accepted during secret rotation.
 */
export function verifyFathomWebhookSignature(
  secret: string,
  headers: FathomWebhookHeaders,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS,
) {
  const webhookId = headerValue(headers["webhook-id"]);
  const timestampText = headerValue(headers["webhook-timestamp"]);
  const signatureHeader = headerValue(headers["webhook-signature"]);
  const timestamp = timestampText ? Number.parseInt(timestampText, 10) : NaN;

  if (
    !webhookId ||
    !timestampText ||
    !signatureHeader ||
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > toleranceSeconds
  ) {
    return false;
  }

  const expected = createHmac("sha256", decodeWebhookSecret(secret))
    .update(`${webhookId}.${timestampText}.${rawBody}`)
    .digest("base64");
  const expectedBytes = Buffer.from(expected);

  return signatureHeader.split(/\s+/).some((candidate) => {
    const [, encodedSignature = candidate] = candidate.split(",", 2);
    const actualBytes = Buffer.from(encodedSignature);
    return (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    );
  });
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

/** Parses only the stable fields needed to hand the event to the calls pipeline. */
export function parseFathomMeetingWebhook(rawBody: string): FathomMeetingWebhook {
  const value = JSON.parse(rawBody) as Record<string, unknown>;
  const recordingId = value.recording_id;
  if (
    !(typeof recordingId === "string" || typeof recordingId === "number") ||
    String(recordingId).trim() === ""
  ) {
    throw new Error("fathom_webhook_recording_id_missing");
  }

  const transcript = Array.isArray(value.transcript)
    ? value.transcript.filter(
        (segment): segment is FathomTranscriptSegment =>
          typeof segment === "object" && segment !== null,
      )
    : [];

  return {
    recording_id: String(recordingId),
    title: nullableString(value.title),
    meeting_title: nullableString(value.meeting_title),
    url: nullableString(value.url),
    share_url: nullableString(value.share_url),
    created_at: nullableString(value.created_at),
    scheduled_start_time: nullableString(value.scheduled_start_time),
    scheduled_end_time: nullableString(value.scheduled_end_time),
    transcript,
  };
}

export function fathomWebhookDeduplicationKey(
  headers: FathomWebhookHeaders,
  payload: Pick<FathomMeetingWebhook, "recording_id">,
) {
  return `fathom:${headerValue(headers["webhook-id"]) ?? `recording:${payload.recording_id}`}`;
}

