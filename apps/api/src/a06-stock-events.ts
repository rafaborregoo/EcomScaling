import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { z } from "zod";
import type { AuthContext } from "./auth-context.js";
import {
  buildPlatformAdminContext,
  createServiceClient,
  isAgentAutorunEnabled,
  runStockPlannerAgent,
} from "./ai-runtime.js";
import {
  defaultAgentModel,
  loadPlatformAgentSettings,
  resolveAgentModel,
} from "./agent-schedule.js";
import { enrichStockRiskEvidence } from "./stock-risk-evidence.js";
import {
  a06StockEventExamples,
  evaluateA06StockEvent,
  type A06InventoryChange,
} from "./a06-stock-event-policy.js";

export type A06StockEventContext = {
  evaluation_id: string;
  observed_changes: A06InventoryChange[];
  signals: ReturnType<typeof evaluateA06StockEvent>["signals"];
  coverage_review_days: number;
};
type EventJob = {
  store_id: string;
  organization_id: string;
  revision: number;
  lease_token: string;
  changes: Record<string, A06InventoryChange>;
  last_model_at: string | null;
  last_model_signature: string | null;
};
const configSchema = z
  .object({
    store_id: z.string().uuid(),
    mode: z.enum(["off", "shadow", "live"]).default("shadow"),
    coverage_review_days: z.number().min(0.25).max(90).default(3),
    cooldown_minutes: z.number().int().min(1).max(1440).default(15),
    daily_model_cap: z.number().int().min(1).max(100).default(4),
  })
  .strict();
function check(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`a06_event_${operation}_failed: ${error.message}`);
}
function signature(value: string | null) {
  return value === null
    ? null
    : createHash("sha256").update(value).digest("hex");
}

