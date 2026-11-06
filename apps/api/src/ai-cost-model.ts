/**
 * Costes de IA (platform admin): por agente, cuantos tokens gasta una
 * ejecucion, cuantas veces corre al dia por cliente y con que modelo. El panel
 * simula cambios y, al aplicarlos, los guarda en `platform_ai_agent_settings`,
 * que leen el orquestador (cadencia) y el runtime (modelo).
 *
 * Tokens por ejecucion: medidos en produccion (ultimos 30 dias) cuando hay al
 * menos MIN_MEASURED_RUNS ejecuciones correctas con tokens; si no, la linea base
 * medida en el entorno de pruebas con las versiones actuales (`BASELINE`).
 */
import { createClient } from "@supabase/supabase-js";
import { A17_MODEL_DECISION } from "@e-nora/contracts";
import { z } from "zod";
import { A01_MODEL_DECISION, A02_MODEL_DECISION, A04_MODEL_DECISION, A05_MODEL_DECISION, A06_MODEL_DECISION, A08_MODEL_DECISION, A12_MODEL_DECISION, A13_MODEL_DECISION, A14_MODEL_DECISION, A15_MODEL_DECISION, A16_MODEL_DECISION, A19_MODEL_DECISION, getAgentModelDecision } from "@e-nora/contracts";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { COPILOT_CREDITS_PER_USD, COPILOT_DEFAULT_MONTHLY_CREDITS } from "@e-nora/contracts";
import { COPILOT_MODELS } from "./copilot-tokens.js";
import { copilotModelConsumption } from "./copilot-saldo.js";
import { refreshLiveModelPricing } from "./ai-model-pricing.js";
import {
  AGENT_MODEL_IDS,
  COPILOT_AGENT_CODE,
  DESIGN_RUNS_PER_DAY,
  defaultAgentModel,
  resolveAgentModel,
  loadPlatformAgentSettings,
} from "./agent-schedule.js";
import { MONITOR_CADENCES, PANEL_MIN_RUN_AGE_MS, orchestratorMinRunAgeFor } from "./ai-runtime.js";

const MIN_MEASURED_RUNS = 3;
/** El orquestador pasa dos veces al dia: por debajo de ~12 h de intervalo no corre mas. */
const TICK_SPACING_MS = 12 * 60 * 60 * 1000;

/** Precios verificados por modelo; USD por millon de tokens. */
const OFFICIAL_PRICES_CHECKED = "2026-10-28";
const MODELS = [
  { id: A06_MODEL_DECISION.model, label: A06_MODEL_DECISION.label, provider: "anthropic", input: 0.1, output: 0.5, cache_read: 0.01, long_context_threshold: 100000, long_input_multiplier: 5, long_output_multiplier: 5, verified_on: "2026-10-28" },
  { id: "claude-sonnet-5", label: "Sonnet 5", provider: "anthropic", input: 2, output: 10, cache_read: 0.2 },
  { id: "claude-opus-5", label: "Opus 5", provider: "anthropic", input: 5, output: 25, cache_read: 0.5 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic", input: 2, output: 10, cache_read: 0.1, verified_on: "2026-10-28" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic", input: 4, output: 20, cache_read: 0.2, verified_on: "2026-10-28" },
  { id: "gpt-6-sol", label: "GPT-6 Sol", provider: "openai", input: 2, output: 10, cache_read: 0.2 },
  { id: A01_MODEL_DECISION.model, label: A01_MODEL_DECISION.label, provider: "openai", input: 2, output: 10, cache_read: 0.1, long_context_threshold: 272000, long_input_multiplier: 2, long_output_multiplier: 1.5, verified_on: "2026-10-28" },
  { id: A04_MODEL_DECISION.model, label: A04_MODEL_DECISION.label, provider: "openai", input: 1, output: 5, cache_read: 0.05, long_context_threshold: 272000, long_input_multiplier: 2, long_output_multiplier: 1.5, verified_on: "2026-10-28" },
  { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "openai", input: 0.1, output: 0.5, cache_read: 0.01 },
] as const;

