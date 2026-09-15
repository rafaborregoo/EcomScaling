/**
 * FASE 3 / D10: severidad e impacto.
 *
 * El primer bloque que puede ordenar, y por eso el que mas fronteras tiene que
 * defender. Casi todos estos tests comprueban lo mismo por sitios distintos:
 * que una cifra no es una gravedad, que un pronostico no es una medicion, y que
 * medir el dano no es decidir que se hace con el.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkSeverityInvariants,
  severityAssessmentFields,
  severityAssessmentSchema,
  impactMeasurementFields,
  impactMeasurementSchema,
  impactExposureSchema,
  impactPropagationSchema,
  absorptionBufferSchema,
  RECOVERABILITY,
  LIKELIHOODS,
  type SeverityAssessment,
  type ImpactMeasurement,
  type SeverityCheckInput,
} from "./severity.js";
import { REVERSIBILITY } from "./root-cause.js";

function evaluacion(over: Partial<SeverityAssessment> = {}): SeverityAssessment {
  return severityAssessmentSchema.parse({
    assessment_id: "SEV-1",
    case_id: "C-1",
    target: "revenue",
    ...over,
  });
}

function medida(over: Partial<ImpactMeasurement> = {}): ImpactMeasurement {
  return impactMeasurementSchema.parse({
    measurement_id: "IM-1",
    assessment_id: "SEV-1",
    dimension: "revenue",
    timing: "realized",
    evidence_type: "observed",
    nature: "realized_loss",
    ...over,
  });
}

const exposicion = (over: Record<string, unknown> = {}) =>
  impactExposureSchema.parse({
    assessment_id: "SEV-1",
    denominator: "revenue",
    exposure_share: 0.12,
    ...over,
  });

const reglas = (input: SeverityCheckInput) =>
  checkSeverityInvariants(input).map((x) => x.rule);

// --- El contrato de la fila ------------------------------------------------

test("una evaluacion contenida con su exposicion no dispara nada", () => {
  assert.deepEqual(
    reglas({
      assessment: evaluacion({ overall_severity: "moderate", acute_severity: "moderate" }),
      exposures: [exposicion()],
    }),
    [],
  );
});

test("§11: BUSINESS_THREAT exige decir de que amenaza se trata", () => {
  assert.throws(() => evaluacion({ overall_severity: "business_threat" }));
  assert.throws(() =>
    evaluacion({ overall_severity: "business_threat", threat_kind: "liquidity" }),
  );
  assert.ok(
    evaluacion({
      overall_severity: "business_threat",
      threat_kind: "liquidity",
      continuity_rationale: "No hay caja para las obligaciones del mes que viene",
      severity_confidence: "high",
    }),
  );
});

test("§14 y §219: un CRITICAL local no es un CRITICAL global", () => {
  assert.throws(() =>
    evaluacion({ scope: "channel", overall_severity: "critical", severity_confidence: "high" }),
  );
  // §220: salvo que amenace la continuidad.
  assert.ok(
    evaluacion({
      scope: "channel",
      overall_severity: "critical",
      threat_kind: "ability_to_transact",
      severity_confidence: "high",
    }),
  );
  // Guardrail 12: o salvo que sea un fallo del camino critico.
  assert.ok(
    evaluacion({
      scope: "capability",
      overall_severity: "critical",
      critical_path_failure: true,
      severity_confidence: "high",
    }),
  );
});

test("§15: declarar exposicion material obliga a decir sobre que base", () => {
  assert.throws(() => evaluacion({ material_exposure: true }));
  assert.ok(evaluacion({ material_exposure: true, exposure_basis: "30% de la contribution" }));
});

test("§13 y §54: la incertidumbre no baja la severidad, pero se declara", () => {
  // Guardrail 13: esta combinacion **tiene que caber**.
  assert.ok(
    evaluacion({
      overall_severity: "critical",
      cause_confidence: "insufficient",
      severity_confidence: "low",
      limitations: "No hay periodo comparable ni grupo de control",
    }),
  );
  // Guardrail 54: lo que no cabe es afirmarlo sin decir que no se sabe.
  assert.throws(() => evaluacion({ overall_severity: "critical", severity_confidence: "low" }));
});

test("§50: con la medicion comprometida no se esta muy seguro del impacto", () => {
  assert.throws(() => evaluacion({ measurement_compromised: true, impact_confidence: "high" }));
});

test("§20: lo observado ya paso, y un pronostico no se disfraza de medicion", () => {
  assert.throws(() => medida({ timing: "projected", evidence_type: "observed", nature: "at_risk" }));
  assert.throws(() => medida({ timing: "potential", evidence_type: "observed", nature: "at_risk" }));
});

test("§5 y §30: el riesgo declara verosimilitud y lo ocurrido no la tiene", () => {
  assert.throws(() =>
    medida({ timing: "potential", evidence_type: "estimated", nature: "at_risk", assumptions: "Supone que sigue" }),
  );
  assert.throws(() => medida({ likelihood: "high" }));
  assert.ok(
    medida({
      timing: "potential",
      evidence_type: "estimated",
      nature: "at_risk",
      likelihood: "medium",
      assumptions: "Supone que el fallo sigue una semana",
    }),
  );
});

test("§23, §27 y §53: \"exacto\" solo sobre lo observado y con el periodo cerrado", () => {
  assert.throws(() =>
    medida({ quantification: "exact", value: 4200, unit: "EUR", method: "suma de pedidos", period_open: true }),
  );
  assert.throws(() => medida({ quantification: "exact", value: 4200, unit: "EUR" }));
  assert.ok(
    medida({ quantification: "exact", value: 4200, unit: "EUR", method: "suma de los pedidos fallidos" }),
  );
});

test("§24 y §28: un rango tiene dos extremos y lo direccional no lleva cifra", () => {
  assert.throws(() =>
    medida({ timing: "ongoing", quantification: "range", value: 3000, unit: "EUR", nature: "ongoing_loss" }),
  );
  assert.throws(() =>
    medida({
      timing: "ongoing", nature: "ongoing_loss", evidence_type: "inferred",
      quantification: "directional", value: 900, unit: "EUR", assumptions: "menciones negativas",
    }),
  );
});

test("§22: los supuestos de una estimacion se ven", () => {
  assert.throws(() => medida({ timing: "ongoing", nature: "ongoing_loss", evidence_type: "estimated" }));
});

test("§21: lo inferido y lo pronosticado no sostienen confianza alta", () => {
  assert.throws(() =>
    medida({
      timing: "projected", evidence_type: "forecast", nature: "at_risk",
      likelihood: "medium", impact_confidence: "high", assumptions: "Supone el ritmo actual",
    }),
  );
});

test("§6, §43 y §44: el coste de oportunidad no es una perdida realizada", () => {
  assert.throws(() =>
    medida({ nature: "opportunity_cost", evidence_type: "estimated", assumptions: "Supone demanda estable" }),
  );
  assert.ok(
    medida({
      nature: "opportunity_cost", timing: "projected", evidence_type: "forecast",
      dimension: "strategic", quantification: "range", value_low: 5000, value_high: 12000,
      unit: "EUR", likelihood: "medium", impact_confidence: "low",
      assumptions: "Supone que el lanzamiento habria rendido como el anterior",
    }),
  );
});

test("§32: revenue-at-risk no es revenue perdido", () => {
  assert.throws(() => medida({ nature: "at_risk", timing: "ongoing" }));
});

test("§16: elegir un denominador en vez de otro se razona", () => {
  assert.throws(() => exposicion({ denominator: "spend", is_chosen_denominator: true }));
  assert.ok(
    exposicion({
      denominator: "contribution",
      exposure_share: 0.3,
      is_chosen_denominator: true,
      rationale: "Los SKU afectados son los de mas margen",
    }),
  );
});

test("§36: lo sistemico se afirma con una ruta causal", () => {
  assert.throws(() =>
    impactPropagationSchema.parse({
      assessment_id: "SEV-1", to_capability: "finance", propagation_kind: "systemic",
    }),
  );
});

test("§33 y §34: la cascada no se suma como perdida aparte", () => {
  assert.throws(() =>
    impactPropagationSchema.parse({
      assessment_id: "SEV-1", to_capability: "retention",
      propagation_kind: "cascade", contributes_independent_loss: true,
    }),
  );
});

// --- Las reglas que miran el conjunto --------------------------------------

test("§9 y §10: una severidad alta sin exposicion es un porcentaje disfrazado", () => {
  const r = reglas({ assessment: evaluacion({ overall_severity: "high" }) });
  assert.ok(r.includes("porcentaje_no_es_gravedad"));
});

test("§15: varias exposiciones sin elegir cual se usa dejan el juicio sin base", () => {
  const r = reglas({
    assessment: evaluacion({ overall_severity: "moderate" }),
    exposures: [exposicion(), exposicion({ denominator: "contribution", exposure_share: 0.3 })],
  });
  assert.ok(r.includes("denominador_sin_elegir"));
});

test("§8 y §170: que la capacidad sea critica no es que hoy este danada", () => {
  const r = reglas({
    assessment: evaluacion({
      overall_severity: "high",
      capability_criticality: "critical",
    }),
    exposures: [exposicion()],
    measurements: [medida({ timing: "ongoing", nature: "exposure_only", quantification: "unknown" })],
  });
  assert.ok(r.includes("criticidad_no_es_impacto"));
});

test("§7: reversible no es recuperable", () => {
  const r = reglas({
    assessment: evaluacion({
      overall_severity: "moderate",
      reversibility: "easily_reversible",
      recoverability: "fully_recoverable",
    }),
    exposures: [exposicion()],
    measurements: [medida({ quantification: "exact", value: 4200, unit: "EUR", method: "suma de pedidos" })],
  });
  assert.ok(r.includes("reversible_no_es_recuperable"));
});

test("§34: revenue, contribution y cash cifrados a la vez suman el mismo euro tres veces", () => {
  const r = reglas({
    assessment: evaluacion({ overall_severity: "moderate" }),
    exposures: [exposicion()],
    measurements: [
      medida({ quantification: "exact", value: 4200, unit: "EUR", method: "suma de pedidos" }),
      medida({
        measurement_id: "IM-2", dimension: "contribution", timing: "ongoing",
        nature: "ongoing_loss", evidence_type: "estimated", quantification: "estimated",
        value: 1800, unit: "EUR", assumptions: "margen medio",
      }),
    ],
  });
  assert.ok(r.includes("doble_conteo_economico"));
});

test("§40 y §41: la recurrencia sube lo estructural, pero no lo inventa", () => {
  const ignorada = reglas({
    assessment: evaluacion({
      overall_severity: "moderate", recurrence: "chronic", structural_severity: "low",
    }),
    exposures: [exposicion()],
  });
  assert.ok(ignorada.includes("recurrencia_ignorada"));

  const inventada = reglas({
    assessment: evaluacion({
      overall_severity: "moderate", structural_severity: "critical",
      acute_severity: "low", cumulative_severity: "low",
    }),
    exposures: [exposicion()],
  });
  assert.ok(inventada.includes("recurrencia_no_es_amenaza_automatica"));
});

test("§37 y §39: un riesgo prospectivo alto sin mirar el colchon", () => {
  const r = reglas({
    assessment: evaluacion({ overall_severity: "moderate", forward_risk_severity: "high" }),
    exposures: [exposicion()],
  });
  assert.ok(r.includes("buffer_no_evaluado"));

  const conColchon = reglas({
    assessment: evaluacion({
      overall_severity: "moderate", forward_risk_severity: "high", absorption_capacity: "thin",
    }),
    exposures: [exposicion()],
    buffers: [
      absorptionBufferSchema.parse({
        buffer_type: "safety_stock", description: "Stock de seguridad del SKU principal",
        state: "consuming", exhaustion_horizon_days: 18,
      }),
    ],
  });
  assert.ok(!conColchon.includes("buffer_no_evaluado"));
});

test("§49 y §50: con la medicion rota no se da una perdida por observada", () => {
  const r = reglas({
    assessment: evaluacion({ overall_severity: "moderate", measurement_compromised: true }),
    exposures: [exposicion()],
    measurements: [medida({ quantification: "exact", value: 4200, unit: "EUR", method: "suma de pedidos" })],
  });
  assert.ok(r.includes("perdida_observada_sobre_medicion_rota"));
});

test("§52 y §53: el lenguaje se calibra a la evidencia", () => {
  const r = reglas({
    assessment: evaluacion({
      overall_severity: "moderate",
      summary: "La caida esta causado por el fallo de pagos, sin duda",
    }),
    exposures: [exposicion()],
    measurements: [
      medida({
        timing: "ongoing", nature: "ongoing_loss", evidence_type: "inferred",
        quantification: "directional", assumptions: "menciones de soporte",
      }),
    ],
  });
  assert.ok(r.includes("lenguaje_sin_calibrar"));
});

// --- Lo estructural --------------------------------------------------------

test("§3, §46, §47 y §48: no hay donde escribir una prioridad ni una accion", () => {
  const campos = [
    ...Object.keys(severityAssessmentFields.shape),
    ...Object.keys(impactMeasurementFields.shape),
  ];
  for (const prohibido of [
    "priority", "recommended_action", "playbook", "effort", "intervention_order",
    "rank", "next_step", "action",
  ]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" es F4, no D10 (guardrails 46, 47 y 48)`);
  }
});

test("§29: no existe ninguna columna de probabilidad numerica", () => {
  const campos = [
    ...Object.keys(severityAssessmentFields.shape),
    ...Object.keys(impactMeasurementFields.shape),
  ];
  for (const prohibido of ["probability", "likelihood_pct", "risk_score", "expected_value", "p_value"]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" seria una probabilidad inventada (guardrail 29)`);
  }
  // Y lo que si existe es cualitativo.
  assert.deepEqual([...LIKELIHOODS], ["low", "medium", "high", "unknown"]);
});

test("§9 y §10: no hay donde escribir el porcentaje de cambio de una metrica", () => {
  // La magnitud vive en D05. Si cupiera aqui, alguien acabaria derivando la
  // gravedad de ella, que es justo lo que los dos guardrails prohiben.
  const campos = Object.keys(severityAssessmentFields.shape);
  for (const prohibido of ["change_pct", "delta_pct", "metric_delta", "metric_change", "variation"]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" convertiria una cifra en una gravedad`);
  }
});

test("§7: reversibilidad y recuperabilidad no comparten ni un valor", () => {
  const cruce = (REVERSIBILITY as readonly string[]).filter(
    (v) => (RECOVERABILITY as readonly string[]).includes(v) && v !== "unknown",
  );
  assert.deepEqual(cruce, [], "si comparten valores se pueden confundir copiando uno en el otro");
});

test("§27: la confianza en la causa, en el impacto y en la severidad son tres campos", () => {
  const campos = Object.keys(severityAssessmentFields.shape);
  for (const c of ["cause_confidence", "impact_confidence", "severity_confidence"]) {
    assert.ok(campos.includes(c));
  }
  assert.ok(!campos.includes("confidence"), "una sola confianza colapsaria los tres juicios");
});

test("§51: data CRITICAL con el impacto sobre revenue en UNKNOWN es una salida valida", () => {
  const r = reglas({
    assessment: evaluacion({
      overall_severity: "moderate",
      measurement_compromised: true,
      impact_confidence: "low",
    }),
    exposures: [exposicion({ denominator: "traffic", exposure_share: 0.9 })],
    measurements: [
      medida({
        dimension: "data", dimension_severity: "critical", timing: "ongoing",
        nature: "exposure_only", evidence_type: "observed", quantification: "unknown",
      }),
      medida({
        measurement_id: "IM-2", dimension: "revenue", timing: "ongoing",
        nature: "exposure_only", evidence_type: "inferred", quantification: "unknown",
        assumptions: "El tracking no permite medirlo",
      }),
    ],
  });
  assert.deepEqual(r, []);
});

test("§3 y §95: la global no se deriva de las otras cuatro, pero no se despega", () => {
  // Una sola dimension puede dominar hacia arriba: eso se permite.
  const dominancia = reglas({
    assessment: evaluacion({
      overall_severity: "business_threat", threat_kind: "liquidity",
      continuity_rationale: "No hay caja para las obligaciones", severity_confidence: "high",
      acute_severity: "low", cumulative_severity: "low", forward_risk_severity: "business_threat",
    }),
    exposures: [exposicion({ denominator: "contribution" })],
  });
  assert.ok(!dominancia.includes("perfil_incoherente"));

  // Hacia abajo, dos escalones por debajo de la peor parte, avisa.
  const olvido = reglas({
    assessment: evaluacion({ overall_severity: "low", acute_severity: "critical" }),
    exposures: [exposicion()],
  });
  assert.ok(olvido.includes("perfil_incoherente"));
});
