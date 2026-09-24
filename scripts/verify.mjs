// Ejecuta todas las guardas scripts/assert-*.mjs. Desde que se retiraron los
// workflows de GitHub Actions (2b2ab70) nadie las corria: este es el punto de
// entrada unico antes de un push.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Comprueba el orden de build de workflows que ya no existen.
const RETIRADAS = new Set(["assert-benchmark-workflow-build-order.mjs"]);

const guards = [
  ...readdirSync(dir)
    .filter((file) => file.startsWith("assert-") && file.endsWith(".mjs") && !RETIRADAS.has(file))
    .sort(),
  // Motores leyendo columnas que su funcion SQL no devuelve (undefined en silencio).
  "auditar-columnas-motores.mjs",
];

const failed = [];
for (const guard of guards) {
  try {
    execFileSync(process.execPath, [path.join(dir, guard)], { stdio: "inherit" });
  } catch {
    failed.push(guard);
  }
}

if (failed.length > 0) {
  console.error(`\n${failed.length} guarda(s) en rojo: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`\n${guards.length} guardas en verde.`);
