import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOwnedInventoryItem } from "./shopify-product-costs.js";

function createInventoryLookupStub(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const filters: Array<[string, string, unknown]> = [];
  const query = {
    select() {
      return query;
    },
    eq(column: string, operatorValue: unknown) {
      filters.push(["eq", column, operatorValue]);
      return query;
    },
    async maybeSingle() {
      return result;
    },
  };
  return {
    client: { from: () => query } as unknown as SupabaseClient,
    filters,
  };
}

test("resuelve un inventory item solo dentro de la organizacion solicitante", async () => {
  const stub = createInventoryLookupStub({
    data: { id: "inventory-a" },
    error: null,
  });
  const result = await findOwnedInventoryItem(stub.client, "org-a", {
    inventoryItemId: "inventory-a",
  });

  assert.deepEqual(result, { ok: true, data: { id: "inventory-a" } });
  assert.deepEqual(stub.filters, [
    ["eq", "organization_id", "org-a"],
    ["eq", "id", "inventory-a"],
  ]);
});

test("un inventory item de otro tenant se comporta como no encontrado", async () => {
  const stub = createInventoryLookupStub({ data: null, error: null });
  const result = await findOwnedInventoryItem(stub.client, "org-a", {
    inventoryItemId: "inventory-b",
  });

  assert.deepEqual(result, {
    ok: false,
    statusCode: 404,
    error: "inventory_item_not_found",
  });
  assert.deepEqual(stub.filters[0], ["eq", "organization_id", "org-a"]);
});
