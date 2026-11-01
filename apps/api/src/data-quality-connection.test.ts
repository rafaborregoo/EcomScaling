import assert from "node:assert/strict";
import test from "node:test";
import { conexionVigente } from "./data-quality-engine.js";

const c = (id: string, status: string, last: string | null) => ({ id, provider: "shopify", status, last_sync_at: last });

test("evalúa la conexión conectada, no una vieja que se borra", () => {
  const rows = [c("vieja", "pending_deletion", "2026-09-14T00:00:00Z"), c("viva", "connected", "2026-10-21T10:00:00Z")];
  assert.equal(conexionVigente(rows, "shopify")?.id, "viva");
});

test("entre varias conectadas, la que sincronizó más reciente", () => {
  const rows = [c("a", "connected", "2026-10-01T00:00:00Z"), c("b", "connected", "2026-10-20T00:00:00Z")];
  assert.equal(conexionVigente(rows, "shopify")?.id, "b");
});

test("sin conexiones del proveedor, nada", () => {
  assert.equal(conexionVigente([c("x", "connected", null)], "klaviyo"), undefined);
});
