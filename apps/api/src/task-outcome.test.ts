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
    metric_name: "Conversión de landing",
    before_value: 1.8,
    after_value: 2.1,
    unit: "%",
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
