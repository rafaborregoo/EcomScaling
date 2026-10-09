import assert from "node:assert/strict";
import test from "node:test";
import { caminoCalendarHorizonDays, caminoCalendarMonthsTouched } from "./index.js";

test("tres meses desde el 7 de octubre tocan cuatro meses naturales", () => {
  const start = new Date("2026-10-07T00:00:00.000Z");
  assert.equal(caminoCalendarMonthsTouched(start, caminoCalendarHorizonDays(start, 3)), 4);
});
