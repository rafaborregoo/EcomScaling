import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AgentRequestTimeoutError,
  classifyProviderError,
  computeExponentialBackoffMs,
  isTransientAgentError,
  withAgentResilience,
} from "./resilience.js";

describe("AI resilience", () => {
  it("retries transient errors with bounded exponential backoff", async () => {
    let calls = 0;
    const result = await withAgentResilience(
      async () => {
        calls += 1;
        if (calls < 3)
          throw Object.assign(new Error("overloaded"), { status: 503 });
        return "ok";
      },
      {
        timeoutMs: 100,
        maxRetries: 2,
        baseBackoffMs: 0,
        maxBackoffMs: 10,
        jitterRatio: 0,
      },
    );
    assert.equal(result, "ok");
    assert.equal(calls, 3);
  });

  it("does not retry permanent provider errors", async () => {
    let calls = 0;
    await assert.rejects(() =>
      withAgentResilience(
        async () => {
          calls += 1;
          throw Object.assign(new Error("invalid api key"), { status: 401 });
        },
        {
          timeoutMs: 100,
          maxRetries: 2,
          baseBackoffMs: 0,
          maxBackoffMs: 10,
          jitterRatio: 0,
        },
      ),
    );
    assert.equal(calls, 1);
  });

  it("times out and classifies timeout as transient", async () => {
    await assert.rejects(
      () =>
        withAgentResilience(() => new Promise(() => undefined), {
          timeoutMs: 1,
          maxRetries: 0,
          baseBackoffMs: 0,
          maxBackoffMs: 1,
          jitterRatio: 0,
        }),
      AgentRequestTimeoutError,
    );
    assert.equal(isTransientAgentError(new AgentRequestTimeoutError(1)), true);
  });

  it("does not abort the signal after a successful attempt (deferred body read)", async () => {
    let captured: AbortSignal | undefined;
    const result = await withAgentResilience(
      async (signal) => {
        captured = signal;
        return "ok";
      },
      {
        timeoutMs: 100,
        maxRetries: 2,
        baseBackoffMs: 0,
        maxBackoffMs: 10,
        jitterRatio: 0,
      },
    );
    assert.equal(result, "ok");
    // El caller lee `response.json()` DESPUES de que la funcion retorne; el
    // signal no puede estar abortado o esa lectura de un 200 OK revienta.
    assert.equal(captured?.aborted, false);
  });

  it("aborts the active provider request and does not retry after caller cancellation", async () => {
    const caller = new AbortController();
    let calls = 0;
    let providerSignal: AbortSignal | undefined;
    const pending = withAgentResilience(
      async (signal) => {
        calls += 1;
        providerSignal = signal;
        return await new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      },
      {
        timeoutMs: 1_000,
        maxRetries: 2,
        baseBackoffMs: 0,
        maxBackoffMs: 10,
        jitterRatio: 0,
      },
      { signal: caller.signal },
    );

    caller.abort(new DOMException("Client disconnected", "AbortError"));
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(providerSignal?.aborted, true);
    assert.equal(calls, 1);
  });

  it("caps exponential backoff", () => {
    assert.equal(
      computeExponentialBackoffMs(10, {
        timeoutMs: 1,
        maxRetries: 2,
        baseBackoffMs: 100,
        maxBackoffMs: 250,
        jitterRatio: 0,
      }),
      250,
    );
  });
});

// AI-30: por que fallo el proveedor, en terminos que cambian que hay que hacer.
// Nace de produccion: 61 de 65 fallos de agente fueron "saldo de Anthropic
// agotado" guardados como un blob JSON del SDK, indistinguibles de una caida.
describe("classifyProviderError", () => {
  it("reconoce el saldo agotado de Anthropic aunque venga como 400", () => {
    const error = Object.assign(
      new Error(
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
      ),
      { status: 400 },
    );

    assert.equal(classifyProviderError(error), "out_of_credit");
    // Y NO se reintenta: tres intentos dan el mismo error y queman el reloj.
    assert.equal(isTransientAgentError(error), false);
  });

  it("reconoce la cuota agotada de OpenAI aunque venga como 429", () => {
    const error = Object.assign(new Error("insufficient_quota"), {
      status: 429,
    });

    assert.equal(classifyProviderError(error), "out_of_credit");
    assert.equal(isTransientAgentError(error), false);
  });

  it("un 429 normal sigue siendo rate limit y sigue reintentandose", () => {
    const error = Object.assign(new Error("Rate limit reached"), {
      status: 429,
    });

    assert.equal(classifyProviderError(error), "rate_limited");
    assert.equal(isTransientAgentError(error), true);
  });

  it("separa credenciales invalidas de caida del proveedor", () => {
    assert.equal(
      classifyProviderError(Object.assign(new Error("nope"), { status: 401 })),
      "auth",
    );
    assert.equal(
      classifyProviderError(
        Object.assign(new Error("Overloaded"), { status: 529 }),
      ),
      "unavailable",
    );
    assert.equal(
      classifyProviderError(new Error("fetch failed")),
      "unavailable",
    );
  });

  it("un timeout propio se clasifica como timeout", () => {
    assert.equal(
      classifyProviderError(new AgentRequestTimeoutError(45_000)),
      "timeout",
    );
  });
});
