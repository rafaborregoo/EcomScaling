/**
 * El limite de rondas de herramientas ya no tira el run: la ultima ronda avisa
 * al modelo y le pide la respuesta final sin herramientas. Regresion de a04,
 * que moria en la mitad de sus ejecuciones (`agent_tool_loop_limit_exceeded`)
 * despues de 9 consultas correctas, sin producir ninguna tarea.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import {
  agentOutputJsonSchema,
  buildLeanOutputContract,
  checkOutputSanity,
  isBudgetNearlyExhausted,
  runAgentTurn,
} from "./index.js";

test("agota el presupuesto de tools y aun asi devuelve output", async () => {
  const answer = {
    answer: "Sin margen para mas consultas.",
    findings: [],
    recommendations: [],
    sources: [],
    proposed_writes: [],
    approval_required: false,
    confidence: "low",
    warnings: ["presupuesto de herramientas agotado"],
  };

  let calls = 0;
  const seenTools: boolean[] = [];
  const original = Anthropic.Messages.prototype.create;
  Anthropic.Messages.prototype.create = async function (body: {
    tools?: unknown;
  }) {
    calls += 1;
    seenTools.push(Array.isArray(body.tools) && body.tools.length > 0);
    // El modelo pide herramientas indefinidamente; solo para si se las quitan.
    const wantsTool = Array.isArray(body.tools) && body.tools.length > 0;
    return {
      stop_reason: wantsTool ? "tool_use" : "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
      content: wantsTool
        ? [{ type: "tool_use", id: `t${calls}`, name: "ping", input: {} }]
        : [{ type: "text", text: JSON.stringify(answer) }],
    };
  } as never;

  try {
    const result = await runAgentTurn({
      apiKey: "test",
      model: "claude-sonnet-5",
      systemPrompt: "test",
      input: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_code: "a04_generador_tareas",
        agent_version: "v7",
        organization_id: "00000000-0000-0000-0000-000000000000",
        actor_user_id: "22222222-2222-4222-8222-222222222222",
        trigger_type: "cron",
        objective: "probar el corte de presupuesto",
        allowed_tools: ["ping"],
        approval_mode: "required_before_write",
      },
      contextBlocks: [],
      tools: [
        {
          name: "ping",
          description: "devuelve ok",
          inputSchema: { type: "object", properties: {} },
          execute: async () => ({ ok: true }),
        },
      ],
    });

    assert.equal(result.output.answer, "Sin margen para mas consultas.");
    // La ultima request va sin herramientas: por eso el modelo puede terminar.
    assert.equal(seenTools[seenTools.length - 1], false);
    assert.ok(calls <= 16, `demasiadas llamadas al modelo: ${calls}`);
  } finally {
    Anthropic.Messages.prototype.create = original;
  }
});

test("el aviso salta antes de reventar el presupuesto, no despues", () => {
  const budget = { maxCostUsd: 2, maxToolCalls: 24 };
  // Con margen: se sigue investigando.
  assert.equal(isBudgetNearlyExhausted(budget, 0.4, 5), false);
  // Al 80% del coste: ultima ronda.
  assert.equal(isBudgetNearlyExhausted(budget, 1.6, 5), true);
  // A dos tool calls del tope: ultima ronda.
  assert.equal(isBudgetNearlyExhausted(budget, 0.1, 22), true);
  // Sin presupuesto declarado no hay corte anticipado.
  assert.equal(isBudgetNearlyExhausted(undefined, 999, 999), false);
});

test("el contrato recortado no pide lo que la UI no pinta, pero conserva la forma", () => {
  const contract = buildLeanOutputContract([
    "answer",
    "findings",
    "recommendations",
  ]);
  const schema = contract.jsonSchema as {
    required: string[];
    properties: Record<string, unknown>;
  };

  // Al modelo se le dejan de pedir: eso es lo que ahorra tokens de salida.
  for (const field of ["answer", "findings", "recommendations"]) {
    assert.equal(schema.required.includes(field), false);
    assert.equal(field in schema.properties, false);
  }
  assert.ok(schema.required.includes("proposed_writes"));

  // Pero agent_outputs sigue viendo la forma completa de siempre.
  const parsed = contract.schema.parse({
    sources: [],
    proposed_writes: [],
    approval_required: false,
    confidence: "low",
    warnings: [],
  });
  assert.deepEqual(parsed.findings, []);
  assert.deepEqual(parsed.recommendations, []);
  // answer no puede quedar vacio: checkOutputSanity lo rechazaria.
  assert.ok(parsed.answer.trim().length > 0);
  assert.equal(checkOutputSanity(parsed).ok, true);

  // El contrato por defecto no se toca.
  assert.ok(
    (agentOutputJsonSchema as unknown as { required: string[] }).required.includes(
      "answer",
    ),
  );
});
