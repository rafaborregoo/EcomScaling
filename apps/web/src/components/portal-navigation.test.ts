import assert from "node:assert/strict";
import test from "node:test";
import { getActivePortalModule, getPortalNavigation, isPortalNavItemActive } from "./portal-navigation";

test("client and consultant navigation keep business channels separate from platform administration", () => {
  for (const role of ["client", "consultant"] as const) {
    const modules = getPortalNavigation(role);
    for (const id of ["shopify", "meta", "klaviyo", "analitica"]) assert.ok(modules.some((m) => m.id === id));
    assert.equal(modules.flatMap((m) => m.items).some((item) => item.href.startsWith("/admin")), false);
  }
  const clientItems = getPortalNavigation("client").flatMap((m) => m.items);
  assert.equal(clientItems.some((item) => ["/consultor", "/tiendas", "/mi-trabajo"].includes(item.href)), false);
  assert.equal(getPortalNavigation("platform_admin").some((m) => m.id === "shopify"), false);
});

test("reports activate the Analytics module", () => {
  assert.equal(getActivePortalModule(getPortalNavigation("client"), "/informes")?.id, "analitica");
});

test("resource detail routes activate their section without matching similarly named routes", () => {
  const modules = getPortalNavigation("consultant");
  for (const [moduleId, itemPath] of [
    ["shopify", "/shopify/productos"], ["shopify", "/shopify/promociones"],
    ["meta", "/meta/campanas"], ["meta", "/meta/creativos"], ["klaviyo", "/klaviyo/emails"],
  ]) {
    const item = modules.find((m) => m.id === moduleId)!.items.find((row) => row.href === itemPath)!;
    assert.equal(isPortalNavItemActive(item, `${itemPath}/entity-1`, new URLSearchParams()), true, itemPath);
    assert.equal(isPortalNavItemActive(item, `${itemPath}-other/entity-1`, new URLSearchParams()), false, itemPath);
  }
});

test("settings visibility respects the active organization and management access", () => {
  const items = (org: boolean, manage: boolean) => getPortalNavigation("client", org, manage).find((m) => m.id === "configuracion")!.items;
  assert.equal(items(true, false).some((item) => item.href.includes("section=equipo")), false);
  assert.equal(items(true, true).some((item) => item.href.includes("section=equipo")), true);
  assert.equal(items(false, true).some((item) => item.href.includes("section=plan")), false);
});
