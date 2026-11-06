import type { SupabaseClient } from "@supabase/supabase-js";
import { caminoPlanOutputSchema } from "@e-nora/ai";
import { createUserScopedClient, type AuthContext } from "./auth-context.js";
import { loadPlanEconomics } from "./camino-economics.js";
import { recordObjectiveChange } from "./camino-objective-changes.js";
import {
  analyzeReplan,
  monthRoute,
  proposalExpired,
  REPLAN_SCOPES,
  type CurrentMilestone,
  type CurrentPlan,
  type CurrentTask,
  type ManualDecisions,
  type ReplanDecision,
  type Restriction,
} from "./camino-replan.js";
import {
  assertCanManagePlan,
  buildPlanTree,
  caminoProposalToPlanInput,
  createServiceClient,
  requireMembership,
  resolveObjectiveCatalog,
  resolveTaskAssignee,
} from "./strategic-plans.js";

type Env = Parameters<typeof createServiceClient>[0] & Parameters<typeof resolveObjectiveCatalog>[0];
type Row = Record<string, unknown>;
type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };
const fail = (statusCode: number, error: string, message?: string, detail?: string): Failure => ({
  ok: false,
  statusCode,
  error,
  ...(message ? { message } : {}),
  ...(detail ? { detail } : {}),
});

const PLAN_TREE =
  "id, name, description, version, status, store_id, currency_code, display_fx, starts_on, created_at, horizon_months, goal, strategic_plan_phases(id, name, position, status, strategic_plan_milestones(id, name, description, success_criteria, rationale, position, status, target_date, deadline_date, measurement_date, completed_at, milestone_task_links(task_id, position, owner_role, kind, track, cadence, effort_hours, definition_of_done, rationale, evidence, tasks(id, title, description, status, priority, due_at, source, completed_at))))";

function toCurrentPlan(row: Row): CurrentPlan & { store_id: string | null; display_fx: unknown; horizon_months: number | null } {
  const byPosition = (a: Row, b: Row) => Number(a.position ?? 0) - Number(b.position ?? 0);
  const phases = ((row.strategic_plan_phases ?? []) as Row[]).slice().sort(byPosition);
  return {
    id: row.id as string,
    name: row.name as string,
    version: row.version as number,
    status: row.status as string,
    store_id: (row.store_id as string | null) ?? null,
    display_fx: row.display_fx ?? null,
    horizon_months: (row.horizon_months as number | null) ?? null,
    currency_code: (row.currency_code as string | null) ?? null,
    starts_on: (row.starts_on as string | null) ?? null,
    created_at: row.created_at as string,
    goal: (row.goal as CurrentPlan["goal"]) ?? null,
    phases: phases.map((phase) => ({
      name: phase.name as string,
      milestones: ((phase.strategic_plan_milestones ?? []) as Row[]).slice().sort(byPosition).map((milestone): CurrentMilestone => ({
        id: milestone.id as string,
        name: milestone.name as string,
        description: (milestone.description as string | null) ?? null,
        success_criteria: (milestone.success_criteria as string | null) ?? null,
        rationale: (milestone.rationale as string | null) ?? null,
        status: milestone.status as string,
        target_date: (milestone.target_date as string | null) ?? null,
        deadline_date: (milestone.deadline_date as string | null) ?? null,
        measurement_date: (milestone.measurement_date as string | null) ?? null,
        tasks: ((milestone.milestone_task_links ?? []) as Row[]).slice().sort(byPosition).flatMap((link): CurrentTask[] => {
          const task = link.tasks as Row | null;
          if (!task) return [];
          return [{
            id: task.id as string,
            title: task.title as string,
            description: (task.description as string | null) ?? null,
            status: task.status as string,
            priority: task.priority as string,
            due_at: (task.due_at as string | null) ?? null,
            source: task.source as string,
            owner_role: (link.owner_role as string | null) ?? null,
            kind: (link.kind as string | null) ?? null,
            track: (link.track as string | null) ?? null,
            cadence: (link.cadence as string | null) ?? null,
            effort_hours: (link.effort_hours as number | null) ?? null,
            definition_of_done: (link.definition_of_done as string | null) ?? null,
            rationale: (link.rationale as string | null) ?? null,
            evidence: Array.isArray(link.evidence) ? link.evidence : [],
          }];
        }),
      })),
    })),
  };
}

