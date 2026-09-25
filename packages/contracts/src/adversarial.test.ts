/**
 * FASE 3 / D12: confusores y falsos diagnosticos.
 *
 * La capa adversarial. Casi todos estos tests comprueban lo mismo por sitios
 * distintos: que un diagnostico no sobreviva por inercia. Sobrevivir cuesta
 * haber intentado tumbarlo, y los fixtures del apartado 20 son las formas
 * concretas en que una lectura limpia puede estar equivocada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkAdversarialInvariants,
  diagnosticRobustnessFields,
  diagnosticRobustnessSchema,
  diagnosticConfounderFields,
  diagnosticConfounderSchema,
  confounderTestSchema,
  comparabilityGateSchema,
  mandatoryCheckSchema,
  sensitivityAnalysisSchema,
  CONFOUNDER_TYPES,
  DIAGNOSTIC_FAMILIES,
  MANDATORY_CHECKS_BY_FAMILY,
  type DiagnosticRobustness,
  type DiagnosticConfounder,
  type AdversarialCheckInput,
  getDiagnosticRobustness,
  runRedTeam,
  type AdversarialRuntimeInput,
  REVISION_BUDGET,
  revisionDecision,
} from "./adversarial.js";
import { confounderSchema } from "./context.js";

function revision(over: Partial<DiagnosticRobustness> = {}): DiagnosticRobustness {
  return diagnosticRobustnessSchema.parse({
    robustness_id: "RB-1",
    case_id: "C-1",
    ...over,
  });
}

const sobrevive = (over: Partial<DiagnosticRobustness> = {}) =>
  revision({
    survival_status: "survives",
    red_team_counter_explanation: "Podria ser mix de producto: los SKU de bajo margen pesan mas",
    red_team_required_evidence: "Desglose de margen por SKU de los dos periodos",
    diagnosis_stability: "sensitive",
    ...over,
  });

function confusor(over: Partial<DiagnosticConfounder> = {}): DiagnosticConfounder {
  return diagnosticConfounderSchema.parse({
    confounder_id: "CF-1",
    case_id: "C-1",
    confounder_type: "product_mix",
    category: "composition",
    description: "El peso de los SKU de bajo margen subio del 20% al 38% en el periodo",
    ...over,
  });
}

const reglas = (input: AdversarialCheckInput) =>
  checkAdversarialInvariants(input).map((x) => x.rule);

// --- El contrato de la fila ------------------------------------------------

test("una revision con su red team y sin confusores materiales no dispara nada", () => {
  assert.deepEqual(reglas({ robustness: sobrevive() }), []);
});

test("§12 y §22: no se sobrevive sin haber escrito por que podria estar mal", () => {
  assert.throws(() => revision({ survival_status: "survives" }));
  assert.throws(() =>
    revision({ survival_status: "survives_with_limitations", remaining_limitations: "Depende del baseline elegido" }),
  );
  assert.ok(sobrevive());
});

test("§2: un riesgo CRITICAL de falso diagnostico bloquea el cierre", () => {
  assert.throws(() => sobrevive({ false_diagnosis_risk: "critical" }));
  assert.ok(
    revision({
      false_diagnosis_risk: "critical",
      survival_status: "invalidated",
      revision_triggered: true,
      reopened_blocks: ["D06", "D08"],
      confidence_before: "high",
      confidence_after: "insufficient_data",
    }),
  );
});

test("§10: sobrevivir con limitaciones exige decir cuales", () => {
  assert.throws(() =>
    revision({
      survival_status: "survives_with_limitations",
      red_team_counter_explanation: "Podria ser estacionalidad de noviembre",
    }),
  );
});

test("§13: un diagnostico muy sensible no sale intacto, y uno robusto no es fragil", () => {
  assert.throws(() =>
    sobrevive({
      diagnosis_stability: "highly_sensitive",
      remaining_limitations: "Cambia si se usa YoY en vez de periodo anterior",
    }),
  );
  assert.throws(() => sobrevive({ robustness: "high", diagnosis_stability: "sensitive" }));
  assert.ok(sobrevive({ robustness: "high", diagnosis_stability: "stable_to_assumptions" }));
});

test("§21: si la revision debilita, la confianza baja", () => {
  assert.throws(() =>
    revision({ survival_status: "weakened", confidence_before: "high", confidence_after: "high" }),
  );
  assert.ok(
    revision({ survival_status: "weakened", confidence_before: "high", confidence_after: "medium" }),
  );
});

test("§11: revisar o invalidar obliga a reabrir algo, no solo a anotarlo", () => {
  assert.throws(() =>
    revision({ survival_status: "requires_revision", confidence_before: "high", confidence_after: "low" }),
  );
});

test("§5: subir un confusor cuesta evidencia, y descartarlo tambien", () => {
  assert.throws(() => confusor({ status: "supported" }));
  assert.throws(() => confusor({ status: "material" }));
  assert.throws(() => confusor({ status: "rejected" }));
  assert.ok(confusor({ status: "supported", evidence: "Desglose de margen por SKU" }));
});

test("§14: un confusor especulativo no destruye un diagnostico fuerte", () => {
  assert.throws(() => confusor({ plausibility: "speculative", strength: "decisive" }));
  assert.throws(() => confusor({ plausibility: "speculative", strength: "strong" }));
  // Y lo decisivo esta soportado, no solo es plausible.
  assert.throws(() => confusor({ plausibility: "plausible", strength: "decisive" }));
});

test("§5 y §14: RESOLVED se resuelve, y ajustar se declara", () => {
  assert.throws(() =>
    confusor({ status: "resolved", evidence: "Serie de tres anos", resolution: "unresolved" }),
  );
  assert.throws(() =>
    confusor({ status: "resolved", evidence: "Serie de tres anos", resolution: "adjusted_for" }),
  );
  assert.ok(
    confusor({
      status: "resolved", evidence: "Serie de tres anos", resolution: "adjusted_for",
      adjustment_note: "La caida se expresa ya descontada la estacionalidad de noviembre",
    }),
  );
});

test("§21: un confusor material declara que le hace a la confianza", () => {
  assert.throws(() => confusor({ status: "material", evidence: "Desglose por canal" }));
});

test("§6: un test resuelto dice que le hace al diagnostico", () => {
  assert.throws(() =>
    confounderTestSchema.parse({
      test_id: "T-1", confounder_id: "CF-1", required_data: "Margen por SKU",
      expected_pattern: "Si es mix, el margen within-SKU se mantiene", result: "confirmed",
    }),
  );
});

test("§4: comparable son las cinco preguntas, y basta un `no` para tumbarlo", () => {
  assert.throws(() =>
    comparabilityGateSchema.parse({
      case_id: "C-1", metric: "revenue", comparability: "comparable",
      same_definition: "yes", same_scope: "yes", same_time_logic: "yes", same_currency: "yes",
    }),
  );
  assert.throws(() =>
    comparabilityGateSchema.parse({
      case_id: "C-1", metric: "orders", comparability: "partially_comparable", same_time_logic: "no",
    }),
  );
  assert.throws(() =>
    comparabilityGateSchema.parse({
      case_id: "C-1", metric: "cac", comparability: "not_comparable", same_definition: "no",
    }),
  );
});

test("§19: no se salta un check obligatorio en silencio", () => {
  assert.throws(() =>
    mandatoryCheckSchema.parse({
      case_id: "C-1", diagnostic_family: "revenue", check_key: "seasonality", status: "skipped",
    }),
  );
  assert.throws(() =>
    mandatoryCheckSchema.parse({
      case_id: "C-1", diagnostic_family: "revenue", check_key: "promotions", status: "executed",
    }),
  );
  assert.ok(
    mandatoryCheckSchema.parse({
      case_id: "C-1", diagnostic_family: "retention", check_key: "cohort_maturity",
      status: "not_possible",
      reason: "Las cohortes de septiembre necesitan 90 dias y solo llevan 34",
    }),
  );
});

test("§13: probar la sensibilidad sin mover nada no es probarla", () => {
  assert.throws(() =>
    sensitivityAnalysisSchema.parse({
      robustness_id: "RB-1", assumption: "El baseline es el periodo anterior",
      base_case: "La caida es del 18%",
    }),
  );
  assert.throws(() =>
    sensitivityAnalysisSchema.parse({
      robustness_id: "RB-1", assumption: "El baseline es el periodo anterior",
      low_case: "Con YoY la caida es del 4%", diagnosis_changes: true,
    }),
  );
});

// --- Los fixtures del apartado 20 ------------------------------------------

test("§10: un material sin resolver y el diagnostico intacto no caben juntos", () => {
  const r = reglas({
    robustness: sobrevive(),
    confounders: [
      confusor({
        status: "material", evidence: "Desglose por canal",
        confidence_effect: "Baja la confianza en la lectura de deterioro",
      }),
    ],
  });
  assert.ok(r.includes("sobrevive_con_material_sin_resolver"));
});

test("§21: un confusor decisivo tiene que acusarse", () => {
  const r = reglas({
    robustness: sobrevive(),
    confounders: [
      confusor({
        confounder_type: "tracking_change", category: "measurement",
        description: "GA cae tras el deploy de tracking mientras Shopify sigue estable",
        evidence: "Series de GA y Shopify del dia 12", plausibility: "supported",
        strength: "decisive", status: "supported",
      }),
    ],
  });
  assert.ok(r.includes("confusor_decisivo_sin_efecto"));
});

test("§14: un diagnostico no se tumba solo con especulaciones", () => {
  const r = reglas({
    robustness: revision({
      survival_status: "invalidated", revision_triggered: true, reopened_blocks: ["D09"],
      confidence_before: "high", confidence_after: "low",
    }),
    confounders: [
      confusor({
        confounder_type: "external_event", category: "external",
        description: "Puede que la competencia lanzara una campana agresiva ese mes",
      }),
    ],
  });
  assert.ok(r.includes("especulativo_tumba_diagnostico"));
});

test("§4: una metrica no comparable no sostiene un diagnostico fuerte", () => {
  const r = reglas({
    robustness: sobrevive(),
    gates: [
      comparabilityGateSchema.parse({
        case_id: "C-1", metric: "cac", comparability: "not_comparable",
        same_definition: "no", note: "La definicion de cliente nuevo cambio en agosto",
      }),
    ],
  });
  assert.ok(r.includes("no_comparable_sostiene_diagnostico"));
});

test("test_partial_period: un periodo parcial contra uno completo", () => {
  const r = reglas({
    robustness: sobrevive(),
    gates: [
      comparabilityGateSchema.parse({
        case_id: "C-1", metric: "revenue_mtd", same_time_logic: "no",
        comparability: "not_comparable", note: "El periodo actual lleva 18 dias y el comparado 30",
      }),
    ],
  });
  assert.ok(r.includes("periodo_parcial_no_compara"));
});

test("test_traffic_mix_simpsons_paradox: un mix soportado se prueba within-segment", () => {
  const sinPrueba = reglas({
    robustness: sobrevive(),
    confounders: [confusor({ status: "supported", evidence: "Desglose por SKU" })],
  });
  assert.ok(sinPrueba.includes("mix_sin_prueba_within_segment"));

  const conPrueba = reglas({
    robustness: sobrevive(),
    confounders: [confusor({ status: "supported", evidence: "Desglose por SKU" })],
    tests: [
      confounderTestSchema.parse({
        test_id: "T-1", confounder_id: "CF-1", required_data: "Margen por SKU",
        expected_pattern: "Si es mix, el margen within-SKU se mantiene estable",
        control_kind: "within_segment", result: "confirmed",
        effect_on_diagnosis: "El deterioro de margen no es real: es composicion",
      }),
    ],
  });
  assert.ok(!conPrueba.includes("mix_sin_prueba_within_segment"));
});

test("test_masking_effect: el lado del falso negativo", () => {
  const r = reglas({
    robustness: sobrevive(),
    confounders: [
      confusor({
        confounder_type: "traffic_mix",
        description: "El revenue queda plano con trafico +40% y CVR -28%: el volumen tapa el deterioro",
        evidence: "Series de sesiones y CVR", plausibility: "supported", status: "supported",
        masking_effect: true,
      }),
    ],
    tests: [
      confounderTestSchema.parse({
        test_id: "T-1", confounder_id: "CF-1", required_data: "Sesiones y CVR por canal",
        expected_pattern: "Si es mix, el CVR within-canal se mantiene",
        control_kind: "within_segment", result: "refuted",
        effect_on_diagnosis: "El CVR cae dentro de cada canal: hay deterioro real",
      }),
    ],
  });
  assert.ok(r.includes("deterioro_enmascarado"));
});

test("test_simultaneous_interventions: tres cambios el mismo dia no se atribuyen a uno", () => {
  const r = reglas({
    robustness: sobrevive(),
    confounders: [
      confusor({
        confounder_id: "CF-1", confounder_type: "price_change", category: "operational",
        description: "El precio del catalogo subio un 8% el dia 3 del periodo",
        evidence: "Historico de precios", plausibility: "supported", status: "supported",
      }),
      confusor({
        confounder_id: "CF-2", confounder_type: "launch", category: "context",
        description: "La nueva PDP se desplego el mismo dia 3 del periodo",
        evidence: "Registro de despliegues", plausibility: "supported", status: "supported",
      }),
    ],
  });
  assert.ok(r.includes("cambios_simultaneos_sin_separar"));
});

test("test_low_sample: un porcentaje sobre una muestra insuficiente", () => {
  const r = reglas({
    robustness: sobrevive(),
    confounders: [
      confusor({
        confounder_type: "sample_size", category: "selection",
        description: "El segmento afectado tiene 34 pedidos en todo el periodo",
        evidence: "Conteo de pedidos del segmento", plausibility: "supported", status: "supported",
      }),
    ],
  });
  assert.ok(r.includes("muestra_insuficiente"));
});

test("§7: la familia diagnostica trae sus checks minimos y tienen que estar", () => {
  const faltan = reglas({
    robustness: sobrevive(),
    family: "retention",
    checks: [
      mandatoryCheckSchema.parse({
        case_id: "C-1", diagnostic_family: "retention", check_key: "cohort_maturity",
        status: "executed", outcome: "Las cohortes de junio ya estan maduras",
      }),
    ],
  });
  assert.ok(faltan.includes("familia_sin_sus_checks"));

  const todos = reglas({
    robustness: sobrevive(),
    family: "retention",
    checks: (MANDATORY_CHECKS_BY_FAMILY.retention ?? []).map((k) =>
      mandatoryCheckSchema.parse({
        case_id: "C-1", diagnostic_family: "retention", check_key: k,
        status: "executed", outcome: "Comprobado sin hallazgos materiales",
      }),
    ),
  });
  assert.ok(!todos.includes("familia_sin_sus_checks"));
});

test("§13: si mover un supuesto cambia el diagnostico, no es estable", () => {
  const r = reglas({
    robustness: sobrevive({ diagnosis_stability: "stable_to_assumptions" }),
    sensitivity: [
      sensitivityAnalysisSchema.parse({
        robustness_id: "RB-1", assumption: "El baseline es el periodo anterior",
        low_case: "Con YoY la caida es del 4%", high_case: "Con media movil la caida es del 21%",
        diagnosis_changes: true,
        note: "Con YoY la caida deja de ser material y el diagnostico no se sostiene",
      }),
    ],
  });
  assert.ok(r.includes("sensibilidad_ignorada"));
});

test("§12: una contraexplicacion que no dice como se zanja es una frase", () => {
  const r = reglas({
    robustness: revision({
      survival_status: "survives",
      red_team_counter_explanation: "Podria ser estacionalidad",
    }),
  });
  assert.ok(r.includes("red_team_sin_salida"));
});

// --- Lo estructural --------------------------------------------------------

test("§21: no hay donde forzar que un diagnostico sobreviva", () => {
  const campos = [
    ...Object.keys(diagnosticRobustnessFields.shape),
    ...Object.keys(diagnosticConfounderFields.shape),
  ];
  for (const prohibido of [
    "override", "force_survive", "accepted_anyway", "skip_review", "bypass", "approved",
  ]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" forzaria la supervivencia (apartado 21)`);
  }
});

test("§3: los 25 tipos de confusor estan, y las ocho categorias", () => {
  assert.equal(CONFOUNDER_TYPES.length, 25);
  assert.equal(new Set(CONFOUNDER_TYPES).size, 25, "hay un tipo repetido");
  for (const t of ["seasonality", "partial_period", "attribution_change", "currency_change"]) {
    assert.ok((CONFOUNDER_TYPES as readonly string[]).includes(t));
  }
});

test("§7: las ocho familias diagnosticas traen sus checks", () => {
  for (const f of DIAGNOSTIC_FAMILIES) {
    const checks = MANDATORY_CHECKS_BY_FAMILY[f];
    assert.ok(checks != null && checks.length > 0, `la familia "${f}" no tiene checks minimos`);
  }
});

test("D02 sigue sin poder promover un confusor, y por eso D12 es otra tabla", () => {
  // El guardrail 24 de D02 dice que sus confusores son candidatos y que no
  // existe columna que los promueva. Este test guarda esa frontera desde aqui:
  // si alguien anadiera `status` o `strength` a D02, D12 dejaria de tener
  // sentido como capa aparte.
  const d02 = confounderSchema.parse({
    variable: "Black Friday",
    possible_relation: "Coincide con el pico de la serie",
  });
  for (const promocion of ["status", "strength", "materiality", "resolution"]) {
    assert.ok(
      !Object.keys(d02).includes(promocion),
      `"${promocion}" en D02 convertiria una candidata en una conclusion`,
    );
  }
  // Y el linaje entre las dos si existe, para no teclear la candidata dos veces.
  assert.ok(Object.keys(diagnosticConfounderFields.shape).includes("source_confounder_id"));
});

// --- El motor puro ---------------------------------------------------------

function runtime(overrides: Partial<AdversarialRuntimeInput> = {}): AdversarialRuntimeInput {
  return {
    robustnessId: "RB-1",
    caseId: "C-1",
    family: "revenue",
    metric: "net_sales",
    analysisPeriod: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-08T00:00:00.000Z" },
    comparisonPeriod: { start: "2026-07-25T00:00:00.000Z", end: "2026-08-01T00:00:00.000Z" },
    currentConfidence: "high",
    comparabilityFacts: {
      sameDefinition: "yes",
      sameScope: "yes",
      sameCurrency: "yes",
      sameStatusFilter: "yes",
    },
    signals: [],
    events: [],
    comparabilityBreaks: [],
    mixSegments: [],
    orderCounts: { analysis: 120, comparison: 110 },
    ...overrides,
  };
}

test("el motor declara comparable solo cuando las cinco preguntas son yes", () => {
  const result = getDiagnosticRobustness(runtime());
  assert.deepEqual(result.gates[0], {
    case_id: "C-1",
    metric: "net_sales",
    same_definition: "yes",
    same_scope: "yes",
    same_time_logic: "yes",
    same_currency: "yes",
    same_status_filter: "yes",
    comparability: "comparable",
  });
  assert.equal(result.checks.find((check) => check.check_key === "period_comparability")?.status, "executed");
  assert.equal(result.robustness.survival_status, "survives");
});

test("un periodo parcial degrada la puerta y no deja sobrevivir intacto el diagnostico", () => {
  const result = getDiagnosticRobustness(runtime({
    analysisPeriod: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-05T00:00:00.000Z" },
  }));
  assert.equal(result.gates[0]?.same_time_logic, "no");
  assert.equal(result.gates[0]?.comparability, "not_comparable");
  assert.equal(result.robustness.survival_status, "weakened");
  assert.ok(result.confounders.some((confounder) => confounder.confounder_type === "partial_period"));
});

test("un tracking distorsionado es material, baja la confianza y abre la revision", () => {
  const result = getDiagnosticRobustness(runtime({
    signals: [{
      metric: "net_sales",
      dataConfidence: "insufficient_data",
      lowSample: false,
      baselineConflict: true,
    }],
    comparabilityFacts: {
      sameDefinition: "yes",
      sameScope: "yes",
      sameCurrency: "yes",
      sameStatusFilter: "yes",
    },
    comparabilityBreaks: [{
      breakType: "tracking_change",
      description: "El deploy del pixel dejo de enviar eventos de compra a GA",
      affectedMetrics: ["net_sales"],
      effectiveFrom: "2026-08-03T00:00:00.000Z",
    }],
  }));
  const tracking = result.confounders.find((confounder) => confounder.confounder_type === "tracking_change");
  assert.equal(tracking?.status, "material");
  assert.equal(tracking?.strength, "decisive");
  assert.equal(result.robustness.survival_status, "requires_revision");
  assert.equal(result.robustness.confidence_after, "low");
  assert.deepEqual(result.robustness.reopened_blocks, ["D06", "D07", "D08", "D09"]);
});

test("el cambio de mix crea una prueba within-segment y conserva el lado del falso negativo", () => {
  const result = getDiagnosticRobustness(runtime({
    signals: [{ metric: "net_sales", dataConfidence: "high", lowSample: false, baselineConflict: false }],
    mixSegments: [
      { dimension: "channel", segment: "paid", weightBefore: 0.2, weightAfter: 0.6, performanceBefore: 100, performanceAfter: 100 },
      { dimension: "channel", segment: "organic", weightBefore: 0.8, weightAfter: 0.4, performanceBefore: 120, performanceAfter: 120 },
    ],
  }));
  const mix = result.confounders.find((confounder) => confounder.confounder_type === "traffic_mix");
  assert.equal(mix?.status, "supported");
  assert.equal(mix?.masking_effect, true);
  assert.ok(result.tests.some((test) => test.confounder_id === mix?.confounder_id && test.control_kind === "within_segment"));
  assert.equal(result.robustness.survival_status, "survives_with_limitations");
  assert.ok(result.robustness.remaining_limitations);
});

test("la biblioteca red team devuelve la contraexplicacion y la evidencia necesaria, sin inventar un hecho externo", () => {
  const result = runRedTeam(runtime({ family: "conversion", metric: "conversion_rate" }));
  assert.match(result.strongest_counter_explanation, /podr[ií]a|posible/i);
  assert.ok(result.required_evidence.length > 0);
  assert.equal(result.diagnosis_effect, "requires_review_if_supported");
});

test("la familia retention deja trazado el check de cohortes cuando no hay madurez observable", () => {
  const result = getDiagnosticRobustness(runtime({ family: "retention", metric: "repeat_rate" }));
  const check = result.checks.find((item) => item.check_key === "cohort_maturity");
  assert.equal(check?.status, "not_possible");
  assert.match(check?.reason ?? "", /madurez|cohort/i);
  assert.ok(result.robustness.remaining_limitations);
});

test("D12: la revision se propone, se confirma y tiene presupuesto", () => {
  assert.deepEqual(revisionDecision({ revision_triggered: true, confirmed_count: 0, open_proposal: false }), { state: "proposed", propose: true, budget_used: 0 });
  // Con una propuesta esperando no se apila otra.
  assert.equal(revisionDecision({ revision_triggered: true, confirmed_count: 0, open_proposal: true }).propose, false);
  // Agotado el presupuesto no se reabre mas.
  assert.deepEqual(revisionDecision({ revision_triggered: true, confirmed_count: REVISION_BUDGET, open_proposal: false }), { state: "budget_exhausted", propose: false, budget_used: REVISION_BUDGET });
  // Una confirmacion que aun no tiene revision posterior sigue en curso.
  assert.equal(revisionDecision({ revision_triggered: true, confirmed_count: 1, open_proposal: false, confirmation_pending_review: true }).state, "confirmed");
  assert.equal(revisionDecision({ revision_triggered: false, confirmed_count: 1, open_proposal: false }).state, "none");
});
