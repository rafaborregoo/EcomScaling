import assert from "node:assert/strict";
import test from "node:test";
import {
  selectCurrentTargets,
  shiftOneYearBack,
} from "./shopify-metrics.js";

// F3 del panel del manager: los objetivos por metrica viajan en el payload de
// metricas para que cada tarjeta pueda decir "vs objetivo". Una cifra sin
// objetivo no dice si va bien o mal, que es la mitad de su utilidad.
//
// `organization_metric_targets` es historico: una misma metrica puede tener
// varias filas con distintos `valid_from`. La consulta las pide ordenadas de
// mas reciente a mas antigua y esta funcion se queda con la vigente.

const HOY = "2026-09-15";

test("gana el objetivo mas reciente de cada metrica", () => {
  const targets = selectCurrentTargets(
    [
      { metric_key: "recurrencia", target_value: 30, period: "monthly", valid_until: null },
      { metric_key: "recurrencia", target_value: 20, period: "monthly", valid_until: null },
    ],
    HOY,
  );

  assert.deepEqual(targets, [
    { metric_key: "recurrencia", target_value: 30, period: "monthly" },
  ]);
});

test("un objetivo caducado no se muestra", () => {
  const targets = selectCurrentTargets(
    [
      { metric_key: "cac", target_value: 8, period: "monthly", valid_until: "2026-06-30" },
      { metric_key: "cac", target_value: 11.37, period: "monthly", valid_until: null },
    ],
    HOY,
  );

  assert.deepEqual(targets, [
    { metric_key: "cac", target_value: 11.37, period: "monthly" },
  ]);
});

test("el ultimo dia de vigencia todavia cuenta", () => {
  const targets = selectCurrentTargets(
    [{ metric_key: "aov", target_value: 60, period: "monthly", valid_until: HOY }],
    HOY,
  );

  assert.equal(targets.length, 1, "caduca al acabar el dia, no al empezarlo");
});

test("la misma metrica con dos periodicidades convive", () => {
  // "30% de recurrencia al mes" y "35% al ano" son objetivos distintos, no una
  // version vieja del otro: la clave es metrica + periodicidad.
  const targets = selectCurrentTargets(
    [
      { metric_key: "recurrencia", target_value: 30, period: "monthly", valid_until: null },
      { metric_key: "recurrencia", target_value: 35, period: "yearly", valid_until: null },
    ],
    HOY,
  );

  assert.equal(targets.length, 2);
});

test("sin objetivos devuelve lista vacia, no revienta", () => {
  assert.deepEqual(selectCurrentTargets([], HOY), []);
});

// F6: la comparacion contra el mismo periodo del ano anterior.

test("el desplazamiento de un ano es por calendario, no restando 365 dias", () => {
  // Agosto se compara con agosto. Restando 365 dias fijos, un ano bisiesto de
  // por medio corre la ventana un dia.
  const shifted = shiftOneYearBack(new Date("2026-08-15T10:30:00.000Z"));
  assert.equal(shifted.toISOString(), "2025-08-15T10:30:00.000Z");
});

test("cruzar un ano bisiesto no mueve el dia del mes", () => {
  const shifted = shiftOneYearBack(new Date("2025-03-01T00:00:00.000Z"));
  assert.equal(
    shifted.toISOString(),
    "2024-03-01T00:00:00.000Z",
    "2024 fue bisiesto: restar 365 dias habria dado el 2 de marzo",
  );
});

test("el 29 de febrero se lleva al 28, no se desborda a marzo", () => {
  const shifted = shiftOneYearBack(new Date("2024-02-29T12:00:00.000Z"));
  assert.equal(
    shifted.toISOString(),
    "2023-02-28T12:00:00.000Z",
    "setUTCFullYear por si solo habria devuelto el 1 de marzo, que ya es otro mes",
  );
});

test("la fecha original no se modifica", () => {
  const original = new Date("2026-08-15T10:30:00.000Z");
  shiftOneYearBack(original);
  assert.equal(original.toISOString(), "2026-08-15T10:30:00.000Z");
});
