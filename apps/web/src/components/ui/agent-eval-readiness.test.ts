import assert from "node:assert/strict";
import { test } from "node:test";
import { getAgentEvalReadinessPresentation } from "./agent-eval-readiness.js";

test("distingue matriz offline preparada de eval live verificada", () => {
  assert.deepEqual(
    getAgentEvalReadinessPresentation({
      coveredAgents: 10,
      totalAgents: 10,
      offlineRunRecorded: false,
      liveVerified: false,
    }),
    {
      offlineLabel: "Matriz offline preparada",
      offlineTone: "brand",
      liveLabel: "Evals live pendientes",
      liveTone: "warn",
      coverageLabel: "10/10 agentes cubiertos",
    },
  );
});

test("no permite que la cobertura visual supere el total", () => {
  assert.equal(
    getAgentEvalReadinessPresentation({
      coveredAgents: 20,
      totalAgents: 10,
      offlineRunRecorded: true,
      liveVerified: true,
    }).coverageLabel,
    "10/10 agentes cubiertos",
  );
});
