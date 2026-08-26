import fs from "node:fs";
import { spawnSync } from "node:child_process";

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .flatMap((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) return [];
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
        return [[key, value]];
      }),
  );
}

const env = { ...readEnvFile(process.env.ENV_FILE ?? ".env.local"), ...process.env };
const dbUrl = env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_MIGRATION_DRIFT_ERROR: SUPABASE_DB_URL is not configured");
  process.exit(1);
}

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  executable,
  ["supabase", "migration", "list", "--db-url", dbUrl, "--output-format", "json"],
  {
    encoding: "utf8",
    timeout: 60_000,
    shell: process.platform === "win32",
    maxBuffer: 4 * 1024 * 1024,
  },
);

if (result.error || result.status !== 0) {
  console.error(
    JSON.stringify(
      {
        status: "tool_error",
        message: result.error?.message ?? result.stderr?.trim() ?? "migration list failed",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const jsonStart = result.stdout.indexOf("{\"migrations\"");
if (jsonStart < 0) {
  console.error("SUPABASE_MIGRATION_DRIFT_ERROR: CLI returned no migration JSON");
  process.exit(1);
}

const payload = JSON.parse(result.stdout.slice(jsonStart));
const migrations = payload.migrations ?? [];
const pending = migrations.filter((migration) => !migration.remote);
const remoteOnly = migrations.filter((migration) => !migration.local);

console.log(
  JSON.stringify(
    {
      status: pending.length || remoteOnly.length ? "drift_detected" : "aligned",
      localCount: migrations.filter((migration) => migration.local).length,
      remoteCount: migrations.filter((migration) => migration.remote).length,
      pendingLocal: pending.map((migration) => migration.local),
      remoteOnly: remoteOnly.map((migration) => migration.remote),
      mutationPerformed: false,
    },
    null,
    2,
  ),
);

process.exitCode = pending.length || remoteOnly.length ? 2 : 0;
