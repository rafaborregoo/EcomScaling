import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo Select: components/ui/select.tsx (API de shadcn, nativo). Ni un
// <select> del navegador, que en cada sistema se pinta distinto, ni el Select
// de HeroUI. Las listas largas van a SearchableSelect (combobox.tsx).
const SRC = join(import.meta.dirname, "..");
const UI = join("components", "ui");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("nadie pinta un <select> nativo ni el de HeroUI: se usa Select", () => {
  const offenders = tsxFiles()
    .filter((path) => !path.startsWith(UI))
    .filter((path) => {
      const source = readFileSync(join(SRC, path), "utf8");
      return /<select\b/.test(source) || /import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s*"@heroui\/react"/.test(source);
    });
  assert.deepEqual(offenders, [], "Usa Select de @/components/ui");
});
