import { createClient } from "@supabase/supabase-js";
import {
  buildDecisionContext,
  fingerprintDecisionContextInput,
  type DecisionContextInputLike,
  type DecisionContextResult,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("decision-context-engine");

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

type DeclarationRow = {
  id: string;
  input_envelope: Record<string, unknown>;
  input_fingerprint: string;
  declared_at: string;
};

type CaminoPlanRow = {
  id: string;
  name: string | null;
  store_id: string | null;
  goal: unknown;
  horizon_months: number | null;
};

type CaminoObjective = NonNullable<DecisionContextInputLike["primary_objective"]>;

const UNIT_SUFFIX: Record<string, string> = { pct: " %", ratio: "x" };

/**
 * La meta de un Camino activo como objetivo del contexto de decision. Mi Camino
 * es la unica fuente de objetivos (decision de Rafa, 2026-10-19): sin esto el
 * diagnostico decia "falta el objetivo" aunque el Camino tuviera meta aprobada.
 */
export function caminoGoalObjective(plan: CaminoPlanRow): CaminoObjective | null {
  const goal = plan.goal && typeof plan.goal === "object" && !Array.isArray(plan.goal)
    ? (plan.goal as Record<string, unknown>)
    : null;
  const label = typeof goal?.metric_label === "string" && goal.metric_label.trim()
    ? goal.metric_label.trim()
    : typeof goal?.metric_key === "string" ? goal.metric_key : null;
  if (!goal || !label) return null;
  const target = typeof goal.target === "number" && Number.isFinite(goal.target) ? goal.target : null;
  const unit = typeof goal.unit === "string" ? goal.unit : "";
  const currency = unit === "money" && typeof goal.currency_code === "string" ? ` ${goal.currency_code}` : "";
  const targetDate = typeof goal.target_date === "string" ? goal.target_date : null;
  const planName = plan.name?.trim() || "Mi Camino";
  const statement = target === null
    ? `${label}: meta del Camino «${planName}» pendiente de cuantificar`
    : `${label}: llegar a ${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(target)}${UNIT_SUFFIX[unit] ?? ""}${currency}${targetDate ? ` para el ${targetDate}` : ""} (meta del Camino «${planName}»)`;
  return {
    objective_id: `strategic_plan:${plan.id}`,
    kind: "GOAL",
    statement,
    // Aprobada por una persona (consultor o cliente) al crear o editar el Camino.
    source: "DECLARED",
    rationale: typeof goal.rationale === "string" && goal.rationale.trim() ? goal.rationale.trim() : null,
    horizon: targetDate ?? (plan.horizon_months ? `${plan.horizon_months} meses` : null),
    importance: "high",
    urgency: "unknown",
    target_state: statement,
    source_refs: [`strategic_plan:${plan.id}`],
  };
}

/**
 * Objetivo principal = meta del Camino de la organizacion (sin tienda) o, si no
 * lo hay, la del Camino activo mas reciente. Las metas de los demas Caminos
 * activos (otras tiendas) quedan como secundarias.
 */
export function caminoObjectives(plans: CaminoPlanRow[]) {
  const withGoal = plans
    .map((plan) => ({ plan, objective: caminoGoalObjective(plan) }))
    .filter((item): item is { plan: CaminoPlanRow; objective: CaminoObjective } => item.objective !== null);
  const primary = withGoal.find((item) => item.plan.store_id === null) ?? withGoal[0] ?? null;
  return {
    primary: primary?.objective ?? null,
    secondary: withGoal.filter((item) => item !== primary).map((item) => item.objective),
  };
}

export function withCaminoObjectives(
  input: DecisionContextInputLike,
  camino: ReturnType<typeof caminoObjectives>,
): DecisionContextInputLike {
  if (!camino.primary) return input;
  const declared = input.primary_objective ?? null;
  const secondary = [
    ...camino.secondary,
    // Lo que se declaro a mano antes queda como secundario: manda el Camino.
    ...(declared && declared.objective_id !== camino.primary.objective_id ? [declared] : []),
    ...(input.secondary_objectives ?? []).filter(
      (objective) => objective.objective_id !== camino.primary!.objective_id,
    ),
  ];
  const refs = [camino.primary, ...camino.secondary].flatMap((objective) => objective.source_refs ?? []);
  return {
    ...input,
    primary_objective: camino.primary,
    secondary_objectives: secondary,
    time_horizon: input.time_horizon ?? camino.primary.horizon ?? null,
    risk_context: {
      ...input.risk_context,
      unresolved: (input.risk_context.unresolved ?? []).filter((item) => item !== "objective_context"),
    },
    target_state: input.target_state?.statement
      ? input.target_state
      : { statement: camino.primary.target_state ?? null, source_refs: camino.primary.source_refs ?? [] },
    source_lineage_refs: [...new Set([...(input.source_lineage_refs ?? []), ...refs])],
  };
}

export function fallbackInput(
  organizationId: string,
  now: string,
  targets: Array<Record<string, unknown>>,
  maturity: Record<string, unknown> | null,
  constraints: Array<Record<string, unknown>>,
): DecisionContextInputLike {
  const targetRefs = targets.map((target) => String(target.id));
  const constraintRefs = constraints.map((constraint) => String(constraint.id));
  return {
    decision_context_id: `p1-missing:${organizationId}`,
    business_id: organizationId,
    as_of: now,
    schema_version: "p1.v1",
    context_policy_version: "p1-context.v1",
    primary_objective: null,
    secondary_objectives: [],
    declared_objective: null,
    revealed_objective: null,
    objective_conflicts: [],
    time_horizon: null,
    current_constraint_refs: constraintRefs,
    guardrails: [],
    resources: {},
    risk_context: { appetite: "unknown", capacity: "UNKNOWN", unresolved: ["objective_context", "cash_context", "risk_capacity"] },
    commitments: [],
    business_stage: {
      stage: (maturity?.business_stage as string | null) ?? null,
      confidence: (maturity?.confidence as "high" | "medium" | "low" | "unknown") ?? "unknown",
    },
    current_state: {
      objective_targets: targets.map((target) => ({ id: target.id, metric_key: target.metric_key, target_value: target.target_value, period: target.period })),
      target_refs: targetRefs,
      constraint_refs: constraintRefs,
      constraint_statements: constraints.map((constraint) => ({ id: constraint.id, statement: constraint.statement, binding_status: constraint.binding_status })),
    },
    target_state: { statement: null, source_refs: targetRefs },
    gaps: [],
    dependencies: [],
    event_windows: [],
    must_win: [],
    must_not_fail: [],
    source_lineage_refs: [`organization:${organizationId}`, ...targetRefs, ...constraintRefs, ...(maturity?.id ? [String(maturity.id)] : [])],
  };
}

async function loadInputs(supabase: any, organizationId: string, now: string): Promise<DecisionContextInputLike> {
  const today = now.slice(0, 10);
  const [declarationResult, targetsResult, maturityResult, constraintsResult, plansResult] = await Promise.all([
    supabase.from("decision_context_declarations").select("id, input_envelope, input_fingerprint, declared_at").eq("organization_id", organizationId).order("declared_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("organization_metric_targets").select("id, metric_key, target_value, period").eq("organization_id", organizationId).is("store_id", null).is("milestone_id", null).lte("valid_from", today).or(`valid_until.is.null,valid_until.gte.${today}`).order("created_at", { ascending: false }),
    supabase.from("maturity_profiles").select("id, business_stage, confidence").eq("organization_id", organizationId).is("store_id", null).is("superseded_at", null).maybeSingle(),
    supabase.from("business_constraints").select("id, statement, binding_status").eq("organization_id", organizationId).eq("status", "active").in("binding_status", ["binding", "secondary"]),
    supabase.from("strategic_plans").select("id, name, store_id, goal, horizon_months").eq("organization_id", organizationId).eq("status", "active").order("updated_at", { ascending: false }).limit(10),
  ]);
  for (const result of [declarationResult, targetsResult, maturityResult, constraintsResult, plansResult]) {
    if (result.error) throw new Error(`decision_context_input_load_failed: ${result.error.message}`);
  }
  const camino = caminoObjectives((plansResult.data ?? []) as CaminoPlanRow[]);
  const declaration = declarationResult.data as DeclarationRow | null;
  if (declaration) {
    return withCaminoObjectives({
      ...(declaration.input_envelope as DecisionContextInputLike),
      decision_context_id: `declaration:${declaration.id}`,
      business_id: organizationId,
      as_of: now,
      source_lineage_refs: [
        ...new Set([...(declaration.input_envelope.source_lineage_refs as string[] | undefined ?? []), `declaration:${declaration.id}`]),
      ],
    }, camino);
  }
  return withCaminoObjectives(
    fallbackInput(organizationId, now, (targetsResult.data ?? []) as Array<Record<string, unknown>>, maturityResult.data as Record<string, unknown> | null, (constraintsResult.data ?? []) as Array<Record<string, unknown>>),
    camino,
  );
}

async function persist(supabase: any, result: DecisionContextResult) {
  const { data: existing, error: lookupError } = await supabase.from("decision_contexts").select("id, context_status, context_confidence").eq("organization_id", result.business_id).eq("input_fingerprint", result.input_fingerprint).maybeSingle();
  if (lookupError) throw new Error(`decision_context_lookup_failed: ${lookupError.message}`);
  if (existing) return existing;
  const { data, error } = await supabase.from("decision_contexts").insert({
    organization_id: result.business_id,
    decision_context_id: result.decision_context_id,
    as_of: result.as_of,
    evaluated_at: result.evaluated_at,
    schema_version: result.schema_version,
    context_policy_version: result.context_policy_version,
    input_fingerprint: result.input_fingerprint,
    context_status: result.context_status,
    context_confidence: result.context_confidence,
    primary_objective_kind: result.primary_objective?.kind ?? null,
    primary_objective_statement: result.primary_objective?.statement ?? null,
    input_envelope: result,
    result,
    unresolved_unknowns: result.unresolved_unknowns,
    reason_codes: result.reason_codes,
    source_lineage_refs: result.source_lineage_refs,
  }).select("id, context_status, context_confidence").single();
  if (error || !data) throw new Error(`decision_context_write_failed: ${error?.message ?? "no row"}`);
  return data;
}

export async function runDecisionContextEngine(env: LoadedApiEnv, organizationId: string) {
  const now = new Date().toISOString();
  const supabase = createServiceClient(env);
  const input = await loadInputs(supabase, organizationId, now);
  const result = buildDecisionContext(input);
  const persisted = await persist(supabase, result);
  return {
    context_id: persisted.id as string,
    context_status: result.context_status,
    context_confidence: result.context_confidence,
    input_fingerprint: result.input_fingerprint,
    unresolved_unknowns: result.unresolved_unknowns,
    reason_codes: result.reason_codes,
  };
}

export async function runDecisionContextEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);
  const { data: organizations, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`decision_context_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, incomplete: 0, conflicting: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runDecisionContextEngine(env, organization.id as string);
      summary.succeeded += 1;
      if (result.context_status === "INCOMPLETE") summary.incomplete += 1;
      if (result.context_status === "CONFLICTING") summary.conflicting += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("decision_context_org_failed", { organization_id: organization.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return summary;
}

export { fingerprintDecisionContextInput };
