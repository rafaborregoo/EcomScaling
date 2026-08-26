import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const outputPath = join(
  repoRoot,
  "roadmap",
  "roadmaps",
  "01-base-de-datos",
  "schema_generado_desde_migraciones.sql",
);

const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

const sections = await Promise.all(
  files.map(async (file) => {
    const source = await readFile(join(migrationsDir, file), "utf8");
    return [
      "-- =============================================================================",
      `-- Migracion: ${file}`,
      "-- =============================================================================",
      source.trimEnd(),
    ].join("\n");
  }),
);

const output = [
  "-- =============================================================================",
  "-- SCHEMA GENERADO DESDE MIGRACIONES REALES -- fuente ejecutable de verdad.",
  `-- Regenerado desde supabase/migrations (${files.length} archivos).`,
  "-- No editar este archivo a mano: anadir una migracion nueva y regenerar.",
  "-- =============================================================================",
  "",
  sections.join("\n\n"),
  "",
].join("\n");

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8");
  if (current !== output) {
    console.error(
      "GENERATED_SCHEMA_DRIFT: ejecuta node scripts/regenerate-generated-schema.mjs",
    );
    process.exit(1);
  }
  console.log(`GENERATED_SCHEMA_OK: ${files.length} migrations`);
} else {
  await writeFile(outputPath, output, "utf8");
  console.log(
    `GENERATED_SCHEMA_WRITTEN: ${outputPath} (${files.length} migrations)`,
  );
}