export async function loadPlan(supabase: SupabaseClient, organizationId: string, planId: string) {
  const { data, error } = await supabase.from("strategic_plans").select(PLAN_TREE).eq("id", planId).eq("organization_id", organizationId).maybeSingle();
  if (error) return fail(500, "plan_load_failed", undefined, error.message);
  if (!data) return fail(404, "plan_not_found");
  return { ok: true as const, plan: toCurrentPlan(data as unknown as Row) };
}

const MILESTONE_FIELDS = ["name", "description", "success_criteria", "target_date", "deadline_date", "measurement_date"];
const WHOLE_ELEMENT_ACTIONS = new Set(["strategic_plan.create_milestone", "strategic_plan.create_task", "strategic_plan.link_task"]);

/** Qué ha fijado una persona: `created_by` no sirve, la IA escribe a nombre de quien aceptó. */
export async function loadManualDecisions(supabase: SupabaseClient, organizationId: string, plan: CurrentPlan): Promise<ManualDecisions> {
  const milestones = plan.phases.flatMap((phase) => phase.milestones);
  const milestoneIds = new Set(milestones.map((milestone) => milestone.id));
  const taskIds = new Set(milestones.flatMap((milestone) => milestone.tasks.map((task) => task.id)));
  const ids = [plan.id, ...milestoneIds, ...taskIds];
  const manual: ManualDecisions = { milestones: {}, tasks: {}, goal: false };
  for (let index = 0; index < ids.length; index += 150) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("action, entity_id, new_data")
      .eq("organization_id", organizationId)
      .gte("created_at", plan.created_at)
      .in("entity_id", ids.slice(index, index + 150))
      .in("action", [
        "strategic_plan.update_milestone",
        "strategic_plan.create_milestone",
        "strategic_plan.update_task",
        "strategic_plan.create_task",
        "strategic_plan.link_task",
        "strategic_plan.set_goal_target",
        "operations.update_task_assignment",
      ]);
    // Sin registro no se puede afirmar que algo sea de la IA: mejor que falle a tratarlo como libre.
    if (error) throw new Error(`manual_decisions_failed: ${error.message}`);
    for (const row of data ?? []) {
      const id = row.entity_id as string;
      const action = row.action as string;
      const changed = Object.keys((row.new_data as Row | null) ?? {});
      if (action === "strategic_plan.set_goal_target") manual.goal = true;
      else if (milestoneIds.has(id)) {
        const fields = WHOLE_ELEMENT_ACTIONS.has(action) ? ["*"] : changed.filter((field) => MILESTONE_FIELDS.includes(field));
        if (fields.length) manual.milestones[id] = [...new Set([...(manual.milestones[id] ?? []), ...fields])];
      } else if (taskIds.has(id)) {
        const fields = WHOLE_ELEMENT_ACTIONS.has(action) ? ["*"] : action === "operations.update_task_assignment" ? ["owner"] : ["title", "due_at", "priority"].filter((field) => changed.includes(field));
        if (fields.length) manual.tasks[id] = [...new Set([...(manual.tasks[id] ?? []), ...fields])];
      }
    }
  }
  return manual;
}

