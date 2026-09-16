/**
 * FASE 3 / D13 — Diagnostico temporal y regresion.
 *
 * Fuente: `02-contratos-IA/D13-contrato-de-diagnostico-temporal-y-regresion.md`
 * (35 apartados, 22 tests nombrados con sus fixtures).
 *
 * Igual que `D12`, **una sola capa de fuente**: solo el contrato.
 *
 * LA PELICULA, NO LA FOTO. `D05` a `D12` describen un momento; `D13` describe la
 * evolucion. Sin priorizar ni recomendar (apartado 34).
 *
 * EL INVARIANTE CENTRAL ES `STATE != TRAJECTORY`, Y LA GARANTIA ES LA AUSENCIA
 * DE UNA REGLA. Nada obliga a `current_state` y `trajectory` a coincidir, porque
 * BAD + IMPROVING y HEALTHY + DETERIORATING son justo las combinaciones que mas
 * importa poder escribir. Hay tests que comprueban que las dos caben.
 *
 * Y lo mismo con tres separaciones mas, tambien sin regla que las ate:
 *   * los tres horizontes (apartado 19): sus conflictos son validos;
 *   * las tres recuperaciones (apartados 9 y 28): RESOLUTION != RECOVERY;
 *   * la trayectoria cruda y la ajustada por `D12` (apartado 23).
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";
import { HEALTH_STATES } from "./health.js";
import { PERSISTENCE_STATES } from "./signals.js";

/** Apartado 2: los once estados temporales. */
export const TRAJECTORY_STATES = [
  "improving", "stable", "deteriorating", "rapidly_deteriorating", "recovering",
  "volatile", "regressed", "recurrent", "new_regime", "mixed", "unknown",
] as const;

/** Apartado 5. */
export const CHANGE_TYPES = [
  "abrupt", "gradual", "accelerating", "decelerating",
  "cyclical", "intermittent", "step_change",
] as const;

/** Apartado 5: relativa al dominio. No hay escala temporal universal. */
export const VELOCITIES = ["very_slow", "slow", "moderate", "fast", "extreme", "unknown"] as const;

/** Apartado 6. */
export const TEMPORAL_SUFFICIENCY = ["sufficient", "partial", "insufficient"] as const;

/**
 * Apartado 6. **No se redefine**: `D05` ya tiene estos cuatro valores y son
 * exactamente los mismos. Dos catalogos de lo que significa "cronico" acabarian
 * diciendo cosas distintas del mismo problema.
 */
export { PERSISTENCE_STATES };

/** Apartado 4: la precision no puede superar a la de la fuente. */
export const TIME_GRANULARITIES = ["minute", "hour", "day", "week", "month", "unknown"] as const;

/** Apartado 4: el primer dato observado no es necesariamente el inicio real. */
export const PRE_EXISTING_STATES = [
  "pre_existing", "likely_pre_existing", "new", "unknown",
] as const;

/**
 * Apartado 8. `chronic_weakness` esta aqui por el fixture "Not Regression": una
 * debilidad que siempre estuvo ahi no es una regresion, y el vocabulario tiene
 * que ofrecer la palabra correcta o alguien usara la incorrecta.
 */
export const REGRESSION_STATUSES = ["none", "regressed", "chronic_weakness", "unknown"] as const;

export const REGRESSION_TYPES = [
  "performance_regression", "technical_regression", "process_regression",
  "operational_regression", "data_regression", "maturity_regression",
  "behavioral_regression",
] as const;

/** Apartado 9. */
export const RECOVERY_STATUSES = [
  "not_recovering", "early_recovery", "partial_recovery",
  "near_baseline", "recovered", "relapsed",
] as const;

/** Apartado 10. */
export const LAG_FITS = ["strong", "acceptable", "weak", "incompatible", "unknown"] as const;

/** Apartado 12. */
export const RECURRENCE_STATUSES = [
  "first_occurrence", "second_occurrence", "recurring", "systematic",
] as const;

/** Apartado 16. */
export const NOISE_CLASSES = [
  "noise", "short_lived_spike", "material_episode", "structural_trend",
] as const;

/** Apartado 17. Los constraints no son permanentes por definicion. */
export const ROOT_CAUSE_LIFECYCLE = [
  "emerged", "active", "peaked", "mitigated", "resolved", "recurrent",
] as const;
export const CONSTRAINT_LIFECYCLE = [
  "latent", "emerging", "binding", "easing", "removed", "shifted",
] as const;

/** Apartado 18. */
export const MATURITY_TRAJECTORIES = [
  "advancing", "stable", "stagnating", "regressing", "unknown",
] as const;

/** Apartado 7. */
export const BASELINE_STATUSES = ["active", "under_review", "frozen", "superseded"] as const;
export const REGIME_STATUSES = [
  "stable", "new_regime_candidate", "new_regime_supported", "unknown",
] as const;

/** Apartado 19: no se elige el timeframe que mejor apoye la hipotesis preferida. */
export const TEMPORAL_COMPARISON_TYPES = [
  "previous_period", "rolling", "yoy", "pre_event", "post_event",
  "historical_normal", "regime_baseline",
] as const;

