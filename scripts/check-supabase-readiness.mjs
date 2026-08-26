import fs from "node:fs";
import { spawnSync } from "node:child_process";

const envFile = process.env.ENV_FILE ?? ".env.local";

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

function commandExists(command) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  return spawnSync(lookup, [command], { stdio: "ignore" }).status === 0;
}

function npxSupabaseAvailable() {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawnSync(executable, ["supabase", "--version"], {
    stdio: "ignore",
    timeout: 30_000,
    shell: process.platform === "win32",
  }).status === 0;
}

async function check(url, key, path) {
  if (!url || !key) return { status: "not_configured" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${url}${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    return { status: response.ok ? "ok" : "error", httpStatus: response.status };
  } catch (error) {
    return { status: "error", reason: error instanceof Error ? error.name : "unknown" };
  } finally {
    clearTimeout(timeout);
  }
}

const env = { ...readEnvFile(envFile), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = env.SUPABASE_DB_URL;
const mcpConfigured = fs.existsSync(".mcp.json") &&
  JSON.parse(fs.readFileSync(".mcp.json", "utf8")).mcpServers?.supabase?.url ===
    "https://mcp.supabase.com/mcp";

const [publicAuth, publicRest, serviceRest] = await Promise.all([
  check(url, publicKey, "/auth/v1/health"),
  // El índice raíz de PostgREST puede devolver 401 aunque la clave sea válida;
  // una consulta de límite cero prueba el Data API real sin leer datos.
  check(url, publicKey, "/rest/v1/organizations?select=id&limit=0"),
  check(url, serviceKey, "/rest/v1/"),
]);

const result = {
  url: url ? "configured" : "not_configured",
  publicAuth,
  publicRest,
  serviceRest,
  mcpConfigured,
  supabaseCli: commandExists("supabase"),
  psql: commandExists("psql"),
  npxSupabaseCli: npxSupabaseAvailable(),
};
result.migrationManagement = result.supabaseCli || result.psql ||
  (result.npxSupabaseCli && dbUrl)
  ? "local_tool_available"
  : result.mcpConfigured
    ? "pending_mcp_oauth_or_local_tool"
    : "not_configured";

console.log(JSON.stringify(result, null, 2));

const ready =
  result.url === "configured" &&
  publicAuth.status === "ok" &&
  publicRest.status === "ok" &&
  serviceRest.status === "ok" &&
  result.mcpConfigured &&
  result.migrationManagement === "local_tool_available";

process.exitCode = ready ? 0 : 1;
