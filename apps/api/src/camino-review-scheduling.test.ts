import assert from "node:assert/strict";
import test from "node:test";
import { caminoReviewCalendarWindows, caminoReviewWeekStart, caminoReviewCycleStart, CAMINO_REVIEW_CADENCE_DAYS, isCaminoReviewDue, canRetryCaminoReview, isCaminoReviewClaimStale } from "./camino-review-scheduling.js";

test("el seguimiento se deduplica por semana y empieza siete días después de activar", () => {
  assert.equal(CAMINO_REVIEW_CADENCE_DAYS, 7);
  assert.equal(caminoReviewCycleStart(new Date("2026-10-04T23:59:00Z")), "2026-09-28");
  assert.equal(isCaminoReviewDue("2026-09-28T12:00:00Z", Date.parse("2026-10-05T11:59:59Z")), false);
  assert.equal(isCaminoReviewDue("2026-09-28T12:00:00Z", Date.parse("2026-10-05T12:00:00Z")), true);
});

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

test("el reintento manual solo está disponible para fallo o lease caducado", () => {
  const now = Date.parse("2026-09-28T12:00:00.000Z");
  assert.equal(canRetryCaminoReview("failed", "2026-09-28T11:59:00Z", now), true);
  assert.equal(canRetryCaminoReview("running", "2026-09-28T11:29:59Z", now), true);
  assert.equal(canRetryCaminoReview("running", "2026-09-28T11:31:00Z", now), false);
  assert.equal(canRetryCaminoReview("succeeded", "2026-09-28T10:00:00Z", now), false);
});
