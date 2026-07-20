import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  AGENT_OUTPUT_SCHEMA_VERSION,
  AgentOutputValidationError,
  callSummaryJsonSchema,
  callSummaryOutputSchema,
  chatJsonSchema,
  chatOutputSchema,
  runAgentTurn,
  VoyageEmbeddingProvider,
  type AgentInput,
  type CallSummaryOutput,
  type ChatOutput,
  type AgentToolDefinition,
} from "@ecomscaling/ai";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { executeGatewayQuery, SQL_GATEWAY_SCHEMA_DOC } from "./sql-gateway.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

// Categoria de tarea por agente: es un mapeo estatico, no algo que el LLM decide
// en cada turno -- igual que el resto del runtime, el dato deterministico
// (que integracion cubre cada agente) lo fija el codigo, la IA solo interpreta.
// Cuando se activen A03/A05/A07 (Meta/Instagram), sus agentes se anaden aqui.
const AGENT_TASK_CATEGORY: Record<string, "shopify" | "meta" | "klaviyo" | "general"> = {
  a04_generador_tareas: "shopify",
  a06_planificador_stock: "shopify",
};

async function resolveAgentCodeForRun(supabase: ReturnType<typeof createServiceClient>, runId: string) {
  const { data: run } = await supabase
    .from("agent_runs")
    .select("agent_version_id")
    .eq("id", runId)
    .maybeSingle();

  if (!run) {
    return null;
  }

  const { data: version } = await supabase
    .from("agent_versions")
    .select("definition_id")
    .eq("id", run.agent_version_id)
    .maybeSingle();

  if (!version) {
    return null;
  }

  const { data: definition } = await supabase
    .from("agent_definitions")
    .select("code")
    .eq("id", version.definition_id)
    .maybeSingle();

  return definition?.code ?? null;
}

function requireMembership(context: AuthContext, organizationId: string) {
  const membership = context.memberships.find((item) => item.organization_id === organizationId);

  if (!membership) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  return { ok: true as const, membership };
}

/**
 * Construye las tools sql_select/search_knowledge segun allowed_tools de la
 * version del agente. Compartido entre A02 y el copiloto de chat (A09): cada
 * executor corre aqui con el tenant ya fijado, y toda invocacion queda en
 * agent_tool_calls (y las SQL ademas en agent_query_runs).
 */
function buildAgentTools(
  env: ApiEnv,
  supabase: SupabaseClient,
  runId: string,
  organizationId: string,
  rawAllowedTools: unknown,
  systemPromptBase: string,
): { tools: AgentToolDefinition[]; systemPrompt: string } {
  const allowedToolNames = Array.isArray(rawAllowedTools)
    ? (rawAllowedTools as unknown[]).filter((name): name is string => typeof name === "string")
    : [];

  const recordToolCall = async (
    toolName: string,
    toolInput: unknown,
    toolOutput: unknown,
    isError: boolean,
    durationMs: number,
  ) => {
    await supabase.from("agent_tool_calls").insert({
      run_id: runId,
      organization_id: organizationId,
      tool_name: toolName,
      input: toolInput,
      output: toolOutput,
      is_error: isError,
      duration_ms: durationMs,
    });
  };

  const tools: AgentToolDefinition[] = [];
  let systemPrompt = systemPromptBase;

  if (allowedToolNames.includes("sql_select")) {
    systemPrompt = `${systemPrompt}\n\n${SQL_GATEWAY_SCHEMA_DOC}`;
    tools.push({
      name: "sql_select",
      description:
        "Ejecuta UNA sentencia SELECT (o WITH) de solo lectura sobre las vistas del esquema documentado, ya filtradas a la organizacion activa. Maximo 200 filas: agrega en SQL en vez de listar filas sueltas.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Sentencia SELECT/WITH unica, sin punto y coma final." },
          purpose: { type: "string", description: "Que pregunta de negocio responde esta consulta." },
        },
        required: ["query"],
      },
      execute: async (toolInput) => {
        const query = typeof toolInput.query === "string" ? toolInput.query : "";
        const result = await executeGatewayQuery(supabase, runId, organizationId, query);

        await recordToolCall(
          "sql_select",
          { query, purpose: toolInput.purpose ?? null },
          result.ok
            ? { rows_returned: result.rows?.length ?? 0, tables_used: result.tablesUsed }
            : { error: result.error },
          !result.ok,
          result.durationMs,
        );

        return result.ok
          ? { rows: result.rows, row_limit: result.rowLimit ?? null, tables_used: result.tablesUsed }
          : { error: result.error };
      },
    });
  }

  if (allowedToolNames.includes("search_knowledge") && env.VOYAGE_API_KEY) {
    const embeddings = new VoyageEmbeddingProvider(env.VOYAGE_API_KEY);
    tools.push({
      name: "search_knowledge",
      description:
        "Busqueda semantica en la metodologia EcomScaling (global) y el conocimiento privado de la organizacion activa. Devuelve fragmentos con titulo de documento y similitud; cita los documentos usados en sources con kind 'document'.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Pregunta o tema a buscar, en lenguaje natural." },
        },
        required: ["query"],
      },
      execute: async (toolInput) => {
        const started = Date.now();
        const query = typeof toolInput.query === "string" ? toolInput.query : "";
        let output: unknown;
        let isError = false;

        try {
          const [embedding] = await embeddings.embed([query], "query");
          const { data, error } = await supabase.rpc("knowledge_search", {
            target_organization_id: organizationId,
            query_embedding: JSON.stringify(embedding),
            match_count: 8,
          });

          if (error) {
            output = { error: `knowledge_search_failed: ${error.message}` };
            isError = true;
          } else {
            output = { matches: data ?? [] };
          }
        } catch (error) {
          output = { error: error instanceof Error ? error.message : "embedding_failed" };
          isError = true;
        }

        await recordToolCall("search_knowledge", { query }, isError ? output : { matches: "ok" }, isError, Date.now() - started);
        return output;
      },
    });
  }

  return { tools, systemPrompt };
}

