import assert from "node:assert/strict";
import test from "node:test";
import { caminoReviewCalendarWindows, caminoReviewWeekStart, isCaminoReviewClaimStale } from "./camino-review-scheduling.js";

test("la clave de revisión es el lunes UTC, estable durante toda la semana y entre zonas horarias", () => {
  assert.equal(caminoReviewWeekStart(new Date("2026-09-28T00:00:00.000Z")), "2026-09-28");
  assert.equal(caminoReviewWeekStart(new Date("2026-10-04T23:59:00.000Z")), "2026-09-28");
  assert.equal(caminoReviewWeekStart(new Date("2026-10-05T00:00:00.000Z")), "2026-10-05");
});

test("Meta usa periodos inclusivos de siete días UTC sin solapar el día de comparación", () => {
  assert.deepEqual(caminoReviewCalendarWindows(new Date("2026-09-28T12:45:00.000Z")), {
    currentStart: "2026-09-22",
    currentEnd: "2026-09-28",
    previousStart: "2026-09-15",
    previousEnd: "2026-09-21",
  });
});

test("solo libera claims running con updated_at válido y anterior al lease de 30 minutos", () => {
  const now = Date.parse("2026-09-28T12:00:00.000Z");
  assert.equal(isCaminoReviewClaimStale("2026-09-28T11:29:59.999Z", now), true);
  assert.equal(isCaminoReviewClaimStale("2026-09-28T11:30:00.000Z", now), false);
  assert.equal(isCaminoReviewClaimStale("invalid", now), false);
  assert.equal(isCaminoReviewClaimStale(null, now), false);
});
