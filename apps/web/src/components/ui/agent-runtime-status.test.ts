import assert from "node:assert/strict";
import { test } from "node:test";
import { getAgentRuntimeStatusPresentation } from "./agent-runtime-status.js";

test("presenta el runtime directo sin insinuar tracing activo", () => {
  assert.deepEqual(
    getAgentRuntimeStatusPresentation({
      orchestrationMode: "direct",
      langsmithTracing: false,
    }),
    {
      modeLabel: "Runtime directo",
      modeTone: "neutral",
      tracingLabel: "LangSmith · apagado",
      tracingTone: "neutral",
    },
  );
});

test("presenta LangGraph piloto y LangSmith activo de forma explícita", () => {
  const result = getAgentRuntimeStatusPresentation({
    orchestrationMode: "langgraph",
    langsmithTracing: true,
  });
  assert.equal(result.modeLabel, "LangGraph · piloto");
  assert.equal(result.tracingLabel, "LangSmith · tracing activo");
});
