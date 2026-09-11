/**
 * Lo que decide si una consulta de agente deja rastro de acceso a datos de
 * cliente. Si esto devuelve vacio de mas, la lectura ocurre igual pero no queda
 * registrada -- que es justo el agujero que el registro viene a tapar.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  PROTECTED_DATA_ACTION_PREFIX,
  protectedTablesTouched,
} from "./protected-data-access.js";

test("detecta la tabla de clientes entre otras que no lo son", () => {
  assert.deepEqual(
    protectedTablesTouched([
      "shopify_products",
      "shopify_customers",
      "meta_campaigns",
    ]),
    ["shopify_customers"],
  );
});

test("una consulta que no toca clientes no genera acceso protegido", () => {
  assert.deepEqual(
    protectedTablesTouched(["shopify_products", "shopify_order_facts"]),
    [],
  );
});

test("el gateway expone las vistas con esquema por delante", () => {
  // El SQL Gateway consulta `ai.shopify_customers`, no `shopify_customers`:
  // comparar el nombre entero dejaba fuera todas las lecturas reales.
  assert.deepEqual(protectedTablesTouched(["ai.shopify_customers"]), [
    "shopify_customers",
  ]);
});

test("no se repite si la misma tabla aparece varias veces", () => {
  assert.deepEqual(
    protectedTablesTouched([
      "shopify_customers",
      "ai.shopify_customers",
      "shopify_customers",
    ]),
    ["shopify_customers"],
  );
});

test("el prefijo de accion es estable: por el se filtra el registro", () => {
  // Cambiarlo rompe la consulta con la que se demuestra el cumplimiento ante
  // Shopify, asi que se fija aqui a proposito.
  assert.equal(PROTECTED_DATA_ACTION_PREFIX, "protected_data.");
});
