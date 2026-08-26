import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeOpsHealthDetails } from "./ops-health-check.js";

test("sanitiza detalles de operaciones antes de persistirlos", () => {
  const sanitized = sanitizeOpsHealthDetails({
    organization_id: "org-1",
    access_token: "secret-token",
    error_message:
      "Bearer embedded-token https://provider.test/callback?api_key=abc123",
    nested: [{ client_secret: "secret", message: "safe" }],
  });

  assert.deepEqual(sanitized, {
    organization_id: "org-1",
    access_token: "[REDACTED]",
    error_message:
      "Bearer [REDACTED] https://provider.test/callback?api_key=[REDACTED]",
    nested: [{ client_secret: "[REDACTED]", message: "safe" }],
  });
});

test("limita strings de detalle para proteger artifacts e incidencias operativas", () => {
  const sanitized = sanitizeOpsHealthDetails({ message: "x".repeat(2_500) });
  assert.equal(typeof sanitized.message, "string");
  assert.ok((sanitized.message as string).length <= 2_000);
});
