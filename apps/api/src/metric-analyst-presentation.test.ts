import assert from "node:assert/strict";
import test from "node:test";
import type { MetricAnalysis } from "@e-nora/contracts";
import { metricAnalystPresentation } from "./metric-analyst-presentation.js";

test("A29 presentation keeps the rule verdict, exact period and each source currency", () => {
  const analysis = {
    metric: "meta_roas", label: "ROAS atribuido por Meta", definition: "", formula: "", attributed_by: "meta",
    owner_agents: [], verdict: "bad", confidence: "medium", value: 1.4, previous: 2, change_pct: -30,
    reasons: [{ source: "trend", verdict: "bad", text: "Baja un 30 % frente al periodo anterior." }],
    drivers: [{ id: "aov", label: "Ticket atribuido", value: 45, previous: 60, change_pct: -25, effect: "hurts", currency_code: "USD" }],
    main_driver: "aov", currency_code: null,
    measurement_period: { start: "2026-10-01T00:00:00.000Z", end: "2026-10-23T00:00:00.000Z" },
  } as unknown as MetricAnalysis;
  const output = metricAnalystPresentation(analysis);
  assert.equal(output.answer, "ROAS atribuido por Meta: requiere atenci\u00f3n.");
  assert.equal(output.findings[0]?.area, "meta_roas");
  assert.equal(output.findings[1]?.figures?.[0]?.value, "45,00 USD");
  assert.equal(output.sources?.[0]?.period, "2026-10-01T00:00:00.000Z \u2013 2026-10-23T00:00:00.000Z");
  assert.ok(output.warnings?.some((warning) => warning.includes("no demuestra ventas incrementales")));
});
