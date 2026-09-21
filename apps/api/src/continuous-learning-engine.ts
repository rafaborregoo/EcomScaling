import { createClient } from "@supabase/supabase-js";
import { evaluateContinuousLearning, F9_BLOCK_CODES, type F9BlockCode, type LearningExperienceInput, type LearningAssessment } from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";

const SOURCE = "f9-learning-engine.v1";
type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
const text = (value: unknown, fallback = "UNKNOWN") => typeof value === "string" && value.trim() ? value : fallback;
const nullableText = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const json = (value: unknown): Row => record(value);
function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }

export const F9_RUNTIME_PROFILES: Record<F9BlockCode, { title: string; steps: string[] }> = {
  "9.00": { title: "Framework universal", steps: ["comparar contexto", "comparar ejecución", "comparar segmento", "comparar mercado", "comparar madurez", "comparar medición", "evaluar cambio temporal", "detectar contradicción"] },
  "9.01": { title: "Unidad de experiencia y contexto", steps: ["capturar contexto", "capturar problema", "capturar decisión", "capturar intervención", "capturar ejecución", "capturar entorno", "capturar restricciones", "capturar outcome"] },
  "9.03": { title: "Execution fidelity", steps: ["comparar plan y ejecución", "separar fallo de estrategia", "separar fallo de ejecución", "separar fallo de medición", "revisar cambio de contexto", "revisar constraints", "revisar precondiciones", "revisar incidentes"] },
  "9.04": { title: "Evidence quality", steps: ["identificar claim", "validar muestra", "validar representatividad", "validar balance", "validar calidad de datos", "validar métrica", "validar ventana", "asignar calidad"] },
  "9.05": { title: "Causalidad y atribución", steps: ["identificar claim causal", "identificar intervención", "identificar outcome", "verificar temporalidad", "identificar baseline", "buscar contrafactual", "separar atribución e incrementalidad", "asignar fuerza"] },
  "9.06": { title: "Confounders", steps: ["recibir intervención y outcome", "definir ventana causal", "construir timeline", "detectar concurrentes", "revisar confusores", "revisar mix shifts", "revisar tracking", "revisar tendencia previa"] },
  "9.07": { title: "Fuerza de evidencia", steps: ["identificar claim", "localizar evidencia", "clasificar tipo", "evaluar diseño", "evaluar medición", "revisar confounding", "evaluar efecto e incertidumbre", "revisar replicación"] },
  "9.08": { title: "Madurez de outcome", steps: ["identificar outcome", "identificar horizonte", "calcular edad", "comprobar volumen", "revisar lag", "revisar novelty", "revisar carryover", "revisar madurez de cohort"] },
  "9.09": { title: "Learning confidence", steps: ["cargar claim", "cargar evidencia", "cargar fidelity", "cargar atribución", "cargar replicación", "cargar estabilidad", "cargar contradicciones", "aplicar ceiling"] },
  "9.10": { title: "Generalization boundary", steps: ["identificar learning", "cargar contexto origen", "cargar boundary", "cargar contexto destino", "comparar dimensiones", "detectar mismatches", "revisar moderators", "validar condiciones"] },
  "9.11": { title: "Contextual learning", steps: ["identificar learning", "obtener contexto origen", "obtener contexto actual", "identificar dimensiones", "detectar moderators", "evaluar interacciones", "comparar madurez", "comparar economics"] },
  "9.12": { title: "Outcome classification", steps: ["identificar intervención", "identificar primary outcome", "recuperar expected effect", "evaluar observed effect", "comprobar maturity", "comprobar materiality", "comprobar atribución", "revisar guardrails"] },
  "9.13": { title: "Incident learning", steps: ["detectar incidente", "clasificar tipo", "evaluar severidad", "contener", "decidir rollback o escalado", "recuperar", "identificar residuales", "proteger datos contaminados"] },
  "9.14": { title: "Human override", steps: ["registrar propuesta IA", "registrar intervención humana", "clasificar override", "identificar review", "capturar rationale", "clasificar motivo", "registrar decisión final", "observar outcome"] },
  "9.15": { title: "Recommendation learning", steps: ["registrar problema y recomendación", "registrar evidencia y contexto", "registrar expected impact", "registrar respuesta humana", "clasificar aceptación", "comprobar ejecución", "registrar versión ejecutada", "evaluar fidelity"] },
  "9.16": { title: "Prioritization learning", steps: ["identificar problema", "registrar alternativas", "estimar impact y urgency", "identificar bottleneck", "revisar dependencias", "medir acción", "calcular gap", "aprender prioridad"] },
  "9.17": { title: "Playbook learning", steps: ["identificar objetivo", "seleccionar versión", "validar precondiciones", "seleccionar branch", "registrar secuencia", "ejecutar pasos", "registrar deviations", "comprobar completion"] },
  "9.18": { title: "Benchmarks y guardrails", steps: ["identificar benchmark", "cargar versión y contexto", "recopilar triggers", "clasificar outcomes", "revisar false positives", "revisar false negatives", "revisar near misses", "revisar incidentes prevenidos"] },
  "9.19": { title: "Autonomy learning", steps: ["identificar acción", "recuperar autoridad", "recuperar trust boundary", "evaluar riesgo", "verificar contexto", "verificar calidad de datos", "comprobar aprobación", "comprobar scope"] },
  "9.20": { title: "Operational friction", steps: ["identificar dependencias", "comprobar accesos", "validar datos", "verificar capacidad", "comprobar tools", "identificar approvals", "confirmar owner", "validar rollback"] },
  "9.22": { title: "Contradictions", steps: ["identificar claims relacionados", "comparar scope", "comparar contexto", "comparar temporalidad", "comparar métricas", "comparar dirección y magnitud", "detectar overlap", "clasificar contradicción"] },
  "9.23": { title: "Decay y drift", steps: ["comprobar estado temporal", "revisar última validación", "comprobar estabilidad", "verificar contexto", "buscar structural breaks", "buscar drift", "revisar contradicciones", "estimar vigencia"] },
  "9.24": { title: "Exploration vs exploitation", steps: ["identificar objetivo", "recuperar evidencia", "evaluar confidence", "evaluar uncertainty", "comprobar drift", "estimar upside", "evaluar riesgo", "comprobar governance"] },
  "9.25": { title: "Learning loops", steps: ["abrir loop", "capturar pre-execution", "seguir ejecución", "esperar madurez", "evaluar outcome", "cerrar loop", "reabrir si procede", "aplicar learning"] },
  "9.26": { title: "Knowledge promotion", steps: ["detectar candidate", "seleccionar target", "pasar evidence gate", "pasar context gate", "pasar contradiction gate", "pasar governance", "promover versión", "registrar boundary"] },
  "9.27": { title: "Supersession", steps: ["detectar conflicto", "clasificar coexistence o supersession", "pasar evidence gate", "preservar lineage", "versionar", "activar successor", "limitar predecessor", "actualizar retrieval"] },
  "9.28": { title: "Anti-learning", steps: ["pasar data quality", "pasar execution gate", "pasar outcome gate", "pasar attribution gate", "buscar sesgos", "buscar contradicción", "rechazar conclusión contaminada", "registrar deuda de evidencia"] },
  "9.29": { title: "Dangerous feedback loops", steps: ["monitorizar exposición", "detectar amplification", "corregir exposure", "pasar concentration gate", "pasar secondary outcome gate", "activar circuit breaker", "mantener exploration", "revisar asignación"] },
  "9.30": { title: "Learning governance", steps: ["identificar objeto", "identificar acción", "evaluar riesgo", "evaluar scope", "identificar policy impact", "asignar governance", "aprobar o escalar", "registrar rationale"] },
  "9.31": { title: "Explainable learning", steps: ["disparar explicación", "recuperar evidencia", "construir rationale", "adaptar audiencia", "pasar faithfulness", "mostrar incertidumbre", "mostrar límites", "enlazar fuentes"] },
  "9.32": { title: "Traceability", steps: ["crear identidad", "capturar transformación", "capturar decisión", "enlazar outcome", "versionar transición", "propagar invalidación", "conservar provenance", "exponer lineage"] },
  "9.33": { title: "Forgetting y withdrawal", steps: ["detectar trigger", "evaluar scope", "pasar invalidation gate", "retirar estado", "limpiar retrieval", "limpiar derivados", "conservar auditoría", "verificar ausencia operativa"] },
  "9.34": { title: "Transfer learning", steps: ["recuperar candidates", "evaluar similarity", "clasificar transfer", "pasar risk gate", "validar localmente", "actualizar evidencia local", "limitar generalización", "registrar privacidad"] },
  "9.35": { title: "Cohort learning", steps: ["detectar candidate", "evaluar membership", "pasar evidence gate", "activar cohort", "usar como prior", "detectar split", "detectar merge", "revalidar miembros"] },
  "9.36": { title: "Global vs tenant learning", steps: ["resolver contexto", "recuperar policies", "recuperar tenant", "recuperar cohort", "recuperar global", "pasar applicability", "resolver conflictos", "mantener cold start"] },
  "9.37": { title: "Privacy y isolation", steps: ["resolver scope", "pasar access gate", "filtrar retrieval", "pasar cross-tenant gate", "pasar promotion", "pasar explanation gate", "auditar uso", "bloquear reidentificación"] },
  "9.38": { title: "Long-term learning", steps: ["clasificar horizonte", "detectar consolidación", "comprimir con provenance", "programar revalidación", "detectar structural breaks", "degradar aplicabilidad", "mover a dormant", "reactivar con match"] },
  "9.39": { title: "Strategic learning", steps: ["resolver pregunta estratégica", "identificar constraint", "formular thesis y alternatives", "registrar assumptions", "estimar reversibilidad", "comparar allocation", "definir maturity y kill criteria", "clasificar thesis"] },
  "9.40": { title: "Meta-learning", steps: ["observar episodios", "capturar éxito o fallo del proceso", "clasificar attribution", "medir calibración", "detectar blind spots", "comparar yield", "generar candidate", "gobernar cambio"] },
  "9.41": { title: "Framework final", steps: ["resolve context", "observe", "evidence gate", "candidate gate", "anti-learning gate", "pattern y validation", "contradiction gate", "promotion y governance"] },
};

