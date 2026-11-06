import { currentReviewOutput } from "./camino-structured-change.js";
import { objectiveWindow, objectiveProgress, readCaminoObjectives } from "./camino-measurement.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  type AuthContext,
  createUserScopedClient,
  requireOperationalOrganization,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import {
  caminoPlanOutputSchema,
  caminoCalendarHorizonDays,
  type CaminoPlanOutput,
} from "@e-nora/ai";
import { parseStrategicPlanMarkdown } from "./strategic-plan-markdown.js";
import { isCaminoProposalActionAllowed } from "./camino-proposal-decision.js";
import { adjustCaminoProposal } from "./camino-proposal-adjustment.js";
import { endOfMonth, proposalExpired } from "./camino-replan.js";
import { loadCaminoRoutes } from "./camino-routes.js";
import { financialMonths, loadPlanEconomics, monthFinancial } from "./camino-economics.js";
import { loadFxQuotes } from "./fx-rates.js";
import { caminoReviewCycleStart, canRetryCaminoReview } from "./camino-review-scheduling.js";
import { occurrenceTitle, recurrenceDates } from "./camino-recurrence.js";
import { createLogger } from "@e-nora/observability";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  recordObjectiveChange,
  scheduleObjectiveChangeReview,
} from "./camino-objective-changes.js";
import { refreshCostDependentCaches } from "./financial-config.js";
import {
  assigneeForOwner,
  categoryForKind,
  normalizeKind,
  normalizeTrack,
  normalizeCadence,
  normalizeOwner,
  sortTaskLinks,
} from "./camino-task-mapping.js";

const logger = createLogger("strategic-plans");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  INTEGRATION_FEATURE_FLAGS?: string;
};

// Catalogo cerrado de objetivos de ecommerce (peticion de Rafa 2026-08-27:
// "Mi Camino" no es onboarding, es donde consultor y cliente ven progresion
// de objetivos). Cerrado a proposito -- cada entrada mapea a una metrica que
// la app YA calcula (shopify-metrics.ts / meta-metrics.ts), asi el objetivo
// nunca queda "sin dato real": nada de metric_key libre ni pipeline nuevo.
// direction "up" = mas es mejor, "down" = menos es mejor (CAC, agotados).
//
// Las claves son las del panel (Inicio, Panel, Rentabilidad): Mi Camino es la
// unica fuente de objetivos y el panel los busca por clave exacta. Antes el
// Camino usaba net_sales/aov/cac (con IVA, CAC solo de Meta) y el panel
// net_revenue_ex_tax/aov_ex_tax/cac_blended: el mismo objetivo con dos cifras.
function actionAllowedForApply(action: string, state: string) { return action === "apply" && ["pending", "accepted"].includes(state); }

export const OBJECTIVE_CATALOG = [
  {
    key: "net_revenue_ex_tax",
    label: "Ingresos sin IVA",
    unit: "money",
    direction: "up",
    source: "shopify",
  },
  {
    key: "net_profit",
    label: "Beneficio neto",
    unit: "money",
    direction: "up",
    source: "shopify",
  },
  {
    key: "net_margin_pct",
    label: "Margen neto",
    unit: "pct",
    direction: "up",
    source: "shopify",
  },
  {
    key: "orders_count",
    label: "Pedidos",
    unit: "count",
    direction: "up",
    source: "shopify",
  },
  {
    key: "aov_ex_tax",
    label: "Ticket medio sin IVA",
    unit: "money",
    direction: "up",
    source: "shopify",
  },
  {
    key: "conversion_rate",
    label: "Conversión",
    unit: "pct",
    direction: "up",
    source: "shopify",
  },
  {
    key: "roas",
    label: "ROAS Meta Ads",
    unit: "ratio",
    direction: "up",
    source: "meta",
  },
  {
    key: "cac_blended",
    label: "CAC (todas las plataformas)",
    unit: "money",
    direction: "down",
    source: "shopify",
  },
  {
    key: "out_of_stock_items",
    label: "Productos agotados",
    unit: "count",
    direction: "down",
    source: "shopify",
  },
] as const;

type ObjectiveMetricKey = (typeof OBJECTIVE_CATALOG)[number]["key"];

export function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

async function auditStrategicChange(
  supabase: SupabaseClient,
  organizationId: string,
  context: AuthContext,
  action: string,
  entityType: string,
  entityId: string,
  newData?: unknown,
) {
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action,
    entityType,
    entityId,
    newData,
  });
}

export function requireMembership(context: AuthContext, organizationId: string) {
  return requireOperationalOrganization(context, organizationId);
}

export function assertCanManagePlan(context: AuthContext, organizationId: string) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  if (
    context.profile.platform_role !== "platform_admin" &&
    context.profile.platform_role !== "consultant" &&
    !["owner", "manager"].includes(access.membership.role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "plan_manage_denied",
      message:
        "Solo el propietario, un gestor o el consultor pueden gestionar el plan.",
    };
  }

  return { ok: true as const };
}

/** Camino de cada tienda de la organización, para la vista "Todas las tiendas". */
export async function getCaminoRoutes(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const result = await loadCaminoRoutes(createServiceClient(env), [organizationId]);
  if (result.ok === false) {
    return { ok: false as const, statusCode: 503, error: "camino_routes_load_failed", detail: result.detail };
  }
  return { ok: true as const, data: { routes: result.routes } };
}

/** Propuesta de replanificación que sigue siendo válida: ni caducada ni de un Camino que ya cambió. */
async function loadReplanDraft(service: SupabaseClient, organizationId: string, planId: string) {
  const { data } = await service
    .from("agent_outputs")
    .select("created_at, fingerprint:output->replan_source->>fingerprint")
    .eq("organization_id", organizationId)
    .eq("status", "pending_approval")
    .eq("output->replan_source->>plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || proposalExpired(data.created_at as string)) return null;
  const { data: current } = await service.rpc("camino_plan_fingerprint", { p_plan_id: planId });
  return current === data.fingerprint ? { generated_at: data.created_at as string } : null;
}

export async function getStrategicPlan(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const service = createServiceClient(env);
  let storeId: string | null = null;
  let storeTimezone: string | null = null;
  if (connectionId) {
    const { data: store, error: storeError } = await service.from("shopify_stores")
      .select("id, timezone").eq("organization_id", organizationId).eq("connection_id", connectionId).eq("is_active", true).maybeSingle();
    if (storeError) return { ok: false as const, statusCode: 503, error: "plan_store_scope_failed", detail: storeError.message };
    if (!store) return { ok: false as const, statusCode: 404, error: "store_not_found" };
    storeId = store.id as string;
    storeTimezone = (store.timezone as string | null) ?? null;
  }

  // Ultimo plan no archivado con toda su estructura; las notas internas van
  // aparte porque su RLS ya limita a consultores/admins.
  // RLS esconde los borradores a quien no es consultor asignado ni admin, pero
  // quien puede gestionar el plan (owner/manager) lo crea y debe verlo para
  // revisarlo y activarlo: el permiso ya se comprobó arriba con membership.
  const planReader = assertCanManagePlan(context, organizationId).ok ? service : supabase;
  let planQuery = planReader
    .from("strategic_plans")
    .select(
      "id, name, description, goal, horizon_months, currency_code, display_fx, replaces_plan_id, status, version, starts_on, completed_on, approved_at, created_at, strategic_plan_phases(id, name, description, rationale, evidence, position, status, activated_at, completed_at, created_by, strategic_plan_milestones(id, name, description, success_criteria, rationale, position, status, target_date, deadline_date, measurement_date, completed_at, completion_evidence, completion_kind, verification_snapshot, created_by, milestone_task_links(task_id, position, owner_role, kind, track, cadence, effort_hours, definition_of_done, rationale, evidence, created_at, tasks(id, title, description, status, priority, due_at, categories, source, created_by, assigned_to, ignored_reason, ignored_at))))",
    )
    .eq("organization_id", organizationId);
  planQuery = storeId ? planQuery.eq("store_id", storeId) : planQuery.is("store_id", null);
  const { data: plan, error } = await planQuery
    .neq("status", "archived")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "plan_load_failed",
      detail: error.message,
    };
  }

  if (plan) {
    await attachCreatorOrigin(supabase, plan as PlanWithPhases);
    for (const phase of (plan as PlanWithPhases).strategic_plan_phases) {
      for (const milestone of phase.strategic_plan_milestones) {
        milestone.milestone_task_links = sortTaskLinks(
          milestone.milestone_task_links as Array<{ position?: number | null; created_at?: string | null }>,
        ) as typeof milestone.milestone_task_links;
        // Los metadatos viven en el enlace hito-tarea; se copian a la tarea para
        // que cada pantalla que ya recibe la tarea los tenga sin recorrer enlaces.
        for (const link of milestone.milestone_task_links) {
          if (!link.tasks) continue;
          const hasMeta = link.owner_role || link.kind || link.track || link.definition_of_done || link.rationale || link.effort_hours != null;
          link.tasks.plan_meta = hasMeta
            ? {
                owner_role: link.owner_role ?? null,
                kind: link.kind ?? null,
                track: link.track ?? null,
                cadence: link.cadence ?? null,
                effort_hours: link.effort_hours == null ? null : Number(link.effort_hours),
                definition_of_done: link.definition_of_done ?? null,
                rationale: link.rationale ?? null,
                evidence: Array.isArray(link.evidence) ? link.evidence : [],
              }
            : null;
        }
      }
    }
  }

  let marketingAssetsAvailable = true;
  let marketingAssets: Array<{
    id: string;
    task_id: string;
    milestone_id: string | null;
    milestone_name: string | null;
    title: string;
    status: string;
    scheduled_for: string | null;
    created_at: string;
  }> = [];
  const canViewMarketingAssets =
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    ["owner", "manager"].includes(access.membership.role);
  if (plan && storeId && connectionId && canViewMarketingAssets) {
    const planRecord = plan as unknown as {
      strategic_plan_phases?: Array<{
        strategic_plan_milestones?: Array<{
          id: string;
          name: string;
          milestone_task_links?: Array<{ tasks?: { id: string } | null }>;
        }>;
      }>;
    };
    const taskMilestoneById = new Map<string, { milestoneId: string; milestoneName: string }>();
    for (const phase of planRecord.strategic_plan_phases ?? []) {
      for (const milestone of phase.strategic_plan_milestones ?? []) {
        for (const link of milestone.milestone_task_links ?? []) {
          const taskId = link.tasks?.id;
          if (taskId) taskMilestoneById.set(taskId, { milestoneId: milestone.id, milestoneName: milestone.name });
        }
      }
    }
    const taskIds = [...taskMilestoneById.keys()];
    if (taskIds.length) {
      const taskFilters = taskIds.map((taskId) => `request->camino_task->>task_id.eq.${taskId}`).join(",");
      const { data: linkedDrafts, error: linkedDraftsError } = await service
        .from("marketing_content_drafts")
        .select("id, status, request, template_name, subject, scheduled_for, created_at")
        .eq("organization_id", organizationId)
        .eq("request->>store_id", connectionId)
        .or(taskFilters)
        .order("created_at", { ascending: false })
        .limit(Math.min(taskIds.length * 5, 250));
      if (linkedDraftsError) {
        marketingAssetsAvailable = false;
      } else {
        marketingAssets = (linkedDrafts ?? []).flatMap((draft) => {
          const request = draft.request as Record<string, unknown> | null;
          const taskContext = request?.camino_task as Record<string, unknown> | null;
          const taskId = typeof taskContext?.task_id === "string" ? taskContext.task_id : null;
          const milestone = taskId ? taskMilestoneById.get(taskId) : null;
          if (!taskId || !milestone || request?.store_id !== connectionId) return [];
          return [{
            id: draft.id,
            task_id: taskId,
            milestone_id: typeof taskContext?.milestone_id === "string" ? taskContext.milestone_id : milestone.milestoneId,
            milestone_name: typeof taskContext?.milestone_name === "string" ? taskContext.milestone_name : milestone.milestoneName,
            title: draft.template_name || draft.subject || "Borrador de email",
            status: draft.status,
            scheduled_for: draft.scheduled_for,
            created_at: draft.created_at,
          }];
        });
      }
    }
  }

  let weeklyReviews: Array<Record<string, unknown>> = [];
  if (plan && ["active", "completed"].includes(plan.status)) {
    const { data: reviews, error: reviewsError } = await supabase
      .from("strategic_plan_weekly_reviews")
      .select("id, review_week_start, trigger_kind, goal_snapshot, period_start, period_end, status, updated_at, output_id, created_at, camino_learning_decisions(learning_index, decision, content), agent_outputs(output, status), strategic_plan_change_proposals(id, proposal_index, proposal, created_at, strategic_plan_change_proposal_events(id, action, actor_user_id, actor_role, reason, edited_proposal, created_at))")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: false })
      .limit(8);
    if (reviewsError) {
      return { ok: false as const, statusCode: 503, error: "plan_reviews_load_failed", detail: reviewsError.message };
    }
    const normalizedReviews = (reviews ?? []).map((row) => {
      const relation = row.agent_outputs as unknown as Record<string, unknown> | Array<Record<string, unknown>> | null;
      const outputRow = Array.isArray(relation) ? relation[0] : relation;
      const rawOutput = currentReviewOutput(outputRow?.output, row.goal_snapshot, plan.goal, row.period_end) as Record<string, unknown> | null;
      if (rawOutput && Array.isArray(rawOutput.learnings)) rawOutput.learnings = rawOutput.learnings.map((learning, index) => {
        const decision = (row.camino_learning_decisions as unknown as Array<{ learning_index: number; decision: string; content: Record<string, unknown> }> | null)?.find((d) => d.learning_index === index);
        return decision ? { ...learning, ...decision.content, decision: decision.decision } : learning;
      });
      const proposals = row.strategic_plan_change_proposals as unknown as Array<Record<string, unknown>> | null;
      return {
        id: row.id,
        period_start: row.period_start,
        period_end: row.period_end,
        created_at: row.created_at,
        status: row.status,
        trigger_kind: row.trigger_kind ?? "scheduled",
        // Solo la periodica se reintenta: la de un cambio de objetivo se
        // vuelve a disparar con el siguiente cambio o entra en la periodica.
        can_retry: (row.trigger_kind ?? "scheduled") === "scheduled" &&
          row.review_week_start === caminoReviewCycleStart(new Date()) &&
          canRetryCaminoReview(String(row.status), typeof row.updated_at === "string" ? row.updated_at : null),
        output: rawOutput,
        proposals: (proposals ?? []).map((proposal) => {
          const events = (proposal.strategic_plan_change_proposal_events as Array<Record<string, unknown>> | null) ?? [];
          const orderedEvents = [...events].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
          const latest = orderedEvents.at(-1) ?? null;
          const edited = [...orderedEvents].reverse().find((event) => event.action === "edited" && event.edited_proposal)?.edited_proposal;
          return {
            id: proposal.id,
            proposal_index: proposal.proposal_index,
            proposal: proposal.proposal,
            current_proposal: edited ?? proposal.proposal,
            status: latest?.action ?? "pending",
            latest_event_id: latest?.id ?? null,
            events: orderedEvents,
          };
        }),
      };
    });
    const actorIds = [...new Set(normalizedReviews.flatMap((review) =>
      (review.proposals as Array<{ events: Array<Record<string, unknown>> }>).flatMap((proposal) => proposal.events.map((event) => event.actor_user_id).filter((id): id is string => typeof id === "string")),
    ))];
    const actorLabels = new Map<string, string>();
    if (actorIds.length) {
      const { data: actors } = await service.from("profiles").select("id, full_name").in("id", actorIds);
      for (const actor of actors ?? []) actorLabels.set(actor.id as string, actor.full_name ? `Usuario · ${actor.full_name}` : "Usuario");
    }
    weeklyReviews = normalizedReviews.map((review) => ({
      ...review,
      proposals: (review.proposals as Array<{ events: Array<Record<string, unknown>> }>).map((proposal) => ({
        ...proposal,
        events: proposal.events.map((event) => ({
          ...event,
          actor_label: `${event.actor_role === "consultant" ? "Consultor" : "Cliente"}${actorLabels.get(String(event.actor_user_id))?.replace(/^Usuario/, "") ?? ""}`,
        })),
      })),
    }));
  }

  const closures = plan ? await supabase.from("camino_closures").select("id, created_at, snapshot").eq("plan_id", plan.id).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5) : { data: [], error: null };
  if (closures.error) return { ok: false as const, statusCode: 503, error: "camino_closures_load_failed", detail: closures.error.message };
  // Versiones anteriores: replanificar archiva, no borra.
  let previousQuery = service.from("strategic_plans").select("id, name, version, created_at").eq("organization_id", organizationId).eq("status", "archived");
  previousQuery = storeId ? previousQuery.eq("store_id", storeId) : previousQuery.is("store_id", null);
  const previous = await previousQuery.order("version", { ascending: false }).limit(5);
  return {
    ok: true as const,
    data: {
      closures: closures.data ?? [],
      organization_id: organizationId,
      plan: plan ?? null,
      previous_plans: previous.data ?? [],
      replan_draft: plan && assertCanManagePlan(context, organizationId).ok ? await loadReplanDraft(service, organizationId, plan.id as string) : null,
      store_timezone: storeTimezone,
      weekly_reviews: weeklyReviews,
      marketing_assets: marketingAssets,
      marketing_assets_available: marketingAssetsAvailable,
    },
  };
}

