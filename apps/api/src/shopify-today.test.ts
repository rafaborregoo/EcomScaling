import assert from "node:assert/strict";
import test from "node:test";
import { startOfLocalDay } from "./shopify-today.js";

test("medianoche de Madrid en horario de verano (UTC+2)", () => {
  assert.equal(startOfLocalDay(new Date("2026-07-15T09:30:00Z"), "Europe/Madrid").toISOString(), "2026-07-14T22:00:00.000Z");
});

test("medianoche de Madrid en horario de invierno (UTC+1)", () => {
  assert.equal(startOfLocalDay(new Date("2026-01-15T09:30:00Z"), "Europe/Madrid").toISOString(), "2026-01-14T23:00:00.000Z");
});

test("pasada la medianoche local, aunque en UTC aun sea ayer, cuenta el dia local", () => {
  assert.equal(startOfLocalDay(new Date("2026-07-14T22:30:00Z"), "Europe/Madrid").toISOString(), "2026-07-14T22:00:00.000Z");
});

test("zona al oeste de UTC", () => {
  assert.equal(startOfLocalDay(new Date("2026-07-15T03:00:00Z"), "America/New_York").toISOString(), "2026-07-14T04:00:00.000Z");
});

test("zona invalida cae a UTC", () => {
  assert.equal(startOfLocalDay(new Date("2026-07-15T09:30:00Z"), "No/Existe").toISOString(), "2026-07-15T00:00:00.000Z");
});
