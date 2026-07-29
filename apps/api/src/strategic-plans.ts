import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
      "id, name, description, status, version, starts_on, completed_on, approved_at, created_at, strategic_plan_phases(id, name, description, position, status, activated_at, completed_at, created_by, strategic_plan_milestones(id, name, description, position, status, target_date, completed_at, created_by, milestone_task_links(task_id, tasks(id, title, status, priority, due_at, category, source, created_by))))",
    )
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "plan_load_failed", detail: error.message };
  }

  if (plan) {
    await attachCreatorOrigin(supabase, plan as PlanWithPhases);
  }

  return { ok: true as const, data: { organization_id: organizationId, plan: plan ?? null } };
}

type PlanWithPhases = {
  strategic_plan_phases: Array<{
    created_by: string | null;
    created_by_origin?: "consultant" | "client" | null;
    strategic_plan_milestones: Array<{
      created_by: string | null;
      created_by_origin?: "consultant" | "client" | null;
      milestone_task_links: Array<{
        tasks: { created_by: string | null; created_by_origin?: "consultant" | "client" | null } | null;
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
      ["consultant", "platform_admin"].includes(profile.platform_role) ? "consultant" : "client",
    ]),
  );

  for (const phase of plan.strategic_plan_phases) {
    phase.created_by_origin = phase.created_by ? (originById.get(phase.created_by) ?? null) : null;
    for (const milestone of phase.strategic_plan_milestones) {
      milestone.created_by_origin = milestone.created_by ? (originById.get(milestone.created_by) ?? null) : null;
      for (const link of milestone.milestone_task_links) {
        if (link.tasks) {
          link.tasks.created_by_origin = link.tasks.created_by ? (originById.get(link.tasks.created_by) ?? null) : null;
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
        created_by: context.user.id,
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
    return { ok: false as const, statusCode: 500, error: "phase_create_failed", detail: phaseError?.message };
  }

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
    return { ok: false as const, statusCode: 400, error: "missing_milestone_name" };
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
    return { ok: false as const, statusCode: 500, error: "milestone_create_failed", detail: milestoneError?.message };
  }

  return { ok: true as const, data: { id: milestone.id } };
}

type PhaseUpdateInput = { name?: string | undefined; description?: string | null | undefined };

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
      return { ok: false as const, statusCode: 400, error: "invalid_phase_name" };
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
    return { ok: false as const, statusCode: 500, error: "phase_update_failed", detail: error.message };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "phase_not_found" };
  }

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
      return { ok: false as const, statusCode: 400, error: "invalid_milestone_name" };
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
    return { ok: false as const, statusCode: 500, error: "milestone_update_failed", detail: error.message };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "milestone_not_found" };
  }

  return { ok: true as const, data: { id: data.id } };
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

  // BE-01 (bug real de seguridad encontrado 2026-07-28, no solo un gap
  // teorico): el chequeo de arriba solo confirma el ROL de plataforma, no que
  // ESTE consultor este asignado a ESTA organizacion. Como el insert de abajo
  // usa `createServiceClient` (service_role, sin RLS), un consultor asignado
  // solo a otra organizacion podia escribir una nota interna aqui con solo
  // conocer un `milestoneId` ajeno. `context.memberships` ya incluye las
  // organizaciones virtuales del consultor (auth-context.ts) exactamente para
  // esto -- mismo patron que `requireMembership` en el resto del backend.
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
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
    input.priority && MILESTONE_TASK_PRIORITIES.includes(input.priority) ? input.priority : "medium";

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

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      source: "strategic_plan",
      priority,
      category: "general",
      title: title.slice(0, 255),
      description: input.description ?? null,
      due_at: input.dueAt ?? null,
      created_by: context.user.id,
    })
    .select("id, title, status, priority, due_at, category, source")
    .single();

  if (taskError || !task) {
    return { ok: false as const, statusCode: 500, error: "task_create_failed", detail: taskError?.message };
  }

  const { error: linkError } = await supabase
    .from("milestone_task_links")
    .insert({ organization_id: organizationId, milestone_id: milestoneId, task_id: task.id });

  if (linkError) {
    return { ok: false as const, statusCode: 500, error: "milestone_task_link_failed", detail: linkError.message };
  }

  return { ok: true as const, data: task };
}
