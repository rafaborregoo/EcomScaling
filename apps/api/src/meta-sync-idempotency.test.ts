import assert from "node:assert/strict";
import test from "node:test";
import { buildMetaSyncIdempotencyKey } from "./meta-sync.js";

test("Meta sync reuses a ten-minute key for retries", () => {
  assert.equal(
    buildMetaSyncIdempotencyKey(
      "connection-1",
      "insights:act_123",
      "incremental",
      "2026-08-24T10:00:00.000Z",
    ),
    "meta:incremental:insights:act_123:connection-1:2026-08-24T10:00:00.000Z",
  );
  assert.equal(
    buildMetaSyncIdempotencyKey(
      "connection-1",
      "insights:act_123",
      "incremental",
      "2026-08-24T10:09:59.000Z",
    ),
    "meta:incremental:insights:act_123:connection-1:2026-08-24T10:00:00.000Z",
  );
});

test("Meta sync creates a new key on a new day", () => {
  assert.notEqual(
    buildMetaSyncIdempotencyKey(
      "connection-1",
      "structure:act_123",
      "initial",
      "2026-08-24T23:59:59.000Z",
    ),
    buildMetaSyncIdempotencyKey(
      "connection-1",
      "structure:act_123",
      "initial",
      "2026-08-25T00:00:00.000Z",
    ),
  );
});
