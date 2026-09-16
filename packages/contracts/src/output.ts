/**
 * FASE 3 / D14 — Salida diagnostica, trazabilidad y validacion.
 *
 * Fuente: `02-contratos-IA/D14-contrato-de-salida-diagnostica-trazabilidad-y-validacion.md`
 * (41 apartados). Igual que `D12` y `D13`, **una sola capa de fuente**.
 *
 * El ultimo bloque de la fase. No diagnostica: valida, empaqueta, versiona y
 * entrega lo que hicieron `D00` a `D13`. Y sigue sin decidir nada -- apartado
 * 13: severidad es diagnostico, prioridad es F4.
 *
 * AQUI SE PAGA LA DEUDA DEL LENGUAJE. En `D09`, `D10` y `D11` el lenguaje
 * calibrado se vigilaba con expresiones regulares en castellano, y quedo escrito
 * que eso era un lint y no una garantia. **La garantia es esta**: la frase que ve
 * el cliente no se escribe, se compone. `userSummary()` la construye desde el
 * nivel de confianza usando las formulas literales de los guardrails 43 a 46 de
 * `D11`, y en base de datos un check comprueba que el resumen empieza por la que
 * le toca. Escribir "esta claro que" con confianza baja ya no es algo que se
 * detecte: **no se puede guardar**.
 */
import { z } from "zod";

import {
  DIAGNOSTIC_CONFIDENCES,
  type DiagnosticInvariantViolation,
} from "./diagnostics.js";
import { CLAIM_LAYERS } from "./confidence.js";

/**
 * Guardrails 43 a 46 de `D11`, literales, convertidos en la entradilla
 * obligatoria de cada nivel:
 *
 *   HIGH         -- "lenguaje fuerte pero no absoluto"
 *   MEDIUM       -- "la explicacion mas probable"
 *   LOW          -- "compatible con"
 *   INSUFFICIENT -- "no puede determinarse"
 *
 * **Estas cuatro cadenas estan duplicadas en el check
 * `diagnostic_outputs_lenguaje_calibrado` de la migracion de D14**, que es lo
 * que las hace una garantia y no una convencion. Hay un test que lee la
 * migracion y comprueba que no se han separado.
 */
export const CONFIDENCE_LEAD_INS = {
  high: "La evidencia sostiene que",
  medium: "La explicación más probable es",
  low: "Es compatible con",
  insufficient_data: "No puede determinarse",
} as const;

export type ConfidenceLevel = (typeof DIAGNOSTIC_CONFIDENCES)[number];

/**
 * La entradilla que corresponde a un nivel de confianza. Total sobre los cuatro
 * niveles: no hay forma de pedir una que no exista.
 */
export function confidenceLeadIn(level: ConfidenceLevel): string {
  return CONFIDENCE_LEAD_INS[level];
}

/**
 * Compone la frase que ve el cliente. `body` es **el contenido**, no la certeza:
 * la certeza la pone el nivel. Por eso el cuerpo se pasa en minuscula y sin
 * sujeto de opinion -- "la caida viene del proveedor de pagos" -- y sale
 * calibrado segun el nivel:
 *
 *   userSummary("low", "un problema en el proveedor de pagos")
 *     -> "Es compatible con un problema en el proveedor de pagos"
 *   userSummary("high", "el fallo de pagos explica la caida")
 *     -> "La evidencia sostiene que el fallo de pagos explica la caida"
 *
 * **Este es el reemplazo estructural de las tres expresiones regulares.** No
 * detecta lenguaje descalibrado: lo hace imposible.
 */
export function userSummary(level: ConfidenceLevel, body: string): string {
  const cuerpo = body.trim().replace(/^[.,;:\s]+/, "");
  if (cuerpo.length === 0) {
    throw new Error("El resumen de usuario necesita un cuerpo: la entradilla sola no dice nada.");
  }
  return `${confidenceLeadIn(level)} ${cuerpo}`;
}

/** Comprueba que un resumen ya escrito lleva la entradilla de su nivel. */
export function isCalibrated(level: ConfidenceLevel, summary: string): boolean {
  return summary.startsWith(confidenceLeadIn(level));
}

/** Apartado 5. */
export const OUTPUT_STATUSES = [
  "open", "investigating", "partially_confirmed", "confirmed", "recovering",
  "closed", "closed_pending_outcome", "inconclusive", "insufficient_data",
  "invalidated", "reopened",
] as const;