/** One fenced store claim. Exported to exercise the real database path without a paid model. */
export async function processA06StockEvent(
  env: LoadedApiEnv,
  db: SupabaseClient,
  job: EventJob,
  execute?: (
    context: A06StockEventContext,
    beforeModel: () => Promise<void>,
  ) => Promise<{ ok: boolean; data?: { run_id: string }; error?: string }>,
) {
  const { data: settings, error: settingsError } = await db
    .from("a06_stock_event_settings")
    .select("*")
    .eq("store_id", job.store_id)
    .eq("organization_id", job.organization_id)
    .single();
  check(settingsError, "settings");
  const finish = async (
    retryAt: string | null,
    modelSignature: string | null,
    modelRan = false,
  ) => {
    const { data, error } = await db.rpc("finish_a06_stock_event", {
      target_store_id: job.store_id,
      claim_token: job.lease_token,
      claim_revision: job.revision,
      retry_at: retryAt,
      model_signature: modelSignature,
      model_ran: modelRan,
    });
    check(error, "finish");
    if (!data) throw new Error("a06_event_claim_lost");
  };
  if (!settings || settings.mode === "off") {
    await finish(null, null);
    return { decision: "off" };
  }
  const { data: store, error: storeError } = await db
    .from("shopify_stores")
    .select("id, connection_id")
    .eq("id", job.store_id)
    .eq("organization_id", job.organization_id)
    .eq("is_active", true)
    .maybeSingle();
  check(storeError, "store");
  if (!store?.connection_id) {
    await finish(null, null);
    return { decision: "store_inactive" };
  }
  const now = new Date(),
    periodStart = new Date(now.getTime() - 30 * 86_400_000);
  const changes = Object.values(job.changes);
  const [
    { data: risk, error: riskError },
    { data: levels, error: levelError },
  ] = await Promise.all([
    db.rpc("shopify_stock_risk_products_a06", {
      target_organization_id: job.organization_id,
      target_store_id: job.store_id,
      period_start: periodStart.toISOString(),
      period_end: now.toISOString(),
    }),
    db
      .from("shopify_inventory_current_state")
      .select("id, available_quantity, is_active, updated_at")
      .eq("organization_id", job.organization_id)
      .in(
        "id",
        changes.map((change) => change.inventory_state_id),
      ),
  ]);
  check(riskError, "risk");
  check(levelError, "levels");
  // Events explain why we woke up; the current inventory remains the source of truth.
  const currentLevels = new Map(
    (levels ?? []).map((level) => [level.id, level]),
  );
  const currentChanges = changes.map((change) => {
    const current = currentLevels.get(change.inventory_state_id);
    const fresh =
      current &&
      Date.parse(current.updated_at) >= now.getTime() - 48 * 3_600_000 &&
      Date.parse(current.updated_at) <= now.getTime() + 5 * 60_000;
    return {
      ...change,
      available_quantity:
        fresh && current.is_active ? current.available_quantity : null,
    };
  });
  const products = enrichStockRiskEvidence(risk ?? [], {
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    now: now.getTime(),
  });
  const gate = evaluateA06StockEvent(
    currentChanges,
    products,
    Number(settings.coverage_review_days),
  );
  const signalHash = signature(gate.signature);
  const attemptKey = `a06-stock-event:${job.store_id}:${job.revision}`;
  // Recover a run persisted before a process crash/failed acknowledgement.
  // A retry of the same inventory revision must not buy the same analysis twice.
  const { data: recoveredRun, error: recoveryError } = await db
    .from("agent_runs")
    .select("id")
    .eq("organization_id", job.organization_id)
    .eq("store_id", job.store_id)
    .eq("trigger_type", "webhook")
    .eq("activity_digest", attemptKey)
    .eq("status", "succeeded")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(recoveryError, "recovery");
  if (recoveredRun) {
    const { error } = await db
      .from("a06_stock_event_evaluations")
      .update({
        decision: "completed",
        run_id: recoveredRun.id,
        finished_at: new Date().toISOString(),
      })
      .eq("store_id", job.store_id)
      .eq("revision", job.revision)
      .eq("decision", "running");
    check(error, "recover_evaluation");
    await finish(null, signalHash, true);
    return { decision: "recovered", run_id: recoveredRun.id };
  }
  const { data: evaluation, error: insertError } = await db
    .from("a06_stock_event_evaluations")
    .insert({
      organization_id: job.organization_id,
      store_id: job.store_id,
      revision: job.revision,
      mode: settings.mode,
      decision: "evaluating",
      evidence: {
        changes: currentChanges,
        ...gate,
        coverage_review_days: Number(settings.coverage_review_days),
        context_strategy: "full_a06_context",
        threshold_meaning: "review_only_not_a_reorder_point",
      },
    })
    .select("id")
    .single();
  check(insertError, "evaluation_insert");
  if (!evaluation) throw new Error("a06_event_evaluation_missing");
  const record = async (
    decision: string,
    retryAt: string | null = null,
    runId: string | null = null,
    errorCode: string | null = null,
    modelRan = false,
  ) => {
    const { error } = await db
      .from("a06_stock_event_evaluations")
      .update({
        decision,
        run_id: runId,
        error_code: errorCode,
        finished_at: new Date().toISOString(),
      })
      .eq("id", evaluation.id);
    check(error, "evaluation_update");
    await finish(retryAt, signalHash, modelRan);
    return { decision, evaluation_id: evaluation.id, run_id: runId };
  };
  if (!gate.shouldReview) return record("no_material_change");
  if (signalHash === job.last_model_signature) return record("same_signal");
  if (settings.mode === "shadow") return record("would_review");
  if (!execute && !env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY)
    return record(
      "provider_not_configured",
      new Date(now.getTime() + 30 * 60_000).toISOString(),
    );
  if (!isAgentAutorunEnabled(env))
    return record(
      "autorun_disabled",
      new Date(now.getTime() + 30 * 60_000).toISOString(),
    );
  const cooldownUntil = job.last_model_at
    ? Date.parse(job.last_model_at) + Number(settings.cooldown_minutes) * 60_000
    : 0;
  if (cooldownUntil > now.getTime())
    return record("cooldown", new Date(cooldownUntil).toISOString());
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count, error: capError } = await db
    .from("a06_stock_event_evaluations")
    .select("id", { count: "exact", head: true })
    .eq("store_id", job.store_id)
    .eq("mode", "live")
    .in("decision", ["running", "completed", "failed"])
    .gte("created_at", dayStart.toISOString());
  check(capError, "daily_cap");
  if ((count ?? 0) >= settings.daily_model_cap)
    return record(
      "daily_cap",
      new Date(dayStart.getTime() + 86_400_000).toISOString(),
    );
  const { error: runningError } = await db
    .from("a06_stock_event_evaluations")
    .update({ decision: "running" })
    .eq("id", evaluation.id);
  check(runningError, "running");
  const eventContext: A06StockEventContext = {
    evaluation_id: evaluation.id,
    observed_changes: currentChanges,
    signals: gate.signals,
    coverage_review_days: Number(settings.coverage_review_days),
  };
  const beforeModel = async () => {
    const { data: claim, error } = await db
      .from("a06_stock_event_queue")
      .select("revision, lease_token, lease_until")
      .eq("store_id", job.store_id)
      .single();
    check(error, "lease");
    if (
      !claim ||
      claim.lease_token !== job.lease_token ||
      claim.revision !== job.revision ||
      Date.parse(claim.lease_until) <= Date.now()
    )
      throw new Error("a06_event_changed_before_model");
    const { data: currentConfig, error: configError } = await db
      .from("a06_stock_event_settings")
      .select("mode")
      .eq("store_id", job.store_id)
      .single();
    check(configError, "mode");
    if (currentConfig?.mode !== "live")
      throw new Error("a06_event_live_disabled");
  };
  try {
    let result;
    if (execute) result = await execute(eventContext, beforeModel);
    else {
      const context = await buildPlatformAdminContext(env);
      if (!context.ok) throw new Error("a06_event_admin_context_unavailable");
      result = await runStockPlannerAgent(
        env,
        context.context,
        job.organization_id,
        store.connection_id,
        30,
        {
          trigger: "webhook",
          enforceManualRefreshCap: false,
          activityDigest: attemptKey,
          stockEvent: eventContext,
          beforeModel,
        },
      );
    }
    if (!result.ok)
      return record(
        "failed",
        new Date(Date.now() + 15 * 60_000).toISOString(),
        null,
        result.error ?? "a06_event_run_failed",
      );
    return record("completed", null, result.data?.run_id ?? null, null, true);
  } catch (error) {
    return record(
      "failed",
      new Date(Date.now() + 5 * 60_000).toISOString(),
      null,
      error instanceof Error
        ? error.message.slice(0, 180)
        : "a06_event_unknown_error",
    );
  }
}

