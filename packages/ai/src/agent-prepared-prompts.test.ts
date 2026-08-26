import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("los agentes preparados tienen prompt canónico y permanecen inactivos", () => {
  const migration = fs.readFileSync(
    path.resolve(process.cwd(), "supabase/migrations/20260826120000_ai_22_prepared_agent_prompts.sql"),
    "utf8",
  );
  for (const code of [
    "a03_analista_adquisicion",
    "a05_estrategia_campanas",
    "a07_rendimiento_contenido",
  ]) {
    assert.match(migration, new RegExp(code));
    assert.match(migration, new RegExp(`${code}_system`));
  }
  for (const section of [
    "1. ROLE", "2. GOAL", "3. CONTEXT", "4. INPUT",
    "5. RULES / CONSTRAINTS", "6. TOOLS", "7. OUTPUT",
    "8. FAILURE BEHAVIOUR", "9. EXAMPLES",
  ]) {
    assert.ok(migration.includes(section), `missing ${section}`);
  }
  assert.match(migration, /is_active\)\s*select[\s\S]*false/);
});
