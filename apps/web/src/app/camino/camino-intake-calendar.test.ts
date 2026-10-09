import assert from "node:assert/strict";
import test from "node:test";
import { calendarHorizonDays, upcomingCalendarIdeas } from "./camino-calendar";

test("uses real calendar-month lengths when scaling Camino dates", () => {
  assert.equal(calendarHorizonDays(12, new Date("2026-10-05T12:00:00.000Z")), 365);
  assert.equal(calendarHorizonDays(1, new Date("2027-01-31T12:00:00.000Z")), 28);
  assert.equal(calendarHorizonDays(1, new Date("2024-01-31T12:00:00.000Z")), 29);
});

test("includes retail and seasonal dates through the selected 12-month horizon", () => {
  const ideas = upcomingCalendarIdeas(12, new Date("2026-10-05T12:00:00.000Z"));

  assert.deepEqual(ideas, [
    { name: "Black Friday", date: "2026-11-27" },
    { name: "Navidad", date: "2026-12-25" },
    { name: "San Valentín", date: "2027-02-14" },
    { name: "Semana Santa", date: "2027-03-21" },
    { name: "Inicio astronómico del verano", date: "2027-06-21" },
  ]);
});

test("does not suggest dates beyond a shorter horizon", () => {
  const ideas = upcomingCalendarIdeas(3, new Date("2026-10-05T12:00:00.000Z"));

  assert.deepEqual(ideas, [
    { name: "Black Friday", date: "2026-11-27" },
    { name: "Navidad", date: "2026-12-25" },
  ]);
});

test("clamps the end of the horizon to the last day of shorter months", () => {
  const ideas = upcomingCalendarIdeas(1, new Date("2027-01-31T12:00:00.000Z"));

  assert.deepEqual(ideas, [{ name: "San Valentín", date: "2027-02-14" }]);
});
