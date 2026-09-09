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
  estimateCostUsd,
  evaluateAgentBudget,
  PRICING_VERSION,
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

// ---------------------------------------------------------------------------
// AI-30: fidelidad del registro de una ejecucion.
// ---------------------------------------------------------------------------

/**
 * Ejecuta un turno de una sola vuelta contra un Anthropic simulado y devuelve
 * el resultado. `usage` es lo que el proveedor "reporta": el punto de estos
 * tests es que lo que NO reporta no se convierta en 0.
 */
async function runOneShotTurn(options: {
  model: string;
  usage: Record<string, number>;
}) {
  const answer = {
    answer: "Respuesta valida.",
    findings: [],
    recommendations: [],
    sources: [],
    proposed_writes: [],
    approval_required: false,
    confidence: "low",
    warnings: [],
  };

  const original = Anthropic.Messages.prototype.create;
  Anthropic.Messages.prototype.create = async function () {
    return {
      stop_reason: "end_turn",
      usage: options.usage,
      content: [{ type: "text", text: JSON.stringify(answer) }],
    };
  } as never;

  try {
    return await runAgentTurn({
      apiKey: "test",
      model: options.model,
      systemPrompt: "test",
      input: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_code: "a02_monitor_negocio",
        agent_version: "v1",
        organization_id: "00000000-0000-0000-0000-000000000000",
        actor_user_id: "22222222-2222-4222-8222-222222222222",
        trigger_type: "manual",
        objective: "probar el registro de uso",
        allowed_tools: [],
        approval_mode: "required_before_write",
      },
      contextBlocks: [],
    });
  } finally {
    Anthropic.Messages.prototype.create = original;
  }
}

test("el turno declara que proveedor y modelo atendieron de verdad", async () => {
  const result = await runOneShotTurn({
    model: "claude-sonnet-5",
    usage: { input_tokens: 1000, output_tokens: 100 },
  });

  // Este es el dato que antes solo quedaba como prosa dentro de un paso, y que
  // el panel sustituia por agent_versions.model -- el CONFIGURADO, no el usado.
  assert.equal(result.provider, "anthropic");
  assert.equal(result.model, "claude-sonnet-5");
  assert.equal(result.stopReason, "end_turn");
});

test("lo que el proveedor no reporta queda como null, nunca como 0", async () => {
  // El proveedor no manda ningun campo de cache en este turno.
  const result = await runOneShotTurn({
    model: "claude-sonnet-5",
    usage: { input_tokens: 1000, output_tokens: 100 },
  });

  assert.equal(
    result.cacheReadTokens,
    null,
    "sin dato del proveedor, cacheReadTokens debe ser null: 0 significaria 'hubo cero hits', que es otra cosa",
  );
  assert.equal(result.cacheCreationTokens, null);
  assert.equal(result.reasoningTokens, null);
});

test("lo que el proveedor si reporta se acumula como numero, incluido el cero", async () => {
  const result = await runOneShotTurn({
    model: "claude-sonnet-5",
    usage: {
      input_tokens: 1000,
      output_tokens: 100,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 512,
    },
  });

  // 0 reportado es un hecho distinto de null: el proveedor dijo "cero hits".
  assert.equal(result.cacheReadTokens, 0);
  assert.equal(result.cacheCreationTokens, 512);
});

test("un modelo sin tarifa deja el coste en null y lo marca como incidente", async () => {
  const result = await runOneShotTurn({
    model: "modelo-sin-tarifa",
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
  });

  // Antes esto valia 0: una ejecucion cara pasaba por gratis, los topes de
  // presupuesto no mordian y el panel de costes facturaba de menos.
  assert.equal(result.estimatedCostUsd, null);
  assert.equal(result.costBasis, "unknown_model");
});

test("un modelo tarifado registra coste y la version de precios aplicada", async () => {
  const result = await runOneShotTurn({
    model: "claude-sonnet-5",
    usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
  });

  // claude-sonnet-5: $3/1M entrada + $15/1M salida.
  assert.equal(result.estimatedCostUsd, 18);
  assert.equal(result.costBasis, "priced");
  assert.equal(result.pricingVersion, PRICING_VERSION);
});

test("sin precio conocido el tope en dolares no puede cortar, pero el de tools si", async () => {
  // Con coste null, evaluar "0 > maxCostUsd" seria falso y dejaria el turno sin
  // freno alguno. El presupuesto de tool calls sigue siendo cierto y aplicable.
  const budget = { maxCostUsd: 0.01, maxToolCalls: 2 };
  assert.equal(estimateCostUsd("modelo-sin-tarifa", 1_000_000, 1_000_000), null);
  assert.equal(evaluateAgentBudget(budget, 0, 3).exceeded, true);
  assert.equal(evaluateAgentBudget(budget, 0, 1).exceeded, false);
});
