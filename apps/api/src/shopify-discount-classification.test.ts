import assert from "node:assert/strict";
import test from "node:test";
import { classifyDiscount } from "./shopify-sync.js";

test("un porcentaje llega como fraccion y se guarda en puntos", () => {
  const result = classifyDiscount("DiscountCodeBasic", { percentage: 0.15 });
  assert.equal(result.discountClass, "percentage");
  assert.equal(result.valueType, "percentage");
  assert.equal(result.amount, 15);
});

test("un descuento de importe fijo conserva el importe", () => {
  const result = classifyDiscount("DiscountAutomaticBasic", {
    amount: { amount: "10.50" },
  });
  assert.equal(result.discountClass, "fixed_amount");
  assert.equal(result.valueType, "fixed_amount");
  assert.equal(result.amount, 10.5);
});

test("el envio gratis es una clase, no un valor cero", () => {
  const result = classifyDiscount("DiscountCodeFreeShipping", null);
  assert.equal(result.discountClass, "free_shipping");
  assert.equal(result.valueType, null);
  assert.equal(result.amount, null);
});

test("un 2x1 se distingue del envio gratis aunque tampoco tenga importe", () => {
  const result = classifyDiscount("DiscountAutomaticBxgy", undefined);
  assert.equal(result.discountClass, "bxgy");
  assert.equal(result.amount, null);
});

test("un 0% sigue siendo un porcentaje y no un descuento sin valor", () => {
  const result = classifyDiscount("DiscountCodeBasic", { percentage: 0 });
  assert.equal(result.discountClass, "percentage");
  assert.equal(result.amount, 0);
});

test("un tipo desconocido no inventa clase", () => {
  const result = classifyDiscount("DiscountCodeSomethingNew", null);
  assert.equal(result.discountClass, null);
  assert.equal(result.valueType, null);
});
