import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Un solo botón en la app: components/ui/button.tsx (`Button` / `buttonVariants`).
// Estos CSS modules todavía tienen su propio `.btn` y se migran uno a uno
// (docs/INVENTARIO_BOTONES.md). Al migrar uno se quita de la lista; la lista
// solo puede encoger.
const PENDING_BTN_MODULES = [
  "app/camino/camino-map.module.css",
  "app/camino/camino-routes.module.css",
  "app/dashboard/client-pulse.module.css",
  "app/llamadas/llamadas.module.css",
  "app/marketing/campanas/campanas.module.css",
  "app/marketing/flows/flow-builder.module.css",
  "app/marketing/studio/studio.module.css",
  "app/panel/panel.module.css",
];
const SRC = join(import.meta.dirname, "..");

test("ningún CSS module nuevo define su propio .btn", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".module.css")) continue;
    const path = join(entry.parentPath, entry.name).slice(SRC.length + 1).replaceAll("\\", "/");
    if (PENDING_BTN_MODULES.includes(path)) continue;
    if (/(^|[\s,}])\.btn\b/m.test(readFileSync(join(SRC, path), "utf8"))) offenders.push(path);
  }
  assert.deepEqual(offenders, [], `Usa Button o buttonVariants de @/components/ui en vez de un .btn propio:\n${offenders.join("\n")}`);
});

test("ningún componente usa las clases de botón de un CSS module", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (/\b\w+\.(btn|tbtn|ibtn|btnGhost)\b/.test(line)) offenders.push(`${path.slice(SRC.length + 1)}:${index + 1}`);
      });
  }
  assert.deepEqual(offenders, [], `Usa Button o buttonVariants:\n${offenders.join("\n")}`);
});

test("el Button de HeroUI solo se importa desde components/ui/button.tsx", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    if (/import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*"@heroui\/react"/.test(readFileSync(path, "utf8"))) offenders.push(path.slice(SRC.length + 1));
  }
  assert.deepEqual(offenders, []);
});
