import { test } from "node:test";
import assert from "node:assert/strict";
import { pricesFromLiteLLM } from "./ai-model-pricing.js";

const litellm = {
  "gpt-5.5": {
    litellm_provider: "openai",
    input_cost_per_token: 0.000005,
    output_cost_per_token: 0.00003,
    cache_read_input_token_cost: 0.0000005,
  },
  "claude-haiku-4-5": {
    litellm_provider: "anthropic",
    input_cost_per_token: 0.000001,
    output_cost_per_token: 0.000005,
  },
  "modelo-roto": { litellm_provider: "openai", input_cost_per_token: 5, output_cost_per_token: 0.00001 },
  "de-otro-proveedor": { litellm_provider: "bedrock", input_cost_per_token: 0.000001, output_cost_per_token: 0.000001 },
};

test("pasa de USD por token a USD por millon y casa el id fechado con su alias", () => {
  const { rows, missing } = pricesFromLiteLLM(litellm, ["gpt-5.5", "claude-haiku-4-5-20251001"]);
  assert.deepEqual(missing, []);
  assert.deepEqual(rows[0], {
    model: "gpt-5.5",
    provider: "openai",
    input_per_mtok: 5,
    output_per_mtok: 30,
    cache_read_per_mtok: 0.5,
  });
  assert.equal(rows[1]!.model, "claude-haiku-4-5-20251001");
  assert.equal(rows[1]!.output_per_mtok, 5);
  assert.equal(rows[1]!.cache_read_per_mtok, null);
});

test("un precio absurdo, un proveedor ajeno o un modelo ausente no se escriben", () => {
  const { rows, missing } = pricesFromLiteLLM(litellm, ["modelo-roto", "de-otro-proveedor", "no-existe"]);
  assert.deepEqual(rows, []);
  assert.deepEqual(missing, ["modelo-roto", "de-otro-proveedor", "no-existe"]);
});
