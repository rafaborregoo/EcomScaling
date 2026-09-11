import assert from "node:assert/strict";
import test from "node:test";
import { acceptsWebhookIngest } from "./shopify-webhook-handler.js";

// Shopify sigue enviando webhooks hasta que la app se desinstala de la tienda.
// Sin este filtro, una tienda marcada para borrado se repoblaba sola.
test("una conexion activa ingiere", () => {
  for (const status of ["connected", "error", "syncing"]) {
    assert.equal(acceptsWebhookIngest(status), true, status);
  }
});

test("una conexion marcada para borrado o desinstalada no ingiere", () => {
  for (const status of ["pending_deletion", "disconnected", "revoked", "pending"]) {
    assert.equal(acceptsWebhookIngest(status), false, status);
  }
});

test("sin estado no se ingiere", () => {
  assert.equal(acceptsWebhookIngest(null), false);
  assert.equal(acceptsWebhookIngest(undefined), false);
});
