// AI-00: contratos y runtime base de agentes EcomScaling.
// Principios no negociables (documento maestro v0.2):
// - organization_id lo resuelve el backend; el modelo nunca elige tenant.
// - Toda salida se valida contra schema antes de persistirse.
// - Las escrituras propuestas (proposed_writes) no se ejecutan: quedan
//   pendientes de aprobacion humana segun approval_mode.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Contrato comun de entrada (seccion 3.2 del documento maestro)
// ---------------------------------------------------------------------------

export const agentInputSchema = z.object({
  run_id: z.string().uuid(),
  agent_code: z.string().min(1),
  agent_version: z.string().min(1),
  organization_id: z.string().uuid(),
  actor_user_id: z.string().uuid(),
  trigger_type: z.enum(["chat", "call", "cron", "alert", "webhook", "manual"]),
  objective: z.string().min(1),
  time_range: z
    .object({ start: z.string(), end: z.string() })
    .nullable()
    .optional(),
  entity_ids: z.array(z.string()).nullable().optional(),
  allowed_tools: z.array(z.string()),
  approval_mode: z.enum(["none", "required_before_write", "required_before_publish"]),
});

export type AgentInput = z.infer<typeof agentInputSchema>;

// ---------------------------------------------------------------------------
// Contrato comun de salida (seccion 3.3)
// ---------------------------------------------------------------------------

export const agentFindingSchema = z.object({
  title: z.string(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  evidence: z.string(),
});

export const agentRecommendationSchema = z.object({
  action: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  expected_impact: z.string(),
  owner: z.enum(["cliente", "consultor"]),
});

export const agentSourceSchema = z.object({
  kind: z.enum(["metric", "table", "tool", "document"]),
  reference: z.string(),
  period: z.string().nullable(),
});

export const agentProposedWriteSchema = z.object({
  kind: z.enum(["task", "note"]),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export const agentOutputSchema = z.object({
  answer: z.string(),
  findings: z.array(agentFindingSchema),
  recommendations: z.array(agentRecommendationSchema),
  sources: z.array(agentSourceSchema),
  proposed_writes: z.array(agentProposedWriteSchema),
  approval_required: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string()),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

export const AGENT_OUTPUT_SCHEMA_VERSION = "v1";

// JSON Schema equivalente para structured outputs de la API (sin restricciones
// no soportadas; additionalProperties: false en todos los objetos).
const severityEnum = ["info", "low", "medium", "high", "critical"];
const priorityEnum = ["low", "medium", "high", "urgent"];

export const agentOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "answer",
    "findings",
    "recommendations",
    "sources",
    "proposed_writes",
    "approval_required",
    "confidence",
    "warnings",
  ],
  properties: {
    answer: { type: "string", description: "Explicacion autosuficiente para el usuario, en espanol." },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "severity", "evidence"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: severityEnum },
          evidence: { type: "string", description: "Cifra concreta y periodo del que sale." },
        },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "priority", "expected_impact", "owner"],
        properties: {
          action: { type: "string" },
          priority: { type: "string", enum: priorityEnum },
          expected_impact: { type: "string" },
          owner: { type: "string", enum: ["cliente", "consultor"] },
        },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "reference", "period"],
        properties: {
          kind: { type: "string", enum: ["metric", "table", "tool", "document"] },
          reference: { type: "string" },
          period: { type: ["string", "null"] },
        },
      },
    },
    proposed_writes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "title", "description", "priority"],
        properties: {
          kind: { type: "string", enum: ["task", "note"] },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: priorityEnum },
        },
      },
    },
    approval_required: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

// ---------------------------------------------------------------------------
// Contrato de salida A09 - copiloto del consultor (AI-05)
// Chat de solo lectura: sin findings/severidad ni proposed_writes (nunca
// escribe en el dominio), solo respuesta + fuentes citadas.
// ---------------------------------------------------------------------------

export const chatOutputSchema = z.object({
  answer: z.string(),
  sources: z.array(agentSourceSchema),
  confidence: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string()),
});

