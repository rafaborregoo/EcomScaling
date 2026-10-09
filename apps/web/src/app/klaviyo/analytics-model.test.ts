import assert from "node:assert/strict";
import test from "node:test";
import { clickTone, groupInventory, openTone, rateState, rateZones, type InventoryEmail } from "./analytics-model";

test("openTone compara con la media en puntos porcentuales", () => {
  assert.equal(openTone(0.462, 0.424), "good");
  assert.equal(openTone(0.419, 0.424), "");
  assert.equal(openTone(0.405, 0.424), "warn");
  assert.equal(openTone(0.298, 0.424), "bad");
  assert.equal(openTone(null, 0.424), "");
});

test("clickTone usa umbrales propios, más finos", () => {
  assert.equal(clickTone(0.038, 0.029), "good");
  assert.equal(clickTone(0.026, 0.029), "warn");
  assert.equal(clickTone(0.011, 0.029), "bad");
});

test("rateState: verde, ámbar y rojo en los umbrales", () => {
  assert.equal(rateState(0.0021, 0.003, 0.005), "good");
  assert.equal(rateState(0.026, 0.02, 0.04), "warn");
  assert.equal(rateState(0.0012, 0.0008, 0.001), "bad");
});

test("rateZones suma 100 y el marcador no se sale de la barra", () => {
  const z = rateZones(0.0012, 0.0008, 0.001);
  assert.ok(Math.abs(z.good + z.amber + z.red - 100) < 1e-9);
  assert.ok(z.marker <= 99);
  assert.equal(rateZones(1, 0.0008, 0.001).marker, 99);
});

const email = (over: Partial<InventoryEmail>): InventoryEmail => ({
  source: "flow",
  parent_id: "f1",
  parent_name: "Carrito",
  parent_status: "live",
  trigger_type: "Checkout",
  position_in_parent: 1,
  message_id: "m",
  subject: "Hola",
  preview_text: null,
  body_chars: 1000,
  adds_utm: true,
  ...over,
});

test("groupInventory cuenta problemas por flujo y deja las campañas al final", () => {
  const groups = groupInventory([
    email({ source: "campaign", parent_id: "c1", parent_name: "News", message_id: "a", adds_utm: false }),
    email({ message_id: "b", position_in_parent: 2, body_chars: 0 }),
    email({ message_id: "c", position_in_parent: 1, adds_utm: false }),
  ]);
  assert.deepEqual(groups.map((g) => g.name), ["Carrito", "Campañas"]);
  assert.equal(groups[0].sinUtm, 1);
  assert.equal(groups[0].sinCuerpo, 1);
  assert.deepEqual(groups[0].emails.map((e) => e.message_id), ["c", "b"]);
  assert.equal(groups[1].sinUtm, 1);
});
