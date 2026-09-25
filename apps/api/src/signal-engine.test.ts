import { test } from "node:test";
import assert from "node:assert/strict";
import { seriesPorMetrica } from "./signal-engine.js";

test("ticket medio y conversion saltan los dias sin denominador en vez de contarlos como cero", () => {
  const series = seriesPorMetrica(
    [
      { bucket_date: "2026-09-01", net_sales: 300, orders_count: 3 },
      { bucket_date: "2026-09-02", net_sales: 0, orders_count: 0 },
      { bucket_date: "2026-09-03", net_sales: 200, orders_count: 4 },
    ],
    new Map([
      ["2026-09-01", 100],
      ["2026-09-02", 80],
    ]),
  );

  assert.equal(series.net_sales.length, 3);
  assert.deepEqual(
    series.average_order_value.map((p) => [p.date, p.value]),
    [
      ["2026-09-01", 100],
      ["2026-09-03", 50],
    ],
  );
  // El 3 no tiene fila de sesiones: no se pidio, no es trafico cero.
  assert.deepEqual(
    series.sessions.map((p) => p.date),
    ["2026-09-01", "2026-09-02"],
  );
  assert.deepEqual(
    series.conversion_rate.map((p) => [p.value, p.sample]),
    [
      [0.03, 100],
      [0, 80],
    ],
  );
});