export type ChatOutput = z.infer<typeof chatOutputSchema>;

export const chatJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "sources", "confidence", "warnings"],
  properties: {
    answer: { type: "string", description: "Respuesta directa a la pregunta del usuario, en espanol." },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "reference", "period"],
        properties: {
          kind: { type: "string", enum: ["metric", "table", "tool", "document"] },
          reference: { type: "string" },
          period: { type: ["string", "null"] },
        },
      },
      description: "Fuentes usadas para responder: solo si se uso una tool de datos.",
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Avisos: p. ej. datos incompletos o pregunta fuera del alcance de las tools disponibles.",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Contrato de salida A01 - analista de llamadas (AI-01)
// El criterio de cierre exige separar hechos, decisiones y recomendaciones, y
// que las tareas propuestas sean accionables y deduplicables. Es un contrato
// distinto del generico de A02 (findings/severidad no encaja en una llamada).
// ---------------------------------------------------------------------------

export const callProposedTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  owner: z.enum(["cliente", "consultor"]),
});

export const callSummaryOutputSchema = z.object({
  summary: z.string(),
  facts: z.array(z.string()),
  decisions: z.array(z.string()),
  recommendations: z.array(
    z.object({
      action: z.string(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      rationale: z.string(),
    }),
  ),
  risks: z.array(z.string()),
  proposed_tasks: z.array(callProposedTaskSchema),
  key_quotes: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string()),
});

export type CallSummaryOutput = z.infer<typeof callSummaryOutputSchema>;

export const callSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "facts",
    "decisions",
    "recommendations",
    "risks",
    "proposed_tasks",
    "key_quotes",
    "confidence",
    "warnings",
  ],
  properties: {
    summary: {
      type: "string",
      description: "Resumen narrativo de la llamada en espanol, separando lo tratado de lo acordado.",
    },
    facts: {
      type: "array",
      items: { type: "string" },
      description: "Hechos objetivos mencionados en la llamada (que paso / que se dijo), sin interpretacion.",
    },
    decisions: {
      type: "array",
      items: { type: "string" },
      description: "Decisiones tomadas y acuerdos alcanzados durante la llamada.",
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "priority", "rationale"],
        properties: {
          action: { type: "string" },
          priority: { type: "string", enum: priorityEnum },
          rationale: { type: "string" },
        },
      },
      description: "Recomendaciones del consultor derivadas de la llamada (distintas de las decisiones ya tomadas).",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "Riesgos, bloqueos o dudas abiertas detectados.",
    },
    proposed_tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "priority", "owner"],
        properties: {
          title: { type: "string", description: "Accion concreta e inequivoca, sin duplicar otras tareas." },
          description: { type: "string" },
          priority: { type: "string", enum: priorityEnum },
          owner: { type: "string", enum: ["cliente", "consultor"] },
        },
      },
      description: "Tareas accionables y deduplicables acordadas en la llamada; se crean solo tras aprobacion.",
    },
    key_quotes: {
      type: "array",
      items: { type: "string" },
      description: "Fragmentos textuales de la transcripcion que respaldan el resumen (citas de origen).",
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Avisos: p. ej. transcripcion incompleta o ambigua.",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Catalogo de tools permitidas (cerrado; se amplia con AI-03 SQL Gateway)
// ---------------------------------------------------------------------------

export type ToolCatalogEntry = {
  name: string;
  description: string;
  readOnly: boolean;
};

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  {
    name: "sql_select",
    description:
      "SQL Gateway (AI-03): SELECT de solo lectura sobre el esquema `ai`, con tenant forzado por el backend, timeout y limite de filas.",
    readOnly: true,
  },
  {
    name: "search_knowledge",
    description:
      "RAG (AI-04): busqueda semantica sobre la metodologia EcomScaling (global) y el conocimiento privado de la organizacion activa.",
    readOnly: true,
  },
];

