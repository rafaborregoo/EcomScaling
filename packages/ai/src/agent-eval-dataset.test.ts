import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_AGENT_CODES } from "./agent-evals.js";
import { AGENT_EVAL_DATASET, AGENT_EVAL_DATASET_VERSION, runAgentEvalDataset } from "./agent-eval-dataset.js";

test("dataset de eval versionado cubre todos los agentes activos", () => {
  assert.match(AGENT_EVAL_DATASET_VERSION, /^2026-\d{2}-\d{2}\.v\d+$/);
  assert.deepEqual(
    AGENT_EVAL_DATASET.map((fixture) => fixture.agentCode).sort(),
    [...ACTIVE_AGENT_CODES].sort(),
  );
});

test("fixtures offline pasan grounding, abstencion, consistencia y anti-injection", () => {
  const results = runAgentEvalDataset();
  assert.equal(results.length, ACTIVE_AGENT_CODES.length);
  assert.ok(results.every((result) => result.passed), JSON.stringify(results));
});
