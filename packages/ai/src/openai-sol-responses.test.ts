import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  runAgentTurnOpenAI,
  estimateCostUsd,
  getModelCapabilities,
} from "./index.js";

const input = {
  run_id: "11111111-1111-4111-8111-111111111111",
  agent_code: "a01_analista_llamadas",
  agent_version: "v7",
  organization_id: "22222222-2222-4222-8222-222222222222",
  actor_user_id: "33333333-3333-4333-8333-333333333333",
  trigger_type: "call" as const,
  objective: "Extraer el resumen y acuerdos",
  allowed_tools: ["search_knowledge"],
  approval_mode: "required_before_publish" as const,
};
const outputContract = {
  schema: z.object({ summary: z.string() }),
  jsonSchema: {
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
    additionalProperties: false,
  },
};
const params = {
  apiKey: "test-key",
  model: "gpt-6.1-sol",
  systemPrompt: "Resume con evidencia.",
  input,
  outputContract,
  contextBlocks: [
    {
      label: "Transcripción",
      data: "texto ".repeat(7000) + "ACUERDO_FINAL_CONSERVADO",
    },
  ],
  contextLimits: { maxBlockChars: 600000, maxContextChars: 800000 },
  resilience: { timeoutMs: 10000, maxRetries: 0 },
};
const message = {
  type: "message",
  id: "msg_1",
  status: "completed",
  role: "assistant",
  content: [
    {
      type: "output_text",
      text: '{"summary":"Resumen verificado"}',
      annotations: [],
    },
  ],
};

