import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo Popover: components/ui/popover.tsx (API de shadcn, popover nativo).
// Ni el compuesto de HeroUI (Popover.Trigger / Popover.Content) ni paneles
// flotantes hechos a mano con `absolute … shadow` junto a su botón. El
// DatePicker usa el de HeroUI por dentro a propósito.
const SRC = join(import.meta.dirname, "..");
const DATE_PICKER = join("components", "ui", "date-picker.tsx");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("nadie usa el Popover de HeroUI: se usa el de @/components/ui", () => {
  const offenders = tsxFiles()
    .filter((path) => path !== DATE_PICKER)
    .filter((path) => /<(?:Hero)?Popover\.(?:Trigger|Content|Dialog)\b/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], "Usa Popover, PopoverTrigger y PopoverContent de @/components/ui");
});