async function recordStep(
  supabase: SupabaseClient,
  runId: string,
  organizationId: string,
  position: number,
  stepType: string,
  summary: string,
  payload: unknown,
  durationMs: number | null,
) {
  await supabase.from("agent_run_steps").insert({
    run_id: runId,
    organization_id: organizationId,
    position,
    step_type: stepType,
    summary,
    payload,
    duration_ms: durationMs,
  });
}

/**
 * Ejecuta una vuelta de agente generica (contrato agentOutputSchema): carga
 * version/prompt activos por agent_code, construye tools, corre el turno y
 * persiste run + output. Compartido por A02, A04 y A06 -- solo cambian el
 * objective y los contextBlocks que cada uno construye antes de llamar aqui.
 * El modelo nunca decide que organizacion mira (criterio de cierre AI-00).
 */
async function runGenericDiagnosticAgent(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  agentCode: string,
  objective: string,
  timeRange: { start: string; end: string } | null,
  storeId: string | null,
  lookbackDays: number,
  buildContextBlocks: (
    supabase: SupabaseClient,
    runId: string,
  ) => Promise<Array<{ label: string; data: unknown }>>,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  if (!env.ANTHROPIC_API_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "ai_runtime_not_configured",
      message: "ANTHROPIC_API_KEY no esta configurada en el servidor.",
    };
  }

  const supabase = createServiceClient(env);

  const { data: agentVersion, error: versionError } = await supabase
    .from("agent_versions")
    .select("id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, agent_definitions!inner(code)")
    .eq("agent_definitions.code", agentCode)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError || !agentVersion) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "agent_version_load_failed",
      detail: versionError?.message ?? "not_found",
    };
  }

  const { data: prompt, error: promptError } = await supabase
    .from("prompt_versions")
    .select("content")
    .eq("code", agentVersion.prompt_code)
    .eq("version", agentVersion.prompt_version)
    .single();

  if (promptError || !prompt) {
    return { ok: false as const, statusCode: 500, error: "prompt_version_load_failed", detail: promptError?.message };
  }

  const runId = crypto.randomUUID();

  const { tools, systemPrompt } = buildAgentTools(
    env,
    supabase,
    runId,
    organizationId,
    agentVersion.allowed_tools,
    prompt.content,
  );

  const input: AgentInput = {
    run_id: runId,
    agent_code: agentCode,
    agent_version: agentVersion.version,
    organization_id: organizationId,
    actor_user_id: context.user.id,
    trigger_type: "manual",
    objective,
    time_range: timeRange,
    allowed_tools: tools.map((tool) => tool.name),
    approval_mode: agentVersion.approval_mode as AgentInput["approval_mode"],
  };

  const { error: runInsertError } = await supabase.from("agent_runs").insert({
    id: runId,
    organization_id: organizationId,
    agent_version_id: agentVersion.id,
    actor_user_id: context.user.id,
    trigger_type: input.trigger_type,
    objective: input.objective,
    time_range: input.time_range,
    store_id: storeId,
    lookback_days: lookbackDays,
  });

  if (runInsertError) {
    return { ok: false as const, statusCode: 500, error: "agent_run_create_failed", detail: runInsertError.message };
  }

  try {
    const contextStart = Date.now();
    const contextBlocks = await buildContextBlocks(supabase, runId);
    const contextDuration = Date.now() - contextStart;

    await supabase.from("agent_context_snapshots").insert({
      run_id: runId,
      organization_id: organizationId,
      context_level: "C2",
      snapshot: { blocks: contextBlocks, period: input.time_range },
    });

    await recordStep(
      supabase,
      runId,
      organizationId,
      1,
      "context_build",
      "Contexto C2 construido con funciones SQL de metricas",
      { block_labels: contextBlocks.map((block) => block.label) },
      contextDuration,
    );

    const turn = await runAgentTurn({
      apiKey: env.ANTHROPIC_API_KEY,
      model: agentVersion.model,
      systemPrompt,
      input,
      contextBlocks,
      tools,
    });

    await recordStep(
      supabase,
      runId,
      organizationId,
      2,
      "model_call",
      `Llamada al modelo ${turn.model}`,
      {
        stop_reason: turn.stopReason,
        input_tokens: turn.inputTokens,
        output_tokens: turn.outputTokens,
        model_calls: turn.modelCalls,
        tool_calls: turn.toolCallCount,
        tools_enabled: tools.map((tool) => tool.name),
      },
      turn.latencyMs,
    );

    const approvalRequired = input.approval_mode !== "none";

    const { data: outputRow, error: outputError } = await supabase
      .from("agent_outputs")
      .insert({
        run_id: runId,
        organization_id: organizationId,
        schema_version: AGENT_OUTPUT_SCHEMA_VERSION,
        output: turn.output,
        approval_required: approvalRequired,
        status: approvalRequired ? "pending_approval" : "approved",
      })
      .select("id, status")
      .single();

    if (outputError || !outputRow) {
      throw new Error(`agent_output_persist_failed: ${outputError?.message}`);
    }

    await supabase
      .from("agent_runs")
      .update({
        status: "succeeded",
        input_tokens: turn.inputTokens,
        output_tokens: turn.outputTokens,
        cache_read_tokens: turn.cacheReadTokens,
        estimated_cost_usd: turn.estimatedCostUsd,
        latency_ms: turn.latencyMs,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      ok: true as const,
      data: {
        run_id: runId,
        output_id: outputRow.id,
        output_status: outputRow.status,
        approval_required: approvalRequired,
        output: turn.output,
        usage: {
          input_tokens: turn.inputTokens,
          output_tokens: turn.outputTokens,
          estimated_cost_usd: turn.estimatedCostUsd,
          latency_ms: turn.latencyMs,
        },
      },
    };
  } catch (error) {
    const message =
      error instanceof AgentOutputValidationError
        ? [error.message, error.rawText ? error.rawText.slice(0, 300) : null].filter(Boolean).join(" | raw: ")
        : error instanceof Error
          ? error.message
          : "unknown_error";

    await supabase
      .from("agent_runs")
      .update({
        status: error instanceof AgentOutputValidationError ? "rejected_output" : "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return { ok: false as const, statusCode: 502, error: "agent_run_failed", detail: message };
  }
}

/**
 * Resuelve un connectionId (el que trae el selector de tienda del header) a
 * un store_id + nombre para el contexto del agente. Null si no hay tienda
 * seleccionada o no se encuentra: el diagnostico entonces cubre todas las
 * tiendas de la organizacion (comportamiento previo, valido para el caso
 * comun de una sola tienda).
 */
async function resolveStoreScope(
  supabase: SupabaseClient,
  organizationId: string,
  connectionId: string | null | undefined,
): Promise<{ storeId: string | null; storeLabel: string }> {
  if (!connectionId) {
    return { storeId: null, storeLabel: "todas las tiendas de la organizacion" };
  }

  const { data: store } = await supabase
    .from("shopify_stores")
    .select("id, shop_name")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (!store) {
    return { storeId: null, storeLabel: "todas las tiendas de la organizacion" };
  }

  return { storeId: store.id, storeLabel: `la tienda "${store.shop_name}"` };
}

const DIAGNOSTIC_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Diagnostico listo para mostrar sin friccion (consultor-first: no hay boton
 * "aprobar" para poder VER el analisis, la RLS ya deja ver pending_approval a
 * consultor/admin). Si hay un run exitoso de las ultimas 24h lo devuelve tal
 * cual (barato, instantaneo); si no, genera uno nuevo via runFresh. La
 * aprobacion humana se conserva solo para materializar las proposed_writes
 * como tareas reales (accion de escritura, no de lectura). Compartido por
 * A02/A04/A06 (los tres agentes automaticos con cache de 24h).
 */
async function getCachedDiagnostic(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  agentCode: string,
  storeId: string | null,
  lookbackDays: number,
  runFresh: () => ReturnType<typeof runMonitorAgent>,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  let query = supabase
    .from("agent_runs")
    .select(
      "id, status, started_at, finished_at, input_tokens, output_tokens, estimated_cost_usd, latency_ms, agent_versions!inner(agent_definitions!inner(code)), agent_outputs(id, status, approval_required, output, published_at)",
    )
    .eq("organization_id", organizationId)
    .eq("agent_versions.agent_definitions.code", agentCode)
    .eq("status", "succeeded")
    .eq("lookback_days", lookbackDays);

  // La cache es por tienda: un run generado para "todas las tiendas" no debe
  // reusarse cuando el consultor tiene una tienda concreta seleccionada, y
  // viceversa (evita mezclar tiendas sin avisar en el diagnostico mostrado).
  query = storeId ? query.eq("store_id", storeId) : query.is("store_id", null);

  const { data: latestRun, error: latestRunError } = await query
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRunError) {
    return { ok: false as const, statusCode: 500, error: "diagnostic_run_load_failed", detail: latestRunError.message };
  }

  // PostgREST embebe agent_outputs como objeto (no array) porque hay una
  // relacion 1:1 con agent_runs via run_id.
  const output = (latestRun?.agent_outputs as unknown as Record<string, unknown> | null) ?? null;
  const generatedAt = latestRun?.finished_at ?? latestRun?.started_at ?? null;
  const isFresh =
    generatedAt !== null && Date.now() - new Date(generatedAt as string).getTime() < DIAGNOSTIC_STALE_AFTER_MS;

  if (latestRun && output && isFresh) {
    return {
      ok: true as const,
      data: {
        run_id: latestRun.id,
        output_id: output.id,
        output_status: output.status,
        output: output.output,
        generated_at: generatedAt,
        from_cache: true,
        usage: {
          input_tokens: latestRun.input_tokens,
          output_tokens: latestRun.output_tokens,
          estimated_cost_usd: latestRun.estimated_cost_usd,
          latency_ms: latestRun.latency_ms,
        },
      },
    };
  }

  const fresh = await runFresh();

  if (fresh.ok === false) {
    return fresh;
  }

  return { ok: true as const, data: { ...fresh.data, generated_at: new Date().toISOString(), from_cache: false } };
}

const DEFAULT_DIAGNOSTIC_LOOKBACK_DAYS = 30;
const ALLOWED_DIAGNOSTIC_LOOKBACK_DAYS = [7, 30, 90] as const;

/** Normaliza el parametro `days` que llega de la UI: solo se aceptan los mismos valores del selector de periodo. */
function normalizeLookbackDays(days: number | null | undefined): number {
  return days && (ALLOWED_DIAGNOSTIC_LOOKBACK_DAYS as readonly number[]).includes(days)
    ? days
    : DEFAULT_DIAGNOSTIC_LOOKBACK_DAYS;
}

/**
 * Ejecuta A02 (monitor del negocio): salud financiera, riesgos y siguientes
 * acciones del periodo indicado (por defecto 30 dias). connectionId opcional
 * escoge la tienda activa (selector del header); sin ella, cubre todas las
 * tiendas.
 */
export async function runMonitorAgent(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
  days?: number | null,
) {
  const lookbackDays = normalizeLookbackDays(days);
  const now = new Date();
  const periodStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const supabaseForScope = createServiceClient(env);
  const { storeId, storeLabel } = await resolveStoreScope(supabaseForScope, organizationId, connectionId);

  return runGenericDiagnosticAgent(
    env,
    context,
    organizationId,
    "a02_monitor_negocio",
    `Diagnostico ejecutivo de los ultimos ${lookbackDays} dias (${storeLabel}): salud financiera, riesgos operativos y siguientes acciones.`,
    { start: periodStart.toISOString(), end: now.toISOString() },
    storeId,
    lookbackDays,
    async (supabase) => {
      const [sales, financial, stock, meta, alerts] = await Promise.all([
        supabase.rpc("shopify_sales_summary", {
          target_organization_id: organizationId,
          period_start: periodStart.toISOString(),
          period_end: now.toISOString(),
          target_store_id: storeId,
        }),
        supabase.rpc("shopify_financial_summary", {
          target_organization_id: organizationId,
          period_start: periodStart.toISOString(),
          period_end: now.toISOString(),
          target_store_id: storeId,
        }),
        supabase.rpc("shopify_stock_summary", {
          target_organization_id: organizationId,
          low_stock_threshold: 5,
          target_store_id: storeId,
        }),
        supabase.rpc("meta_spend_summary", {
          target_organization_id: organizationId,
          period_start: periodStart.toISOString().slice(0, 10),
          period_end: now.toISOString().slice(0, 10),
        }),
        supabase
          .from("alerts")
          .select("title, severity, status, metric_value")
          .eq("organization_id", organizationId)
          .in("status", ["open", "acknowledged"])
          .limit(20),
      ]);

      return [
        { label: `Ventas Shopify (${lookbackDays} dias)`, data: sales.data?.[0] ?? "sin_datos" },
        { label: `Resumen financiero (${lookbackDays} dias)`, data: financial.data?.[0] ?? "sin_datos" },
        { label: "Stock actual", data: stock.data?.[0] ?? "sin_datos" },
        { label: `Adquisicion Meta (${lookbackDays} dias)`, data: meta.data?.[0] ?? "sin_datos_meta" },
        { label: "Alertas activas", data: alerts.data ?? [] },
      ];
    },
  );
}

/** Diagnostico A02 con cache de 24h (auto-generado, sin friccion para ver), por tienda activa y periodo. */
export async function getMonitorDiagnostic(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
  days?: number | null,
) {
  const lookbackDays = normalizeLookbackDays(days);
  const supabaseForScope = createServiceClient(env);
  const { storeId } = await resolveStoreScope(supabaseForScope, organizationId, connectionId);

  return getCachedDiagnostic(env, context, organizationId, "a02_monitor_negocio", storeId, lookbackDays, () =>
    runMonitorAgent(env, context, organizationId, connectionId, lookbackDays),
  );
}

/** Ejecuta A04 (generador/priorizador de tareas): backlog abierto + alertas + ventas del periodo indicado de la tienda activa. */
export async function runTaskPlannerAgent(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
  days?: number | null,
) {
  const lookbackDays = normalizeLookbackDays(days);
  const now = new Date();
  const periodStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const supabaseForScope = createServiceClient(env);
  const { storeId, storeLabel } = await resolveStoreScope(supabaseForScope, organizationId, connectionId);

  return runGenericDiagnosticAgent(
    env,
    context,
    organizationId,
    "a04_generador_tareas",
    `Priorizar el backlog de tareas abiertas y proponer tareas nuevas donde haya un vacio (${storeLabel}, ventas de los ultimos ${lookbackDays} dias), sin duplicar lo ya existente.`,
    { start: periodStart.toISOString(), end: now.toISOString() },
    storeId,
    lookbackDays,
    async (supabase) => {
      const [tasks, alerts, sales] = await Promise.all([
        supabase
          .from("tasks")
          .select("title, description, priority, status, source, due_at, created_at")
          .eq("organization_id", organizationId)
          .in("status", ["pending", "in_progress"])
          .order("priority", { ascending: false })
          .limit(50),
        supabase
          .from("alerts")
          .select("title, severity, status, metric_value, first_detected_at")
          .eq("organization_id", organizationId)
          .in("status", ["open", "acknowledged"])
          .limit(30),
        supabase.rpc("shopify_sales_summary", {
          target_organization_id: organizationId,
          period_start: periodStart.toISOString(),
          period_end: now.toISOString(),
          target_store_id: storeId,
        }),
      ]);

      return [
        { label: "Tareas abiertas (backlog actual)", data: tasks.data ?? [] },
        { label: "Alertas activas", data: alerts.data ?? [] },
        { label: `Ventas Shopify (${lookbackDays} dias)`, data: sales.data?.[0] ?? "sin_datos" },
      ];
    },
  );
}

/** Diagnostico A04 con cache de 24h (auto-generado, sin friccion para ver), por tienda activa y periodo. */
export async function getTaskPlannerDiagnostic(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
  days?: number | null,
) {
  const lookbackDays = normalizeLookbackDays(days);
  const supabaseForScope = createServiceClient(env);
  const { storeId } = await resolveStoreScope(supabaseForScope, organizationId, connectionId);

  return getCachedDiagnostic(env, context, organizationId, "a04_generador_tareas", storeId, lookbackDays, () =>
    runTaskPlannerAgent(env, context, organizationId, connectionId, lookbackDays),
  );
}

/**
 * Ejecuta A06 (planificador de stock): stock agregado + el cruce stock/venta
 * ya resuelto por producto via shopify_stock_risk_products (fix: dejar que
 * el modelo hiciera este cruce el solo con sql_select lo colgaba en el limite
 * de tool calls con una respuesta final vacia; el cruce debe llegar ya
 * calculado, igual que el resto de contexto de A02/A04). connectionId
 * opcional escoge la tienda activa.
 */
export async function runStockPlannerAgent(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
  days?: number | null,
) {
  const lookbackDays = normalizeLookbackDays(days);
  const now = new Date();
  const periodStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const supabaseForScope = createServiceClient(env);
  const { storeId, storeLabel } = await resolveStoreScope(supabaseForScope, organizationId, connectionId);

  return runGenericDiagnosticAgent(
    env,
    context,
    organizationId,
    "a06_planificador_stock",
    `Detectar productos que venden bien (ultimos ${lookbackDays} dias) y se estan quedando sin stock (${storeLabel}), y proponer tareas de reposicion priorizadas.`,
    { start: periodStart.toISOString(), end: now.toISOString() },
    storeId,
    lookbackDays,
    async (supabase) => {
      const [stock, riskProducts] = await Promise.all([
        supabase.rpc("shopify_stock_summary", {
          target_organization_id: organizationId,
          low_stock_threshold: 5,
          target_store_id: storeId,
        }),
        supabase.rpc("shopify_stock_risk_products", {
          target_organization_id: organizationId,
          period_start: periodStart.toISOString(),
          period_end: now.toISOString(),
          target_store_id: storeId,
        }),
      ]);

      return [
        { label: "Stock actual (agregado)", data: stock.data?.[0] ?? "sin_datos" },
        {
          label: `Productos con venta reciente vs. stock disponible (${lookbackDays} dias, cruce ya calculado)`,
          data: riskProducts.data ?? [],
        },
      ];
    },
  );
}

/** Diagnostico A06 con cache de 24h (auto-generado, sin friccion para ver), por tienda activa y periodo. */
export async function getStockPlannerDiagnostic(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
  days?: number | null,
) {
  const lookbackDays = normalizeLookbackDays(days);
  const supabaseForScope = createServiceClient(env);
  const { storeId } = await resolveStoreScope(supabaseForScope, organizationId, connectionId);

  return getCachedDiagnostic(env, context, organizationId, "a06_planificador_stock", storeId, lookbackDays, () =>
    runStockPlannerAgent(env, context, organizationId, connectionId, lookbackDays),
  );
}

/** Ejecuta A08 (gestor de conocimiento): catalogo global + privado, detecta vacios y duplicados. */
export async function runKnowledgeManagerAgent(env: ApiEnv, context: AuthContext, organizationId: string) {
  return runGenericDiagnosticAgent(
    env,
    context,
    organizationId,
    "a08_gestor_conocimiento",
    "Revisar el catalogo de conocimiento (global y de la organizacion activa) para detectar vacios de metodologia y posibles duplicados.",
    null,
    null,
    DEFAULT_DIAGNOSTIC_LOOKBACK_DAYS,
    async (supabase) => {
      // organizationId ya paso por requireMembership (comparacion exacta
      // contra las memberships del usuario, imposible de falsear), pero se
      // valida el formato igualmente antes de interpolarlo en un filtro
      // .or() crudo -- defensa en profundidad ante un futuro refactor.
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) {
        return [{ label: "Catalogo de conocimiento", data: [] }];
      }

      const { data: documents } = await supabase
        .from("knowledge_documents")
        .select("title, description, source_type, visibility, status")
        .or(`visibility.eq.global,organization_id.eq.${organizationId}`)
        .eq("status", "active")
        .limit(200);

      return [{ label: "Catalogo de conocimiento (global + organizacion activa)", data: documents ?? [] }];
    },
  );
}

