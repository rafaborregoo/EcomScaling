import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Una sola línea separadora: components/ui/separator.tsx (API de shadcn). Ni
// <hr>, ni el Separator de HeroUI, ni un div/span de 1 px con fondo pintado a
// mano (`h-px … bg-…`). Las barras de color que son datos (cuota de flows y
// campañas) no son separadores y no entran aquí.
const SRC = join(import.meta.dirname, "..");
const OWN = join("components", "ui", "separator.tsx");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("nadie pinta una línea separadora a mano: se usa Separator", () => {
  const offenders = tsxFiles()
    .filter((path) => path !== OWN)
    .filter((path) => {
      const source = readFileSync(join(SRC, path), "utf8");
      return (
        /<hr\b/.test(source) ||
        /import\s*\{[^}]*\bSeparator\b[^}]*\}\s*from\s*"@heroui\/react"/.test(source) ||
        /className="[^"]*\b[hw]-px\b[^"]*\bbg-/.test(source)
      );
    });
  assert.deepEqual(offenders, [], "Usa Separator de @/components/ui");
});
