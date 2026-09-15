/**
 * FASE 3 / D04: los invariantes de la salud por capacidad.
 *
 * Dos de estos tests no comprueban que algo se rechace, sino que algo se
 * **permita**: HEALTHY con riesgo estructural critico, y un padre sano con un
 * hijo en desastre. Los guardrails 22 y el apartado 4 lo exigen, y una
 * constraint de mas los habria roto sin que nadie se diera cuenta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessHealth,
  checkHealthInvariants,
  combineTrajectories,
  evidenceRelation,
  healthCardFields,
  healthCardSchema,
  healthEvidenceSchema,
  healthFindingSchema,
  nearTermRisk,
  type HealthCard,
  type HealthCheckInput,
  type SignalForHealth,
} from "./health.js";
import { dataQualityAssessmentSchema } from "./data-quality.js";

const positiva = (metric: string, observation: string) =>
  healthEvidenceSchema.parse({ relation: "positive", metric, observation });

const apoya = (metric: string, observation: string, indicator_type: "leading" | "lagging" = "lagging") =>
  healthEvidenceSchema.parse({ relation: "supporting", metric, observation, indicator_type });

/** Una capacidad sana y bien sostenida. Cada test la rompe por un sitio. */
function tarjeta(over: Partial<HealthCard> = {}): HealthCard {
  return healthCardSchema.parse({
    card_id: "H-1",
    capability: "retention",
    health_state: "healthy",
    trajectory: "stable",
    confidence: "medium",
    evidence: [
      positiva("repeat_rate", "Tasa de recompra a 90 dias estable en 31%"),
      positiva("email_revenue_share", "Email sostiene el 24% del revenue"),
    ],
    ...over,
  });
}

const reglas = (over: Partial<HealthCheckInput> = {}) =>
  checkHealthInvariants({ cards: [tarjeta()], ...over }).map((x) => x.rule);

test("una lectura sana y sostenida no dispara nada", () => {
  assert.deepEqual(reglas(), []);
});

test("§2: un KPI suelto no es la salud de una capacidad", () => {
  const r = reglas({
    cards: [
      tarjeta({
        health_state: "bad",
        evidence: [apoya("repeat_rate", "Recompra cae del 31% al 22%")],
      }),
    ],
  });
  assert.ok(r.includes("una_metrica_no_es_salud"));
});

test("§26: no ver anomalias no es estar sano", () => {
  const r = reglas({
    cards: [
      tarjeta({
        evidence: [apoya("repeat_rate", "Nada raro en la recompra")],
      }),
    ],
  });
  assert.ok(r.includes("evidencia_positiva"));
});

test("§28: degradar con evidencia en contra exige resolver la inconsistencia", () => {
  const r = reglas({
    cards: [
      tarjeta({
        health_state: "bad",
        evidence: [
          apoya("repeat_rate", "Recompra cae del 31% al 22%"),
          apoya("email_revenue_share", "Email baja al 14%"),
          healthEvidenceSchema.parse({
            relation: "contradicting",
            metric: "ltv_90d",
            observation: "El LTV a 90 dias sigue subiendo",
          }),
        ],
      }),
    ],
  });
  assert.ok(r.includes("contradiccion_resuelta"));
});

test("§28: resolverla por escrito satisface la regla", () => {
  const r = reglas({
    cards: [
      tarjeta({
        health_state: "bad",
        contradiction_resolution:
          "El LTV sube por una cohorte antigua; las nuevas se comportan peor",
        evidence: [
          apoya("repeat_rate", "Recompra cae del 31% al 22%"),
          apoya("email_revenue_share", "Email baja al 14%"),
          healthEvidenceSchema.parse({
            relation: "contradicting",
            metric: "ltv_90d",
            observation: "El LTV a 90 dias sigue subiendo",
          }),
        ],
      }),
    ],
  });
  assert.ok(!r.includes("contradiccion_resuelta"));
});