export function learningInputFromSources(blockCode: F9BlockCode, organizationId: string, closureRow: unknown, outputRow: unknown, now = new Date().toISOString()): LearningExperienceInput {
  const closure = record(closureRow); const closureResult = json(closure.result); const closureSnapshot = json(closure.final_state_snapshot ?? closureResult.final_state_snapshot); const outputRecord = record(outputRow); const output = json(outputRecord.output);
  const outputEvidence = json(output.evidence); const observed = json(output.observed_outcome); const inputEnvelope = json(closure.input_envelope);
  const sourceRefs = [...new Set([SOURCE, "execution_closure_runs", "agent_outputs", ...strings(closure.source_refs), ...strings(output.source_refs)])];
  const explicitClassification = text(observed.classification, text(output.outcome_classification, "INCONCLUSIVE")).toUpperCase();
  const unknowns = [...strings(closure.unresolved_unknowns), ...strings(closure.blockers), ...strings(output.known_unknowns)];
  return {
    organization_id: organizationId, block_code: blockCode,
    experience_id: text(closure.id, `f9-experience:${organizationId}:${text(outputRecord.id, "none")}`),
    intervention_id: nullableText(closure.intervention_id ?? output.run_id), recommendation_id: nullableText(closure.recommendation_id ?? output.recommendation_id), output_id: nullableText(outputRecord.id),
    business_context: { organization_id: organizationId, ...json(inputEnvelope.business_context ?? output.business_context) },
    problem_state: { ...json(inputEnvelope.problem_state ?? output.problem_state), symptom: text(inputEnvelope.problem ?? output.problem, "UNKNOWN") },
    decision_context: { ...json(inputEnvelope.decision_context ?? output.decision_context), rationale: text(inputEnvelope.rationale ?? output.rationale, "UNKNOWN") },
    planned_execution: { ...json(inputEnvelope.planned_execution ?? output.planned_execution), expected_state: text(closureSnapshot.expected, text(output.expected_state, "UNKNOWN")) },
    actual_execution: { ...json(inputEnvelope.actual_execution ?? output.actual_execution), closure_state: text(closure.closure_state, "NOT_AVAILABLE"), verification_status: text(closure.verification_status, "UNKNOWN"), operational_outcome: text(closure.operational_outcome, "NOT_EXECUTED") },
    environment: json(inputEnvelope.environment ?? output.environment), constraints: Array.isArray(inputEnvelope.constraints) ? inputEnvelope.constraints.filter((item): item is Row => !!item && typeof item === "object" && !Array.isArray(item)) : [],
    observation_window: { start: nullableText(closure.as_of ?? output.observation_start), end: nullableText(closure.evaluated_at ?? output.observation_end), horizon: text(output.observation_horizon, text(closure.outcome_maturity, "UNKNOWN")) },
    expected_outcome: { ...json(inputEnvelope.expected_outcome ?? output.expected_outcome), state: text(output.expected_state, "UNKNOWN") },
    observed_outcome: { ...observed, classification: explicitClassification, operational_outcome: text(closure.operational_outcome, "NOT_EXECUTED"), maturity: text(closure.outcome_maturity, "INCOMPLETE"), state: text(closureSnapshot.actual, "UNKNOWN") },
    evidence: { measurement_quality: text(outputEvidence.measurement_quality, "UNKNOWN").toUpperCase() as "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH", attribution_strength: text(outputEvidence.attribution_strength, "UNKNOWN").toUpperCase() as "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH", evidence_strength: text(outputEvidence.evidence_strength, "UNKNOWN").toUpperCase() as "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH", sample_sufficient: outputEvidence.sample_sufficient === true, confounders: strings(outputEvidence.confounders), source_refs: sourceRefs },
    source_refs: sourceRefs, unresolved_unknowns: [...new Set(unknowns)],
  };
}

