import type { Database, Json } from "./database.types.js";

/** Local contract for INT-04 until the official Supabase typegen is refreshed. */
export const WEBHOOK_EVENT_STATUSES = [
  "received",
  "processing",
  "ignored_duplicate",
  "queued",
  "processed",
  "failed",
] as const;

export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];
export type FathomWebhookTopic = "meeting.completed";

export type FathomWebhookEventRow = {
  id: string;
  connection_id: string | null;
  organization_id: string | null;
  provider: "fathom";
  topic: string;
  external_event_id: string | null;
  fingerprint: string;
  signature_valid: boolean;
  status: WebhookEventStatus;
  received_at: string;
  processed_at: string | null;
  claimed_at: string | null;
  next_retry_at: string | null;
  attempt_count: number;
  payload: Json;
  headers: Json;
  processing_result: Json;
  error_message: string | null;
  created_at: string;
};

export type FathomWebhookEventInsert = Omit<
  FathomWebhookEventRow,
  "id" | "received_at" | "created_at" | "status" | "processed_at" | "claimed_at" |
    "next_retry_at" | "attempt_count" | "processing_result" | "error_message"
> & {
  id?: string;
  received_at?: string;
  created_at?: string;
  status?: WebhookEventStatus;
  processed_at?: string | null;
  claimed_at?: string | null;
  next_retry_at?: string | null;
  attempt_count?: number;
  processing_result?: Json;
  error_message?: string | null;
};

export type FathomWebhookEventUpdate = Partial<
  Pick<
    FathomWebhookEventRow,
    | "status"
    | "processed_at"
    | "claimed_at"
    | "next_retry_at"
    | "attempt_count"
    | "processing_result"
    | "error_message"
  >
>;

export type ConsultingCallWithExternalRecording =
  Database["public"]["Tables"]["consulting_calls"] & {
    Row: Database["public"]["Tables"]["consulting_calls"]["Row"] & {
      external_recording_id: string | null;
    };
    Insert: Database["public"]["Tables"]["consulting_calls"]["Insert"] & {
      external_recording_id?: string | null;
    };
    Update: Database["public"]["Tables"]["consulting_calls"]["Update"] & {
      external_recording_id?: string | null;
    };
  };

export type DatabaseWithFathomWebhookQueue = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "consulting_calls"> & {
      consulting_calls: ConsultingCallWithExternalRecording;
    };
  };
};
