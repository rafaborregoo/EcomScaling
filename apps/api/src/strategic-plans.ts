import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requireMembership(context: AuthContext, organizationId: string) {
  const membership = context.memberships.find((item) => item.organization_id === organizationId);

  if (!membership) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  return { ok: true as const, membership };
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
      message: "Solo owner, manager, consultor o platform admin pueden gestionar el plan.",
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
      "id, name, description, status, version, starts_on, completed_on, approved_at, created_at, strategic_plan_phases(id, name, description, position, status, activated_at, completed_at, strategic_plan_milestones(id, name, description, position, status, target_date, completed_at, milestone_task_links(task_id)))",
    )
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "plan_load_failed", detail: error.message };
  }

  return { ok: true as const, data: { organization_id: organizationId, plan: plan ?? null } };
}

type PlanInput = {
  name?: string;
  description?: string | null;
  phases?: Array<{
    name?: string;
    description?: string | null;
    milestones?: Array<{ name?: string; description?: string | null; targetDate?: string | null }>;
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

  const phases = (input.phases ?? []).filter((phase) => phase.name && phase.name.trim().length > 0);

  if (phases.length === 0) {
    return { ok: false as const, statusCode: 400, error: "missing_plan_phases" };
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
    return { ok: false as const, statusCode: 500, error: "plan_version_lookup_failed", detail: latestError.message };
  }

  if (latest && ["draft", "active"].includes(latest.status)) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "plan_already_open",
      message: "Ya existe un plan en borrador o activo. Archivalo o completalo antes de crear otro.",
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
    return { ok: false as const, statusCode: 500, error: "plan_create_failed", detail: planError?.message };
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
      })
      .select("id")
      .single();

    if (phaseError || !phaseRow) {
      return { ok: false as const, statusCode: 500, error: "plan_phase_create_failed", detail: phaseError?.message };
    }

    const milestones = (phase.milestones ?? []).filter(
      (milestone) => milestone.name && milestone.name.trim().length > 0,
    );

    for (const [milestoneIndex, milestone] of milestones.entries()) {
      const { error: milestoneError } = await supabase.from("strategic_plan_milestones").insert({
        organization_id: organizationId,
        phase_id: phaseRow.id,
        name: milestone.name!.trim().slice(0, 255),
        description: milestone.description ?? null,
        position: milestoneIndex + 1,
        target_date: milestone.targetDate ?? null,
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
    return { ok: false as const, statusCode: 500, error: "plan_activate_failed", detail: error.message };
  }

  if (!plan) {
    return { ok: false as const, statusCode: 404, error: "draft_plan_not_found" };
  }

  // La primera fase se activa; el resto queda pendiente en orden.
  const { data: phases, error: phasesError } = await supabase
    .from("strategic_plan_phases")
    .select("id, position")
    .eq("plan_id", planId)
    .order("position", { ascending: true });

  if (phasesError) {
    return { ok: false as const, statusCode: 500, error: "plan_phases_load_failed", detail: phasesError.message };
  }

  for (const [index, phase] of (phases ?? []).entries()) {
    await supabase
      .from("strategic_plan_phases")
      .update(
        index === 0
          ? { status: "active", activated_at: now, activated_by: context.user.id }
          : { status: "pending" },
      )
      .eq("id", phase.id);

    await supabase
      .from("strategic_plan_milestones")
      .update({ status: index === 0 ? "pending" : "locked" })
      .eq("phase_id", phase.id);
  }

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

  if (!statusInput || !MILESTONE_ACTIONS.includes(statusInput as (typeof MILESTONE_ACTIONS)[number])) {
    return { ok: false as const, statusCode: 400, error: "invalid_milestone_status" };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data: milestone, error } = await supabase
    .from("strategic_plan_milestones")
    .update({
      status: statusInput,
      ...(statusInput === "completed" ? { completed_at: now, completed_by: context.user.id } : {}),
    })
    .eq("id", milestoneId)
    .eq("organization_id", organizationId)
    .not("status", "eq", "locked")
    .select("id, phase_id")
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "milestone_update_failed", detail: error.message };
  }

  if (!milestone) {
    return { ok: false as const, statusCode: 404, error: "milestone_not_found_or_locked" };
  }

  if (statusInput !== "completed" && statusInput !== "skipped") {
    return { ok: true as const, data: { id: milestone.id, status: statusInput } };
  }

  // Si la fase quedo sin hitos abiertos, se completa y se desbloquea la siguiente.
  const { data: remaining, error: remainingError } = await supabase
    .from("strategic_plan_milestones")
    .select("id")
    .eq("phase_id", milestone.phase_id)
    .not("status", "in", "(completed,skipped)")
    .limit(1);

  if (remainingError || (remaining ?? []).length > 0) {
    return { ok: true as const, data: { id: milestone.id, status: statusInput } };
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
        .update({ status: "active", activated_at: now, activated_by: context.user.id })
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
        .update({ status: "completed", completed_on: new Date().toISOString().slice(0, 10) })
        .eq("id", phase.plan_id)
        .eq("status", "active");
    }
  }

  return { ok: true as const, data: { id: milestone.id, status: statusInput } };
}

export async function addMilestoneInternalNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  milestoneId: string,
  body: string | undefined,
) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "internal_note_denied",
      message: "Solo consultores o administradores pueden crear notas internas.",
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
    return { ok: false as const, statusCode: 404, error: "milestone_not_found" };
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
    return { ok: false as const, statusCode: 500, error: "internal_note_failed", detail: error?.message };
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
      { organization_id: organizationId, milestone_id: milestoneId, task_id: taskId },
      { onConflict: "milestone_id,task_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    // El trigger de integridad cross-org convierte enlaces invalidos en excepcion.
    return { ok: false as const, statusCode: 400, error: "milestone_task_link_failed", detail: error?.message };
  }

  return { ok: true as const, data: { id: data.id } };
}
