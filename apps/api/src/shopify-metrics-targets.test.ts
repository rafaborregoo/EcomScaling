import assert from "node:assert/strict";
import test from "node:test";
import { selectCurrentTargets } from "./shopify-metrics.js";

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