export async function loadRestrictions(env: Env, supabase: SupabaseClient, organizationId: string, storeId: string | null): Promise<Restriction[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("organization_metric_targets")
    .select("metric_key, target_value, period, store_id, created_at")
    .eq("organization_id", organizationId)
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`);
  if (error) throw new Error(`restrictions_failed: ${error.message}`);
  const catalog = new Map((await resolveObjectiveCatalog(env as never, organizationId)).map((entry) => [entry.key, entry]));
  return (data ?? [])
    .filter((row) => row.store_id === null || row.store_id === storeId)
    .map((row) => ({
      metric_key: row.metric_key as string,
      label: catalog.get(row.metric_key as string)?.label ?? (row.metric_key as string),
      target_value: Number(row.target_value),
      unit: catalog.get(row.metric_key as string)?.unit ?? "number",
      period: (row.period as string | null) ?? null,
    }));
}

async function fingerprintOf(supabase: SupabaseClient, planId: string) {
  const { data, error } = await supabase.rpc("camino_plan_fingerprint", { p_plan_id: planId });
  if (error || typeof data !== "string") throw new Error(`fingerprint_failed: ${error?.message ?? "empty"}`);
  return data;
}

const daysFrom = (date: string | null, now: Date) => {
  if (!date) return null;
  const days = Math.ceil((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - now.getTime()) / 86_400_000);
  return days >= 1 ? days : null;
};

export type PreparedReplan = {
  source: { plan_id: string; version: number; fingerprint: string; scopes: string[]; generated_on: string };
  known: { milestones: Set<string>; tasks: Set<string> };
  block: unknown;
};

/** Lo que A19 necesita saber del Camino vigente y nada más. */
export async function prepareReplanRun(env: Env, context: AuthContext, organizationId: string, planId: unknown, scopes: unknown) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  if (typeof planId !== "string" || !planId) return fail(400, "replan_plan_required");
  const chosen = Array.isArray(scopes) ? scopes.filter((scope): scope is string => (REPLAN_SCOPES as readonly string[]).includes(scope)) : [];
  if (!chosen.length) return fail(400, "replan_scope_required", "Elige al menos un ámbito de cambio.");
  const supabase = createServiceClient(env);
  const loaded = await loadPlan(supabase, organizationId, planId);
  if (loaded.ok === false) return loaded;
  const { plan } = loaded;
  if (!["active", "draft"].includes(plan.status)) return fail(409, "replan_plan_closed", "Este camino ya no está abierto.");
  const now = new Date();
  const [manual, restrictions, fingerprint] = await Promise.all([
    loadManualDecisions(supabase, organizationId, plan),
    loadRestrictions(env, supabase, organizationId, plan.store_id),
    fingerprintOf(supabase, plan.id),
  ]);
  const milestones = plan.phases.flatMap((phase) => phase.milestones.map((milestone) => ({ ...milestone, phase: phase.name })));
  const isOpen = (status: string) => !["completed", "skipped"].includes(status);
  const isOpenTask = (status: string) => !["completed", "ignored", "cancelled"].includes(status);
  const prepared: PreparedReplan = {
    source: { plan_id: plan.id, version: plan.version, fingerprint, scopes: chosen, generated_on: now.toISOString().slice(0, 10) },
    known: {
      milestones: new Set(milestones.map((milestone) => milestone.id)),
      tasks: new Set(milestones.flatMap((milestone) => milestone.tasks.map((task) => task.id))),
    },
    block: {
      version: plan.version,
      ambitos_que_puedes_cambiar: chosen,
      moneda: plan.currency_code,
      meta_vigente: plan.goal
        ? {
            metric_key: plan.goal.metric_key,
            metrica: plan.goal.metric_label,
            target: plan.goal.target,
            por_mes_natural: monthRoute(plan.goal, plan.starts_on ?? plan.created_at),
            decision_manual: manual.goal,
          }
        : null,
      restricciones_vigentes: restrictions,
      hitos_abiertos: milestones.filter((milestone) => isOpen(milestone.status)).map((milestone) => ({
        id: milestone.id,
        nombre: milestone.name,
        fase: milestone.phase,
        criterio: milestone.success_criteria,
        dia_objetivo: daysFrom(milestone.target_date, now),
        fecha: milestone.target_date,
        manual: manual.milestones[milestone.id] ?? [],
        tareas_abiertas: milestone.tasks.filter((task) => isOpenTask(task.status)).map((task) => ({
          id: task.id,
          titulo: task.title,
          dia: daysFrom(task.due_at, now),
          prioridad: task.priority,
          owner: task.owner_role,
          manual: task.source !== "strategic_plan" ? ["*"] : (manual.tasks[task.id] ?? []),
        })),
      })),
      hitos_cerrados: milestones.filter((milestone) => !isOpen(milestone.status)).map((milestone) => milestone.name),
      tareas_hechas: milestones.flatMap((milestone) => milestone.tasks.filter((task) => task.status === "completed").map((task) => task.title)),
    },
  };
  return { ok: true as const, data: prepared };
}

const PUBLIC_PLAN = (plan: CurrentPlan & { horizon_months: number | null }) => ({
  id: plan.id,
  name: plan.name,
  version: plan.version,
  status: plan.status,
  horizon_months: plan.horizon_months,
  starts_on: plan.starts_on,
  currency_code: plan.currency_code,
});

/** Paso 1: qué se protege, qué restricciones hay y si queda un borrador por revisar. */
export async function getReplanContext(env: Env, context: AuthContext, organizationId: string, planId: string) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  const supabase = createServiceClient(env);
  const loaded = await loadPlan(supabase, organizationId, planId);
  if (loaded.ok === false) return loaded;
  const { plan } = loaded;
  const [manual, restrictions, fingerprint, economics, draftRow] = await Promise.all([
    loadManualDecisions(supabase, organizationId, plan),
    loadRestrictions(env, supabase, organizationId, plan.store_id),
    fingerprintOf(supabase, plan.id),
    loadPlanEconomics(supabase, organizationId, plan.store_id, plan.goal?.target_date ?? null).catch(() => null),
    supabase
      .from("agent_outputs")
      .select("id, status, created_at, output")
      .eq("organization_id", organizationId)
      .eq("status", "pending_approval")
      .eq("output->replan_source->>plan_id", plan.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const milestones = plan.phases.flatMap((phase) => phase.milestones);
  const tasks = milestones.flatMap((milestone) => milestone.tasks);
  const draft = draftRow.data
    ? (() => {
        const output = draftRow.data.output as { horizon_months?: number; replan_source?: { fingerprint?: string; scopes?: string[] } };
        return {
          output_id: draftRow.data.id as string,
          generated_at: draftRow.data.created_at as string,
          horizon_months: output.horizon_months ?? null,
          scopes: output.replan_source?.scopes ?? [],
          stale: output.replan_source?.fingerprint !== fingerprint,
          expired: proposalExpired(draftRow.data.created_at as string),
        };
      })()
    : null;
  return {
    ok: true as const,
    data: {
      plan: PUBLIC_PLAN(plan),
      effective_start: new Date().toISOString().slice(0, 10),
      counts: {
        phases: plan.phases.length,
        milestones: milestones.length,
        tasks: tasks.length,
        completed: tasks.filter((task) => task.status === "completed").length,
        open: tasks.filter((task) => !["completed", "ignored", "cancelled"].includes(task.status)).length,
        manual: Object.keys(manual.milestones).length + Object.keys(manual.tasks).length + tasks.filter((task) => task.source !== "strategic_plan" && !manual.tasks[task.id]).length + (manual.goal ? 1 : 0),
      },
      goal: plan.goal ? { label: plan.goal.metric_label, target: plan.goal.target, unit: plan.goal.unit, months: monthRoute(plan.goal, plan.starts_on ?? plan.created_at) } : null,
      restrictions,
      costs_partial: economics?.costs.partial ?? null,
      draft: draft && !draft.expired ? draft : null,
    },
  };
}

function parseDecisions(value: unknown): Record<string, ReplanDecision> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Row).filter((entry): entry is [string, ReplanDecision] => entry[1] === "accept" || entry[1] === "keep"));
}

async function analyze(env: Env, context: AuthContext, organizationId: string, planId: string, outputId: unknown, decisionsInput: unknown) {
  const authz = assertCanManagePlan(context, organizationId);
  if (authz.ok === false) return authz;
  if (typeof outputId !== "string" || !outputId) return fail(400, "output_id_requerido");
  const supabase = createServiceClient(env);
  const loaded = await loadPlan(supabase, organizationId, planId);
  if (loaded.ok === false) return loaded;
  const { plan } = loaded;

  const { data: output, error } = await supabase
    .from("agent_outputs")
    .select("id, status, created_at, output, agent_runs!inner(store_id, started_at, lookback_days)")
    .eq("id", outputId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return fail(500, "plan_proposal_load_failed", undefined, error.message);
  if (!output) return fail(404, "plan_proposal_not_found");
  if (output.status === "published") return fail(409, "plan_proposal_already_applied", "Esta propuesta ya se aplicó. Consúltala en el historial de versiones.");
  if (output.status === "rejected") return fail(409, "plan_proposal_rejected", "Esta propuesta se descartó.");
  const parsed = caminoPlanOutputSchema.safeParse(output.output);
  if (!parsed.success) return fail(422, "plan_proposal_invalid", undefined, parsed.error.message);
  const source = parsed.data.replan_source;
  if (source?.plan_id !== plan.id) return fail(409, "plan_proposal_other_plan", "Esta propuesta no parte de este camino.");

  const runs = output.agent_runs as unknown as { store_id?: string | null; started_at?: string; lookback_days?: number | null } | Array<{ store_id?: string | null; started_at?: string; lookback_days?: number | null }> | null;
  const run = Array.isArray(runs) ? runs[0] : runs;
  if ((run?.store_id ?? null) !== plan.store_id) return fail(409, "plan_replace_scope_mismatch", "La propuesta es de otra tienda.");
  const generatedAt = run?.started_at ?? (output.created_at as string);
  const input = caminoProposalToPlanInput(parsed.data, Date.parse(generatedAt), plan.store_id, run?.lookback_days, generatedAt);

  const [manual, restrictions, fingerprint, economics] = await Promise.all([
    loadManualDecisions(supabase, organizationId, plan),
    loadRestrictions(env, supabase, organizationId, plan.store_id),
    fingerprintOf(supabase, plan.id),
    // Sin datos, `actual` queda vacío: un dato ausente nunca es cero.
    loadPlanEconomics(supabase, organizationId, plan.store_id, plan.goal?.target_date ?? null).catch(() => null),
  ]);
  const analysis = analyzeReplan({
    current: plan,
    proposal: input,
    retired: parsed.data.retired_items ?? [],
    manual,
    restrictions,
    scopes: source.scopes,
    decisions: parseDecisions(decisionsInput),
    actuals: Object.fromEntries((economics?.months ?? []).map((month) => [month.month, month.revenue])),
    startsOn: generatedAt.slice(0, 10),
  });
  if (!["active", "draft"].includes(plan.status)) analysis.blockers.unshift({ code: "plan_closed", message: "Este camino ya no está abierto." });
  if (proposalExpired(generatedAt)) analysis.blockers.unshift({ code: "proposal_expired", message: "La propuesta ha caducado: genera otra con los datos de hoy." });
  if (source.fingerprint !== fingerprint) analysis.blockers.unshift({ code: "plan_changed", message: "El Camino ha cambiado desde que se generó la propuesta. Genera otra." });
  if (economics?.costs.partial) analysis.warnings.unshift("Faltan costes: el margen de estas cifras es parcial.");
  if (!economics) analysis.warnings.unshift("No se pudieron leer las ventas reales: esos meses quedan sin dato.");
  return { ok: true as const, supabase, plan, parsed: parsed.data, input, analysis, generatedAt, source };
}

/** Paso 2 y 3: diferencias, bloqueos y versión final con las decisiones tomadas. */
export async function previewReplan(env: Env, context: AuthContext, organizationId: string, planId: string, outputId: unknown, decisions: unknown) {
  const result = await analyze(env, context, organizationId, planId, outputId, decisions);
  if (result.ok === false) return result;
  const { analysis, parsed, plan, generatedAt } = result;
  return {
    ok: true as const,
    data: {
      plan: PUBLIC_PLAN(plan),
      proposal: {
        output_id: outputId as string,
        plan_name: parsed.plan_name,
        diagnosis: parsed.diagnosis,
        generated_at: generatedAt,
        horizon_months: parsed.horizon_months ?? null,
        confidence: parsed.confidence,
        warnings: parsed.warnings,
        goal: parsed.goal ? { label: parsed.goal.metric_label, unit: parsed.goal.unit, rationale: parsed.goal.rationale, assumptions: parsed.goal.assumptions } : null,
        scopes: result.source.scopes,
      },
      changes: analysis.changes,
      blockers: analysis.blockers,
      warnings: analysis.warnings,
      route: analysis.route,
      counts: analysis.counts,
      retire_count: analysis.retire.length,
    },
  };
}

const STALE_ERRORS: Array<[string, number, string]> = [
  ["camino_replan_stale", 409, "El Camino ha cambiado mientras revisabas. Genera otra propuesta."],
  ["plan_proposal_already_applied", 409, "Esta propuesta ya se aplicó."],
  ["replan_task_unavailable", 409, "Una tarea ya no se puede conservar. Genera otra propuesta."],
  ["replan_open_tasks_unreconciled", 409, "Quedaban tareas sin decidir. Genera otra propuesta."],
  ["camino_replan_plan_closed", 409, "Este camino ya no está abierto."],
];

/** Paso 3: revalida todo y aplica en una sola transacción. La IA nunca llega aquí por sí misma. */
export async function applyReplan(env: Env, context: AuthContext, organizationId: string, planId: string, outputId: unknown, decisions: unknown) {
  const result = await analyze(env, context, organizationId, planId, outputId, decisions);
  if (result.ok === false) return result;
  const { supabase, plan, input, analysis, source, generatedAt } = result;
  if (analysis.blockers.length) {
    return { ...fail(409, "replan_blocked", analysis.blockers[0]!.message), blockers: analysis.blockers };
  }

  const assignTo = await resolveTaskAssignee(supabase, context, organizationId);
  const tree = buildPlanTree(
    {
      ...input,
      name: input.name ?? plan.name,
      goal: analysis.final.goal,
      phases: analysis.final.phases,
      currencyCode: plan.currency_code,
    },
    assignTo,
    new Set(),
  );
  const changes = analysis.changes.filter((change) => change.kind !== "kept");
  const summary = {
    from_version: plan.version,
    generated_at: generatedAt,
    scopes: source.scopes,
    counts: analysis.counts,
    // ponytail: tope por tamaño de fila; el recuento completo va en counts.
    changes: changes.slice(0, 300).map(({ id, kind, entity, label, before, after, reason, decision }) => ({ id, kind, entity, label, before, after, reason, decision })),
    retired: analysis.retire.length,
  };
  const { data, error } = await supabase.rpc("camino_apply_replan", {
    p_organization_id: organizationId,
    p_user_id: context.user.id,
    p_source_plan_id: plan.id,
    p_expected_fingerprint: source.fingerprint,
    p_output_id: outputId as string,
    p_plan: tree,
    p_retire: analysis.retire,
    p_summary: summary,
    p_starts_on: generatedAt.slice(0, 10),
  });
  if (error) {
    const known = STALE_ERRORS.find(([code]) => error.message.includes(code));
    if (known) return fail(known[1], known[0], known[2]);
    return fail(500, "camino_replan_failed", undefined, error.message);
  }
  const applied = data as { plan_id: string; previous_plan_id: string; version: number; status: string; activated_at: string | null; moved: number; created: number; retired: number };

  const { error: approvalError } = await supabase.from("agent_approvals").insert({
    output_id: outputId as string,
    organization_id: organizationId,
    decision: "approved",
    decided_by: context.user.id,
    reason: `Replanificación aplicada: versión ${applied.version}, plan ${applied.plan_id}`,
  });
  const nonBlocking = approvalError ? ["No se pudo registrar la aprobación de la propuesta."] : [];

  const accepted = analysis.changes.find((change) => change.id === "goal:target" && change.decision === "accept");
  if (accepted && plan.goal) {
    await recordObjectiveChange(supabase, context, {
      organizationId,
      storeId: plan.store_id,
      planId: applied.plan_id,
      scope: "plan_goal",
      metricKey: plan.goal.metric_key,
      metricLabel: plan.goal.metric_label,
      unit: plan.goal.unit,
      action: "updated",
      previousValue: accepted.before as number | null,
      newValue: accepted.after as number | null,
      reason: `Replanificación a la versión ${applied.version}`,
    });
  }
  return {
    ok: true as const,
    data: {
      new_version_id: applied.plan_id,
      previous_version_id: applied.previous_plan_id,
      version: applied.version,
      status: applied.status,
      activated_at: applied.activated_at,
      summary: { counts: analysis.counts, moved: applied.moved, created: applied.created, retired: applied.retired },
      warnings: [...analysis.warnings, ...nonBlocking],
    },
  };
}

/** Una versión del Camino, también archivada: lo hecho, lo retirado y por qué cambió. */
export async function getPlanVersion(env: Env, authorization: string, context: AuthContext, organizationId: string, planId: string) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;
  const manage = assertCanManagePlan(context, organizationId);
  // Quien no gestiona lee con su sesión: RLS decide qué tareas ve.
  const reader = manage.ok ? createServiceClient(env) : createUserScopedClient(env, authorization.slice("Bearer ".length));
  const { data, error } = await reader
    .from("strategic_plans")
    .select(`${PLAN_TREE}, replan_summary, replaces_plan_id`)
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return fail(500, "plan_load_failed", undefined, error.message);
  if (!data) return fail(404, "plan_not_found");
  const row = data as unknown as Row;
  const plan = toCurrentPlan(row);
  return {
    ok: true as const,
    data: {
      id: plan.id,
      name: plan.name,
      version: plan.version,
      status: plan.status,
      created_at: plan.created_at,
      starts_on: plan.starts_on,
      goal: plan.goal ? { label: plan.goal.metric_label, target: plan.goal.target, unit: plan.goal.unit } : null,
      currency_code: plan.currency_code,
      replaces_plan_id: (row.replaces_plan_id as string | null) ?? null,
      replan_summary: row.replan_summary ?? null,
      phases: plan.phases.map((phase) => ({
        name: phase.name,
        milestones: phase.milestones.map((milestone) => ({
          id: milestone.id,
          name: milestone.name,
          status: milestone.status,
          target_date: milestone.target_date,
          tasks: milestone.tasks.map((task) => ({ id: task.id, title: task.title, status: task.status, due_at: task.due_at })),
        })),
      })),
    },
  };
}
