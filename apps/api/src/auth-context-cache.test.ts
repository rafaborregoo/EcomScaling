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

test("pasados 15 s se renueva detrás sin hacer esperar, y un fallo no cambia la cota de caducidad", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const token = tokenExpiringIn(3600);
  let calls = 0;
  let fail = false;
  const resolve = async (): Promise<AuthContextResult> => {
    calls += 1;
    return fail ? { ok: false, error: { statusCode: 503, error: "supabase_down" } } : { ok: true, context };
  };
  const tick = () => new Promise((done) => setImmediate(done));

  await withAuthContextCache(token, resolve);
  assert.equal(calls, 1);

  t.mock.timers.tick(10_000); // aún fresco: nada que renovar
  await withAuthContextCache(token, resolve);
  assert.equal(calls, 1);

  t.mock.timers.tick(6_000); // 16 s: sirve el de caché y renueva detrás
  fail = true;
  const served = await withAuthContextCache(token, resolve);
  assert.ok(served.ok);
  await tick();
  assert.equal(calls, 2);

  t.mock.timers.tick(10_000); // 26 s: el fallo no cacheó nada; el original sigue valiendo
  assert.ok((await withAuthContextCache(token, resolve)).ok);

  t.mock.timers.tick(6_000); // 32 s: caducó (cota de 30 s intacta) → resuelve y ve el fallo
  const expired = await withAuthContextCache(token, resolve);
  assert.equal(expired.ok, false);
});
