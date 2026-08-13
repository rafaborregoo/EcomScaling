import assert from "node:assert/strict";
import test from "node:test";
import {
  KLAVIYO_BACKFILL_MONTHS,
  nextKlaviyoBackfillPeriod,
} from "./klaviyo-sync.js";

const reference = new Date("2026-08-03T10:00:00.000Z");

test("el backfill empieza por el ultimo mes completo, no por el mes en curso", () => {
  assert.deepEqual(nextKlaviyoBackfillPeriod(reference, []), {
    type: "campaign-values-report",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
  });
});

test("el backfill salta lo ya ejecutado y avanza hacia atras", () => {
  const done = [
    { report_type: "campaign-values-report", period_start: "2026-07-01" },
    { report_type: "flow-values-report", period_start: "2026-07-01" },
    { report_type: "campaign-values-report", period_start: "2026-06-01" },
  ];
  assert.deepEqual(nextKlaviyoBackfillPeriod(reference, done), {
    type: "flow-values-report",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
  });
});

test("el backfill cruza el cambio de ano y respeta la ventana de 12 meses", () => {
  const done: Array<{ report_type: string; period_start: string }> = [];
  for (let monthsAgo = 1; monthsAgo <= 4; monthsAgo += 1) {
    const start = new Date(Date.UTC(2026, 7 - monthsAgo, 1))
      .toISOString()
      .slice(0, 10);
    done.push(
      { report_type: "campaign-values-report", period_start: start },
      { report_type: "flow-values-report", period_start: start },
    );
  }
  assert.deepEqual(nextKlaviyoBackfillPeriod(reference, done), {
    type: "campaign-values-report",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-31",
  });

  // Febrero de 2026 tiene 28 dias: el fin de periodo se calcula, no se asume.
  const untilFebruary = [...done];
  for (let monthsAgo = 5; monthsAgo <= 5; monthsAgo += 1) {
    untilFebruary.push(
      { report_type: "campaign-values-report", period_start: "2026-03-01" },
      { report_type: "flow-values-report", period_start: "2026-03-01" },
    );
  }
  assert.deepEqual(nextKlaviyoBackfillPeriod(reference, untilFebruary), {
    type: "campaign-values-report",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
  });
});

test("el historico completo no genera mas solicitudes de reporting", () => {
  const done: Array<{ report_type: string; period_start: string }> = [];
  for (
    let monthsAgo = 1;
    monthsAgo <= KLAVIYO_BACKFILL_MONTHS;
    monthsAgo += 1
  ) {
    const start = new Date(Date.UTC(2026, 7 - monthsAgo, 1))
      .toISOString()
      .slice(0, 10);
    done.push(
      { report_type: "campaign-values-report", period_start: start },
      { report_type: "flow-values-report", period_start: start },
    );
  }
  assert.equal(nextKlaviyoBackfillPeriod(reference, done), null);
});
