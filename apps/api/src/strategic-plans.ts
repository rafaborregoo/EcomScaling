import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  type AuthContext,
  createUserScopedClient,
  requireOperationalOrganization,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { getShopifyMetrics } from "./shopify-metrics.js";
import { getMetaMetrics } from "./meta-metrics.js";

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
export const OBJECTIVE_CATALOG = [
  { key: "net_sales", label: "Ingresos netos", unit: "money", direction: "up", source: "shopify" },
  { key: "net_profit", label: "Beneficio neto", unit: "money", direction: "up", source: "shopify" },
  { key: "net_margin_pct", label: "Margen neto", unit: "pct", direction: "up", source: "shopify" },
  { key: "orders_count", label: "Pedidos", unit: "count", direction: "up", source: "shopify" },
  { key: "aov", label: "Ticket medio (AOV)", unit: "money", direction: "up", source: "shopify" },
  { key: "roas", label: "ROAS Meta Ads", unit: "ratio", direction: "up", source: "meta" },
  { key: "cac", label: "CAC Meta Ads", unit: "money", direction: "down", source: "meta" },
  { key: "out_of_stock_items", label: "Productos agotados", unit: "count", direction: "down", source: "shopify" },
] as const;

type ObjectiveMetricKey = (typeof OBJECTIVE_CATALOG)[number]["key"];

function createServiceClient(env: ApiEnv) {
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

function requireMembership(context: AuthContext, organizationId: string) {
  return requireOperationalOrganization(context, organizationId);
}

function assertCanManagePlan(context: AuthContext, organizationId: string) {
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
        "Solo owner, manager, consultor o platform admin pueden gestionar el plan.",
    };
  }

  return { ok: true as const };
}

export async function getStrategicPlan(
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

  // Ultimo plan no archivado con toda su estructura; las notas internas van
  // aparte porque su RLS ya limita a consultores/admins.
  const { data: plan, error } = await supabase
    .from("strategic_plans")
    .select(
      "id, name, description, status, version, starts_on, completed_on, approved_at, created_at, strategic_plan_phases(id, name, description, position, status, activated_at, completed_at, created_by, strategic_plan_milestones(id, name, description, position, status, target_date, completed_at, created_by, milestone_task_links(task_id, tasks(id, title, status, priority, due_at, categories, source, created_by))))",
    )
    .eq("organization_id", organizationId)
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
  }

  return {
    ok: true as const,
    data: { organization_id: organizationId, plan: plan ?? null },
  };
}

type PlanWithPhases = {
  strategic_plan_phases: Array<{
    created_by: string | null;
    created_by_origin?: "consultant" | "client" | null;
    strategic_plan_milestones: Array<{
      created_by: string | null;
      created_by_origin?: "consultant" | "client" | null;
      milestone_task_links: Array<{
        tasks: {
          created_by: string | null;
          created_by_origin?: "consultant" | "client" | null;
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
      }
    }
  }

  if (creatorIds.size === 0) {
    return;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, platform_role")
    .in("id", Array.from(creatorIds));

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
        }
      }
    }
  }
}

type PlanInput = {
  name?: string;
  description?: string | null;
  phases?: Array<{
    name?: string;
    description?: string | null;
    milestones?: Array<{
      name?: string;
      description?: string | null;
      targetDate?: string | null;
    }>;
  }>;
};

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

  const phases = (input.phases ?? []).filter(
    (phase) => phase.name && phase.name.trim().length > 0,
  );

  if (phases.length === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_plan_phases",
    };
  }

  const supabase = createServiceClient(env);

  const { data: latest, error: latestError } = await supabase
    .from("strategic_plans")
    .select("id, version, status")
    .eq("organization_id", organizationId)
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

  const { data: plan, error: planError } = await supabase
    .from("strategic_plans")
    .insert({
      organization_id: organizationId,
      name: input.name.trim().slice(0, 255),
      description: input.description ?? null,
      version: (latest?.version ?? 0) + 1,
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "plan_create_failed",
      detail: planError?.message,
    };
  }

  for (const [phaseIndex, phase] of phases.entries()) {
    const { data: phaseRow, error: phaseError } = await supabase
      .from("strategic_plan_phases")
      .insert({
        organization_id: organizationId,
        plan_id: plan.id,
        name: phase.name!.trim().slice(0, 255),
        description: phase.description ?? null,
        position: phaseIndex + 1,
        created_by: context.user.id,
      })
      .select("id")
      .single();

    if (phaseError || !phaseRow) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "plan_phase_create_failed",
        detail: phaseError?.message,
      };
    }

    const milestones = (phase.milestones ?? []).filter(
      (milestone) => milestone.name && milestone.name.trim().length > 0,
    );

    for (const [milestoneIndex, milestone] of milestones.entries()) {
      const { error: milestoneError } = await supabase
        .from("strategic_plan_milestones")
        .insert({
          organization_id: organizationId,
          phase_id: phaseRow.id,
          name: milestone.name!.trim().slice(0, 255),
          description: milestone.description ?? null,
          position: milestoneIndex + 1,
          target_date: milestone.targetDate ?? null,
          created_by: context.user.id,
        });

      if (milestoneError) {
        return {
          ok: false as const,
          statusCode: 500,
          error: "plan_milestone_create_failed",
          detail: milestoneError.message,
        };
      }
    }
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.create",
    "strategic_plan",
    plan.id,
    {
      name: input.name,
      phases: phases.length,
    },
  );
  return { ok: true as const, data: { id: plan.id } };
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

