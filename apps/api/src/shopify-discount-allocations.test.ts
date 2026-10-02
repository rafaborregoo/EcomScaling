import assert from "node:assert/strict";
import test from "node:test";
import { aggregateShopifyDiscountAllocations } from "./shopify-discount-allocations.js";

test("aggregates line and shipping allocations per order discount application", () => {
  const result = aggregateShopifyDiscountAllocations([
    [
      { discountApplication: { index: 0 }, allocatedAmountSet: { shopMoney: { amount: "2.50" } } },
      { discountApplication: { index: 1 }, allocatedAmountSet: { shopMoney: { amount: "1.00" } } },
    ],
    [
      { discountApplication: { index: 0 }, allocatedAmountSet: { shopMoney: { amount: "0.75" } } },
      { discountApplication: { index: 1 }, allocatedAmountSet: { shopMoney: { amount: "0.25" } } },
    ],
  ]);

  assert.deepEqual([...result.entries()], [[0, 3.25], [1, 1.25]]);
});

test("ignores allocations without a valid application index or shop amount", () => {
  const result = aggregateShopifyDiscountAllocations([
    [
      { discountApplication: { index: -1 }, allocatedAmountSet: { shopMoney: { amount: "2" } } },
      { discountApplication: { index: 0 }, allocatedAmountSet: { shopMoney: { amount: "not-a-number" } } },
      { allocatedAmountSet: { shopMoney: { amount: "1" } } },
    ],
  ]);

  assert.equal(result.size, 0);
});
