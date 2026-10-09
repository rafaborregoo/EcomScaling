/**
 * `concesionDesde` es el punto exacto donde un plan ya guardado (ISO
 * completo, `store_limit` null = sin limite) se convierte en lo que pinta el
 * formulario (input type="date", checkbox). Si se rompe, la ficha de un
 * consultor o cliente muestra una fecha desplazada o "1 tienda" donde en
 * realidad no hay limite -- y "Guardar plan" reenviaria ese valor equivocado.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  concesionDesde,
  concesionInicial,
  concesionValida,
  grantPlanBody,
} from "./concesion-de-plan-model.js";

test("un plan sin limite se marca sinLimite, no '1'", () => {
  const valor = concesionDesde({
    plan_code: "consultant",
    store_limit: null,
    ends_at: null,
  });
  assert.equal(valor.sinLimite, true);
  assert.equal(valor.conceder, true);
});

test("la fecha ISO completa se recorta a lo que quiere el input date", () => {
  const valor = concesionDesde({
    plan_code: "starter",
    store_limit: 2,
    ends_at: "2026-12-31T00:00:00.000Z",
  });
  assert.equal(valor.endsAt, "2026-12-31");
  assert.equal(valor.storeLimit, "2");
});

test("ida y vuelta: cargar un plan y guardarlo sin tocar nada da el mismo cuerpo", () => {
  const cargado = concesionDesde({
    plan_code: "consultant",
    store_limit: 3,
    ends_at: null,
  });
  const cuerpo = grantPlanBody(cargado);
  assert.deepEqual(cuerpo, {
    plan_code: "consultant",
    store_limit: 3,
    member_limit: null,
  });
});

test("no conceder nada al dar de alta no manda cuerpo", () => {
  const valor = { ...concesionInicial("starter", false) };
  assert.equal(grantPlanBody(valor), null);
  assert.equal(concesionValida(valor), true);
});

test("conceder sin código de plan no es válido", () => {
  const valor = { ...concesionInicial("", true) };
  assert.equal(concesionValida(valor), false);
});
