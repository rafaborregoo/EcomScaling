/**
 * El titular del panel del cliente.
 *
 * Es la única frase que mucha gente va a leer, así que decir lo contrario de
 * la realidad no es un detalle estético. El caso peligroso es vender más y
 * ganar menos: comparando solo ventas, el panel felicitaría a alguien que está
 * perdiendo dinero.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { storePulse, salesChangePct, canShowProfit } from "./store-pulse";

const base = {
  netSales: 10_000,
  netProfit: 1_000,
  hasFinancialSettings: true,
  previousNetSales: 8_000,
};

test("vender más perdiendo dinero NO es una buena semana", () => {
  const pulse = storePulse({ ...base, netProfit: -500 });
  assert.equal(pulse.tone, "danger");
  assert.match(pulse.headline, /por debajo de tus costes/);
  // Y la subida se menciona, para que no parezca que el panel no la ve.
  assert.match(pulse.detail ?? "", /suben un 25%/);
});

test("subir y ganar dinero sí lo es", () => {
  const pulse = storePulse(base);
  assert.equal(pulse.tone, "success");
  assert.match(pulse.detail ?? "", /25%/);
});

test("una caída se dice en positivo y sin signo raro", () => {
  const pulse = storePulse({ ...base, netSales: 6_000 });
  assert.equal(pulse.tone, "warn");
  // "caen un 25%", no "caen un -25%".
  assert.match(pulse.detail ?? "", /caen un 25%/);
});

test("un movimiento pequeño es estabilidad, no una tendencia", () => {
  const pulse = storePulse({ ...base, netSales: 8_100 });
  assert.equal(pulse.tone, "neutral");
  assert.match(pulse.headline, /estable/);
});

test("sin periodo anterior no se inventa una tendencia", () => {
  const pulse = storePulse({ ...base, previousNetSales: null });
  assert.equal(pulse.tone, "neutral");
  assert.match(pulse.headline, /Primeros datos/);

  const vacio = storePulse({
    ...base,
    netSales: 0,
    netProfit: 0,
    previousNetSales: null,
  });
  assert.match(vacio.headline, /sin ventas/i);
});

test("un periodo anterior de casi cero no genera un +9000%", () => {
  // Dividir entre una base minúscula da porcentajes absurdos que el cliente
  // lee como reales.
  assert.equal(salesChangePct(900, 0), null);
  assert.equal(salesChangePct(900, 0.4), null);
  assert.equal(salesChangePct(900, null), null);
});

test("sin configuración financiera el beneficio no manda ni se enseña", () => {
  // Un beneficio calculado sin costes de producto ni gastos fijos saldría
  // negativo o positivo por accidente: no se usa para el titular...
  const pulse = storePulse({
    ...base,
    hasFinancialSettings: false,
    netProfit: -9_999,
  });
  assert.notEqual(pulse.tone, "danger", "un beneficio sin costes no decide el titular");

  // ...ni se enseña como cifra.
  assert.equal(
    canShowProfit({ hasFinancialSettings: false, itemsWithoutCost: 0, linesWithoutNetMetrics: 0 }),
    false,
  );
  assert.equal(
    canShowProfit({ hasFinancialSettings: true, itemsWithoutCost: 4, linesWithoutNetMetrics: 0 }),
    false,
    "con productos sin coste el margen está incompleto",
  );
  assert.equal(
    canShowProfit({ hasFinancialSettings: true, itemsWithoutCost: 0, linesWithoutNetMetrics: 0 }),
    true,
  );
});
