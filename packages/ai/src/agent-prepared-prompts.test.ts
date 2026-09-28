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

test("los agentes preparados tienen prompt canónico y permanecen inactivos", () => {
  const migration = fs.readFileSync(
    path.resolve(
      REPO_ROOT,
      "supabase/migrations/20260826120000_ai_22_prepared_agent_prompts.sql",
    ),
    "utf8",
  ).replace(/\r\n/g, "\n");
  for (const code of [
    "a05_estrategia_campanas",
    "a07_rendimiento_contenido",
  ]) {
    assert.match(migration, new RegExp(code));
    assert.match(migration, new RegExp(`${code}_system`));
  }
  const sections = [
    "1. ROLE",
    "2. GOAL",
    "3. CONTEXT",
    "4. INPUT",
    "5. RULES / CONSTRAINTS",
    "6. TOOLS",
    "7. OUTPUT",
    "8. FAILURE BEHAVIOUR",
    "9. EXAMPLES",
  ];
  for (const code of [
    "a05_estrategia_campanas",
    "a07_rendimiento_contenido",
  ]) {
    const marker = `  '${code}_system',\n  'v1',\n  $$`;
    const promptStart = migration.indexOf(marker);
    assert.notEqual(promptStart, -1, `missing prompt body for ${code}`);
    const bodyStart = promptStart + marker.length;
    const bodyEnd = migration.indexOf("$$,", bodyStart);
    assert.notEqual(bodyEnd, -1, `unterminated prompt body for ${code}`);
    const promptBody = migration.slice(bodyStart, bodyEnd);
    assert.ok(promptBody, `empty prompt body for ${code}`);
    for (const section of sections) {
      assert.ok(promptBody.includes(section), `${code} missing ${section}`);
    }
  }
  assert.match(migration, /is_active\)\s*select[\s\S]*false/);
});
