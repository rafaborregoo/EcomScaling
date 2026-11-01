import assert from "node:assert/strict";
import { test } from "node:test";
import { runConfiguredModelFallback } from "./agent-model-fallback.js";
test("Terra fallback calls Anthropic with Sonnet, while existing Sol fallback stays on OpenAI", async () => {
  const calls: string[] = [];
  const options = { anthropicAvailable: true, openaiAvailable: true,
    runAnthropic: async (model: string) => { calls.push(`anthropic:${model}`); return "anthropic"; },
    runOpenAI: async (model: string) => { calls.push(`openai:${model}`); return "openai"; } };
  assert.equal(await runConfiguredModelFallback({ ...options, model: "claude-sonnet-5-5" }), "anthropic");
  assert.equal(await runConfiguredModelFallback({ ...options, model: "gpt-6.1-sol" }), "openai");
  assert.deepEqual(calls, ["anthropic:claude-sonnet-5-5", "openai:gpt-6.1-sol"]);
});
test("missing fallback credentials and unsupported IDs never invoke either provider", async () => {
  let calls = 0;
  for (const model of ["claude-sonnet-5-5", "gpt-6.1-sol", "unsupported"]) {
    await assert.rejects(runConfiguredModelFallback({ model, anthropicAvailable: false, openaiAvailable: false,
      runAnthropic: async () => ++calls, runOpenAI: async () => ++calls }), /configured_model_fallback_unavailable/);
  }
  assert.equal(calls, 0);
});
