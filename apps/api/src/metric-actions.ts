import type { AuthContext } from "./auth-context.js";
import { requireOperationalOrganization, requireOperationalStore } from "./auth-context.js";
import { createServiceClient, getMetricAnalystExplanation } from "./ai-runtime.js";
import { createTask } from "./operations.js";
import { resolveTaskAssignee } from "./task-assignment.js";

// A29 (ADR-0027): una recomendación de la explicación pasa a tarea al pulsar "Crear tarea". El toque es la
// aprobación (la IA propone, la persona decide). La tarea guarda de qué métrica y valor viene para poder medir
// después si la acción movió la cifra (fase 3 del ADR).

type Recommendation = { action?: unknown; owner?: unknown };

export async function recordMetricAnalysisFeedback(
  env: Parameters<typeof createServiceClient>[0],
  context: AuthContext,
  organizationId: string,
  metric: string,
  outputId: string,
  rating: "helpful" | "incorrect",
  correction?: string,
) {
  if (typeof outputId !== "string" || typeof metric !== "string" || !["helpful", "incorrect"].includes(rating)) {
    return { ok: false as const, statusCode: 400, error: "invalid_metric_feedback" };
  }
  const hasOrgScope = context.memberships.some((item) => item.organization_id === organizationId);
  const hasStoreScope = context.storeMemberships?.some((item) => item.organization_id === organizationId) ?? false;
  if (!hasOrgScope && !hasStoreScope) return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  const note = typeof correction === "string" ? correction.trim() || null : null;
  if (!outputId.trim() || (note && note.length > 1200)) return { ok: false as const, statusCode: 400, error: "invalid_metric_feedback" };

  const supabase = createServiceClient(env);
  const { data: output, error: outputError } = await supabase.from("agent_outputs")
    .select("id, status, agent_runs!inner(id, store_id, status, objective, agent_versions!inner(agent_definitions!inner(code)))")
    .eq("id", outputId).eq("organization_id", organizationId).maybeSingle();
  if (outputError) return { ok: false as const, statusCode: 503, error: "metric_feedback_output_lookup_failed", detail: outputError.message };
  const run = output?.agent_runs as any;
  const agentCode = run?.agent_versions?.agent_definitions?.code;
  if (!output || agentCode !== "a29_analista_metrica" || run?.status !== "succeeded" || output.status !== "approved" || !String(run.objective ?? "").includes(`[metric=${metric}]`)) {
    return { ok: false as const, statusCode: 404, error: "metric_feedback_output_not_found" };
  }
  const storeId = typeof run.store_id === "string" ? run.store_id : null;
  if (storeId) {
    const access = requireOperationalStore(context, organizationId, storeId);
    if (access.ok === false) return access;
  } else {
    const access = requireOperationalOrganization(context, organizationId);
    if (access.ok === false) return access;
  }
  const { error } = await supabase.from("metric_analysis_feedback").upsert({
    organization_id: organizationId,
    store_id: storeId,
    run_id: run.id,
    output_id: outputId,
    metric_id: metric,
    user_id: context.user.id,
    rating,
    correction: note,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,output_id,user_id" });
  if (error) return { ok: false as const, statusCode: 500, error: "metric_feedback_save_failed", detail: error.message };
  return { ok: true as const, data: { saved: true, output_id: outputId, rating } };
}

export async function createMetricActionTask(
  env: Parameters<typeof createServiceClient>[0] & Parameters<typeof createTask>[0],
  context: AuthContext,
  organizationId: string,
  metric: string,
  index: number,
  days: number,
  expectedOutputId: string,
  expectedAction: string,
  connectionId?: string,
) {
  if (!expectedOutputId.trim() || !expectedAction.trim()) {
    return { ok: false as const, statusCode: 400, error: "metric_action_identity_required" };
  }
  const cached = await getMetricAnalystExplanation(env, context, organizationId, metric, days, connectionId);
  if (cached.ok === false) return cached;
  if (cached.data.output_id !== expectedOutputId) {
    return { ok: false as const, statusCode: 409, error: "metric_explanation_changed", message: "La explicación ha cambiado. Ábrela de nuevo antes de crear la tarea." };
  }
  const output = (cached.data.output ?? {}) as {
    answer?: unknown;
    metric_evidence?: {
      metric?: string; value?: number | null; previous?: number | null; change_pct?: number | null;
      currency_code?: string | null; measurement_period?: { start?: string; end?: string };
      confidence?: string; verdict?: string;
    };
    recommendations?: Recommendation[];
    findings?: Array<{ figures?: Array<{ label?: string; value?: string; previous?: string | null; change_pct?: number | null }> }>;
  };
  const supabase = createServiceClient(env);
  const outputId = String(cached.data.output_id);
  const isConsultant = ["consultant", "platform_admin"].includes(context.profile.platform_role);
  const visibleRecommendations = (output.recommendations ?? []).flatMap((item, originalIndex) =>
    isConsultant || item.owner !== "consultor" ? [{ item, originalIndex }] : [],
  );
  const selected = Number.isInteger(index) ? visibleRecommendations[index] : undefined;
  const rec = selected?.item;
  const stableIndex = selected?.originalIndex;
  const action = typeof rec?.action === "string" ? rec.action.trim() : "";
  if (!action) return { ok: false as const, statusCode: 404, error: "metric_action_not_found", message: "Esa recomendación ya no está disponible para tu perfil." };
  if (expectedAction !== undefined && action !== expectedAction.trim()) {
    return { ok: false as const, statusCode: 409, error: "metric_recommendation_changed", message: "La recomendación ha cambiado. Ábrela de nuevo antes de crear la tarea." };
  }

  // Pulsar dos veces no crea dos tareas.
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("organization_id", organizationId)
    .eq("agent_output_id", outputId)
    .eq("agent_proposal_index", stableIndex ?? -1)
    .maybeSingle();
  if (existing) return { ok: true as const, data: { task: existing, created: false } };

  // Para el consultor: el reparto habitual entre consultores. Para el cliente: quien pulsa si es el cliente;
  // si pulsa un consultor, un miembro activo de la tienda.
  let assignedTo: string | null = null;
  if (rec?.owner === "consultor") {
    assignedTo = await resolveTaskAssignee(supabase, organizationId);
  } else if (isConsultant) {
    const { data: member } = await supabase.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("is_active", true).limit(1).maybeSingle();
    assignedTo = (member?.user_id as string | undefined) ?? null;
  }

  const metricLabel = ({ mer: "MER", cac_new: "CAC de cliente nuevo", conversion: "Conversión", meta_roas: "ROAS atribuido por Meta", email_open_rate: "Aperturas de email" } as Record<string, string>)[metric];
  const baseline = output.findings?.flatMap((finding) => finding.figures ?? []).find((figure) => figure.label === metricLabel) ?? null;

  const created = await createTask(env, context, organizationId, {
    title: action.slice(0, 255),
    description: typeof output.answer === "string" ? output.answer : null,
    priority: "medium",
    assignedTo,
    connectionId: connectionId ?? null,
    agentOutputId: outputId,
    agentProposalIndex: stableIndex ?? null,
    source: "ai_consultant",
    isVisibleToClient: rec?.owner !== "consultor",
    metadata: {
      ai_agent: "a29_analista_metrica",
      ai_output_id: outputId,
      ai_recommendation_index: stableIndex,
      metric,
      lookback_days: days,
      baseline: output.metric_evidence ? {
        metric: output.metric_evidence.metric ?? metric,
        value: output.metric_evidence.value ?? null,
        previous: output.metric_evidence.previous ?? null,
        change_pct: output.metric_evidence.change_pct ?? null,
        currency_code: output.metric_evidence.currency_code ?? null,
        measurement_period: output.metric_evidence.measurement_period ?? null,
        verdict: output.metric_evidence.verdict ?? null,
        confidence: output.metric_evidence.confidence ?? null,
        captured_at: cached.data.generated_at,
      } : baseline ? { label: baseline.label, value: baseline.value, previous: baseline.previous ?? null, change_pct: baseline.change_pct ?? null, captured_at: cached.data.generated_at } : null,
      created_from: "metric_analysis",
    },
  });
  if (created.ok === false) return created;

  return { ok: true as const, data: { task: { id: created.data.id, title: created.data.title, status: created.data.status }, created: true } };
}