async function persist(supabase: any, organizationId: string, input: LearningExperienceInput, result: LearningAssessment, asOf: string) {
  const existing = await supabase.from("continuous_learning_runs").select("id, status, classification").eq("organization_id", organizationId).eq("block_code", input.block_code).eq("input_fingerprint", result.input_fingerprint).maybeSingle();
  if (existing.error) throw new Error(`continuous_learning_lookup_failed: ${existing.error.message}`);
  if (existing.data) {
    const updated = await supabase.from("continuous_learning_runs").update({ evaluated_at: result.evaluated_at, status: result.status, classification: result.classification, confidence: result.confidence, gate: result.gate, input_envelope: input, result, rationale: result.rationale, learning: result.learning, next_evidence_needed: result.next_evidence_needed, unresolved_unknowns: result.unresolved_unknowns, source_refs: result.source_refs }).eq("id", existing.data.id).select("id, status, classification").single();
    if (updated.error || !updated.data) throw new Error(`continuous_learning_update_failed: ${updated.error?.message ?? "no row"}`);
    return updated.data;
  }
  const inserted = await supabase.from("continuous_learning_runs").insert({ organization_id: organizationId, block_code: input.block_code, experience_id: input.experience_id, intervention_id: input.intervention_id, recommendation_id: input.recommendation_id, output_id: input.output_id, as_of: asOf, evaluated_at: result.evaluated_at, input_fingerprint: result.input_fingerprint, status: result.status, classification: result.classification, confidence: result.confidence, gate: result.gate, input_envelope: input, result, rationale: result.rationale, learning: result.learning, next_evidence_needed: result.next_evidence_needed, unresolved_unknowns: result.unresolved_unknowns, source_refs: result.source_refs }).select("id, status, classification").single();
  if (inserted.error || !inserted.data) throw new Error(`continuous_learning_write_failed: ${inserted.error?.message ?? "no row"}`);
  return inserted.data;
}