type Profile = { input_total: number; cache_read: number; output: number };

/** Media por ejecucion correcta en pruebas (la entrada total incluye la cache leida). */
const BASELINE: Record<string, Profile> = {
  a01_analista_llamadas: { input_total: A01_MODEL_DECISION.benchmarks[1].inputTokens, cache_read: A01_MODEL_DECISION.benchmarks[1].cacheReadTokens ?? 0, output: A01_MODEL_DECISION.benchmarks[1].outputTokens },
  a02_monitor_negocio: A02_MODEL_DECISION.benchmarkProfile,
  a04_generador_tareas: A04_MODEL_DECISION.benchmarkProfile,
  a05_estrategia_campanas: A05_MODEL_DECISION.benchmarkProfile,
  a06_planificador_stock: A06_MODEL_DECISION.benchmarkProfile,
  a08_gestor_conocimiento: A08_MODEL_DECISION.benchmarkProfile,
  a09_copiloto_consultor: { input_total: 152693, cache_read: 117377, output: 2911 },
  a11_generador_marketing: { input_total: 74001, cache_read: 55031, output: 2872 },
  a12_analista_email: A12_MODEL_DECISION.benchmarkProfile,
  a13_operativa_shopify: A13_MODEL_DECISION.benchmarkProfile,
  a14_operativa_meta: A14_MODEL_DECISION.benchmarkProfile,
  a15_analista_imagenes: A15_MODEL_DECISION.benchmarkProfile,
  a16_texto_sobre_imagen: A16_MODEL_DECISION.benchmarkProfile,
  a17_plan_semanal: A17_MODEL_DECISION.benchmarkProfile,
  a18_plan_mensual: { input_total: 15582, cache_read: 0, output: 477 },
  a19_arquitecto_camino: A19_MODEL_DECISION.benchmarkProfile,
  a19_revision_camino: { input_total: 16169, cache_read: 0, output: 1757 },
  a20_retencion_clientes: { input_total: 446049, cache_read: 375115, output: 1131 },
  a21_adquisicion_shopify: { input_total: 50608, cache_read: 20843, output: 2104 },
  a22_postventa_shopify: { input_total: 40798, cache_read: 18261, output: 970 },
  a23_creatividad_meta: { input_total: 46095, cache_read: 26068, output: 966 },
  a24_medicion_meta: { input_total: 16019, cache_read: 0, output: 956 },
  a25_cambios_meta: { input_total: 12947, cache_read: 0, output: 337 },
  a26_contenido_email: { input_total: 41738, cache_read: 16393, output: 654 },
  a27_planificador_mailing: { input_total: 36747, cache_read: 16032, output: 4453 },
  a28_arquitecto_flujos: { input_total: 38739, cache_read: 15491, output: 1789 },
  a29_analista_metrica: { input_total: 18589, cache_read: 3742, output: 3244 },
};

/** Intervalo de diseno mas corto del agente (A02 tiene varias ventanas). */
function shortestDesignIntervalMs(agentCode: string): number {
  return agentCode === "a02_monitor_negocio"
    ? Math.min(...MONITOR_CADENCES.map((cadence) => cadence.minRunAgeMs))
    : orchestratorMinRunAgeFor(agentCode);
}

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const forbidden = (context: AuthContext) =>
  context.profile.platform_role !== "platform_admin"
    ? { ok: false as const, statusCode: 403, error: "platform_admin_required", message: "Solo un administrador de la plataforma puede gestionar los costes de IA." }
    : null;

