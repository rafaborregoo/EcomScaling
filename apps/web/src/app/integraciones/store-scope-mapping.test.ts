/**
 * A que tienda pertenece la conexion que estas configurando.
 *
 * El caso que importa es Meta: una sola conexion OAuth puede servir a varias
 * tiendas (una cuenta publicitaria por tienda dentro del mismo portfolio). Si
 * el mapa resolviera esa conexion a "la primera tienda que aparezca", la
 * interfaz diria "esta cuenta es de la tienda A" sobre algo que tambien mueve
 * dinero de la B -- mentir con seguridad es peor que no decir nada.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { storesByConnection, type ScopeAccount, type ScopeStore } from "./store-scope-model";

const tiendaA: ScopeStore = {
  id: "store-a",
  connection_id: "conn-shopify-a",
  myshopify_domain: "a.myshopify.com",
  shop_name: "Tienda A",
};
const tiendaB: ScopeStore = {
  id: "store-b",
  connection_id: "conn-shopify-b",
  myshopify_domain: "b.myshopify.com",
  shop_name: "Tienda B",
};

function account(partial: Partial<ScopeAccount> & { id: string }): ScopeAccount {
  return { connection_id: "conn-meta", store_id: null, ...partial };
}

test("una conexion con cuentas de una sola tienda se resuelve a esa tienda", () => {
  const map = storesByConnection(
    [
      account({ id: "acc-1", connection_id: "conn-meta", store_id: "store-a" }),
      account({ id: "acc-2", connection_id: "conn-meta", store_id: "store-a" }),
    ],
    [tiendaA, tiendaB],
  );

  assert.equal(map.get("conn-meta")?.id, "store-a");
});

test("una conexion que sirve a dos tiendas no se atribuye a ninguna", () => {
  const map = storesByConnection(
    [
      account({ id: "acc-1", connection_id: "conn-meta", store_id: "store-a" }),
      account({ id: "acc-2", connection_id: "conn-meta", store_id: "store-b" }),
    ],
    [tiendaA, tiendaB],
  );

  assert.equal(map.has("conn-meta"), false);
});

test("el orden de las cuentas no cambia el resultado ambiguo", () => {
  const cuentas = [
    account({ id: "acc-1", connection_id: "conn-meta", store_id: "store-b" }),
    account({ id: "acc-2", connection_id: "conn-meta", store_id: "store-a" }),
  ];

  assert.equal(storesByConnection(cuentas, [tiendaA, tiendaB]).has("conn-meta"), false);
  assert.equal(
    storesByConnection([...cuentas].reverse(), [tiendaA, tiendaB]).has("conn-meta"),
    false,
  );
});

test("las cuentas sin asignar no atribuyen la conexion a nadie", () => {
  const map = storesByConnection(
    [account({ id: "acc-1", connection_id: "conn-meta", store_id: null })],
    [tiendaA],
  );

  assert.equal(map.has("conn-meta"), false);
});

test("una cuenta que apunta a una tienda que ya no existe se ignora", () => {
  const map = storesByConnection(
    [
      account({
        id: "acc-1",
        connection_id: "conn-meta",
        store_id: "store-borrada",
      }),
    ],
    [tiendaA],
  );

  assert.equal(map.has("conn-meta"), false);
});
