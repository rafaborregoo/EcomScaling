import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo plegable en la app: components/ui/collapsible.tsx (API de shadcn).
// Un <details> suelto no abre con ?focus= ni con un #ancla, no anima y cada
// sitio le daba su propio aspecto: inventario en docs/INVENTARIO_COLLAPSIBLE.md.
const SRC = join(import.meta.dirname, "..");

test("ningún componente usa <details> en vez de Collapsible", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (/<details[\s>]/.test(line)) offenders.push(`${path.slice(SRC.length + 1)}:${index + 1}`);
      });
  }
  assert.deepEqual(offenders, [], `Usa Collapsible de @/components/ui:\n${offenders.join("\n")}`);
});

test("el Disclosure de HeroUI no se importa en ningún sitio", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    if (/import\s*\{[^}]*\bDisclosure\b[^}]*\}\s*from\s*"@heroui\/react"/.test(readFileSync(path, "utf8"))) offenders.push(path.slice(SRC.length + 1));
  }
  assert.deepEqual(offenders, []);
});
