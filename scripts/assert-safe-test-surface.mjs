import { readFile } from "node:fs/promises";

const packagePath = new URL("../apps/api/package.json", import.meta.url);
const packageJsonText = (await readFile(packagePath, "utf8")).replace(
  /^\uFEFF/,
  "",
);
const packageJson = JSON.parse(packageJsonText);
const scripts = packageJson.scripts ?? {};

if (scripts.test !== "npm run test:unit") {
  throw new Error(
    "Unsafe API test surface: apps/api test must remain the non-remote unit suite.",
  );
}

if (!scripts["test:remote"]?.includes("run-remote-tests.mjs")) {
  throw new Error(
    "Unsafe API test surface: test:remote must use the isolated-project guard.",
  );
}

const runner = await readFile(
  new URL("./run-remote-tests.mjs", import.meta.url),
  "utf8",
);
for (const requiredToken of [
  "RUN_REMOTE_MUTATION_TESTS",
  "SUPABASE_TEST_PROJECT_REF",
  "SUPABASE_PRODUCTION_PROJECT_REF",
]) {
  if (!runner.includes(requiredToken)) {
    throw new Error(`Remote test runner guard is missing ${requiredToken}.`);
  }
}

console.log("SAFE_TEST_SURFACE_OK");
