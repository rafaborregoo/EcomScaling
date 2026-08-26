import assert from "node:assert/strict";
import test from "node:test";
import { embedChunksInOrder } from "./embedding-batching.js";

test("la ingesta de embeddings limita I/O y conserva el orden de chunks", async () => {
  let active = 0;
  let maxActive = 0;
  const result = await embedChunksInOrder(
    ["a", "b", "c", "d", "e"],
    {
      async embed(batch) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, batch[0] === "a" ? 15 : 1));
        active -= 1;
        return batch.map((value) => [value.charCodeAt(0)]);
      },
    },
    1,
    2,
  );

  assert.equal(maxActive, 2);
  assert.deepEqual(result, [[97], [98], [99], [100], [101]]);
});

test("la ingesta no crea peticiones para contenido vacío", async () => {
  let calls = 0;
  const result = await embedChunksInOrder([], {
    async embed() {
      calls += 1;
      return [];
    },
  });

  assert.deepEqual(result, []);
  assert.equal(calls, 0);
});
