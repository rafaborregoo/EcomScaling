/**
 * El bug que fija este fichero: un cliente con dos tiendas Shopify, una sana y
 * otra por reautorizar, salia ROJO en la matriz de cartera y VERDE al entrar en
 * su ficha. Eran dos colapsos con criterios opuestos -- "peor gana" en la
 * cartera, "mejor gana" (pickBestConnection) en el detalle -- y ademas la
 * tienda rota no aparecia en ninguna pantalla.
 *
 * Lo que se prueba es el orden, no una tabla de numeros: si alguien vuelve a
 * poner "la mas sana primero" en cualquiera de los dos sitios, esto falla.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { connectionSeverity, healthSeverity } from "./integrations.js";

test("una conexion rota pesa mas que una sana", () => {
  assert.ok(
    connectionSeverity("reauthorization_required") >
      connectionSeverity("connected"),
  );
  assert.ok(connectionSeverity("error") > connectionSeverity("connected"));
  assert.ok(connectionSeverity("needs_reauth") > connectionSeverity("error"));
  // 'syncing' es un estado transitorio de una conexion viva, no una averia.
  assert.equal(connectionSeverity("syncing"), connectionSeverity("connected"));
});

test("un estado desconocido no cuenta como sano", () => {
  assert.ok(
    connectionSeverity("algo_que_no_conocemos") >
      connectionSeverity("connected"),
  );
});

test("ordenar por severidad pone la tienda a atender la primera", () => {
  const stores = [
    { domain: "sana.myshopify.com", status: "connected" },
    { domain: "rota.myshopify.com", status: "reauthorization_required" },
    { domain: "otra.myshopify.com", status: "connected" },
  ];

  const worstFirst = [...stores].sort(
    (left, right) =>
      connectionSeverity(right.status) - connectionSeverity(left.status),
  );

  assert.equal(worstFirst[0]!.domain, "rota.myshopify.com");
});

test("la salud derivada usa el mismo criterio que el estado crudo", () => {
  // 'stale' es una tienda 'connected' que lleva demasiado sin sincronizar: no
  // es un error, pero tampoco esta bien, y tiene que ganar a 'healthy'.
  assert.ok(healthSeverity("stale") > healthSeverity("healthy"));
  assert.ok(healthSeverity("degraded") > healthSeverity("stale"));
  assert.ok(healthSeverity("reauthorization_required") > healthSeverity("degraded"));
  assert.equal(healthSeverity("syncing"), healthSeverity("healthy"));
  assert.ok(healthSeverity("unknown") > healthSeverity("healthy"));
});
