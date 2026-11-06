import assert from "node:assert/strict";
import test from "node:test";
import { createGatedFetch, retryAbortedTransaction } from "./request-gate.js";

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("una transacción abortada se repite, también al escribir; otro 500 no", async () => {
  const aborted = () => new Response('{"code":"25P02"}', { status: 500 });
  let calls = 0;
  const recovers = retryAbortedTransaction((async () => (++calls < 3 ? aborted() : new Response("ok"))) as typeof fetch, 4, 1);
  assert.equal((await recovers("http://x", { method: "POST" })).status, 200);
  assert.equal(calls, 3);

  calls = 0;
  const other = retryAbortedTransaction((async () => { calls += 1; return new Response('{"code":"57014"}', { status: 500 }); }) as typeof fetch, 4, 1);
  assert.equal((await other("http://x")).status, 500);
  assert.equal(calls, 1);

  calls = 0;
  const stuck = retryAbortedTransaction((async () => { calls += 1; return aborted(); }) as typeof fetch, 3, 1);
  assert.equal((await stuck("http://x")).status, 500);
  assert.equal(calls, 3);
});

test("nunca hay más de `limit` peticiones en vuelo y todas terminan", async () => {
  let active = 0;
  let peak = 0;
  const gated = createGatedFetch(3, (async () => {
    active += 1;
    peak = Math.max(peak, active);
    await tick(10);
    active -= 1;
    return new Response("ok");
  }) as typeof fetch);

  const responses = await Promise.all(Array.from({ length: 20 }, () => gated("http://x", { method: "POST" })));
  assert.equal(responses.length, 20);
  assert.equal(peak, 3);
  assert.equal(active, 0);
});

test("un fallo libera el hueco y la cancelación en cola no consume uno", async () => {
  let calls = 0;
  const gated = createGatedFetch(1, (async () => {
    calls += 1;
    await tick(5);
    if (calls === 1) throw new Error("red");
    return new Response("ok");
  }) as typeof fetch);

  const first = gated("http://x", { method: "POST" }).catch((error: Error) => error.message);
  const controller = new AbortController();
  const cancelled = gated("http://x", { method: "POST", signal: controller.signal }).catch((error: Error) => error.name);
  controller.abort();
  const third = gated("http://x", { method: "POST" }).then((response) => response.status);

  assert.equal(await first, "red");
  assert.equal(await cancelled, "AbortError");
  assert.equal(await third, 200);
  assert.equal(calls, 2); // la cancelada no llegó a lanzar la petición
});

const hangUntilAborted = (init?: RequestInit) =>
  new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("timeout"))));

test("una lectura que se atasca se corta y se reintenta una vez", async () => {
  let calls = 0;
  const gated = createGatedFetch(2, ((_input: unknown, init?: RequestInit) => {
    calls += 1;
    return calls === 1 ? hangUntilAborted(init) : Promise.resolve(new Response("ok"));
  }) as typeof fetch, { timeoutMs: 20, retryDelayMs: 5 });

  const response = await gated("http://x/rest/v1/rpc/shopify_sales_summary", { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("dos fallos seguidos devuelven el error; no hay más de un reintento", async () => {
  let calls = 0;
  const gated = createGatedFetch(2, ((_input: unknown, init?: RequestInit) => {
    calls += 1;
    return hangUntilAborted(init);
  }) as typeof fetch, { timeoutMs: 15, retryDelayMs: 1 });

  await assert.rejects(() => gated("http://x/rest/v1/shopify_stores"), /timeout/);
  assert.equal(calls, 2);
});

test("las escrituras no se cortan ni se reintentan", async () => {
  let calls = 0;
  const gated = createGatedFetch(2, (async () => {
    calls += 1;
    await tick(40); // más que el timeout: una lectura habría caído
    return new Response("ok", { status: calls === 1 ? 503 : 200 });
  }) as typeof fetch, { timeoutMs: 10, retryDelayMs: 1 });

  const response = await gated("http://x/rest/v1/kpi_snapshots", { method: "POST" });
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test("un 503 en una lectura se reintenta, un 500 no", async () => {
  let calls = 0;
  const statuses = [503, 200];
  const gated = createGatedFetch(2, (async () => new Response("x", { status: statuses[calls++] ?? 200 })) as typeof fetch, { retryDelayMs: 1 });
  assert.equal((await gated("http://x/rest/v1/a")).status, 200);
  assert.equal(calls, 2);

  calls = 0;
  const failing = createGatedFetch(2, (async () => { calls += 1; return new Response("x", { status: 500 }); }) as typeof fetch, { retryDelayMs: 1 });
  assert.equal((await failing("http://x/rest/v1/a")).status, 500);
  assert.equal(calls, 1);
});