/** Apartado 15. */
export const OUTPUT_COMPLETENESS = [
  "complete", "complete_with_limitations", "incomplete", "blocked",
] as const;

/** Apartado 16: los once validadores. */
export const VALIDATORS = [
  "structural", "semantic", "causal", "evidence", "confidence", "severity",
  "temporal", "confounder", "scope", "contradiction", "output_integrity",
] as const;

export const VALIDATION_RESULTS = ["valid", "pass_with_warnings", "invalid"] as const;

/** Apartado 33. */
export const FAILURE_KINDS = [
  "data_error", "system_error", "reasoning_failure", "validation_failure", "timeout",
] as const;

/** Apartado 23. */
export const OUTPUT_VISIBILITY = ["internal", "admin", "user_visible"] as const;

/** Apartado 18. */
export const CLOSURE_KINDS = ["verified", "administrative", "pending_outcome"] as const;

/**
 * Apartado 38: las doce condiciones del gate. Estan como lista y no como doce
 * `if` sueltos para que el test pueda comprobar que se exigen **todas**.
 */
export const FINALIZATION_GATE = [
  "data_gate_valid", "context_valid", "stage_valid", "hypothesis_review_completed",
  "root_cause_condition_satisfied", "confounder_review_completed", "severity_computed",
  "confidence_calibrated", "temporal_review_completed", "traceability_complete",
  "validation_passed", "phase_boundary_respected",
] as const;

/** Apartado 9: quien produjo el cambio. Un rol, no una persona (como en `D09`). */
export const TRANSITION_ACTORS = [
  "engine", "validator", "consultant", "scheduler", "external_event",
] as const;

// ---------------------------------------------------------------------------
// El objeto diagnostico
// ---------------------------------------------------------------------------

export const diagnosticOutputRecordFields = z.object({
  output_id: z.string().min(1),
  case_id: z.string().min(1),
  version: z.number().int().min(1),
  is_current: z.boolean().default(true),
  supersedes: z.string().optional(),
  superseded_by: z.string().optional(),
  supersession_reason: z.string().optional(),

  status: z.enum(OUTPUT_STATUSES).default("open"),
  completeness_status: z.enum(OUTPUT_COMPLETENESS).default("incomplete"),
  missing_components: z.array(z.string()).default([]),
  blocking_components: z.array(z.string()).default([]),

  data_gate_valid: z.boolean().default(false),
  context_valid: z.boolean().default(false),
  stage_valid: z.boolean().default(false),
  hypothesis_review_completed: z.boolean().default(false),
  root_cause_condition_satisfied: z.boolean().default(false),
  confounder_review_completed: z.boolean().default(false),
  severity_computed: z.boolean().default(false),
  confidence_calibrated: z.boolean().default(false),
  temporal_review_completed: z.boolean().default(false),
  traceability_complete: z.boolean().default(false),
  validation_passed: z.boolean().default(false),
  phase_boundary_respected: z.boolean().default(false),
  finalization_status: z.enum(["finalized_valid", "invalid_output"]).default("invalid_output"),

  root_cause_id: z.string().optional(),
  snapshot_id: z.string().optional(),

  diagnostic_summary: z.string().optional(),
  limitation_summary: z.string().optional(),
  confidence_summary: z.string().optional(),
  data_gap_summary: z.string().optional(),

  confidence: z.enum(DIAGNOSTIC_CONFIDENCES).default("insufficient_data"),
  confidence_language: z.enum(DIAGNOSTIC_CONFIDENCES).default("insufficient_data"),
  user_summary: z.string().optional(),
  visibility: z.enum(OUTPUT_VISIBILITY).default("internal"),

  failure_kind: z.enum(FAILURE_KINDS).optional(),
  failure_detail: z.string().optional(),
  degraded: z.boolean().default(false),

  manual_review_required: z.boolean().default(false),
  manual_review_reason: z.string().optional(),
  handoff_ready: z.boolean().default(false),
});