test("§45: D4 diagnostica salud, no perfeccion", () => {
  const r = reglas({
    cards: [
      tarjeta({
        health_state: "bad",
        evidence: [apoya("repeat_rate", "31%"), apoya("email_revenue_share", "24%")],
        findings: [
          healthFindingSchema.parse({
            kind: "opportunity",
            description: "Se podria segmentar la newsletter por cohorte",
            severity: "low",
          }),
          healthFindingSchema.parse({
            kind: "opportunity",
            description: "Falta un flow de reactivacion a 120 dias",
            severity: "info",
          }),
        ],
      }),
    ],
  });
  assert.ok(r.includes("oportunidad_no_es_enfermedad"));
});

test("§24: un riesgo a corto plazo sin indicadores adelantados es mirar por el retrovisor", () => {
  const r = reglas({
    cards: [
      tarjeta({
        near_term_risk: "high",
        risk_horizon: "30d",
        has_leading_signals: true,
        evidence: [
          positiva("repeat_rate", "31%"),
          apoya("churn_90d", "Churn medido al cierre del trimestre"),
        ],
      }),
    ],
  });
  assert.ok(r.includes("riesgo_adelantado_real"));
});

test("§24: con un indicador adelantado de verdad, el aviso se sostiene", () => {
  const r = reglas({
    cards: [
      tarjeta({
        near_term_risk: "high",
        risk_horizon: "30d",
        has_leading_signals: true,
        evidence: [
          positiva("repeat_rate", "31%"),
          apoya("email_engagement", "Aperturas cayendo 4 semanas seguidas", "leading"),
        ],
      }),
    ],
  });
  assert.ok(!r.includes("riesgo_adelantado_real"));
});

test("§38: un CAC sin economia detras no es bueno ni malo", () => {
  const r = reglas({
    cards: [
      tarjeta({
        capability: "acquisition",
        evidence: [positiva("cac", "CAC en 28 EUR"), positiva("roas", "ROAS 2,4")],
      }),
    ],
  });
  assert.ok(r.includes("adquisicion_exige_economia"));
});

test("§39: con el guardrail economico declarado, un CAC alto puede ser sano", () => {
  const r = reglas({
    cards: [
      tarjeta({
        capability: "acquisition",
        evidence: [
          positiva("cac", "CAC en 41 EUR, por debajo del sostenible de 55"),
          positiva("contribution_margin", "Contribucion por pedido de 62 EUR"),
        ],
      }),
    ],
    economicReferences: [
      { capability: "acquisition", reference_type: "economic_guardrail" as const },
    ],
  });
  assert.deepEqual(r, []);
});

test("§32: las ventas son el resultado, no la salud del canal", () => {
  const r = reglas({
    cards: [
      tarjeta({
        capability: "acquisition",
        health_state: "bad",
        evidence: [
          apoya("revenue", "Revenue -18% mes contra mes"),
          apoya("total_sales", "Ventas totales en minimos del trimestre"),
        ],
      }),
    ],
    economicReferences: [
      { capability: "acquisition", reference_type: "economic_guardrail" as const },
    ],
  });
  assert.ok(r.includes("revenue_no_degrada_adquisicion"));
});

// --- Agregacion: los dos errores simetricos --------------------------------

test("§17: un desastre local no se esconde detras de un padre sano", () => {
  const padre = tarjeta({ card_id: "H-padre" });
  const hijo = healthCardSchema.parse({
    card_id: "H-hijo",
    parent_card_id: "H-padre",
    capability: "retention",
    scope: "market_specific",
    health_state: "disaster",
    business_exposure: "high",
    state_justification: "Toda la base de Francia sin flows desde hace 6 semanas",
    impact_vector: ["revenue", "customer_experience"],
    confidence: "high",
    evidence: [apoya("flow_sends", "0 envios"), apoya("repeat_rate", "Recompra FR al 4%")],
  });
  const r = checkHealthInvariants({ cards: [padre, hijo] }).map((x) => x.rule);
  assert.ok(r.includes("desastre_local_no_se_oculta"));
});

