/**
 * El contexto de auth se resuelve en TODA ruta autenticada y una sola pantalla
 * del portal dispara ~10 peticiones simultaneas con el mismo token. Este test
 * fija las tres propiedades que hacen que esa rafaga cueste una resolucion y
 * no diez, sin cachear de mas.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearAuthContextCache,
  withAuthContextCache,
  type AuthContext,
  type AuthContextResult,
} from "./auth-context.js";

const context = {
  user: { id: "user-1" },
  profile: {
    id: "user-1",
    full_name: null,
    avatar_url: null,
    platform_role: "client",
    is_active: true,
  },
  memberships: [],
  subscriptions: [],
} as unknown as AuthContext;

function tokenExpiringIn(seconds: number) {
  const payload = Buffer.from(
    JSON.stringify({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

beforeEach(() => {
  clearAuthContextCache();
});

test("una rafaga simultanea con el mismo token resuelve una sola vez", async () => {
  const token = tokenExpiringIn(3600);
  let calls = 0;
  const resolve = async (): Promise<AuthContextResult> => {
    calls += 1;
    await new Promise((done) => setTimeout(done, 10));
    return { ok: true, context };
  };

  const results = await Promise.all(
    Array.from({ length: 10 }, () => withAuthContextCache(token, resolve)),
  );

  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.ok));

  // Y la siguiente peticion ya sale de cache, no de la red.
  await withAuthContextCache(token, resolve);
  assert.equal(calls, 1);
});

test("un fallo no se cachea: el siguiente intento vuelve a resolver", async () => {
  const token = tokenExpiringIn(3600);
  let calls = 0;
  const failing = async (): Promise<AuthContextResult> => {
    calls += 1;
    return { ok: false, error: { statusCode: 500, error: "profile_load_failed" } };
  };

  await withAuthContextCache(token, failing);
  await withAuthContextCache(token, failing);

  assert.equal(calls, 2);
});

test("un token ya caducado no se cachea", async () => {
  const token = tokenExpiringIn(-1);
  let calls = 0;
  const resolve = async (): Promise<AuthContextResult> => {
    calls += 1;
    return { ok: true, context };
  };

  await withAuthContextCache(token, resolve);
  await withAuthContextCache(token, resolve);

  assert.equal(calls, 2);
});
