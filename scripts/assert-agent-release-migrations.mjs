import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrationActivatesAgentVersion } from "./agent-release-migration-preflight.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
// Historical migrations predate the release gate. From the candidate-pin
// enforcement baseline onward, agent activation must go through the guarded
// promotion RPC; direct is_active=true writes are forbidden.
const enforcementBaseline = "20261215160000";
// A02 (monitor de negocio) se activo con migraciones directas ya aplicadas en TEST y PROD
// antes de que este guard las viera; no se pueden reescribir.
const grandfathered = new Set(["20270115100000_a02_metric_figure_keys.sql", "20270115110000_a02_panel_kpi_coverage.sql"]);
const files = (await readdir(migrationsDir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const violations = [];

for (const file of files) {
  const version = /^\d+/.exec(file)?.[0] ?? "";
  if (version <= enforcementBaseline || grandfathered.has(file)) continue;
  const sql = await readFile(path.join(migrationsDir, file), "utf8");
  if (migrationActivatesAgentVersion(sql) && !/\bpromote_agent_version\s*\(/i.test(sql)) {
    violations.push(file);
  }
}

if (violations.length) {
  throw new Error(`Agent release gate bypass in migration(s): ${violations.join(", ")}. Use promote_agent_version() with candidate evidence.`);
}
console.log(`AGENT_RELEASE_MIGRATIONS_OK: ${files.length} migration files scanned; post-gate activations use protected promotion.`);
