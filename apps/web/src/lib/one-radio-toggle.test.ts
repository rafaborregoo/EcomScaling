import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Elegir una opción entre varias tiene dos componentes en la app, los dos con
// la API de shadcn: RadioGroup (components/ui/radio-group.tsx) para elegir un
// valor de un formulario, en lista o en tarjetas, y ToggleGroup
// (components/ui/toggle-group.tsx) para periodos, vistas y filtros.
const SRC = join(import.meta.dirname, "..");
const OWN = [join("components", "ui", "radio-group.tsx"), join("components", "ui", "toggle-group.tsx")];

// Selector de modelo del copiloto: un menú dentro de un Popover que se cierra
// al elegir; con radios nativos las flechas lo cerrarían a la primera.
const RADIO_MENUS = [join("components", "copilot-saldo.tsx")];

// `aria-pressed={a === b}` que no son un grupo de opciones: tarjetas de
// resumen que filtran (cifras grandes), muestras de color, avatar o imagen,
// el elemento elegido de un lienzo o mapa, Aprobar/Rechazar, 👍/👎, el menú
// del modo del nav y botones que se vuelven a pulsar para refrescar.
const NOT_GROUPS = [
  join("app", "admin", "onboarding", "page.tsx"),
  join("app", "camino", "camino-consultant.tsx"),
  join("app", "camino", "page.tsx"),
  join("app", "conocimiento", "client-rules.tsx"),
  join("app", "dashboard", "client-meta.tsx"),
  join("app", "dashboard", "client-pulse.tsx"),
  join("app", "marketing", "flows", "flow-builder.tsx"),
  join("app", "marketing", "imagenes", "[overlayId]", "page.tsx"),
  join("app", "marketing", "studio", "studio-canvas.tsx"),
  join("app", "marketing", "studio", "studio-panels.tsx"),
  join("app", "mensajes", "page.tsx"),
  join("app", "meta", "campanas", "page.tsx"),
  join("app", "shopify", "productos", "[productId]", "page.tsx"),
  join("components", "ai-diagnostic-section.tsx"),
  join("components", "avatar-picker.tsx"),
  join("components", "copilot-panel.tsx"),
  join("components", "portal-shell.tsx"),
];

function tsxFiles() {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => join(entry.parentPath, entry.name).slice(SRC.length + 1));
}

test("ningún radio suelto: se usa RadioGroup de @/components/ui", () => {
  const offenders = tsxFiles()
    .filter((path) => !OWN.includes(path) && !RADIO_MENUS.includes(path))
    .filter((path) => /<input\b[^>]*type="radio"|role="radio(group)?"/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], `Usa RadioGroup de @/components/ui:\n${offenders.join("\n")}`);
});

test("ningún grupo de botones con aria-pressed a mano: se usa ToggleGroup", () => {
  const offenders = tsxFiles()
    .filter((path) => !OWN.includes(path) && !NOT_GROUPS.includes(path))
    .filter((path) => /aria-pressed=\{[^}]*===/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, [], `Usa ToggleGroup (o RadioGroup en un formulario):\n${offenders.join("\n")}`);
});

test("el RadioGroup de HeroUI no se usa", () => {
  const offenders = tsxFiles()
    .filter((path) => /\bRadio\.(Control|Indicator|Content)\b|import\s*\{[^}]*\bRadio(Group)?\b[^}]*\}\s*from\s*"@heroui\/react"/.test(readFileSync(join(SRC, path), "utf8")));
  assert.deepEqual(offenders, []);
});
