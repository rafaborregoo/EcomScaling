/**
 * Cadencia y modelo de cada agente fijados por platform admin (Costes de IA,
 * tabla `platform_ai_agent_settings`). Lo leen el orquestador (cuantas veces
 * corre cada agente) y el runtime (con que modelo), y el simulador para
 * enseñar lo mismo que se va a aplicar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { A01_MODEL_DECISION, A04_MODEL_DECISION, A06_MODEL_DECISION, getAgentModelDecision } from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("agent-schedule");

export const AGENT_MODEL_IDS = ["claude-sonnet-5", "claude-opus-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-sol", "gpt-6-luna", A01_MODEL_DECISION.model, A04_MODEL_DECISION.model, A06_MODEL_DECISION.model] as const;
export type AgentModelId = (typeof AGENT_MODEL_IDS)[number];

/** El copiloto decide su modelo por el saldo del plan: no se fija desde aqui. */
export const COPILOT_AGENT_CODE = "a09_copiloto_consultor";

/**
 * Ejecuciones/dia por cliente segun el diseno (1 tienda, Shopify+Meta+Klaviyo).
 * `scheduled`: las lanza el orquestador (2 pasadas al dia, antiguedad minima por
 * agente, tope de 12/dia/cliente); su numero se puede cambiar. El resto es uso
 * manual tipico: sirve para estimar coste, no se programa.
 */
export const DESIGN_RUNS_PER_DAY: Record<string, { runs: number; scheduled: boolean; cadence: string }> = {
  a02_monitor_negocio: { runs: 4.33, scheduled: true, cadence: "4 vistas × (tienda + cliente) cada ~60 h, 7 d diario, 90 d semanal" },
  a04_generador_tareas: { runs: 1, scheduled: true, cadence: "1 al día si cambió la actividad" },
  a06_planificador_stock: { runs: 1, scheduled: true, cadence: "1 al día si cambió la actividad" },
  a12_analista_email: { runs: 1, scheduled: true, cadence: "1 al día si cambió la actividad" },
  a13_operativa_shopify: { runs: 2, scheduled: true, cadence: "1 al día para el cliente + 1 por tienda" },
  a14_operativa_meta: { runs: 2, scheduled: true, cadence: "1 al día para el cliente + 1 por tienda" },
  a20_retencion_clientes: { runs: 2, scheduled: true, cadence: "1 al día para el cliente + 1 por tienda" },
  a21_adquisicion_shopify: { runs: 2, scheduled: true, cadence: "1 al día para el cliente + 1 por tienda" },
  a22_postventa_shopify: { runs: 0, scheduled: false, cadence: "manual" },
  a23_creatividad_meta: { runs: 1, scheduled: true, cadence: "1 al día por tienda" },
  a24_medicion_meta: { runs: 1, scheduled: true, cadence: "1 al día por tienda" },
  a25_cambios_meta: { runs: 1, scheduled: true, cadence: "1 al día por tienda" },
  a26_contenido_email: { runs: 1, scheduled: true, cadence: "1 al día si cambió la actividad" },
  a17_plan_semanal: { runs: 0.17, scheduled: true, cadence: "cada 6 días" },
  a18_plan_mensual: { runs: 0.03, scheduled: true, cadence: "cada 27 días" },
  a19_revision_camino: { runs: 0.33, scheduled: true, cadence: "cada 3 días, con plan activo" },
  a05_estrategia_campanas: { runs: 1, scheduled: false, cadence: "manual: editar con IA y chat del Estudio" },
  a11_generador_marketing: { runs: 0.13, scheduled: false, cadence: "manual: ~4 generaciones al mes" },
  a19_arquitecto_camino: { runs: 0.03, scheduled: false, cadence: "manual: ~1 al mes" },
  a15_analista_imagenes: { runs: 0.67, scheduled: false, cadence: "al subir imágenes al banco" },
  a16_texto_sobre_imagen: { runs: 0.33, scheduled: false, cadence: "manual" },
  a27_planificador_mailing: { runs: 0.07, scheduled: false, cadence: "manual: ~2 al mes" },
  a28_arquitecto_flujos: { runs: 0.03, scheduled: false, cadence: "manual: ~1 al mes" },
  a29_analista_metrica: { runs: 0.13, scheduled: false, cadence: "manual: ~4 al mes" },
  a08_gestor_conocimiento: { runs: 0, scheduled: false, cadence: "manual" },
  a01_analista_llamadas: { runs: 0, scheduled: false, cadence: "al subir una llamada" },
  [COPILOT_AGENT_CODE]: { runs: 0.2, scheduled: false, cadence: "chat; gasta del saldo propio de 1 M tokens al mes" },
};