export async function recordCaminoChangeProposalAction(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
  proposalId: string,
  input: {
    action?: string;
    reason?: string;
    expected_last_event_id?: string | null;
    edited_proposal?: { description?: string; reason?: string; evidence?: string; target_id?: string | null };
  },
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  if (!input.action || !["accept", "reject", "edit", "complete", "apply"].includes(input.action)) {
    return { ok: false as const, statusCode: 400, error: "invalid_camino_proposal_action" };
  }
  const supabase = createServiceClient(env);
  const [{ data: plan, error: planError }, { data: proposalRow, error: proposalError }] = await Promise.all([
    supabase.from("strategic_plans").select("id, status, store_id, goal").eq("id", planId).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("strategic_plan_change_proposals").select("id, proposal, plan_id, organization_id").eq("id", proposalId).eq("plan_id", planId).eq("organization_id", organizationId).maybeSingle(),
  ]);
  if (planError || proposalError) return { ok: false as const, statusCode: 503, error: "camino_proposal_decision_load_failed", detail: planError?.message ?? proposalError?.message };
  if (!plan || !proposalRow) return { ok: false as const, statusCode: 404, error: "camino_change_proposal_not_found" };
  if (plan.status !== "active") return { ok: false as const, statusCode: 409, error: "camino_not_active" };

  const { data: previousEvents, error: eventsError } = await supabase.from("strategic_plan_change_proposal_events")
    .select("id, action, edited_proposal").eq("proposal_id", proposalId).order("created_at", { ascending: false }).limit(1);
  if (eventsError) return { ok: false as const, statusCode: 503, error: "camino_proposal_history_load_failed", detail: eventsError.message };
  const previous = previousEvents?.[0] as { id: string; action: string; edited_proposal: Record<string, unknown> | null } | undefined;
  if (!Object.prototype.hasOwnProperty.call(input, "expected_last_event_id")) {
    return { ok: false as const, statusCode: 400, error: "camino_proposal_expected_version_required" };
  }
  if (input.expected_last_event_id !== undefined && (input.expected_last_event_id ?? null) !== (previous?.id ?? null)) {
    return { ok: false as const, statusCode: 409, error: "camino_proposal_decision_stale" };
  }
  if (previous?.action === "completed") return { ok: false as const, statusCode: 409, error: "camino_proposal_already_completed" };
  const previousAction = previous?.action ?? "pending";
  const allowed = actionAllowedForApply(input.action, previousAction) || isCaminoProposalActionAllowed(input.action as "accept" | "reject" | "edit" | "complete", previousAction as "pending" | "accepted" | "edited" | "rejected" | "completed");
  if (!allowed) return { ok: false as const, statusCode: 409, error: "camino_proposal_invalid_transition" };

  const action = input.action;
  const reason = input.reason?.trim() ?? "";
  let editedProposal: Record<string, unknown> | null = null;
  if (action === "reject" && reason.length < 3) return { ok: false as const, statusCode: 400, error: "camino_rejection_reason_required" };
  if (action === "complete" && reason.length < 3) return { ok: false as const, statusCode: 400, error: "camino_completion_reason_required" };
  if (action === "complete" && !["accepted", "edited"].includes(previous?.action ?? "")) {
    return { ok: false as const, statusCode: 409, error: "camino_proposal_requires_acceptance" };
  }
  if (action === "edit") {
    const patch = input.edited_proposal;
    if (!patch || ![patch.description, patch.reason, patch.evidence].every((value) => typeof value === "string" && value.trim().length > 0)) {
      return { ok: false as const, statusCode: 400, error: "camino_edited_proposal_fields_required" };
    }
    const original = previous?.edited_proposal ?? proposalRow.proposal as Record<string, unknown>;
    editedProposal = {
      ...original,
      structured_change: null,
      description: patch.description!.trim().slice(0, 2000),
      reason: patch.reason!.trim().slice(0, 2000),
      evidence: patch.evidence!.trim().slice(0, 2000),
      ...(patch.target_id === undefined ? {} : { target_id: patch.target_id?.trim().slice(0, 120) ?? null }),
    };
  }
  const eventAction = action === "accept" ? "accepted" : action === "reject" ? "rejected" : action === "edit" ? "edited" : "completed";
  const { data: eventData, error: eventError } = await supabase.rpc("camino_proposal_decision", {
    p_organization_id: organizationId, p_plan_id: planId, p_proposal_id: proposalId,
    p_actor_id: context.user.id, p_actor_role: ["platform_admin", "consultant"].includes(context.profile.platform_role) ? "consultant" : "client",
    p_action: action === "apply" ? "apply" : eventAction, p_reason: reason || null,
    p_expected_event: input.expected_last_event_id ?? null, p_edited: editedProposal,
  });
  const event = eventData as { id: string; action: string; created_at: string } | null;
  if (eventError || !event) return { ok: false as const, statusCode: 409, error: "camino_proposal_decision_save_failed", detail: eventError?.message };

  await auditStrategicChange(supabase, organizationId, context, `strategic_plan.proposal.${eventAction}`, "strategic_plan_change_proposal", proposalId, {
    plan_id: planId,
    store_id: plan.store_id,
    action: eventAction,
    reason: reason || null,
  });
  if (action === "apply") {
    const original = proposalRow.proposal as Record<string, unknown>;
    const patch = original.structured_change as { before?: number; value?: number } | null;
    const goal = plan.goal as Record<string, unknown> | null;
    if (original.target_type === "goal" && patch && typeof patch.value === "number") await recordObjectiveChange(supabase, context, {
      organizationId, storeId: plan.store_id, planId, scope: "plan_goal", metricKey: String(goal?.metric_key ?? "goal"),
      metricLabel: String(goal?.metric_label ?? "Meta del Camino"), action: "updated", previousValue: patch.before ?? null, newValue: patch.value, reason: reason || String(original.reason ?? "Cambio aprobado desde revisión semanal"),
    });
  }
  return { ok: true as const, data: { id: event.id, action: event.action, created_at: event.created_at } };
}

type PlanWithPhases = {
  strategic_plan_phases: Array<{
    created_by: string | null;
    created_by_origin?: "consultant" | "client" | null;
    strategic_plan_milestones: Array<{
      created_by: string | null;
      created_by_origin?: "consultant" | "client" | null;
      milestone_task_links: Array<{
        position?: number | null;
        owner_role?: string | null;
        kind?: string | null;
        track?: string | null;
        cadence?: string | null;
        effort_hours?: number | string | null;
        definition_of_done?: string | null;
        rationale?: string | null;
        evidence?: unknown;
        tasks: {
          created_by: string | null;
          created_by_origin?: "consultant" | "client" | null;
          /** Lo que A19 dijo de la tarea al crear el camino; null si es a mano. */
          plan_meta?: Record<string, unknown> | null;
          assigned_to?: string | null;
          assignee_name?: string | null;
          assignee_origin?: "consultant" | "client" | null;
        } | null;
      }>;
    }>;
  }>;
};

/** El consultor y el cliente pueden ambos crear fases/hitos/tareas en Mi
 * Camino (assertCanManagePlan permite owner/manager ademas de
 * consultor/admin) -- la UI necesita distinguir de que lado vino cada uno
 * (peticion de Rafa 2026-07-29). Se deriva del `platform_role` del creador en
 * vez de guardarlo aparte: siempre esta al dia con quien es hoy consultor. */
async function attachCreatorOrigin(
  supabase: ReturnType<typeof createUserScopedClient>,
  plan: PlanWithPhases,
) {
  const creatorIds = new Set<string>();
  for (const phase of plan.strategic_plan_phases) {
    if (phase.created_by) creatorIds.add(phase.created_by);
    for (const milestone of phase.strategic_plan_milestones) {
      if (milestone.created_by) creatorIds.add(milestone.created_by);
      for (const link of milestone.milestone_task_links) {
        if (link.tasks?.created_by) creatorIds.add(link.tasks.created_by);
        // Quién lleva la tarea: «Para cerrar la fase» dice si le toca al
        // cliente o a su consultor.
        if (link.tasks?.assigned_to) creatorIds.add(link.tasks.assigned_to);
      }
    }
  }

  if (creatorIds.size === 0) {
    return;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, platform_role, full_name")
    .in("id", Array.from(creatorIds));
  const nameById = new Map<string, string | null>(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name ?? null]),
  );

  const originById = new Map<string, "consultant" | "client">(
    (profiles ?? []).map((profile) => [
      profile.id,
      ["consultant", "platform_admin"].includes(profile.platform_role)
        ? "consultant"
        : "client",
    ]),
  );

  for (const phase of plan.strategic_plan_phases) {
    phase.created_by_origin = phase.created_by
      ? (originById.get(phase.created_by) ?? null)
      : null;
    for (const milestone of phase.strategic_plan_milestones) {
      milestone.created_by_origin = milestone.created_by
        ? (originById.get(milestone.created_by) ?? null)
        : null;
      for (const link of milestone.milestone_task_links) {
        if (link.tasks) {
          link.tasks.created_by_origin = link.tasks.created_by
            ? (originById.get(link.tasks.created_by) ?? null)
            : null;
          const assignee = link.tasks.assigned_to;
          link.tasks.assignee_origin = assignee
            ? (originById.get(assignee) ?? null)
            : null;
          link.tasks.assignee_name = assignee
            ? (nameById.get(assignee) ?? null)
            : null;
        }
      }
    }
  }
}

export type PlanInput = {
  /** Salida de IA que origina el plan: se marca publicada en la misma transaccion. */
  outputId?: string | null;
  storeId?: string | null;
  connectionId?: string | null;
  name?: string;
  description?: string | null;
  goal?: CaminoPlanOutput["goal"];
  horizonMonths?: number | null;
  currencyCode?: string | null;
  phases?: Array<{
    name?: string;
    description?: string | null;
    rationale?: string | null;
    evidence?: unknown[];
    milestones?: Array<{
      name?: string;
      description?: string | null;
      successCriteria?: string | null;
      rationale?: string | null;
      targetDate?: string | null;
      deadlineDate?: string | null;
      measurementDate?: string | null;
      /** Replanificar: el hito vigente que este continúa. */
      sourceMilestoneId?: string | null;
      changeReason?: string | null;
      // Metrica del hito elegida al crear el camino (builder a mano): se
      // guarda como objetivo ligado al hito, igual que desde el panel.
      objective?: { metricKey?: string; targetValue?: number } | null;
      tasks?: Array<{
        title?: string;
        description?: string | null;
        dueAt?: string | null;
        priority?: string;
        owner?: string | null;
        kind?: string | null;
        track?: string | null;
        cadence?: string | null;
        effortHours?: number | null;
        definitionOfDone?: string | null;
        rationale?: string | null;
        evidence?: unknown[];
        /** Replanificar: la tarea vigente que esta continúa, con su historia y responsable. */
        sourceTaskId?: string | null;
        changeReason?: string | null;
        reassign?: boolean;
      }>;
    }>;
  }>;
};

