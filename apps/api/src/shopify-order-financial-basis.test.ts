import assert from "node:assert/strict";
import test from "node:test";
import { isMissingShopifyFinancialBasisSchema, shopifyMoneyAmount, shopifyOrderFinancialBasis, withoutShopifyFinancialBasis } from "./shopify-order-financial-basis.js";

test("partial returns are subtracted once from the before-return total", () => {
  assert.deepEqual(shopifyOrderFinancialBasis("120.00", "60.00", 60), { total_before_returns: 120, net_sales: 60 });
  assert.deepEqual(shopifyOrderFinancialBasis("0.00", "0.00", 0), { total_before_returns: 0, net_sales: 0 });
});

test("unknown provider totals remain unverified rather than becoming known zero", () => {
  for (const value of [null, undefined, "", " ", "invalid", "Infinity", Infinity, -1, true, "0x10"]) {
    assert.equal(shopifyMoneyAmount(value), null);
    assert.equal(shopifyOrderFinancialBasis(value, 120, 20).total_before_returns, null);
  }
  assert.equal(shopifyMoneyAmount("0"), 0);
});

test("legacy ingestion uses the before-return basis and preserves unrelated fields", () => {
  assert.deepEqual(withoutShopifyFinancialBasis({ id: "order", total_before_returns: 120, current_total_price: 60, refunds: 60, net_sales: 60 }), { id: "order", current_total_price: 120, refunds: 60, net_sales: 60 });
  assert.deepEqual(withoutShopifyFinancialBasis({ total_before_returns: null, current_total_price: 80 }), { current_total_price: 80 });
});

test("only a missing basis column permits a schema fallback", () => {
  assert.equal(isMissingShopifyFinancialBasisSchema("Could not find total_before_returns in the schema cache"), true);
  assert.equal(isMissingShopifyFinancialBasisSchema('column "total_before_returns" does not exist'), true);
  assert.equal(isMissingShopifyFinancialBasisSchema("permission denied for total_before_returns"), false);
  assert.equal(isMissingShopifyFinancialBasisSchema("other column does not exist"), false);
});
