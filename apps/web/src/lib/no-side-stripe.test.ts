import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Regla de diseño (Rafa, 2026-10-23): nada de franja gruesa de color en el
// borde izquierdo de tarjetas, bloques o filas. Se quitó del bloque de Tareas
// y no debe volver. Un borde de 1-2 px (separador, cita) sí vale.
const SRC = join(import.meta.dirname, "..");
const RULES = [
  /border-(?:left|inline-start)\s*:\s*(?:[3-9]|\d{2,})px/,
  /border-(?:left|inline-start)-width\s*:\s*(?:[3-9]|\d{2,})px/,
  /\bborder-[ls]-(?:[3-9]|\d{2,}|\[(?:[3-9]|\d{2,})px\])(?![\w-])/,
  /borderLeft(?:Width)?\s*:\s*["']?(?:[3-9]|\d{2,})(?:px)?/,
];

test("sin franjas gruesas de color en el borde izquierdo", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(css|tsx?)$/.test(entry.name) || entry.name.endsWith(".test.ts")) continue;
    const path = join(entry.parentPath, entry.name);
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (RULES.some((rule) => rule.test(line))) offenders.push(`${path.slice(SRC.length + 1)}:${index + 1}  ${line.trim()}`);
      });
  }
  assert.deepEqual(offenders, [], `Franja izquierda gruesa (máx. 2 px):\n${offenders.join("\n")}`);
});
