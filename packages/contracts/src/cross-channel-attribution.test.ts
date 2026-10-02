import assert from "node:assert/strict";
import test from "node:test";
import {
  attributionEvidenceSchema,
  buildCrossChannelMeasurementSet,
  compareToEconomicAnchor,
  type AttributionEvidence,
} from "./cross-channel-attribution.js";

const period = { start: "2026-09-01", end: "2026-09-30" };

const anchor = (value: number | null, currency: string | null = "EUR"): AttributionEvidence => ({
  metric_id: "shopify.net_sales",
  source_system: "shopify",
  channel: "store",
  measurement_period: period,
  measurement_basis: "observed",
  attribution_basis: null,
  attribution_model: null,
  attribution_window: null,
  revenue_basis: "shopify_current_total_price_minus_refunds",
  currency_code: currency,
  value,
  value_state: value === null ? "missing" : "available",
  evidence_role: "economic_anchor",
  lineage: ["test"],
  data_maturity: "provisional",
  limitations: [],
});

const channel = (
  source: "meta" | "klaviyo",
  value: number | null,
  overrides: Partial<AttributionEvidence> = {},
): AttributionEvidence => ({
  metric_id: `${source}.revenue`,
  source_system: source,
  channel: source === "meta" ? "paid_social" : "email",
  measurement_period: period,
  measurement_basis: "observed",
  attribution_basis: "attributed",
  attribution_model: "platform_reported",
  attribution_window: source === "meta" ? "7d_click" : null,
  revenue_basis: "platform_attributed_purchase_value",
  currency_code: "EUR",
  value,
  value_state: value === null ? "missing" : "available",
  evidence_role: "channel_signal",
  lineage: ["test"],
  data_maturity: "provisional",
  limitations: [],
  ...overrides,
});

/** Todos los numeros y claves del objeto, para buscar sumas o etiquetas prohibidas. */
function walk(value: unknown, numbers: number[] = [], keys: string[] = []) {
  if (typeof value === "number") numbers.push(value);
  else if (Array.isArray(value)) value.forEach((item) => walk(item, numbers, keys));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.push(key);
      walk(item, numbers, keys);
    }
  }
  return { numbers, keys };
}

test("Meta atribuido por encima de Shopify: ratio > 100, sin suma ni recorte", () => {
  const result = compareToEconomicAnchor(anchor(10_000), channel("meta", 15_000));
  assert.equal(result.comparison_status, "comparable");
  assert.equal(result.dependency_pct, 150);
  const set = buildCrossChannelMeasurementSet(anchor(10_000), [channel("meta", 15_000)]);
  assert.equal(set.economic_anchor.value, 10_000);
  assert.ok(!walk(set).numbers.includes(25_000));
});

test("Meta + Klaviyo: cada canal contra el ancla, ningun total atribuido", () => {
  const set = buildCrossChannelMeasurementSet(anchor(10_000), [
    channel("meta", 2_500),
    channel("klaviyo", 1_500),
  ]);
  const { numbers, keys } = walk(set);
  assert.ok(!numbers.includes(4_000), "meta + klaviyo no aparece como cifra");
  assert.ok(!numbers.includes(40), "ni su dependency sumada");
  assert.ok(!keys.some((key) => /total|sum/i.test(key)));
  assert.deepEqual(
    set.comparisons.map((item) => [item.source_system, item.dependency_pct]),
    [["meta", 25], ["klaviyo", 15]],
  );
  // Klaviyo sin ventana rebaja el conjunto entero.
  assert.equal(set.comparison_status, "partially_comparable");
});

test("monedas distintas o desconocidas: no comparable y sin ratio", () => {
  const mismatch = compareToEconomicAnchor(anchor(10_000, "EUR"), channel("klaviyo", 1_500, { currency_code: "USD" }));
  assert.equal(mismatch.comparison_status, "not_comparable");
  assert.deepEqual(mismatch.compatibility_issues, ["currency_mismatch"]);
  assert.equal(mismatch.dependency_pct, null);

  const unknown = compareToEconomicAnchor(anchor(10_000, null), channel("meta", 1_500));
  assert.deepEqual(unknown.compatibility_issues, ["currency_unknown"]);
  assert.equal(unknown.dependency_pct, null);
});

test("periodos distintos: no comparable", () => {
  const result = compareToEconomicAnchor(
    anchor(10_000),
    channel("meta", 1_000, { measurement_period: { start: "2026-08-01", end: "2026-08-31" } }),
  );
  assert.equal(result.comparison_status, "not_comparable");
  assert.deepEqual(result.compatibility_issues, ["measurement_period_mismatch"]);
  assert.equal(result.dependency_pct, null);
});

test("ventana desconocida: ratio calculable pero comparabilidad parcial, nada inventado", () => {
  const result = compareToEconomicAnchor(anchor(10_000), channel("klaviyo", 1_500));
  assert.equal(result.comparison_status, "partially_comparable");
  assert.deepEqual(result.compatibility_issues, ["missing_attribution_context"]);
  assert.ok(result.unknowns.includes("klaviyo.revenue:attribution_window"));
});

test("dato ausente o ancla 0: nunca ratio 0 ni infinito", () => {
  const missing = compareToEconomicAnchor(anchor(10_000), channel("klaviyo", null));
  assert.equal(missing.comparison_status, "insufficient_context");
  assert.equal(missing.dependency_pct, null);
  const noAnchor = compareToEconomicAnchor(anchor(null), channel("meta", 1_000));
  assert.equal(noAnchor.dependency_pct, null);
  const zeroAnchor = compareToEconomicAnchor(anchor(0), channel("meta", 1_000));
  assert.equal(zeroAnchor.comparison_status, "insufficient_context");
  assert.equal(zeroAnchor.dependency_pct, null);
});

test("atribucion != incrementalidad: una senal de canal no puede declararse incremental", () => {
  assert.equal(attributionEvidenceSchema.safeParse(channel("meta", 1_000)).success, true);
  assert.equal(
    attributionEvidenceSchema.safeParse(channel("meta", 1_000, { attribution_basis: "incremental" })).success,
    false,
  );
  const set = buildCrossChannelMeasurementSet(anchor(10_000), [channel("meta", 1_000), channel("klaviyo", 500)]);
  assert.ok(!walk(set).keys.some((key) => /incremental/i.test(key)));
});

test("missing != 0: value solo con value_state=available", () => {
  assert.equal(attributionEvidenceSchema.safeParse(channel("klaviyo", 0, { value_state: "missing" })).success, false);
  assert.equal(attributionEvidenceSchema.safeParse(channel("klaviyo", null)).success, true);
});
