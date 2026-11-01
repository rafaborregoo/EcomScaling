import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildA23CreativeOutputContract,
  runAgentTurn,
} from "./index.js";

test("A23 recorre tools y valida su output con proveedor simulado y sin API key", async () => {
  const output = {
    sources: [],
    proposed_writes: [],
    approval_required: false,
    confidence: "low",
    warnings: ["fixture: el gasto no permite atribuir una compra"],
    creative_decisions: [{
      decision_ref: "a23-1",
      action: "observe",
      store_id: null,
      account_id: null,
      ad_id: null,
      creative_id: null,
      signal: "La muestra no permite atribuir el resultado a esta creatividad.",
      window: "2026-09-01 a 2026-09-28",
      spend_implicated: null,
      spend_currency: null,
      uncertainty: "No hay suficiente evidencia de compras atribuibles.",
      hypothesis: "Confirmar medición antes de proponer cambios de presupuesto.",
      success_criterion: "Disponer de una ventana madura y una fuente de compras fiable.",
      primary_metric: "Compras atribuidas",
      metric_denominator: "Creatividad observada durante la ventana",
      comparator: "Sin comparador fiable disponible",
      evaluation_window_days: 28,
      maturity_days: null,
      measurement_verdict: "unknown",
    }],
  };
  const responses = [
    {
      stop_reason: "tool_use",
      usage: { input_tokens: 11, output_tokens: 4 },
      content: [{ type: "tool_use", id: "fixture-call-1", name: "read_fixture", input: { key: "measurement" } }],
    },
    {
      stop_reason: "end_turn",
      usage: { input_tokens: 19, output_tokens: 31 },
      content: [{ type: "text", text: JSON.stringify(output) }],
    },
  ];
  const requests: unknown[] = [];
  const fakeClient = {
    messages: {
      create: async (request: unknown) => {
        requests.push(request);
        const response = responses.shift();
        assert.ok(response, "el agente no debe pedir más de dos respuestas al proveedor");
        return response;
      },
    },
  } as unknown as Pick<Anthropic, "messages">;

  const result = await runAgentTurn({
    client: fakeClient,
    model: "claude-sonnet-test-fixture",
    systemPrompt: "Analiza creatividades con evidencia y no atribuyas causalidad.",
    input: {
      run_id: "11111111-1111-4111-8111-111111111111",
      agent_code: "a23_creatividad_meta",
      agent_version: "v9",
      organization_id: "00000000-0000-0000-0000-000000000000",
      actor_user_id: "22222222-2222-4222-8222-222222222222",
      trigger_type: "manual",
      objective: "Decidir qué hacer con una creatividad de Meta sin exagerar la evidencia.",
      allowed_tools: ["read_fixture"],
      approval_mode: "required_before_write",
    },
    contextBlocks: [{
      label: "Veredicto determinista A24 sobre fiabilidad de medición",
      data: { status: "unknown", source: "fixture" },
    }],
    tools: [{
      name: "read_fixture",
      description: "Devuelve una lectura sintética de medición.",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
        additionalProperties: false,
      },
      execute: async ({ key }) => ({ key, observed: "unknown" }),
    }],
    outputContract: buildA23CreativeOutputContract("unknown"),
  });

  assert.equal(result.provider, "anthropic");
  assert.equal(result.modelCalls, 2);
  assert.equal(result.toolCallCount, 1);
  assert.equal(result.inputTokens, 30);
  assert.equal(result.outputTokens, 35);
  assert.deepEqual(result.output.creative_decisions, output.creative_decisions);
  assert.equal(requests.length, 2);
  assert.match(JSON.stringify(requests[0]), /Decidir qué hacer con una creatividad de Meta/);
  assert.match(JSON.stringify(requests[0]), /Veredicto determinista A24/);
  assert.match(JSON.stringify(requests[1]), /observed/);
  assert.match(JSON.stringify(requests[0]), /creative_decisions/);
});
