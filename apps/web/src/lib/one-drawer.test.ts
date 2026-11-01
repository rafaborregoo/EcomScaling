import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo cajón en la app: components/ui/drawer.tsx (API de shadcn). Ni el
// Drawer de HeroUI ni la Sheet antigua (components/ui/sheet.tsx, borrada).
const SRC = join(import.meta.dirname, "..");

test("los cajones usan Drawer de @/components/ui", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    const source = readFileSync(path, "utf8");
    if (
      /import\s*\{[^}]*\bDrawer\b[^}]*\}\s*from\s*"@heroui\/react"/.test(source) ||
      /from\s*"(@\/components\/ui\/sheet|\.\/sheet)"/.test(source)
    ) {
      offenders.push(path.slice(SRC.length + 1));
    }
  }
  assert.deepEqual(offenders, [], `Usa Drawer de @/components/ui:\n${offenders.join("\n")}`);
});
