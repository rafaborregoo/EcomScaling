import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo combobox en la app: components/ui/combobox.tsx (API de shadcn) y sus
// atajos SearchableSelect, MultiSearchableSelect y TimezoneCombobox.
const SRC = join(import.meta.dirname, "..");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name));
}

test("ni el ComboBox ni el Autocomplete de HeroUI, ni <datalist>", () => {
  const offenders = tsxFiles()
    .filter((path) => /\b(ComboBox|Autocomplete)\.(InputGroup|Popover|Trigger|Filter|Value)\b|<datalist\b/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], `Usa Combobox / SearchableSelect de @/components/ui:\n${offenders.join("\n")}`);
});

test("las zonas horarias salen todas del mismo selector", () => {
  // Había cuatro listas distintas (Configuración, Notificaciones, Reuniones, Onboarding).
  const offenders = tsxFiles()
    .filter((path) => !path.endsWith("timezone-combobox.tsx"))
    .filter((path) => /\["Europe\/Madrid",|value: "Europe\/Madrid"/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], `Usa TimezoneCombobox:\n${offenders.join("\n")}`);
});
