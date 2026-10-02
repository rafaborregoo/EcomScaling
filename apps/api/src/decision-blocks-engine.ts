/**
 * F4 / 4.06-4.12 -- los siete bloques de decision que comparten forma, en un
 * solo motor.
 *
 * Hasta el 2026-09-27 eran siete ficheros (feasibility, risk, allocation,
 * strategic-fit, ranking, portfolio, decision-output) con el mismo esqueleto:
 * leer los casos abiertos, construir la entrada, llamar al evaluador puro de
 * `@e-nora/contracts` y guardar el resultado si su huella no existia ya. Aqui
 * cada bloque es una fila de `DECISION_BLOCKS`; su contrato, su tabla y su
 * panel siguen siendo propios.
 *
 * LO QUE HAY QUE SABER ANTES DE TOCARLO: ninguno de los siete lee datos del
 * negocio todavia. Las entradas declaran UNKNOWN en todo lo que el tenant no
 * ha declarado (capacidad, valor, apetito de riesgo, politica de ranking...),
 * y los evaluadores responden con abstencion. Es el comportamiento correcto
 * hasta que exista esa declaracion; cuando exista, se lee aqui y se pasa al
 * `build` del bloque.
 *
 * Los bloques corren en orden y cada uno con su propio try/catch: si uno falla
 * para una organizacion, los demas se escriben igual.
 */
