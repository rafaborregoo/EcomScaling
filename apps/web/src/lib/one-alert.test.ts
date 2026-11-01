import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo aviso en la app: components/ui/alert.tsx (Alert + AlertTitle +
// AlertDescription + AlertAction), con Banner y ErrorBlock como atajos.
const SRC = join(import.meta.dirname, "..");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name));
}

test("el Alert de HeroUI no se usa: va todo por components/ui/alert.tsx", () => {
  const offenders = tsxFiles()
    .filter((path) => /\bAlert\.(Indicator|Content|Title|Description)\b/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], `Usa Alert/Banner/ErrorBlock de @/components/ui:\n${offenders.join("\n")}`);
});

test("ningún aviso enseña el error técnico de una conexión en crudo", () => {
  // last_error_message es para el diagnóstico: en pantalla va resumido
  // (integrationErrorSummary) y, si acaso, plegado en «Detalle técnico».
  const offenders: string[] = [];
  for (const path of tsxFiles()) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/<(Banner|ErrorBlock)\b[\s\S]*?<\/\1>/g)) {
      const block = match[0];
      if (/last_error_message/.test(block) && !/<details\b|integrationErrorSummary/.test(block)) {
        offenders.push(path.slice(SRC.length + 1));
      }
    }
  }
  assert.deepEqual(offenders, []);
});