/** Apartado 29. */
export const TEMPORAL_COMPLETENESS = [
  "full_history", "partial_history", "recent_only", "unknown",
] as const;

/** Apartado 25. */
export const TEMPORAL_EVENT_TYPES = [
  "new_deterioration", "acceleration", "regression", "recurrence",
  "recovery_started", "recovered", "relapse", "regime_shift", "constraint_shift",
] as const;

const CONFIANZA = ["high", "medium", "low", "unknown"] as const;

/** Mas fino = numero menor. `unknown` queda al final a proposito. */
const FINURA: Record<string, number> = {
  minute: 1, hour: 2, day: 3, week: 4, month: 5, unknown: 9,
};
const finura = (x: string) => FINURA[x] ?? 9;

/** Las trayectorias que apuntan hacia abajo, para detectar conflictos. */
const A_PEOR = ["deteriorating", "rapidly_deteriorating", "regressed"];
const A_MEJOR = ["improving", "recovering"];

// ---------------------------------------------------------------------------
// El diagnostico temporal
// ---------------------------------------------------------------------------

export const temporalDiagnosisFields = z.object({
  diagnosis_id: z.string().min(1),
  case_id: z.string().min(1),
  target: z.string().min(1),
  temporal_scope: z.string().default("global"),

  /** Apartado 1: dos campos, y ninguna regla que los obligue a coincidir. */
  current_state: z.enum([...HEALTH_STATES, "unknown"]).default("unknown"),
  trajectory: z.enum(TRAJECTORY_STATES).default("unknown"),

  /** Apartado 19: los conflictos entre horizontes se conservan. */
  short_term_trajectory: z.enum(TRAJECTORY_STATES).default("unknown"),
  medium_term_trajectory: z.enum(TRAJECTORY_STATES).default("unknown"),
  long_term_trajectory: z.enum(TRAJECTORY_STATES).default("unknown"),

  /** Apartado 23. */
  raw_trajectory: z.enum(TRAJECTORY_STATES).optional(),
  context_adjusted_trajectory: z.enum(TRAJECTORY_STATES).optional(),

  onset_estimated_at: z.string().optional(),
  onset_range_start: z.string().optional(),
  onset_range_end: z.string().optional(),
  onset_precision: z.enum(TIME_GRANULARITIES).default("unknown"),
  source_granularity: z.enum(TIME_GRANULARITIES).default("unknown"),
  pre_existing_status: z.enum(PRE_EXISTING_STATES).default("unknown"),

  change_type: z.enum(CHANGE_TYPES).optional(),
  change_point_at: z.string().optional(),
  acceleration: z.enum(["accelerating", "decelerating", "stable", "unknown"]).default("unknown"),
  velocity: z.enum(VELOCITIES).default("unknown"),

  temporal_sufficiency: z.enum(TEMPORAL_SUFFICIENCY).default("insufficient"),
  persistence: z.enum(PERSISTENCE_STATES).default("transient"),
  duration_hours: z.number().min(0).optional(),

  noise_classification: z.enum(NOISE_CLASSES).default("noise"),
  trend_confidence: z.enum(["high", "medium", "low", "insufficient"]).default("insufficient"),
  trend_robustness: z.enum(["high", "medium", "low"]).default("low"),

  recurrence_status: z.enum(RECURRENCE_STATUSES).default("first_occurrence"),
  recurrence_kind: z.enum(["expected_recurrence", "pathological_recurrence"]).optional(),

  regression_status: z.enum(REGRESSION_STATUSES).default("none"),
  regression_type: z.enum(REGRESSION_TYPES).optional(),
  previous_state: z.string().optional(),
  previous_stable_period_start: z.string().optional(),
  previous_stable_period_end: z.string().optional(),

  /** Apartados 9 y 28: tres capas, y nada las ata. */
  cause_recovery: z.enum(RECOVERY_STATUSES).default("not_recovering"),
  system_recovery: z.enum(RECOVERY_STATUSES).default("not_recovering"),
  business_impact_recovery: z.enum(RECOVERY_STATUSES).default("not_recovering"),
  recovery_persistence_met: z.boolean().default(false),

  root_cause_lifecycle: z.enum(ROOT_CAUSE_LIFECYCLE).optional(),
  constraint_lifecycle: z.enum(CONSTRAINT_LIFECYCLE).optional(),
  constraint_shifted_to: z.string().optional(),

  maturity_trajectory: z.enum(MATURITY_TRAJECTORIES).default("unknown"),
  maturity_structural_loss: z.boolean().default(false),
  maturity_note: z.string().optional(),

  baseline_status: z.enum(BASELINE_STATUSES).default("active"),
  regime_status: z.enum(REGIME_STATUSES).default("stable"),
  has_unresolved_incident: z.boolean().default(false),
  regime_sufficient_duration: z.boolean().default(false),
  regime_stable_behavior: z.boolean().default(false),
  regime_change_understood: z.boolean().default(false),
  regime_data_quality_high: z.boolean().default(false),
  regime_validation_note: z.string().optional(),

  comparison_type: z.enum(TEMPORAL_COMPARISON_TYPES).optional(),
  temporal_completeness: z.enum(TEMPORAL_COMPLETENESS).default("unknown"),
  history_coverage: z.enum(["short", "moderate", "deep"]).default("short"),
  history_quality: z.enum(["high", "medium", "low"]).default("low"),
  temporal_gaps: z.string().optional(),

  /** Apartado 21: cinco confianzas, no una. */
  onset_confidence: z.enum(CONFIANZA).default("unknown"),
  trajectory_confidence: z.enum(CONFIANZA).default("unknown"),
  regression_confidence: z.enum(CONFIANZA).default("unknown"),
  recovery_confidence: z.enum(CONFIANZA).default("unknown"),
  lag_confidence: z.enum(CONFIANZA).default("unknown"),

  limitations: z.string().optional(),
});

