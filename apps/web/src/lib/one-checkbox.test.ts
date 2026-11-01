import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Una sola casilla en la app: components/ui/checkbox.tsx (API de shadcn).
const SRC = join(import.meta.dirname, "..");
const OWN = join("components", "ui", "checkbox.tsx");
// Interruptores pintados a mano sobre un checkbox (no son casillas): el
// constructor de flows y el estudio. Si se tocan, pasan a <Switch>.
const SWITCHES = [join("app", "marketing", "flows", "flow-builder.tsx"), join("app", "marketing", "studio", "studio-panels.tsx")];

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name));
}

test("ninguna casilla nativa suelta: se usa Checkbox de @/components/ui", () => {
  const offenders = tsxFiles()
    .map((path) => path.slice(SRC.length + 1))
    .filter((path) => path !== OWN && !SWITCHES.includes(path))
    .filter((path) => /<input\b[^>]*type="checkbox"/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], `Usa Checkbox de @/components/ui:\n${offenders.join("\n")}`);
});

test("el Checkbox de HeroUI no se usa", () => {
  const offenders = tsxFiles()
    .filter((path) => /\bCheckbox\.(Content|Control|Indicator)\b/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, []);
});
