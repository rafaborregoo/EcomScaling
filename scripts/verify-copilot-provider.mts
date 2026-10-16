/** Live, synthetic smoke test. No tenant data, DB writes, or connector calls. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chatJsonSchema, chatOutputSchema, runAgentTurn, type AgentToolDefinition } from "@e-nora/ai";
import { COPILOT_MODELS } from "../apps/api/src/copilot-tokens.js";
import { createCopilotAnswerStream } from "../apps/api/src/copilot-answer-stream.js";
import { buildAgentTools, createServiceClient } from "../apps/api/src/ai-runtime.js";
import { loadApiEnv } from "@e-nora/config";

if (!process.argv.includes("--live")) {
  console.error("Usage: npx dotenv -o -e .env.local -- tsx scripts/verify-copilot-provider.mts --live [--model=sonnet|opus|haiku] [--no-stream] [--configured-tools] [--organization-scope]");
  process.exit(2);
}
const apiKey = process.env.ANTHROPIC_API_KEY;
assert.ok(apiKey, "ANTHROPIC_API_KEY is required");
const streaming = !process.argv.includes("--no-stream");
const modelId = process.argv.find((arg) => arg.startsWith("--model="))?.slice("--model=".length) ?? "sonnet";
const selectedModel = COPILOT_MODELS.find((entry) => entry.id === modelId);
assert.ok(selectedModel, "unknown copilot model selector");
const model = selectedModel.anthropicModel;
let catalog: AgentToolDefinition[] = [];
if (process.argv.includes("--configured-tools")) {
  const env = loadApiEnv(process.env);
  const db = createServiceClient(env);
  const { data: version, error } = await db.from("agent_versions")
    .select("version,allowed_tools,approval_mode,agent_definitions!inner(code)")
    .eq("agent_definitions.code", "a09_copiloto_consultor").eq("is_active", true)
    .order("created_at", { ascending: false }).limit(1).single();
  assert.ifError(error);
  assert.ok(version);
  const scopedStore = process.argv.includes("--organization-scope") ? null : randomUUID();
  const declarations = buildAgentTools(env, db, randomUUID(), randomUUID(), version.allowed_tools,
    "Synthetic integration test.", scopedStore, ["core", "shopify", "meta", "klaviyo", "instagram"],
    ["client_visible"], { actorUserId: randomUUID(), approvalMode: version.approval_mode });
  assert.equal(declarations.securityEvents.length, 0, "the configured catalog must have no permission wiring errors");
  const missing = (version.allowed_tools as string[]).filter((name) => !declarations.tools.some((tool) => tool.name === name));
  assert.deepEqual(missing, scopedStore ? ["sql_select"] : [], "only SQL is intentionally unavailable at store scope");
  catalog = declarations.tools.map((tool) => ({ ...tool,
    execute: async () => { throw new Error("Live connector execution is disabled in this synthetic test"); },
  }));
}
let executions = 0;
let streamedAnswer = "";
const toolStates: string[] = [];
const answerStream = createCopilotAnswerStream((delta) => { streamedAnswer += delta; });
try {
  const result = await runAgentTurn({
    apiKey,
    model,
    systemPrompt: "Synthetic connection test. First call copilot_connection_probe exactly once, then answer with its value. Use no other sources. Set all unused arrays to [] and nullable scalar fields to null. Keep answer under 40 characters and the JSON short. Never propose writes.",
    input: {
      run_id: randomUUID(), agent_code: "a09_copiloto_consultor", agent_version: "smoke-test",
      organization_id: randomUUID(), actor_user_id: randomUUID(), trigger_type: "chat",
      objective: "Pregunta nueva de prueba: ¿qué valor devuelve la herramienta sintética?",
      allowed_tools: ["copilot_connection_probe", ...catalog.map((tool) => tool.name)], approval_mode: "none",
    },
    contextBlocks: [{ label: "Synthetic fixture", data: { contains_tenant_data: false } }],
    tools: [...catalog, {
      name: "copilot_connection_probe",
      description: "Returns a synthetic value. Call exactly once before answering the connection test.",
      inputSchema: { type: "object", additionalProperties: false, properties: {}, required: [] },
      execute: async () => { executions += 1; return { ok: true, value: 5 }; },
    }],
    outputContract: { jsonSchema: chatJsonSchema as unknown as Record<string, unknown>, schema: chatOutputSchema },
    budget: { maxToolCalls: 1, maxCostUsd: 0.15 },
    resilience: { maxRetries: 0, timeoutMs: 60000 },
    onToolActivity: (event) => { toolStates.push(event.status); },
    ...(streaming ? {
      onTextDelta: (delta: string) => answerStream.push(delta),
      onTextReset: () => { answerStream.reset(); streamedAnswer = ""; },
    } : {}),
  });
  assert.equal(executions, 1, "the model must call the backend tool exactly once");
  assert.deepEqual(toolStates, ["running", "done"]);
  assert.match(result.output.answer, /5/);
  assert.equal(result.output.proposed_writes?.length ?? 0, 0);
  if (streaming) assert.equal(streamedAnswer, result.output.answer, "the UI must receive the validated answer as streaming text");
  console.log(JSON.stringify({ ok: true, model: result.model, streaming, catalog_tools: catalog.length, tool_executions: executions, tool_states: toolStates, answer: result.output.answer, stream_matches_output: !streaming || streamedAnswer === result.output.answer }));
} catch (error) {
  // Provider error bodies contain no request credentials or tenant context.
  const failure = error as Error & { status?: number; request_id?: string };
  console.error(JSON.stringify({ ok: false, streaming, status: failure.status, request_id: failure.request_id, message: failure.message }));
  process.exitCode = 1;
}
