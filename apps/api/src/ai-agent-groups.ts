import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Análisis automáticos que cada organización puede apagar en Configuración ›
 * Copiloto IA (20261219130000). Grupo que ve la persona → agentes del
 * orquestador. Módulo sin dependencias para que lo use ai-runtime sin ciclos.
 */
export const AI_AGENT_GROUPS: Record<string, string[]> = {
  lectura: ["a02_monitor_negocio"],
  tareas: ["a04_generador_tareas"],
  stock: ["a06_planificador_stock"],
  email: ["a12_analista_email"],
  planes: ["a17_plan_semanal", "a18_plan_mensual", "a19_revision_camino"],
  canales: [
    "a13_operativa_shopify",
    "a14_operativa_meta",
    "a20_retencion_clientes",
    "a21_adquisicion_shopify",
    "a24_medicion_meta",
  ],
};

/** Agentes apagados por organización. Si la lectura falla, no se apaga nada. */
export async function loadDisabledAgents(
  supabase: Pick<SupabaseClient, "from">,
  organizationIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (organizationIds.length === 0) return result;
  const { data } = await supabase
    .from("organization_ai_settings")
    .select("organization_id, disabled_groups")
    .in("organization_id", organizationIds);
  for (const row of data ?? []) {
    const agents = new Set(
      ((row.disabled_groups as string[] | null) ?? []).flatMap((group) => AI_AGENT_GROUPS[group] ?? []),
    );
    result.set(row.organization_id as string, agents);
  }
  return result;
}
