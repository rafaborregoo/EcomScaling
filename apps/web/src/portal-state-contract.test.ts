import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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
    // Los estados pueden vivir en ficheros hermanos de la ruta (p. ej. client-dashboard.tsx).
    const routeDir = dirname(pagePath);
    const source = readdirSync(routeDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".tsx") && !e.name.endsWith(".test.tsx"))
      .map((e) => readFileSync(resolve(routeDir, e.name), "utf8"))
      .join("\n");

    // PortalShell vive normalmente en page.tsx, pero una ruta con subrutas
    // propias (p. ej. marketing/guia, marketing/plantillas) puede moverlo a un
    // layout.tsx compartido -- a veces indirectamente, via un provider hermano
    // que ese layout importa -- para no remontarlo al navegar entre ellas. Se
    // busca en cualquier .tsx del directorio propio de la ruta (sin bajar a
    // subcarpetas de subrutas, que tienen su propio contrato si aplica).
    const routeDirectory = resolve(sourceDirectory, "app", route);
    const usesShell =
      /PortalShell/.test(source) ||
      readdirSync(routeDirectory, { withFileTypes: true }).some(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".tsx") &&
          entry.name !== "page.tsx" &&
          /PortalShell/.test(readFileSync(resolve(routeDirectory, entry.name), "utf8")),
      );
    assert.ok(usesShell, `${route}: debe usar PortalShell (en la página o en un fichero de su directorio)`);
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
