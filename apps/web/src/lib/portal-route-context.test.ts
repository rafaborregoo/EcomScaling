import assert from "node:assert/strict";
import test from "node:test";
import { withPortalRouteContext } from "./portal-route-context";

test("adds the organization and connection without losing an inventory filter", () => {
  assert.equal(
    withPortalRouteContext("/shopify/inventario?filter=out", "org-1", "conn-1"),
    "/shopify/inventario?filter=out&organizationId=org-1&connectionId=conn-1",
  );
});

test("preserves an explicit organization and connection in the destination", () => {
  assert.equal(
    withPortalRouteContext("/meta?organizationId=org-2&connectionId=conn-2", "org-1", "conn-1"),
    "/meta?organizationId=org-2&connectionId=conn-2",
  );
});

test("preserves the URL hash for focused entities", () => {
  assert.equal(
    withPortalRouteContext("/tareas?task=task-1#task-1", "org-1"),
    "/tareas?task=task-1&organizationId=org-1#task-1",
  );
});

test("Meta, Klaviyo and Marketing deep links preserve the selected store", () => {
  for (const route of ["/meta/creativos", "/klaviyo/flows", "/marketing?section=contenido"]) {
    const target = new URL(withPortalRouteContext(route, "org-1", "conn-1"), "http://local");
    assert.equal(target.searchParams.get("organizationId"), "org-1");
    assert.equal(target.searchParams.get("connectionId"), "conn-1", route);
  }
  assert.equal(new URL(withPortalRouteContext("/web", "org-1", "conn-1"), "http://local").searchParams.has("connectionId"), false);
  assert.equal(new URL(withPortalRouteContext("/shopify-tools", "org-1", "conn-1"), "http://local").searchParams.has("connectionId"), false);
});

test("external and protocol-relative links are never rewritten as internal destinations", () => {
  for (const href of ["https://shop.example/path", "//shop.example/path", "/\\shop.example/path"]) {
    assert.equal(withPortalRouteContext(href, "org-1", "conn-1"), href);
  }
});

test("opening a store in dashboard and following work keeps the selected connection", () => {
  for (const route of ["/dashboard", "/tareas", "/camino", "/informes", "/panel"]) {
    const url = new URL(withPortalRouteContext(route, "client", "store-connection"), "http://local");
    assert.equal(url.searchParams.get("connectionId"), "store-connection");
  }
});
