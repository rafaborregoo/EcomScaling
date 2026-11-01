import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Una sola tabla en la app: components/ui/table.tsx (piezas de shadcn) y
// DataTable (data-table.tsx) para listas con orden, búsqueda o paginación.
const SRC = join(import.meta.dirname, "..");
const OWN = join("components", "ui", "table.tsx");
// Tablas de diseño propio en CSS modules (tablero del cliente, Pulso, catálogo,
// inventario, promociones, matriz de rentabilidad). Las listas largas de aquí
// ya ordenan, filtran y paginan en el servidor. Fuera a propósito, como las
// tarjetas de diseño propio; si se rediseñan, pasan a Table/DataTable.
const DESIGNED = [
  "app/dashboard/client-klaviyo.tsx",
  "app/dashboard/client-meta.tsx",
  "app/dashboard/client-shopify.tsx",
  "app/klaviyo/emails/page.tsx",
  "app/klaviyo/emails/[emailId]/page.tsx",
  "app/meta/campanas/page.tsx",
  "app/meta/campanas/[campaignId]/page.tsx",
  "app/panel/portfolio-level.tsx",
  "app/shopify/inventario/page.tsx",
  "app/shopify/inventario/[grupo]/page.tsx",
  "app/shopify/productos/page.tsx",
  "app/shopify/productos/[productId]/page.tsx",
  "app/shopify/promociones/page.tsx",
  "app/shopify/promociones/[discountId]/page.tsx",
].map((path) => join(...path.split("/")));

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("ninguna <table> suelta: se usa Table o DataTable de @/components/ui", () => {
  const offenders = tsxFiles()
    .filter((path) => path !== OWN && !DESIGNED.includes(path))
    .filter((path) => /<table\b/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], `Usa Table o DataTable de @/components/ui:\n${offenders.join("\n")}`);
});

test("la tabla de HeroUI no se usa", () => {
  const offenders = tsxFiles()
    .filter((path) => /\bTable(Root|Content|ScrollContainer|Column)\b/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, []);
});
