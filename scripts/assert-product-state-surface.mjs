import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// FE-08: las superficies operativas del portal deben conservar los estados
// basicos de producto. Este gate es deliberadamente estructural: no sustituye
// una prueba visual ni inventa datos, pero evita que una ruta vuelva a quedar
// con un spinner/error ad-hoc o sin empty state al refactorizarla.
const root = path.resolve("apps/web/src/app");
const operationalRoutes = [
  "agentes/page.tsx",
  "camino/page.tsx",
  "configuracion/page.tsx",
  "conocimiento/page.tsx",
  "consultor/page.tsx",
  "dashboard/page.tsx",
  "integraciones/page.tsx",
  "llamadas/page.tsx",
  "marketing/page.tsx",
  "shopify/page.tsx",
  "shopify/diagnostico/page.tsx",
  "tareas/page.tsx",
];
const requiredTokens = ["LoadingBlock", "ErrorBlock", "EmptyState"];
const violations = [];

for (const relativeRoute of operationalRoutes) {
  const filePath = path.join(root, relativeRoute);
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch {
    violations.push(`${relativeRoute}: file not found`);
    continue;
  }

  for (const token of requiredTokens) {
    let stateSource = source;
    // DashboardPage delegates session loading/error/empty states to PortalShell
    // and the client dashboard owns its data loading/empty states.
    if (relativeRoute === "dashboard/page.tsx") {
      const delegated = await Promise.all([
        readFile(path.join(root, "..", "components", "portal-shell.tsx"), "utf8"),
        readFile(path.join(root, "dashboard", "client-dashboard.tsx"), "utf8"),
      ]);
      stateSource += delegated.join("\n");
    }
    if (!stateSource.includes(token)) {
      violations.push(`${relativeRoute}: missing ${token}`);
    }
  }
}

if (violations.length > 0) {
  console.error("PRODUCT_STATE_SURFACE_VIOLATION");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `PRODUCT_STATE_SURFACE_OK: ${operationalRoutes.length} portal routes expose loading, error and empty states`,
);
