import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMetaMeasurementVerdict, metaMeasurementStatusFromContext, unknownMetaMeasurementVerdict } from "./meta-measurement-verdict.js";

const source = (rows: Array<Record<string, unknown>> = []) => ({ available: true, rows });
const evaluatedAt = new Date("2026-09-29T12:00:00.000Z");
const freshSync = "2026-09-29T11:00:00.000Z";
const freshLearning = {
  activity_sync_state: "fresh",
  account_last_synced_at: freshSync,
  spend_in_period: 30,
};
const freshMapping = {
  ad_set_id: "set-1",
  pixel_id: "pixel-1",
  eligible_ad_set_count: 1,
  spend_in_period: 30,
  mapping_status: "mapped_event_observed",
  matched_event_last_date: "2026-09-28",
  pixel_last_synced_at: freshSync,
  ad_set_rows_truncated: false,
};

test("A24 only returns usable when spend-bearing ad sets explicitly observed their mapped event", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: source([freshLearning]),
    issues: source(),
    eventMapping: source([freshMapping]),
    issueSnapshot: source([{ complete: true }]),
  }, evaluatedAt);
  assert.equal(verdict.status, "usable_with_attribution_limits");
  assert.match(verdict.limitations.join(" "), /causalidad/);
});

test("A24 restricts known event gaps and fresh rejection without describing them as causal", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: source([freshLearning]),
    issues: source([{ review_category: "rejected", freshness: "fresh" }]),
    eventMapping: source([{ ...freshMapping, spend_in_period: 5, mapping_status: "mapped_event_not_observed_in_synced_window" }]),
    issueSnapshot: source([{ complete: true }]),
  }, evaluatedAt);
  assert.equal(verdict.status, "restricted");
  assert.ok(verdict.reason_codes.includes("promoted_event_not_observed_or_unresolved"));
  assert.ok(verdict.reason_codes.includes("fresh_rejected_ads_present"));
});

test("A24 treats failed or stale required sources as unknown, never as healthy", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: { available: false, rows: [] },
    issues: source(),
    eventMapping: source([{ ...freshMapping, spend_in_period: 5 }]),
    issueSnapshot: source([{ complete: true }]),
  }, evaluatedAt);
  assert.equal(verdict.status, "unknown");
  assert.deepEqual(unknownMetaMeasurementVerdict().status, "unknown");
});

test("A24 does not call a no-spend period healthy", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: source([{ activity_sync_state: "fresh" }]),
    issues: source(),
    eventMapping: source(),
    issueSnapshot: source([{ complete: true }]),
  }, evaluatedAt);
  assert.equal(verdict.status, "not_assessable");
  assert.ok(verdict.reason_codes.includes("no_eligible_spend_observed"));
});

test("A23 can only echo an explicit A24 verdict and treats missing or malformed context as unknown", () => {
  const block = (status: string) => [{
    label: "Veredicto determinista A24 sobre fiabilidad de medición",
    data: { status },
  }];
  assert.equal(metaMeasurementStatusFromContext(block("restricted")), "restricted");
  assert.equal(metaMeasurementStatusFromContext(block("usable_with_attribution_limits")), "usable_with_attribution_limits");
  assert.equal(metaMeasurementStatusFromContext([]), "unknown");
  assert.equal(metaMeasurementStatusFromContext(block("healthy")), "unknown");
});

test("A24 returns unknown for stale pixel/account/issue sync or incomplete samples", () => {
  const base = {
    pixels: source([{ is_unavailable: false }]),
    learning: source([freshLearning]),
    issues: source(),
    eventMapping: source([freshMapping]),
    issueSnapshot: source([{ complete: true }]),
  };
  const stalePixel = buildMetaMeasurementVerdict({
    ...base,
    eventMapping: source([{ ...freshMapping, pixel_last_synced_at: "2026-09-26T00:00:00.000Z" }]),
  }, evaluatedAt);
  assert.equal(stalePixel.status, "unknown");
  assert.ok(stalePixel.reason_codes.includes("pixel_sync_stale_or_unknown"));

  const staleAccount = buildMetaMeasurementVerdict({
    ...base,
    learning: source([{ ...freshLearning, account_last_synced_at: null }]),
  }, evaluatedAt);
  assert.equal(staleAccount.status, "unknown");
  assert.ok(staleAccount.reason_codes.includes("account_sync_stale_or_unknown"));

  const staleIssue = buildMetaMeasurementVerdict({
    ...base,
    issues: source([{ review_category: "warning", freshness: "stale" }]),
    issueSnapshot: source([{ complete: false }]),
  }, evaluatedAt);
  assert.equal(staleIssue.status, "unknown");
  assert.ok(staleIssue.reason_codes.includes("review_issue_sync_stale_or_unknown"));

  const truncatedMapping = buildMetaMeasurementVerdict({
    ...base,
    eventMapping: source([{ ...freshMapping, ad_set_rows_truncated: true }]),
  }, evaluatedAt);
  assert.equal(truncatedMapping.status, "unknown");
  assert.ok(truncatedMapping.reason_codes.includes("optimization_event_mapping_truncated"));

  const fullIssuePage = buildMetaMeasurementVerdict({
    ...base,
    issues: source(Array.from({ length: 500 }, () => ({ freshness: "fresh" }))),
  }, evaluatedAt);
  assert.equal(fullIssuePage.status, "unknown");
  assert.ok(fullIssuePage.reason_codes.includes("review_issue_sample_may_be_truncated"));
});

test("A24 final migration keeps the v9 prompt and cache writer guard", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20270107120000_a24_measurement_integrity.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /'v9'/);
  assert.match(migration, /meta_save_measurement_verdict/);
  assert.match(migration, /source_fingerprint/);
  assert.match(migration, /where public\.meta_measurement_verdict_cache\.evaluated_at <= excluded\.evaluated_at/);
});