// ---------------------------------------------------------------------------
// Modelo de costes (USD por millon de tokens; actualizar junto al modelo)
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  // R-020: fallback OpenAI. Verificar contra https://openai.com/api/pricing
  // antes de confiar en estimated_cost_usd para presupuesto real.
  "gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  "gpt-4.1-nano": { inputPerMTok: 0.1, outputPerMTok: 0.4 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    return 0;
  }

  return (
    (inputTokens / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok
  );
}

// ---------------------------------------------------------------------------
// Executor: una vuelta de agente con salida estructurada validada
// ---------------------------------------------------------------------------

export type AgentTurnResult<TOutput = AgentOutput> = {
  output: TOutput;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  stopReason: string | null;
  modelCalls: number;
  toolCallCount: number;
};

/**
 * Contrato de salida estructurada de una vuelta de agente: el JSON Schema que
 * se envia a la API para forzar el formato y el esquema Zod con el que se valida
 * la respuesta antes de persistirla. Por defecto es el contrato generico de A02.
 */
export type OutputContract<TOutput> = {
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<TOutput>;
};

const defaultOutputContract: OutputContract<AgentOutput> = {
  jsonSchema: agentOutputJsonSchema as unknown as Record<string, unknown>,
  schema: agentOutputSchema,
};

/**
 * Tool ejecutable durante una vuelta de agente. `execute` corre en el backend
 * (nunca en el modelo) y es responsable de su propia auditoria; lo que
 * devuelve se serializa como tool_result.
 */
export type AgentToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

const MAX_MODEL_CALLS_PER_TURN = 8;

export class AgentOutputValidationError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
  ) {
    super(message);
    this.name = "AgentOutputValidationError";
  }
}

// AI-00/AI-06 (R-011): el coste y los tool calls se registraban pero nada los
// bloqueaba -- un run podia costar lo que fuera sin cortarse. Este error para
// el turno en curso en cuanto se supera el presupuesto declarado.
export class AgentBudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly estimatedCostUsd: number,
    public readonly toolCallCount: number,
  ) {
    super(message);
    this.name = "AgentBudgetExceededError";
  }
}

export type AgentBudget = {
  /** Coste estimado maximo (USD) antes de cortar el turno. */
  maxCostUsd?: number;
  /** Tool calls maximas (mas estricto que MAX_MODEL_CALLS_PER_TURN si se declara). */
  maxToolCalls?: number;
};

/**
 * Decision pura de presupuesto, separada de `runAgentTurn` para poder probarla
 * sin llamar a la API de Anthropic. Devuelve el motivo del corte o null si el
 * turno puede continuar.
 */
export function evaluateAgentBudget(
  budget: AgentBudget | undefined,
  costSoFarUsd: number,
  toolCallCount: number,
): { exceeded: true; message: string } | { exceeded: false } {
  if (!budget) {
    return { exceeded: false };
  }

  if (budget.maxCostUsd !== undefined && costSoFarUsd > budget.maxCostUsd) {
    return {
      exceeded: true,
      message: `agent_budget_exceeded: cost $${costSoFarUsd.toFixed(4)} > max $${budget.maxCostUsd}`,
    };
  }

  if (budget.maxToolCalls !== undefined && toolCallCount > budget.maxToolCalls) {
    return {
      exceeded: true,
      message: `agent_budget_exceeded: ${toolCallCount} tool calls > max ${budget.maxToolCalls}`,
    };
  }

  return { exceeded: false };
}

// ---------------------------------------------------------------------------
// AI-06: guarda de calidad ("groundedness" estructural). Se han observado en
// produccion salidas que pasan la validacion de schema (Zod acepta strings
// vacios) pero son basura: answer vacio, o texto corrupto con un fragmento
// repetido muchas veces seguidas (glitch de generacion). Esta guarda corre
// DESPUES del schema y ANTES de persistir, asi que un run asi queda
// "rejected_output" en vez de pending_approval listo para que un consultor
// lo apruebe sin darse cuenta.
// ---------------------------------------------------------------------------