/**
 * Quien recibe las tareas del consultor al crear un camino: su consultor
 * asignado y, si quien crea es consultor o admin sin asignacion, el mismo.
 */
export async function resolveTaskAssignee(
  supabase: SupabaseClient,
  context: AuthContext,
  organizationId: string,
) {
  const { data } = await supabase
    .from("consultant_assignments")
    .select("consultant_user_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  const consultantId =
    (data?.consultant_user_id as string | undefined) ??
    (["consultant", "platform_admin"].includes(context.profile.platform_role) ? context.user.id : null);
  return (owner: unknown) => assigneeForOwner(owner, { consultantId, creatorId: context.user.id });
}

/** ISO 4217 en mayusculas o null; cualquier otra cosa se descarta. */
export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  try {
    new Intl.NumberFormat("es-ES", { style: "currency", currency: code });
    return code;
  } catch {
    return null;
  }
}

/** El arbol que escriben create_strategic_plan_tree y camino_apply_replan. */
export function buildPlanTree(
  input: PlanInput,
  assignTo: (owner: unknown) => string | null,
  objectiveCatalogKeys: Set<string>,
) {
  return {
    name: input.name!.trim().slice(0, 255),
    description: input.description ?? null,
    goal: input.goal ?? null,
    horizon_months: input.horizonMonths ?? null,
    currency_code: normalizeCurrencyCode(input.currencyCode),
    phases: (input.phases ?? []).map((phase) => ({
      name: phase.name!.trim().slice(0, 255),
      description: phase.description ?? null,
      rationale: phase.rationale ?? null,
      evidence: phase.evidence ?? [],
      milestones: (phase.milestones ?? [])
        .filter((milestone) => milestone.name && milestone.name.trim().length > 0)
        .map((milestone) => {
          const objective = milestone.objective;
          const validObjective =
            objective?.metricKey &&
            objectiveCatalogKeys.has(objective.metricKey) &&
            typeof objective.targetValue === "number" &&
            Number.isFinite(objective.targetValue) &&
            objective.targetValue >= 0
              ? { metric_key: objective.metricKey, target_value: objective.targetValue }
              : null;
          return {
            name: milestone.name!.trim().slice(0, 255),
            description: milestone.description ?? null,
            success_criteria: milestone.successCriteria ?? null,
            rationale: milestone.rationale ?? null,
            target_date: milestone.targetDate ?? null,
            deadline_date: milestone.deadlineDate ?? null,
            measurement_date: milestone.measurementDate ?? null,
            source_milestone_id: milestone.sourceMilestoneId ?? null,
            objective: validObjective,
            tasks: (milestone.tasks ?? [])
              .filter((task) => task.title && task.title.trim().length > 0)
              // Una rutina (semanal, quincenal...) se convierte en una tarea por vez.
              // La primera vuelta de una tarea que continúa otra es esa misma tarea.
              .flatMap((task) => {
                const cadence = normalizeCadence(task.cadence);
                const dates = cadence && cadence !== "una_vez" ? recurrenceDates(task.dueAt, cadence, milestone.targetDate) : [];
                return dates.length > 1
                  ? dates.map((date, index) => ({ ...task, sourceTaskId: index === 0 ? (task.sourceTaskId ?? null) : null, title: occurrenceTitle(task.title!.trim(), index, dates.length), dueAt: date }))
                  : [task];
              })
              .map((task) => ({
                title: task.title!.trim().slice(0, 255),
                description: task.description ?? null,
                priority: MILESTONE_TASK_PRIORITIES.includes(task.priority ?? "")
                  ? task.priority
                  : "medium",
                due_at: task.dueAt ?? null,
                // Sin `assigned_to` una tarea conservada mantiene su responsable.
                ...(task.sourceTaskId && !task.reassign ? {} : { assigned_to: assignTo(task.owner) }),
                source_task_id: task.sourceTaskId ?? null,
                category: categoryForKind(task.kind),
                owner: normalizeOwner(task.owner),
                kind: normalizeKind(task.kind),
                track: normalizeTrack(task.track),
                cadence: normalizeCadence(task.cadence),
                effort_hours: typeof task.effortHours === "number" ? task.effortHours : null,
                definition_of_done: task.definitionOfDone ?? null,
                rationale: task.rationale ?? null,
                evidence: task.evidence ?? [],
              })),
          };
        }),
    })),
  };
}

export async function createStrategicPlan(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: PlanInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (!input.name || input.name.trim().length === 0) {
    return { ok: false as const, statusCode: 400, error: "missing_plan_name" };
  }

  // Un plan puede nacer vacío (solo nombre) y llenarse luego fase a fase desde
  // la UI interactiva (createPhase / createMilestone). No se exige ninguna fase
  // en la creación.
  const phases = (input.phases ?? []).filter(
    (phase) => phase.name && phase.name.trim().length > 0,
  );

  const supabase = createServiceClient(env);

  const wantsObjectives = phases.some((phase) =>
    (phase.milestones ?? []).some((milestone) => milestone.objective?.metricKey),
  );
  const objectiveCatalogKeys = wantsObjectives
    ? new Set((await resolveObjectiveCatalog(env, organizationId)).map((entry) => entry.key))
    : new Set<string>();

  let storeId: string | null = null;
  if (input.storeId || input.connectionId) {
    let storeQuery = supabase.from("shopify_stores").select("id")
      .eq("organization_id", organizationId).eq("is_active", true);
    storeQuery = input.storeId ? storeQuery.eq("id", input.storeId) : storeQuery.eq("connection_id", input.connectionId!);
    const { data: store, error: storeError } = await storeQuery.maybeSingle();
    if (storeError) return { ok: false as const, statusCode: 503, error: "plan_store_scope_failed", detail: storeError.message };
    if (!store) return { ok: false as const, statusCode: 404, error: "store_not_found" };
    storeId = store.id as string;
  }

  let latestQuery = supabase
    .from("strategic_plans")
    .select("id, version, status")
    .eq("organization_id", organizationId);
  latestQuery = storeId ? latestQuery.eq("store_id", storeId) : latestQuery.is("store_id", null);
  const { data: latest, error: latestError } = await latestQuery
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "plan_version_lookup_failed",
      detail: latestError.message,
    };
  }

  if (latest && ["draft", "active"].includes(latest.status)) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "plan_already_open",
      message:
        "Ya existe un plan en borrador o activo. Archivalo o completalo antes de crear otro.",
    };
  }

  const assignTo = await resolveTaskAssignee(supabase, context, organizationId);

  // Todo el arbol viaja en un solo JSON y se escribe en UNA transaccion
  // (create_strategic_plan_tree). Antes eran ~150 inserts sueltos con un
  // rollback manual que no corria si el proceso caia a mitad.
  const tree = buildPlanTree({ ...input, phases }, assignTo, objectiveCatalogKeys);

  const { data: planId, error: planError } = await supabase.rpc("create_strategic_plan_tree", {
    p_organization_id: organizationId,
    p_user_id: context.user.id,
    p_store_id: storeId,
    p_output_id: input.outputId ?? null,
    p_plan: tree,
  });

  if (planError || !planId) {
    if (planError?.message?.includes("plan_already_open")) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "plan_already_open",
        message:
          "Ya existe un plan en borrador o activo. Archivalo o completalo antes de crear otro.",
      };
    }
    return {
      ok: false as const,
      statusCode: 500,
      error: "plan_create_failed",
      detail: planError?.message,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.create",
    "strategic_plan",
    planId as string,
    {
      name: input.name,
      phases: phases.length,
    },
  );
  return { ok: true as const, data: { id: planId as string } };
}

export function previewStrategicPlanMarkdown(markdown: string) {
  return parseStrategicPlanMarkdown(markdown);
}

export async function createStrategicPlanFromMarkdown(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  markdown: string,
  connectionId?: string | null,
  currencyCode?: string | null,
) {
  const parsed = parseStrategicPlanMarkdown(markdown);
  if (!parsed.ok || !parsed.data) {
    return {
      ok: false as const,
      statusCode: 422,
      error: "invalid_strategic_plan_markdown",
      issues: parsed.errors,
      warnings: parsed.warnings,
      counts: parsed.counts,
    };
  }

  const created = await createStrategicPlan(env, context, organizationId, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    // Sin esto el camino importado caía en el general de la organización
    // aunque hubiera una tienda seleccionada.
    connectionId: connectionId ?? null,
    currencyCode: currencyCode ?? null,
    phases: parsed.data.phases.map((phase) => ({
      name: phase.name,
      description: phase.description ?? null,
      milestones: phase.milestones.map((milestone) => ({
        name: milestone.name,
        description: milestone.description ?? null,
        targetDate: milestone.targetDate ?? null,
        tasks: milestone.tasks.map((task) => ({
          title: task.title,
          description: task.description ?? null,
          dueAt: task.dueAt ?? null,
          ...(task.priority ? { priority: task.priority } : {}),
        })),
      })),
    })),
  });
  if (created.ok === false) return created;
  return {
    ok: true as const,
    data: { ...created.data, counts: parsed.counts, warnings: parsed.warnings },
  };
}

export async function activateStrategicPlan(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data: plan, error } = await supabase
    .from("strategic_plans")
    .update({
      status: "active",
      starts_on: new Date().toISOString().slice(0, 10),
      approved_by: context.user.id,
      approved_at: now,
    })
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "plan_activate_failed",
      detail: error.message,
    };
  }

  if (!plan) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "draft_plan_not_found",
    };
  }

  // La primera fase se activa; el resto queda pendiente en orden.
  const { data: phases, error: phasesError } = await supabase
    .from("strategic_plan_phases")
    .select("id, position")
    .eq("plan_id", planId)
    .order("position", { ascending: true });

  if (phasesError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "plan_phases_load_failed",
      detail: phasesError.message,
    };
  }

  for (const [index, phase] of (phases ?? []).entries()) {
    await supabase
      .from("strategic_plan_phases")
      .update(
        index === 0
          ? {
              status: "active",
              activated_at: now,
              activated_by: context.user.id,
            }
          : { status: "pending" },
      )
      .eq("id", phase.id);

    await supabase
      .from("strategic_plan_milestones")
      .update({ status: index === 0 ? "pending" : "locked" })
      .eq("phase_id", phase.id);
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.activate",
    "strategic_plan",
    planId,
    {
      status: "active",
    },
  );
  return { ok: true as const, data: { id: planId, status: "active" } };
}

/** Tipo BCE para enseñar el camino en otra moneda. Los importes guardados no se tocan. */
async function planCurrencyQuote(supabase: SupabaseClient, organizationId: string, planId: string, to: string) {
  const { data: plan, error } = await supabase.from("strategic_plans").select("id, currency_code, goal").eq("id", planId).eq("organization_id", organizationId).maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "plan_load_failed", detail: error.message };
  if (!plan) return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  const goal = plan.goal as { currency_code?: unknown } | null;
  const from = normalizeCurrencyCode(plan.currency_code) ?? normalizeCurrencyCode(goal?.currency_code);
  if (!from) return { ok: false as const, statusCode: 409, error: "plan_currency_unknown", message: "Este camino no tiene moneda de origen." };
  if (from === to) return { ok: true as const, from, quote: null };
  const [quote] = await loadFxQuotes(supabase, [from], to);
  if (!quote) {
    return { ok: false as const, statusCode: 409, error: "fx_rate_unavailable", message: `El BCE no publica un tipo de ${from} a ${to}. El camino sigue en ${from}.` };
  }
  return { ok: true as const, from, quote };
}

export async function quotePlanCurrency(env: ApiEnv, context: AuthContext, organizationId: string, planId: string, value: unknown) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const to = normalizeCurrencyCode(value);
  if (!to) return { ok: false as const, statusCode: 400, error: "invalid_currency_code" };
  const result = await planCurrencyQuote(createServiceClient(env), organizationId, planId, to);
  if (result.ok === false) return result;
  return { ok: true as const, data: { from: result.from, to, quote: result.quote } };
}

/**
 * Moneda en la que se muestra el camino. Convierte con el tipo BCE del día y lo
 * fija en `display_fx`: `currency_code` y las cifras guardadas no cambian, porque
 * el panel y los agentes las leen y se comparan con ventas en moneda de tienda.
 * Volver a la moneda de origen quita la conversión.
 */
export async function updatePlanCurrency(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
  value: unknown,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }
  const currencyCode = normalizeCurrencyCode(value);
  if (!currencyCode) {
    return { ok: false as const, statusCode: 400, error: "invalid_currency_code" };
  }

  const supabase = createServiceClient(env);
  const conversion = await planCurrencyQuote(supabase, organizationId, planId, currencyCode);
  if (conversion.ok === false) return conversion;
  const displayFx = conversion.quote;
  const { data, error } = await supabase
    .from("strategic_plans")
    .update({ display_fx: displayFx })
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false as const, statusCode: 500, error: "plan_currency_update_failed", detail: error.message };
  }
  if (!data) {
    return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  }

  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.set_currency", "strategic_plan", planId, {
    display_currency: currencyCode,
    display_fx: displayFx,
  });
  return { ok: true as const, data: { id: planId, currency_code: conversion.from, display_fx: displayFx } };
}

/** Margen mes a mes, costes incluidos y solidez de los datos de la meta. */
export async function getPlanEconomics(env: ApiEnv, context: AuthContext, organizationId: string, planId: string) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const service = createServiceClient(env);
  const { data: plan, error } = await service.from("strategic_plans").select("id, store_id, goal").eq("id", planId).eq("organization_id", organizationId).maybeSingle();
  if (error) return { ok: false as const, statusCode: 503, error: "plan_load_failed", detail: error.message };
  if (!plan) return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  const goal = plan.goal as { target_date?: string } | null;
  return { ok: true as const, data: await loadPlanEconomics(service, organizationId, (plan.store_id as string | null) ?? null, goal?.target_date ?? null) };
}

type StrategicPlanUpdateInput = { name?: string | undefined; description?: string | null | undefined };

