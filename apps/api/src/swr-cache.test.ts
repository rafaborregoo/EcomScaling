import assert from "node:assert/strict";
import test from "node:test";
import { createSwrCache, type SwrStore } from "./swr-cache.js";

const memory = () => {
  const data = new Map<string, unknown>();
  const store: SwrStore = {
    get: async <T>(key: string) => (data.get(key) as T) ?? null,
    set: async (key, value) => void data.set(key, value),
  };
  return { store, data };
};
const ok = (n: number) => ({ ok: true as const, n });
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test("a changed integration revision refreshes a fresh entry once while retaining the visible snapshot", async () => {
  const { store } = memory();
  const swr = createSwrCache(() => 1000);
  let loads = 0;
  const run = (revision: string) => swr({ store, key: "live", revision, freshSeconds: 60, staleSeconds: 600,
    load: async () => { await tick(); return ok(++loads); } });
  assert.equal((await run("before")).n, 1);
  const snapshots = await Promise.all([run("after"), run("after"), run("after")]);
  assert.deepEqual(snapshots.map((value) => value.n), [1, 1, 1]);
  await tick(); await tick();
  assert.equal((await run("after")).n, 2);
  assert.equal(loads, 2);
});

test("una copia fresca no vuelve a calcular", async () => {
  let clock = 0;
  const swr = createSwrCache(() => clock);
  const st = memory().store;
  let loads = 0;
  const run = () => swr({ store: st, key: "k", freshSeconds: 60, staleSeconds: 600, load: async () => ok(++loads) });
  assert.equal((await run()).n, 1);
  clock = 30_000;
  assert.equal((await run()).n, 1);
  assert.equal(loads, 1);
});

test("una copia caducada se sirve al instante y se refresca detrás", async () => {
  let clock = 0;
  const swr = createSwrCache(() => clock);
  const st = memory().store;
  let loads = 0;
  const run = () => swr({ store: st, key: "k", freshSeconds: 60, staleSeconds: 600, load: async () => ok(++loads) });
  await run();
  clock = 120_000;
  assert.equal((await run()).n, 1); // la vieja, sin esperar
  await tick();
  assert.equal(loads, 2);
  assert.equal((await run()).n, 2); // la refrescada
});

test("fuera de la ventana se recalcula, y los simultáneos comparten cálculo", async () => {
  let clock = 0;
  const swr = createSwrCache(() => clock);
  const st = memory().store;
  let loads = 0;
  const run = () => swr({ store: st, key: "k", freshSeconds: 60, staleSeconds: 600, load: async () => { await tick(); return ok(++loads); } });
  const first = await Promise.all([run(), run(), run()]);
  assert.deepEqual(first.map((r) => r.n), [1, 1, 1]);
  clock = 10_000_000;
  assert.equal((await run()).n, 2);
});

test("un fallo no se guarda ni pisa la copia buena", async () => {
  let clock = 0;
  const { store: st, data } = memory();
  const swr = createSwrCache(() => clock);
  const failing = await swr({ store: st, key: "k", freshSeconds: 60, staleSeconds: 600, load: async () => ({ ok: false as const }) });
  assert.equal(failing.ok, false);
  assert.equal(data.size, 0);

  await swr({ store: st, key: "k", freshSeconds: 60, staleSeconds: 600, load: async () => ok(7) });
  clock = 120_000;
  const stale = await swr({ store: st, key: "k", freshSeconds: 60, staleSeconds: 600, load: async () => ({ ok: false as const }) });
  assert.ok("n" in stale);
  assert.equal(stale.n, 7);
  await tick();
  clock = 130_000;
  assert.equal(((await swr({ store: st, key: "k", freshSeconds: 60, staleSeconds: 600, load: async () => ok(9) })) as { n: number }).n, 7);
});
