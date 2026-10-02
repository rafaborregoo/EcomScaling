import assert from "node:assert/strict";
import test from "node:test";
import { consultantConversationScopeMismatch } from "./consultant-chat-store-scope.js";

test("un hilo solo se reutiliza en su scope exacto", () => {
  assert.equal(consultantConversationScopeMismatch("store-a", { scope_kind: "store", scope_store_id: "store-a" }), null);
  assert.equal(consultantConversationScopeMismatch("store-b", { scope_kind: "store", scope_store_id: "store-a" }), "mismatch");
  assert.equal(consultantConversationScopeMismatch(null, { scope_kind: "organization", scope_store_id: null }), null);
  assert.equal(consultantConversationScopeMismatch("store-a", { scope_kind: "organization", scope_store_id: null }), "mismatch");
  assert.equal(consultantConversationScopeMismatch(null, { scope_kind: "legacy_unknown", scope_store_id: null }), "unknown");
});
