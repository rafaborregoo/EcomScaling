import assert from "node:assert/strict";
import test from "node:test";
import { fetchWorkerWithResilience } from "./worker-http.js";

test("reintenta respuestas transitorias y respeta Retry-After", async () => {
  let calls = 0;
  const delays: number[] = [];
  const response = await fetchWorkerWithResilience("https://api.test/reconcile", {}, {
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response("busy", { status: 503, headers: { "Retry-After": "2" } })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    sleepImpl: async (ms) => {
      delays.push(ms);
    },
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2_000]);
});

test("no reintenta errores permanentes", async () => {
  let calls = 0;
  const response = await fetchWorkerWithResilience("https://api.test/reconcile", {}, {
    fetchImpl: async () => {
      calls += 1;
      return new Response("forbidden", { status: 403 });
    },
    sleepImpl: async () => {
      throw new Error("no debe esperar");
    },
  });

  assert.equal(response.status, 403);
  assert.equal(calls, 1);
});

test("reintenta fallos de red con un máximo fijo", async () => {
  let calls = 0;
  const delays: number[] = [];
  await assert.rejects(
    () => fetchWorkerWithResilience("https://api.test/reconcile", {}, {
      maxRetries: 2,
      fetchImpl: async () => {
        calls += 1;
        throw new Error("network down");
      },
      sleepImpl: async (ms) => {
        delays.push(ms);
      },
    }),
    /network down/,
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [500, 1_000]);
});