export const temporalDiagnosisSchema = temporalDiagnosisFields
  // Apartado 4: no se inventa una hora exacta con datos diarios.
  .refine((t) => finura(t.onset_precision) >= finura(t.source_granularity), {
    message: "La precision del onset no puede ser mas fina que la de la fuente (apartado 4).",
  })
  .refine(
    (t) =>
      t.onset_estimated_at == null ||
      t.onset_precision !== "unknown" ||
      (t.onset_range_start != null && t.onset_range_end != null),
    { message: "Un onset estimado sin precision ni rango es un numero sin sentido (apartado 4)." },
  )
  // Invariante 34: el primer dato observado no es el onset.
  .refine(
    (t) =>
      t.pre_existing_status !== "new" ||
      t.history_coverage !== "short" ||
      ["low", "unknown"].includes(t.onset_confidence),
    { message: "Con poca historia, declarar algo nuevo solo cabe con confianza baja (invariante 34)." },
  )
  // Apartado 6.
  .refine(
    (t) =>
      t.temporal_sufficiency !== "insufficient" ||
      t.trajectory === "unknown" ||
      ["low", "unknown"].includes(t.trajectory_confidence),
    { message: "Sin historia suficiente no se inventa una trayectoria (apartado 6)." },
  )
  // Apartado 16.
  .refine(
    (t) =>
      t.noise_classification !== "structural_trend" ||
      (["high", "medium"].includes(t.trend_confidence) && t.temporal_sufficiency === "sufficient"),
    { message: "Una variacion aislada no se convierte en tendencia estructural (apartado 16)." },
  )
  // Apartado 8: una regresion exige un estado mejor anterior y estable.
  .refine(
    (t) =>
      t.regression_status !== "regressed" ||
      (t.previous_state != null &&
        t.previous_stable_period_start != null &&
        t.previous_stable_period_end != null &&
        t.regression_type != null),
    { message: "Una regresion exige un estado mejor anterior y legitimamente estable (apartado 8)." },
  )
  // Apartados 8 y 18.
  .refine(
    (t) =>
      t.maturity_trajectory !== "regressing" ||
      (t.maturity_structural_loss && t.maturity_note != null),
    { message: "Una caida de KPI no es una regresion de madurez (apartado 18)." },
  )
  // Apartado 9.
  .refine(
    (t) => t.business_impact_recovery !== "recovered" || t.recovery_persistence_met,
    { message: "Un rebote breve no es una recuperacion (apartado 9)." },
  )
  // Apartado 7.
  .refine(
    (t) =>
      !["new_regime_candidate", "new_regime_supported"].includes(t.regime_status) ||
      (t.regime_sufficient_duration &&
        t.regime_stable_behavior &&
        t.regime_change_understood &&
        t.regime_data_quality_high &&
        !t.has_unresolved_incident),
    { message: "Promover un regimen exige las cinco condiciones a la vez (apartado 7)." },
  )
  // Invariante 34: el baseline no se adapta a un sistema roto.
  .refine(
    (t) =>
      t.baseline_status !== "superseded" ||
      (!t.has_unresolved_incident &&
        t.regime_status === "new_regime_supported" &&
        t.regime_validation_note != null),
    { message: "Un problema persistente no se aprende como nueva normalidad (invariante 34)." },
  )
  .refine(
    (t) => !t.has_unresolved_incident || ["frozen", "under_review"].includes(t.baseline_status),
    { message: "Con un incidente abierto el baseline no sigue activo (apartado 7)." },
  )
  // Apartado 17.
  .refine(
    (t) => t.constraint_lifecycle !== "shifted" || t.constraint_shifted_to != null,
    { message: "Un constraint que se desplaza dice a donde (apartado 17)." },
  );

export type TemporalDiagnosis = z.infer<typeof temporalDiagnosisSchema>;

