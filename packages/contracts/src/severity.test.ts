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
  assessSeverity,
  checkSeverityInvariants,
  exposureShare,
  recurrenceFrom,
  velocityFrom,
  type CaseForSeverity,
  type SeverityCaseInput,
  type SignalForSeverity,
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

// --- El motor ---------------------------------------------------------------

function casoSeveridad(): CaseForSeverity {
  return {
    case_id: "c1",
    target_metric: "net_sales",
    scope: "business_global",
    analysis_period_start: "2026-09-01T00:00:00.000Z",
    analysis_period_end: "2026-09-08T00:00:00.000Z",
  };
}

function senalSeveridad(
  overrides: Partial<SignalForSeverity> = {},
): SignalForSeverity {
  return {
    metric: "net_sales",
    direction: "down",
    observed_value: 9600,
    baseline_value: 12000,
    magnitude_absolute: -2400,
    trajectory: "deteriorating",
    persistence: "persistent",
    business_exposure: "moderate",
    window_start: "2026-09-01T00:00:00.000Z",
    window_end: "2026-09-08T00:00:00.000Z",
    ...overrides,
  };
}

function entrada(
  overrides: Partial<SeverityCaseInput> = {},
): SeverityCaseInput {
  return {
    diagnosticCase: casoSeveridad(),
    signal: senalSeveridad(),
    denominators: [
      { denominator: "revenue", value: 78000 },
      { denominator: "orders", value: 410 },
    ],
    currency: "EUR",
    ...overrides,
  };
}

test("D10: el motor no pone ni una severidad, y dice por que", () => {
  // Es el nucleo del bloque. El apartado 29 dice que la fuente no define formula
  // de severidad ni ponderacion, y el guardrail 17 que un scope pequeno puede
  // ser material -- o sea que tampoco hay umbral por cuota. "3% = moderate"
  // seria inventarse el umbral que el documento se niega a dar.
  const e = assessSeverity(entrada());

  assert.deepEqual(
    [
      e.acute_severity,
      e.cumulative_severity,
      e.forward_risk_severity,
      e.structural_severity,
      e.overall_severity,
    ],
    ["unknown", "unknown", "unknown", "unknown", "unknown"],
  );
  assert.equal(e.measurements[0]?.dimension_severity, "unknown");
  assert.match(e.limitations, /no define formula de severidad/);
});

test("D10: la cuenta es estimada, no observada, y lleva sus supuestos", () => {
  // El valor de hoy se observa; la perdida es la diferencia contra un baseline,
  // y un baseline es un modelo. Decir `observed` presentaria un calculo como una
  // medicion -- y ademas el esquema exige supuestos a todo lo que no sea
  // observado (guardrail 22).
  const medida = assessSeverity(entrada()).measurements[0];

  assert.equal(medida?.evidence_type, "estimated");
  assert.equal(medida?.quantification, "estimated");
  assert.notEqual(medida?.quantification, "exact");
  assert.ok((medida?.assumptions ?? "").length > 0);
  assert.match(medida?.assumptions ?? "", /estacionalidad/);
});

test("D10: se elige un denominador, uno solo, y se razona", () => {
  // Guardrails 15 y 16: se registran varios, se marca cual juzga y se dice por
  // que. El mismo incidente es un 3% del revenue y un 30% de la contribucion.
  const e = assessSeverity(entrada());

  const elegidos = e.exposures.filter((x) => x.is_chosen_denominator);
  assert.equal(elegidos.length, 1);
  assert.equal(elegidos[0]?.denominator, "revenue");
  assert.ok((elegidos[0]?.rationale ?? "").length > 0);

  // Los no elegidos se guardan igual: quitarlos dejaria la cuota sin con que
  // compararla.
  assert.equal(e.exposures.length, 2);
  assert.equal(e.exposures.find((x) => x.denominator === "orders")?.rationale, null);
});

test("D10: la cuota se calcula sobre la base, no sobre la nada", () => {
  const e = assessSeverity(entrada());
  const revenue = e.exposures.find((x) => x.denominator === "revenue");

  assert.ok(revenue?.exposure_share != null);
  assert.ok(Math.abs((revenue?.exposure_share ?? 0) - 2400 / 78000) < 1e-9);
});

