import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFathomConnectionHealthPatch,
  handleFathomWebhookRequest,
} from "./fathom-webhook-handler.js";

const baseEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  FATHOM_WEBHOOK_SECRET: "whsec_dGVzdA==",
} as any;

test("falla cerrado si el secreto de Fathom no está configurado", async () => {
  const result = await handleFathomWebhookRequest(
    { ...baseEnv, FATHOM_WEBHOOK_SECRET: undefined },
    "00000000-0000-0000-0000-000000000001",
    {},
    Buffer.from("{}"),
  );
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error, "fathom_webhook_not_configured");
});

test("el procesamiento exitoso publica frescura y limpia errores anteriores", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  assert.deepEqual(buildFathomConnectionHealthPatch("processed", now), {
    last_sync_at: now.toISOString(),
    last_error_at: null,
    last_error_message: null,
    updated_at: now.toISOString(),
  });
});

test("un fallo de webhook deja una señal operativa acotada", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  assert.deepEqual(buildFathomConnectionHealthPatch("failed", now, "provider timeout"), {
    last_error_at: now.toISOString(),
    last_error_message: "provider timeout",
    updated_at: now.toISOString(),
  });
});

test("rechaza firma inválida sin consultar ni escribir en Supabase", async () => {
  const result = await handleFathomWebhookRequest(
    baseEnv,
    "00000000-0000-0000-0000-000000000001",
    {
      "webhook-id": "msg_invalid",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,invalid",
    },
    Buffer.from(JSON.stringify({ recording_id: "rec-1" })),
  );
  assert.equal(result.statusCode, 401);
  assert.equal(result.body.error, "fathom_webhook_signature_invalid");
});
