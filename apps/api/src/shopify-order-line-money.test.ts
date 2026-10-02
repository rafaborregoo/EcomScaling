import assert from "node:assert/strict";
import test from "node:test";
import { sumShopifyLineDiscountAllocations } from "./shopify-order-line-money.js";

test("sums actual line allocations in the shop currency", () => {
  assert.equal(
    sumShopifyLineDiscountAllocations([
      { allocatedAmountSet: { shopMoney: { amount: "5.25" } } },
      { allocatedAmountSet: { shopMoney: { amount: "2.75" } } },
    ]),
    8,
  );
});

test("missing, invalid, and non-finite amounts do not poison the total", () => {
  assert.equal(
    sumShopifyLineDiscountAllocations([
      { allocatedAmountSet: { shopMoney: { amount: "not-money" } } },
      { allocatedAmountSet: { shopMoney: { amount: null } } },
      { allocatedAmountSet: { shopMoney: { amount: Number.POSITIVE_INFINITY } } },
      {},
    ]),
    0,
  );
});

test("an absent allocation list is zero", () => {
  assert.equal(sumShopifyLineDiscountAllocations(undefined), 0);
});
