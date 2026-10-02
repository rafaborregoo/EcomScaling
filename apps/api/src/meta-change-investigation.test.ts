import assert from "node:assert/strict";
import test from "node:test";
import { validateMetaChangeInvestigationPeriod } from "./meta-change-investigation.js";

const now = new Date("2026-09-29T12:00:00.000Z");

test("A25 drill-down accepts a bounded recent interval", () => {
  assert.deepEqual(
    validateMetaChangeInvestigationPeriod(
      { period_start: "2026-09-01", period_end: "2026-09-29" },
      now,
    ),
    {
      ok: true,
      period: { period_start: "2026-09-01", period_end: "2026-09-29" },
    },
  );
});

test("A25 drill-down rejects malformed, reversed, long, future and stale intervals", () => {
  const invalid = [
    { period_start: "2026-02-30", period_end: "2026-03-01" },
    { period_start: "2026-09-10", period_end: "2026-09-09" },
    { period_start: "2026-08-01", period_end: "2026-09-01" },
    { period_start: "2026-09-28", period_end: "2026-09-30" },
    { period_start: "2026-07-01", period_end: "2026-07-01" },
  ];
  for (const period of invalid) {
    assert.equal(validateMetaChangeInvestigationPeriod(period, now).ok, false);
  }
});

test("A25 drill-down distinguishes missing dates from dates outside the allowed range", () => {
  assert.deepEqual(validateMetaChangeInvestigationPeriod({}, now), {
    ok: false,
    reason: "invalid_period",
  });
  assert.deepEqual(
    validateMetaChangeInvestigationPeriod(
      { period_start: "2026-06-01", period_end: "2026-06-02" },
      now,
    ),
    { ok: false, reason: "period_out_of_bounds" },
  );
});
