import assert from "node:assert/strict";
import test from "node:test";
import { decisionLabels, describeChange, needsAttention, periodLabel, replanDates, replanRequestSummary, undecided, validMonths, type ReplanChange } from "./camino-replan-model";

const change = (overrides: Partial<ReplanChange>): ReplanChange => ({
  id: "x",
  kind: "modified",
  entity: "task",
  source_id: "t",
  label: "Tarea",
  before: null,
  after: null,
  reason: null,
  protected: false,
  out_of_scope: false,
  must_decide: false,
  locked: false,
  decision: "accept",
  ...overrides,
});
const money = (value: number) => `${value} €`;

test("T01: el resumen dice los ámbitos elegidos y promete no aplicar nada", () => {
  const text = replanRequestSummary(["dates", "margin", "tasks", "goals", "strategy"], 6);
  assert.match(text, /fechas, margen, tareas, objetivos y estrategia durante los próximos 6 meses/);
  assert.match(text, /Ningún cambio se aplicará sin tu confirmación/);
  assert.match(replanRequestSummary([], 6), /Elige al menos un ámbito/);
});

test("T02: seis meses desde el 5 de noviembre acaban el 4 de mayo y los extremos son parciales", () => {
  assert.deepEqual(replanDates("2026-11-05", 6), { start: "2026-11-05", end: "2027-05-05", lastDay: "2027-05-04", partial: true });
  assert.equal(replanDates("2026-11-01", 2).partial, false);
  assert.equal(replanDates("2026-08-31", 6).end, "2027-02-28");
});

test("T04: la duración es un entero entre 1 y 12", () => {
  assert.equal(validMonths(6), true);
  assert.equal(validMonths(0), false);
  assert.equal(validMonths(13), false);
  assert.equal(validMonths(2.5), false);
  assert.equal(validMonths(Number.NaN), false);
});

test("describe cada campo cambiado sin repetir el plan", () => {
  const lines = describeChange(change({ before: { target_date: "2026-11-20", name: "A" }, after: { target_date: "2026-11-25", name: "B" } }), money);
  assert.deepEqual(lines, ["Fecha: 20 nov 2026 → 25 nov 2026", "Nombre: A → B"]);
  assert.deepEqual(describeChange(change({ entity: "month", before: 75000, after: 30000 }), money), ["75000 € → 30000 €"]);
  assert.deepEqual(describeChange(change({ entity: "month", before: 75000, after: null }), money), ["75000 € → sin dato"]);
});

test("cada decisión se nombra según lo que hace", () => {
  assert.deepEqual(decisionLabels(change({ kind: "added", source_id: null })), { accept: "Añadir", keep: "No añadir" });
  assert.deepEqual(decisionLabels(change({ kind: "retired", before: { due_at: null } })), { accept: "Retirar", keep: "Conservar" });
  assert.deepEqual(decisionLabels(change({ kind: "conflict", after: { name: "x" } })), { accept: "Aceptar cambio", keep: "Mantener original" });
});

test("lo obligatorio sin responder queda pendiente; lo bloqueado no se pide", () => {
  const rows = [change({ id: "a", must_decide: true }), change({ id: "b", must_decide: true }), change({ id: "c", must_decide: true, locked: true })];
  assert.deepEqual(undecided(rows, { a: "keep" }).map((row) => row.id), ["b"]);
  assert.equal(needsAttention(change({ protected: true })), true);
  assert.equal(needsAttention(change({})), false);
  assert.equal(needsAttention(change({ entity: "month" })), true);
});

test("el mes se lee en palabras", () => {
  assert.equal(periodLabel("2026-11"), "Noviembre de 2026");
});