export const temporalLagCheckSchema = z
  .object({
    lag_check_id: z.string().min(1),
    diagnosis_id: z.string().min(1),
    cause_label: z.string().min(1),
    effect_label: z.string().min(1),
    cause_time: z.string().optional(),
    effect_time: z.string().optional(),
    observed_lag_hours: z.number().optional(),
    expected_lag_min_hours: z.number().optional(),
    expected_lag_max_hours: z.number().optional(),
    lag_fit: z.enum(LAG_FITS).default("unknown"),
    time_basis: z.enum(["event_time", "ingestion_time"]).default("event_time"),
    ingestion_differs: z.boolean().default(false),
    note: z.string().optional(),
  })
  // Apartado 10: la causa precede al efecto, o el encaje es incompatible.
  .refine(
    (l) =>
      l.cause_time == null ||
      l.effect_time == null ||
      l.cause_time <= l.effect_time ||
      l.lag_fit === "incompatible",
    { message: "La causa precede al efecto, o el encaje temporal es incompatible (apartado 10)." },
  )
  // Invariante 34.
  .refine((l) => !l.ingestion_differs || l.time_basis === "event_time", {
    message: "Cuando el tiempo de ingesta difiere del evento, manda el del evento (invariante 34).",
  })
  .refine((l) => l.lag_fit !== "incompatible" || l.note != null, {
    message: "Un encaje incompatible sin explicar no invalida nada.",
  });

export type TemporalLagCheck = z.infer<typeof temporalLagCheckSchema>;

export const diagnosticEpisodeSchema = z
  .object({
    episode_code: z.string().min(1),
    diagnosis_type: z.string().min(1),
    started_at: z.string().min(1),
    peaked_at: z.string().optional(),
    ended_at: z.string().optional(),
    /** Apartado 12: afirmarlo cuesta evidencia, no se deduce del parecido. */
    same_root_cause_as_previous: z.boolean().optional(),
    same_root_cause_evidence: z.string().optional(),
    severity: z.string().optional(),
    recovery_time_hours: z.number().min(0).optional(),
    outcome: z
      .enum(["resolved", "recovered", "abandoned", "ongoing", "relapsed", "unknown"])
      .default("unknown"),
  })
  .refine(
    (e) => e.same_root_cause_as_previous !== true || e.same_root_cause_evidence != null,
    { message: "El mismo sintoma recurrente no implica la misma causa raiz (apartado 12)." },
  )
  .refine((e) => e.outcome !== "ongoing" || e.ended_at == null, {
    message: "Un episodio en curso no ha terminado.",
  });

export type DiagnosticEpisode = z.infer<typeof diagnosticEpisodeSchema>;

export const capabilityTimeProfileSchema = z
  .object({
    capability: z.string().min(1),
    evaluation_window_hours: z.number().positive(),
    minimum_observation_window_hours: z.number().positive(),
    expected_lag_hours: z.number().min(0).optional(),
    settlement_delay_hours: z.number().min(0).optional(),
    baseline_horizon_days: z.number().positive().optional(),
    recurrence_horizon_days: z.number().positive().optional(),
    rationale: z.string().optional(),
  })
  .refine((p) => p.evaluation_window_hours >= p.minimum_observation_window_hours, {
    message: "No se juzga una tendencia en menos tiempo del que hace falta para observarla.",
  });

export type CapabilityTimeProfile = z.infer<typeof capabilityTimeProfileSchema>;

export const temporalRevisionSchema = z
  .object({
    diagnosis_id: z.string().min(1),
    as_of: z.string().min(1),
    previous_trajectory: z.enum(TRAJECTORY_STATES).optional(),
    new_trajectory: z.enum(TRAJECTORY_STATES),
    previous_onset_at: z.string().optional(),
    new_onset_at: z.string().optional(),
    revision_reason: z.enum([
      "late_data", "baseline_correction", "event_discovery",
      "metric_definition_correction", "context_adjustment", "other",
    ]),
    explanation: z.string().min(20),
  })
  .refine(
    (r) =>
      r.previous_trajectory !== r.new_trajectory || r.previous_onset_at !== r.new_onset_at,
    { message: "Una revision que no revisa nada no es una revision." },
  );

export type TemporalRevision = z.infer<typeof temporalRevisionSchema>;

// ---------------------------------------------------------------------------
// Las reglas que miran el conjunto: los fixtures del apartado 33
// ---------------------------------------------------------------------------

export type TemporalCheckInput = {
  diagnosis: TemporalDiagnosis;
  lagChecks?: TemporalLagCheck[];
  episodes?: DiagnosticEpisode[];
  profile?: CapabilityTimeProfile;
  revisions?: TemporalRevision[];
};

