import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Las filas de lista (media + título y descripción + acciones) van en Item de
// components/ui/item.tsx, dentro de List o ItemGroup. Lo que se vigila es la
// fila hecha a mano de antes: un List.Item que abre con el bloque
// «min-w-0 flex-1» de título y descripción. Los List.Item que son formularios
// o rejillas de columnas siguen siendo List.Item.
const SRC = join(import.meta.dirname, "..");

test("ninguna fila de lista hecha a mano: se usa Item", () => {
  const handMade = /<List\.Item\b[^>]*>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<(?:div|span) className="min-w-0 flex-1">/;
  const offenders = readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1))
    .filter((path) => handMade.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], "Usa Item de @/components/ui");
});