export async function updateStrategicPlan(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
  input: StrategicPlanUpdateInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false as const, statusCode: 400, error: "invalid_plan_name" };
    patch.name = name.slice(0, 255);
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (!Object.keys(patch).length) return { ok: false as const, statusCode: 400, error: "empty_update" };

  const supabase = createServiceClient(env);
  const { data, error } = await supabase.from("strategic_plans")
    .update(patch).eq("id", planId).eq("organization_id", organizationId)
    .select("id").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "plan_update_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.update", "strategic_plan", data.id, patch);
  return { ok: true as const, data: { id: data.id } };
}

export async function deleteStrategicPlan(env: ApiEnv, context: AuthContext, organizationId: string, planId: string) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const supabase = createServiceClient(env);
  const { data: plan, error: lookupError } = await supabase.from("strategic_plans")
    .select("id, name, status").eq("id", planId).eq("organization_id", organizationId).maybeSingle();
  if (lookupError) return { ok: false as const, statusCode: 500, error: "plan_lookup_failed", detail: lookupError.message };
  if (!plan) return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  // Borrar es en cascada: un camino con trabajo hecho o ya cerrado se archiva, no se borra.
  const { count: doneTasks, error: doneError } = await supabase.from("milestone_task_links")
    .select("task_id, tasks!inner(status), strategic_plan_milestones!inner(strategic_plan_phases!inner(plan_id))", { count: "exact", head: true })
    .eq("tasks.status", "completed").eq("strategic_plan_milestones.strategic_plan_phases.plan_id", plan.id);
  if (doneError) return { ok: false as const, statusCode: 500, error: "plan_lookup_failed", detail: doneError.message };
  if (["archived", "completed"].includes(plan.status as string) || (doneTasks ?? 0) > 0) {
    return { ok: false as const, statusCode: 409, error: "plan_has_history", message: "Este camino tiene historial. Archívalo: no se puede borrar." };
  }
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.delete", "strategic_plan", plan.id, { name: plan.name, status: plan.status });
  const { data, error } = await supabase.from("strategic_plans").delete()
    .eq("id", planId).eq("organization_id", organizationId).select("id").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "plan_delete_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  return { ok: true as const, data: { id: data.id } };
}

/**
 * Archiva un camino (borrador, activo o completado) sin borrar nada: sus fases,
 * hitos y tareas se conservan. Es lo que permite crear otro en la misma tienda,
 * porque solo puede haber uno en borrador o activo; y a diferencia de borrarlo,
 * deja el historial de lo que se intento.
 */
export async function archiveStrategicPlan(env: ApiEnv, context: AuthContext, organizationId: string, planId: string) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const supabase = createServiceClient(env);
  const { data, error } = await supabase.from("strategic_plans")
    .update({ status: "archived" })
    .eq("id", planId).eq("organization_id", organizationId)
    .in("status", ["draft", "active", "completed"])
    .select("id, name").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "plan_archive_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.archive", "strategic_plan", data.id, { name: data.name });
  return { ok: true as const, data: { id: data.id as string, status: "archived" } };
}

export async function deletePhase(env: ApiEnv, context: AuthContext, organizationId: string, phaseId: string) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const supabase = createServiceClient(env);
  const { data: phase, error: lookupError } = await supabase.from("strategic_plan_phases")
    .select("id, plan_id, name").eq("id", phaseId).eq("organization_id", organizationId).maybeSingle();
  if (lookupError) return { ok: false as const, statusCode: 500, error: "phase_lookup_failed", detail: lookupError.message };
  if (!phase) return { ok: false as const, statusCode: 404, error: "phase_not_found" };
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.delete_phase", "strategic_plan_phase", phase.id, { plan_id: phase.plan_id, name: phase.name });
  const { data, error } = await supabase.from("strategic_plan_phases").delete()
    .eq("id", phaseId).eq("organization_id", organizationId).select("id").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "phase_delete_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "phase_not_found" };
  return { ok: true as const, data: { id: data.id } };
}

export async function deleteMilestone(env: ApiEnv, context: AuthContext, organizationId: string, milestoneId: string) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const supabase = createServiceClient(env);
  const { data: milestone, error: lookupError } = await supabase.from("strategic_plan_milestones")
    .select("id, phase_id, name").eq("id", milestoneId).eq("organization_id", organizationId).maybeSingle();
  if (lookupError) return { ok: false as const, statusCode: 500, error: "milestone_lookup_failed", detail: lookupError.message };
  if (!milestone) return { ok: false as const, statusCode: 404, error: "milestone_not_found" };
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.delete_milestone", "strategic_plan_milestone", milestone.id, { phase_id: milestone.phase_id, name: milestone.name });
  const { data, error } = await supabase.from("strategic_plan_milestones").delete()
    .eq("id", milestoneId).eq("organization_id", organizationId).select("id").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "milestone_delete_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "milestone_not_found" };
  return { ok: true as const, data: { id: data.id } };
}

type MilestoneTaskUpdateInput = { title?: string; description?: string | null; priority?: string; dueAt?: string | null };

export async function updateMilestoneTask(env: ApiEnv, context: AuthContext, organizationId: string, milestoneId: string, taskId: string, input: MilestoneTaskUpdateInput) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { ok: false as const, statusCode: 400, error: "invalid_task_title" };
    patch.title = title.slice(0, 255);
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.priority !== undefined) {
    if (!MILESTONE_TASK_PRIORITIES.includes(input.priority)) return { ok: false as const, statusCode: 400, error: "invalid_task_priority" };
    patch.priority = input.priority;
  }
  if (input.dueAt !== undefined) patch.due_at = input.dueAt || null;
  if (!Object.keys(patch).length) return { ok: false as const, statusCode: 400, error: "empty_update" };

  const supabase = createServiceClient(env);
  const { data: link, error: linkError } = await supabase.from("milestone_task_links")
    .select("id").eq("organization_id", organizationId).eq("milestone_id", milestoneId).eq("task_id", taskId).maybeSingle();
  if (linkError) return { ok: false as const, statusCode: 500, error: "task_link_lookup_failed", detail: linkError.message };
  if (!link) return { ok: false as const, statusCode: 404, error: "milestone_task_not_found" };
  const { data, error } = await supabase.from("tasks").update(patch)
    .eq("id", taskId).eq("organization_id", organizationId).select("id").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "task_update_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "task_not_found" };
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.update_task", "task", data.id, { milestone_id: milestoneId, ...patch });
  return { ok: true as const, data: { id: data.id } };
}

export async function unlinkMilestoneTask(env: ApiEnv, context: AuthContext, organizationId: string, milestoneId: string, taskId: string) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const supabase = createServiceClient(env);
  const { data, error } = await supabase.from("milestone_task_links").delete()
    .eq("organization_id", organizationId).eq("milestone_id", milestoneId).eq("task_id", taskId)
    .select("id").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "task_unlink_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "milestone_task_not_found" };
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.unlink_task", "task", taskId, { milestone_id: milestoneId });
  return { ok: true as const, data: { id: taskId } };
}

const MILESTONE_ACTIONS = ["in_progress", "completed", "skipped"] as const;

export async function updateMilestoneStatus(
  env: ApiEnv, context: AuthContext, organizationId: string, milestoneId: string,
  statusInput: string | undefined, completionNote?: string, authorization?: string, completionMode?: string,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (!authz.ok) return authz;
  if (!statusInput || !MILESTONE_ACTIONS.includes(statusInput as (typeof MILESTONE_ACTIONS)[number]))
    return { ok: false as const, statusCode: 400, error: "invalid_milestone_status" };
  if (completionMode !== undefined && !["verify", "exception"].includes(completionMode))
    return { ok: false as const, statusCode: 400, error: "invalid_completion_mode" };
  const supabase = createServiceClient(env);
  let verification: Record<string, unknown> | null = null;
  if (statusInput === "completed") {
    const { data: milestone, error } = await supabase.from("strategic_plan_milestones")
      .select("id, description, success_criteria, milestone_task_links(tasks(id, title, status)), strategic_plan_phases!inner(strategic_plans!inner(store_id))")
      .eq("id", milestoneId).eq("organization_id", organizationId).maybeSingle();
    if (error || !milestone) return { ok: false as const, statusCode: 404, error: "milestone_not_found" };
    const rel = milestone.strategic_plan_phases as unknown as { strategic_plans: { store_id: string | null } };
    const storeId = rel.strategic_plans.store_id;
    let connectionId: string | undefined;
    if (storeId) {
      const store = await supabase.from("shopify_stores").select("connection_id").eq("id", storeId).eq("organization_id", organizationId).single();
      if (store.error) return { ok: false as const, statusCode: 503, error: "milestone_store_unavailable" };
      connectionId = store.data.connection_id;
    }
    if (!authorization) return { ok: false as const, statusCode: 400, error: "milestone_measurement_authorization_required" };
    const result = await getObjectives(env, authorization, context, organizationId, storeId, connectionId);
    if (!result.ok) return result;
    // Los indicadores creados desde la pantalla no llevan tienda: también cuentan al cerrar el hito.
    const general = storeId ? await getObjectives(env, authorization, context, organizationId, null, connectionId) : null;
    if (general && !general.ok) return general;
    const checks = [...result.data.objectives, ...(general?.data.objectives ?? [])].filter((o) => o.milestone_id === milestoneId).map((o) => ({
      id: o.id, metric_key: o.metric_key, period: o.period, basis: o.measurement_basis,
      label: o.label, target: o.target_value, actual: o.actual_value, reached: o.status === "cumplido", measurement: o.measurement,
    }));
    if (completionMode !== "exception" && checks.some((c) => !c.reached)) return {
      ok: false as const, statusCode: 409, error: "milestone_metric_not_met",
      message: "Hay objetivos sin alcanzar o sin medición fiable. Revisa el resultado o registra un cierre por excepción con su motivo.",
    };
    const links = milestone.milestone_task_links as unknown as Array<{ tasks: { id: string; title: string; status: string } | null }>;
    // Una excepción puede cerrar con tareas abiertas: quedan dichas en el cierre.
    const openTasks = links.flatMap((link) => (link.tasks && ["pending", "in_progress", "proposed"].includes(link.tasks.status) ? [{ id: link.tasks.id, title: link.tasks.title }] : []));
    verification = { kind: completionMode === "exception" ? "exception" : checks.length ? "metric" : "human", checks, open_tasks: openTasks,
      criterion: milestone.success_criteria || milestone.description, measured_at: new Date().toISOString() };
  }
  const { data, error } = await supabase.rpc("camino_transition_milestone", {
    p_organization_id: organizationId, p_milestone_id: milestoneId, p_actor_id: context.user.id,
    p_status: statusInput, p_evidence: completionNote?.trim() ?? null, p_verification: verification,
  });
  if (error) return { ok: false as const, statusCode: 409, error: "milestone_transition_failed", message: error.message };
  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.update_milestone_status", "strategic_plan_milestone", milestoneId,
    { status: statusInput, evidence: completionNote, verification });
  return { ok: true as const, data: data as { id: string; status: string } };
}

type PhaseCreateInput = { name?: string | undefined; description?: string | null | undefined };

/** Anade una fase a un plan ya existente (a diferencia de createStrategicPlan,
 * que crea el plan entero de una vez). Tanto el consultor como el cliente
 * pueden proponer una fase nueva (assertCanManagePlan) -- se guarda quien la
 * creo para que la UI la distinga por color (ver attachCreatorOrigin). */
