import assert from "node:assert/strict";
import test from "node:test";
import { createSingleFlight } from "./single-flight.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("comparte una ejecución entre llamadas concurrentes con la misma clave", async () => {
  const run = createSingleFlight<number>();
  let calls = 0;
  const factory = async () => {
    calls += 1;
    await wait(10);
    return 42;
  };

  const values = await Promise.all([
    run("org:agent:store:30", factory),
    run("org:agent:store:30", factory),
    run("org:agent:store:30", factory),
  ]);

  assert.deepEqual(values, [42, 42, 42]);
  assert.equal(calls, 1);
});

test("libera la clave después de resolver y separa claves distintas", async () => {
  const run = createSingleFlight<number>();
  let calls = 0;
  const factory = async () => ++calls;

  assert.equal(await run("a", factory), 1);
  assert.equal(await run("a", factory), 2);
  assert.equal(await run("b", factory), 3);
});

test("libera la clave después de un rechazo para permitir reintento", async () => {
  const run = createSingleFlight<number>();
  let calls = 0;

  await assert.rejects(
    run("unstable", async () => {
      calls += 1;
      throw new Error("transient");
    }),
    /transient/,
  );
  assert.equal(await run("unstable", async () => ++calls), 2);
});