export function checkTemporalInvariants(
  input: TemporalCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const t = input.diagnosis;
  const lags = input.lagChecks ?? [];
  const episodios = input.episodes ?? [];

  // Apartado 19: los conflictos entre horizontes se preservan, no se funden.
  // Si corto y largo apuntan a lados opuestos, el agregado es `mixed`.
  const opuestos =
    (A_PEOR.includes(t.short_term_trajectory) && A_MEJOR.includes(t.long_term_trajectory)) ||
    (A_MEJOR.includes(t.short_term_trajectory) && A_PEOR.includes(t.long_term_trajectory));
  if (opuestos && t.trajectory !== "mixed") {
    violations.push({
      rule: "conflicto_de_horizontes_oculto",
      source: "D13 apartado 19",
      message: `Corto (${t.short_term_trajectory}) y largo (${t.long_term_trajectory}) van en direcciones opuestas y el agregado dice "${t.trajectory}".`,
    });
  }

  // Apartado 23: si D12 ajusto la serie, es la ajustada la que dirige.
  if (
    t.context_adjusted_trajectory != null &&
    t.context_adjusted_trajectory !== t.trajectory &&
    t.raw_trajectory === t.trajectory
  ) {
    violations.push({
      rule: "trayectoria_sin_ajustar_dirige",
      source: "D13 apartado 23",
      message: "El diagnostico sigue la trayectoria cruda habiendo una ajustada por contexto distinta.",
    });
  }

  // Apartado 10: un lag incompatible debilita o invalida la relacion causal. Si
  // hay uno y la lectura temporal sigue como si nada, es que no se uso.
  const incompatibles = lags.filter((l) => l.lag_fit === "incompatible");
  if (incompatibles.length > 0 && ["high", "medium"].includes(t.lag_confidence)) {
    violations.push({
      rule: "lag_incompatible_sin_efecto",
      source: "D13 apartado 10",
      message: `"${incompatibles[0]?.cause_label}" no encaja temporalmente y la confianza en los lags sigue en ${t.lag_confidence}.`,
    });
  }

  // Apartado 12: la recurrencia del sintoma no es la recurrencia de la causa.
  if (
    ["recurring", "systematic"].includes(t.recurrence_status) &&
    episodios.length > 1 &&
    !episodios.some((e) => e.same_root_cause_as_previous === true)
  ) {
    if (t.root_cause_lifecycle === "recurrent") {
      violations.push({
        rule: "recurrencia_de_sintoma_no_es_de_causa",
        source: "D13 apartado 12",
        message: "Se declara causa raiz recurrente sin que ningun episodio afirme compartir causa.",
      });
    }
  }

  // Apartados 9 y 28: RESOLUTION != RECOVERY, por el lado que se olvida. Dar el
  // caso por cerrado con el impacto sin recuperar es cerrarlo pronto.
  if (
    t.root_cause_lifecycle === "resolved" &&
    ["not_recovering", "early_recovery", "partial_recovery"].includes(t.business_impact_recovery) &&
    t.limitations == null
  ) {
    violations.push({
      rule: "resolucion_no_es_recuperacion",
      source: "D13 apartado 28",
      message: "La causa esta resuelta y el impacto no, y no hay ninguna limitacion escrita.",
    });
  }

  // Apartado 28, el Reverse Recovery Test: si la causa se quito y nada mejoro,
  // el diagnostico se reabre en vez de darse por bueno.
  if (
    t.root_cause_lifecycle === "resolved" &&
    t.system_recovery === "not_recovering" &&
    t.recovery_confidence !== "unknown"
  ) {
    violations.push({
      rule: "causa_quitada_sin_recuperacion",
      source: "D13 apartado 28",
      message: "Se retiro la causa y el sistema no mejora: el diagnostico deberia reabrirse, no cerrarse.",
    });
  }

  // Apartado 5: la ventana con la que se juzga tiene que ser la de la capacidad.
  if (
    input.profile != null &&
    t.duration_hours != null &&
    t.duration_hours < input.profile.minimum_observation_window_hours &&
    !["unknown", "volatile"].includes(t.trajectory)
  ) {
    violations.push({
      rule: "ventana_por_debajo_del_minimo",
      source: "D13 apartado 5",
      message: `Se afirma "${t.trajectory}" con ${t.duration_hours} h cuando la capacidad pide al menos ${input.profile.minimum_observation_window_hours} h.`,
    });
  }

  // Apartado 29: los huecos historicos materiales se declaran.
  if (
    ["partial_history", "recent_only"].includes(t.temporal_completeness) &&
    t.temporal_gaps == null
  ) {
    violations.push({
      rule: "huecos_sin_declarar",
      source: "D13 apartado 29",
      message: "La historia esta incompleta y no se dice donde estan los huecos.",
    });
  }

  // Apartado 21: mas historia no es mejor evidencia si es de otro regimen.
  if (
    t.history_coverage === "deep" &&
    t.history_quality === "low" &&
    ["high", "medium"].includes(t.trajectory_confidence)
  ) {
    violations.push({
      rule: "historia_larga_no_es_historia_buena",
      source: "D13 apartado 21",
      message: "Hay mucha historia y es mala, y aun asi sostiene la confianza en la trayectoria.",
    });
  }

  // Apartado 17: un constraint que se desplaza no es un problema nuevo.
  if (t.constraint_lifecycle === "shifted" && t.recurrence_status === "first_occurrence") {
    violations.push({
      rule: "desplazamiento_leido_como_problema_nuevo",
      source: "D13 apartado 17",
      message: "El constraint se desplazo y se esta tratando como una primera ocurrencia independiente.",
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Motor puro D13. La serie y los perfiles entran como datos; no hay acceso a
// Supabase ni al LLM en esta capa. Los umbrales son parte de la entrada para
// que cada capacidad pueda gobernarse sin esconder una escala universal.
// ---------------------------------------------------------------------------

export type TemporalObservation = {
  at: string;
  value: number;
  baseline?: number | null;
  adjustedValue?: number | null;
  source?: string;
};

export type TemporalRuntimeEventInput = {
  eventId?: string;
  eventType?: string;
  occurredAt: string;
  description?: string;
  source?: string;
};

export type TemporalLagInput = {
  edgeId?: string;
  causeLabel: string;
  effectLabel: string;
  causeTime?: string;
  effectTime?: string;
  expectedLagMinHours?: number;
  expectedLagMaxHours?: number;
  ingestionDiffers?: boolean;
};

export type TemporalRuntimeInput = {
  diagnosisId: string;
  caseId: string;
  target: string;
  currentState?: TemporalDiagnosis["current_state"];
  direction?: "higher_is_better" | "lower_is_better";
  observations: TemporalObservation[];
  profile: CapabilityTimeProfile;
  previous?: TemporalDiagnosis | null;
  previousStablePeriod?: { start: string; end: string };
  regressionType?: (typeof REGRESSION_TYPES)[number];
  events?: TemporalRuntimeEventInput[];
  lagInputs?: TemporalLagInput[];
  historicalEpisodes?: DiagnosticEpisode[];
  recovery?: {
    cause?: (typeof RECOVERY_STATUSES)[number];
    system?: (typeof RECOVERY_STATUSES)[number];
    businessImpact?: (typeof RECOVERY_STATUSES)[number];
    persistenceMet?: boolean;
  };
  unresolvedIncident?: boolean;
  regime?: {
    sufficientDuration: boolean;
    stableBehavior: boolean;
    changeUnderstood: boolean;
    dataQualityHigh: boolean;
    validationNote?: string;
  };
  maturity?: {
    trajectory?: (typeof MATURITY_TRAJECTORIES)[number];
    structuralLoss?: boolean;
    note?: string;
  };
  thresholds?: {
    materialRelativeChange?: number;
    abruptMultiplier?: number;
    chronicDurationDays?: number;
  };
};

export type TemporalRuntimeEvent = {
  event_type: (typeof TEMPORAL_EVENT_TYPES)[number];
  from_state?: string | undefined;
  to_state?: string | undefined;
  occurred_at: string;
  note: string;
};

export type TemporalRuntimeResult = {
  diagnosis: TemporalDiagnosis;
  lagChecks: TemporalLagCheck[];
  episodes: DiagnosticEpisode[];
  events: TemporalRuntimeEvent[];
  revision?: TemporalRevision | undefined;
};

function finitePoints(input: TemporalRuntimeInput): TemporalObservation[] {
  return input.observations
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.at)))
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function classifyDirection(delta: number, direction: TemporalRuntimeInput["direction"]): (typeof TRAJECTORY_STATES)[number] {
  const signed = direction === "lower_is_better" ? -delta : delta;
  if (Math.abs(signed) < Number.EPSILON) return "stable";
  return signed > 0 ? "improving" : "deteriorating";
}

function lagResult(input: TemporalLagInput, diagnosisId: string): TemporalLagCheck {
  const cause = input.causeTime ? Date.parse(input.causeTime) : NaN;
  const effect = input.effectTime ? Date.parse(input.effectTime) : NaN;
  const observed = Number.isFinite(cause) && Number.isFinite(effect) ? (effect - cause) / 3_600_000 : null;
  let fit: (typeof LAG_FITS)[number] = "unknown";
  if (observed != null && observed < 0) fit = "incompatible";
  else if (observed != null && input.expectedLagMinHours != null && input.expectedLagMaxHours != null) {
    fit = observed >= input.expectedLagMinHours && observed <= input.expectedLagMaxHours
      ? "strong" : "incompatible";
  } else if (observed != null) fit = "acceptable";
  return temporalLagCheckSchema.parse({
    lag_check_id: `${diagnosisId}:${input.causeLabel}:${input.effectLabel}`,
    diagnosis_id: diagnosisId,
    cause_label: input.causeLabel,
    effect_label: input.effectLabel,
    cause_time: input.causeTime,
    effect_time: input.effectTime,
    observed_lag_hours: observed ?? undefined,
    expected_lag_min_hours: input.expectedLagMinHours,
    expected_lag_max_hours: input.expectedLagMaxHours,
    lag_fit: fit,
    time_basis: "event_time",
    ingestion_differs: input.ingestionDiffers ?? false,
    note: fit === "incompatible" ? "La secuencia o el rango temporal no es compatible con la relación propuesta." : undefined,
  });
}

export function evaluateTemporalDiagnosis(input: TemporalRuntimeInput): TemporalRuntimeResult {
  const points = finitePoints(input);
  const profile = capabilityTimeProfileSchema.parse(input.profile);
  const threshold = input.thresholds?.materialRelativeChange ?? 0.1;
  const abruptMultiplier = input.thresholds?.abruptMultiplier ?? 2;
  const values = points.map((point) => point.adjustedValue ?? point.value);
  const first = points[0];
  const last = points.at(-1);
  const spanHours = first && last ? Math.max(0, (Date.parse(last.at) - Date.parse(first.at)) / 3_600_000) : 0;
  const enoughHistory = points.length >= 3 && spanHours >= profile.minimum_observation_window_hours;
  const baseline = first?.baseline ?? (values.length ? values[0] : null);
  const relativeChange = baseline && baseline !== 0 && last ? (values.at(-1)! - baseline) / Math.abs(baseline) : 0;
  const direction = input.direction ?? "higher_is_better";
  const signedChange = direction === "lower_is_better" ? -relativeChange : relativeChange;
  const deltas = values.slice(1).map((value, index) => value - values[index]!);
  const recentDelta = deltas.at(-1) ?? 0;
  const priorDelta = deltas.length > 1 ? deltas.at(-2)! : recentDelta;
  const recentBase = values[Math.max(0, values.length - 3)] ?? values[0];
  const recentChange = values.length ? values.at(-1)! - recentBase! : 0;
  const recentRelative = baseline && baseline !== 0 ? recentChange / Math.abs(baseline) : 0;
  const rawTrajectory = enoughHistory && Math.abs(signedChange) >= threshold
    ? classifyDirection(values.at(-1)! - values[0]!, direction)
    : enoughHistory && Math.abs(recentRelative) >= threshold * 0.5
      ? classifyDirection(recentChange, direction)
      : enoughHistory ? "stable" : "unknown";
  const trajectory = input.previous?.context_adjusted_trajectory ?? rawTrajectory;
  const shortTerm = enoughHistory ? classifyDirection(values.at(-1)! - values[Math.max(0, values.length - 3)]!, direction) : "unknown";
  const longTerm = enoughHistory ? classifyDirection(values.at(-1)! - values[0]!, direction) : "unknown";
  const adjusted = points.some((point) => point.adjustedValue != null);
  const absoluteDeltas = deltas.map(Math.abs);
  const largestDelta = Math.max(...absoluteDeltas, 0);
  const priorDeltas = absoluteDeltas.slice(0, Math.max(1, absoluteDeltas.length - 1)).sort((a, b) => a - b);
  const typicalDelta = priorDeltas[Math.floor(priorDeltas.length / 2)] ?? 0;
  const changeRatio = typicalDelta > 0 ? largestDelta / typicalDelta : 0;
  const changePointIndex = absoluteDeltas.indexOf(largestDelta);
  const changePointAt = enoughHistory && changeRatio >= abruptMultiplier ? points[changePointIndex + 1]?.at : undefined;
  const changeType = !enoughHistory ? undefined
    : changeRatio >= abruptMultiplier
      ? "abrupt"
      : Math.abs(signedChange) >= threshold && Math.abs(recentDelta) > Math.abs(priorDelta) ? "accelerating"
        : Math.abs(signedChange) >= threshold ? "gradual" : undefined;
  const velocityMagnitude = Math.abs(signedChange);
  const velocity = !enoughHistory ? "unknown"
    : velocityMagnitude < 0.05 ? "very_slow"
      : velocityMagnitude < 0.15 ? "slow"
        : velocityMagnitude < 0.3 ? "moderate"
          : velocityMagnitude < 0.6 ? "fast" : "extreme";
  const acceleration = !enoughHistory ? "unknown" : Math.abs(recentDelta) > Math.abs(priorDelta) * 1.2
    ? "accelerating" : Math.abs(recentDelta) < Math.abs(priorDelta) * 0.8 ? "decelerating" : "stable";
  const persistence = !enoughHistory ? "transient" : spanHours >= (input.thresholds?.chronicDurationDays ?? 90) * 24
    ? "chronic" : Math.abs(signedChange) >= threshold ? "persistent" : "transient";
  const noiseClassification = !enoughHistory ? "noise" : changeType == null && Math.abs(signedChange) < threshold
    ? "noise" : changeType === "gradual" || changeType === "accelerating" ? "structural_trend" : "material_episode";
  const confidence = !enoughHistory ? "unknown" : points.length >= 6 ? "high" : "medium";
  const currentState = input.currentState ?? "unknown";
  const unresolvedIncident = input.unresolvedIncident ?? ["bad", "critical", "disaster"].includes(currentState);
  const previousHealthy = input.previous != null && ["elite", "healthy"].includes(input.previous.current_state);
  const regressionStatus = previousHealthy && ["bad", "critical", "disaster"].includes(currentState) && input.previousStablePeriod
    ? "regressed" : !previousHealthy && ["bad", "critical", "disaster"].includes(currentState) ? "chronic_weakness" : "none";
  const recovery = input.recovery ?? {};
  const regime = input.regime ?? { sufficientDuration: false, stableBehavior: false, changeUnderstood: false, dataQualityHigh: false };
  const regimeSupported = regime.sufficientDuration && regime.stableBehavior && regime.changeUnderstood && regime.dataQualityHigh && !unresolvedIncident;
  const temporalSufficiency = enoughHistory ? "sufficient" : points.length >= 2 ? "partial" : "insufficient";
  const limitations = [
    !enoughHistory ? "La historia disponible no alcanza la ventana mínima de la capacidad." : null,
    adjusted ? "La trayectoria ajustada por contexto dirige la lectura; se conserva la cruda." : null,
    points.length < 6 ? "La confianza temporal queda limitada por la cantidad de observaciones." : null,
  ].filter(Boolean).join(" ") || undefined;
  const diagnosis = temporalDiagnosisSchema.parse({
    diagnosis_id: input.diagnosisId, case_id: input.caseId, target: input.target,
    current_state: currentState, trajectory, raw_trajectory: rawTrajectory,
    context_adjusted_trajectory: adjusted ? trajectory : undefined,
    short_term_trajectory: shortTerm, medium_term_trajectory: trajectory, long_term_trajectory: longTerm,
    onset_estimated_at: enoughHistory && Math.abs(signedChange) >= threshold ? first?.at : undefined,
    onset_range_start: enoughHistory && Math.abs(signedChange) >= threshold ? first?.at : undefined,
    onset_range_end: enoughHistory && Math.abs(signedChange) >= threshold ? last?.at : undefined,
    onset_precision: "day", source_granularity: "day", pre_existing_status: points.length > 0 ? "unknown" : "unknown",
    change_type: changeType, change_point_at: changePointAt, velocity, temporal_sufficiency: temporalSufficiency,
    persistence, duration_hours: spanHours, noise_classification: noiseClassification,
    trend_confidence: enoughHistory ? confidence : "insufficient", trend_robustness: points.length >= 6 ? "high" : "low",
    recurrence_status: input.historicalEpisodes?.length ? input.historicalEpisodes.length >= 2 ? "recurring" : "second_occurrence" : "first_occurrence",
    regression_status: regressionStatus, regression_type: regressionStatus === "regressed" ? input.regressionType ?? "performance_regression" : undefined,
    previous_state: regressionStatus === "regressed" ? input.previous?.current_state : undefined,
    previous_stable_period_start: regressionStatus === "regressed" ? input.previousStablePeriod?.start : undefined,
    previous_stable_period_end: regressionStatus === "regressed" ? input.previousStablePeriod?.end : undefined,
    cause_recovery: recovery.cause ?? "not_recovering", system_recovery: recovery.system ?? "not_recovering",
    business_impact_recovery: recovery.businessImpact ?? "not_recovering", recovery_persistence_met: recovery.persistenceMet ?? false,
    root_cause_lifecycle: recovery.cause === "recovered" ? "resolved" : "active",
    maturity_trajectory: input.maturity?.trajectory ?? "unknown", maturity_structural_loss: input.maturity?.structuralLoss ?? false,
    maturity_note: input.maturity?.note, baseline_status: unresolvedIncident ? "frozen" : "active",
    regime_status: regimeSupported ? "new_regime_supported" : regime.sufficientDuration ? "new_regime_candidate" : "stable",
    has_unresolved_incident: unresolvedIncident, regime_sufficient_duration: regime.sufficientDuration,
    regime_stable_behavior: regime.stableBehavior, regime_change_understood: regime.changeUnderstood,
    regime_data_quality_high: regime.dataQualityHigh, regime_validation_note: regime.validationNote,
    comparison_type: "rolling", temporal_completeness: points.length >= 6 ? "full_history" : points.length >= 3 ? "partial_history" : "recent_only",
    history_coverage: points.length >= 12 ? "deep" : points.length >= 6 ? "moderate" : "short",
    history_quality: points.every((point) => point.source != null) ? "high" : "medium", temporal_gaps: points.length >= 3 ? undefined : "Faltan observaciones para comprobar continuidad.",
    onset_confidence: enoughHistory ? confidence : "unknown", trajectory_confidence: enoughHistory ? confidence : "unknown",
    regression_confidence: regressionStatus === "regressed" ? confidence : "unknown", recovery_confidence: recovery.persistenceMet ? confidence : "low",
    lag_confidence: input.lagInputs?.length ? "medium" : "unknown", limitations,
  });
  const lagChecks = (input.lagInputs ?? []).map((item) => lagResult(item, input.diagnosisId));
  const events: TemporalRuntimeEvent[] = [];
  if (trajectory === "deteriorating" || trajectory === "rapidly_deteriorating") {
    events.push({ event_type: "new_deterioration", from_state: input.previous?.trajectory, to_state: trajectory, occurred_at: last?.at ?? new Date().toISOString(), note: "La serie supera el cambio material de la capacidad." });
  }
  if (input.previous && input.previous.trajectory !== trajectory) {
    const eventType = trajectory === "recovering" ? "recovery_started" : trajectory === "regressed" ? "regression" : trajectory === "new_regime" ? "regime_shift" : "new_deterioration";
    events.push({ event_type: eventType, from_state: input.previous.trajectory, to_state: trajectory, occurred_at: last?.at ?? new Date().toISOString(), note: "Transición temporal material respecto a la evaluación anterior." });
  }
  const revision = input.previous && (input.previous.trajectory !== trajectory || input.previous.onset_estimated_at !== diagnosis.onset_estimated_at)
    ? temporalRevisionSchema.parse({ diagnosis_id: input.diagnosisId, as_of: last?.at ?? new Date().toISOString(), previous_trajectory: input.previous.trajectory, new_trajectory: trajectory, previous_onset_at: input.previous.onset_estimated_at, new_onset_at: diagnosis.onset_estimated_at, revision_reason: adjusted ? "context_adjustment" : "late_data", explanation: "La nueva evaluación cambia la lectura temporal al incorporar la serie disponible y sus controles." })
    : undefined;
  return { diagnosis, lagChecks, episodes: input.historicalEpisodes ?? [], events, revision };
}
