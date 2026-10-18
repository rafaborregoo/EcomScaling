import type { AuthContext } from "./auth-context.js";
import { createServiceClient, getMetricAnalystExplanation } from "./ai-runtime.js";
import { createTask } from "./operations.js";
import { resolveTaskAssignee } from "./task-assignment.js";

// A29 (ADR-0027): una recomendación de la explicación pasa a tarea al pulsar "Crear tarea". El toque es la
// aprobación (la IA propone, la persona decide). La tarea guarda de qué métrica y valor viene para poder medir
// después si la acción movió la cifra (fase 3 del ADR).

type Recommendation = { action?: unknown; owner?: unknown };

export async function createMetricActionTask(
  env: Parameters<typeof createServiceClient>[0] & Parameters<typeof createTask>[0],
  context: AuthContext,
  organizationId: string,
  metric: string,
  index: number,
  days: number,
  connectionId?: string,
) {
  const cached = await getMetricAnalystExplanation(env, context, organizationId, metric, days, connectionId);
  if (cached.ok === false) return cached;
  const output = (cached.data.output ?? {}) as { answer?: unknown; recommendations?: Recommendation[] };
  const rec = Number.isInteger(index) ? output.recommendations?.[index] : undefined;
  const action = typeof rec?.action === "string" ? rec.action.trim() : "";
  if (!action) return { ok: false as const, statusCode: 404, error: "metric_action_not_found", message: "Esa recomendación ya no está en el análisis." };

  const supabase = createServiceClient(env);
  const outputId = String(cached.data.output_id);

  // Pulsar dos veces no crea dos tareas.
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("organization_id", organizationId)
    .eq("metadata->>ai_output_id", outputId)
    .eq("metadata->>ai_recommendation_index", String(index))
    .maybeSingle();
  if (existing) return { ok: true as const, data: { task: existing, created: false } };

  // Para el consultor: el reparto habitual entre consultores. Para el cliente: quien pulsa si es el cliente;
  // si pulsa un consultor, un miembro activo de la tienda.
  const isConsultant = ["consultant", "platform_admin"].includes(context.profile.platform_role);
  let assignedTo: string | null = null;
  if (rec?.owner === "consultor") {
    assignedTo = await resolveTaskAssignee(supabase, organizationId);
  } else if (isConsultant) {
    const { data: member } = await supabase.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("is_active", true).limit(1).maybeSingle();
    assignedTo = (member?.user_id as string | undefined) ?? null;
  }

  const created = await createTask(env, context, organizationId, {
    title: action.slice(0, 255),
    description: typeof output.answer === "string" ? output.answer : null,
    priority: "medium",
    assignedTo,
  });
  if (created.ok === false) return created;

  const { error } = await supabase
    .from("tasks")
    .update({
      source: "ai_consultant",
      metadata: { ai_agent: "a29_analista_metrica", ai_output_id: outputId, ai_recommendation_index: index, metric, lookback_days: days, created_from: "metric_analysis" },
    })
    .eq("id", created.data.id)
    .eq("organization_id", organizationId);
  if (error) return { ok: false as const, statusCode: 500, error: "metric_action_link_failed", detail: error.message };

  return { ok: true as const, data: { task: { id: created.data.id, title: created.data.title, status: created.data.status }, created: true } };
}
