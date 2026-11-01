import assert from "node:assert/strict";
import test from "node:test";
import { parseTaskOutcomeInput } from "./task-outcome.js";

test("allows completing a task without claiming measured impact", () => {
  assert.deepEqual(parseTaskOutcomeInput(undefined), { ok: true, data: null });
  assert.deepEqual(parseTaskOutcomeInput({ metric_name: "", after_value: "" }), { ok: true, data: null });
});

test("normalizes a bounded, dated outcome observation", () => {
  const result = parseTaskOutcomeInput({
    metric_name: "Conversión de landing",
    before_value: 1.8,
    after_value: 2.1,
    unit: "%",
    summary: "Medido una semana después de publicar el cambio.",
    measured_at: "2026-09-28",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, {
    metric_id: null,
    metric_name: "Conversión de landing",
    before_value: 1.8,
    after_value: 2.1,
    unit: "%",
    currency_code: null,
    source_system: null,
    measurement_period_start: null,
    measurement_period_end: null,
    summary: "Medido una semana después de publicar el cambio.",
    measured_at: "2026-09-28",
  });
});

test("rejects non-finite values, invalid dates, missing values and unexpected fields", () => {
  assert.equal(parseTaskOutcomeInput({ metric_name: "ROAS", after_value: Number.NaN, measured_at: "2026-09-28" }).ok, false);
  assert.equal(parseTaskOutcomeInput({ metric_name: "ROAS", after_value: 2, measured_at: "2026-02-30" }).ok, false);
  assert.equal(parseTaskOutcomeInput({ metric_name: "ROAS", after_value: 2, measured_at: "2099-01-01" }).ok, false);
  assert.equal(parseTaskOutcomeInput({ metric_name: "ROAS", measured_at: "2026-09-28" }).ok, false);
  assert.equal(parseTaskOutcomeInput({ metric_name: "ROAS", after_value: 2, measured_at: "2026-09-28", task_id: "other" }).ok, false);
});

test("links canonical metrics to a sourced measurement window", () => {
  const result = parseTaskOutcomeInput({
    metric_name: "freeform label is replaced",
    metric_id: "conversion",
    before_value: 0.028,
    after_value: 0.032,
    source_system: "shopify",
    measurement_period_start: "2026-09-01",
    measurement_period_end: "2026-09-30",
    measured_at: "2026-10-01",
  });
  assert.equal(result.ok, true);
  if (!result.ok || !result.data) return;
  assert.equal(result.data.metric_name, "Conversión");
  assert.equal(result.data.metric_id, "conversion");
  assert.equal(result.data.unit, "%");
  assert.equal(result.data.measurement_period_start, "2026-09-01");
  assert.equal(result.data.source_system, "shopify");
});

test("requires measurement period and ISO currency for canonical monetary metrics", () => {
  assert.equal(parseTaskOutcomeInput({ metric_name: "CAC", metric_id: "cac_new", after_value: 20, source_system: "manual", measured_at: "2026-09-28" }).ok, false);
  assert.equal(parseTaskOutcomeInput({ metric_name: "CAC", metric_id: "cac_new", after_value: 20, currency_code: "EUR", source_system: "manual", measurement_period_start: "2026-09-10", measurement_period_end: "2026-09-01", measured_at: "2026-09-28" }).ok, false);
  assert.equal(parseTaskOutcomeInput({ metric_name: "CAC", metric_id: "cac_new", after_value: 20, currency_code: "EUR", source_system: "manual", measurement_period_start: "2026-09-01", measurement_period_end: "2026-09-20", measured_at: "2026-09-28" }).ok, true);
});