test("§4: declarado, padre sano con hijo en desastre es una combinacion legitima", () => {
  const padre = tarjeta({
    card_id: "H-padre",
    contradiction_resolution: "Francia esta rota; el resto de mercados sostiene la capacidad",
  });
  const hijo = healthCardSchema.parse({
    card_id: "H-hijo",
    parent_card_id: "H-padre",
    capability: "retention",
    scope: "market_specific",
    health_state: "disaster",
    business_exposure: "high",
    state_justification: "Toda la base de Francia sin flows desde hace 6 semanas",
    impact_vector: ["revenue"],
    confidence: "high",
    evidence: [apoya("flow_sends", "0 envios"), apoya("repeat_rate", "Recompra FR al 4%")],
  });
  const r = checkHealthInvariants({ cards: [padre, hijo] }).map((x) => x.rule);
  assert.ok(!r.includes("desastre_local_no_se_oculta"));
});

test("§18: ni se degrada la capacidad entera por un segmento minusculo", () => {
  const padre = tarjeta({
    card_id: "H-padre",
    health_state: "bad",
    evidence: [apoya("repeat_rate", "31%"), apoya("email_revenue_share", "24%")],
  });
  const hijo = healthCardSchema.parse({
    card_id: "H-hijo",
    parent_card_id: "H-padre",
    capability: "retention",
    scope: "market_specific",
    health_state: "bad",
    business_exposure: "minimal",
    confidence: "medium",
    evidence: [apoya("repeat_rate", "Recompra PT al 9%")],
  });
  const r = checkHealthInvariants({ cards: [padre, hijo] }).map((x) => x.rule);
  assert.ok(r.includes("subsegmento_no_degrada_el_todo"));
});

test("§33: dos efectos del mismo origen no son dos problemas independientes", () => {
  const origen = tarjeta({
    card_id: "H-origen",
    capability: "inventory",
    health_state: "critical",
    issue_role: "primary_suspected",
    state_justification: "Rotura de stock en los cuatro productos que sostienen el catalogo",
    impact_vector: ["revenue", "operations"],
    evidence: [apoya("oos_rate", "38% del catalogo sin stock"), apoya("lead_time", "Proveedor a 9 semanas")],
  });
  const arrastrado = tarjeta({
    card_id: "H-arrastrado",
    capability: "conversion",
    health_state: "bad",
    issue_role: "primary_suspected",
    suspected_downstream_of: "H-origen",
    evidence: [apoya("cvr", "CVR -22%"), apoya("atc_rate", "ATC estable")],
  });
  const r = checkHealthInvariants({ cards: [origen, arrastrado] }).map((x) => x.rule);
  assert.ok(r.includes("downstream_no_cuenta_dos_veces"));
});

test("§14: D4 hereda la incertidumbre de D1", () => {
  const r = reglas({
    cards: [tarjeta({ confidence: "high" })],
    dataQuality: [
      dataQualityAssessmentSchema.parse({
        source: "klaviyo",
        dataset: "flows",
        phenomenon: "email_revenue",
        role: "primary",
        freshness: "fresh",
        reliability: "low",
        degradation_reasons: ["Solo vemos 2 de los 7 flows"],
      }),
    ],
  });
  assert.ok(r.includes("hereda_incertidumbre_de_d1"));
});

// --- Lo que tiene que seguir siendo POSIBLE ---------------------------------

test("§22: HEALTHY convive con riesgo estructural critico, y nada lo impide", () => {
  const c = healthCardSchema.parse({
    card_id: "H-2",
    capability: "technology",
    health_state: "healthy",
    structural_risk: "critical",
    trajectory: "stable",
    confidence: "high",
    evidence: [positiva("uptime", "99,98% el ultimo trimestre")],
  });
  assert.equal(c.health_state, "healthy");
  assert.equal(c.structural_risk, "critical");
  assert.deepEqual(checkHealthInvariants({ cards: [c] }), []);
});