// Un fragmento de 3-12 caracteres repetido 5+ veces seguidas es casi siempre
// un glitch de generacion, nunca texto humano legitimo en espanol.
const GIBBERISH_REPEAT_PATTERN = /(.{3,12})\1{4,}/;

function isGibberish(text: string): boolean {
  return GIBBERISH_REPEAT_PATTERN.test(text);
}

// AI-06 (hallazgo real 2026-07-23, eval de A08): dos glitches nuevos que
// pasaban `checkOutputSanity` porque no son ni vacios ni repeticion --
// ambos observados en corridas reales contra el LLM, coincidiendo con turnos
// donde el agente encadeno varias llamadas a herramientas:
//   1. Un texto muy corto casi sin letras reales, ej. `", ecd"` -- el turno
//      completo no llego a generar contenido de verdad.
//   2. Un salto de linea partiendo una palabra a mitad, muy al inicio del
//      texto y antes de cualquier puntuacion de cierre de frase, ej.
//      `"El catlogo del catos c\ntene tres documentos..."` -- el resto del
//      texto suele ser coherente, pero la apertura esta rota.
// Ninguno de los dos justifica bloquear texto humano legitimo: un answer
// corto pero real ("ok", "Sin hallazgos.") es valido aunque sea breve -- lo
// que nunca es valido es EMPEZAR con puntuacion de continuacion (una coma,
// un punto y coma, un parentesis/corchete de cierre), que solo aparece a
// mitad de frase, nunca al inicio de un texto humano coherente. Y un salto de
// linea despues de puntuacion (listas, parrafos) no cuenta como incoherente.
const IMPOSSIBLE_OPENING_CHAR = /^[,;:)\]}]/;

function hasIncoherentOpening(text: string): boolean {
  if (IMPOSSIBLE_OPENING_CHAR.test(text)) {
    return true;
  }

  const newlineIndex = text.indexOf("\n");
  if (newlineIndex > 0 && newlineIndex < 60) {
    const beforeNewline = text.slice(0, newlineIndex);
    const brokenWord = /[a-zA-ZÀ-ÿ]$/.test(beforeNewline) && /^[a-zA-ZÀ-ÿ]/.test(text.slice(newlineIndex + 1));
    const hasSentenceEnd = /[.!?]/.test(beforeNewline);
    if (brokenWord && !hasSentenceEnd) {
      return true;
    }
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type OutputSanityResult = { ok: true } | { ok: false; reason: string };

/**
 * Chequeo estructural por duck-typing: funciona igual para agentOutputSchema
 * (answer/proposed_writes), callSummaryOutputSchema (summary/proposed_tasks)
 * y chatOutputSchema (answer), sin acoplarse a un contrato concreto.
 */
export function checkOutputSanity(output: unknown): OutputSanityResult {
  if (!isPlainObject(output)) {
    return { ok: false, reason: "output_no_es_objeto" };
  }

  for (const field of ["answer", "summary"] as const) {
    const value = output[field];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: false, reason: `${field}_vacio` };
    }
    if (isGibberish(trimmed)) {
      return { ok: false, reason: `${field}_con_texto_corrupto` };
    }
    if (hasIncoherentOpening(trimmed)) {
      return { ok: false, reason: `${field}_con_apertura_incoherente` };
    }
  }

  for (const field of ["proposed_writes", "proposed_tasks"] as const) {
    const items = output[field];
    if (!Array.isArray(items)) {
      continue;
    }
    for (const item of items) {
      if (!isPlainObject(item)) {
        continue;
      }
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const description = typeof item.description === "string" ? item.description.trim() : "";
      if (!title) {
        return { ok: false, reason: `${field}_con_titulo_vacio` };
      }
      if (isGibberish(title) || isGibberish(description)) {
        return { ok: false, reason: `${field}_con_texto_corrupto` };
      }
    }
  }

  return { ok: true };
}

