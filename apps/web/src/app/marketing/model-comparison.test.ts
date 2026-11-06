import test from "node:test";
import assert from "node:assert/strict";
import { comparisonCaseRows, comparisonPrice, type LabManifestRow } from "./model-comparison";
test("compara solo el mismo canal y método y mantiene visible una ejecución fallida", () => {
  const common = { model_id: "model", model_label: "Modelo", error: null, price: null, duration_ms: null, model_verified: false, draft_id: null };
  const rows: LabManifestRow[] = [{ ...common, case_id: "email-original", channel: "email", mode: "original", status: "failed" }, { ...common, case_id: "email-guided", channel: "email", mode: "guided", status: "completed" }];
  assert.deepEqual(comparisonCaseRows(rows, "email", "original"), [rows[0]]);
  assert.equal(comparisonPrice(null), "No disponible");
  assert.equal(comparisonPrice({ low: NaN, high: 0 }), "No disponible");
  assert.ok(comparisonPrice({ low: 0.001, high: 0.002 }).includes("–"));
});
