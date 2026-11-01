import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Una sola zona desplazable: components/ui/scroll-area.tsx (API de shadcn).
// Nada de `overflow-y-auto` a mano en un div: la barra fina del gris del logo
// la pone ScrollArea. Fuera: desplazar sin barra (no-scrollbar), overflow solo
// en un punto de corte (lg:overflow-y-auto) y el nav de módulos, que tiene que
// seguir siendo <nav>. Los CSS modules heredan el color de :root.
const SRC = join(import.meta.dirname, "..");
const UI = join("components", "ui");
const ALLOWED = [join("components", "portal-shell.tsx")];

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("nadie monta una zona desplazable a mano: se usa ScrollArea", () => {
  const offenders = tsxFiles()
    .filter((path) => !path.startsWith(UI) && !ALLOWED.includes(path))
    .filter((path) =>
      readFileSync(join(SRC, path), "utf8")
        .split("\n")
        .some((line) => /(^|[\s"'`])overflow-(?:[xy]-)?auto\b/.test(line) && !/no-scrollbar|scrollbar-width:none|lg:overflow/.test(line)),
    );
  assert.deepEqual(offenders, [], "Usa ScrollArea de @/components/ui");
});
