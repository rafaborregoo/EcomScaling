import {
  standardWebhookHeaderValue as headerValue,
  verifyStandardWebhookSignature,
  type StandardWebhookHeaders,
} from "./standard-webhook.js";

export type FathomWebhookHeaders = StandardWebhookHeaders;

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

/** Fathom firma con Standard Webhooks; el verificador es el compartido. */
export const verifyFathomWebhookSignature = verifyStandardWebhookSignature;

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

/** Parses only the stable fields needed to hand the event to the calls pipeline. */
export function parseFathomMeetingWebhook(
  rawBody: string,
): FathomMeetingWebhook {
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
