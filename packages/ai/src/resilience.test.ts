import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AgentRequestTimeoutError,
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
        if (calls < 3) throw Object.assign(new Error("overloaded"), { status: 503 });
        return "ok";
      },
      { timeoutMs: 100, maxRetries: 2, baseBackoffMs: 0, maxBackoffMs: 10, jitterRatio: 0 },
    );
    assert.equal(result, "ok");
    assert.equal(calls, 3);
  });

  it("does not retry permanent provider errors", async () => {
    let calls = 0;
    await assert.rejects(
      () => withAgentResilience(async () => {
        calls += 1;
        throw Object.assign(new Error("invalid api key"), { status: 401 });
      }, { timeoutMs: 100, maxRetries: 2, baseBackoffMs: 0, maxBackoffMs: 10, jitterRatio: 0 }),
    );
    assert.equal(calls, 1);
  });

  it("times out and classifies timeout as transient", async () => {
    await assert.rejects(
      () => withAgentResilience(() => new Promise(() => undefined), {
        timeoutMs: 1, maxRetries: 0, baseBackoffMs: 0, maxBackoffMs: 1, jitterRatio: 0,
      }),
      AgentRequestTimeoutError,
    );
    assert.equal(isTransientAgentError(new AgentRequestTimeoutError(1)), true);
  });

  it("caps exponential backoff", () => {
    assert.equal(computeExponentialBackoffMs(10, {
      timeoutMs: 1, maxRetries: 2, baseBackoffMs: 100, maxBackoffMs: 250, jitterRatio: 0,
    }), 250);
  });
});
