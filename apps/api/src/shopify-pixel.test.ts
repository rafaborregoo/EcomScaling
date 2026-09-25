import { test } from "node:test";
import assert from "node:assert/strict";
import { isPixelStoreId, parsePixelEvent } from "./shopify-pixel.js";

const now = new Date("2026-09-25T10:00:00.000Z");
const evento = {
  name: "product_viewed",
  id: "sh-abc-123",
  timestamp: "2026-09-25T09:59:00.000Z",
  client_id: "cliente-navegador",
  product_id: "gid://shopify/Product/42",
  variant_id: 7,
};

test("el pixel llega como text/plain y el client_id no se guarda en claro", () => {
  const e = parsePixelEvent(JSON.stringify(evento), now);
  assert.ok(e);
  assert.equal(e.event_name, "product_viewed");
  assert.equal(e.variant_id, "7");
  assert.equal(e.client_id_hash?.length, 64);
  assert.notEqual(e.client_id_hash, evento.client_id);
});

test("solo se aceptan eventos que sabemos contar y con fecha plausible", () => {
  assert.equal(parsePixelEvent({ ...evento, name: "checkout_completed" }, now), null);
  assert.equal(parsePixelEvent({ ...evento, timestamp: "2026-09-20T10:00:00.000Z" }, now), null);
  assert.equal(parsePixelEvent({ ...evento, id: "" }, now), null);
  assert.equal(parsePixelEvent("no es json", now), null);
});

test("la tienda del pixel tiene que ser un uuid", () => {
  assert.equal(isPixelStoreId("5ebc7b02-ca86-402e-bd61-9abd22f1ee04"), true);
  assert.equal(isPixelStoreId("'; drop table"), false);
});