export async function createPhase(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
  input: PhaseCreateInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const name = input.name?.trim() ?? "";
  if (!name) {
    return { ok: false as const, statusCode: 400, error: "missing_phase_name" };
  }

  const supabase = createServiceClient(env);

  const { data: plan, error: planError } = await supabase
    .from("strategic_plans")
    .select("id")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (planError || !plan) {
    return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  }

  const { data: lastPhase } = await supabase
    .from("strategic_plan_phases")
    .select("position")
    .eq("plan_id", planId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: phase, error: phaseError } = await supabase
    .from("strategic_plan_phases")
    .insert({
      organization_id: organizationId,
      plan_id: planId,
      name: name.slice(0, 255),
      description: input.description ?? null,
      position: (lastPhase?.position ?? 0) + 1,
      status: "pending",
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (phaseError || !phase) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "phase_create_failed",
      detail: phaseError?.message,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.create_phase",
    "strategic_plan_phase",
    phase.id,
    {
      plan_id: planId,
      name,
    },
  );
  return { ok: true as const, data: { id: phase.id } };
}

type MilestoneCreateInput = {
  name?: string | undefined;
  description?: string | null | undefined;
  targetDate?: string | null | undefined;
};

/**
 * Reopens a completed Camino milestone when new open work is linked to it.
 * If its phase (or plan) had already closed, those containers are reopened too
 * so the new task remains visible in the active journey.
 */
export async function reopenCaminoMilestoneForWork(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
  actorUserId: string | null,
  taskId?: string,
): Promise<{ ok: true; reopened: boolean } | { ok: false; detail: string }> {
  if (taskId) {
    const { data: task, error } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return { ok: false, detail: error.message };
    if (!task || !["pending", "in_progress"].includes(String(task.status))) {
      return { ok: true, reopened: false };
    }
  }

  const { data: milestone, error: milestoneError } = await supabase
    .from("strategic_plan_milestones")
    .select("id, status, phase_id")
    .eq("id", milestoneId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (milestoneError) return { ok: false, detail: milestoneError.message };
  if (!milestone) return { ok: true, reopened: false };

  const { data: phase, error: phaseError } = await supabase
    .from("strategic_plan_phases")
    .select("id, status, plan_id")
    .eq("id", milestone.phase_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (phaseError) return { ok: false, detail: phaseError.message };
  if (!phase) return { ok: true, reopened: false };

  const { data: plan, error: planError } = await supabase
    .from("strategic_plans")
    .select("id, status")
    .eq("id", phase.plan_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (planError) return { ok: false, detail: planError.message };
  if (!plan || !["active", "completed"].includes(String(plan.status))) {
    return { ok: true, reopened: false };
  }

  const now = new Date().toISOString();
  let reopened = false;
  if (milestone.status === "completed") {
    const { error } = await supabase
      .from("strategic_plan_milestones")
      .update({ status: "pending", completed_at: null, completed_by: null })
      .eq("id", milestone.id)
      .eq("organization_id", organizationId)
      .eq("status", "completed");
    if (error) return { ok: false, detail: error.message };
    reopened = true;
  }
  if (phase.status === "completed") {
    const { data: activePhases, error: activePhasesError } = await supabase
      .from("strategic_plan_phases")
      .select("id")
      .eq("plan_id", phase.plan_id)
      .eq("organization_id", organizationId)
      .eq("status", "active");
    if (activePhasesError) return { ok: false, detail: activePhasesError.message };
    for (const activePhase of activePhases ?? []) {
      if (activePhase.id === phase.id) continue;
      const { error } = await supabase
        .from("strategic_plan_phases")
        .update({ status: "pending" })
        .eq("id", activePhase.id)
        .eq("organization_id", organizationId)
        .eq("status", "active");
      if (error) return { ok: false, detail: error.message };
    }
    const { error } = await supabase
      .from("strategic_plan_phases")
      .update({
        status: "active",
        completed_at: null,
        activated_at: now,
        activated_by: actorUserId,
      })
      .eq("id", phase.id)
      .eq("organization_id", organizationId)
      .eq("status", "completed");
    if (error) return { ok: false, detail: error.message };
    reopened = true;
  }
  if (plan.status === "completed") {
    const { error } = await supabase
      .from("strategic_plans")
      .update({ status: "active", completed_on: null })
      .eq("id", plan.id)
      .eq("organization_id", organizationId)
      .eq("status", "completed");
    if (error) return { ok: false, detail: error.message };
    reopened = true;
  }
  return { ok: true, reopened };
}

/** Igual que createPhase pero para un hito dentro de una fase existente --
 * el gap real que motivo este endpoint (Rafa, 2026-07-29): antes de esta
 * fecha un hito solo podia nacer con el plan completo, no se podia anadir
 * uno nuevo despues (ni el consultor ni el cliente podian, sin importar el
 * motivo -- una tarea nueva que no encajaba en ningun hito existente no tenia
 * donde ir). */
export async function createMilestone(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  phaseId: string,
  input: MilestoneCreateInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const name = input.name?.trim() ?? "";
  if (!name) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_milestone_name",
    };
  }

  const supabase = createServiceClient(env);

  const { data: phase, error: phaseError } = await supabase
    .from("strategic_plan_phases")
    .select("id, status")
    .eq("id", phaseId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (phaseError || !phase) {
    return { ok: false as const, statusCode: 404, error: "phase_not_found" };
  }

  const { data: lastMilestone } = await supabase
    .from("strategic_plan_milestones")
    .select("position")
    .eq("phase_id", phaseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: milestone, error: milestoneError } = await supabase
    .from("strategic_plan_milestones")
    .insert({
      organization_id: organizationId,
      phase_id: phaseId,
      name: name.slice(0, 255),
      description: input.description ?? null,
      position: (lastMilestone?.position ?? 0) + 1,
      target_date: input.targetDate ?? null,
      status: phase.status === "locked" ? "locked" : "pending",
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (milestoneError || !milestone) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "milestone_create_failed",
      detail: milestoneError?.message,
    };
  }

  const reopened = await reopenCaminoMilestoneForWork(
    supabase,
    organizationId,
    milestone.id,
    context.user.id,
  );
  if (!reopened.ok) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "milestone_parent_reopen_failed",
      detail: reopened.detail,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.create_milestone",
    "strategic_plan_milestone",
    milestone.id,
    { phase_id: phaseId, name },
  );
  return { ok: true as const, data: { id: milestone.id } };
}

type PhaseUpdateInput = {
  name?: string | undefined;
  description?: string | null | undefined;
};

export async function updatePhase(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  phaseId: string,
  input: PhaseUpdateInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_phase_name",
      };
    }
    patch.name = trimmed.slice(0, 255);
  }

  if (input.description !== undefined) {
    patch.description = input.description;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "empty_update" };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("strategic_plan_phases")
    .update(patch)
    .eq("id", phaseId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "phase_update_failed",
      detail: error.message,
    };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "phase_not_found" };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.update_phase",
    "strategic_plan_phase",
    data.id,
    patch,
  );
  return { ok: true as const, data: { id: data.id } };
}

type MilestoneUpdateInput = {
  name?: string | undefined;
  description?: string | null | undefined;
  targetDate?: string | null | undefined;
  /** Vacías equivalen a la fecha objetivo. */
  deadlineDate?: string | null | undefined;
  measurementDate?: string | null | undefined;
  /** «Cómo sabremos que está hecho» y «Por qué ahora»: los escribe A19 y el consultor los corrige. */
  successCriteria?: string | null | undefined;
  rationale?: string | null | undefined;
};

export async function updateMilestone(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  milestoneId: string,
  input: MilestoneUpdateInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_milestone_name",
      };
    }
    patch.name = trimmed.slice(0, 255);
  }

  if (input.description !== undefined) {
    patch.description = input.description;
  }

  if (input.targetDate !== undefined) {
    patch.target_date = input.targetDate;
  }

  for (const [key, column] of [["deadlineDate", "deadline_date"], ["measurementDate", "measurement_date"]] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { ok: false as const, statusCode: 400, error: "invalid_milestone_date" };
    }
    patch[column] = value;
  }
  if (typeof patch.target_date === "string" && typeof patch.deadline_date === "string" && patch.deadline_date < patch.target_date) {
    return { ok: false as const, statusCode: 400, error: "milestone_deadline_before_target", message: "La fecha límite no puede ser anterior a la fecha objetivo." };
  }

  for (const [key, column] of [["successCriteria", "success_criteria"], ["rationale", "rationale"]] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") {
      return { ok: false as const, statusCode: 400, error: "invalid_milestone_text" };
    }
    patch[column] = value?.trim() ? value.trim().slice(0, 2000) : null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "empty_update" };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("strategic_plan_milestones")
    .update(patch)
    .eq("id", milestoneId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "milestone_update_failed",
      detail: error.message,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "milestone_not_found",
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.update_milestone",
    "strategic_plan_milestone",
    data.id,
    patch,
  );
  return { ok: true as const, data: { id: data.id } };
}

function isUuidList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

/** Reordena las fases de un plan por drag & drop. La funcion SQL aparta las
 * posiciones y las reasigna en una transaccion para no chocar con el unique
 * (plan_id, position). */
export async function reorderPhases(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
  orderedIds: unknown,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }
  if (!isUuidList(orderedIds)) {
    return { ok: false as const, statusCode: 400, error: "invalid_order" };
  }

  const supabase = createServiceClient(env);

  const { data: plan } = await supabase
    .from("strategic_plans")
    .select("id")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!plan) {
    return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  }

  const { error } = await supabase.rpc("reorder_strategic_phases", {
    p_plan_id: planId,
    p_ordered_ids: orderedIds,
  });
  if (error) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "phase_reorder_failed",
      detail: error.message,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.reorder_phases",
    "strategic_plan",
    planId,
    { ordered_ids: orderedIds },
  );
  return { ok: true as const, data: { ok: true } };
}

/** Reordena los hitos de una fase por drag & drop (ver reorderPhases). */
export async function reorderMilestones(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  phaseId: string,
  orderedIds: unknown,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }
  if (!isUuidList(orderedIds)) {
    return { ok: false as const, statusCode: 400, error: "invalid_order" };
  }

  const supabase = createServiceClient(env);

  const { data: phase } = await supabase
    .from("strategic_plan_phases")
    .select("id")
    .eq("id", phaseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!phase) {
    return { ok: false as const, statusCode: 404, error: "phase_not_found" };
  }

  const { error } = await supabase.rpc("reorder_strategic_milestones", {
    p_phase_id: phaseId,
    p_ordered_ids: orderedIds,
  });
  if (error) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "milestone_reorder_failed",
      detail: error.message,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.reorder_milestones",
    "strategic_plan_phase",
    phaseId,
    { ordered_ids: orderedIds },
  );
  return { ok: true as const, data: { ok: true } };
}

export async function addMilestoneInternalNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  milestoneId: string,
  body: string | undefined,
) {
  if (
    !["consultant", "platform_admin"].includes(context.profile.platform_role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "internal_note_denied",
      message:
        "Solo consultores o administradores pueden crear notas internas.",
    };
  }

  // BE-01 (bug real de seguridad encontrado 2026-07-28, no solo un gap
  // teorico): el chequeo de arriba solo confirma el ROL de plataforma, no que
  // ESTE consultor este asignado a ESTA organizacion. Como el insert de abajo
  // usa `createServiceClient` (service_role, sin RLS), un consultor asignado
  // solo a otra organizacion podia escribir una nota interna aqui con solo
  // conocer un `milestoneId` ajeno. `context.memberships` ya incluye las
  // organizaciones virtuales del consultor (auth-context.ts) exactamente para
  // esto -- mismo patron que `requireMembership` en el resto del backend.
  if (
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  if (!body || body.trim().length === 0) {
    return { ok: false as const, statusCode: 400, error: "missing_note_body" };
  }

  const supabase = createServiceClient(env);

  const { data: milestone, error: milestoneError } = await supabase
    .from("strategic_plan_milestones")
    .select("id")
    .eq("id", milestoneId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (milestoneError || !milestone) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "milestone_not_found",
    };
  }

  const { data, error } = await supabase
    .from("milestone_internal_notes")
    .insert({
      organization_id: organizationId,
      milestone_id: milestoneId,
      author_user_id: context.user.id,
      body: body.trim(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "internal_note_failed",
      detail: error?.message,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.add_internal_note",
    "milestone_internal_note",
    data.id,
    {
      milestone_id: milestoneId,
    },
  );
  return { ok: true as const, data: { id: data.id } };
}

// Lectura separada del arbol principal (comentario en getStrategicPlan):
// user-scoped para que la RLS de milestone_internal_notes_select_consultants
// filtre por si sola -- un cliente que llame a esto ve una lista vacia, no un
// 403, igual que el resto de recursos con RLS de solo-lectura en esta app.
export async function getMilestoneInternalNotes(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  milestoneId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("milestone_internal_notes")
    .select("id, body, author_user_id, created_at")
    .eq("organization_id", organizationId)
    .eq("milestone_id", milestoneId)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "internal_notes_load_failed",
      detail: error.message,
    };
  }

  return { ok: true as const, data: { notes: data ?? [] } };
}

function isObjectiveMetricKey(value: unknown): value is ObjectiveMetricKey {
  return OBJECTIVE_CATALOG.some((entry) => entry.key === value);
}

type ObjectiveCatalogEntry = {
  key: string;
  label: string;
  unit: "money" | "pct" | "count" | "ratio" | "number";
  direction: "up" | "down";
  source: "shopify" | "meta" | "manual";
  // Metrica calculada que alimenta el "actual". Para los built-in y los
  // tipos custom de plataforma coincide con una key de OBJECTIVE_CATALOG;
  // para los tipos manuales es null (el valor lo teclea el consultor).
  metric_key: string | null;
};

const OBJECTIVE_UNITS = ["money", "pct", "count", "ratio", "number"] as const;
const OBJECTIVE_DIRECTIONS = ["up", "down"] as const;
const OBJECTIVE_SOURCES = ["shopify", "meta", "manual"] as const;

function builtinCatalogEntries(): ObjectiveCatalogEntry[] {
  return OBJECTIVE_CATALOG.map((entry) => ({
    key: entry.key,
    label: entry.label,
    unit: entry.unit as ObjectiveCatalogEntry["unit"],
    direction: entry.direction as ObjectiveCatalogEntry["direction"],
    source: entry.source as ObjectiveCatalogEntry["source"],
    metric_key: entry.key,
  }));
}

/**
 * Catalogo de objetivos aplicable a una organizacion: los 8 built-in
 * (metricas Shopify/Meta que la app ya calcula) mas los tipos custom que
 * haya definido su consultor -- ligados a ese cliente (organization_id =
 * org) o a toda su cartera (organization_id null). Lee con service client:
 * quien llama ya paso `requireMembership`, y necesitamos ver los tipos
 * "de cartera" de los consultores asignados sin depender de la RLS del
 * cliente.
 */
export async function resolveObjectiveCatalog(
  env: ApiEnv,
  organizationId: string,
): Promise<ObjectiveCatalogEntry[]> {
  const supabase = createServiceClient(env);

  const { data: assignments } = await supabase
    .from("consultant_assignments")
    .select("consultant_user_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const consultantIds = [
    ...new Set(
      (assignments ?? []).map((row) => row.consultant_user_id as string),
    ),
  ];
  const consultantList = consultantIds.length
    ? consultantIds.join(",")
    : "00000000-0000-0000-0000-000000000000";

  // Tolerante a que la migracion de objective_definitions no este aplicada
  // todavia (deploy antes que migracion): sin tipos custom, solo los 8 built-in.
  let defs: Array<Record<string, unknown>> | null = null;
  try {
    const result = await supabase
      .from("objective_definitions")
      .select("slug, label, unit, direction, source, metric_key")
      .is("archived_at", null)
      .or(
        `organization_id.eq.${organizationId},and(organization_id.is.null,owner_user_id.in.(${consultantList}))`,
      )
      .order("created_at", { ascending: true });
    defs = (result.data as Array<Record<string, unknown>> | null) ?? null;
  } catch {
    defs = null;
  }

  const custom: ObjectiveCatalogEntry[] = (defs ?? []).map((row) => ({
    key: row.slug as string,
    label: row.label as string,
    unit: row.unit as ObjectiveCatalogEntry["unit"],
    direction: row.direction as ObjectiveCatalogEntry["direction"],
    source: row.source as ObjectiveCatalogEntry["source"],
    metric_key: (row.metric_key as string | null) ?? null,
  }));

  // Built-in primero; si un custom repite slug (no deberia, hay unique), gana el custom.
  const byKey = new Map<string, ObjectiveCatalogEntry>();
  for (const entry of builtinCatalogEntries()) byKey.set(entry.key, entry);
  for (const entry of custom) byKey.set(entry.key, entry);
  return [...byKey.values()];
}

