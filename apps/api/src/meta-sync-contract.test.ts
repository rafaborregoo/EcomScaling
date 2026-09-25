import assert from "node:assert/strict";
import test from "node:test";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  isMetaInsightsReportComplete,
  resolveMetaActionReportTime,
  resolveMetaInsightsMode,
} from "./meta-sync.js";

const baseEnv = {
  META_INSIGHTS_MODE: undefined,
} as unknown as LoadedApiEnv;

test("Meta Insights mantiene sync por defecto para no cambiar el piloto actual", () => {
  assert.equal(resolveMetaInsightsMode(baseEnv), "sync");
  assert.equal(
    resolveMetaInsightsMode({ ...baseEnv, META_INSIGHTS_MODE: "async" }),
    "async",
  );
});

test("el contrato reconoce estados de reporte completado de Meta", () => {
  assert.equal(isMetaInsightsReportComplete("Job Completed"), true);
  assert.equal(isMetaInsightsReportComplete("completed"), true);
  assert.equal(isMetaInsightsReportComplete("Job Running"), false);
  assert.equal(isMetaInsightsReportComplete(undefined), false);
});

test("Meta action_report_time es opcional y solo acepta valores configurados", () => {
  assert.equal(resolveMetaActionReportTime(baseEnv), undefined);
  assert.equal(
    resolveMetaActionReportTime({
      ...baseEnv,
      META_ACTION_REPORT_TIME: "conversion",
    }),
    "conversion",
  );
});
