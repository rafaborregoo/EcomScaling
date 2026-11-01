import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Una sola paginación: components/ui/pagination.tsx, con `<Pagination page
// pageCount onChange>` como atajo. Ningún par «Anterior»/«Siguiente» hecho a
// mano con setPage. DataTable lleva sus propios controles (primera/última).
const SRC = join(import.meta.dirname, "..");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("ningún par Anterior/Siguiente hecho a mano: se usa <Pagination>", () => {
  const pair = /set\w*Page\(\(\w+\) => [^)]*- 1\)[\s\S]{0,400}?>\s*Anterior\s*<|>\s*Anterior\s*<\/(?:button|Button)>[\s\S]{0,400}?set\w*Page\(\(\w+\) => \w+ \+ 1\)/;
  const offenders = tsxFiles().filter((path) => pair.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], "Usa <Pagination page pageCount onChange> de @/components/ui");
});