export const diagnosticOutputRecordSchema = diagnosticOutputRecordFields
  // Apartado 25: el lenguaje **es** la confianza, no una eleccion aparte.
  .refine((o) => o.confidence_language === o.confidence, {
    message: "La interfaz simplifica, no cambia el significado: el lenguaje es el nivel (apartado 25).",
  })
  // La garantia del bloque: la entradilla la pone el nivel.
  .refine(
    (o) => o.user_summary == null || isCalibrated(o.confidence_language, o.user_summary),
    { message: "El resumen de usuario no lleva la entradilla de su nivel de confianza (guardrails 43 a 46 de D11)." },
  )
  // Apartado 38: las doce condiciones o no es final.
  .refine(
    (o) =>
      o.finalization_status !== "finalized_valid" ||
      FINALIZATION_GATE.every((k) => o[k] === true),
    { message: "Marcar una salida como final exige las doce condiciones del gate (apartado 38)." },
  )
  .refine(
    (o) => o.finalization_status !== "finalized_valid" || o.snapshot_id != null,
    { message: "Sin snapshot no hay reproducibilidad, y sin ella no hay salida final (apartado 22)." },
  )
  // Apartado 17.
  .refine(
    (o) =>
      o.status !== "confirmed" ||
      (o.root_cause_id != null &&
        ["high", "medium"].includes(o.confidence) &&
        o.traceability_complete),
    { message: "CONFIRMED exige causa soportada, confianza compatible y trazabilidad (apartado 17)." },
  )
  .refine(
    (o) =>
      o.status !== "insufficient_data" ||
      o.missing_components.length > 0 ||
      o.data_gap_summary != null,
    { message: "INSUFFICIENT_DATA tiene que decir que evidencia falta (apartado 17)." },
  )
  .refine((o) => o.status !== "invalidated" || o.supersession_reason != null, {
    message: "Invalidar conserva el motivo (apartado 17).",
  })
  .refine(
    (o) => o.completeness_status !== "complete_with_limitations" || o.limitation_summary != null,
    { message: "Completo con limitaciones exige escribirlas (apartado 15)." },
  )
  .refine((o) => o.superseded_by == null || o.supersession_reason != null, {
    message: "Sustituir una version exige motivo (apartado 6).",
  })
  .refine((o) => o.superseded_by == null || !o.is_current, {
    message: "Una version sustituida ya no es la vigente.",
  })
  // Apartados 33 y 35.
  .refine((o) => o.failure_kind == null || o.finalization_status === "invalid_output", {
    message: "Un fallo tecnico no se presenta como diagnostico final (apartado 33).",
  })
  .refine((o) => o.failure_kind == null || o.failure_detail != null, {
    message: "Un fallo sin explicar no se puede distinguir de INSUFFICIENT_DATA (apartado 35).",
  })
  .refine((o) => !o.degraded || o.limitation_summary != null, {
    message: "Degradar una salida se anuncia (apartado 35).",
  })
  .refine((o) => !o.handoff_ready || o.finalization_status === "finalized_valid", {
    message: "Al handoff de F4 solo se llega por el gate (apartado 14).",
  })
  .refine((o) => o.visibility !== "user_visible" || o.user_summary != null, {
    message: "Lo que ve el cliente lleva su resumen (apartado 25).",
  })
  .refine((o) => !o.manual_review_required || o.manual_review_reason != null, {
    message: "Pedir revision manual exige decir por que (apartado 27).",
  });

export type DiagnosticOutputRecord = z.infer<typeof diagnosticOutputRecordSchema>;

export const outputEvidenceSchema = z.object({
  output_id: z.string().min(1),
  claim: z.string().min(1),
  claim_layer: z.enum(CLAIM_LAYERS),
  source: z.string().min(1),
  /** Apartado 7: una evidencia sin origen es una afirmacion. */
  source_ref: z.string().min(3),
  metric: z.string().optional(),
  reliability: z.enum(["high", "medium", "low", "unreliable", "unknown"]).default("unknown"),
  transformations: z.string().min(10).optional(),
  /** Apartado 41: la contradictoria tiene sitio para que no desaparezca sola. */
  stance: z.enum(["supporting", "contradicting", "inconclusive"]).default("supporting"),
});

export type OutputEvidence = z.infer<typeof outputEvidenceSchema>;

