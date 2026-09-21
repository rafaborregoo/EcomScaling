import { test } from "node:test";
import assert from "node:assert/strict";
import { f8ExecutionPlanAssessmentsFromRows } from "./ai-playbook-insights-api.js";
test("F8.03 publica en InsightsMenu solo planes que requieren atención", () => { const rows = [{ plan_status: "READY_WITH_APPROVAL", blockers: [], unresolved_unknowns: [], evaluated_at: "2026-09-20T00:00:00.000Z" }, { plan_status: "READY", blockers: [], unresolved_unknowns: [] }]; const result = f8ExecutionPlanAssessmentsFromRows(rows); assert.equal(result.length, 1); assert.equal(result[0]?.domain, "F8_03_EXECUTION_PLAN"); });
