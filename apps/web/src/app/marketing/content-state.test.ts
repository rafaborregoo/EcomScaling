/**
 * Si `needsViewer` se equivoca, la cola «Te toca» enseña al cliente piezas que
 * no puede decidir (o esconde la que espera su sí). Si `weekDays` arranca en
 * domingo, la agenda de la semana se desplaza un día entero.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { dueText, needsViewer, piecesOnDay, queueOrder, weekDays } from "./content-state";

const talk = (last: string | null, count = 1) => ({ count, last_at: null, last_author_kind: last });

test("al cliente le toca lo que está para revisar", () => {
  assert.equal(needsViewer({ status: "pending_approval", scheduled_for: null }, "client"), true);
  assert.equal(needsViewer({ status: "approved", scheduled_for: null }, "client"), false);
  assert.equal(needsViewer({ status: "rejected", scheduled_for: null }, "client"), false);
});

test("al consultor le toca lo devuelto y lo que aún no ha enviado", () => {
  assert.equal(needsViewer({ status: "rejected", scheduled_for: null }, "consultant"), true);
  assert.equal(needsViewer({ status: "draft", scheduled_for: null }, "consultant"), true);
  assert.equal(needsViewer({ status: "pending_approval", scheduled_for: null }, "consultant"), false);
});

test("un mensaje del otro lado sin contestar también cuenta", () => {
  assert.equal(needsViewer({ status: "approved", scheduled_for: null, thread: talk("consultant") }, "client"), true);
  assert.equal(needsViewer({ status: "approved", scheduled_for: null, thread: talk("client") }, "client"), false);
  assert.equal(needsViewer({ status: "published", scheduled_for: null, thread: talk("consultant") }, "client"), false);
  assert.equal(needsViewer({ status: "approved", scheduled_for: null, thread: talk(null, 0) }, "client"), false);
});

test("la cola pone lo que sale antes primero y lo que no tiene fecha al final", () => {
  const sorted = queueOrder([
    { id: "sin-fecha", status: "pending_approval" as const, scheduled_for: null },
    { id: "tarde", status: "pending_approval" as const, scheduled_for: "2026-10-09T10:00:00Z" },
    { id: "pronto", status: "pending_approval" as const, scheduled_for: "2026-10-02T10:00:00Z" },
    { id: "mensaje", status: "approved" as const, scheduled_for: "2026-10-01T10:00:00Z" },
  ]);
  assert.deepEqual(sorted.map((piece) => piece.id), ["pronto", "tarde", "sin-fecha", "mensaje"]);
});

test("la semana empieza en lunes, también si hoy es domingo", () => {
  const thursday = weekDays(new Date(2026, 9, 1, 9).getTime());
  assert.equal(thursday[0].getDay(), 1);
  assert.equal(thursday[0].getDate(), 28);
  assert.equal(thursday[6].getDate(), 4);
  const sunday = weekDays(new Date(2026, 9, 4, 9).getTime());
  assert.equal(sunday[0].getDate(), 28);
});

test("cada pieza cae en su día", () => {
  const days = weekDays(new Date(2026, 9, 1).getTime());
  const piece = { status: "approved" as const, scheduled_for: new Date(2026, 9, 2, 10).toISOString() };
  assert.equal(piecesOnDay([piece], days[4]).length, 1);
  assert.equal(piecesOnDay([piece], days[3]).length, 0);
});

test("dueText cuenta días naturales", () => {
  const now = new Date(2026, 9, 1, 23, 30).getTime();
  assert.equal(dueText(new Date(2026, 9, 1, 8).toISOString(), now), "sale hoy");
  assert.equal(dueText(new Date(2026, 9, 2, 8).toISOString(), now), "sale mañana");
  assert.equal(dueText(new Date(2026, 9, 5, 8).toISOString(), now), "sale en 4 días");
  assert.equal(dueText(new Date(2026, 8, 29, 8).toISOString(), now), "salía hace 2 días");
});
