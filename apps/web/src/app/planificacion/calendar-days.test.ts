// Este test SOLO tiene sentido en un huso distinto de UTC: el fallo que
// persigue es exactamente la conversion a UTC. Se fija antes de tocar Date.
process.env.TZ = "Europe/Madrid";

import assert from "node:assert/strict";
import { test } from "node:test";

import { groupByLocalDay, itemDayKey, localDayKey } from "./calendar-days";

test("la celda y la accion tienen que hablar del mismo dia", () => {
  // Medianoche local del 6 de septiembre en Madrid = 2026-09-05T22:00Z.
  // Con toISOString(), la celda del dia 6 se llamaba "2026-09-05".
  const celda = new Date(2026, 8, 6, 0, 0, 0);
  assert.equal(localDayKey(celda), "2026-09-06");
  assert.notEqual(
    localDayKey(celda),
    celda.toISOString().slice(0, 10),
    "si estas dos coinciden, el test no esta corriendo en Madrid y no prueba nada",
  );
});

test("una accion del dia 6 cae en el dia 6, no en el 7", () => {
  // Las acciones que crea el editor se guardan a las 12:00 locales y las de
  // A05 a la hora de aprobar: las dos tienen que caer en su dia.
  assert.equal(itemDayKey("2026-09-06T12:00:00.000Z"), "2026-09-06");
  assert.equal(itemDayKey("2026-09-06T10:00:00.000Z"), "2026-09-06");
});

test("el borde del dia se resuelve en local, que es lo que ve el consultor", () => {
  // 22:30Z del dia 6 ya son las 00:30 del dia 7 en Madrid.
  assert.equal(itemDayKey("2026-09-06T22:30:00.000Z"), "2026-09-07");
  // 21:30Z siguen siendo las 23:30 del dia 6.
  assert.equal(itemDayKey("2026-09-06T21:30:00.000Z"), "2026-09-06");
});

test("el cambio de hora no descoloca el calendario", () => {
  // Madrid pasa a UTC+1 el ultimo domingo de octubre.
  assert.equal(itemDayKey("2026-10-24T23:30:00.000Z"), "2026-10-25"); // aun +2
  assert.equal(itemDayKey("2026-11-02T23:30:00.000Z"), "2026-11-03"); // ya +1
});

test("una fecha corrupta no se agrupa en una celda inventada", () => {
  assert.equal(itemDayKey("no-es-una-fecha"), "");
  const grouped = groupByLocalDay([
    { id: "rota", starts_at: "cuando sea" },
    { id: "buena", starts_at: "2026-09-06T12:00:00.000Z" },
  ]);
  assert.equal(grouped.size, 1);
  assert.deepEqual(
    grouped.get("2026-09-06")?.map((item) => item.id),
    ["buena"],
  );
});

test("varias acciones el mismo dia caen juntas y en orden de llegada", () => {
  const grouped = groupByLocalDay([
    { id: "a", starts_at: "2026-09-06T09:00:00.000Z" },
    { id: "b", starts_at: "2026-09-06T18:00:00.000Z" },
    { id: "c", starts_at: "2026-09-07T09:00:00.000Z" },
  ]);
  assert.deepEqual(grouped.get("2026-09-06")?.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(grouped.get("2026-09-07")?.map((item) => item.id), ["c"]);
});
