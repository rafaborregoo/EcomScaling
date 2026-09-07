/**
 * Reparto de tareas entre los consultores de una tienda.
 *
 * Equivocarlo no da error: las tareas siguen creandose, solo que todas caen en
 * la misma persona -- o en nadie -- y el fallo no se ve hasta que alguien se
 * pregunta por que su socio no hace nada.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  pickAssignee,
  pickAssigneeForBatch,
  type Candidate,
} from "./task-assignment.js";

const candidate = (
  id: string,
  workShare: number,
  openTasks = 0,
  isPrimary = false,
): Candidate => ({
  consultantUserId: id,
  workShare,
  isPrimary,
  openTasks,
});

test("sin reparto configurado todo va al principal", () => {
  // 100/0 es "yo llevo este cliente, mi socio solo lo ve".
  assert.equal(
    pickAssignee([candidate("ana", 100, 12, true), candidate("bruno", 0, 0)]),
    "ana",
  );
});

test("peso 0 no recibe ni estando libre del todo", () => {
  // La trampa: con carga 0 seria siempre el mas descargado. El peso manda.
  assert.equal(
    pickAssignee([candidate("ana", 100, 40, true), candidate("bruno", 0, 0)]),
    "ana",
  );
});

test("con pesos iguales le toca al menos cargado", () => {
  assert.equal(
    pickAssignee([candidate("ana", 50, 9, true), candidate("bruno", 50, 3)]),
    "bruno",
  );
});

test("empate a carga: decide el principal", () => {
  // Sin desempate estable el responsable cambiaria segun el orden de la query.
  assert.equal(
    pickAssignee([candidate("ana", 50, 4), candidate("bruno", 50, 4, true)]),
    "bruno",
  );
});

test("nadie puede recibir: la tarea nace sin responsable", () => {
  assert.equal(pickAssignee([]), null);
  assert.equal(
    pickAssignee([candidate("ana", 0), candidate("bruno", 0)]),
    null,
  );
});

test("50/50 reparte un lote a la mitad, no entero al primero", () => {
  // Las ocho tareas que propone la IA de una tacada leen la misma carga: sin
  // apuntarla sobre la marcha caerian las ocho en la misma persona.
  const candidates = [candidate("ana", 50, 0, true), candidate("bruno", 50, 0)];
  const picks = Array.from({ length: 8 }, () =>
    pickAssigneeForBatch(candidates),
  );

  assert.equal(picks.filter((id) => id === "ana").length, 4);
  assert.equal(picks.filter((id) => id === "bruno").length, 4);
});

test("70/30 reparte proporcional al peso", () => {
  const candidates = [candidate("ana", 70, 0, true), candidate("bruno", 30, 0)];
  const picks = Array.from({ length: 10 }, () =>
    pickAssigneeForBatch(candidates),
  );

  assert.equal(picks.filter((id) => id === "ana").length, 7);
  assert.equal(picks.filter((id) => id === "bruno").length, 3);
});

test("el que arranca cargado deja de recibir hasta emparejarse", () => {
  // Al emparejarse, uno lleva anos de cartera y el otro nada: el reparto tiene
  // que igualar antes de alternar, no repartir 50/50 desde el primer dia.
  const candidates = [candidate("ana", 50, 5, true), candidate("bruno", 50, 0)];
  const picks = Array.from({ length: 6 }, () =>
    pickAssigneeForBatch(candidates),
  );

  assert.deepEqual(picks, [
    "bruno",
    "bruno",
    "bruno",
    "bruno",
    "bruno",
    "ana",
  ]);
});
