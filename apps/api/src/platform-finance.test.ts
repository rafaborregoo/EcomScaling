import assert from "node:assert/strict";
import test from "node:test";
import {
  expenseOccurrences,
  summarizePlatformExpenses,
  type PlatformExpense,
} from "./platform-finance.js";

function expense(patch: Partial<PlatformExpense>): PlatformExpense {
  return {
    id: "expense_1",
    name: "Supabase",
    vendor: "Supabase",
    category: "hosting",
    amount: 25,
    tax_amount: 0,
    currency_code: "EUR",
    billing_period: "monthly",
    starts_on: "2026-01-31",
    ends_on: null,
    deductible: true,
    notes: null,
    document_url: null,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

test("prorratea un gasto mensual por ocurrencias reales y ajusta fin de mes", () => {
  assert.equal(
    expenseOccurrences(
      expense({ starts_on: "2026-01-31" }),
      "2026-02-01T00:00:00Z",
      "2026-03-31T23:59:59Z",
    ),
    2,
  );
});

test("resume gastos activos por moneda y categoria", () => {
  const summary = summarizePlatformExpenses(
    [
      expense({ amount: 25, category: "hosting" }),
      expense({ id: "expense_2", amount: 20, category: "ai" }),
      expense({ id: "expense_3", amount: 99, status: "archived" }),
    ],
    "2026-09-01T00:00:00Z",
    "2026-09-30T23:59:59Z",
  );

  assert.equal(summary.currency, "EUR");
  assert.equal(summary.total, 45);
  assert.equal(summary.active_recurring, 2);
  assert.deepEqual(
    summary.by_category.map((row) => [row.category, row.amount]),
    [
      ["hosting", 25],
      ["ai", 20],
    ],
  );
});
