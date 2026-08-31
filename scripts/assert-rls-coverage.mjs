import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();
let source = "";
for (const file of files) {
  source += `\n-- ${file}\n${await readFile(path.join(migrationsDir, file), "utf8")}`;
}

const names = (pattern) =>
  new Set(
    [...source.matchAll(pattern)].map((match) => match[1].toLowerCase()),
  );

const tables = names(
  /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi,
);
const rlsTables = names(
  /alter\s+table\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)\s+enable\s+row\s+level\s+security/gi,
);
const policyTables = names(
  /create\s+policy\s+[^\n]+\s+on\s+public\.([a-z0-9_]+)/gi,
);
const serviceOnlyTables = new Set(["client_invites", "memory_ingestion_queue"]);

const missingRls = [...tables].filter((name) => !rlsTables.has(name));
const unclassifiedPolicyless = [...tables].filter(
  (name) => !policyTables.has(name) && !serviceOnlyTables.has(name),
);

if (missingRls.length > 0 || unclassifiedPolicyless.length > 0) {
  throw new Error(
    [
      missingRls.length > 0 ? `missing RLS: ${missingRls.join(", ")}` : null,
      unclassifiedPolicyless.length > 0
        ? `policyless tables not classified as service-only: ${unclassifiedPolicyless.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("; "),
  );
}

console.log(
  `RLS coverage verified: ${tables.size}/${tables.size} tables enabled; ${serviceOnlyTables.size} service-only tables classified`,
);
