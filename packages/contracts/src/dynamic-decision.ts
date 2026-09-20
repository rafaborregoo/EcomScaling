import { z } from "zod";

/** F7.13 actualiza una recomendación con evidencia observada; no ejecuta cambios. */
export const DYNAMIC_DECISION_DISPOSITIONS = [
  "DECISIONS_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_DECISION_UNITS",
] as const;
export type DynamicDecisionDisposition = (typeof DYNAMIC_DECISION_DISPOSITIONS)[number];

export const DYNAMIC_DECISIONS = ["STOP", "CONTINUE", "SCALE", "ROLLBACK"] as const;
export type DynamicDecision = (typeof DYNAMIC_DECISIONS)[number];

const refs = z.array(z.string().min(1));
const qualitative = z.string().min(1);

export const dynamicDecisionUnitInputSchema = z.object({
  unit_id: z.string().min(1),
  original_recommendation: z.string().min(1),
  intervention_type: z.string().min(1),
  intended_mechanism: z.string().min(1),
  expected_outcome: z.string().min(1),
  observed_outcome: qualitative,
  primary_outcome: qualitative,
  secondary_effects: refs,
  economics: qualitative,
  guardrails: refs,
  risk: qualitative,
  intervention_fidelity: qualitative,
  baseline_quality: qualitative,
  trend: qualitative,
  causal_confidence: qualitative,
  incrementality: qualitative,
  headroom: qualitative,
  marginal_economics: qualitative,
  scale_readiness: qualitative,
  reversibility: qualitative,
  rollback_cost: qualitative,
  opportunity_cost: qualitative,
  decision_scope: z.string().min(1),
  fix_forward_alternative: z.string().default(""),
  source_refs: refs,
  unresolved_unknowns: refs,
});
export type DynamicDecisionUnitInput = z.input<typeof dynamicDecisionUnitInputSchema>;

export const dynamicDecisionInputSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  original_recommendation: z.string().min(1),
  portfolio_context: z.string().min(1),
  external_context: z.string().min(1),
  decision_units: z.array(dynamicDecisionUnitInputSchema),
  source_refs: refs,
  unresolved_unknowns: refs,
});
export type DynamicDecisionInput = z.input<typeof dynamicDecisionInputSchema>;

const dynamicDecisionUnitResultSchema = dynamicDecisionUnitInputSchema.extend({
  decision: z.enum(DYNAMIC_DECISIONS),
  decision_qualifiers: refs,
  rationale: z.string().min(1),
  why_not_alternatives: refs,
  current_exposure_recommendation: z.enum(["INCREASE", "HOLD", "REDUCE", "ZERO"]),
  scale_direction: z.string().min(1),
  scale_limit: z.string().min(1),
  stop_scope: z.string().min(1),
  rollback_target: z.string().min(1),
  observation_focus: refs,
  next_evidence_needed: refs,
  decision_trigger: z.string().min(1),
  resource_reallocation_implication: z.string().min(1),
  portfolio_consequence: z.string().min(1),
  learning_capture: z.string().min(1),
  decision_confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  quality_flags: refs,
});
export type DynamicDecisionUnitResult = z.infer<typeof dynamicDecisionUnitResultSchema>;

export const dynamicDecisionResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(DYNAMIC_DECISION_DISPOSITIONS),
  original_recommendation: z.string().min(1),
  overall_decision: z.enum([...DYNAMIC_DECISIONS, "MIXED", "VALIDATION_REQUIRED"] as [string, ...string[]]),
  unit_decisions: z.array(dynamicDecisionUnitResultSchema),
  stop_unit_ids: refs,
  continue_unit_ids: refs,
  scale_unit_ids: refs,
  rollback_unit_ids: refs,
  next_evidence_needed: refs,
  portfolio_implications: refs,
  learning_capture: refs,
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type DynamicDecisionResult = z.infer<typeof dynamicDecisionResultSchema>;

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const normalize = (value: string) => value.trim().toUpperCase();
const includesAny = (value: string, ...tokens: string[]) => tokens.some((token) => normalize(value).includes(token));
const isUnknown = (value: string) => ["", "UNKNOWN", "UNAVAILABLE", "NOT_ASSESSED"].includes(normalize(value));

function refsFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function fallback(raw: Partial<DynamicDecisionInput>, reasons: string[], unknowns: string[], evaluatedAt: string): DynamicDecisionResult {
  return dynamicDecisionResultSchema.parse({
    context_id: typeof raw.context_id === "string" ? raw.context_id : "invalid-context",
    business_id: typeof raw.business_id === "string" ? raw.business_id : "invalid-business",
    decision_cycle_id: typeof raw.decision_cycle_id === "string" ? raw.decision_cycle_id : "invalid-cycle",
    disposition: "VALIDATION_REQUIRED",
    original_recommendation: typeof raw.original_recommendation === "string" ? raw.original_recommendation : "UNKNOWN",
    overall_decision: "VALIDATION_REQUIRED",
    unit_decisions: [], stop_unit_ids: [], continue_unit_ids: [], scale_unit_ids: [], rollback_unit_ids: [],
    next_evidence_needed: ["Validate the dynamic decision input envelope"], portfolio_implications: [], learning_capture: [],
    reason_codes: unique(reasons), unresolved_unknowns: unique([...unknowns, "input_schema"]), source_refs: refsFrom(raw.source_refs),
    evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
  });
}

function validationUnknowns(input: z.infer<typeof dynamicDecisionInputSchema>): string[] {
  const unknowns = [...input.unresolved_unknowns];
  for (const item of input.decision_units) {
    for (const field of ["intervention_fidelity", "baseline_quality", "scale_readiness"] as const) {
      if (isUnknown(item[field])) unknowns.push(`${field}:${item.unit_id}`);
    }
  }
  return unique(unknowns);
}