test("Terra usa Responses con el ID solicitado y su tarifa propia", async () => {
  const original = globalThis.fetch;
  let requestedModel: unknown;
  globalThis.fetch = (async (url, init) => {
    assert.match(String(url), /\/v1\/responses$/);
    requestedModel = (JSON.parse(String(init?.body)) as { model: string }).model;
    return new Response(JSON.stringify({ ...response([message], 0, 200, 30), model: "gpt-6.1-terra" }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await runAgentTurnOpenAI({ ...params, model: "gpt-6.1-terra" });
    assert.equal(requestedModel, "gpt-6.1-terra");
    assert.equal(result.model, "gpt-6.1-terra");
    assert.equal(estimateCostUsd("gpt-6.1-terra", 300000, 1000, 100000), 0.4175);
  } finally { globalThis.fetch = original; }
});
function response(
  output: unknown[],
  cached: number,
  outputTokens: number,
  reasoning: number,
) {
  return {
    id: "resp_" + outputTokens,
    object: "response",
    created_at: 1793180000,
    model: "gpt-6.1-sol",
    status: "completed",
    error: null,
    incomplete_details: null,
    output,
    output_text: output.some(
      (item) => (item as { type: string }).type === "message",
    )
      ? '{"summary":"Resumen verificado"}'
      : "",
    usage: {
      input_tokens: 200000,
      output_tokens: outputTokens,
      total_tokens: 200000 + outputTokens,
      input_tokens_details: { cached_tokens: cached },
      output_tokens_details: { reasoning_tokens: reasoning },
    },
  };
}

test("Sol llama a Responses, conserva transcripción y razonamiento y continúa herramientas sin estado remoto", async () => {
  const original = globalThis.fetch;
  const requests: Array<Record<string, unknown>> = [];
  let executed = 0;
  globalThis.fetch = (async (url, init) => {
    assert.match(String(url), /\/v1\/responses$/);
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const output =
      requests.length === 1
        ? [
            {
              type: "reasoning",
              id: "rs_1",
              summary: [],
              encrypted_content: "opaque-reasoning",
            },
            {
              type: "function_call",
              id: "fc_1",
              call_id: "call_1",
              name: "search_knowledge",
              arguments: '{"query":"metodología"}',
              status: "completed",
            },
          ]
        : [message];
    return new Response(
      JSON.stringify(
        response(
          output,
          requests.length === 1 ? 10000 : 100000,
          requests.length === 1 ? 100 : 200,
          requests.length === 1 ? 20 : 30,
        ),
      ),
      { headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    const result = await runAgentTurnOpenAI({
      ...params,
      reasoningEffort: "none",
      budget: { maxCostUsd: 1, maxToolCalls: 4 },
      tools: [
        {
          name: "search_knowledge",
          description: "Consulta lectura",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
          },
          execute: async () => {
            executed++;
            return { found: true };
          },
        },
      ],
    });
    assert.equal(result.output.summary, "Resumen verificado");
    assert.equal(executed, 1);
    assert.equal(result.modelCalls, 2);
    assert.equal(result.reasoningTokens, 50);
    assert.equal(result.cacheReadTokens, 110000);
    assert.equal(result.estimatedCostUsd, 0.594);
    assert.equal(result.model, "gpt-6.1-sol");
    assert.equal(requests[0]!.store, false);
    assert.deepEqual(requests[0]!.reasoning, { effort: "medium" });
    assert.ok(
      JSON.stringify(requests[0]!.input).includes("ACUERDO_FINAL_CONSERVADO"),
    );
    const history = requests[1]!.input as Array<{
      type?: string;
      call_id?: string;
      encrypted_content?: string;
      output?: string;
    }>;
    assert.ok(
      history.some(
        (item) =>
          item.type === "reasoning" &&
          item.encrypted_content === "opaque-reasoning",
      ),
    );
    assert.ok(
      history.some(
        (item) =>
          item.type === "function_call_output" &&
          item.call_id === "call_1" &&
          item.output?.includes("found"),
      ),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("A01 rechaza contexto recortado antes de llamar al proveedor", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("unexpected_api_call");
  }) as typeof fetch;
  try {
    await assert.rejects(
      runAgentTurnOpenAI({
        ...params,
        contextLimits: { maxBlockChars: 100, maxContextChars: 100 },
      }),
      /a01_transcript_context_truncated/,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("Sol informa truncamiento de salida sin aceptar un JSON parcial", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ...response([], 0, 100, 20),
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      }),
      { headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    await assert.rejects(
      runAgentTurnOpenAI(params),
      /agent_output_truncated_max_tokens/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("Sol tiene tarifa exacta, caché y tramo de contexto largo sin sumar umbrales entre llamadas", () => {
  assert.equal(
    getModelCapabilities("gpt-6.1-sol", "openai").contextWindowMax,
    1050000,
  );
  assert.equal(estimateCostUsd("gpt-6.1-sol", 300000, 1000, 100000), 0.835);
});

test("Sol recompone streaming de reuniones largas y emite texto sin perder la salida JSON", async () => {
  const original = globalThis.fetch;
  const final = response([message], 0, 200, 30);
  let delta = "";
  globalThis.fetch = (async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.stream, true);
    const events = [
      {
        type: "response.created",
        response: { ...final, status: "in_progress", output: [] },
      },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { ...message, status: "in_progress", content: [] },
      },
      {
        type: "response.content_part.added",
        output_index: 0,
        content_index: 0,
        part: { type: "output_text", text: "", annotations: [] },
      },
      {
        type: "response.output_text.delta",
        output_index: 0,
        content_index: 0,
        delta: '{"summary":"Resumen verificado"}',
      },
      { type: "response.completed", response: final },
    ];
    const data = events
      .map(
        (event, index) =>
          "event: " +
          event.type +
          "\ndata: " +
          JSON.stringify({ ...event, sequence_number: index }) +
          "\n\n",
      )
      .join("");
    return new Response(data, {
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;
  try {
    const result = await runAgentTurnOpenAI({
      ...params,
      resilience: { timeoutMs: 300000, maxRetries: 0 },
      onTextDelta: (text) => {
        delta += text;
      },
    });
    assert.equal(result.output.summary, "Resumen verificado");
    assert.equal(delta, '{"summary":"Resumen verificado"}');
    assert.equal(result.reasoningTokens, 30);
  } finally {
    globalThis.fetch = original;
  }
});

test("Sol aplica el límite de herramientas antes de ejecutar una ronda que no cabe", async () => {
  const original = globalThis.fetch;
  let executed = 0;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify(
        response(
          [
            {
              type: "function_call",
              id: "fc_1",
              call_id: "call_1",
              name: "search_knowledge",
              arguments: "{}",
            },
            {
              type: "function_call",
              id: "fc_2",
              call_id: "call_2",
              name: "search_knowledge",
              arguments: "{}",
            },
          ],
          0,
          100,
          20,
        ),
      ),
      { headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    await assert.rejects(
      runAgentTurnOpenAI({
        ...params,
        budget: { maxToolCalls: 1 },
        tools: [
          {
            name: "search_knowledge",
            description: "Lectura",
            inputSchema: { type: "object" },
            execute: async () => {
              executed++;
              return {};
            },
          },
        ],
      }),
      /tool/i,
    );
    assert.equal(executed, 0);
  } finally {
    globalThis.fetch = original;
  }
});
