import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const definitions = [];
for (const file of files) {
  const source = await readFile(path.join(migrationsDir, file), "utf8");
  if (/create\s+or\s+replace\s+function\s+public\.agent_sql_gateway/i.test(source)) {
    definitions.push({ file, source });
  }
}

if (definitions.length === 0) {
  throw new Error("No agent_sql_gateway definition found in migrations");
}

const latest = definitions.at(-1);
const required = [
  ["SECURITY INVOKER", /security\s+invoker/i],
  ["ai_gateway role", /set\s+local\s+role\s+ai_gateway/i],
  ["fixed search_path", /set\s+search_path\s*=\s*pg_catalog\s*,\s*ai/i],
  ["statement timeout", /statement_timeout/i],
  ["lock timeout", /lock_timeout/i],
  ["cost guard", /query_cost_exceeded/i],
  ["service_role grant", /grant\s+execute[\s\S]*to\s+service_role/i],
];

const missing = required
  .filter(([, pattern]) => !pattern.test(latest.source))
  .map(([name]) => name);

if (missing.length > 0) {
  throw new Error(
    `Latest agent_sql_gateway migration ${latest.file} is missing: ${missing.join(", ")}`,
  );
}

for (const role of ["public", "anon", "authenticated"]) {
  const revoke = new RegExp(
    `revoke\\s+all\\s+on\\s+function[\\s\\S]*?from\\s+${role}\\b`,
    "i",
  );
  if (!revoke.test(latest.source)) {
    throw new Error(
      `Latest agent_sql_gateway migration ${latest.file} must revoke execution from ${role}`,
    );
  }
}

console.log(
  `SQL gateway hardening verified in ${latest.file} (${definitions.length} definitions scanned)`,
);