/** Diagnostico A08 con cache de 24h (auto-generado, sin friccion para ver). */
export async function getKnowledgeManagerDiagnostic(env: ApiEnv, context: AuthContext, organizationId: string) {
  return getCachedDiagnostic(
    env,
    context,
    organizationId,
    "a08_gestor_conocimiento",
    null,
    DEFAULT_DIAGNOSTIC_LOOKBACK_DAYS,
    () => runKnowledgeManagerAgent(env, context, organizationId),
  );
}

/**
 * Ejecuta A01 (analista de llamadas) sobre la transcripcion ACTUAL de una
 * llamada. A diferencia de A02 no usa tools de datos: su unica fuente es la
 * transcripcion, para no inventar cifras. El resultado se escribe en
 * call_ai_summaries con status pending_approval y run_id (trazabilidad AI-00);
 * el flujo de aprobacion existente (decideSummary) publica al cliente y
 * materializa las tareas propuestas. Gestionar llamadas es trabajo de consultor.
 */
export async function runCallAnalyst(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  callId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  if (!["platform_admin", "consultant"].includes(context.profile.platform_role)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_role_required",
      message: "Solo un consultor o platform admin puede generar el resumen IA de una llamada.",
    };
  }

  if (!env.ANTHROPIC_API_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "ai_runtime_not_configured",
      message: "ANTHROPIC_API_KEY no esta configurada en el servidor.",
    };
  }

  const supabase = createServiceClient(env);

  const { data: agentVersion, error: versionError } = await supabase
    .from("agent_versions")
    .select("id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, agent_definitions!inner(code)")
    .eq("agent_definitions.code", "a01_analista_llamadas")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError || !agentVersion) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "agent_version_load_failed",
      detail: versionError?.message ?? "not_found",
    };
  }

  const { data: prompt, error: promptError } = await supabase
    .from("prompt_versions")
    .select("content")
    .eq("code", agentVersion.prompt_code)
    .eq("version", agentVersion.prompt_version)
    .single();

  if (promptError || !prompt) {
    return { ok: false as const, statusCode: 500, error: "prompt_version_load_failed", detail: promptError?.message };
  }

  const { data: call, error: callError } = await supabase
    .from("consulting_calls")
    .select("id, title, call_type, held_at, scheduled_at, duration_minutes")
    .eq("id", callId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (callError) {
    return { ok: false as const, statusCode: 500, error: "call_load_failed", detail: callError.message };
  }

  if (!call) {
    return { ok: false as const, statusCode: 404, error: "call_not_found" };
  }

  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("id, content, version")
    .eq("call_id", callId)
    .eq("is_current", true)
    .maybeSingle();

  if (!transcript || typeof transcript.content !== "string" || !transcript.content.trim()) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "transcript_required",
      message: "La llamada no tiene transcripcion actual: pega la transcripcion antes de generar el resumen.",
    };
  }

  const runId = crypto.randomUUID();

  const input: AgentInput = {
    run_id: runId,
    agent_code: "a01_analista_llamadas",
    agent_version: agentVersion.version,
    organization_id: organizationId,
    actor_user_id: context.user.id,
    trigger_type: "call",
    objective: `Resumen estructurado de la llamada "${call.title}" a partir de su transcripcion.`,
    entity_ids: [callId],
    allowed_tools: [],
    approval_mode: agentVersion.approval_mode as AgentInput["approval_mode"],
  };

  const { error: runInsertError } = await supabase.from("agent_runs").insert({
    id: runId,
    organization_id: organizationId,
    agent_version_id: agentVersion.id,
    actor_user_id: context.user.id,
    trigger_type: input.trigger_type,
    objective: input.objective,
  });

  if (runInsertError) {
    return { ok: false as const, statusCode: 500, error: "agent_run_create_failed", detail: runInsertError.message };
  }

  try {
    const contextBlocks = [
      {
        label: "Metadatos de la llamada",
        data: {
          title: call.title,
          call_type: call.call_type,
          held_at: call.held_at ?? call.scheduled_at,
          duration_minutes: call.duration_minutes,
        },
      },
      {
        label: `Transcripcion (version ${transcript.version})`,
        data: transcript.content,
      },
    ];

    await supabase.from("agent_context_snapshots").insert({
      run_id: runId,
      organization_id: organizationId,
      context_level: "C1",
      snapshot: { call_id: callId, transcript_id: transcript.id, transcript_version: transcript.version },
    });

    await recordStep(
      supabase,
      runId,
      organizationId,
      1,
      "context_build",
      "Contexto C1: transcripcion actual de la llamada",
      { call_id: callId, transcript_version: transcript.version },
      null,
    );

    const turn = await runAgentTurn<CallSummaryOutput>({
      apiKey: env.ANTHROPIC_API_KEY,
      model: agentVersion.model,
      systemPrompt: prompt.content,
      input,
      contextBlocks,
      outputContract: {
        jsonSchema: callSummaryJsonSchema as unknown as Record<string, unknown>,
        schema: callSummaryOutputSchema,
      },
    });

    await recordStep(
      supabase,
      runId,
      organizationId,
      2,
      "model_call",
      `Llamada al modelo ${turn.model}`,
      {
        stop_reason: turn.stopReason,
        input_tokens: turn.inputTokens,
        output_tokens: turn.outputTokens,
        model_calls: turn.modelCalls,
      },
      turn.latencyMs,
    );

    const output = turn.output;

    const { data: summaryRow, error: summaryError } = await supabase
      .from("call_ai_summaries")
      .insert({
        call_id: callId,
        organization_id: organizationId,
        run_id: runId,
        summary: output.summary,
        // key_points guarda el detalle estructurado del contrato A01; agreed_actions
        // son las decisiones. proposed_tasks se materializan al aprobar (decideSummary).
        key_points: {
          facts: output.facts,
          recommendations: output.recommendations,
          risks: output.risks,
          key_quotes: output.key_quotes,
          proposed_tasks: output.proposed_tasks,
          confidence: output.confidence,
          warnings: output.warnings,
        },
        agreed_actions: output.decisions,
        status: "pending_approval",
        authored_by: context.user.id,
      })
      .select("id, status")
      .single();

    if (summaryError || !summaryRow) {
      throw new Error(`call_summary_persist_failed: ${summaryError?.message}`);
    }

    await supabase
      .from("agent_runs")
      .update({
        status: "succeeded",
        input_tokens: turn.inputTokens,
        output_tokens: turn.outputTokens,
        cache_read_tokens: turn.cacheReadTokens,
        estimated_cost_usd: turn.estimatedCostUsd,
        latency_ms: turn.latencyMs,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      ok: true as const,
      data: {
        run_id: runId,
        summary_id: summaryRow.id,
        status: summaryRow.status,
        output,
        usage: {
          input_tokens: turn.inputTokens,
          output_tokens: turn.outputTokens,
          estimated_cost_usd: turn.estimatedCostUsd,
          latency_ms: turn.latencyMs,
        },
      },
    };
  } catch (error) {
    const message =
      error instanceof AgentOutputValidationError
        ? [error.message, error.rawText ? error.rawText.slice(0, 300) : null].filter(Boolean).join(" | raw: ")
        : error instanceof Error
          ? error.message
          : "unknown_error";

    await supabase
      .from("agent_runs")
      .update({
        status: error instanceof AgentOutputValidationError ? "rejected_output" : "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return { ok: false as const, statusCode: 502, error: "call_analyst_failed", detail: message };
  }
}

const CHAT_HISTORY_MESSAGES = 10;

/**
 * A09 (copiloto del consultor, AI-05): una vuelta de chat con sql_select y
 * search_knowledge. Solo lectura (approval_mode 'none' en el seed): nunca
 * escribe en el dominio, asi que no hay aprobacion que pedir (criterio "ver
 * vs escribir" de AI-02). El historial vive en ai_conversations/ai_messages
 * (DB-11) con RLS propia por usuario. Sin restriccion de rol: cualquier
 * miembro de la organizacion puede preguntar sobre sus propios datos.
 */
export async function runConsultantChatTurn(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  message: string,
  conversationId: string | undefined,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return { ok: false as const, statusCode: 400, error: "message_requerido" };
  }

  if (!env.ANTHROPIC_API_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "ai_runtime_not_configured",
      message: "ANTHROPIC_API_KEY no esta configurada en el servidor.",
    };
  }

  const supabase = createServiceClient(env);

  const { data: agentVersion, error: versionError } = await supabase
    .from("agent_versions")
    .select("id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, agent_definitions!inner(code)")
    .eq("agent_definitions.code", "a09_copiloto_consultor")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError || !agentVersion) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "agent_version_load_failed",
      detail: versionError?.message ?? "not_found",
    };
  }

  const { data: prompt, error: promptError } = await supabase
    .from("prompt_versions")
    .select("content")
    .eq("code", agentVersion.prompt_code)
    .eq("version", agentVersion.prompt_version)
    .single();

  if (promptError || !prompt) {
    return { ok: false as const, statusCode: 500, error: "prompt_version_load_failed", detail: promptError?.message };
  }

  // Resolver o crear la conversacion. Si llega un id, verificamos que sea del
  // usuario actual (service role bypassa RLS, asi que el chequeo es manual).
  let activeConversationId = conversationId;

  if (activeConversationId) {
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", activeConversationId)
      .eq("organization_id", organizationId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (!conversation) {
      return { ok: false as const, statusCode: 404, error: "conversation_not_found" };
    }
  } else {
    const { data: conversation, error: conversationError } = await supabase
      .from("ai_conversations")
      .insert({
        organization_id: organizationId,
        user_id: context.user.id,
        agent_code: "a09_copiloto_consultor",
        title: trimmedMessage.slice(0, 80),
      })
      .select("id")
      .single();

    if (conversationError || !conversation) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "conversation_create_failed",
        detail: conversationError?.message,
      };
    }

    activeConversationId = conversation.id;
  }

  const { data: priorMessages } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: false })
    .limit(CHAT_HISTORY_MESSAGES);

  const history = (priorMessages ?? []).reverse();

  const { error: userMessageError } = await supabase.from("ai_messages").insert({
    conversation_id: activeConversationId,
    organization_id: organizationId,
    role: "user",
    content: trimmedMessage,
  });

  if (userMessageError) {
    return { ok: false as const, statusCode: 500, error: "message_save_failed", detail: userMessageError.message };
  }

  const runId = crypto.randomUUID();

  const { tools, systemPrompt } = buildAgentTools(
    env,
    supabase,
    runId,
    organizationId,
    agentVersion.allowed_tools,
    prompt.content,
  );

  const input: AgentInput = {
    run_id: runId,
    agent_code: "a09_copiloto_consultor",
    agent_version: agentVersion.version,
    organization_id: organizationId,
    actor_user_id: context.user.id,
    trigger_type: "chat",
    objective: trimmedMessage,
    allowed_tools: tools.map((tool) => tool.name),
    approval_mode: agentVersion.approval_mode as AgentInput["approval_mode"],
  };

  const { error: runInsertError } = await supabase.from("agent_runs").insert({
    id: runId,
    organization_id: organizationId,
    agent_version_id: agentVersion.id,
    actor_user_id: context.user.id,
    trigger_type: input.trigger_type,
    objective: input.objective,
  });

  if (runInsertError) {
    return { ok: false as const, statusCode: 500, error: "agent_run_create_failed", detail: runInsertError.message };
  }

  try {
    const contextBlocks =
      history.length > 0
        ? [
            {
              label: "Conversacion previa (mas reciente al final)",
              data: history.map((entry) => ({ role: entry.role, content: entry.content })),
            },
          ]
        : [];

    const turn = await runAgentTurn<ChatOutput>({
      apiKey: env.ANTHROPIC_API_KEY,
      model: agentVersion.model,
      systemPrompt,
      input,
      contextBlocks,
      tools,
      outputContract: {
        jsonSchema: chatJsonSchema as unknown as Record<string, unknown>,
        schema: chatOutputSchema,
      },
    });

    await recordStep(
      supabase,
      runId,
      organizationId,
      1,
      "model_call",
      `Llamada al modelo ${turn.model}`,
      {
        stop_reason: turn.stopReason,
        input_tokens: turn.inputTokens,
        output_tokens: turn.outputTokens,
        model_calls: turn.modelCalls,
        tool_calls: turn.toolCallCount,
      },
      turn.latencyMs,
    );

    const { error: assistantMessageError } = await supabase.from("ai_messages").insert({
      conversation_id: activeConversationId,
      organization_id: organizationId,
      role: "assistant",
      content: turn.output.answer,
      run_id: runId,
    });

    if (assistantMessageError) {
      throw new Error(`assistant_message_save_failed: ${assistantMessageError.message}`);
    }

    await supabase
      .from("agent_runs")
      .update({
        status: "succeeded",
        input_tokens: turn.inputTokens,
        output_tokens: turn.outputTokens,
        cache_read_tokens: turn.cacheReadTokens,
        estimated_cost_usd: turn.estimatedCostUsd,
        latency_ms: turn.latencyMs,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      ok: true as const,
      data: {
        conversation_id: activeConversationId,
        run_id: runId,
        output: turn.output,
        usage: {
          input_tokens: turn.inputTokens,
          output_tokens: turn.outputTokens,
          estimated_cost_usd: turn.estimatedCostUsd,
          latency_ms: turn.latencyMs,
        },
      },
    };
  } catch (error) {
    const message =
      error instanceof AgentOutputValidationError
        ? [error.message, error.rawText ? error.rawText.slice(0, 300) : null].filter(Boolean).join(" | raw: ")
        : error instanceof Error
          ? error.message
          : "unknown_error";

    await supabase
      .from("agent_runs")
      .update({
        status: error instanceof AgentOutputValidationError ? "rejected_output" : "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return { ok: false as const, statusCode: 502, error: "chat_turn_failed", detail: message };
  }
}

/**
 * Conversaciones del copiloto para el usuario actual en una organizacion
 * (para listarlas o recargar el historial al volver a la pagina).
 */
export async function listConsultantChatConversations(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    return { ok: false as const, statusCode: 500, error: "conversations_load_failed", detail: error.message };
  }

  return { ok: true as const, data: { conversations: data ?? [] } };
}

/** Mensajes de una conversacion del copiloto (para recargar el historial). */
export async function getConsultantChatMessages(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  conversationId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (!conversation) {
    return { ok: false as const, statusCode: 404, error: "conversation_not_found" };
  }

  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false as const, statusCode: 500, error: "messages_load_failed", detail: error.message };
  }

  return { ok: true as const, data: { conversation_id: conversationId, messages: data ?? [] } };
}

