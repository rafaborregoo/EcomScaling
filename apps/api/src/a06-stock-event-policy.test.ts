import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateA06StockEvent,
  a06StockEventExamples,
  type A06InventoryChange,
  type A06EventProduct,
} from "./a06-stock-event-policy.js";

for (const example of a06StockEventExamples())
  test(example.label, () =>
    assert.equal(example.result.shouldReview, example.expected),
  );
const change: A06InventoryChange = {
  inventory_state_id: "level",
  product_id: "product",
  variant_id: "variant",
  location_id: "location",
  previous_quantity: 30,
  available_quantity: 10,
  observed_at: "2026-10-29T08:00:00Z",
};
const product: A06EventProduct = {
  product_id: "product",
  available_quantity: 10,
  inventory_status: "tracked_current",
  inventory_sync_is_stale: false,
  stock_coverage_sample_sufficient: true,
  average_daily_sales: 4,
  days_of_cover: 2.5,
};
test("la misma caída numérica requiere inventario completo y fresco", () => {
  for (const invalid of [
    { inventory_sync_is_stale: true },
    { inventory_status: "partial_sync" },
    { available_quantity: null },
  ]) {
    const result = evaluateA06StockEvent(
      [change],
      [{ ...product, ...invalid }],
      3,
    );
    assert.equal(result.shouldReview, false);
    assert.equal(result.abstentions.length, 1);
  }
});
test("no calcula riesgo de cobertura con una muestra insuficiente", () => {
  const result = evaluateA06StockEvent(
    [change],
    [{ ...product, stock_coverage_sample_sufficient: false }],
    3,
  );
  assert.equal(result.shouldReview, false);
  assert.equal(result.abstentions[0]?.reason, "demand_sample_insufficient");
});
test("un cero de ubicación no se presenta como agotamiento de todo el producto", () => {
  const result = evaluateA06StockEvent(
    [{ ...change, previous_quantity: 4, available_quantity: 0 }],
    [{ ...product, available_quantity: 100, days_of_cover: 25 }],
    3,
  );
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0]?.reason, "location_empty");
  assert.equal(result.signals[0]?.inventory_state_id, "level");
  assert.equal(result.signals[0]?.days_of_cover, 25);
});
test("agrupa cambios de varias ubicaciones antes de estimar la cobertura anterior", () => {
  const result = evaluateA06StockEvent(
    [
      { ...change, previous_quantity: 15, available_quantity: 5 },
      {
        ...change,
        inventory_state_id: "other-level",
        previous_quantity: 15,
        available_quantity: 5,
      },
    ],
    [product],
    3,
  );
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0]?.previous_days_of_cover, 7.5);
});
test("stock repuesto dentro de la misma ráfaga no dispara una alerta por un dato anterior", () => {
  assert.equal(
    evaluateA06StockEvent(
      [{ ...change, available_quantity: 30 }],
      [{ ...product, available_quantity: 30, days_of_cover: 7.5 }],
      3,
    ).shouldReview,
    false,
  );
});
test("la caída a una franja más grave adelanta una nueva revisión", () => {
  const result = evaluateA06StockEvent(
    [{ ...change, previous_quantity: 10, available_quantity: 3 }],
    [{ ...product, available_quantity: 3, days_of_cover: 0.75 }],
    3,
  );
  assert.equal(result.signals[0]?.reason, "coverage_critical");
});
test("una caída porcentual grande con cobertura suficiente no dispara el modelo", () => {
  assert.equal(
    evaluateA06StockEvent(
      [{ ...change, previous_quantity: 3000, available_quantity: 30 }],
      [{ ...product, available_quantity: 30, days_of_cover: 7.5 }],
      3,
    ).shouldReview,
    false,
  );
});
test("recuperar un stock conocido y crítico también permite revisar, sin inventar el valor anterior", () => {
  const result = evaluateA06StockEvent(
    [{ ...change, previous_quantity: null }],
    [product],
    3,
  );
  assert.equal(result.shouldReview, true);
  assert.equal(result.signals[0]?.previous_days_of_cover, null);
});
test("el redondeo visible de cobertura no convierte un valor superior al umbral en riesgo", () => {
  const result = evaluateA06StockEvent(
    [{ ...change, available_quantity: 10 }],
    [
      {
        ...product,
        days_of_cover: 3,
        average_daily_sales: 3.3,
        quantity_sold_in_period: 99,
        period_days: 30,
      },
    ],
    3,
  );
  assert.equal(result.shouldReview, false);
});
