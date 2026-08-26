import { deepEqual } from "node:assert/strict";
import test from "node:test";
import { WEBHOOK_EVENT_STATUSES } from "./fathom-webhook.types.js";
import type {
  DatabaseWithFathomWebhookQueue,
  FathomWebhookEventInsert,
} from "./fathom-webhook.types.js";

test("INT-04 exposes the complete webhook state machine", () => {
  deepEqual([...WEBHOOK_EVENT_STATUSES], [
    "received",
    "processing",
    "ignored_duplicate",
    "queued",
    "processed",
    "failed",
  ]);
});

test("INT-04 overlay types the new Fathom fields without editing generated typegen", () => {
  const event = {
    connection_id: "connection-1",
    organization_id: "org-1",
    provider: "fathom",
    topic: "meeting.completed",
    external_event_id: "meeting-1",
    fingerprint: "sha256:abc",
    signature_valid: true,
    payload: { recording_id: "recording-1" },
    headers: {},
  } satisfies FathomWebhookEventInsert;

  const rowShape: DatabaseWithFathomWebhookQueue["public"]["Tables"]["consulting_calls"]["Insert"] = {
    organization_id: "org-1",
    created_by: "user-1",
    title: "Fathom call",
    external_recording_id: "recording-1",
  };

  deepEqual(event.provider, "fathom");
  deepEqual(rowShape.external_recording_id, "recording-1");
});
