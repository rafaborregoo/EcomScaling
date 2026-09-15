/**
 * FASE 3 / D13: diagnostico temporal y regresion.
 *
 * El bloque que convierte la foto en la pelicula. El invariante central --
 * estado != trayectoria -- se comprueba aqui por ausencia: los dos tests que mas
 * importan verifican que BAD + IMPROVING y HEALTHY + DETERIORATING **caben**,
 * para que nadie anada mas adelante la regla que las prohibiria.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkTemporalInvariants,
  temporalDiagnosisFields,
  temporalDiagnosisSchema,
  temporalLagCheckSchema,
  diagnosticEpisodeSchema,
  capabilityTimeProfileSchema,
  temporalRevisionSchema,
  TRAJECTORY_STATES,
  REGRESSION_STATUSES,
  type TemporalDiagnosis,
  type TemporalCheckInput,
} from "./temporal.js";

function temporal(over: Partial<TemporalDiagnosis> = {}): TemporalDiagnosis {
  return temporalDiagnosisSchema.parse({
    diagnosis_id: "TD-1",
    case_id: "C-1",
    target: "cvr",
    temporal_sufficiency: "sufficient",
    ...over,
  });
}

const reglas = (input: TemporalCheckInput) =>
  checkTemporalInvariants(input).map((x) => x.rule);

// --- El invariante central --------------------------------------------------

test("§1: BAD + IMPROVING tiene que caber, y este test existe para que siga cabiendo", () => {
  const t = temporal({
    current_state: "bad",
    trajectory: "improving",
    trajectory_confidence: "high",
  });
  assert.equal(t.current_state, "bad");
  assert.equal(t.trajectory, "improving");
  assert.deepEqual(reglas({ diagnosis: t }), []);
});

test("§1: HEALTHY + DETERIORATING tambien, y es la combinacion que mas avisa", () => {
  const t = temporal({
    current_state: "healthy",
    trajectory: "deteriorating",
    trajectory_confidence: "high",
  });
  assert.deepEqual(reglas({ diagnosis: t }), []);
});

// --- El contrato de la fila ------------------------------------------------

test("§4: no se inventa una hora exacta cuando la fuente es diaria", () => {
  assert.throws(() => temporal({ onset_precision: "minute", source_granularity: "day" }));
  assert.ok(temporal({ onset_precision: "day", source_granularity: "day" }));
  assert.ok(temporal({ onset_precision: "week", source_granularity: "day" }));
});

test("§4: un onset estimado sin precision ni rango no dice nada", () => {
  assert.throws(() => temporal({ onset_estimated_at: "2026-09-01T00:00:00Z" }));
  assert.ok(
    temporal({
      onset_estimated_at: "2026-09-01T00:00:00Z",
      onset_range_start: "2026-08-31T00:00:00Z",
      onset_range_end: "2026-09-02T00:00:00Z",
    }),
  );
});

test("§34: el primer dato observado no es el onset real", () => {
  assert.throws(() =>
    temporal({ pre_existing_status: "new", history_coverage: "short", onset_confidence: "high" }),
  );
  assert.ok(
    temporal({ pre_existing_status: "new", history_coverage: "deep", onset_confidence: "high" }),
  );
});

test("§6: sin historia suficiente no se inventa una trayectoria", () => {
  assert.throws(() =>
    temporal({
      temporal_sufficiency: "insufficient",
      trajectory: "deteriorating",
      trajectory_confidence: "high",
    }),
  );
  assert.ok(temporal({ temporal_sufficiency: "insufficient", trajectory: "unknown" }));
});

test("§16: una variacion aislada no se convierte en tendencia estructural", () => {
  assert.throws(() =>
    temporal({
      noise_classification: "structural_trend",
      trend_confidence: "low",
      temporal_sufficiency: "partial",
    }),
  );
});

test("§8: una regresion exige un estado mejor anterior y estable", () => {
  assert.throws(() => temporal({ regression_status: "regressed" }));
  assert.ok(
    temporal({
      regression_status: "regressed",
      regression_type: "technical_regression",
      previous_state: "healthy",
      previous_stable_period_start: "2026-03-01T00:00:00Z",
      previous_stable_period_end: "2026-08-01T00:00:00Z",
    }),
  );
});

test("§8: una debilidad de siempre es cronica, no una regresion", () => {
  // El vocabulario ofrece la palabra correcta para que nadie use la incorrecta.
  assert.ok((REGRESSION_STATUSES as readonly string[]).includes("chronic_weakness"));
  assert.ok(temporal({ regression_status: "chronic_weakness", persistence: "chronic" }));
});

test("§18: una caida de KPI no es una regresion de madurez", () => {
  assert.throws(() => temporal({ maturity_trajectory: "regressing" }));
  assert.throws(() => temporal({ maturity_trajectory: "regressing", maturity_structural_loss: true }));
  assert.ok(
    temporal({
      maturity_trajectory: "regressing",
      maturity_structural_loss: true,
      maturity_note: "Se perdio la capacidad de producir creatividades in-house",
    }),
  );
});

test("§9: un rebote breve no es una recuperacion", () => {
  assert.throws(() => temporal({ business_impact_recovery: "recovered" }));
  assert.ok(temporal({ business_impact_recovery: "recovered", recovery_persistence_met: true }));
});

test("§7: promover un regimen exige las cinco condiciones a la vez", () => {
  assert.throws(() =>
    temporal({
      regime_status: "new_regime_candidate",
      regime_sufficient_duration: true,
      regime_stable_behavior: true,
      regime_change_understood: true,
    }),
  );
  assert.ok(
    temporal({
      regime_status: "new_regime_candidate",
      regime_sufficient_duration: true,
      regime_stable_behavior: true,
      regime_change_understood: true,
      regime_data_quality_high: true,
    }),
  );
});

test("§34: un problema persistente no se aprende como nueva normalidad", () => {
  assert.throws(() => temporal({ baseline_status: "superseded", has_unresolved_incident: true }));
  // Y con un incidente abierto el baseline no sigue activo.
  assert.throws(() => temporal({ has_unresolved_incident: true, baseline_status: "active" }));
  assert.ok(temporal({ has_unresolved_incident: true, baseline_status: "frozen" }));
});

test("§17: un constraint que se desplaza dice a donde", () => {
  assert.throws(() => temporal({ constraint_lifecycle: "shifted" }));
  assert.ok(
    temporal({
      constraint_lifecycle: "shifted",
      constraint_shifted_to: "El cuello pasa de stock a capacidad de almacen",
      recurrence_status: "second_occurrence",
    }),
  );
});

test("§10: la causa precede al efecto, o el encaje es incompatible", () => {
  assert.throws(() =>
    temporalLagCheckSchema.parse({
      lag_check_id: "L-1", diagnosis_id: "TD-1",
      cause_label: "Recorte de inversion", effect_label: "Caida de revenue",
      cause_time: "2026-09-20T00:00:00Z", effect_time: "2026-09-05T00:00:00Z",
      lag_fit: "acceptable",
    }),
  );
  assert.ok(
    temporalLagCheckSchema.parse({
      lag_check_id: "L-1", diagnosis_id: "TD-1",
      cause_label: "Recorte de inversion", effect_label: "Caida de revenue",
      cause_time: "2026-09-20T00:00:00Z", effect_time: "2026-09-05T00:00:00Z",
      lag_fit: "incompatible",
      note: "El revenue cayo quince dias antes del recorte: el recorte no lo explica",
    }),
  );
});

test("§34: el tiempo de ingesta no manda sobre el del evento", () => {
  assert.throws(() =>
    temporalLagCheckSchema.parse({
      lag_check_id: "L-2", diagnosis_id: "TD-1", cause_label: "Deploy", effect_label: "Caida de CVR",
      ingestion_differs: true, time_basis: "ingestion_time",
    }),
  );
});

test("§12: el mismo sintoma recurrente no implica la misma causa raiz", () => {
  assert.throws(() =>
    diagnosticEpisodeSchema.parse({
      episode_code: "EP-1", diagnosis_type: "cac_deterioration",
      started_at: "2026-03-01T00:00:00Z", same_root_cause_as_previous: true,
    }),
  );
  assert.ok(
    diagnosticEpisodeSchema.parse({
      episode_code: "EP-1", diagnosis_type: "cac_deterioration",
      started_at: "2026-03-01T00:00:00Z", same_root_cause_as_previous: true,
      same_root_cause_evidence: "Los dos episodios arrancan con el mismo cambio de puja",
    }),
  );
});

test("§5: no se juzga una tendencia en menos tiempo del que hace falta para verla", () => {
  assert.throws(() =>
    capabilityTimeProfileSchema.parse({
      capability: "retention", evaluation_window_hours: 24,
      minimum_observation_window_hours: 720,
    }),
  );
});

test("§22: una revision que no revisa nada no es una revision", () => {
  assert.throws(() =>
    temporalRevisionSchema.parse({
      diagnosis_id: "TD-1", as_of: "2026-09-20T00:00:00Z",
      previous_trajectory: "stable", new_trajectory: "stable",
      revision_reason: "late_data",
      explanation: "Llegaron datos tardios que no cambian la lectura",
    }),
  );
});

// --- Los fixtures del apartado 33 ------------------------------------------

test("test_multi_horizon_conflict: corto y largo opuestos no se funden", () => {
  const r = reglas({
    diagnosis: temporal({
      trajectory: "deteriorating",
      short_term_trajectory: "deteriorating",
      long_term_trajectory: "improving",
    }),
  });
  assert.ok(r.includes("conflicto_de_horizontes_oculto"));

  // Con `mixed` el conflicto queda declarado y no salta nada.
  const bien = reglas({
    diagnosis: temporal({
      trajectory: "mixed",
      short_term_trajectory: "deteriorating",
      long_term_trajectory: "improving",
    }),
  });
  assert.ok(!bien.includes("conflicto_de_horizontes_oculto"));
});

test("§23: si D12 ajusto la serie, es la ajustada la que dirige", () => {
  const r = reglas({
    diagnosis: temporal({
      trajectory: "deteriorating",
      raw_trajectory: "deteriorating",
      context_adjusted_trajectory: "stable",
    }),
  });
  assert.ok(r.includes("trayectoria_sin_ajustar_dirige"));
});

test("test_lag_mismatch_invalidates: un lag incompatible tiene que pesar", () => {
  const r = reglas({
    diagnosis: temporal({ lag_confidence: "high" }),
    lagChecks: [
      temporalLagCheckSchema.parse({
        lag_check_id: "L-1", diagnosis_id: "TD-1",
        cause_label: "Cambio de creatividades", effect_label: "Caida de retencion",
        lag_fit: "incompatible",
        note: "La retencion se mide a 90 dias y el cambio fue hace 6",
      }),
    ],
  });
  assert.ok(r.includes("lag_incompatible_sin_efecto"));
});

test("test_recurrence_same_symptom_different_cause: recurrir no es repetir la causa", () => {
  const episodio = (code: string) =>
    diagnosticEpisodeSchema.parse({
      episode_code: code, diagnosis_type: "cac_deterioration",
      started_at: "2026-03-01T00:00:00Z", outcome: "resolved",
    });
  const r = reglas({
    diagnosis: temporal({ recurrence_status: "recurring", root_cause_lifecycle: "recurrent" }),
    episodes: [episodio("EP-1"), episodio("EP-2")],
  });
  assert.ok(r.includes("recurrencia_de_sintoma_no_es_de_causa"));
});

test("test_root_resolved_impact_not_recovered: cerrar pronto tiene nombre", () => {
  const r = reglas({
    diagnosis: temporal({
      root_cause_lifecycle: "resolved",
      cause_recovery: "recovered",
      system_recovery: "recovered",
      business_impact_recovery: "partial_recovery",
    }),
  });
  assert.ok(r.includes("resolucion_no_es_recuperacion"));

  // Con la limitacion escrita, deja de ser un cierre en falso.
  const conLimite = reglas({
    diagnosis: temporal({
      root_cause_lifecycle: "resolved",
      cause_recovery: "recovered",
      system_recovery: "recovered",
      business_impact_recovery: "partial_recovery",
      limitations: "El backlog acumulado tarda tres semanas mas en drenarse",
    }),
  });
  assert.ok(!conLimite.includes("resolucion_no_es_recuperacion"));
});

test("§28: el Reverse Recovery Test -- si se quita la causa y nada mejora, se reabre", () => {
  const r = reglas({
    diagnosis: temporal({
      root_cause_lifecycle: "resolved",
      system_recovery: "not_recovering",
      recovery_confidence: "medium",
      limitations: "La causa se retiro el dia 4 y el sistema sigue igual",
    }),
  });
  assert.ok(r.includes("causa_quitada_sin_recuperacion"));
});

test("§5: afirmar una tendencia por debajo de la ventana minima de la capacidad", () => {
  const r = reglas({
    diagnosis: temporal({ trajectory: "deteriorating", duration_hours: 12 }),
    profile: capabilityTimeProfileSchema.parse({
      capability: "retention", evaluation_window_hours: 2160,
      minimum_observation_window_hours: 1440,
    }),
  });
  assert.ok(r.includes("ventana_por_debajo_del_minimo"));
});

test("§29: los huecos historicos materiales se declaran", () => {
  const r = reglas({ diagnosis: temporal({ temporal_completeness: "partial_history" }) });
  assert.ok(r.includes("huecos_sin_declarar"));
});

test("§21: mas historia no es mejor evidencia si es de otro regimen", () => {
  const r = reglas({
    diagnosis: temporal({
      history_coverage: "deep",
      history_quality: "low",
      trajectory_confidence: "high",
    }),
  });
  assert.ok(r.includes("historia_larga_no_es_historia_buena"));
});

test("test_constraint_shift: un desplazamiento no es un problema nuevo", () => {
  const r = reglas({
    diagnosis: temporal({
      constraint_lifecycle: "shifted",
      constraint_shifted_to: "El cuello pasa de stock a capacidad de almacen",
      recurrence_status: "first_occurrence",
    }),
  });
  assert.ok(r.includes("desplazamiento_leido_como_problema_nuevo"));
});

// --- Lo estructural --------------------------------------------------------

test("§34: D13 no recomienda acciones ni decide prioridades", () => {
  const campos = Object.keys(temporalDiagnosisFields.shape);
  for (const prohibido of [
    "priority", "action", "recommendation", "next_step", "severity", "playbook", "urgency",
  ]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" no sale de D13 (apartado 34)`);
  }
});

test("§1: estado y trayectoria son dos campos, y ninguno se deriva del otro", () => {
  const campos = Object.keys(temporalDiagnosisFields.shape);
  assert.ok(campos.includes("current_state"));
  assert.ok(campos.includes("trajectory"));
  // Un campo unico que los fundiera seria justo el error del apartado 1.
  assert.ok(!campos.includes("state_and_trend"));
  assert.ok(!campos.includes("overall_status"));
});

test("§2: los once estados temporales, sin repetir", () => {
  assert.equal(TRAJECTORY_STATES.length, 11);
  assert.equal(new Set(TRAJECTORY_STATES).size, 11);
  for (const s of ["regressed", "recurrent", "new_regime", "mixed"]) {
    assert.ok((TRAJECTORY_STATES as readonly string[]).includes(s));
  }
});

test("§9 y §28: las tres recuperaciones son tres campos y nada las ata", () => {
  const campos = Object.keys(temporalDiagnosisFields.shape);
  for (const c of ["cause_recovery", "system_recovery", "business_impact_recovery"]) {
    assert.ok(campos.includes(c));
  }
  // Causa recuperada con impacto sin recuperar: cabe, y con su limitacion no
  // dispara nada. RESOLUTION != RECOVERY.
  assert.ok(
    temporal({
      cause_recovery: "recovered",
      system_recovery: "partial_recovery",
      business_impact_recovery: "not_recovering",
    }),
  );
});

test("§21: cinco confianzas temporales, no una", () => {
  const campos = Object.keys(temporalDiagnosisFields.shape);
  for (const c of [
    "onset_confidence", "trajectory_confidence", "regression_confidence",
    "recovery_confidence", "lag_confidence",
  ]) {
    assert.ok(campos.includes(c), `falta ${c}`);
  }
  assert.ok(!campos.includes("temporal_confidence"), "una sola confianza ocultaria las diferencias");
});
