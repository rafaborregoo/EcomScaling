import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

const authenticatedPortalRoutes = [
  "agentes",
  "camino",
  "configuracion",
  "conocimiento",
  "consultor",
  "dashboard",
  "integraciones",
  "llamadas",
  "marketing",
  "shopify",
  "shopify/diagnostico",
  "tareas",
  "tiendas",
] as const;

test("las rutas autenticadas mantienen el contrato de estados de producto", () => {
  for (const route of authenticatedPortalRoutes) {
    const pagePath = resolve(sourceDirectory, "app", route, "page.tsx");
    const source = readFileSync(pagePath, "utf8");

    assert.match(source, /PortalShell/, `${route}: debe usar PortalShell`);
    assert.match(source, /LoadingBlock/, `${route}: falta estado loading`);
    // El estado vacío puede ser EmptyState o una tarjeta/banner contextual
    // (por ejemplo, una tienda sin conectar o una lista sin resultados).
    assert.match(
      source,
      /EmptyState|Sin |No hay|No tienes|Conecta|conectar|length === 0|\.length > 0/,
      `${route}: falta estado empty`,
    );
    // ErrorBlock es la implementación preferida, pero Banner y errores
    // específicos por widget también forman parte del contrato visible.
    assert.match(
      source,
      /ErrorBlock|error \?|set[A-Za-z]+Error/,
      `${route}: falta estado error`,
    );
  }
});
