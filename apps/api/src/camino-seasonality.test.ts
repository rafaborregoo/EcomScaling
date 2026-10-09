import assert from "node:assert/strict";
import { test } from "node:test";
import { caminoSeasonality, monthKey } from "./camino-seasonality.js";

const row = (bucket: string, net: number) => ({ bucket_month: bucket, net_sales: String(net), orders_count: "10" });

test("el cubo mensual desplazado por zona horaria se etiqueta con su mes real", () => {
  assert.equal(monthKey("2025-09-30T22:00:00.000Z"), "2025-10");
  assert.equal(monthKey("2025-10-31T23:00:00.000Z"), "2025-11");
  assert.equal(monthKey("2025-08-31T22:00:00.000Z"), "2025-09");
});

test("el ritmo usa los tres ultimos meses de calendario aunque uno sea cero", () => {
  const rows = [
    row("2026-05-31T22:00:00.000Z", 20000),
    row("2026-06-30T22:00:00.000Z", 30000),
    row("2026-08-31T22:00:00.000Z", 36000),
  ];
  // jun=20000, jul=30000, ago=0 (sin ventas), sep=36000: hoy es octubre, los tres meses completos son jul, ago y sep.
  const result = caminoSeasonality(rows, new Date("2026-10-06T00:00:00Z"), 3);
  assert.equal(result.run_rate_3m, Math.round((30000 + 0 + 36000) / 3));
});

test("sin tres meses de historia no hay ritmo", () => {
  const result = caminoSeasonality([row("2026-08-31T22:00:00.000Z", 36000)], new Date("2026-10-06T00:00:00Z"), 3);
  assert.equal(result.run_rate_3m, null);
});

test("ritmo actual, mes pico y mismo mes del año pasado", () => {
  const rows = [
    row("2025-08-31T22:00:00.000Z", 0),
    row("2025-09-30T22:00:00.000Z", 34585.9),
    row("2025-10-31T23:00:00.000Z", 68126.14),
    row("2025-11-30T23:00:00.000Z", 41613.22),
    row("2026-06-30T22:00:00.000Z", 31618.3),
    row("2026-07-31T22:00:00.000Z", 39058.8),
    row("2026-08-31T22:00:00.000Z", 46596.3),
    row("2026-09-30T22:00:00.000Z", 9837.9),
  ];
  const result = caminoSeasonality(rows, new Date("2026-10-06T00:00:00Z"), 3);
  assert.equal(result.last_full_month?.month, "2026-09");
  assert.equal(result.run_rate_3m, Math.round((31618.3 + 39058.8 + 46596.3) / 3));
  assert.equal(result.peak_month?.month, "2025-11");
  assert.deepEqual(result.same_month_last_year.map((entry) => [entry.month, entry.last_year, entry.net_sales]), [
    ["2026-10", "2025-10", 34585.9],
    ["2026-11", "2025-11", 68126.14],
    ["2026-12", "2025-12", 41613.22],
  ]);
  assert.ok(result.notes.some((note) => note.includes("dos temporadas")));
});
