import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildA23CreativeOutputContract,
  runAgentTurn,
} from "./index.js";

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

test("A23 recorre tools y valida su output con proveedor simulado y sin API key", async () => {
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

test("con un esquema demasiado grande reintenta con el esquema en el prompt, en streaming y con esfuerzo", async () => {
  const responses = [
    new Anthropic.BadRequestError(400, { message: "The compiled grammar is too large, which would cause performance issues." }, undefined, new Headers()),
    { stop_reason: "pause_turn", usage: { input_tokens: 5, output_tokens: 1 }, content: [{ type: "text", text: "Buscando" }] },
    { stop_reason: "end_turn", usage: { input_tokens: 7, output_tokens: 3 }, content: [{ type: "text", text: `\`\`\`json\n${JSON.stringify(output)}\n\`\`\`` }] },
  ];
  const requests: Array<Record<string, any>> = [];
  const fakeClient = {
    messages: {
      create: async () => assert.fail("con un tope alto la llamada debe ir en streaming"),
      stream: (request: Record<string, any>) => {
        requests.push(request);
        const response = responses.shift();
        const stream = {
          on: () => stream,
          finalMessage: async () => {
            if (response instanceof Error) throw response;
            return response;
          },
        };
        return stream;
      },
    },
  } as unknown as Pick<Anthropic, "messages">;

  const result = await runAgentTurn({
    client: fakeClient,
    model: "claude-opus-5-5",
    systemPrompt: "Prepara el Camino.",
    input: {
      run_id: "11111111-1111-4111-8111-111111111111",
      agent_code: "a23_creatividad_meta",
      agent_version: "v9",
      organization_id: "00000000-0000-0000-0000-000000000000",
      actor_user_id: "22222222-2222-4222-8222-222222222222",
      trigger_type: "manual",
      objective: "Prueba del contrato grande.",
      allowed_tools: [],
      approval_mode: "required_before_write",
    },
    contextBlocks: [],
    outputContract: buildA23CreativeOutputContract("unknown"),
    reasoningEffort: "high",
    maxCompletionTokens: 100_000,
    resilience: { maxRetries: 0 },
  });

  assert.deepEqual(result.output.creative_decisions, output.creative_decisions);
  assert.equal(requests.length, 3);
  assert.equal(requests[0]!.max_tokens, 100_000);
  assert.equal(requests[0]!.output_config.effort, "high");
  assert.ok(requests[0]!.output_config.format);
  assert.deepEqual(requests[1]!.output_config, { effort: "high" });
  assert.match(JSON.stringify(requests[1]!.system), /JSON Schema/);
  assert.equal(requests[2]!.messages.at(-1).role, "assistant");
});
