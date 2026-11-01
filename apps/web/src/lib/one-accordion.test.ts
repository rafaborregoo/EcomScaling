import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo acordeón en la app: components/ui/accordion.tsx (API de shadcn).
// Un <details> suelto sigue valiendo para un único bloque plegable; lo que no
// vale es otro acordeón (el de HeroUI ni uno hecho a mano).
const SRC = join(import.meta.dirname, "..");

test("el Accordion de HeroUI no se importa en ningún sitio", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    if (/import\s*\{[^}]*\bAccordion\b[^}]*\}\s*from\s*"@heroui\/react"/.test(readFileSync(path, "utf8"))) offenders.push(path.slice(SRC.length + 1));
  }
  assert.deepEqual(offenders, [], `Usa Accordion de @/components/ui:\n${offenders.join("\n")}`);
});