/** Objetivo activo + su valor real actual, para el panel de progresion de
 * Mi Camino. El "actual" siempre son los ultimos 30 dias -- el objetivo
 * guarda un periodo (mensual/trimestral/anual) pero comparar contra una
 * ventana fija y conocida es mas util que prorratear un trimestral a ojo.
 * ponytail: ventana fija de 30d, ajustar por periodo si algun cliente lo pide. */
export async function getObjectives(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  storeId?: string | null,
  // Tienda activa: el "actual" de los objetivos de hito se mide contra la
  // tienda del camino, no contra el agregado del cliente.
  connectionId?: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const today = new Date().toISOString().slice(0, 10);

  let targetsQuery = supabase
    .from("organization_metric_targets")
    .select(
      "id, metric_key, target_value, period, measurement_basis, valid_from, created_by, store_id, milestone_id",
    )
    .eq("organization_id", organizationId)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (storeId) targetsQuery = targetsQuery.eq("store_id", storeId);
  else targetsQuery = targetsQuery.is("store_id", null);
  const { data: targets, error } = await targetsQuery;

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objectives_load_failed",
      detail: error.message,
    };
  }

  const catalog = await resolveObjectiveCatalog(env, organizationId);
  const catalogByKey = new Map(catalog.map((entry) => [entry.key, entry]));

  // El valor manual vive en columnas que anade la migracion de
  // objective_definitions; solo se consultan si hay algun objetivo manual
  // (lo que implica que la migracion ya corrio), asi Mi Camino no revienta
  // si el deploy va por delante de la migracion.
  const manualById = new Map<string, number | null>();
  if (catalog.some((entry) => entry.source === "manual")) {
    try {
      const { data: manualRows } = await supabase
        .from("organization_metric_targets")
        .select("id, manual_actual_value")
        .eq("organization_id", organizationId);
      for (const row of manualRows ?? []) {
        manualById.set(
          row.id as string,
          row.manual_actual_value === null ||
            row.manual_actual_value === undefined
            ? null
            : Number(row.manual_actual_value),
        );
      }
    } catch {
      /* columnas aun no migradas: sin actual manual */
    }
  }

  const measurementTime = new Date();
  const windows = new Map<string, ReturnType<typeof objectiveWindow>>();
  for (const target of targets ?? []) {
    const key = target.measurement_basis === "calendar" ? target.period : "rolling_30_days";
    if (!windows.has(key)) windows.set(key, objectiveWindow(target.period, target.measurement_basis, measurementTime));
  }
  const measurements = new Map(await Promise.all([...windows].map(async ([key, window]) =>
    [key, await readCaminoObjectives(createServiceClient(env), organizationId, storeId ?? null, window)] as const)));

  const objectives = (targets ?? [])
    .filter((target) => catalogByKey.has(target.metric_key as string))
    .map((target) => {
      const catalogEntry = catalogByKey.get(target.metric_key as string)!;
      const measurement = measurements.get(target.measurement_basis === "calendar" ? target.period : "rolling_30_days")!;
      const actual = catalogEntry.source === "manual" ? (manualById.get(target.id as string) ?? null)
        : (catalogEntry.metric_key ? measurement.values[catalogEntry.metric_key] ?? null : null);
      const targetValue = Number(target.target_value);
      const progress = objectiveProgress(actual, targetValue, catalogEntry.direction);
      const progressPct = progress.pct;
      return {
        id: target.id,
        store_id: target.store_id ?? null,
        milestone_id: target.milestone_id ?? null,
        metric_key: target.metric_key,
        label: catalogEntry.label,
        unit: catalogEntry.unit,
        direction: catalogEntry.direction,
        source: catalogEntry.source,
        target_value: targetValue,
        period: target.period,
        measurement_basis: target.measurement_basis,
        measurement: { ...measurement, values: undefined, last_sync_at: catalogEntry.source === "meta" ? measurement.meta_last_sync_at : catalogEntry.source === "manual" ? null : measurement.last_sync_at, period_label: catalogEntry.source === "manual" ? "Valor manual" : catalogEntry.metric_key === "out_of_stock_items" ? "Inventario actual" : measurement.period_label,
          unavailable_reason: actual === null ? "Faltan datos fiables, cobertura o ajustes para esta métrica." : null },
        actual_value: actual,
        progress_pct: progressPct,
        status:
          actual === null
            ? "sin_datos"
            : progress.reached
              ? "cumplido"
              : "en_curso",
      };
    });

  return {
    ok: true as const,
    data: {
      objectives,
      catalog: catalog.map((entry) => ({
        key: entry.key,
        label: entry.label,
        unit: entry.unit,
        direction: entry.direction,
        source: entry.source,
      })),
    },
  };
}

type ObjectiveInput = {
  metricKey?: string;
  targetValue?: number;
  period?: string;
  storeId?: string | null;
  milestoneId?: string | null;
};

export async function createObjective(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  input: ObjectiveInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  // Acepta tanto las 8 metricas built-in como un slug de objective_definitions
  // aplicable a este cliente (tipo custom del consultor).
  const catalog = await resolveObjectiveCatalog(env, organizationId);
  if (
    typeof input.metricKey !== "string" ||
    !catalog.some((entry) => entry.key === input.metricKey)
  ) {
    return { ok: false as const, statusCode: 400, error: "invalid_metric_key" };
  }
  if (
    typeof input.targetValue !== "number" ||
    !Number.isFinite(input.targetValue) ||
    input.targetValue < 0
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_target_value",
    };
  }
  const period = ["monthly", "quarterly", "yearly"].includes(input.period ?? "")
    ? (input.period as string)
    : "monthly";

  const supabase = createServiceClient(env);
  const milestoneId =
    typeof input.milestoneId === "string" && input.milestoneId ? input.milestoneId : null;
  if (milestoneId) {
    const { data: milestone } = await supabase
      .from("strategic_plan_milestones")
      .select("id")
      .eq("id", milestoneId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!milestone) {
      return { ok: false as const, statusCode: 400, error: "invalid_milestone" };
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const catalogEntry = catalog.find((entry) => entry.key === input.metricKey)!;

  // Un objetivo nuevo para la misma metrica en el mismo alcance (tienda + hito)
  // es una edicion: se cambia la cifra de la fila vigente. Antes se cerraba la
  // anterior con valid_until = ayer, que el CHECK valid_until > valid_from
  // rechazaba si se habia creado hoy o ayer -- y el error se ignoraba, asi que
  // el insert chocaba con el unico y "editar" fallaba. El historial de cifras
  // queda en camino_objective_changes y en audit_logs.
  let currentQuery = supabase
    .from("organization_metric_targets")
    .select("id, target_value, period")
    .eq("organization_id", organizationId)
    .eq("metric_key", input.metricKey)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`);
  currentQuery = input.storeId
    ? currentQuery.eq("store_id", input.storeId)
    : currentQuery.is("store_id", null);
  currentQuery = milestoneId
    ? currentQuery.eq("milestone_id", milestoneId)
    : currentQuery.is("milestone_id", null);
  const { data: current, error: currentError } = await currentQuery
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_save_failed",
      detail: currentError.message,
    };
  }

  const previousValue = current ? Number(current.target_value) : null;
  if (current && previousValue === input.targetValue && current.period === period) {
    return { ok: true as const, data: { id: current.id as string } };
  }

  const { data, error } = current
    ? await supabase
        .from("organization_metric_targets")
        .update({ target_value: input.targetValue, period })
        .eq("id", current.id)
        .select("id")
        .single()
    : await supabase
        .from("organization_metric_targets")
        .insert({
          organization_id: organizationId,
          store_id: input.storeId ?? null,
          milestone_id: milestoneId,
          metric_key: input.metricKey,
          target_value: input.targetValue,
          period,
          measurement_basis: "calendar",
          valid_from: today,
          created_by: context.user.id,
        })
        .select("id")
        .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_save_failed",
      detail: error?.message,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.set_objective",
    "organization_metric_target",
    data.id,
    { metric_key: input.metricKey, target_value: input.targetValue, previous_value: previousValue, period, milestone_id: milestoneId },
  );

  await recordObjectiveChange(supabase, context, {
    organizationId,
    storeId: input.storeId ?? null,
    targetId: data.id,
    milestoneId,
    scope: "objective",
    metricKey: input.metricKey,
    metricLabel: catalogEntry.label,
    unit: catalogEntry.unit,
    period,
    action: current ? "updated" : "created",
    previousValue,
    newValue: input.targetValue,
  });
  scheduleObjectiveChangeReview(env, context, organizationId, input.storeId ?? null);
  // El panel lee los objetivos con las metricas, cacheadas 60 s.
  await refreshCostDependentCaches(env, organizationId);

  return { ok: true as const, data: { id: data.id } };
}

export async function deactivateObjective(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  targetId: string,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const supabase = createServiceClient(env);
  // Se borra, no se cierra con valid_until: el CHECK valid_until > valid_from
  // impedia quitar un objetivo creado hoy o ayer (el caso tipico: te equivocas
  // y lo quitas). El trigger de auditoria guarda la fila entera y el cambio
  // queda en camino_objective_changes.
  const { data, error } = await supabase
    .from("organization_metric_targets")
    .delete()
    .eq("id", targetId)
    .eq("organization_id", organizationId)
    .select("id, store_id, milestone_id, metric_key, target_value, period")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_deactivate_failed",
      detail: error.message,
    };
  }
  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "objective_not_found",
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.remove_objective",
    "organization_metric_target",
    data.id,
  );

  const catalog = await resolveObjectiveCatalog(env, organizationId);
  const catalogEntry = catalog.find((entry) => entry.key === data.metric_key);
  await recordObjectiveChange(supabase, context, {
    organizationId,
    storeId: (data.store_id as string | null) ?? null,
    targetId: data.id,
    milestoneId: (data.milestone_id as string | null) ?? null,
    scope: "objective",
    metricKey: data.metric_key as string,
    metricLabel: catalogEntry?.label ?? "un objetivo",
    unit: catalogEntry?.unit ?? null,
    period: data.period as string,
    action: "removed",
    previousValue: Number(data.target_value),
    newValue: null,
  });
  scheduleObjectiveChangeReview(env, context, organizationId, (data.store_id as string | null) ?? null);
  await refreshCostDependentCaches(env, organizationId);

  return { ok: true as const, data: { id: data.id } };
}

/**
 * Valor real de un objetivo de tipo manual, tecleado desde su card en Mi
 * Camino (los objetivos de metrica de plataforma calculan el actual solos).
 * Una sola lectura vigente por objetivo.
 */
export async function setObjectiveActual(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  targetId: string,
  value: unknown,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_actual_value",
    };
  }

  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("organization_metric_targets")
    .update({
      manual_actual_value: value,
      manual_actual_at: new Date().toISOString(),
    })
    .eq("id", targetId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_actual_save_failed",
      detail: error.message,
    };
  }
  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "objective_not_found",
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.set_objective_actual",
    "organization_metric_target",
    data.id,
    { value },
  );

  return { ok: true as const, data: { id: data.id } };
}

const MONTHLY_VALUE: Record<string, "revenue" | "profit" | "margin_pct" | "orders"> = {
  net_revenue_ex_tax: "revenue",
  net_profit: "profit",
  net_margin_pct: "margin_pct",
  orders_count: "orders",
};

/**
 * Histórico de un indicador: los cambios de su objetivo y, si la métrica tiene
 * serie mensual, lo medido. Se busca por métrica y tienda, no por fila: quitar
 * un objetivo borra la fila, pero ni sus cambios ni las mediciones se pierden.
 */
export async function getObjectiveHistory(env: ApiEnv, context: AuthContext, organizationId: string, targetId: string) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const service = createServiceClient(env);
  const { data: target, error } = await service.from("organization_metric_targets").select("id, metric_key, store_id").eq("id", targetId).eq("organization_id", organizationId).maybeSingle();
  if (error) return { ok: false as const, statusCode: 503, error: "objective_load_failed", detail: error.message };
  if (!target) return { ok: false as const, statusCode: 404, error: "objective_not_found" };
  const storeId = (target.store_id as string | null) ?? null;
  let changes = service.from("camino_objective_changes").select("id, action, previous_value, new_value, period, reason, actor_role, created_at")
    .eq("organization_id", organizationId).eq("metric_key", target.metric_key as string).eq("scope", "objective");
  changes = storeId ? changes.eq("store_id", storeId) : changes.is("store_id", null);
  const { data: rows, error: changesError } = await changes.order("created_at", { ascending: false }).limit(20);
  if (changesError) return { ok: false as const, statusCode: 503, error: "objective_history_failed", detail: changesError.message };
  const field = MONTHLY_VALUE[target.metric_key as string];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const months = field
    ? (await financialMonths(service, organizationId, storeId, 6)).map((entry) => {
        const month = monthFinancial(entry, true, currentMonth);
        return { month: month.month, value: month[field], in_progress: month.in_progress };
      })
    : [];
  return { ok: true as const, data: { changes: rows ?? [], months } };
}

/** Liga un indicador a un hito (su cierre lo comprobará) o lo deja para todo el plan. */
export async function linkObjectiveToMilestone(env: LoadedApiEnv, context: AuthContext, organizationId: string, targetId: string, milestoneId: unknown) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  if (milestoneId !== null && typeof milestoneId !== "string") return { ok: false as const, statusCode: 400, error: "invalid_milestone" };
  const service = createServiceClient(env);
  if (milestoneId) {
    const { data: milestone } = await service.from("strategic_plan_milestones").select("id").eq("id", milestoneId).eq("organization_id", organizationId).maybeSingle();
    if (!milestone) return { ok: false as const, statusCode: 400, error: "invalid_milestone" };
  }
  const { data, error } = await service.from("organization_metric_targets").update({ milestone_id: milestoneId || null }).eq("id", targetId).eq("organization_id", organizationId).select("id").maybeSingle();
  if (error?.code === "23505") {
    return { ok: false as const, statusCode: 409, error: "objective_already_linked", message: "Ese hito ya tiene un objetivo de esta métrica." };
  }
  if (error) return { ok: false as const, statusCode: 500, error: "objective_link_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "objective_not_found" };
  await auditStrategicChange(service, organizationId, context, "strategic_plan.link_objective", "organization_metric_target", data.id, { milestone_id: milestoneId || null });
  await refreshCostDependentCaches(env, organizationId);
  return { ok: true as const, data: { id: data.id } };
}

/**
 * Nueva cifra para la meta del Camino. Mismo criterio que al ajustar la
 * propuesta antes de aprobarla (adjustCaminoProposal): cambia la meta y el
 * objetivo mensual que la llevaba; el resto de meses no se reescala a ojo, la
 * revision del Camino propone como repartirlos.
 */
export function withGoalTarget(
  goal: Record<string, unknown>,
  target: number | null,
): Record<string, unknown> {
  const monthly = Array.isArray(goal.monthly_targets)
    ? (goal.monthly_targets as Array<Record<string, unknown>>)
    : null;
  if (!monthly?.length) return { ...goal, target };
  const match = monthly.findIndex((checkpoint) => checkpoint.target_value === goal.target);
  const goalIndex = match >= 0 ? match : monthly.length - 1;
  return {
    ...goal,
    target,
    monthly_targets: monthly.map((checkpoint, index) =>
      index === goalIndex ? { ...checkpoint, target_value: target } : checkpoint,
    ),
  };
}

export async function updatePlanGoalTarget(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
  input: { target?: unknown; reason?: unknown },
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;

  const target = input.target;
  if (target !== null && (typeof target !== "number" || !Number.isFinite(target) || target < 0)) {
    return { ok: false as const, statusCode: 400, error: "invalid_goal_target" };
  }
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : null;

  const supabase = createServiceClient(env);
  const { data: plan, error: planError } = await supabase
    .from("strategic_plans")
    .select("id, status, store_id, goal")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (planError) {
    return { ok: false as const, statusCode: 503, error: "plan_load_failed", detail: planError.message };
  }
  if (!plan) return { ok: false as const, statusCode: 404, error: "plan_not_found" };
  if (["archived", "completed"].includes(plan.status as string)) {
    return { ok: false as const, statusCode: 409, error: "plan_not_editable" };
  }
  const goal = plan.goal && typeof plan.goal === "object" && !Array.isArray(plan.goal)
    ? (plan.goal as Record<string, unknown>)
    : null;
  if (!goal) return { ok: false as const, statusCode: 409, error: "camino_plan_has_no_goal" };

  const previousValue = typeof goal.target === "number" ? goal.target : null;
  if (previousValue === target) return { ok: true as const, data: { id: planId } };

  const { error } = await supabase
    .from("strategic_plans")
    .update({ goal: withGoalTarget(goal, target as number | null) })
    .eq("id", planId)
    .eq("organization_id", organizationId);
  if (error) {
    return { ok: false as const, statusCode: 500, error: "plan_goal_update_failed", detail: error.message };
  }

  await auditStrategicChange(supabase, organizationId, context, "strategic_plan.set_goal_target", "strategic_plan", planId, {
    previous_value: previousValue,
    target,
    reason,
  });
  await recordObjectiveChange(supabase, context, {
    organizationId,
    storeId: (plan.store_id as string | null) ?? null,
    planId,
    scope: "plan_goal",
    metricKey: typeof goal.metric_key === "string" ? goal.metric_key : "goal",
    metricLabel: typeof goal.metric_label === "string" ? goal.metric_label : "Meta del Camino",
    unit: typeof goal.unit === "string" ? goal.unit : null,
    action: previousValue === null ? "created" : target === null ? "removed" : "updated",
    previousValue,
    newValue: target as number | null,
    reason,
  });
  if (plan.status === "active") {
    scheduleObjectiveChangeReview(env, context, organizationId, (plan.store_id as string | null) ?? null);
  }

  return { ok: true as const, data: { id: planId } };
}

// --- Tipos de objetivo (objective_definitions): CRUD del consultor --------

function assertConsultant(context: AuthContext) {
  if (
    context.profile.platform_role !== "platform_admin" &&
    context.profile.platform_role !== "consultant"
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message:
        "Solo el consultor puede gestionar tipos de objetivo.",
    };
  }
  return { ok: true as const };
}

type ObjectiveDefinitionInput = {
  label?: string;
  unit?: string;
  direction?: string;
  source?: string;
  metricKey?: string | null;
  organizationId?: string | null;
};

export async function listObjectiveDefinitions(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const authz = assertConsultant(context);
  if (authz.ok === false) {
    return authz;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("objective_definitions")
    .select(
      "id, organization_id, slug, label, unit, direction, source, metric_key, created_at",
    )
    .eq("owner_user_id", context.user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_definitions_load_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: {
      definitions: data ?? [],
      builtins: builtinCatalogEntries(),
    },
  };
}

export async function createObjectiveDefinition(
  env: ApiEnv,
  context: AuthContext,
  input: ObjectiveDefinitionInput,
) {
  const authz = assertConsultant(context);
  if (authz.ok === false) {
    return authz;
  }

  const label = (input.label ?? "").trim();
  if (!label || label.length > 120) {
    return { ok: false as const, statusCode: 400, error: "invalid_label" };
  }
  if (!OBJECTIVE_SOURCES.includes(input.source as never)) {
    return { ok: false as const, statusCode: 400, error: "invalid_source" };
  }
  const source = input.source as (typeof OBJECTIVE_SOURCES)[number];

  let unit = input.unit as string | undefined;
  let direction = input.direction as string | undefined;
  let metricKey: string | null = null;

  if (source === "manual") {
    if (!OBJECTIVE_UNITS.includes(unit as never)) {
      return { ok: false as const, statusCode: 400, error: "invalid_unit" };
    }
    if (!OBJECTIVE_DIRECTIONS.includes(direction as never)) {
      direction = "up";
    }
  } else {
    // De plataforma: la metrica manda -- unit/direction se toman del built-in
    // correspondiente para que el "actual" y el objetivo hablen el mismo idioma.
    if (!isObjectiveMetricKey(input.metricKey)) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_metric_key",
      };
    }
    const builtin = OBJECTIVE_CATALOG.find(
      (entry) => entry.key === input.metricKey,
    )!;
    if (builtin.source !== source) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "metric_source_mismatch",
      };
    }
    metricKey = builtin.key;
    unit = builtin.unit;
    direction = builtin.direction;
  }

  const supabase = createServiceClient(env);

  let organizationId: string | null = null;
  if (input.organizationId) {
    // Tipo ligado a un cliente concreto: el consultor debe tenerlo asignado
    // (platform_admin puede con cualquiera).
    if (context.profile.platform_role !== "platform_admin") {
      const { data: assignment } = await supabase
        .from("consultant_assignments")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("consultant_user_id", context.user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!assignment) {
        return {
          ok: false as const,
          statusCode: 403,
          error: "organization_not_assigned",
        };
      }
    }
    organizationId = input.organizationId;
  }

  const slug = `def_${globalThis.crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await supabase
    .from("objective_definitions")
    .insert({
      owner_user_id: context.user.id,
      organization_id: organizationId,
      slug,
      label,
      unit,
      direction,
      source,
      metric_key: metricKey,
    })
    .select(
      "id, organization_id, slug, label, unit, direction, source, metric_key, created_at",
    )
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_definition_save_failed",
      detail: error?.message,
    };
  }

  return { ok: true as const, data };
}

