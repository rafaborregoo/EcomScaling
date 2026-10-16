import assert from "node:assert/strict";
import test from "node:test";
import { sumUsage, type AiUsageRow } from "./ai-usage-admin.js";

const row = (over: Partial<AiUsageRow>): AiUsageRow => ({
  agent_code: "a", agent_name: "A", run_count: 0, succeeded_count: 0, failed_count: 0, rejected_count: 0, running_count: 0,
  zero_token_runs: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, total_cost_usd: 0,
  runs_by_trigger: {}, runs_by_model: {}, first_run_at: null, last_run_at: null, ...over,
});

test("el total suma las filas", () => {
  const total = sumUsage([row({ run_count: 2, input_tokens: 100, output_tokens: 10, total_cost_usd: 0.1 }), row({ run_count: 3, input_tokens: 50, total_cost_usd: 0.2 })]);
  assert.equal(total.run_count, 5);
  assert.equal(total.input_tokens, 150);
  assert.equal(total.output_tokens, 10);
  assert.equal(total.total_cost_usd, 0.3);
});
