import assert from "node:assert/strict";
import test from "node:test";
import {
  labelOrganizationAlertsForStore,
  partitionOpenTasksForStore,
} from "./shopify-operational-context.js";

test("A13 separates selected-store tasks from unattributed tasks and excludes another store", () => {
  const result = partitionOpenTasksForStore(
    [
      { id: "same", title: "Tienda A", store_id: "store-a" },
      { id: "global", title: "Sin asignar", store_id: null },
      { id: "other", title: "Tienda B", store_id: "store-b" },
    ],
    "store-a",
  );
  assert.equal(result.scope, "selected_store");
  assert.deepEqual(result.store_tasks.map((task) => task.id), ["same"]);
  assert.deepEqual(result.organization_unattributed_tasks.map((task) => task.id), ["global"]);
  assert.equal(result.unattributed_tasks_purpose, "duplicate_avoidance_only");
  assert.equal(result.excluded_other_store_count, 1);
});

test("organization alerts are never presented as evidence for a selected store", () => {
  assert.deepEqual(labelOrganizationAlertsForStore([{ id: "alert" }], "store-a"), {
    scope: "organization_unattributed",
    store_attribution_available: false,
    eligible_as_store_evidence: false,
    items: [{ id: "alert" }],
  });
});