export async function updateObjectiveDefinition(
  env: ApiEnv,
  context: AuthContext,
  definitionId: string,
  input: ObjectiveDefinitionInput,
) {
  const authz = assertConsultant(context);
  if (authz.ok === false) {
    return authz;
  }

  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label || label.length > 120) {
      return { ok: false as const, statusCode: 400, error: "invalid_label" };
    }
    patch.label = label;
  }
  if (input.unit !== undefined) {
    if (!OBJECTIVE_UNITS.includes(input.unit as never)) {
      return { ok: false as const, statusCode: 400, error: "invalid_unit" };
    }
    patch.unit = input.unit;
  }
  if (input.direction !== undefined) {
    if (!OBJECTIVE_DIRECTIONS.includes(input.direction as never)) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_direction",
      };
    }
    patch.direction = input.direction;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "empty_update" };
  }

  const supabase = createServiceClient(env);
  let query = supabase
    .from("objective_definitions")
    .update(patch)
    .eq("id", definitionId);
  if (context.profile.platform_role !== "platform_admin") {
    query = query.eq("owner_user_id", context.user.id);
  }
  const { data, error } = await query
    .select(
      "id, organization_id, slug, label, unit, direction, source, metric_key, created_at",
    )
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_definition_update_failed",
      detail: error.message,
    };
  }
  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "objective_definition_not_found",
    };
  }

  return { ok: true as const, data };
}

export async function archiveObjectiveDefinition(
  env: ApiEnv,
  context: AuthContext,
  definitionId: string,
) {
  const authz = assertConsultant(context);
  if (authz.ok === false) {
    return authz;
  }

  const supabase = createServiceClient(env);
  let query = supabase
    .from("objective_definitions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", definitionId)
    .is("archived_at", null);
  if (context.profile.platform_role !== "platform_admin") {
    query = query.eq("owner_user_id", context.user.id);
  }
  const { data, error } = await query.select("id").maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "objective_definition_archive_failed",
      detail: error.message,
    };
  }
  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "objective_definition_not_found",
    };
  }

  return { ok: true as const, data: { id: data.id } };
}

export async function linkTaskToMilestone(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  milestoneId: string,
  taskId: string | undefined,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (!taskId) {
    return { ok: false as const, statusCode: 400, error: "missing_task_id" };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("milestone_task_links")
    .upsert(
      {
        organization_id: organizationId,
        milestone_id: milestoneId,
        task_id: taskId,
      },
      { onConflict: "milestone_id,task_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    // El trigger de integridad cross-org convierte enlaces invalidos en excepcion.
    return {
      ok: false as const,
      statusCode: 400,
      error: "milestone_task_link_failed",
      detail: error?.message,
    };
  }

  const reopened = await reopenCaminoMilestoneForWork(
    supabase,
    organizationId,
    milestoneId,
    context.user.id,
    taskId,
  );
  if (!reopened.ok) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "milestone_reopen_failed",
      detail: reopened.detail,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.link_task",
    "milestone_task_link",
    data.id,
    {
      milestone_id: milestoneId,
      task_id: taskId,
    },
  );
  return { ok: true as const, data: { id: data.id } };
}

/**
 * Mejor hito de Mi Camino para enlazar una tarea generada automaticamente
 * (agente IA o motor de alertas) cuando quien la crea no propuso un
 * `milestone_id` explicito -- gap detectado en DB-07 2026-07-29: sin esto,
 * las tareas automaticas y el plan estrategico eran dos sistemas
 * desconectados. Heuristica: el plan activo de la organizacion, su fase
 * activa, y dentro de ella el hito de menor `position` que todavia no esta
 * completado/omitido -- el hito "en el que esta trabajando el cliente ahora
 * mismo". Best-effort: devuelve null (nunca lanza) si no hay plan activo,
 * fase activa o hito pendiente; llamar a esto nunca debe bloquear la
 * creacion de la tarea en si.
 */
export async function findCurrentMilestoneId(
  supabase: SupabaseClient,
  organizationId: string,
  storeId?: string | null,
): Promise<string | null> {
  try {
    let planQuery = supabase
      .from("strategic_plans")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active");
    if (storeId === null) planQuery = planQuery.is("store_id", null);
    else if (storeId) planQuery = planQuery.eq("store_id", storeId);
    const { data: plan } = await planQuery.maybeSingle();

    if (!plan) return null;

    const { data: phase } = await supabase
      .from("strategic_plan_phases")
      .select("id")
      .eq("plan_id", plan.id)
      .eq("status", "active")
      .maybeSingle();

    if (!phase) return null;

    const { data: milestone } = await supabase
      .from("strategic_plan_milestones")
      .select("id")
      .eq("phase_id", phase.id)
      .in("status", ["pending", "in_progress"])
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    return milestone?.id ?? null;
  } catch {
    return null;
  }
}

const MILESTONE_TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

type MilestoneTaskInput = {
  title?: string | undefined;
  description?: string | null | undefined;
  priority?: string | undefined;
  dueAt?: string | null | undefined;
};

/** Crea una tarea nueva con contexto de plan (source `strategic_plan`) y la
 * enlaza al hito en el mismo paso -- tanto el consultor como la IA (via
 * `proposed_writes` con `milestone_id`, ver ai-runtime.ts) necesitan crear una
 * tarea que ya sabe a que hito pertenece, sin el paso intermedio de
 * crear-y-luego-enlazar de linkTaskToMilestone. */
export async function createMilestoneTask(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  milestoneId: string,
  input: MilestoneTaskInput,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const title = input.title?.trim() ?? "";

  if (!title) {
    return { ok: false as const, statusCode: 400, error: "missing_task_title" };
  }

  const priority =
    input.priority && MILESTONE_TASK_PRIORITIES.includes(input.priority)
      ? input.priority
      : "medium";

  const supabase = createServiceClient(env);

  const { data: milestone, error: milestoneError } = await supabase
    .from("strategic_plan_milestones")
    .select("id, strategic_plan_phases!inner(strategic_plans!inner(store_id))")
    .eq("id", milestoneId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (milestoneError || !milestone) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "milestone_not_found",
    };
  }

  // La tarea hereda la tienda del camino al que pertenece su hito.
  const phaseRel = milestone.strategic_plan_phases as unknown as
    | { strategic_plans?: { store_id?: string | null } | Array<{ store_id?: string | null }> | null }
    | Array<{ strategic_plans?: { store_id?: string | null } | Array<{ store_id?: string | null }> | null }>
    | null;
  const phaseRow = Array.isArray(phaseRel) ? phaseRel[0] : phaseRel;
  const planRow = Array.isArray(phaseRow?.strategic_plans) ? phaseRow?.strategic_plans[0] : phaseRow?.strategic_plans;
  const planStoreId = planRow?.store_id ?? null;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      store_id: planStoreId,
      source: "strategic_plan",
      priority,
      categories: ["general"],
      title: title.slice(0, 255),
      description: input.description ?? null,
      due_at: input.dueAt ?? null,
      created_by: context.user.id,
      assigned_to: context.user.id,
    })
    .select("id, title, status, priority, due_at, categories, source")
    .single();

  if (taskError || !task) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "task_create_failed",
      detail: taskError?.message,
    };
  }

  const { error: linkError } = await supabase
    .from("milestone_task_links")
    .insert({
      organization_id: organizationId,
      milestone_id: milestoneId,
      task_id: task.id,
    });

  if (linkError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "milestone_task_link_failed",
      detail: linkError.message,
    };
  }

  const reopened = await reopenCaminoMilestoneForWork(
    supabase,
    organizationId,
    milestoneId,
    context.user.id,
    task.id,
  );
  if (!reopened.ok) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "milestone_reopen_failed",
      detail: reopened.detail,
    };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.create_task",
    "task",
    task.id,
    {
      milestone_id: milestoneId,
      source: "strategic_plan",
    },
  );
  return { ok: true as const, data: task };
}