function evaluateUnit(item: z.infer<typeof dynamicDecisionUnitInputSchema>): DynamicDecisionUnitResult {
  const observed = normalize(item.observed_outcome);
  const primary = normalize(item.primary_outcome);
  const guardrailBreach = item.guardrails.some((guardrail) => includesAny(guardrail, "BREACH", "FAIL", "HARM"));
  const materialHarm = includesAny(observed, "MATERIAL_HARM", "SEVERE_HARM") || guardrailBreach;
  const fidelityFailed = includesAny(item.intervention_fidelity, "FAILED", "POOR", "PARTIAL");
  const negative = includesAny(primary, "NEGATIVE", "WORSE", "DECLINING") || includesAny(observed, "NEGATIVE", "NO_EFFECT", "REGRESSION");
  const positive = includesAny(primary, "POSITIVE", "IMPROVING") || includesAny(observed, "POSITIVE", "IMPROVING", "STABLE");
  const reversible = includesAny(item.reversibility, "REVERSIBLE", "PARTIAL");
  const priorBetter = includesAny(item.baseline_quality, "PREVIOUS_STATE_BETTER", "PRIOR_BETTER");
  const rollbackAffordable = !includesAny(item.rollback_cost, "HIGH", "UNKNOWN", "UNAVAILABLE");
  const strongScaleEvidence = includesAny(item.causal_confidence, "STRONG") && includesAny(item.incrementality, "SUPPORTED", "INCREMENTAL") && includesAny(item.headroom, "AVAILABLE") && includesAny(item.marginal_economics, "HEALTHY") && includesAny(item.scale_readiness, "READY") && !guardrailBreach;

  let decision: DynamicDecision = "CONTINUE";
  let qualifiers: string[] = ["HOLD_AND_OBSERVE"];
  let exposure: "INCREASE" | "HOLD" | "REDUCE" | "ZERO" = "HOLD";
  let rationale = "La evidencia actual permite continuar observando sin ampliar exposición.";
  let scaleDirection = "No ampliar hasta que la evidencia pendiente sea suficiente.";
  let scaleLimit = "Mantener guardrails, capacidad y economía marginal dentro de condiciones aceptables.";
  let stopScope = "No detener globalmente; mantener el alcance actual.";
  let rollbackTarget = "No aplica; conservar el estado actual mientras se observa.";
  let fixForward = item.fix_forward_alternative || "Corregir la implementación, verificar fidelidad y volver a observar.";
  let nextEvidence = ["Outcome lagging y calidad de la atribución", "Efectos secundarios y economía marginal"];
  let trigger = "Revisar cuando exista evidencia comparable suficiente o cambie materialmente un guardrail.";
  let resource = "No reasignar recursos automáticamente; revisar el coste de oportunidad en la siguiente decisión.";
  let portfolio = "Mantener la consecuencia local; no generalizar a otras unidades.";
  let learning = `Registrar el resultado observado de ${item.unit_id} y separar mecanismo, fidelidad y efecto.`;
  let flags: string[] = [];

  if (materialHarm) {
    qualifiers = ["DAMAGE_CONTROL", "ROLLBACK_CONSIDERED"];
    if (priorBetter && reversible && rollbackAffordable) {
      decision = "ROLLBACK"; exposure = "ZERO"; rationale = "Hay daño material, el estado previo es mejor y la reversión es viable."; rollbackTarget = "Volver al estado previo/prior mejor documentado."; stopScope = `Detener ${item.decision_scope}; no extrapolar el fallo fuera de este alcance.`; nextEvidence = ["Confirmar recuperación frente al estado previo", "Verificar que no persiste el daño secundario"]; portfolio = "Liberar esta unidad de la cartera activa y revisar dependencias.";
    } else {
      decision = "STOP"; exposure = "ZERO"; qualifiers = ["MITIGATE", "FIX_FORWARD"]; rationale = "Existe daño material o una brecha de guardrail; la exposición debe cesar mientras se mitiga."; stopScope = `Detener ${item.decision_scope} en el alcance afectado.`; portfolio = "Aislar la unidad y priorizar mitigación; no reasignar automáticamente.";
    }
  } else if (fidelityFailed) {
    decision = "CONTINUE"; exposure = "REDUCE"; qualifiers = ["FIX_FORWARD", "ADJUST"]; rationale = "La fidelidad de la intervención falló o es parcial; esto no demuestra que haya fallado la estrategia."; scaleDirection = "No escalar; corregir implementación y repetir observación."; fixForward = item.fix_forward_alternative || fixForward; nextEvidence = ["Fidelidad confirmada", "Outcome comparable después del fix-forward"]; flags = ["STRATEGY_NOT_INVALIDATED"];
  } else if (negative) {
    qualifiers = ["MITIGATE", "REVIEW_REVERSIBILITY"];
    if (priorBetter && reversible && rollbackAffordable) {
      decision = "ROLLBACK"; exposure = "ZERO"; rationale = "El resultado es peor que el estado previo y la reversión es viable."; rollbackTarget = "Volver al estado previo/prior mejor documentado.";
    } else {
      decision = "STOP"; exposure = "ZERO"; rationale = "El resultado observado es negativo y no hay base suficiente para ampliar exposición."; stopScope = `Detener o reducir ${item.decision_scope}; validar si el problema es local.`;
    }
  } else if (positive && strongScaleEvidence) {
    decision = "SCALE"; exposure = "INCREASE"; qualifiers = ["PROGRESSIVE_SCALE", "MARGINAL_ECONOMICS_REQUIRED"]; rationale = "Outcome positivo, evidencia causal e incrementalidad soportadas, headroom disponible y readiness de escala confirmada."; scaleDirection = "Escalar progresivamente en magnitud, alcance, velocidad y duración según contexto."; nextEvidence = ["La economía marginal sigue saludable", "Los guardrails permanecen intactos durante la ampliación"]; portfolio = "Puede aumentar la exposición de esta unidad sin convertirla en regla global.";
  } else if (positive) {
    qualifiers = ["DO_NOT_SCALE_YET", "STABILIZATION_WINDOW"]; rationale = "El outcome es positivo, pero falta una o más condiciones para declarar readiness de escala."; nextEvidence = ["Causalidad e incrementalidad", "Headroom, economía marginal y readiness operativa"]; flags = ["POSITIVE_NOT_SCALE_READY"];
  }

  const confidence = strongScaleEvidence || materialHarm ? "HIGH" : fidelityFailed || negative ? "MEDIUM" : "LOW";
  return dynamicDecisionUnitResultSchema.parse({
    ...item, decision, decision_qualifiers: unique(qualifiers), rationale, why_not_alternatives: ["No inferir escala solo por un KPI positivo", "No detener globalmente un fallo local"], current_exposure_recommendation: exposure,
    scale_direction: scaleDirection, scale_limit: scaleLimit, stop_scope: stopScope, rollback_target: rollbackTarget, fix_forward_alternative: fixForward, observation_focus: ["Outcome primario", "Efectos secundarios", "Economía y guardrails"], next_evidence_needed: nextEvidence, decision_trigger: trigger, resource_reallocation_implication: resource, portfolio_consequence: portfolio, learning_capture: learning, decision_confidence: confidence, quality_flags: flags,
  });
}

