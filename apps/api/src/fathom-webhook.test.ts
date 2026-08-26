import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  fathomWebhookDeduplicationKey,
  parseFathomMeetingWebhook,
  verifyFathomWebhookSignature,
} from "./fathom-webhook.js";

const secret = "whsec_" + Buffer.from("fathom-test-secret").toString("base64");
const body = JSON.stringify({
  recording_id: 123,
  title: "QBR",
  transcript: [{ speaker: { display_name: "Ana" }, text: "Hola" }],
});
const headers = {
  "webhook-id": "msg_test_123",
  "webhook-timestamp": "1712345678",
};
const signature = createHmac("sha256", Buffer.from("fathom-test-secret"))
  .update(`${headers["webhook-id"]}.${headers["webhook-timestamp"]}.${body}`)
  .digest("base64");

test("verifica la firma oficial de Fathom y acepta firmas versionadas", () => {
  assert.equal(
    verifyFathomWebhookSignature(
      secret,
      { ...headers, "webhook-signature": `v1,${signature}` },
      body,
      1712345678,
    ),
    true,
  );
  assert.equal(
    verifyFathomWebhookSignature(
      secret,
      { ...headers, "webhook-signature": `v1,${signature}` },
      body,
      1712345678 + 301,
    ),
    false,
  );
});

test("rechaza firma alterada y conserva idempotencia por webhook-id", () => {
  assert.equal(
    verifyFathomWebhookSignature(
      secret,
      { ...headers, "webhook-signature": "v1,invalid" },
      body,
      1712345678,
    ),
    false,
  );
  const payload = parseFathomMeetingWebhook(body);
  assert.equal(
    fathomWebhookDeduplicationKey(
      { ...headers, "webhook-signature": `v1,${signature}` },
      payload,
    ),
    "fathom:msg_test_123",
  );
});

test("parsea un webhook sin inventar transcripcion", () => {
  assert.deepEqual(parseFathomMeetingWebhook(JSON.stringify({ recording_id: 7 })).transcript, []);
  assert.throws(
    () => parseFathomMeetingWebhook(JSON.stringify({ title: "sin id" })),
    /fathom_webhook_recording_id_missing/,
  );
});

test("rechaza replay fuera de ventana antes de aceptar el evento", () => {
  assert.equal(
    verifyFathomWebhookSignature(
      secret,
      { ...headers, "webhook-signature": `v1,${signature}` },
      body,
      1712345678 + 301,
    ),
    false,
  );
});
