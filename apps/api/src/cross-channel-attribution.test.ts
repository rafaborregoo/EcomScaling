import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCrossChannelMeasurementSet } from "@e-nora/contracts";
import {
  klaviyoCampaignRevenueEvidence,
  metaPurchaseValueEvidence,
  shopifyNetSalesEvidence,
  singleCurrency,
} from "./cross-channel-attribution.js";

const period = { start: "2026-09-01", end: "2026-09-30" };
const shopify = (netSales: unknown = "10000", storeCurrencies: Array<string | null> = ["EUR"]) =>
  shopifyNetSalesEvidence({ period, netSales, storeCurrencies });
const meta = (purchaseValue: unknown, attributionWindow: string | null | undefined = "7d_click", accountCurrencies: Array<string | null> = ["EUR"]) =>
  metaPurchaseValueEvidence({ period, purchaseValue, accountCurrencies, attributionWindow });
const klaviyo = (overrides: Partial<Parameters<typeof klaviyoCampaignRevenueEvidence>[0]> = {}) =>
  klaviyoCampaignRevenueEvidence({
    period,
    revenue: "1500",
    recipients: 4000,
    accountCurrencies: ["EUR"],
    conversionMetricSelected: true,
    ...overrides,
  });

test("caso 1: Shopify + Meta, misma moneda y periodo -> comparacion valida", () => {
  const set = buildCrossChannelMeasurementSet(shopify(), [meta("2500")]);
  assert.equal(set.comparison_status, "comparable");
  assert.equal(set.comparisons[0]?.dependency_pct, 25);
  assert.equal(set.channel_evidence[0]?.attribution_window, "7d_click");
});

test("caso 2: Shopify + Klaviyo, misma moneda y periodo -> dependency_pct valido", () => {
  const set = buildCrossChannelMeasurementSet(shopify(), [klaviyo()]);
  assert.equal(set.comparisons[0]?.dependency_pct, 15);
  // Sin ventana conocida la comparabilidad baja, pero la relacion existe.
  assert.equal(set.comparison_status, "partially_comparable");
});

test("caso 3: Meta atribuye mas que Shopify vende -> no se suma", () => {
  const set = buildCrossChannelMeasurementSet(shopify("10000"), [meta("15000")]);
  assert.equal(set.comparisons[0]?.dependency_pct, 150);
  assert.equal(set.economic_anchor.value, 10000);
  assert.ok(!JSON.stringify(set).includes("25000"));
});

test("caso 4: Meta + Klaviyo -> ningun meta_revenue + klaviyo_revenue", () => {
  const set = buildCrossChannelMeasurementSet(shopify(), [meta("2500"), klaviyo()]);
  assert.ok(!JSON.stringify(set).includes("4000"));
  assert.deepEqual(
    set.comparisons.map((item) => item.dependency_pct),
    [25, 15],
  );
});

test("caso 5: monedas distintas -> sin agregado ni dependency_pct", () => {
  const usd = buildCrossChannelMeasurementSet(shopify(), [klaviyo({ accountCurrencies: ["USD"] })]);
  assert.equal(usd.comparison_status, "not_comparable");
  assert.deepEqual(usd.compatibility_issues, ["currency_mismatch"]);
  assert.equal(usd.comparisons[0]?.dependency_pct, null);
  // Dos cuentas Meta con monedas distintas: la moneda del canal es desconocida.
  const mixed = buildCrossChannelMeasurementSet(shopify(), [meta("2500", "7d_click", ["EUR", "USD"])]);
  assert.deepEqual(mixed.compatibility_issues, ["currency_unknown"]);
  assert.equal(mixed.comparisons[0]?.dependency_pct, null);
  assert.equal(singleCurrency(["eur", "EUR"]), "EUR");
  assert.equal(singleCurrency([]), null);
  assert.equal(singleCurrency(["EUR", null]), null);
});

test("caso 6: ventana desconocida -> null, nunca inventada", () => {
  assert.equal(klaviyo().attribution_window, null);
  // RPC anterior a la migracion f10: la columna no existe.
  assert.equal(
    metaPurchaseValueEvidence({ period, purchaseValue: "2500", accountCurrencies: ["EUR"], attributionWindow: undefined })
      .attribution_window,
    null,
  );
  assert.equal(meta("2500", "  ").attribution_window, null);
  const set = buildCrossChannelMeasurementSet(shopify(), [meta("2500", null)]);
  assert.deepEqual(set.compatibility_issues, ["missing_attribution_context"]);
  // La ventana de descarga de clicks no se cuela como ventana de atribucion.
  const adapter = readFileSync(new URL("./cross-channel-attribution.ts", import.meta.url), "utf8");
  assert.ok(!/KLAVIYO_CLICK_WINDOW_DAYS\s*[,)}]/.test(adapter));
  assert.ok(!/attribution_window:\s*["'`]\d/.test(adapter));
});

test("caso 7: Klaviyo incompleto -> desconocido, no 0 EUR", () => {
  const noMetric = klaviyo({ revenue: "0", conversionMetricSelected: false });
  assert.equal(noMetric.value, null);
  assert.equal(noMetric.value_state, "missing");
  const noReport = klaviyo({ revenue: "0", recipients: 0 });
  assert.equal(noReport.value, null);
  const set = buildCrossChannelMeasurementSet(shopify(), [noMetric]);
  assert.equal(set.comparison_status, "insufficient_context");
  assert.equal(set.comparisons[0]?.dependency_pct, null);
  // Sin tienda Shopify tampoco hay ancla (ni 0).
  assert.equal(shopify("0", []).value, null);
});

test("caso 8: los adaptadores nunca etiquetan lo atribuido como incremental", () => {
  for (const evidence of [meta("2500"), klaviyo()]) {
    assert.equal(evidence.attribution_basis, "attributed");
    assert.equal(evidence.evidence_role, "channel_signal");
  }
  assert.equal(shopify().attribution_basis, null);
});

test("consultant_meta_by_org f10: compra canonica, una ventana por fila y la ventana viaja", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20261115831000_f10_consultant_meta_by_org_attribution_window.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /drop function if exists public\.consultant_meta_by_org\(uuid\[\], date, date\);/);
  assert.match(sql, /m\.action_type = a\.canonical_purchase_action_type/);
  assert.match(sql, /distinct on \(m\.insight_row_id, m\.metric_name\)/);
  assert.match(sql, /public\.meta_attribution_window_rank\(m\.attribution_window\)/);
  assert.match(sql, /purchase_attribution_window text/);
  assert.doesNotMatch(sql, /action_type in \(/);
});

test("klaviyo-sync lee la moneda del campo real de la Accounts API", () => {
  const sync = readFileSync(new URL("./klaviyo-sync.ts", import.meta.url), "utf8");
  assert.match(sync, /accountAttributes\.preferred_currency/);
  assert.doesNotMatch(sync, /accountAttributes\.currency_code/);
});