/**
 * Traduce la propuesta de A19 a la forma que espera `createStrategicPlan`.
 *
 * Dos decisiones que viven aqui:
 *  - El modelo devuelve `target_offset_days` (dias desde hoy) y no fechas
 *    absolutas, porque no tiene reloj fiable. El ancla es el momento de
 *    GENERAR: el modelo razona sobre ese dia y sus fechas comerciales no se
 *    mueven al aceptar. Por eso una propuesta caduca (`proposalExpired`).
 *  - `success_metric` se pliega dentro de la descripcion del hito. Es lo que
 *    hace verificable "completar" y `strategic_plan_milestones` no tiene
 *    columna propia para el; perderlo dejaria hitos que se marcan a ojo.
 */
export function caminoProposalToPlanInput(
  proposal: CaminoPlanOutput,
  anchorMs: number,
  storeId?: string | null,
  baselineWindowDays?: number | null,
  baselineObservedAt?: string | null,
): PlanInput {
  const toTargetDate = (offsetDays: number) =>
    new Date(anchorMs + offsetDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  const horizonEnd = proposal.horizon_months ? toTargetDate(caminoCalendarHorizonDays(new Date(anchorMs), proposal.horizon_months)) : null;
  // Con meses reales, la fecha de la meta es la de su mes: si no, 75.000 de noviembre vencen en diciembre.
  const goalMonth = proposal.goal?.monthly_targets?.find((month) => month.period && month.target_value === proposal.goal?.target);
  const goalMonthEnd = goalMonth?.period ? endOfMonth(goalMonth.period) : null;

  return {
    name: proposal.plan_name,
    description: proposal.diagnosis,
    goal: proposal.goal ? {
      ...proposal.goal,
      ...(typeof baselineWindowDays === "number" && Number.isInteger(baselineWindowDays) && baselineWindowDays >= 1 && baselineWindowDays <= 365
        ? { baseline_window_days: baselineWindowDays }
        : {}),
      ...(baselineObservedAt ? { baseline_observed_at: baselineObservedAt } : {}),
      target_date: goalMonthEnd ? (horizonEnd && horizonEnd < goalMonthEnd ? horizonEnd : goalMonthEnd) : toTargetDate(proposal.goal.target_offset_days),
      ...(horizonEnd ? { horizon_end_date: horizonEnd } : {}),
    } : proposal.goal,
    storeId: storeId ?? null,
    ...(proposal.horizon_months === undefined ? {} : { horizonMonths: proposal.horizon_months }),
    phases: proposal.phases.map((phase) => ({
      name: phase.name,
      description: phase.description,
      rationale: phase.rationale,
      evidence: phase.evidence,
      milestones: phase.milestones.map((milestone) => ({
        name: milestone.name,
        // El criterio vive tambien en su columna; se mantiene en la descripcion
        // para las pantallas que aun lo separan con splitCriterion.
        description: `${milestone.description}\n\nCriterio de exito: ${milestone.success_metric}`,
        successCriteria: milestone.success_metric,
        rationale: milestone.rationale || null,
        targetDate: toTargetDate(milestone.target_offset_days),
        sourceMilestoneId: milestone.source_milestone_id ?? null,
        changeReason: milestone.change_reason ?? null,
        tasks: milestone.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          dueAt: toTargetDate(task.target_offset_days),
          priority: task.priority,
          owner: task.owner,
          kind: task.kind,
          track: task.track,
          cadence: task.cadence,
          effortHours: task.effort_hours,
          definitionOfDone: task.definition_of_done || null,
          evidence: task.evidence,
          sourceTaskId: task.source_task_id ?? null,
          changeReason: task.change_reason ?? null,
        })),
      })),
    })),
  };
}

/**
 * Descarta una propuesta de A19. Queda guardada en servidor (antes solo vivia
 * en el navegador de quien la rechazo): GET camino-proposal ya no la devuelve,
 * y el motivo alimenta la siguiente propuesta como rechazo previo.
 */
export async function rejectCaminoProposalOutput(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  outputId: string,
  reason: string,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;

  const supabase = createServiceClient(env);
  const { data: output, error: outputError } = await supabase
    .from("agent_outputs")
    .select("id, status, agent_runs!inner(agent_versions!inner(agent_definitions!inner(code)))")
    .eq("id", outputId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (outputError) {
    return { ok: false as const, statusCode: 500, error: "plan_proposal_load_failed", detail: outputError.message };
  }
  if (!output) return { ok: false as const, statusCode: 404, error: "plan_proposal_not_found" };

  const runs = output.agent_runs as unknown as
    | { agent_versions?: { agent_definitions?: { code?: string } | Array<{ code?: string }> } | Array<{ agent_definitions?: { code?: string } | Array<{ code?: string }> }> }
    | null;
  const run = Array.isArray(runs) ? runs[0] : runs;
  const version = Array.isArray(run?.agent_versions) ? run?.agent_versions[0] : run?.agent_versions;
  const definition = Array.isArray(version?.agent_definitions) ? version?.agent_definitions[0] : version?.agent_definitions;
  if (definition?.code !== "a19_arquitecto_camino") {
    return { ok: false as const, statusCode: 400, error: "plan_proposal_wrong_agent", message: "Esa salida de IA no es una propuesta de camino." };
  }
  if (output.status === "published") {
    return { ok: false as const, statusCode: 409, error: "plan_proposal_already_applied", message: "Esta propuesta ya se convirtio en un plan." };
  }

  const cleanReason = reason.trim().slice(0, 500);
  // La condicion de estado evita pisar una propuesta que otro usuario acaba de aceptar.
  const { data: updated, error: updateError } = await supabase
    .from("agent_outputs")
    .update({ status: "rejected" })
    .eq("id", outputId)
    .eq("organization_id", organizationId)
    .neq("status", "published")
    .select("id")
    .maybeSingle();
  if (updateError) {
    return { ok: false as const, statusCode: 500, error: "plan_proposal_reject_failed", detail: updateError.message };
  }
  if (!updated) {
    return { ok: false as const, statusCode: 409, error: "plan_proposal_already_applied", message: "Esta propuesta ya se convirtio en un plan." };
  }

  const { error: approvalError } = await supabase.from("agent_approvals").insert({
    output_id: outputId,
    organization_id: organizationId,
    decision: "rejected",
    decided_by: context.user.id,
    reason: cleanReason || null,
  });
  if (approvalError) {
    logger.error("camino_proposal_reject_log_failed", { organization_id: organizationId, output_id: outputId, error: approvalError.message });
  }
  return { ok: true as const, data: { output_id: outputId, status: "rejected" as const } };
}

/**
 * Convierte una propuesta de A19 (arquitecto del camino) en un plan real.
 *
 * La IA propone; el plan solo existe cuando un humano pulsa crear -- criterio
 * "ver vs escribir" de AI-02. Y nace en `draft`: activarlo sigue siendo un
 * segundo gesto deliberado, igual que un plan escrito a mano.
 *
 * El modelo devuelve `target_offset_days` (dias desde hoy) en vez de fechas
 * absolutas porque no tiene reloj fiable; la fecha se calcula aqui, anclada al
 * momento de generar. Reanclar al aceptar movia Black Friday y cambiaba de mes
 * las metas; una propuesta vieja caduca en vez de desplazarse.
 */
export async function createStrategicPlanFromProposal(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  outputId: string,
  adjustments: { horizonMonths?: unknown; goalTarget?: unknown; currencyCode?: unknown } = {},
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const supabase = createServiceClient(env);

  // El output se busca acotado a la organizacion: un id de otra cuenta no
  // resuelve, no "resuelve y luego se comprueba".
  const { data: output, error: outputError } = await supabase
    .from("agent_outputs")
    .select(
      "id, status, output, organization_id, agent_runs!inner(store_id, started_at, lookback_days, agent_versions!inner(agent_definitions!inner(code)))",
    )
    .eq("id", outputId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (outputError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "plan_proposal_load_failed",
      detail: outputError.message,
    };
  }

  if (!output) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "plan_proposal_not_found",
    };
  }

  const runs = output.agent_runs as
    | { store_id?: string | null; started_at?: string | null; lookback_days?: number | null; agent_versions?: { agent_definitions?: { code?: string } } }
    | Array<{ store_id?: string | null; started_at?: string | null; lookback_days?: number | null; agent_versions?: { agent_definitions?: { code?: string } } }>
    | null;
  const run = Array.isArray(runs) ? runs[0] : runs;
  const versions = run?.agent_versions;
  const version = Array.isArray(versions) ? versions[0] : versions;
  const definitions = version?.agent_definitions;
  const definition = Array.isArray(definitions) ? definitions[0] : definitions;

  if (definition?.code !== "a19_arquitecto_camino") {
    return {
      ok: false as const,
      statusCode: 400,
      error: "plan_proposal_wrong_agent",
      message: "Esa salida de IA no es una propuesta de camino.",
    };
  }

  if (output.status === "published") {
    return {
      ok: false as const,
      statusCode: 409,
      error: "plan_proposal_already_applied",
      message: "Esta propuesta ya se convirtio en un plan.",
    };
  }

  const parsed = caminoPlanOutputSchema.safeParse(output.output);
  if (!parsed.success) {
    return {
      ok: false as const,
      statusCode: 422,
      error: "plan_proposal_invalid",
      detail: parsed.error.message,
    };
  }
  if (parsed.data.replan_source) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "plan_proposal_is_replan",
      message: "Esta propuesta es una replanificación: se confirma desde Replanificar.",
    };
  }
  if (proposalExpired(run?.started_at)) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "plan_proposal_expired",
      message: "Esta propuesta ha caducado: sus fechas y metas ya no valen. Genera otra.",
    };
  }
  const anchor = new Date(run?.started_at as string);

  let reviewedProposal = parsed.data;
  if (adjustments.horizonMonths !== undefined || Object.prototype.hasOwnProperty.call(adjustments, "goalTarget")) {
    const horizonMonths = adjustments.horizonMonths === undefined ? parsed.data.horizon_months : Number(adjustments.horizonMonths);
    if (!Number.isInteger(horizonMonths) || (horizonMonths ?? 0) < 1 || (horizonMonths ?? 0) > 12) {
      return { ok: false as const, statusCode: 400, error: "invalid_camino_adjusted_horizon" };
    }
    const goalTarget = Object.prototype.hasOwnProperty.call(adjustments, "goalTarget")
      ? adjustments.goalTarget
      : parsed.data.goal?.target ?? null;
    if (goalTarget !== null && (typeof goalTarget !== "number" || !Number.isFinite(goalTarget))) {
      return { ok: false as const, statusCode: 400, error: "invalid_camino_adjusted_goal_target" };
    }
    if (!parsed.data.goal && goalTarget !== null) {
      return { ok: false as const, statusCode: 400, error: "camino_proposal_has_no_goal" };
    }
    reviewedProposal = adjustCaminoProposal(parsed.data, horizonMonths!, goalTarget as number | null, anchor);
    if (reviewedProposal.phases.length === 0) {
      return {
        ok: false as const,
        statusCode: 422,
        error: "camino_horizon_too_short",
        message: "Con ese plazo no cabe ningún hito: las fechas del Camino son de calendario y no se comprimen. Elige un plazo mayor o replanifica.",
      };
    }
    const reviewedValidation = caminoPlanOutputSchema.safeParse(reviewedProposal);
    if (!reviewedValidation.success) {
      return { ok: false as const, statusCode: 422, error: "camino_adjustment_invalid", detail: reviewedValidation.error.message };
    }
  }

  const created = await createStrategicPlan(
    env,
    context,
    organizationId,
    {
      ...caminoProposalToPlanInput(reviewedProposal, anchor.getTime(), run?.store_id ?? null, run?.lookback_days, run?.started_at),
      // La propuesta se publica dentro de la misma transaccion que crea el plan.
      outputId,
      currencyCode: normalizeCurrencyCode(adjustments.currencyCode) ?? reviewedProposal.goal?.currency_code ?? null,
    },
  );

  if (created.ok === false) return created;

  const { error: approvalError } = await supabase.from("agent_approvals").insert({
    output_id: outputId,
    organization_id: organizationId,
    decision: "approved",
    decided_by: context.user.id,
    reason: `Camino creado como plan ${created.data.id}; plazo=${reviewedProposal.horizon_months ?? "original"}; objetivo=${reviewedProposal.goal?.target ?? "sin target"}`,
  });
  // El plan ya existe y la propuesta ya esta publicada (misma transaccion): un
  // fallo del registro de aprobacion no debe tumbar la respuesta, pero si verse.
  if (approvalError) {
    logger.error("camino_proposal_approval_log_failed", {
      organization_id: organizationId,
      output_id: outputId,
      error: approvalError.message,
    });
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.create_from_ai_proposal",
    "strategic_plan",
    created.data.id,
    {
      output_id: outputId,
      phases: parsed.data.phases.length,
      milestones: parsed.data.phases.reduce(
        (total, phase) => total + phase.milestones.length,
        0,
      ),
      accepted_horizon_months: reviewedProposal.horizon_months ?? null,
      accepted_goal_target: reviewedProposal.goal?.target ?? null,
    },
  );

  return { ok: true as const, data: { id: created.data.id, store_id: run?.store_id ?? null } };
}
