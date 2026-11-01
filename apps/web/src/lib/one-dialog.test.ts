import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo diálogo en la app: components/ui/dialog.tsx (API de shadcn). Nadie más
// importa el Modal de HeroUI, y el Dialog ya no acepta la API vieja
// (isOpen/title/primary/formId), que dejaba el pie fuera del contenido.
const SRC = join(import.meta.dirname, "..");
const OWNER = join("components", "ui", "dialog.tsx");

test("los modales usan Dialog de @/components/ui", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    if (path.endsWith(OWNER)) continue;
    const source = readFileSync(path, "utf8");
    if (
      /import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*"@heroui\/react"/.test(source) ||
      /<Dialog\b[^>]*\b(isOpen|primary|formId|cancelLabel)=/.test(source)
    ) {
      offenders.push(path.slice(SRC.length + 1));
    }
  }
  assert.deepEqual(offenders, [], `Usa Dialog de @/components/ui:\n${offenders.join("\n")}`);
});
