import assert from "node:assert/strict";
import test from "node:test";
import { combineMetricRpcs } from "./ai-runtime.js";

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fails = (message: string) =>
  Promise.resolve({ data: null, error: { message } });

test("una funcion de fila unica se desenvuelve del array", async () => {
  const result = await combineMetricRpcs({
    recurrencia: ok([{ new_orders: 3 }]),
  });

  assert.deepEqual(result.data.recurrencia, { new_orders: 3 });
  assert.equal(result.error, null);
});

test("una funcion de varias filas se deja como lista", async () => {
  const result = await combineMetricRpcs({
    cohortes: ok([{ mes: "2026-06" }, { mes: "2026-07" }]),
  });

  assert.equal((result.data.cohortes as unknown[]).length, 2);
});

test("una metrica rota no se lleva por delante a las que funcionan", async () => {
  const result = await combineMetricRpcs({
    recurrencia: ok([{ new_orders: 3 }]),
    cohortes: fails("relation does not exist"),
  });

  assert.deepEqual(result.data.recurrencia, { new_orders: 3 });
  assert.equal(result.data.cohortes, "no_disponible");
  // Con algo util que devolver, el modelo recibe los datos y la marca, no un
  // error opaco que le haria decir que no sabe nada.
  assert.equal(result.error, null);
});

test("si fallan todas, el error se propaga", async () => {
  const result = await combineMetricRpcs({
    recurrencia: fails("permission denied"),
    cohortes: fails("timeout"),
  });

  assert.notEqual(result.error, null);
  assert.match(result.error!.message, /recurrencia: permission denied/);
});

test("el error que se propaga es el primero, no el ultimo", async () => {
  const result = await combineMetricRpcs({
    entregas: fails("primero"),
    devoluciones: fails("segundo"),
  });

  assert.match(result.error!.message, /primero/);
});

test("una funcion sin filas es un resultado valido, no un fallo", async () => {
  const result = await combineMetricRpcs({
    devoluciones: ok([]),
  });

  assert.deepEqual(result.data.devoluciones, []);
  assert.equal(result.error, null);
});

test("data null se trata como lista vacia y no revienta", async () => {
  const result = await combineMetricRpcs({
    entregas: Promise.resolve({ data: null, error: null }),
  });

  assert.deepEqual(result.data.entregas, []);
  assert.equal(result.error, null);
});
