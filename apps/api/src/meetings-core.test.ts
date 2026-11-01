import assert from "node:assert/strict";
import test from "node:test";
import { buildIcs, computeSlots, pickScheduledCall, type ComputeSlotsInput } from "./meetings-core.js";

const type = { duration_minutes: 30, buffer_minutes: 0, min_notice_hours: 0, max_days_ahead: 365, max_per_day: null };
// Lunes 2026-10-19, antes de abrir.
const now = new Date("2026-10-19T00:00:00Z");
const base: ComputeSlotsInput = {
  rules: [{ weekday: 1, start_time: "09:00", end_time: "11:00" }],
  busy: [],
  scheduledStarts: [],
  type,
  timezone: "Europe/Madrid",
  stepMinutes: 30,
  fromDate: "2026-10-19",
  toDate: "2026-10-19",
  now,
};

test("ofrece los huecos de la franja en la zona del consultor", () => {
  // 09:00–11:00 en Madrid (CEST, UTC+2) = 07:00–09:00 UTC.
  assert.deepEqual(computeSlots(base), [
    "2026-10-19T07:00:00.000Z",
    "2026-10-19T07:30:00.000Z",
    "2026-10-19T08:00:00.000Z",
    "2026-10-19T08:30:00.000Z",
  ]);
});

test("no ofrece días sin franja", () => {
  assert.deepEqual(computeSlots({ ...base, fromDate: "2026-10-20", toDate: "2026-10-20" }), []);
});

test("una reserva ajena quita sus huecos, también de otros clientes", () => {
  const slots = computeSlots({ ...base, busy: [{ starts_at: "2026-10-19T07:30:00Z", ends_at: "2026-10-19T08:00:00Z" }] });
  assert.ok(!slots.includes("2026-10-19T07:30:00.000Z"));
  assert.ok(slots.includes("2026-10-19T07:00:00.000Z") && slots.includes("2026-10-19T08:00:00.000Z"));
});

test("el colchón del hueco nuevo choca con la reserva siguiente", () => {
  const slots = computeSlots({
    ...base,
    type: { ...type, buffer_minutes: 15 },
    busy: [{ starts_at: "2026-10-19T08:00:00Z", ends_at: "2026-10-19T08:30:00Z" }],
  });
  // 07:30–08:00 + 15 min de colchón pisaría las 08:00.
  assert.ok(!slots.includes("2026-10-19T07:30:00.000Z"));
  assert.ok(slots.includes("2026-10-19T07:00:00.000Z"));
});

test("respeta la antelación mínima", () => {
  const slots = computeSlots({ ...base, type: { ...type, min_notice_hours: 8 }, now: new Date("2026-10-19T00:00:00Z") });
  assert.deepEqual(slots, ["2026-10-19T08:00:00.000Z", "2026-10-19T08:30:00.000Z"]);
});

test("el tope diario cierra el día ya completo", () => {
  const slots = computeSlots({
    ...base,
    type: { ...type, max_per_day: 1 },
    scheduledStarts: ["2026-10-19T07:00:00Z"],
  });
  assert.deepEqual(slots, []);
});

test("el cambio de hora no desplaza la franja local", () => {
  // Domingo 25 oct 2026 vuelve a CET: lunes 26, 09:00 local = 08:00 UTC.
  const slots = computeSlots({ ...base, fromDate: "2026-10-26", toDate: "2026-10-26", now: new Date("2026-10-20T00:00:00Z") });
  assert.equal(slots[0], "2026-10-26T08:00:00.000Z");
});

test("el .ics escapa el texto y marca la cancelación", () => {
  const ics = buildIcs({ id: "abc", title: "Revisión, mensual", starts_at: "2026-10-19T07:00:00Z", ends_at: "2026-10-19T07:30:00Z", status: "cancelled" }, now);
  assert.match(ics, /SUMMARY:Revisión\\, mensual/);
  assert.match(ics, /DTSTART:20261019T070000Z/);
  assert.match(ics, /STATUS:CANCELLED/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("la grabación se casa con la llamada programada más cercana del mismo consultor", () => {
  const calls = [
    { id: "lejos", scheduled_at: "2026-10-22T05:00:00Z", consultant_user_id: "a" },
    { id: "otro", scheduled_at: "2026-10-22T08:00:00Z", consultant_user_id: "b" },
    { id: "cerca", scheduled_at: "2026-10-22T08:20:00Z", consultant_user_id: "a" },
    { id: "casi", scheduled_at: "2026-10-22T09:00:00Z", consultant_user_id: null },
  ];
  assert.equal(pickScheduledCall(calls, "2026-10-22T08:05:00Z", "a"), "cerca");
  assert.equal(pickScheduledCall(calls, "2026-10-22T12:00:00Z", "a"), null);
  assert.equal(pickScheduledCall([], "2026-10-22T08:05:00Z", "a"), null);
});