export function evaluateDynamicDecision(raw: DynamicDecisionInput, evaluatedAt = new Date().toISOString()): DynamicDecisionResult {
  const parsed = dynamicDecisionInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<DynamicDecisionInput>, ["DYNAMIC.INPUT_SCHEMA_INVALID"], ["input_schema"], evaluatedAt);
  const input = parsed.data;
  if (input.decision_units.length === 0) {
    return dynamicDecisionResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: "NO_DECISION_UNITS", original_recommendation: input.original_recommendation, overall_decision: "VALIDATION_REQUIRED", unit_decisions: [], stop_unit_ids: [], continue_unit_ids: [], scale_unit_ids: [], rollback_unit_ids: [], next_evidence_needed: ["Añadir una unidad de decisión con outcome observado"], portfolio_implications: [], learning_capture: [], reason_codes: ["DYNAMIC.NO_DECISION_UNITS"], unresolved_unknowns: ["decision_units"], source_refs: input.source_refs, evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true });
  }
  const unknowns = validationUnknowns(input);
  if (unknowns.length > input.unresolved_unknowns.length) {
    return dynamicDecisionResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: "VALIDATION_REQUIRED", original_recommendation: input.original_recommendation, overall_decision: "VALIDATION_REQUIRED", unit_decisions: [], stop_unit_ids: [], continue_unit_ids: [], scale_unit_ids: [], rollback_unit_ids: [], next_evidence_needed: ["Completar fidelity, baseline y readiness desconocidos antes de decidir"], portfolio_implications: ["No tomar una decisión global mientras haya unidades sin validar"], learning_capture: [], reason_codes: ["DYNAMIC.EVIDENCE_INCOMPLETE"], unresolved_unknowns: unknowns, source_refs: unique([...input.source_refs, ...input.decision_units.flatMap((item) => item.source_refs)]), evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true });
  }
  const decisions = input.decision_units.map(evaluateUnit);
  const values = unique(decisions.map((item) => item.decision));
  const overall = values.length === 1 ? values[0] : "MIXED";
  return dynamicDecisionResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: "DECISIONS_AVAILABLE", original_recommendation: input.original_recommendation, overall_decision: overall, unit_decisions: decisions, stop_unit_ids: decisions.filter((item) => item.decision === "STOP").map((item) => item.unit_id), continue_unit_ids: decisions.filter((item) => item.decision === "CONTINUE").map((item) => item.unit_id), scale_unit_ids: decisions.filter((item) => item.decision === "SCALE").map((item) => item.unit_id), rollback_unit_ids: decisions.filter((item) => item.decision === "ROLLBACK").map((item) => item.unit_id), next_evidence_needed: unique(decisions.flatMap((item) => item.next_evidence_needed)), portfolio_implications: unique(decisions.map((item) => item.portfolio_consequence)), learning_capture: unique(decisions.map((item) => item.learning_capture)), reason_codes: [], unresolved_unknowns: [], source_refs: unique([...input.source_refs, ...decisions.flatMap((item) => item.source_refs)]), evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true });
}