test("D10: una perdida mayor que su base no se convierte en el 100%", () => {
  // Devolver 1 taparia un error de medicion con una cifra creible. Que salga el
  // hueco es lo correcto: o la base esta mal elegida o esta mal medida.
  assert.equal(exposureShare(2400, 1000), null);
  assert.equal(exposureShare(2400, 0), null);
  assert.equal(exposureShare(500, 1000), 0.5);

  const e = assessSeverity(
    entrada({ denominators: [{ denominator: "revenue", value: 1000 }] }),
  );
  const revenue = e.exposures[0];
  assert.equal(revenue?.exposure_share, null);
  assert.ok((revenue?.denominator_note ?? "").length > 0);
  // El esquema exige que la fila diga algo: si no hay cuota, dice sobre que.
  assert.ok(revenue?.affected_segment != null);
});

test("D10: la confianza en la causa es insuficiente siempre, y no arrastra la del impacto", () => {
  // Guardrail 13: se puede estar seguro de que el dano es grave y no tener ni
  // idea de por que. Son tres juicios separados (apartado 27).
  const e = assessSeverity(entrada());

  assert.equal(e.cause_confidence, "insufficient");
  assert.equal(e.severity_confidence, "insufficient");
  assert.equal(e.impact_confidence, "medium", "la cuenta esta hecha, eso si se sabe");
});

test("D10: un dato que D01 degrado marca la cifra como comprometida", () => {
  // Guardrail 51: medir mal no es perder dinero, pero una resta exacta sobre un
  // dato malo sigue siendo un dato malo.
  const e = assessSeverity(entrada({ dataReliability: "unusable" }));

  assert.equal(e.measurement_compromised, true);
  assert.equal(e.impact_confidence, "low");
  assert.match(e.limitations, /degradada/);
  assert.ok((e.measurements[0]?.note ?? "").includes("comprometida"));
});

test("D10: velocidad y trayectoria son vocabularios distintos", () => {
  // `volatile` no es una velocidad. Mapearlo a "empeorando" convertiria un
  // vaiven en una direccion.
  assert.equal(velocityFrom("deteriorating"), "worsening");
  assert.equal(velocityFrom("rapidly_deteriorating"), "rapidly_deteriorating");
  assert.equal(velocityFrom("recovering"), "recovering");
  assert.equal(velocityFrom("volatile"), "unknown");
  assert.equal(velocityFrom(null), "unknown");
});

test("D10: sin sintoma detras, la recurrencia no se supone", () => {
  assert.equal(recurrenceFrom(null), "unknown");
  assert.equal(recurrenceFrom({ persistence: "chronic", recurrence_count: 1 }), "chronic");
  assert.equal(recurrenceFrom({ persistence: "acute", recurrence_count: 3 }), "recurrent");
  assert.equal(recurrenceFrom({ persistence: "acute", recurrence_count: 1 }), "first_time");
});

test("D10: sin senal no se inventa un impacto", () => {
  const e = assessSeverity(entrada({ signal: null }));

  assert.equal(e.measurements.length, 0);
  assert.equal(e.impact_confidence, "insufficient");
  assert.match(e.summary, /no hay impacto que cuantificar/);
  assert.match(e.limitations, /No hay senal en la ventana/);
});

test("D10: lo local no se globaliza solo, y no se avisa a nadie", () => {
  // Guardrail 14: para que lo local sea global hay que declarar que la
  // exposicion es material, y nadie lo ha declarado. Guardrail 56: D10 no define
  // a quien se avisa.
  const e = assessSeverity(entrada());

  assert.equal(e.material_exposure, false);
  assert.equal(e.escalation_signal, "none");
});

test("D10: la evaluacion no tiene prioridad, accion ni esfuerzo", () => {
  // Guardrails 3, 46, 47 y 48. Un HIGH puede ir antes que un CRITICAL segun
  // esfuerzo y momento, y eso es F4.
  const e = assessSeverity(entrada()) as Record<string, unknown>;

  for (const prohibida of [
    "priority",
    "recommended_action",
    "playbook",
    "effort",
    "intervention_order",
    "probability",
  ]) {
    assert.ok(!(prohibida in e), `${prohibida} no puede existir aqui`);
  }
});