// --- Invariantes del esquema -----------------------------------------------

test("§9: la ausencia de datos no se convierte en salud", () => {
  assert.throws(() =>
    healthCardSchema.parse({
      card_id: "H-3",
      capability: "inventory",
      health_state: "healthy",
      confidence: "insufficient_data",
    }),
  );
});

test("§21: no evaluable exige decir que falta", () => {
  assert.throws(() =>
    healthCardSchema.parse({
      card_id: "H-4",
      capability: "inventory",
      health_state: "not_assessable",
      confidence: "insufficient_data",
    }),
  );
});

test("§49: critical no es un adjetivo", () => {
  assert.throws(() =>
    healthCardSchema.parse({
      card_id: "H-5",
      capability: "operations",
      health_state: "critical",
      confidence: "high",
    }),
  );
});

test("§46: una oportunidad no se convierte en enfermedad subiendole la severidad", () => {
  assert.throws(() =>
    healthFindingSchema.parse({
      kind: "opportunity",
      description: "Se podria mejorar el copy de los emails",
      severity: "critical",
    }),
  );
});

// --- Lo estructural: los guardrails que se cumplen por ausencia -------------

test("§4, §5, §6, §7, §10: nada de lo que NO es salud tiene donde escribirse", () => {
  // STATE != CAUSE, HEALTH != PRIORITY, SEVERITY != HEALTH,
  // CURRENT_HEALTH != SCALING_READINESS, heatmap != reasoning.
  const campos = Object.keys(healthCardFields.shape);
  for (const prohibido of [
    "root_cause",
    "cause",
    "priority",
    "rank",
    "severity",
    "scaling_readiness",
    "ready_to_scale",
    "score",
    "health_score",
    "health_index",
  ]) {
    assert.ok(
      !campos.includes(prohibido),
      `"${prohibido}" no pertenece a la tarjeta de salud (D04 guardrails 4, 5, 6, 7, 10 y 21)`,
    );
  }
});

test("§13: la severidad vive en el hallazgo, no en la capacidad", () => {
  const deTarjeta = Object.keys(healthCardFields.shape);
  assert.ok(!deTarjeta.includes("severity"));
  // Y en el hallazgo es obligatoria: ahi si es donde se mide el dano.
  assert.throws(() =>
    healthFindingSchema.parse({ kind: "issue", description: "Algo pasa" }),
  );
});

// --- El motor ---------------------------------------------------------------

function senalSalud(
  overrides: Partial<SignalForHealth> = {},
): SignalForHealth {
  return {
    signal_id: "s1",
    capability: "acquisition",
    metric: "cac",
    direction: "up",
    trajectory: "deteriorating",
    guardrail_status: null,
    business_relevance: "medium",
    business_exposure: "moderate",
    is_leading_indicator: false,
    data_confidence: "high",
    window_start: "2026-09-01T00:00:00.000Z",
    window_end: "2026-09-07T00:00:00.000Z",
    description: "El CAC sube un 22% respecto a su propio historico.",
    ...overrides,
  };
}

test("D04: sin referencia declarada no se clasifica, y se dice que falta", () => {
  // Es el nucleo del motor. El guardrail 11 prohibe el umbral universal: sin que
  // alguien declare contra que se juzga el CAC en ESTA tienda, decir que la
  // adquisicion va mal es aplicar un numero de fuera.
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [],
    signals: [senalSalud()],
    symptoms: [],
    measuredMetrics: ["cac"],
  });

  assert.equal(tarjeta?.health_state, "not_assessable");
  assert.equal(tarjeta?.confidence, "insufficient_data");
  assert.match(tarjeta?.assessment_blocker ?? "", /guardrail economico declarado/);
  assert.match(tarjeta?.assessment_blocker ?? "", /acquisition/);
});

