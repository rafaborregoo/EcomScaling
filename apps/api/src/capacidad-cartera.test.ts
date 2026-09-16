/**
 * La capacidad de cartera es lo que separa "vendemos 3 plazas" de "el
 * consultor da de alta los que quiera y la factura se entera despues". Lo que
 * se prueba aqui es la aritmetica y el mensaje: el resto (contar clientes y
 * codigos pendientes) vive en SQL, en una sola funcion, a proposito.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  describeCapacidad,
  sinPlazasDisponibles,
} from "./capacidad-cartera.js";

test("las plazas libres son las contratadas menos las ocupadas", () => {
  const capacidad = describeCapacidad({ contracted: 5, occupied: 3 });
  assert.equal(capacidad.available, 2);
});

test("pasarse de plazas no da capacidad negativa", () => {
  // Puede pasar de verdad: se baja el plan de 5 a 3 con 4 clientes dentro.
  // Un -1 en pantalla no significa nada; lo que significa es "ninguna".
  const capacidad = describeCapacidad({ contracted: 3, occupied: 4 });
  assert.equal(capacidad.available, 0);
});

test("sin plazas contratadas no hay ninguna disponible", () => {
  assert.equal(describeCapacidad({ contracted: 0, occupied: 0 }).available, 0);
});

test("el mensaje de plan sin cartera no habla de plazas ocupadas", () => {
  const denegado = sinPlazasDisponibles(
    describeCapacidad({ contracted: 0, occupied: 0 }),
  );
  assert.equal(denegado.statusCode, 409);
  assert.equal(denegado.error, "portfolio_capacity_reached");
  assert.match(denegado.message, /no incluye plazas/);
});

test("el mensaje de cartera llena dice cuantas plazas hay y cuantas gastadas", () => {
  const denegado = sinPlazasDisponibles(
    describeCapacidad({ contracted: 3, occupied: 3 }),
  );
  assert.match(denegado.message, /3 plazas/);
  assert.match(denegado.message, /3 entre clientes activos/);
});