import { createClient } from "@supabase/supabase-js";
import {
  evaluateAllocation,
  evaluateDecisionOutput,
  evaluateFeasibility,
  evaluatePortfolio,
  evaluateRanking,
  evaluateRisk,
  evaluateStrategicFit,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("decision-blocks-engine");

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

type Evaluated = {
  business_id: string;
  as_of: string;
  evaluated_at: string;
  input_fingerprint: string;
  reason_codes: unknown;
  source_refs: unknown;
  candidate_ref?: string;
  unresolved_unknowns?: unknown;
  [key: string]: unknown;
};

type DecisionBlock = {
  code: string;
  key: string;
  table: string;
  statusColumn: string;
  /**
   * Una fila por caso abierto (candidate_ref = diagnostic_cases.id) o una por
   * organizacion. Un bloque por candidato sin casos no escribe nada: la
   * organizacion NO es un candidato (son ids de dominios distintos, aunque los
   * dos sean uuid y la columna los acepte).
   */
  perCandidate: boolean;
  /** El contrato exige al menos un candidato (ranking): sin casos abiertos no se evalua. */
  requiresCases?: boolean;
  storesUnknowns: boolean;
  evaluate(org: string, caseIds: string[], now: string, candidate?: string): Evaluated;
};

function requireCandidate(candidate: string | undefined): string {
  if (!candidate) throw new Error("decision_block_candidate_required");
  return candidate;
}

export const DECISION_BLOCKS: readonly DecisionBlock[] = [
  {
    code: "4.06",
    key: "feasibility",
    table: "decision_feasibility_assessments",
    statusColumn: "feasibility_assessment",
    perCandidate: true,
    storesUnknowns: true,
    evaluate: (org, _caseIds, now, candidateRef) => {
      const candidate = requireCandidate(candidateRef);
      const sourceRef = `diagnostic_case:${candidate}`;
      return evaluateFeasibility({
        assessment_id: `p06:${org}:${candidate}`,
        business_id: org,
        candidate_ref: candidate,
        as_of: now,
        effort: { implementation_days: null, transition_days: null, operation_days: null, coordination_days: null, uncertainty: "UNKNOWN", assumptions: [] },
        resources: [{ resource: "effective_capacity", required_capacity: null, available_capacity: null, effective_capacity: null, scarcity: "UNKNOWN", lead_time_days: null, substitutability: "UNKNOWN", owner: null, source_refs: [sourceRef] }],
        readiness: { status: "UNKNOWN", prerequisites: [], owner: null, decision_rights: null, source_refs: [sourceRef] },
        feasibility: { current: "UNKNOWN", expanded: "UNKNOWN", theoretical: "UNKNOWN" },
        success_capacity: null,
        effort_confidence: "UNKNOWN",
        feasibility_confidence: "UNKNOWN",
        evidence_refs: [sourceRef],
        source_refs: [sourceRef],
      });
    },
  },
  {
    code: "4.07",
    key: "risk",
    table: "decision_risk_assessments",
    statusColumn: "risk_assessment",
    perCandidate: true,
    storesUnknowns: true,
    evaluate: (org, _caseIds, now, candidateRef) => {
      const candidate = requireCandidate(candidateRef);
      return evaluateRisk({
        assessment_id: `p07:${org}:${candidate}`,
        business_id: org,
        candidate_ref: candidate,
        as_of: now,
        upside: "unknown",
        downside: "unknown",
        likelihood: "UNKNOWN",
        risk_capacity: "UNKNOWN",
        risk_appetite: "UNKNOWN",
        reversibility: { technical: "UNKNOWN", economic: "UNKNOWN", reputational: "UNKNOWN" },
        recoverability: "UNKNOWN",
        cost_of_error: { action: "unknown", inaction: "unknown", delay: "unknown" },
        blast_radius: "UNKNOWN",
        commitment: "UNKNOWN",
        failure_modes: ["failure modes not observed"],
        critical_assumptions: [],
        observability: "UNKNOWN",
        autonomy: "NONE",
        approval_required: false,
        confidence: { risk: "UNKNOWN", assumptions: "UNKNOWN" },
        source_refs: [`organization:${org}`],
      });
    },
  },
  {
    code: "4.08",
    key: "allocation",
    table: "decision_allocation_assessments",
    statusColumn: "allocation_assessment",
    perCandidate: true,
    storesUnknowns: true,
    evaluate: (org, _caseIds, now, candidateRef) => {
      const candidate = requireCandidate(candidateRef);
      return evaluateAllocation({
        assessment_id: `p08:${org}:${candidate}`,
        business_id: org,
        candidate_ref: candidate,
        as_of: now,
        value_profile: { value_type: "UNKNOWN", gross_value: null, incremental_value: null, capturable_value: null, currency: null },
        probability: null,
        resource_requirements: [],
        opportunity_cost: "unknown",
        voi: "UNKNOWN",
        optionality: "UNKNOWN",
        sunk_cost: 0,
        remaining_cost: null,
        capacity_to_deploy: "UNKNOWN",
        stop_criteria: ["incremental value remains unknown"],
        confidence: { value: "UNKNOWN", probability: "UNKNOWN", allocation: "UNKNOWN" },
        source_refs: [`organization:${org}`],
      });
    },
  },
  {
    code: "4.09",
    key: "strategic_fit",
    table: "decision_strategic_fit_assessments",
    statusColumn: "strategic_assessment",
    perCandidate: true,
    storesUnknowns: true,
    evaluate: (org, _caseIds, now, candidateRef) => {
      const candidate = requireCandidate(candidateRef);
      return evaluateStrategicFit({
        assessment_id: `p09:${org}:${candidate}`,
        business_id: org,
        candidate_ref: candidate,
        as_of: now,
        objective_refs: [],
        objective_fit: "UNKNOWN",
        core_fit: "UNKNOWN",
        capability_fit: "UNKNOWN",
        stage_fit: "UNKNOWN",
        coherence: "UNKNOWN",
        right_to_win: "UNKNOWN",
        strategic_distance: "UNKNOWN",
        maturity_gap: "UNKNOWN",
        future_state_fit: "UNKNOWN",
        complexity_fit: "UNKNOWN",
        portfolio_role: "UNKNOWN",
        defensibility: "unknown",
        customer_brand_fit: "UNKNOWN",
        confidence: "UNKNOWN",
        evidence_refs: [`organization:${org}`],
        rationale: "strategic rationale unknown",
        source_refs: [`organization:${org}`],
      });
    },
  },
  {
    code: "4.10",
    key: "ranking",
    table: "decision_rankings",
    statusColumn: "ranking_status",
    perCandidate: false,
    requiresCases: true,
    storesUnknowns: true,
    evaluate: (org, caseIds, now) =>
      evaluateRanking({
        assessment_id: `p10:${org}`,
        business_id: org,
        as_of: now,
        policy: null,
        candidates: caseIds.map((candidate_ref) => ({
          candidate_ref,
          urgency: null,
          impact: null,
          feasibility: null,
          risk: null,
          strategic_fit: null,
          evidence_confidence: "UNKNOWN",
          rationale: "ranking dimensions or policy not declared",
          source_refs: [`candidate:${candidate_ref}`],
        })),
        rank_switch_conditions: ["new objective or declared policy"],
        source_refs: [`organization:${org}`],
      }),
  },
  {
    code: "4.11",
    key: "portfolio",
    table: "decision_portfolio_assessments",
    statusColumn: "portfolio_status",
    perCandidate: false,
    storesUnknowns: true,
    evaluate: (org, caseIds, now) =>
      evaluatePortfolio({
        assessment_id: `p11:${org}`,
        business_id: org,
        as_of: now,
        candidates: caseIds.map((candidate_ref) => ({
          candidate_ref,
          portfolio_role: "QUEUED",
          rank: null,
          resource_refs: [],
          dependency_refs: [],
          parallelism: "UNKNOWN",
          admission: "UNKNOWN",
          exit_criteria: [],
          preemption_allowed: false,
        })),
        resource_pools: [{ resource: "change_capacity", effective_capacity: null, run_load: null, change_capacity: null, wip_limit: null, source_refs: [`organization:${org}`] }],
        shared_assumptions: ["portfolio context not declared"],
        source_refs: [`organization:${org}`],
      }),
  },
  {
    code: "4.12",
    key: "decision_output",
    table: "decision_outputs",
    statusColumn: "decision_status",
    perCandidate: true,
    storesUnknowns: false,
    evaluate: (org, _caseIds, now, candidateRef) => {
      const candidate = requireCandidate(candidateRef);
      return evaluateDecisionOutput({
        assessment_id: `p12:${org}:${candidate}`,
        business_id: org,
        as_of: now,
        candidate_ref: candidate,
        decision_type: "ABSTAIN",
        context_refs: [`organization:${org}`],
        evidence_refs: [],
        rationale: "No hay una síntesis decisional validada",
        tradeoffs: ["decision postponed"],
        critical_assumptions: ["objective and ranking policy"],
        unknowns: ["decision_context", "ranking", "validation"],
        decision_confidence: "UNKNOWN",
        diagnosis_confidence: "UNKNOWN",
        causal_confidence: "UNKNOWN",
        rank: null,
        rank_switch_condition: "new evidence or objective",
        validity_window: "until context changes",
        review_trigger: "new objective, evidence or constraint",
        success_criteria: ["validated decision context"],
        human_challenge: "consultor puede impugnar y solicitar revisión",
        source_refs: [`organization:${org}`],
      });
    },
  },
];

/** Candidatos de un bloque: uno por caso abierto si es por candidato, o uno sin candidato si es de organizacion. */
function candidatesOf(block: DecisionBlock, caseIds: string[]): Array<string | undefined> {
  if (block.perCandidate) return caseIds;
  return block.requiresCases && !caseIds.length ? [] : [undefined];
}

/** Parte pura: los resultados para una organizacion (un bloque por candidato da una fila por caso), sin tocar la base. */
export function evaluateDecisionBlocks(org: string, caseIds: string[], now = new Date().toISOString()) {
  return DECISION_BLOCKS.flatMap((block) =>
    candidatesOf(block, caseIds).map((candidate) => ({ block, candidate, result: block.evaluate(org, caseIds, now, candidate) })),
  );
}

async function persistBlock(supabase: any, block: DecisionBlock, r: Evaluated) {
  const { data: existing, error: lookupError } = await supabase
    .from(block.table)
    .select(`id, ${block.statusColumn}`)
    .eq("organization_id", r.business_id)
    .eq("input_fingerprint", r.input_fingerprint)
    .maybeSingle();
  if (lookupError) throw new Error(`${block.key}_lookup_failed: ${lookupError.message}`);
  if (existing) return existing as { id: string };
  const row: Record<string, unknown> = {
    organization_id: r.business_id,
    as_of: r.as_of,
    assessed_at: r.evaluated_at,
    input_fingerprint: r.input_fingerprint,
    [block.statusColumn]: r[block.statusColumn],
    input_envelope: r,
    result: r,
    reason_codes: r.reason_codes,
    source_refs: r.source_refs,
  };
  if (block.perCandidate) row.candidate_ref = r.candidate_ref;
  if (block.storesUnknowns) row.unresolved_unknowns = r.unresolved_unknowns;
  const { data, error } = await supabase.from(block.table).insert(row).select(`id, ${block.statusColumn}`).single();
  if (error || !data) throw new Error(`${block.key}_write_failed: ${error?.message ?? "no row"}`);
  return data as { id: string };
}

export async function runDecisionBlocksEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const { data: cases, error } = await supabase
    .from("diagnostic_cases")
    .select("id")
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);
  if (error) throw new Error(`decision_blocks_cases_load_failed: ${error.message}`);
  const caseIds = ((cases ?? []) as { id: string }[]).map((c) => c.id);
  const now = new Date().toISOString();
  const blocks: Record<string, { ok: boolean; assessment_id?: string | undefined; assessment_ids?: string[]; status?: unknown; error?: string; skipped?: string }> = {};
  for (const block of DECISION_BLOCKS) {
    // Sin casos abiertos, los bloques por candidato (y el ranking) no tienen a quien evaluar.
    if (!candidatesOf(block, caseIds).length) {
      blocks[block.code] = { ok: true, skipped: "no_open_cases", assessment_ids: [] };
      continue;
    }
    const ids: string[] = [];
    const errors: string[] = [];
    let status: unknown;
    for (const candidate of candidatesOf(block, caseIds)) {
      // Un caso que falla no impide evaluar los demas.
      try {
        const result = block.evaluate(organizationId, caseIds, now, candidate);
        const stored = await persistBlock(supabase, block, result);
        ids.push(stored.id);
        status ??= result[block.statusColumn];
      } catch (blockError) {
        const message = blockError instanceof Error ? blockError.message : String(blockError);
        errors.push(message);
        logger.error("decision_block_failed", { organization_id: organizationId, block: block.code, candidate_ref: candidate ?? null, error: message });
      }
    }
    blocks[block.code] = errors.length
      ? { ok: false, error: errors.join("; "), assessment_ids: ids }
      : { ok: true, assessment_id: ids[0], assessment_ids: ids, status };
  }
  return { organization_id: organizationId, blocks };
}

export async function runDecisionBlocksEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const { data, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`decision_blocks_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0, failed_blocks: [] as string[] };
  for (const row of (data ?? []) as { id: string }[]) {
    summary.organizations += 1;
    try {
      const { blocks } = await runDecisionBlocksEngine(env, row.id);
      const failed = Object.entries(blocks).filter(([, b]) => !b.ok).map(([code]) => code);
      summary.assessments += Object.values(blocks).reduce((n, b) => n + (b.assessment_ids?.length ?? 0), 0);
      if (failed.length) {
        summary.failed += 1;
        summary.failed_blocks.push(...failed.map((code) => `${row.id}:${code}`));
      } else {
        summary.succeeded += 1;
      }
    } catch (orgError) {
      summary.failed += 1;
      logger.error("decision_blocks_org_failed", { organization_id: row.id, error: orgError instanceof Error ? orgError.message : String(orgError) });
    }
  }
  return summary;
}
