import assert from "node:assert/strict";
import test from "node:test";
import {
  hasIntegrationAttention,
  integrationStatusTone,
} from "./consultant-view-model";

test("pending integrations are surfaced as attention items", () => {
  assert.equal(hasIntegrationAttention("pending"), true);
  assert.equal(hasIntegrationAttention("pending_deletion"), true);
  assert.equal(integrationStatusTone("pending"), "warn");
  assert.equal(integrationStatusTone("pending_deletion"), "warn");
});

test("connection errors and reauthorization needs are danger items", () => {
  for (const status of ["error", "reauthorization_required", "needs_reauth"]) {
    assert.equal(hasIntegrationAttention(status), true);
    assert.equal(integrationStatusTone(status), "danger");
  }
});

test("connected and unknown statuses keep their expected presentation", () => {
  assert.equal(hasIntegrationAttention("connected"), false);
  assert.equal(integrationStatusTone("connected"), "success");
  assert.equal(hasIntegrationAttention("paused"), false);
  assert.equal(integrationStatusTone("paused"), "neutral");
});