export async function getAdminAiCostModel(env: LoadedApiEnv, context: AuthContext) {
  const denied = forbidden(context);
  if (denied) return denied;
  await refreshLiveModelPricing(env);
  const supabase = serviceClient(env);
  const [versions, profiles, prices, settings] = await Promise.all([
    supabase.from("agent_versions").select("model, agent_definitions!inner(code, name)").eq("is_active", true),
    supabase.rpc("admin_ai_run_profile", { since: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
    supabase.from("ai_model_prices").select("model, input_per_mtok, output_per_mtok, cache_read_per_mtok").in("model", MODELS.map((model) => model.id)),
    loadPlatformAgentSettings(supabase),
  ]);
  if (versions.error) return { ok: false as const, statusCode: 500, error: "ai_cost_model_load_failed", detail: versions.error.message };
  if (profiles.error) return { ok: false as const, statusCode: 500, error: "ai_cost_model_load_failed", detail: profiles.error.message };

  const livePrice = new Map((prices.data ?? []).map((row) => [row.model as string, row]));
  const models = MODELS.map((model) => {
    const live = livePrice.get(model.id);
    return {
      ...model,
      input: Number(live?.input_per_mtok ?? model.input),
      output: Number(live?.output_per_mtok ?? model.output),
      cache_read: Number(live?.cache_read_per_mtok ?? model.cache_read),
    };
  });

  const measured = new Map(((profiles.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.agent_code), row]));
  const agents = ((versions.data ?? []) as unknown as Array<{ model: string; agent_definitions: { code: string; name: string } }>)
    .map((row) => {
      const code = row.agent_definitions.code;
      const decision = getAgentModelDecision(code);
      // La RPC histórica agrupa por agente, no por modelo: no atribuir uso anterior a Sol.
      const live = decision ? undefined : measured.get(code);
      const base = BASELINE[code];
      const profile =
        live !== undefined && Number(live.run_count) >= MIN_MEASURED_RUNS
          ? {
              input_total: Number(live.avg_input_total),
              cache_read: Number(live.avg_cache_read),
              output: Number(live.avg_output),
              samples: Number(live.run_count),
              source: "medido" as const,
            }
          : { ...(base ?? { input_total: 0, cache_read: 0, output: 0 }), samples: 0, source: base ? ("estimado" as const) : ("sin_datos" as const) };
      const design = DESIGN_RUNS_PER_DAY[code] ?? { runs: 0, scheduled: false, cadence: "sin cadencia definida" };
      const saved = settings.get(code);
      return {
        code,
        name: row.agent_definitions.name,
        // Nunca sustituir un ID desconocido por un modelo distinto al calcular costes.
        version_model: row.model,
        runtime_default_model: defaultAgentModel(code, row.model),
        default_model: defaultAgentModel(code, row.model),
        effective_model: resolveAgentModel({ agentCode: code, versionModel: row.model, clientModel: null, platformModel: saved?.model }),
        model_decision: decision,
        model_configurable: code !== COPILOT_AGENT_CODE && !decision,
        scheduled: design.scheduled,
        default_runs_per_day: design.runs,
        // El ajuste escala dashboards; el panel del consultor tiene ciclo propio.
        additional_runs_per_day: code === "a02_monitor_negocio" ? Math.min(2, 24 * 60 * 60 * 1000 / PANEL_MIN_RUN_AGE_MS) : 0,
        max_runs_per_day: code === "a02_monitor_negocio" ? null : design.scheduled
          ? Math.round(((design.runs * shortestDesignIntervalMs(code)) / TICK_SPACING_MS) * 100) / 100
          : null,
        cadence: design.cadence,
        saved: { runs_per_day: saved?.runs_per_day ?? null, model: saved?.model ?? null },
        profile,
      };
    })
    .sort((a, b) => Number(b.scheduled) - Number(a.scheduled) || a.code.localeCompare(b.code));

  return {
    ok: true as const,
    data: {
      models,
      copilot_credit_policy: {
        monthly_credits: COPILOT_DEFAULT_MONTHLY_CREDITS,
        credits_per_usd: COPILOT_CREDITS_PER_USD,
        monthly_budget_usd: COPILOT_DEFAULT_MONTHLY_CREDITS / COPILOT_CREDITS_PER_USD,
        models: COPILOT_MODELS.filter(model => model.selectable).map(model => ({
          id: model.anthropicModel, label: model.label, ...copilotModelConsumption(model),
        })),
      },
      agents,
      caps: { org_daily_run_cap: env.AI_ORG_DAILY_RUN_CAP ?? 12, platform_runs_per_tick: env.AI_DIAGNOSTICS_MAX_RUNS_PER_TICK ?? 15, ticks_per_day: 2, panel_runs_per_tick: 20 },
      monitor_operation: {
        design_client_runs_per_day: DESIGN_RUNS_PER_DAY.a02_monitor_negocio!.runs,
        saved_client_runs_per_day: settings.get("a02_monitor_negocio")?.runs_per_day ?? null,
        cadences: MONITOR_CADENCES.map(cadence => ({lookback_days: cadence.lookbackDays, min_run_age_hours: cadence.minRunAgeMs / 3600000})),
        panel_min_run_age_hours: PANEL_MIN_RUN_AGE_MS / 3600000,
        ticks_per_day: 2,
        org_daily_run_cap: env.AI_ORG_DAILY_RUN_CAP ?? 12,
      },
      prices_verified_on: OFFICIAL_PRICES_CHECKED,
      generated_at: new Date().toISOString(),
    },
  };
}

const settingsSchema = z.object({
  settings: z
    .array(
      z.object({
        agent_code: z.string().min(1).max(80),
        runs_per_day: z.number().min(0).max(48).nullable(),
        model: z.enum(AGENT_MODEL_IDS).nullable(),
      }),
    )
    .max(100),
});

/**
 * Aplica la cadencia y el modelo de cada agente. Ejecuciones/dia solo cuentan
 * en agentes programados; el modelo, en todos salvo el copiloto. Un agente sin
 * nada distinto al diseno se borra de la tabla.
 */
export async function setAdminAiAgentSettings(env: LoadedApiEnv, context: AuthContext, payload: unknown) {
  const denied = forbidden(context);
  if (denied) return denied;
  const parsed = settingsSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, statusCode: 400, error: "invalid_ai_agent_settings", detail: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  }
  for (const item of parsed.data.settings) {
    if (item.runs_per_day !== null && !DESIGN_RUNS_PER_DAY[item.agent_code]?.scheduled) {
      return { ok: false as const, statusCode: 400, error: "agent_not_scheduled", message: `${item.agent_code} no se programa: sus ejecuciones dependen de quien lo usa.` };
    }
    if (item.model !== null && item.agent_code === COPILOT_AGENT_CODE) {
      return { ok: false as const, statusCode: 400, error: "copilot_model_by_plan", message: "El modelo del copiloto lo decide el plan y el saldo." };
    }
    const decision = getAgentModelDecision(item.agent_code);
    if (decision && item.model !== null && item.model !== decision.model)
      return { ok: false as const, statusCode: 400, error: "agent_model_fixed", message: `${decision.agentCode} tiene ${decision.label} asignado en el laboratorio${decision.status === "closed" ? " con revisión cerrada" : " de forma provisional"}.` };
  }

  const supabase = serviceClient(env);
  const before = await loadPlatformAgentSettings(supabase);
  const now = new Date().toISOString();
  const upserts = parsed.data.settings
    .filter((item) => item.runs_per_day !== null || item.model !== null)
    .map((item) => ({ agent_code: item.agent_code, runs_per_day: item.runs_per_day, model: item.model, updated_by: context.user.id, updated_at: now }));
  const cleared = parsed.data.settings.filter((item) => item.runs_per_day === null && item.model === null).map((item) => item.agent_code);

  if (upserts.length) {
    const { error } = await supabase.from("platform_ai_agent_settings").upsert(upserts, { onConflict: "agent_code" });
    if (error) return { ok: false as const, statusCode: 500, error: "ai_agent_settings_save_failed", detail: error.message };
  }
  if (cleared.length) {
    const { error } = await supabase.from("platform_ai_agent_settings").delete().in("agent_code", cleared);
    if (error) return { ok: false as const, statusCode: 500, error: "ai_agent_settings_save_failed", detail: error.message };
  }
  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "platform.ai_agent_settings_updated",
    entityType: "platform_ai_agent_settings",
    oldData: Object.fromEntries(before),
    newData: parsed.data.settings,
  });
  return { ok: true as const, data: { saved: upserts.length, cleared: cleared.length } };
}
