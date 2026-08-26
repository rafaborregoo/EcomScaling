import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveAgentOrchestrationMode,
  runOperationThroughLangGraph,
  runReadOnlyDiagnosticGraph,
  type ReadOnlyDiagnosticGraphDependencies,
} from "./agent-orchestration.js";

test("el piloto LangGraph ejecuta retrieval, síntesis y validación en orden", async () => {
  const calls: string[] = [];
  const dependencies: ReadOnlyDiagnosticGraphDependencies = {
    async retrieve(input) {
      calls.push(`retrieve:${input}`);
      return ["contexto Shopify preparado"];
    },
    async synthesize(input, context) {
      calls.push(`synthesize:${input}:${context.length}`);
      return "borrador no mutante";
    },
    validate(output) {
      calls.push(`validate:${output}`);
      return `validado:${output}`;
    },
  };

  const result = await runReadOnlyDiagnosticGraph(dependencies, "¿qué falta?");

  assert.equal(result.output, "validado:borrador no mutante");
  assert.equal(result.status, "completed");
  assert.deepEqual(calls, [
    "retrieve:¿qué falta?",
    "synthesize:¿qué falta?:1",
    "validate:borrador no mutante",
  ]);
});

test("el modo LangGraph es opt-in y ejecuta el turno protegido sin cambiar su resultado", async () => {
  assert.equal(resolveAgentOrchestrationMode(undefined), "direct");
  assert.equal(resolveAgentOrchestrationMode("unknown"), "direct");
  assert.equal(resolveAgentOrchestrationMode("langgraph"), "langgraph");
  assert.deepEqual(
    await runOperationThroughLangGraph(async () => ({ answer: "ok" })),
    { answer: "ok" },
  );
});
