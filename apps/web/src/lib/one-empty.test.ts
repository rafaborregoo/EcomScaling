import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo vacío en la app: components/ui/empty.tsx (Empty + EmptyHeader +
// EmptyMedia + EmptyTitle + EmptyDescription + EmptyContent), con EmptyState
// como atajo. Los vacíos de las pantallas de diseño propio en CSS modules
// (`className={s.empty}`) quedan fuera a propósito, como sus tablas.
const SRC = join(import.meta.dirname, "..");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name));
}

test("el EmptyState de HeroUI no se usa: va todo por components/ui/empty.tsx", () => {
  const offenders = tsxFiles()
    .filter((path) => /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*"@heroui\/react"/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], `Usa EmptyState de @/components/ui:\n${offenders.join("\n")}`);
});

test("ninguna lista vacía se pinta con un <p> gris suelto", () => {
  // «No hay…», «Todavía no hay…», «Sin …» en un párrafo text-muted es un vacío
  // hecho a mano: va con <EmptyState size="sm" title="…" />. No cuentan las
  // notas de text-xs (p. ej. «No hay más avisos») ni el estado de una fila
  // («Sin nada roto que contar» en la salud de cada cuenta).
  const ROW_STATUS = /^\s*Sin (nada roto que contar|huecos señalados)/;
  const offenders = tsxFiles()
    .filter((path) =>
      [...readFileSync(path, "utf8").matchAll(/<p className="([^"]*\btext-muted\b[^"]*)">(\s*(?:No hay|Todavía no hay|Aún no hay|Ningún|Ninguna|Sin |Nada )[^<]*)/g)]
        .some((match) => !/\btext-xs\b/.test(match[1]) && !ROW_STATUS.test(match[2])),
    )
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], `Usa EmptyState de @/components/ui:\n${offenders.join("\n")}`);
});
