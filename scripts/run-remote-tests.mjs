import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const requiredConfirmation = "1";
const productionRef = process.env.SUPABASE_PRODUCTION_PROJECT_REF;
const testRef = process.env.SUPABASE_TEST_PROJECT_REF;
const testUrl = process.env.SUPABASE_URL;
const testProjectRef = testUrl
  ? new URL(testUrl).hostname.split(".")[0]
  : undefined;

if (
  process.env.RUN_REMOTE_MUTATION_TESTS !== requiredConfirmation ||
  !productionRef ||
  !testRef ||
  testRef === productionRef ||
  testProjectRef !== testRef
) {
  console.error(
    "Remote mutation tests refused: require RUN_REMOTE_MUTATION_TESTS=1, " +
      "SUPABASE_TEST_PROJECT_REF matching SUPABASE_URL, and a project ref " +
      "different from SUPABASE_PRODUCTION_PROJECT_REF.",
  );
  process.exit(1);
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const child = spawn(process.execPath, [tsxCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`Remote test runner failed: ${error.message}`);
  process.exit(1);
});
