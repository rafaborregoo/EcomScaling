import assert from "node:assert/strict";
import test from "node:test";
import { isStaleAnswer } from "./answer-age";

test("isStaleAnswer usa updated_at y marca más de 180 días", () => {
  const now = Date.parse("2026-10-02T00:00:00Z");
  const day = 86_400_000;
  const at = (days: number) => new Date(now - days * day).toISOString();
  assert.equal(isStaleAnswer({ created_at: at(200) }, now), true);
  assert.equal(isStaleAnswer({ created_at: at(200), updated_at: at(5) }, now), false);
  assert.equal(isStaleAnswer({ created_at: at(180) }, now), false);
});
