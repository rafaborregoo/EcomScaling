import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un adelanto con varias líneas (fuentes, ficha de una reunión, una campaña)
// va en HoverCard de components/ui/hover-card.tsx, no amontonado en un
// `title` que el navegador pinta como una sola tira gris y tarde.
const SRC = join(import.meta.dirname, "..");

test("ningún title de varias líneas: el adelanto va en HoverCard", () => {
  const offenders = readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => /\btitle=\{[^}]*\.join\("\n"\)/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], "Usa HoverCard de @/components/ui");
});
