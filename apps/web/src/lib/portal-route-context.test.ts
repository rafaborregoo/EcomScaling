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