export async function runA06StockEventTick(env: LoadedApiEnv) {
  const db = createServiceClient(env);
  // A single store per request bounds latency and keeps the claim lease meaningful.
  const { data: jobs, error } = await db.rpc("claim_a06_stock_events", {
    batch_size: 1,
  });
  check(error, "claim");
  const results = [];
  for (const job of jobs ?? []) {
    try {
      results.push(await processA06StockEvent(env, db, job));
    } catch (error) {
      // A crashed evaluation remains leased and is retried after expiry; no event is acknowledged away.
      results.push({
        decision: "error",
        store_id: job.store_id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return { ok: true as const, processed: results.length, results };
}

export async function getAdminA06StockEvents(
  env: LoadedApiEnv,
  context: AuthContext,
) {
  if (context.profile.platform_role !== "platform_admin")
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
    };
  const db = createServiceClient(env);
  const [settings, evaluations, stores, version, platform, pending] =
    await Promise.all([
      db.from("a06_stock_event_settings").select("*"),
      db
        .from("a06_stock_event_evaluations")
        .select(
          "*, agent_runs(id, status, input_tokens, output_tokens, estimated_cost_usd)",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("shopify_stores")
        .select("id, organization_id, shop_name")
        .eq("is_active", true)
        .order("shop_name")
        .limit(100),
      db
        .from("agent_versions")
        .select("model, agent_definitions!inner(code)")
        .eq("agent_definitions.code", "a06_planificador_stock")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadPlatformAgentSettings(db, "a06_planificador_stock"),
      db
        .from("a06_stock_event_queue")
        .select("store_id, revision, processed_revision, due_at, lease_until"),
    ]);
  const missing =
    settings.error?.code === "42P01" || settings.error?.code === "PGRST205";
  if (missing)
    return {
      ok: true as const,
      data: {
        available: false as const,
        message:
          "Falta aplicar la migración del piloto de eventos A06 en este entorno.",
        examples: a06StockEventExamples(),
      },
    };
  for (const [name, result] of Object.entries({
    settings,
    evaluations,
    stores,
    version,
    pending,
  }))
    check(result.error, `admin_${name}`);
  const currentModel = version.data
    ? resolveAgentModel({
        agentCode: "a06_planificador_stock",
        versionModel: version.data.model,
        clientModel: null,
        platformModel: platform.get("a06_planificador_stock")?.model,
      })
    : defaultAgentModel("a06_planificador_stock", "gpt-6-luna");
  return {
    ok: true as const,
    data: {
      available: true as const,
      settings: settings.data ?? [],
      evaluations: evaluations.data ?? [],
      stores: stores.data ?? [],
      queue: pending.data ?? [],
      current_model: currentModel,
      autorun_enabled: isAgentAutorunEnabled(env),
      provider_configured: Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY),
      examples: a06StockEventExamples(),
      sampling:
        "Últimas 100 evaluaciones; los importes son costes registrados de las ejecuciones enlazadas, no de toda la cuenta.",
    },
  };
}

export async function setAdminA06StockEventSettings(
  env: LoadedApiEnv,
  context: AuthContext,
  body: unknown,
) {
  if (context.profile.platform_role !== "platform_admin")
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
    };
  const parsed = configSchema.safeParse(body);
  if (!parsed.success)
    return {
      ok: false as const,
      statusCode: 400,
      error: "a06_event_settings_invalid",
    };
  if (
    parsed.data.mode === "live" &&
    !env.ANTHROPIC_API_KEY &&
    !env.OPENAI_API_KEY
  )
    return {
      ok: false as const,
      statusCode: 409,
      error: "a06_event_provider_required",
      message:
        "El análisis automático necesita una API de OpenAI o Anthropic. Puedes observar los cambios sin API.",
    };
  const db = createServiceClient(env);
  const { data: store, error: storeError } = await db
    .from("shopify_stores")
    .select("id, organization_id")
    .eq("id", parsed.data.store_id)
    .eq("is_active", true)
    .maybeSingle();
  check(storeError, "settings_store");
  if (!store)
    return {
      ok: false as const,
      statusCode: 404,
      error: "a06_event_store_not_found",
    };
  const { error } = await db.from("a06_stock_event_settings").upsert(
    {
      ...parsed.data,
      organization_id: store.organization_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id" },
  );
  check(error, "settings_save");
  return { ok: true as const, data: { saved: true } };
}