const MILESTONE_ACTIONS = ["in_progress", "completed", "skipped"] as const;

export async function updateMilestoneStatus(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  milestoneId: string,
  statusInput: string | undefined,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (
    !statusInput ||
    !MILESTONE_ACTIONS.includes(
      statusInput as (typeof MILESTONE_ACTIONS)[number],
    )
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_milestone_status",
    };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data: milestone, error } = await supabase
    .from("strategic_plan_milestones")
    .update({
      status: statusInput,
      ...(statusInput === "completed"
        ? { completed_at: now, completed_by: context.user.id }
        : {}),
    })
    .eq("id", milestoneId)
    .eq("organization_id", organizationId)
    .not("status", "eq", "locked")
    .select("id, phase_id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "milestone_update_failed",
      detail: error.message,
    };
  }

  if (!milestone) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "milestone_not_found_or_locked",
    };
  }

  if (statusInput !== "completed" && statusInput !== "skipped") {
    await auditStrategicChange(
      supabase,
      organizationId,
      context,
      "strategic_plan.update_milestone_status",
      "strategic_plan_milestone",
      milestone.id,
      { status: statusInput },
    );
    return {
      ok: true as const,
      data: { id: milestone.id, status: statusInput },
    };
  }

  // Si la fase quedo sin hitos abiertos, se completa y se desbloquea la siguiente.
  const { data: remaining, error: remainingError } = await supabase
    .from("strategic_plan_milestones")
    .select("id")
    .eq("phase_id", milestone.phase_id)
    .not("status", "in", "(completed,skipped)")
    .limit(1);

  if (remainingError || (remaining ?? []).length > 0) {
    await auditStrategicChange(
      supabase,
      organizationId,
      context,
      "strategic_plan.update_milestone_status",
      "strategic_plan_milestone",
      milestone.id,
      { status: statusInput },
    );
    return {
      ok: true as const,
      data: { id: milestone.id, status: statusInput },
    };
  }

  const { data: phase } = await supabase
    .from("strategic_plan_phases")
    .update({ status: "completed", completed_at: now })
    .eq("id", milestone.phase_id)
    .select("id, plan_id, position")
    .maybeSingle();

  if (phase) {
    const { data: nextPhase } = await supabase
      .from("strategic_plan_phases")
      .select("id")
      .eq("plan_id", phase.plan_id)
      .eq("status", "pending")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextPhase) {
      await supabase
        .from("strategic_plan_phases")
        .update({
          status: "active",
          activated_at: now,
          activated_by: context.user.id,
        })
        .eq("id", nextPhase.id);
      await supabase
        .from("strategic_plan_milestones")
        .update({ status: "pending" })
        .eq("phase_id", nextPhase.id)
        .eq("status", "locked");
    } else {
      // Sin fases pendientes: el plan esta completo.
      await supabase
        .from("strategic_plans")
        .update({
          status: "completed",
          completed_on: new Date().toISOString().slice(0, 10),
        })
        .eq("id", phase.plan_id)
        .eq("status", "active");
    }
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.update_milestone_status",
    "strategic_plan_milestone",
    milestone.id,
    { status: statusInput },
  );
  return { ok: true as const, data: { id: milestone.id, status: statusInput } };
}