export async function runContinuousLearningEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [closureResult, outputResult] = await Promise.all([
    supabase.from("execution_closure_runs").select("id, intervention_id, recommendation_id, output_id, as_of, evaluated_at, closure_state, closure_gate, operational_outcome, verification_status, outcome_maturity, final_state_snapshot, unresolved_unknowns, blockers, source_refs, input_envelope, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("agent_outputs").select("id, run_id, output, status, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (closureResult.error) throw new Error(`continuous_learning_closure_load_failed: ${closureResult.error.message}`);
  if (outputResult.error) throw new Error(`continuous_learning_output_load_failed: ${outputResult.error.message}`);
  const closure = closureResult.data ?? {}; const output = outputResult.data ?? {}; const now = new Date().toISOString(); const asOf = text(closure.as_of, now);
  let assessments = 0; let succeeded = 0;
  for (const blockCode of F9_BLOCK_CODES) {
    const input = learningInputFromSources(blockCode, organizationId, closure, output, now);
    const baseResult = evaluateContinuousLearning(input, now);
    const profile = F9_RUNTIME_PROFILES[blockCode];
    const result: LearningAssessment = { ...baseResult, rationale: [...baseResult.rationale, `Perfil runtime ${blockCode}: ${profile.title}.`, `Pasos registrados: ${profile.steps.join(" → ")}.`], source_refs: [...new Set([...baseResult.source_refs, SOURCE])] };
    await persist(supabase, organizationId, input, result, asOf); assessments += 1; succeeded += 1;
  }
  return { organization_id: organizationId, assessments, succeeded, closure_assessment_id: nullableText(closure.id), source: SOURCE };
}

export async function runContinuousLearningEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (loaded.error) throw new Error(`continuous_learning_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of loaded.data ?? []) { summary.organizations += 1; try { const result = await runContinuousLearningEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += result.assessments; } catch { summary.failed += 1; } }
  return summary;
}
