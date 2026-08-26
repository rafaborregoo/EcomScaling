import assert from "node:assert/strict";
import test from "node:test";
import { webhookRetentionCutoff } from "./webhook-retention.js";

test("calcula una ventana de retencion estable y UTC", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  assert.equal(
    webhookRetentionCutoff(now, 30).toISOString(),
    "2026-07-27T12:00:00.000Z",
  );
});

test("rechaza periodos de retencion imposibles", () => {
  assert.throws(
    () => webhookRetentionCutoff(new Date(), 0),
    /webhook_retention_days_out_of_range/,
  );
  assert.throws(
    () => webhookRetentionCutoff(new Date(), 3651),
    /webhook_retention_days_out_of_range/,
  );
});