type PhaseCreateInput = {
  name?: string | undefined;
  description?: string | null | undefined;
};

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
async function resolveObjectiveCatalog(
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
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const today = new Date().toISOString().slice(0, 10);

  const { data: targets, error } = await supabase
    .from("organization_metric_targets")
    .select("id, metric_key, target_value, period, valid_from, created_by")
    .eq("organization_id", organizationId)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("created_at", { ascending: true });

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

  const [shopifyResult, metaResult] = await Promise.all([
    getShopifyMetrics(env, authorization, context, organizationId, "30"),
    getMetaMetrics(env, authorization, context, organizationId, "30"),
  ]);

  const actuals: Record<string, number | null> = {};
  if (shopifyResult.ok) {
    const data = shopifyResult.data as any;
    actuals.net_sales = data.sales?.net_sales ?? null;
    actuals.orders_count = data.sales?.orders_count ?? null;
    actuals.aov = data.sales?.aov ?? null;
    actuals.net_profit = data.financial?.net_profit ?? null;
    actuals.net_margin_pct = data.financial?.net_margin_pct ?? null;
    actuals.out_of_stock_items = data.stock?.out_of_stock_items ?? null;
  }
  if (metaResult.ok) {
    const data = metaResult.data as any;
    actuals.roas = data.acquisition?.roas ?? null;
    actuals.cac = data.acquisition?.cac ?? null;
  }

  const objectives = (targets ?? [])
    .filter((target) => catalogByKey.has(target.metric_key as string))
    .map((target) => {
      const catalogEntry = catalogByKey.get(target.metric_key as string)!;
      const actual =
        catalogEntry.source === "manual"
          ? (manualById.get(target.id as string) ?? null)
          : (catalogEntry.metric_key
              ? actuals[catalogEntry.metric_key]
              : null) ?? null;
      const targetValue = Number(target.target_value);
      let progressPct: number | null = null;
      if (actual !== null) {
        if (catalogEntry.direction === "up") {
          progressPct = targetValue > 0 ? (actual / targetValue) * 100 : 100;
        } else {
          progressPct =
            actual <= targetValue
              ? 100
              : targetValue > 0
                ? (targetValue / actual) * 100
                : 0;
        }
      }
      return {
        id: target.id,
        metric_key: target.metric_key,
        label: catalogEntry.label,
        unit: catalogEntry.unit,
        direction: catalogEntry.direction,
        source: catalogEntry.source,
        target_value: targetValue,
        period: target.period,
        actual_value: actual,
        progress_pct: progressPct,
        status:
          actual === null
            ? "sin_datos"
            : progressPct !== null && progressPct >= 100
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
};

export async function createObjective(
  env: ApiEnv,
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
  const period = ["monthly", "quarterly", "yearly"].includes(
    input.period ?? "",
  )
    ? (input.period as string)
    : "monthly";

  const supabase = createServiceClient(env);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Un objetivo nuevo para la misma metrica reemplaza al anterior en vez de
  // apilarse -- cierra el que estuviera vigente (mismo patron que "editar"
  // en el resto de configuracion financiera de esta organizacion).
  await supabase
    .from("organization_metric_targets")
    .update({ valid_until: yesterday })
    .eq("organization_id", organizationId)
    .eq("metric_key", input.metricKey)
    .is("valid_until", null);

  const { data, error } = await supabase
    .from("organization_metric_targets")
    .insert({
      organization_id: organizationId,
      metric_key: input.metricKey,
      target_value: input.targetValue,
      period,
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
    { metric_key: input.metricKey, target_value: input.targetValue, period },
  );

  return { ok: true as const, data: { id: data.id } };
}

export async function deactivateObjective(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  targetId: string,
) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const supabase = createServiceClient(env);
  // Cerrar en "ayer", no "hoy": getObjectives incluye las filas con
  // valid_until >= hoy, asi que valid_until = hoy dejaba el objetivo visible
  // hasta el dia siguiente y "Quitar objetivo" parecia no hacer nada. Mismo
  // criterio con el que createObjective cierra el objetivo que reemplaza.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("organization_metric_targets")
    .update({ valid_until: yesterday })
    .eq("id", targetId)
    .eq("organization_id", organizationId)
    .select("id")
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
    return { ok: false as const, statusCode: 404, error: "objective_not_found" };
  }

  await auditStrategicChange(
    supabase,
    organizationId,
    context,
    "strategic_plan.remove_objective",
    "organization_metric_target",
    data.id,
  );

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
    return { ok: false as const, statusCode: 404, error: "objective_not_found" };
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
        "Solo un consultor o platform admin puede gestionar tipos de objetivo.",
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
      return { ok: false as const, statusCode: 400, error: "invalid_direction" };
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
): Promise<string | null> {
  try {
    const { data: plan } = await supabase
      .from("strategic_plans")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();

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

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      source: "strategic_plan",
      priority,
      categories: ["general"],
      title: title.slice(0, 255),
      description: input.description ?? null,
      due_at: input.dueAt ?? null,
      created_by: context.user.id,
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
