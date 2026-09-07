process.env.TZ = "Europe/Madrid";

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  lastClosedPeriod,
  periodDays,
  withDeltas,
} from "./snapshot-period";

test("la semana que se captura es la ANTERIOR, no la que está corriendo", () => {
  // La clave del snapshot incluye las fechas: capturar la semana en curso el
  // martes y otra vez el jueves pisaría la misma fila con cifras distintas, y
  // el histórico dejaría de significar nada.
  const miercoles = new Date(2026, 8, 9); // 9 sep 2026, miércoles
  assert.deepEqual(lastClosedPeriod("weekly", miercoles), {
    start: "2026-08-31",
    end: "2026-09-06",
  });
});

test("el domingo cierra la semana, no la abre", () => {
  // getDay() devuelve 0 el domingo: sin corregirlo, el domingo saltaba una
  // semana entera hacia atrás.
  const domingo = new Date(2026, 8, 6);
  assert.deepEqual(lastClosedPeriod("weekly", domingo), {
    start: "2026-08-24",
    end: "2026-08-30",
  });
  const lunes = new Date(2026, 8, 7);
  assert.deepEqual(lastClosedPeriod("weekly", lunes), {
    start: "2026-08-31",
    end: "2026-09-06",
  });
});

test("el mes cerrado es el anterior completo, con su último día real", () => {
  assert.deepEqual(lastClosedPeriod("monthly", new Date(2026, 8, 9)), {
    start: "2026-08-01",
    end: "2026-08-31",
  });
  // Febrero y los meses de 30 días: el último día no se calcula, se deriva.
  assert.deepEqual(lastClosedPeriod("monthly", new Date(2026, 2, 15)), {
    start: "2026-02-01",
    end: "2026-02-28",
  });
  assert.deepEqual(lastClosedPeriod("monthly", new Date(2026, 0, 15)), {
    start: "2025-12-01",
    end: "2025-12-31",
  });
});

test("los días del periodo incluyen los dos extremos", () => {
  assert.equal(periodDays({ start: "2026-08-31", end: "2026-09-06" }), 7);
  assert.equal(periodDays({ start: "2026-08-01", end: "2026-08-31" }), 31);
  assert.equal(periodDays({ start: "2026-09-06", end: "2026-09-01" }), 0);
});

test("la variación compara con el periodo anterior, no con la fila de al lado", () => {
  // Llegan desordenados a propósito: el backend no garantiza orden.
  const rows = withDeltas([
    { id: "julio", period_start: "2026-07-01", period_end: "2026-07-31", net_sales: 1000, roas: null, net_profit: null },
    { id: "agosto", period_start: "2026-08-01", period_end: "2026-08-31", net_sales: 1500, roas: null, net_profit: null },
    { id: "junio", period_start: "2026-06-01", period_end: "2026-06-30", net_sales: 800, roas: null, net_profit: null },
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    ["agosto", "julio", "junio"],
    "del más reciente al más antiguo",
  );
  assert.equal(rows[0]?.salesDelta, 50); // 1500 vs 1000
  assert.equal(rows[1]?.salesDelta, 25); // 1000 vs 800
  assert.equal(rows[2]?.salesDelta, null, "el más antiguo no tiene contra qué");
});

test("un periodo sin ventas no inventa una variación", () => {
  // Dividir entre cero da Infinity y se pintaría como "∞%".
  const rows = withDeltas([
    { id: "b", period_start: "2026-08-01", period_end: "2026-08-31", net_sales: 500, roas: null, net_profit: null },
    { id: "a", period_start: "2026-07-01", period_end: "2026-07-31", net_sales: 0, roas: null, net_profit: null },
  ]);
  assert.equal(rows[0]?.salesDelta, null);
});