test("D04: no ver anomalias no es estar sano", () => {
  // Guardrail 9 y apartado 21, el error mas facil de cometer. Con referencia
  // declarada pero sin serie medida, la respuesta es "no lo se", no "va bien".
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [{ capability: "acquisition", metric: "cac", reference_type: "economic_guardrail" }],
    signals: [],
    symptoms: [],
    measuredMetrics: [],
  });

  assert.equal(tarjeta?.health_state, "not_assessable");
  assert.match(tarjeta?.assessment_blocker ?? "", /ninguna de sus metricas produjo serie/);
});

test("D04: medido, con referencia y sin salirse, si es healthy", () => {
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [{ capability: "acquisition", metric: "cac", reference_type: "economic_guardrail" }],
    signals: [],
    symptoms: [],
    measuredMetrics: ["cac"],
  });

  assert.equal(tarjeta?.health_state, "healthy");
  assert.equal(tarjeta?.assessment_blocker, null);
});

test("D04: el estado lo dicta el guardrail declarado, no un umbral de este motor", () => {
  const conReferencia = {
    capabilities: ["acquisition"],
    references: [
      { capability: "acquisition", metric: "cac", reference_type: "economic_guardrail" as const },
    ],
    symptoms: [],
    measuredMetrics: ["cac"],
  };

  const estados = (["within", "approaching", "breached", "crossed"] as const).map(
    (guardrail_status) =>
      assessHealth({
        ...conReferencia,
        signals: [senalSalud({ guardrail_status })],
      })[0]?.health_state,
  );

  assert.deepEqual(estados, ["healthy", "fragile", "bad", "critical"]);
});

test("D04: se queda con la peor de sus senales, no con la ultima", () => {
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [
      { capability: "acquisition", metric: "cac", reference_type: "economic_guardrail" },
    ],
    signals: [
      senalSalud({ signal_id: "a", guardrail_status: "within" }),
      senalSalud({ signal_id: "b", guardrail_status: "breached" }),
      senalSalud({ signal_id: "c", guardrail_status: "approaching" }),
    ],
    symptoms: [],
    measuredMetrics: ["cac"],
  });

  assert.equal(tarjeta?.health_state, "bad");
});

test("D04: critical exige justificacion e impacto, y los trae", () => {
  // Guardrails 48 a 50. El esquema los rechaza sin esto, asi que el motor los
  // escribe en vez de bajar el estado para esquivar el requisito.
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [
      { capability: "acquisition", metric: "cac", reference_type: "economic_guardrail" },
    ],
    signals: [senalSalud({ guardrail_status: "crossed" })],
    symptoms: [],
    measuredMetrics: ["cac"],
  });

  assert.equal(tarjeta?.health_state, "critical");
  assert.ok((tarjeta?.state_justification ?? "").length > 0);
  assert.deepEqual(tarjeta?.impact_vector, ["cac"]);
});

test("D04: un riesgo alto sin indicadores adelantados no se afirma", () => {
  // Guardrail 25: mirando solo los rezagados el aviso llega con el dano hecho,
  // asi que decir "riesgo alto" sin nada que mire adelante es insostenible.
  const sinAdelantados = nearTermRisk([
    senalSalud({ business_relevance: "critical", trajectory: "rapidly_deteriorating" }),
  ]);
  assert.equal(sinAdelantados.risk, "low");
  assert.equal(sinAdelantados.has_leading_signals, false);

  const conAdelantados = nearTermRisk([
    senalSalud({
      business_relevance: "critical",
      trajectory: "rapidly_deteriorating",
      is_leading_indicator: true,
    }),
  ]);
  assert.equal(conAdelantados.risk, "critical");
  assert.equal(conAdelantados.has_leading_signals, true);
});

