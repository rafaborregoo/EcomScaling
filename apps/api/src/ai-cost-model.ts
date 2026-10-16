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
import { z } from "zod";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import {
  AGENT_MODEL_IDS,
  COPILOT_AGENT_CODE,
  DESIGN_RUNS_PER_DAY,
  defaultAgentModel,
  loadPlatformAgentSettings,
} from "./agent-schedule.js";
import { MONITOR_CADENCES, orchestratorMinRunAgeFor } from "./ai-runtime.js";

const MIN_MEASURED_RUNS = 3;
/** El orquestador pasa dos veces al dia: por debajo de ~12 h de intervalo no corre mas. */
const TICK_SPACING_MS = 12 * 60 * 60 * 1000;

/** Precios verificados contra platform.claude.com y developers.openai.com el 2026-10-16. USD por millon de tokens. */
const OFFICIAL_PRICES_CHECKED = "2026-10-16";
const MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5", provider: "anthropic", input: 2, output: 10, cache_read: 0.2 },
  { id: "claude-opus-5", label: "Opus 5", provider: "anthropic", input: 5, output: 25, cache_read: 0.5 },
  { id: "gpt-6-sol", label: "GPT-6 Sol", provider: "openai", input: 2, output: 10, cache_read: 0.2 },
  { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "openai", input: 0.1, output: 0.5, cache_read: 0.01 },
] as const;

type Profile = { input_total: number; cache_read: number; output: number };

/** Media por ejecucion correcta en pruebas (la entrada total incluye la cache leida). */
const BASELINE: Record<string, Profile> = {
  a01_analista_llamadas: { input_total: 825, cache_read: 0, output: 1766 },
  a02_monitor_negocio: { input_total: 28530, cache_read: 4686, output: 5722 },
  a04_generador_tareas: { input_total: 27195, cache_read: 11579, output: 541 },
  a05_estrategia_campanas: { input_total: 48413, cache_read: 16354, output: 1552 },
  a06_planificador_stock: { input_total: 15712, cache_read: 7987, output: 2436 },
  a08_gestor_conocimiento: { input_total: 15892, cache_read: 6671, output: 3707 },
  a09_copiloto_consultor: { input_total: 152693, cache_read: 117377, output: 2911 },
  a11_generador_marketing: { input_total: 74001, cache_read: 55031, output: 2872 },
  a12_analista_email: { input_total: 27918, cache_read: 11020, output: 3014 },
  a13_operativa_shopify: { input_total: 14392, cache_read: 809, output: 657 },
  a14_operativa_meta: { input_total: 38692, cache_read: 17554, output: 583 },
  a15_analista_imagenes: { input_total: 1626, cache_read: 0, output: 284 },
  a16_texto_sobre_imagen: { input_total: 1955, cache_read: 0, output: 148 },
  a17_plan_semanal: { input_total: 12187, cache_read: 2669, output: 1787 },
  a18_plan_mensual: { input_total: 15582, cache_read: 0, output: 477 },
  a19_arquitecto_camino: { input_total: 57397, cache_read: 32558, output: 11226 },
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

const MODEL_IDS = new Set<string>(AGENT_MODEL_IDS);
const toKnownModel = (model: string | null | undefined) => {
  const alias = (model ?? "").replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, "");
  if (MODEL_IDS.has(alias)) return alias;
  return alias.startsWith("claude-opus") ? "claude-opus-5" : alias.startsWith("gpt-") ? "gpt-6-sol" : "claude-sonnet-5";
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
    ? { ok: false as const, statusCode: 403, error: "platform_admin_required", message: "Solo un platform admin puede gestionar los costes de IA." }
    : null;

export async function getAdminAiCostModel(env: LoadedApiEnv, context: AuthContext) {
  const denied = forbidden(context);
  if (denied) return denied;
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
      const live = measured.get(code);
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
        default_model: toKnownModel(defaultAgentModel(code, row.model)),
        model_configurable: code !== COPILOT_AGENT_CODE,
        scheduled: design.scheduled,
        default_runs_per_day: design.runs,
        max_runs_per_day: design.scheduled
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
      agents,
      caps: { org_daily_run_cap: 12, platform_runs_per_tick: 15, ticks_per_day: 2 },
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
