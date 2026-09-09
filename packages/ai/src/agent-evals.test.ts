import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// AI-30: raiz del repo desde este fichero, no desde `process.cwd()` -- ver
// agent-canonical-prompts.test.ts.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
import {
  ACTIVE_AGENT_CODES,
  AGENT_EVAL_MATRIX,
  runOfflineAgentEvalSuite,
} from "./agent-evals.js";

test("la matriz cubre todos los agentes activos", () => {
  assert.deepEqual(
    Object.keys(AGENT_EVAL_MATRIX).sort(),
    [...ACTIVE_AGENT_CODES].sort(),
  );
  const results = runOfflineAgentEvalSuite();
  assert.equal(results.length, ACTIVE_AGENT_CODES.length);
  assert.ok(
    results.every((result) => result.passed),
    JSON.stringify(results),
  );
});

test("cada agente tiene calidad, abstención, seguridad, tenant y performance", () => {
  for (const agentCode of ACTIVE_AGENT_CODES) {
    const categories = new Set(
      AGENT_EVAL_MATRIX[agentCode].map((item) => item.category),
    );
    for (const category of [
      "quality",
      "abstention",
      "security",
      "tenant",
      "performance",
    ] as const) {
      assert.ok(categories.has(category), `${agentCode} missing ${category}`);
    }
  }
});

test("A08 no queda fuera de la activación canónica", () => {
  const migration = fs.readFileSync(
    path.resolve(
      REPO_ROOT,
      "supabase/migrations/20260824170000_ai_18_a08_canonical_prompt.sql",
    ),
    "utf8",
  );
  assert.match(migration, /a08_gestor_conocimiento_system/);
  assert.match(migration, /'v3'/);
  assert.match(migration, /is_active = false/);
});
