import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertStoreLimit } from "./shopify.js";

/**
 * Stub encadenable: `assertStoreLimit` recibe el cliente por parametro, asi que
 * el limite se puede probar entero sin base de datos. Cada tabla devuelve lo
 * que le digan y `rpc` devuelve el conteo.
 */
function stub(options: {
  storeLimit: number | null;
  existingConnection?: boolean;
  used?: number;
  countFails?: boolean;
}) {
  const chain = (result: { data: unknown; error: unknown }) => {
    const node: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit"]) {
      node[method] = () => node;
    }
    node.maybeSingle = async () => result;
    return node;
  };

  return {
    from(table: string) {
      if (table === "service_subscriptions") {
        return chain({
          data:
            options.storeLimit === null
              ? { store_limit: null }
              : { store_limit: options.storeLimit },
          error: null,
        });
      }
      return chain({
        data: options.existingConnection ? { id: "conn-1" } : null,
        error: null,
      });
    },
    async rpc() {
      return options.countFails
        ? { data: null, error: { message: "boom" } }
        : { data: options.used ?? 0, error: null };
    },
  } as unknown as SupabaseClient;
}

const run = (client: SupabaseClient) =>
  assertStoreLimit(client, "org-1", "tienda-nueva.myshopify.com");

test("sin limite en el plan no bloquea nunca", async () => {
  assert.equal(await run(stub({ storeLimit: null, used: 99 })), null);
});

test("por debajo del limite deja conectar", async () => {
  assert.equal(await run(stub({ storeLimit: 3, used: 2 })), null);
});

test("al alcanzar el limite bloquea con el plan y el uso en el mensaje", async () => {
  const result = await run(stub({ storeLimit: 2, used: 2 }));

  assert.notEqual(result, null);
  assert.equal(result?.statusCode, 409);
  assert.equal(result?.error, "store_limit_reached");
  assert.match(result?.message ?? "", /2 tiendas/);
});

// Reinstalar la app o renovar un token caducado vuelve a pasar por aqui con una
// tienda que ya estaba: no puede toparse con el limite y dejar al cliente sin
// poder reconectar lo que ya paga.
test("reconectar una tienda existente no consume cupo", async () => {
  assert.equal(
    await run(stub({ storeLimit: 2, used: 2, existingConnection: true })),
    null,
  );
});

// Un fallo de lectura no puede dejar a un cliente sin conectar: una tienda de
// mas se ve en la factura y se corrige, un bloqueo por error no.
test("si el conteo falla no bloquea", async () => {
  assert.equal(await run(stub({ storeLimit: 1, countFails: true })), null);
});

test("el mensaje usa singular con un plan de una tienda", async () => {
  const result = await run(stub({ storeLimit: 1, used: 1 }));

  assert.match(result?.message ?? "", /1 tienda y/);
});