/**
 * Ejecuta una vuelta del agente contra la API de Anthropic. El contexto llega
 * ya construido y acotado por el backend (el modelo no puede ampliar
 * organizaciones); la salida se valida contra el contrato v1 antes de
 * devolverse. Si se pasan tools (AI-03/AI-04), se itera el ciclo tool_use ->
 * tool_result con un tope de llamadas al modelo; los executors corren en el
 * backend y auditan cada invocacion.
 */
export async function runAgentTurn<TOutput = AgentOutput>(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  input: AgentInput;
  contextBlocks: Array<{ label: string; data: unknown }>;
  tools?: AgentToolDefinition[];
  outputContract?: OutputContract<TOutput>;
  budget?: AgentBudget;
}): Promise<AgentTurnResult<TOutput>> {
  const input = agentInputSchema.parse(params.input);
  const client = new Anthropic({ apiKey: params.apiKey });
  const startedAt = Date.now();
  const tools = params.tools ?? [];
  const budget = params.budget;
  const outputContract =
    params.outputContract ?? (defaultOutputContract as unknown as OutputContract<TOutput>);

  const contextText = params.contextBlocks
    .map((block) => `## ${block.label}\n${JSON.stringify(block.data, null, 2)}`)
    .join("\n\n");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            `Organizacion activa: ${input.organization_id} (resuelta por el backend; analiza solo estos datos).`,
            `Objetivo de la ejecucion: ${input.objective}`,
            input.time_range ? `Periodo: ${input.time_range.start} a ${input.time_range.end}` : null,
            "",
            "Contexto verificado:",
            contextText,
          ]
            .filter((line) => line !== null)
            .join("\n"),
        },
      ],
    },
  ];

  const requestBase = {
    model: params.model,
    max_tokens: 16000,
    system: [
      {
        type: "text" as const,
        text: params.systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    output_config: {
      format: {
        type: "json_schema" as const,
        schema: outputContract.jsonSchema,
      },
    },
    ...(tools.length > 0
      ? {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
          })),
        }
      : {}),
  };

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let modelCalls = 0;
  let toolCallCount = 0;

  const enforceBudget = () => {
    const costSoFar = estimateCostUsd(params.model, inputTokens, outputTokens);
    const verdict = evaluateAgentBudget(budget, costSoFar, toolCallCount);

    if (verdict.exceeded) {
      throw new AgentBudgetExceededError(verdict.message, costSoFar, toolCallCount);
    }
  };

  let response = await client.messages.create({ ...requestBase, messages });
  modelCalls += 1;
  inputTokens += response.usage.input_tokens;
  outputTokens += response.usage.output_tokens;
  cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
  enforceBudget();

  while (response.stop_reason === "tool_use") {
    if (modelCalls >= MAX_MODEL_CALLS_PER_TURN) {
      throw new AgentOutputValidationError("agent_tool_loop_limit_exceeded", "");
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const tool = tools.find((candidate) => candidate.name === toolUse.name);
      toolCallCount += 1;
      enforceBudget();

      let resultContent: string;
      let isError = false;

      if (!tool) {
        resultContent = JSON.stringify({ error: `tool_desconocida: ${toolUse.name}` });
        isError = true;
      } else {
        try {
          const result = await tool.execute((toolUse.input ?? {}) as Record<string, unknown>);
          resultContent = JSON.stringify(result ?? null);
        } catch (error) {
          resultContent = JSON.stringify({
            error: error instanceof Error ? error.message : "tool_execution_failed",
          });
          isError = true;
        }
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultContent,
        is_error: isError,
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({ ...requestBase, messages });
    modelCalls += 1;
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
    enforceBudget();
  }

  const latencyMs = Date.now() - startedAt;

  if (response.stop_reason === "refusal") {
    throw new AgentOutputValidationError("agent_refusal", "");
  }

  if (response.stop_reason === "max_tokens") {
    throw new AgentOutputValidationError("agent_output_truncated_max_tokens", "");
  }

  // El JSON estructurado es el ultimo bloque de texto de la respuesta final;
  // si el modelo antepone texto libre, quedarnos con el primero lo romperia.
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  const textBlock = textBlocks[textBlocks.length - 1];

  if (!textBlock) {
    throw new AgentOutputValidationError("agent_output_missing_text", "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new AgentOutputValidationError("agent_output_invalid_json", textBlock.text);
  }

  const validated = outputContract.schema.safeParse(parsed);

  if (!validated.success) {
    throw new AgentOutputValidationError(
      `agent_output_schema_mismatch: ${validated.error.message}`,
      textBlock.text,
    );
  }

  const sanity = checkOutputSanity(validated.data);

  if (!sanity.ok) {
    throw new AgentOutputValidationError(`agent_output_sanity_check_failed: ${sanity.reason}`, textBlock.text);
  }

  return {
    output: validated.data,
    model: params.model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    estimatedCostUsd: estimateCostUsd(params.model, inputTokens, outputTokens),
    latencyMs,
    stopReason: response.stop_reason,
    modelCalls,
    toolCallCount,
  };
}

// ---------------------------------------------------------------------------
// R-020/AI-09: fallback de proveedor LLM. Mismo contrato de entrada/salida
// que runAgentTurn, pero contra OpenAI -- el backend decide cuando usar este
// camino (Anthropic no disponible/degradado), nunca el modelo. Se apoya en
// los mismos AgentToolDefinition/OutputContract/AgentBudget para que el
// caller no tenga que distinguir de proveedor salvo al elegir cual llamar.
// ---------------------------------------------------------------------------

export async function runAgentTurnOpenAI<TOutput = AgentOutput>(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  input: AgentInput;
  contextBlocks: Array<{ label: string; data: unknown }>;
  tools?: AgentToolDefinition[];
  outputContract?: OutputContract<TOutput>;
  budget?: AgentBudget;
}): Promise<AgentTurnResult<TOutput>> {
  const input = agentInputSchema.parse(params.input);
  const client = new OpenAI({ apiKey: params.apiKey });
  const startedAt = Date.now();
  const tools = params.tools ?? [];
  const budget = params.budget;
  const outputContract =
    params.outputContract ?? (defaultOutputContract as unknown as OutputContract<TOutput>);

  const contextText = params.contextBlocks
    .map((block) => `## ${block.label}\n${JSON.stringify(block.data, null, 2)}`)
    .join("\n\n");

  const userText = [
    `Organizacion activa: ${input.organization_id} (resuelta por el backend; analiza solo estos datos).`,
    `Objetivo de la ejecucion: ${input.objective}`,
    input.time_range ? `Periodo: ${input.time_range.start} a ${input.time_range.end}` : null,
    "",
    "Contexto verificado:",
    contextText,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: params.systemPrompt },
    { role: "user", content: userText },
  ];

  const requestBase = {
    model: params.model,
    max_completion_tokens: 16000,
    response_format: {
      type: "json_schema" as const,
      json_schema: {
        name: "agent_output",
        schema: outputContract.jsonSchema,
        strict: true,
      },
    },
    ...(tools.length > 0
      ? {
          tools: tools.map(
            (tool): OpenAI.Chat.Completions.ChatCompletionTool => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              },
            }),
          ),
        }
      : {}),
  };

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let modelCalls = 0;
  let toolCallCount = 0;

  const enforceBudget = () => {
    const costSoFar = estimateCostUsd(params.model, inputTokens, outputTokens);
    const verdict = evaluateAgentBudget(budget, costSoFar, toolCallCount);

    if (verdict.exceeded) {
      throw new AgentBudgetExceededError(verdict.message, costSoFar, toolCallCount);
    }
  };

  let response = await client.chat.completions.create({ ...requestBase, messages });
  modelCalls += 1;
  inputTokens += response.usage?.prompt_tokens ?? 0;
  outputTokens += response.usage?.completion_tokens ?? 0;
  cacheReadTokens += response.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  enforceBudget();

  let choice = response.choices[0];

  if (!choice) {
    throw new AgentOutputValidationError("agent_output_missing_choice", "");
  }

  while (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    if (modelCalls >= MAX_MODEL_CALLS_PER_TURN) {
      throw new AgentOutputValidationError("agent_tool_loop_limit_exceeded", "");
    }

    const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.type !== "function") {
        continue;
      }

      const tool = tools.find((candidate) => candidate.name === toolCall.function.name);
      toolCallCount += 1;
      enforceBudget();

      let resultContent: string;

      if (!tool) {
        resultContent = JSON.stringify({ error: `tool_desconocida: ${toolCall.function.name}` });
      } else {
        try {
          const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          const result = await tool.execute(args as Record<string, unknown>);
          resultContent = JSON.stringify(result ?? null);
        } catch (error) {
          resultContent = JSON.stringify({
            error: error instanceof Error ? error.message : "tool_execution_failed",
          });
        }
      }

      toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: resultContent });
    }

    messages.push(choice.message);
    messages.push(...toolResults);

    response = await client.chat.completions.create({ ...requestBase, messages });
    modelCalls += 1;
    inputTokens += response.usage?.prompt_tokens ?? 0;
    outputTokens += response.usage?.completion_tokens ?? 0;
    cacheReadTokens += response.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    enforceBudget();

    const nextChoice = response.choices[0];
    if (!nextChoice) {
      throw new AgentOutputValidationError("agent_output_missing_choice", "");
    }
    choice = nextChoice;
  }

  const latencyMs = Date.now() - startedAt;

  if (choice.finish_reason === "content_filter") {
    throw new AgentOutputValidationError("agent_refusal", "");
  }

  if (choice.finish_reason === "length") {
    throw new AgentOutputValidationError("agent_output_truncated_max_tokens", "");
  }

  const text = choice.message.content;

  if (!text) {
    throw new AgentOutputValidationError("agent_output_missing_text", "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AgentOutputValidationError("agent_output_invalid_json", text);
  }

  const validated = outputContract.schema.safeParse(parsed);

  if (!validated.success) {
    throw new AgentOutputValidationError(
      `agent_output_schema_mismatch: ${validated.error.message}`,
      text,
    );
  }

  const sanity = checkOutputSanity(validated.data);

  if (!sanity.ok) {
    throw new AgentOutputValidationError(`agent_output_sanity_check_failed: ${sanity.reason}`, text);
  }

  return {
    output: validated.data,
    model: params.model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    estimatedCostUsd: estimateCostUsd(params.model, inputTokens, outputTokens),
    latencyMs,
    stopReason: choice.finish_reason,
    modelCalls,
    toolCallCount,
  };
}

