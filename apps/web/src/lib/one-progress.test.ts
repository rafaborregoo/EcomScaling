import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Una sola barra de progreso: components/ui/progress.tsx (API de shadcn). Ni
// la ProgressBar de HeroUI ni un `role="progressbar"` montado a mano con un
// div y un ancho en %. Las barras que comparan cifras (cuota de ventas, ROAS
// frente al mínimo) son gráficas y no entran aquí.
const SRC = join(import.meta.dirname, "..");
const OWN = join("components", "ui", "progress.tsx");

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("nadie pinta una barra de progreso a mano: se usa Progress", () => {
  const offenders = tsxFiles()
    .filter((path) => path !== OWN)
    .filter((path) => /<ProgressBar\b|role="progressbar"/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], "Usa Progress de @/components/ui");
});
