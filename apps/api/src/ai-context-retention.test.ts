import assert from "node:assert/strict";
import test from "node:test";
import { aiContextRetentionCutoff } from "./ai-context-retention.js";

test("calcula la retencion IA de 180 dias sin tocar la fecha recibida", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  assert.equal(
    aiContextRetentionCutoff(now).toISOString(),
    "2026-02-27T12:00:00.000Z",
  );
  assert.equal(now.toISOString(), "2026-08-26T12:00:00.000Z");
});

test("no permite retenciones IA demasiado cortas", () => {
  assert.throws(
    () => aiContextRetentionCutoff(new Date(), 29),
    /ai_context_retention_days_out_of_range/,
  );
});