// ---------------------------------------------------------------------------
// AI-04: embeddings swappables y chunking para RAG
// ---------------------------------------------------------------------------

/**
 * Interfaz de embeddings intercambiable (decision AI-04: pgvector en Supabase
 * hoy; si manana se migra a una base vectorial separada, solo cambia la
 * implementacion de retrieval, no el resto del sistema). Cualquier proveedor
 * debe emitir vectores de `dimensions` para casar con vector(1024) en DB.
 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], inputType: "document" | "query"): Promise<number[][]>;
}

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string,
    model = "voyage-3.5",
  ) {
    this.model = model;
  }

  async embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        input_type: inputType,
        output_dimension: this.dimensions,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`voyage_embeddings_failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };

    return payload.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

/**
 * Chunking por parrafos con solape: fragmentos de ~maxChars respetando saltos
 * de parrafo cuando es posible, con overlapChars de contexto arrastrado.
 */
export function chunkText(
  text: string,
  options?: { maxChars?: number; overlapChars?: number },
): string[] {
  const maxChars = options?.maxChars ?? 1500;
  const overlapChars = options?.overlapChars ?? 200;
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .flatMap((paragraph) => {
      if (paragraph.length <= maxChars) {
        return [paragraph];
      }
      const pieces: string[] = [];
      for (let offset = 0; offset < paragraph.length; offset += maxChars) {
        pieces.push(paragraph.slice(offset, offset + maxChars));
      }
      return pieces;
    });

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = current.slice(Math.max(0, current.length - overlapChars));
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
