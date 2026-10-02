import assert from "node:assert/strict";
import test from "node:test";
import {
  groupRankingRowsByDimensionCurrency,
  summarizeCreativeSpendByCurrency,
} from "./creative-currency.js";

test("creative spend is aggregated per verified currency, never across currencies", () => {
  const result = summarizeCreativeSpendByCurrency([
    { spend: 12.5, spend_currency: "EUR" },
    { spend: 7.5, spend_currency: "EUR" },
    { spend: 20, spend_currency: "USD" },
    { spend: 99, spend_currency: null },
    { spend: 10, spend_currency: "" },
  ]);

  assert.deepEqual(result.totals, [
    { currencyCode: "EUR", amount: 20 },
    { currencyCode: "USD", amount: 20 },
  ]);
  assert.equal(result.unknownCurrencyRows, 2);
});

test("ranking rows stay separated by dimension and currency, including unknown currency", () => {
  const eur = { dimension: "calidad", currency_code: "EUR", ranking_value: "above_average" };
  const usd = { dimension: "calidad", currency_code: "USD", ranking_value: "above_average" };
  const unknown = { dimension: "calidad", currency_code: null, ranking_value: "above_average" };
  const interaction = { dimension: "interaccion", currency_code: "EUR", ranking_value: "above_average" };

  const groups = groupRankingRowsByDimensionCurrency([eur, usd, unknown, interaction]);

  assert.deepEqual(groups.map(({ dimension, currencyCode, rows }) => ({
    dimension,
    currencyCode,
    rows,
  })), [
    { dimension: "calidad", currencyCode: "EUR", rows: [eur] },
    { dimension: "calidad", currencyCode: "USD", rows: [usd] },
    { dimension: "calidad", currencyCode: null, rows: [unknown] },
    { dimension: "interaccion", currencyCode: "EUR", rows: [interaction] },
  ]);
});