/** Agentes que corren con el modelo de su version, no con la eleccion del cliente. */
const VERSION_MODEL_AGENTS = new Set(["a02_monitor_negocio", "a29_analista_metrica"]);

/** Modelo que usa el runtime para un agente cuando nadie ha elegido otro. */
export function defaultAgentModel(agentCode: string, versionModel: string): string {
  const decision = getAgentModelDecision(agentCode);
  if (decision) return decision.model;
  if (agentCode === COPILOT_AGENT_CODE || VERSION_MODEL_AGENTS.has(agentCode)) return versionModel;
  // El Camino es el entregable de consultoria mas importante y se genera pocas veces.
  return agentCode === "a19_arquitecto_camino" ? "gpt-6-sol" : "gpt-6-luna";
}

/**
 * Los especialistas usan la política de plataforma. La preferencia heredada
 * del cliente solo se conserva para el copiloto, cuyo saldo se resuelve fuera.
 */
export function resolveAgentModel(input: {
  agentCode: string;
  versionModel: string;
  clientModel: string | null | undefined;
  platformModel: string | null | undefined;
}): string {
  const decision = getAgentModelDecision(input.agentCode);
  if (decision) return decision.model;
  if (input.agentCode === COPILOT_AGENT_CODE) return input.clientModel ?? input.versionModel;
  return input.platformModel ?? defaultAgentModel(input.agentCode, input.versionModel);
}

const MIN_RUN_AGE_FLOOR_MS = 60 * 60 * 1000;

/**
 * Antiguedad minima entre ejecuciones con la cadencia de plataforma: el
 * intervalo de diseno escalado por (ejecuciones de diseno / ejecuciones
 * pedidas). Sin ajuste, el de diseno. 0 ejecuciones se trata aparte (no se
 * programa).
 */
export function scaledMinRunAgeMs(baseMs: number, designRuns: number | undefined, runsPerDay: number | null | undefined): number {
  if (runsPerDay === null || runsPerDay === undefined || !designRuns || runsPerDay <= 0) return baseMs;
  return Math.max(MIN_RUN_AGE_FLOOR_MS, Math.round((baseMs * designRuns) / runsPerDay));
}

export type PlatformAgentSetting = { runs_per_day: number | null; model: string | null };

/** Si la tabla no responde, se sigue con el diseno: un ajuste perdido no puede parar a los agentes. */
export async function loadPlatformAgentSettings(supabase: SupabaseClient, agentCode?: string): Promise<Map<string, PlatformAgentSetting>> {
  let query = supabase.from("platform_ai_agent_settings").select("agent_code, runs_per_day, model");
  if (agentCode) query = query.eq("agent_code", agentCode);
  const { data, error } = await query;
  if (error) {
    logger.error("platform_agent_settings_load_failed", error);
    return new Map();
  }
  return new Map(
    (data ?? []).map((row) => [
      String(row.agent_code),
      {
        runs_per_day: row.runs_per_day === null ? null : Number(row.runs_per_day),
        model: (row.model as string | null) ?? null,
      },
    ]),
  );
}
