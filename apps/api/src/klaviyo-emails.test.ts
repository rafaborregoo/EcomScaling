import assert from "node:assert/strict";
import test from "node:test";
import { entityAlert } from "./klaviyo-emails.js";

const base = {
  id: "e1",
  name: "Campaña",
  subject: "Asunto",
  trigger_type: null,
  send_time: null,
  revenue: 100,
  conversions: 1,
  recipients: 1000,
  delivered: 980,
  unsubscribes: 1,
  bounced: 2,
  spam_complaints: 0,
  opens_unique: 400,
  clicks_unique: 30,
  open_rate: 0.4,
  click_rate: 0.03,
  ctor: 0.075,
  revenue_per_recipient: 0.1,
  unsub_rate: 0.001,
  bounce_rate: 0.002,
  spam_rate: 0,
};

test("sin avisos cuando todo esta dentro de los limites", () => {
  assert.equal(entityAlert(base, 0.4), null);
});

test("spam alto manda sobre cualquier otro aviso", () => {
  const row = { ...base, spam_rate: 0.002, unsub_rate: 0.01, open_rate: 0.1 };
  assert.deepEqual(entityAlert(row, 0.4), { kind: "spam", text: "Quejas de spam altas" });
});

test("bajas altas sin spam", () => {
  assert.deepEqual(entityAlert({ ...base, unsub_rate: 0.006 }, 0.4), { kind: "unsub", text: "Bajas altas" });
});

test("apertura baja frente a la media de la cuenta", () => {
  assert.deepEqual(entityAlert({ ...base, open_rate: 0.3 }, 0.4), { kind: "low_open", text: "Apertura baja" });
  // 15% por debajo exacto no dispara el aviso (umbral estricto)
  assert.equal(entityAlert({ ...base, open_rate: 0.34 }, 0.4), null);
});

test("sin media de cuenta no se puede juzgar la apertura", () => {
  assert.equal(entityAlert({ ...base, open_rate: 0.05 }, null), null);
});
