import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve("apps/web/src");
const catalog = `${path.sep}components${path.sep}ui${path.sep}`;
const violations = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name) || filePath.includes(catalog))
      continue;

    const source = await readFile(filePath, "utf8");
    if (
      /from\s+["']@heroui\/react["']|import\s*\(\s*["']@heroui\/react["']/.test(
        source,
      )
    ) {
      violations.push(path.relative(process.cwd(), filePath));
    }
  }
}

await walk(root);

if (violations.length > 0) {
  console.error("UI_CATALOG_SURFACE_VIOLATION");
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log(
  "UI_CATALOG_SURFACE_OK: HeroUI imports are centralized in apps/web/src/components/ui",
);