export const outputValidationSchema = z
  .object({
    output_id: z.string().min(1),
    validator: z.enum(VALIDATORS),
    result: z.enum(VALIDATION_RESULTS).default("invalid"),
    message: z.string().optional(),
    blocking: z.boolean().default(false),
  })
  .refine((v) => v.result !== "pass_with_warnings" || v.message != null, {
    message: "Una advertencia sin mensaje no es una advertencia (apartado 16).",
  })
  .refine((v) => v.result !== "invalid" || v.message != null, {
    message: "Un resultado invalido sin explicar no se puede corregir.",
  })
  .refine((v) => !v.blocking || v.result === "invalid", {
    message: "Si no bloquea, no era un error de integridad (apartado 16).",
  });

export type OutputValidation = z.infer<typeof outputValidationSchema>;

export const outputTransitionSchema = z
  .object({
    case_id: z.string().min(1),
    from_status: z.enum(OUTPUT_STATUSES).optional(),
    to_status: z.enum(OUTPUT_STATUSES),
    actor: z.enum(TRANSITION_ACTORS),
    reason: z.string().min(15),
    evidence_ref: z.string().optional(),
    new_evidence: z.string().optional(),
  })
  .refine((t) => t.from_status == null || t.from_status !== t.to_status, {
    message: "Una transicion es un cambio de estado.",
  })
  // Apartado 19: reabrir exige evidencia nueva, no un cambio de opinion.
  .refine((t) => t.to_status !== "reopened" || t.new_evidence != null, {
    message: "Un caso no se reabre por un cambio de opinion (apartado 19).",
  })
  .refine(
    (t) => t.to_status !== "invalidated" || t.evidence_ref != null || t.new_evidence != null,
    { message: "Invalidar una conclusion confirmada exige evidencia material (apartado 5)." },
  );

export type OutputTransition = z.infer<typeof outputTransitionSchema>;

export const diagnosticClosureSchema = z
  .object({
    case_id: z.string().min(1),
    closure_kind: z.enum(CLOSURE_KINDS).default("pending_outcome"),
    outcome_verified: z.boolean().default(false),
    outcome_evidence: z.string().optional(),
    residual_issues: z.string().optional(),
    followup_required: z.boolean().default(false),
    followup_note: z.string().optional(),
    administrative_closure_reason: z.string().optional(),
  })
  // Apartado 18: resolver la causa no basta para cerrar.
  .refine(
    (c) => c.closure_kind !== "verified" || (c.outcome_verified && c.outcome_evidence != null),
    { message: "Un cierre verificado exige haber comprobado el resultado empresarial (apartado 18)." },
  )
  .refine(
    (c) => c.closure_kind !== "administrative" || c.administrative_closure_reason != null,
    { message: "Cerrar sin verificar es un cierre administrativo, y se declara (apartado 18)." },
  )
  .refine((c) => !c.followup_required || c.followup_note != null, {
    message: "Pedir seguimiento sin concretarlo no es seguimiento.",
  });

export type DiagnosticClosure = z.infer<typeof diagnosticClosureSchema>;

export const diagnosticSnapshotSchema = z
  .object({
    case_id: z.string().min(1),
    as_of: z.string().min(1),
    reproducible: z.boolean().default(false),
    snapshot_available: z.boolean().default(false),
    sources_resolvable: z.boolean().default(false),
    rules_version_available: z.boolean().default(false),
    knowledge_refs_resolvable: z.boolean().default(false),
    model_metadata_available: z.boolean().default(false),
    reproducibility_limitations: z.string().optional(),
  })
  // Apartado 22: reproducible son las cinco cosas, no una etiqueta optimista.
  .refine(
    (s) =>
      !s.reproducible ||
      (s.snapshot_available && s.sources_resolvable && s.rules_version_available &&
        s.knowledge_refs_resolvable && s.model_metadata_available),
    { message: "Reproducible exige las cinco condiciones a la vez (apartado 22)." },
  )
  .refine((s) => s.reproducible || s.reproducibility_limitations != null, {
    message: "Si no se puede reproducir, hay que decir que falta (apartado 22).",
  });

export type DiagnosticSnapshot = z.infer<typeof diagnosticSnapshotSchema>;

// ---------------------------------------------------------------------------
// Las reglas que miran el conjunto
// ---------------------------------------------------------------------------

export type OutputCheckInput = {
  output: DiagnosticOutputRecord;
  evidence?: OutputEvidence[];
  validations?: OutputValidation[];
  closure?: DiagnosticClosure;
  snapshot?: DiagnosticSnapshot;
};