/**
 * Decision humana sobre una salida (politica de aprobacion AI-00). Al aprobar,
 * las proposed_writes de tipo task se materializan como tareas reales: es la
 * unica via por la que una ejecucion IA escribe en el dominio.
 */
export async function decideAgentOutput(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  outputId: string,
  decisionInput: string | undefined,
  reason: string | undefined,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const canDecide =
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    ["owner", "manager"].includes(access.membership.role);

  if (!canDecide) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "approval_denied",
      message: "Solo owner, manager, consultor o platform admin pueden aprobar salidas IA.",
    };
  }

  if (!decisionInput || !["approved", "rejected"].includes(decisionInput)) {
    return { ok: false as const, statusCode: 400, error: "invalid_decision" };
  }

  const supabase = createServiceClient(env);

  const { data: output, error } = await supabase
    .from("agent_outputs")
    .update({
      status: decisionInput,
      ...(decisionInput === "approved" ? { published_at: new Date().toISOString() } : {}),
    })
    .eq("id", outputId)
    .eq("organization_id", organizationId)
    .eq("status", "pending_approval")
    .select("id, output, run_id")
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "output_decision_failed", detail: error.message };
  }

  if (!output) {
    return { ok: false as const, statusCode: 404, error: "pending_output_not_found" };
  }

  await supabase.from("agent_approvals").insert({
    output_id: outputId,
    organization_id: organizationId,
    decision: decisionInput,
    decided_by: context.user.id,
    reason: reason ?? null,
  });

  let tasksCreated = 0;

  if (decisionInput === "approved") {
    const proposedWrites = (output.output as { proposed_writes?: Array<Record<string, unknown>> })
      .proposed_writes ?? [];

    const agentCode = await resolveAgentCodeForRun(supabase, output.run_id);
    const category = agentCode ? (AGENT_TASK_CATEGORY[agentCode] ?? "general") : "general";

    for (const write of proposedWrites) {
      if (write.kind !== "task") {
        continue;
      }

      const { error: taskError } = await supabase.from("tasks").insert({
        organization_id: organizationId,
        source: "ai_consultant",
        priority: typeof write.priority === "string" ? write.priority : "medium",
        title: String(write.title ?? "Tarea propuesta por IA").slice(0, 255),
        description: typeof write.description === "string" ? write.description : null,
        created_by: context.user.id,
        metadata: { agent_output_id: outputId },
        category,
      });

      if (!taskError) {
        tasksCreated += 1;
      }
    }
  }

  return { ok: true as const, data: { id: outputId, status: decisionInput, tasks_created: tasksCreated } };
}

export async function listAgentRuns(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("agent_runs")
    .select(
      "id, trigger_type, objective, status, input_tokens, output_tokens, estimated_cost_usd, latency_ms, error_message, started_at, finished_at, agent_outputs(id, status, approval_required, output, published_at)",
    )
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return { ok: false as const, statusCode: 500, error: "agent_runs_load_failed", detail: error.message };
  }

  return { ok: true as const, data: { organization_id: organizationId, runs: data ?? [] } };
}
