import assert from "node:assert/strict";
import test from "node:test";
import { cadenceLabel, countByTrack, growthRoutines, routineName, trackLabel } from "./task-tracks";

test("cuenta las tareas por carril e ignora las que no tienen", () => {
  assert.deepEqual(countByTrack([{ track: "crecimiento" }, { track: "crecimiento" }, { track: "temporada" }, { track: null }, {}]), {
    puesta_a_punto: 0,
    temporada: 1,
    crecimiento: 2,
  });
});

test("etiquetas: una vez no muestra cadencia", () => {
  assert.equal(trackLabel("temporada"), "Fechas clave");
  assert.equal(trackLabel("otro"), null);
  assert.equal(cadenceLabel("quincenal"), "Cada 2 semanas");
  assert.equal(cadenceLabel("una_vez"), null);
});

test("las vueltas de una rutina comparten nombre", () => {
  assert.equal(routineName("Revisar ROAS (2/4)"), "Revisar ROAS");
  assert.equal(routineName("Revisar ROAS"), "Revisar ROAS");
});

test("agrupa las vueltas de crecimiento y da la siguiente pendiente", () => {
  const meta = { track: "crecimiento", cadence: "semanal" };
  const routines = growthRoutines([
    { title: "Revisar ROAS (1/3)", status: "completed", due_at: "2026-10-12", plan_meta: meta },
    { title: "Revisar ROAS (2/3)", status: "pending", due_at: "2026-10-19", plan_meta: meta },
    { title: "Revisar ROAS (3/3)", status: "pending", due_at: "2026-10-26", plan_meta: meta },
    { title: "Medir costes", status: "pending", due_at: "2026-10-13", plan_meta: { track: "puesta_a_punto" } },
  ]);
  assert.deepEqual(routines, [{ name: "Revisar ROAS", cadence: "semanal", total: 3, done: 1, nextDue: "2026-10-19" }]);
});
