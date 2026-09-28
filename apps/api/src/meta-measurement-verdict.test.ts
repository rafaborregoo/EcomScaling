import assert from "node:assert/strict";
import test from "node:test";
import { buildMetaMeasurementVerdict, unknownMetaMeasurementVerdict } from "./meta-measurement-verdict.js";

const source = (rows: Array<Record<string, unknown>> = []) => ({ available: true, rows });

test("A24 only returns usable when spend-bearing ad sets explicitly observed their mapped event", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: source([{ activity_sync_state: "fresh" }]),
    issues: source(),
    eventMapping: source([{ eligible_ad_set_count: 2, spend_in_period: 30, mapping_status: "mapped_event_observed" }]),
  });
  assert.equal(verdict.status, "usable_with_attribution_limits");
  assert.match(verdict.limitations.join(" "), /causalidad/);
});

test("A24 restricts known event gaps and fresh rejection without describing them as causal", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: source([{ activity_sync_state: "fresh" }]),
    issues: source([{ review_category: "rejected", freshness: "fresh" }]),
    eventMapping: source([{ eligible_ad_set_count: 1, spend_in_period: 5, mapping_status: "mapped_event_not_observed_in_synced_window" }]),
  });
  assert.equal(verdict.status, "restricted");
  assert.ok(verdict.reason_codes.includes("promoted_event_not_observed_or_unresolved"));
  assert.ok(verdict.reason_codes.includes("fresh_rejected_ads_present"));
});

test("A24 treats failed or stale required sources as unknown, never as healthy", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: { available: false, rows: [] },
    issues: source(),
    eventMapping: source([{ eligible_ad_set_count: 1, spend_in_period: 5, mapping_status: "mapped_event_observed" }]),
  });
  assert.equal(verdict.status, "unknown");
  assert.deepEqual(unknownMetaMeasurementVerdict().status, "unknown");
});

test("A24 does not call a no-spend period healthy", () => {
  const verdict = buildMetaMeasurementVerdict({
    pixels: source([{ is_unavailable: false }]),
    learning: source([{ activity_sync_state: "fresh" }]),
    issues: source(),
    eventMapping: source(),
  });
  assert.equal(verdict.status, "not_assessable");
  assert.ok(verdict.reason_codes.includes("no_eligible_spend_observed"));
});
