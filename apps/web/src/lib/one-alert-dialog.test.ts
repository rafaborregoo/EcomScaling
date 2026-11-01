import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo diálogo de alerta en la app: components/ui/alert-dialog.tsx (API de
// shadcn). Ni window.confirm/alert/prompt del navegador ni el AlertDialog de HeroUI.
const SRC = join(import.meta.dirname, "..");

test("las confirmaciones usan AlertDialog de @/components/ui", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    const source = readFileSync(path, "utf8");
    if (
      /\bwindow\.(confirm|alert|prompt)\(/.test(source) ||
      /import\s*\{[^}]*\bAlertDialog\b[^}]*\}\s*from\s*"@heroui\/react"/.test(source)
    ) {
      offenders.push(path.slice(SRC.length + 1));
    }
  }
  assert.deepEqual(offenders, [], `Usa AlertDialog de @/components/ui:\n${offenders.join("\n")}`);
});
