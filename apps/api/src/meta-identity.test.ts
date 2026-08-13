import assert from "node:assert/strict";
import test from "node:test";
import { getVerifiedMetaIdentity } from "./meta.js";

test("Meta identity rejects absent, blank, or non-verifiable IDs", () => {
  for (const value of [null, {}, { id: "   " }]) {
    const result = getVerifiedMetaIdentity(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "meta_identity_missing");
  }
});

test("Meta identity preserves the real ID and provides an honest fallback name", () => {
  assert.deepEqual(getVerifiedMetaIdentity({ id: "123", name: "  Cuenta real  " }), {
    ok: true,
    id: "123",
    name: "Cuenta real",
  });
  assert.deepEqual(getVerifiedMetaIdentity({ id: "123" }), {
    ok: true,
    id: "123",
    name: "Meta Ads",
  });
});