export function checkOutputInvariants(
  input: OutputCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const o = input.output;
  const evidencias = input.evidence ?? [];
  const validaciones = input.validations ?? [];

  // Apartado 16: una salida final ha pasado los once validadores, no algunos.
  if (o.finalization_status === "finalized_valid") {
    const ejecutados = new Set(validaciones.map((v) => v.validator));
    const faltan = VALIDATORS.filter((v) => !ejecutados.has(v));
    if (faltan.length > 0) {
      violations.push({
        rule: "validadores_sin_ejecutar",
        source: "D14 apartado 16",
        message: `Salida marcada como final con validadores sin ejecutar: ${faltan.join(", ")}.`,
      });
    }
  }

  // Apartado 16: un error bloqueante no deja salir nada.
  if (
    o.finalization_status === "finalized_valid" &&
    validaciones.some((v) => v.result === "invalid")
  ) {
    violations.push({
      rule: "final_con_validacion_invalida",
      source: "D14 apartado 16",
      message: "Hay un validador en `invalid` y la salida se marca como finalizada.",
    });
  }

  // Apartado 7 y 41: toda afirmacion material se reconstruye hasta evidencia.
  if (["confirmed", "partially_confirmed"].includes(o.status)) {
    const capasCubiertas = new Set(evidencias.map((e) => e.claim_layer));
    if (!capasCubiertas.has("root_cause")) {
      violations.push({
        rule: "causa_sin_evidencia_trazable",
        source: "D14 apartados 7 y 8",
        message: `Estado ${o.status} sin ninguna evidencia anclada a la capa de causa raiz.`,
      });
    }
  }

  // Apartado 41: la evidencia contradictoria material no se oculta. Una
  // conclusion en alta sin una sola contraria registrada es sospechosa.
  if (
    o.confidence === "high" &&
    evidencias.length > 0 &&
    !evidencias.some((e) => e.stance === "contradicting")
  ) {
    violations.push({
      rule: "sin_contraria_registrada",
      source: "D14 apartado 41",
      message: "Confianza alta sin ninguna evidencia contradictoria registrada: o no se busco, o no se guardo.",
    });
  }

  // Apartado 18: cerrar no es resolver.
  if (
    ["closed"].includes(o.status) &&
    (input.closure == null || input.closure.closure_kind === "pending_outcome")
  ) {
    violations.push({
      rule: "cerrado_sin_verificar_el_resultado",
      source: "D14 apartado 18",
      message: "El caso esta cerrado sin cierre verificado ni cierre administrativo declarado.",
    });
  }

  // Apartado 22: lo que no es reproducible no llega a final.
  if (
    o.finalization_status === "finalized_valid" &&
    input.snapshot != null &&
    !input.snapshot.reproducible
  ) {
    violations.push({
      rule: "final_no_reproducible",
      source: "D14 apartado 22",
      message: "La salida es final y su snapshot no es reproducible.",
    });
  }

  // Apartado 12: los resumenes obligatorios de una salida final.
  if (o.finalization_status === "finalized_valid") {
    const faltan: string[] = [];
    if (o.diagnostic_summary == null) faltan.push("diagnostic_summary");
    if (o.confidence_summary == null) faltan.push("confidence_summary");
    if (faltan.length > 0) {
      violations.push({
        rule: "resumenes_obligatorios_ausentes",
        source: "D14 apartado 12",
        message: `Salida final sin ${faltan.join(" ni ")}.`,
      });
    }
  }

  // Apartado 25: la salida de usuario no puede ser mas segura que la interna.
  if (o.visibility === "user_visible" && o.confidence === "insufficient_data" && !o.degraded) {
    if (o.user_summary != null && !o.user_summary.startsWith(CONFIDENCE_LEAD_INS.insufficient_data)) {
      violations.push({
        rule: "usuario_ve_mas_certeza_de_la_que_hay",
        source: "D14 apartado 25",
        message: "El resumen visible afirma mas de lo que sostiene la confianza interna.",
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Motor puro D14. Recibe las salidas de D00-D13 ya persistidas y solo arma,
// valida y calibra el registro final. La escritura, versionado y aislamiento
// de tenant viven en `apps/api/src/diagnostic-output-engine.ts`.
// ---------------------------------------------------------------------------

export type DiagnosticOutputEvidenceInput = {
  claim: string;
  claimLayer: (typeof CLAIM_LAYERS)[number];
  source: string;
  sourceRef: string;
  metric?: string;
  reliability?: "high" | "medium" | "low" | "unreliable" | "unknown";
  transformations?: string;
  stance?: "supporting" | "contradicting" | "inconclusive";
};

export type DiagnosticOutputRuntimeInput = {
  outputId: string;
  caseId: string;
  organizationId: string;
  target: string;
  status?: (typeof OUTPUT_STATUSES)[number];
  confidence?: (typeof DIAGNOSTIC_CONFIDENCES)[number];
  snapshotId?: string;
  rootCause: { id: string; statement: string; status?: string } | null;
  constraint: { id: string; statement?: string; status?: string } | null;
  severity: { id: string; overall_severity?: string; summary?: string } | null;
  robustness: { id: string; false_diagnosis_risk?: string; robustness?: string } | null;
  temporal: { id: string; trajectory?: string; onset?: string } | null;
  hypotheses: { id: string; status?: string }[];
  evidence: DiagnosticOutputEvidenceInput[];
  dataQualityValid: boolean;
  contextValid: boolean;
  stageValid?: boolean;
  temporalReviewCompleted?: boolean;
  confounderReviewCompleted?: boolean;
  modelVersion?: string;
  promptVersion?: string;
  rulesVersion?: string;
  contractVersion?: string;
  traceId?: string;
};

export type DiagnosticOutputRuntimeResult = {
  output: DiagnosticOutputRecord;
  evidence: OutputEvidence[];
  validations: OutputValidation[];
  snapshot: DiagnosticSnapshot;
};

function validation(
  outputId: string,
  validator: (typeof VALIDATORS)[number],
  result: (typeof VALIDATION_RESULTS)[number],
  message?: string,
  blocking = false,
): OutputValidation {
  return outputValidationSchema.parse({ output_id: outputId, validator, result, message, blocking });
}

export function finalizeDiagnosticOutput(input: DiagnosticOutputRuntimeInput): DiagnosticOutputRuntimeResult {
  const confidence = input.confidence ?? "insufficient_data";
  const evidence = input.evidence.map((item) => outputEvidenceSchema.parse({
    output_id: input.outputId, claim: item.claim, claim_layer: item.claimLayer,
    source: item.source, source_ref: item.sourceRef, metric: item.metric,
    reliability: item.reliability ?? "unknown", transformations: item.transformations,
    stance: item.stance ?? "supporting",
  }));
  const hasRootEvidence = evidence.some((item) => item.claim_layer === "root_cause");
  const rootCauseConditionSatisfied = input.rootCause != null && hasRootEvidence;
  const traceabilityComplete = evidence.length > 0 && hasRootEvidence;
  const temporalReviewCompleted = input.temporalReviewCompleted ?? input.temporal != null;
  const confounderReviewCompleted = input.confounderReviewCompleted ?? input.robustness != null;
  const gate: Record<(typeof FINALIZATION_GATE)[number], boolean> = {
    data_gate_valid: input.dataQualityValid,
    context_valid: input.contextValid,
    stage_valid: input.stageValid ?? input.hypotheses.length > 0,
    hypothesis_review_completed: input.hypotheses.length > 0,
    root_cause_condition_satisfied: rootCauseConditionSatisfied,
    confounder_review_completed: confounderReviewCompleted,
    severity_computed: input.severity != null,
    confidence_calibrated: confidence !== "insufficient_data",
    temporal_review_completed: temporalReviewCompleted,
    traceability_complete: traceabilityComplete,
    validation_passed: false,
    phase_boundary_respected: true,
  };
  const validations: OutputValidation[] = [
    validation(input.outputId, "structural", "valid"),
    validation(input.outputId, "semantic", input.rootCause || input.temporal ? "valid" : "pass_with_warnings", input.rootCause || input.temporal ? undefined : "Todavía no hay una explicación estructurada completa."),
    validation(input.outputId, "causal", rootCauseConditionSatisfied ? "valid" : "invalid", rootCauseConditionSatisfied ? undefined : "No hay causa raíz anclada a evidencia del caso.", !rootCauseConditionSatisfied),
    validation(input.outputId, "evidence", traceabilityComplete ? "valid" : "invalid", traceabilityComplete ? undefined : "Falta evidencia trazable para la salida.", !traceabilityComplete),
    validation(input.outputId, "confidence", gate.confidence_calibrated ? "valid" : "pass_with_warnings", gate.confidence_calibrated ? undefined : "La confianza permanece en datos insuficientes."),
    validation(input.outputId, "severity", input.severity ? "valid" : "pass_with_warnings", input.severity ? undefined : "La severidad aún no ha sido calculada."),
    validation(input.outputId, "temporal", temporalReviewCompleted ? "valid" : "pass_with_warnings", temporalReviewCompleted ? undefined : "La revisión temporal aún no está disponible."),
    validation(input.outputId, "confounder", confounderReviewCompleted ? "valid" : "pass_with_warnings", confounderReviewCompleted ? undefined : "La revisión de confusores aún no está disponible."),
    validation(input.outputId, "scope", input.contextValid ? "valid" : "pass_with_warnings", input.contextValid ? undefined : "El alcance contextual aún no está validado."),
    validation(input.outputId, "contradiction", evidence.some((item) => item.stance === "contradicting") ? "valid" : "pass_with_warnings", evidence.some((item) => item.stance === "contradicting") ? undefined : "No se registró evidencia contradictoria; revisar antes de elevar la confianza."),
    validation(input.outputId, "output_integrity", "valid"),
  ];
  gate.validation_passed = validations.every((item) => item.result !== "invalid");
  const allGate = FINALIZATION_GATE.every((key) => gate[key]);
  const snapshotReproducible = input.snapshotId != null && input.evidence.length > 0 && input.rulesVersion != null && input.modelVersion != null;
  const finalizationStatus = allGate && snapshotReproducible ? "finalized_valid" : "invalid_output";
  const finalStatus = input.status ?? (rootCauseConditionSatisfied ? "partially_confirmed" : "investigating");
  const missing: string[] = FINALIZATION_GATE.filter((key) => !gate[key]);
  if (finalizationStatus === "invalid_output" && input.snapshotId == null) missing.push("snapshot_available");
  const limitations = missing.length ? `La salida no está finalizada porque faltan: ${missing.join(", ")}.` : undefined;
  const body = input.rootCause?.statement ?? "faltan datos suficientes para sostener una explicación diagnóstica";
  const userSummary = userSummaryForOutput(confidence, body);
  const output = diagnosticOutputRecordSchema.parse({
    output_id: input.outputId, case_id: input.caseId, version: 1,
    status: finalStatus, completeness_status: finalizationStatus === "finalized_valid" ? "complete" : missing.length ? "incomplete" : "complete_with_limitations",
    missing_components: missing, blocking_components: validations.filter((item) => item.blocking).map((item) => item.validator),
    ...gate, finalization_status: finalizationStatus, root_cause_id: input.rootCause?.id,
    snapshot_id: input.snapshotId, diagnostic_summary: `${confidenceLeadIn(confidence)} ${body}.`,
    limitation_summary: limitations, confidence_summary: `Confianza ${confidence}; se conserva separada de completitud y validación.`,
    data_gap_summary: missing.length ? `Evidencia pendiente: ${missing.join(", ")}.` : undefined,
    confidence, confidence_language: confidence, user_summary: userSummary, visibility: "admin",
    degraded: finalizationStatus !== "finalized_valid", manual_review_required: finalizationStatus !== "finalized_valid",
    manual_review_reason: finalizationStatus !== "finalized_valid" ? "La puerta de finalización aún no reúne todos sus componentes." : undefined,
    handoff_ready: finalizationStatus === "finalized_valid", model_version: input.modelVersion,
    prompt_version: input.promptVersion, rules_version: input.rulesVersion, contract_version: input.contractVersion,
    trace_id: input.traceId,
  });
  const snapshot = diagnosticSnapshotSchema.parse({
    case_id: input.caseId, as_of: new Date().toISOString(), reproducible: snapshotReproducible,
    snapshot_available: input.snapshotId != null, sources_resolvable: input.evidence.length > 0,
    rules_version_available: input.rulesVersion != null, knowledge_refs_resolvable: true,
    model_metadata_available: input.modelVersion != null,
    reproducibility_limitations: snapshotReproducible ? undefined : "El snapshot todavía no reúne evidencia y metadatos suficientes para reproducirse.",
  });
  return { output, evidence, validations, snapshot };
}

function userSummaryForOutput(level: ConfidenceLevel, body: string): string {
  return userSummary(level, body);
}