test("D04: trayectorias opuestas dan volatile, no la media", () => {
  // Promediar una que mejora con otra que empeora inventa una calma que no
  // existe.
  assert.equal(combineTrajectories(["improving", "deteriorating"]), "volatile");
  assert.equal(combineTrajectories(["deteriorating", "stable"]), "deteriorating");
  assert.equal(combineTrajectories([null, null]), null);
  assert.equal(combineTrajectories(["stable"]), "stable");
});

test("D04: un sintoma positivo es oportunidad y no sube la severidad", () => {
  // Guardrail 46: una oportunidad no se convierte en enfermedad subiendole la
  // severidad. Si de verdad hace dano, es un `issue`.
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [],
    signals: [senalSalud({ business_relevance: "critical" })],
    symptoms: [
      {
        symptom_id: "x",
        capability: "acquisition",
        label: "Crecimiento de pedidos",
        valence: "positive",
        confidence: "medium",
        persistence: "emerging",
      },
    ],
    measuredMetrics: ["cac"],
  });

  const hallazgo = tarjeta?.findings[0];
  assert.equal(hallazgo?.kind, "opportunity");
  assert.equal(hallazgo?.severity, "info");
});

test("D04: la madurez se enlaza, nunca se copia como nivel", () => {
  // Apartado 16 de D03 y guardrail 16 de aqui: madurez y salud conviven, no se
  // mezclan. Y el riesgo estructural se queda en `none` porque no hay formula
  // declarada para derivarlo de la madurez.
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [],
    signals: [],
    symptoms: [],
    measuredMetrics: [],
    maturityProfileId: "perfil-1",
  });

  assert.equal(tarjeta?.maturity_profile_id, "perfil-1");
  assert.equal(tarjeta?.structural_risk, "none");
  assert.ok(!("maturity_level" in (tarjeta ?? {})));
});

test("D04: la tarjeta no tiene prioridad, causa ni nota", () => {
  // Diez de los cincuenta guardrails son `X != SALUD`. Se cumplen porque no hay
  // donde escribir X, y esto lo fija tambien para la salida del motor.
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [],
    signals: [],
    symptoms: [],
    measuredMetrics: [],
  });

  for (const prohibida of [
    "priority",
    "root_cause",
    "score",
    "health_index",
    "scaling_readiness",
    "severity",
  ]) {
    assert.ok(!(prohibida in (tarjeta ?? {})), `${prohibida} no puede existir aqui`);
  }
});

test("D04: una senal que contradice el estado se guarda como tal, no se tira", () => {
  // Guardrails 26, 27 y 28. Para resolver por escrito una inconsistencia primero
  // hay que guardarla: una senal que mejora dentro de una capacidad en mal
  // estado se marca contradictoria en vez de sumarse al monton.
  assert.equal(evidenceRelation("bad", "improving"), "contradicting");
  assert.equal(evidenceRelation("healthy", "deteriorating"), "contradicting");

  // Y lo que encaja se guarda con su signo: en una capacidad sana, una senal que
  // no empeora es evidencia positiva, no una queja mas.
  assert.equal(evidenceRelation("healthy", "stable"), "positive");
  assert.equal(evidenceRelation("bad", "deteriorating"), "supporting");
  assert.equal(evidenceRelation("not_assessable", null), "supporting");
});

test("D04: la evidencia dice si el indicador avisa o confirma", () => {
  // Guardrail 25. Confundirlos es prometer un aviso temprano que no existe.
  const [tarjeta] = assessHealth({
    capabilities: ["acquisition"],
    references: [],
    signals: [
      senalSalud({ signal_id: "a", is_leading_indicator: true }),
      senalSalud({ signal_id: "b", is_leading_indicator: false }),
    ],
    symptoms: [],
    measuredMetrics: [],
  });

  assert.deepEqual(
    tarjeta?.evidence.map((e) => e.indicator_type),
    ["leading", "lagging"],
  );
});
