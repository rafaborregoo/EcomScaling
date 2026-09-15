/**
 * FASE 3 / D01: la puerta de calidad de datos delante del diagnostico.
 *
 * Cada test reproduce un salto que un guardrail de D01 prohibe expresamente,
 * citando su numero. Sin estos tests, `checkDataQualityGate` puede dejar de
 * detectar una violacion y nadie se entera hasta que el copiloto explique como
 * problema de negocio lo que era un pixel roto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { diagnosticOutputSchema, type DiagnosticOutput } from "./diagnostics.js";
import {
  assessSource,
  checkDataQualityGate,
  classifyFreshness,
  classifyPeriodSettlement,
  CLIENT_ACTIONABLE_ISSUE_TYPES,
  deriveReliability,
  evaluateCoverage,
  isVisibleToClient,
  issuesFromIngestion,
  dataQualityAssessmentSchema,
  dataQualityIssueSchema,
  sourceReconciliationSchema,
  type DataQualityAssessment,
  type DataQualityGateInput,
  type DataQualityIssue,
  type IngestionFacts,
} from "./data-quality.js";

/** Caso concluido con datos solidos. Cada test le rompe el suelo por un sitio. */
function casoSano(): DiagnosticOutput {
  return diagnosticOutputSchema.parse({
    diagnostic_id: "DIAG-3001",
    scope: "acquisition",
    target_metric: "meta_spend_efficiency",
    target_question: "Por que ha subido el CAC un 30%?",
    status: "confirmed",
    finding: "problem",
    diagnosis_type: "performance",
    primary_issue: "Fatiga creativa en el conjunto principal",
    root_cause: "Frecuencia por encima de 4 en el 70% del gasto",
    severity: "high",
    confidence: "high",
  });
}

function fuenteSolida(over: Partial<DataQualityAssessment> = {}): DataQualityAssessment {
  return dataQualityAssessmentSchema.parse({
    source: "meta_ads",
    dataset: "insights",
    phenomenon: "spend",
    role: "primary",
    freshness: "fresh",
    coverage: 1,
    expected_observations: 30,
    period_settlement: "settled",
    reliability: "high",
    ...over,
  });
}

function issue(over: Partial<DataQualityIssue> = {}): DataQualityIssue {
  return dataQualityIssueSchema.parse({
    issue_type: "partial_sync",
    source: "meta_ads",
    description: "faltan 3 dias de insights",
    severity: "moderate",
    ...over,
  });
}

const gate = (over: Partial<DataQualityGateInput> = {}) =>
  checkDataQualityGate({
    diagnostic: casoSano(),
    assessments: [fuenteSolida()],
    issues: [],
    ...over,
  }).map((x) => x.rule);

test("un caso sostenido por datos solidos no dispara la puerta", () => {
  assert.deepEqual(gate(), []);
});

test("§36: no se concluye sobre una fuente cuyo fallo bloquea el diagnostico", () => {
  const reglas = gate({
    issues: [
      issue({
        issue_type: "permission_gap",
        material: true,
        downstream_effect: "blocked",
        severity: "critical",
      }),
    ],
    diagnostic: { ...casoSano(), data_gaps: [], limitations: ["falta acceso a Meta"] },
  });
  assert.ok(reglas.includes("bloqueo_respetado"));
});

test("§23: la confianza del diagnostico no puede superar la de su fuente", () => {
  const reglas = gate({
    assessments: [
      fuenteSolida({
        reliability: "low",
        degradation_reasons: ["cobertura 40% por rate limiting"],
        coverage: 0.4,
        missingness: "time_range",
      }),
    ],
  });
  assert.ok(reglas.includes("confianza_degradada"));
});

test("§23: bajar la confianza a medium desactiva la queja", () => {
  const reglas = gate({
    diagnostic: { ...casoSano(), confidence: "medium" },
    assessments: [
      fuenteSolida({
        reliability: "low",
        degradation_reasons: ["cobertura 40% por rate limiting"],
        coverage: 0.4,
        missingness: "time_range",
      }),
    ],
  });
  assert.ok(!reglas.includes("confianza_degradada"));
});

test("§34: no se afirma una causa de negocio con un fallo de datos material sin resolver", () => {
  const reglas = gate({
    issues: [issue({ issue_type: "tracking_regression", material: true, severity: "high" })],
  });
  assert.ok(reglas.includes("causa_tecnica_antes_que_negocio"));
});

test("§34: el mismo caso diagnosticado COMO problema de datos es legitimo", () => {
  const reglas = gate({
    diagnostic: {
      ...casoSano(),
      diagnosis_type: "data",
      root_cause: "Regresion del pixel tras el despliegue del martes",
    },
    issues: [issue({ issue_type: "tracking_regression", material: true, severity: "high" })],
  });
  assert.ok(!reglas.includes("causa_tecnica_antes_que_negocio"));
});

test("§34: un fallo real pero inmaterial no bloquea el diagnostico", () => {
  const reglas = gate({ issues: [issue({ material: false, severity: "low" })] });
  assert.deepEqual(reglas, []);
});

test("§37: saber que el dato falla y no declararlo deja al consultor a ciegas", () => {
  const reglas = gate({
    diagnostic: { ...casoSano(), confidence: "medium" },
    issues: [issue({ material: true, downstream_effect: "degraded" })],
  });
  assert.ok(reglas.includes("gap_declarado"));
});

test("§37: declarar el hueco satisface la regla", () => {
  const reglas = gate({
    diagnostic: {
      ...casoSano(),
      confidence: "medium",
      data_gaps: [
        {
          required_data: "insights de los 3 dias que faltan",
          reason: "Sin ellos no se puede fechar el inicio",
          impact_on_diagnosis: "high" as const,
          affected_hypothesis: null,
        },
      ],
    },
    issues: [issue({ material: true, downstream_effect: "degraded" })],
  });
  assert.ok(!reglas.includes("gap_declarado"));
});

test("§14: no ver el fenomeno no es haber comprobado que no existe", () => {
  const reglas = gate({
    diagnostic: {
      ...casoSano(),
      status: "inconclusive",
      finding: "healthy",
      confidence: "medium",
      limitations: ["sin acceso a Meta"],
    },
    issues: [
      issue({ issue_type: "permission_gap", material: true, severity: "high" }),
    ],
  });
  assert.ok(reglas.includes("permiso_no_es_ausencia"));
});

test("§28: divergencia entre fuentes sin clasificar no sostiene una causa de negocio", () => {
  const reglas = gate({
    reconciliations: [
      sourceReconciliationSchema.parse({
        phenomenon: "conversions",
        source_a: "shopify",
        source_b: "meta_ads",
        comparable: true,
        difference_relative: -0.42,
        status: "severe_variance",
      }),
    ],
  });
  assert.ok(reglas.includes("divergencia_sin_clasificar"));
});

test("§28: clasificada como discrepancia explicada, deja de bloquear", () => {
  const reglas = gate({
    reconciliations: [
      sourceReconciliationSchema.parse({
        phenomenon: "conversions",
        source_a: "shopify",
        source_b: "meta_ads",
        comparable: true,
        difference_relative: -0.42,
        status: "severe_variance",
        classification: "discrepancy",
        explanation: "Ventana de atribucion de 7 dias frente a pedido real",
      }),
    ],
  });
  assert.ok(!reglas.includes("divergencia_sin_clasificar"));
});

test("§18: un periodo sin cerrar no sostiene confianza alta", () => {
  const reglas = gate({
    assessments: [fuenteSolida({ period_settlement: "partially_settled" })],
  });
  assert.ok(reglas.includes("comparabilidad_temporal"));
});

test("§29: datos muestreados no producen conclusiones de alta precision", () => {
  const reglas = gate({ assessments: [fuenteSolida({ sampled: true })] });
  assert.ok(reglas.includes("evidencia_fragil"));
});

test("§30: muestra pequena declarada tampoco", () => {
  const reglas = gate({
    assessments: [
      fuenteSolida({
        evidence_fragility: "low_sample",
        reliability: "medium",
      }),
    ],
  });
  assert.ok(reglas.includes("evidencia_fragil"));
});

test("§10: una metrica cuya formula cambio no se compara con su historico", () => {
  const reglas = gate({
    metricDefinitionChanges: [
      {
        metric: "meta_spend_efficiency",
        changed_at: "2026-08-01T00:00:00Z",
        change_reason: "Se paso de ventana 7d-click a 1d-click",
      },
    ],
  });
  assert.ok(reglas.includes("definicion_estable"));
});

test("§10: el drift de OTRA metrica no contamina este caso", () => {
  const reglas = gate({
    metricDefinitionChanges: [
      {
        metric: "cac",
        changed_at: "2026-08-01T00:00:00Z",
        change_reason: "Ahora incluye shipping",
      },
    ],
  });
  assert.deepEqual(reglas, []);
});

test("§2: una fiabilidad degradada sin motivo escrito no es evaluable", () => {
  assert.throws(() =>
    dataQualityAssessmentSchema.parse({
      source: "ga4",
      dataset: "events",
      phenomenon: "traffic",
      freshness: "fresh",
      reliability: "low",
    }),
  );
});

test("§2: cobertura incompleta exige decir que tipo de ausencia es", () => {
  assert.throws(() =>
    dataQualityAssessmentSchema.parse({
      source: "ga4",
      dataset: "events",
      phenomenon: "traffic",
      freshness: "fresh",
      coverage: 0.6,
      reliability: "medium",
    }),
  );
});

test("§6: lo que no es comparable no se resta", () => {
  assert.throws(() =>
    sourceReconciliationSchema.parse({
      phenomenon: "revenue",
      source_a: "shopify",
      source_b: "meta_ads",
      comparable: false,
      non_comparability_reason: "attribution_overlap",
      status: "not_comparable",
      difference_relative: 0.3,
    }),
  );
});

test("§4: una discrepancia no se declara error sin decir cual", () => {
  assert.throws(() =>
    sourceReconciliationSchema.parse({
      phenomenon: "orders",
      source_a: "shopify",
      source_b: "ga4",
      comparable: true,
      status: "material_variance",
      classification: "error",
    }),
  );
});

test("§4: cerrar un issue sin explicar convierte una sospecha en veredicto", () => {
  assert.throws(() =>
    dataQualityIssueSchema.parse({
      issue_type: "schema_drift",
      source: "ga4",
      description: "campo renombrado",
      severity: "moderate",
      status: "false_positive",
    }),
  );
});

// --- Que ve el cliente (decision 2026-09-14) --------------------------------

test("el cliente ve un fallo suyo ya verificado", () => {
  const i = issue({
    issue_type: "permission_gap",
    status: "explained",
    explanation: "Confirmado: al token le falta ads_read",
    client_actionable: true,
  });
  assert.equal(isVisibleToClient(i), true);
});

test("no ve el mismo fallo mientras sigue sin verificar", () => {
  const i = issue({ issue_type: "permission_gap", client_actionable: true });
  assert.equal(i.status, "open");
  assert.equal(isVisibleToClient(i), false);
});

test("no ve un fallo que es nuestro, aunque este verificado", () => {
  const i = issue({
    issue_type: "rate_limited",
    status: "explained",
    explanation: "Backoff insuficiente en nuestra ingesta",
  });
  assert.equal(isVisibleToClient(i), false);
});

test("un fallo de nuestra tuberia no se puede marcar como suyo", () => {
  // Pedirle al cliente que arregle nuestros webhooks no es transparencia.
  assert.throws(() =>
    dataQualityIssueSchema.parse({
      issue_type: "webhook_failure",
      source: "shopify",
      description: "reintentos agotados",
      severity: "moderate",
      client_actionable: true,
    }),
  );
});

test("el catalogo de lo accionable por el cliente es el de la check constraint", () => {
  // Si estas dos listas se separan, la RLS deja pasar algo que la UI no pinta,
  // o al reves. Los valores estan en la migracion 20260914213000.
  assert.deepEqual([...CLIENT_ACTIONABLE_ISSUE_TYPES], [
    "permission_gap",
    "credential_expired",
    "consent_loss",
    "tracking_regression",
    "missing_events",
    "schema_drift",
    "contaminated_data",
  ]);
});

// ---------------------------------------------------------------------------
// EL MOTOR — `assessSource` y sus piezas
// ---------------------------------------------------------------------------
//
// El motor decide si una fuente aguanta. Si se equivoca hacia arriba, todo el
// diagnostico de aguas abajo hereda una confianza que el dato no tiene, y eso
// es exactamente lo que D01 existe para impedir. Cada test de aqui es una
// forma concreta de equivocarse hacia arriba.


const AHORA = "2026-09-25T12:00:00.000Z";
const VENTANA = {
  periodStart: "2026-09-18T00:00:00.000Z",
  periodEnd: "2026-09-25T00:00:00.000Z",
  now: AHORA,
};
/** Los siete dias de la ventana, todos presentes. */
const SIETE_DIAS = [
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
];

/** Fuente sana: conectada, recien sincronizada y con sus siete dias. */
function fuenteSana(): IngestionFacts {
  return {
    source: "shopify",
    dataset: "orders",
    phenomenon: "sales",
    connection_status: "connected",
    last_sync_at: "2026-09-25T11:30:00.000Z",
    recent_runs: [{ status: "succeeded", records_written: 120 }],
    observed_dates: SIETE_DIAS,
  };
}

/** Cadencia diaria con dos horas de margen, en la forma de `data_source_expectations`. */
const DIARIA = { expected_cadence_minutes: 1440, delay_tolerance_minutes: 120 };
/** La misma cadencia, en la forma que toman las funciones sueltas. */
const DIARIA_ARGS = { expectedCadenceMinutes: 1440, delayToleranceMinutes: 120 };

// --- Paso 2: freshness ------------------------------------------------------

test("D01 motor: sin cadencia esperada no existe la obsolescencia", () => {
  // Un dato de hace tres dias esta perfecto si la fuente es semanal. Inventar
  // un umbral seria degradar fuentes sanas.
  assert.equal(
    classifyFreshness({ lastSyncAt: "2026-09-22T12:00:00.000Z", now: AHORA }),
    "unknown",
  );
});

test("D01 motor: sin ultima carga la frescura es desconocida, no mala", () => {
  assert.equal(classifyFreshness({ lastSyncAt: null, now: AHORA, ...DIARIA_ARGS }), "unknown");
});

test("D01 motor: la frescura escala con la cadencia, no con un reloj fijo", () => {
  const f = (lastSyncAt: string) => classifyFreshness({ lastSyncAt, now: AHORA, ...DIARIA_ARGS });
  assert.equal(f("2026-09-25T11:00:00.000Z"), "fresh");
  assert.equal(f("2026-09-24T00:00:00.000Z"), "delayed");
  assert.equal(f("2026-09-22T00:00:00.000Z"), "stale");
  assert.equal(f("2026-09-15T00:00:00.000Z"), "severely_stale");
});

test("D01 motor: una fuente que dice venir del futuro no es fresquisima, es desconocida", () => {
  assert.equal(
    classifyFreshness({ lastSyncAt: "2026-09-26T00:00:00.000Z", now: AHORA, ...DIARIA_ARGS }),
    "unknown",
  );
});

// --- Paso 3: cobertura ------------------------------------------------------

test("D01 motor: la cobertura sale siempre con su denominador (guardrail 32)", () => {
  const c = evaluateCoverage({ observedDates: SIETE_DIAS, ...VENTANA });
  assert.equal(c.expected_observations, 7);
  assert.equal(c.available_observations, 7);
  assert.equal(c.coverage, 1);
  assert.equal(c.missingness, null);
});

test("D01 motor: dias sueltos son ausencia aleatoria; un tramo seguido es una ventana ciega", () => {
  const sueltos = evaluateCoverage({
    observedDates: SIETE_DIAS.filter((d) => d !== "2026-09-20"),
    ...VENTANA,
  });
  assert.equal(sueltos.missingness, "random");

  const tramo = evaluateCoverage({
    observedDates: SIETE_DIAS.filter((d) => !["2026-09-20", "2026-09-21"].includes(d)),
    ...VENTANA,
  });
  assert.equal(tramo.missingness, "time_range");
});

test("D01 motor: no tener nada no es un hueco, es no tener la fuente", () => {
  const c = evaluateCoverage({ observedDates: [], ...VENTANA });
  assert.equal(c.coverage, 0);
  assert.equal(c.missingness, "source");
});

// --- Paso 16: cierre temporal -----------------------------------------------

test("D01 motor: un periodo no esta cerrado por haber terminado", () => {
  const s = (now: string) => classifyPeriodSettlement({ periodEnd: VENTANA.periodEnd, now, ...DIARIA_ARGS });
  assert.equal(s("2026-09-24T12:00:00.000Z"), "open");
  assert.equal(s("2026-09-25T06:00:00.000Z"), "partially_settled");
  assert.equal(s("2026-09-26T12:00:00.000Z"), "settled");
});

test("D01 motor: sin cadencia no se puede afirmar el cierre (guardrail 18)", () => {
  assert.equal(
    classifyPeriodSettlement({ periodEnd: VENTANA.periodEnd, now: "2026-10-01T00:00:00.000Z" }),
    "unknown",
  );
});

// --- Paso 19: la nota -------------------------------------------------------

test("D01 motor: la fiabilidad nunca sube, solo baja", () => {
  const r = deriveReliability({ freshness: "stale", coverage: 1, issues: [] });
  assert.equal(r.reliability, "low");
  assert.ok(r.degradation_reasons.length > 0, "degradar exige motivo escrito");
});

test("D01 motor: un issue que bloquea deja el dato inutilizable, no solo tocado", () => {
  const r = deriveReliability({
    freshness: "fresh",
    coverage: 1,
    issues: [{ material: true, downstream_effect: "blocked", description: "credencial caducada" }],
  });
  assert.equal(r.reliability, "unusable");
  assert.ok(r.degradation_reasons.includes("credencial caducada"));
});

test("D01 motor: cero observaciones inutiliza la fuente por si solo", () => {
  // Suelta, sin ningun issue que la acompane. En `assessSource` esta regla
  // queda tapada porque la cobertura cero genera ademas un issue que bloquea;
  // aqui se prueba sola, que es la unica forma de que no pueda relajarse sin
  // que nadie se entere.
  const r = deriveReliability({ freshness: "fresh", coverage: 0, issues: [] });
  assert.equal(r.reliability, "unusable");
  assert.ok(r.degradation_reasons.length > 0);
});

test("D01 motor: la cobertura parcial gradua la fiabilidad, no la apaga", () => {
  const casi = deriveReliability({ freshness: "fresh", coverage: 0.97, issues: [] });
  const media = deriveReliability({ freshness: "fresh", coverage: 0.8, issues: [] });
  const poca = deriveReliability({ freshness: "fresh", coverage: 0.5, issues: [] });
  assert.equal(casi.reliability, "medium");
  assert.equal(media.reliability, "low");
  assert.equal(poca.reliability, "unusable");
});

test("D01 motor: dato impecable es el unico que llega a high y no arrastra motivos", () => {
  const r = deriveReliability({ freshness: "fresh", coverage: 1, issues: [] });
  assert.equal(r.reliability, "high");
  assert.deepEqual(r.degradation_reasons, []);
});

// --- Paso 11: salud de ingestion --------------------------------------------

test("D01 motor: una credencial caducada bloquea, y es del cliente", () => {
  const issues = issuesFromIngestion(
    { ...fuenteSana(), credential_expires_at: "2026-09-20T00:00:00.000Z" },
    VENTANA,
  );
  const credencial = issues.find((i) => i.issue_type === "credential_expired");
  assert.ok(credencial, "una credencial caducada tiene que producir issue");
  assert.equal(credencial!.downstream_effect, "blocked");
  assert.equal(credencial!.client_actionable, true);
});

test("D01 motor: un rate limit que se reintento y acabo bien no es material", () => {
  const issues = issuesFromIngestion(
    {
      ...fuenteSana(),
      recent_runs: [{ status: "succeeded", error_code: "429_rate_limit", records_written: 10 }],
    },
    VENTANA,
  );
  const limite = issues.find((i) => i.issue_type === "rate_limited");
  assert.ok(limite);
  assert.equal(limite!.material, false);
  assert.equal(limite!.downstream_effect, "none");
});

test("D01 motor: un sync que fallo escribiendo a medias es partial_sync, no caida", () => {
  const issues = issuesFromIngestion(
    { ...fuenteSana(), recent_runs: [{ status: "failed", records_written: 40 }] },
    VENTANA,
  );
  assert.ok(issues.some((i) => i.issue_type === "partial_sync"));
  assert.ok(!issues.some((i) => i.issue_type === "ingestion_degraded"));
});

test("D01 motor: una conexion verde que nunca sincronizo no es una fuente sana", () => {
  const issues = issuesFromIngestion(
    { ...fuenteSana(), connection_status: "connected", last_sync_at: null },
    VENTANA,
  );
  const nunca = issues.find((i) => i.issue_type === "ingestion_degraded");
  assert.ok(nunca, "conectada y sin sincronizar nunca tiene que dar issue");
  assert.equal(nunca!.downstream_effect, "blocked");
});

test("D01 motor: una conexion recien creada (pending) no se marca como rota", () => {
  const issues = issuesFromIngestion(
    { ...fuenteSana(), connection_status: "pending", last_sync_at: null },
    VENTANA,
  );
  assert.ok(!issues.some((i) => i.issue_type === "ingestion_degraded"));
});

// --- Todo junto -------------------------------------------------------------

test("D01 motor: una fuente sana pasa con fiabilidad alta y sin nada material", () => {
  // Un ciclo completo despues del cierre del periodo: es lo unico que permite
  // llamarlo `settled` sin inventarselo.
  const e = assessSource(
    { ...fuenteSana(), last_sync_at: "2026-09-26T01:30:00.000Z" },
    { ...VENTANA, now: "2026-09-26T02:30:00.000Z" },
    DIARIA,
  );
  assert.equal(e.reliability, "high");
  assert.equal(e.freshness, "fresh");
  assert.equal(e.coverage, 1);
  assert.equal(e.period_settlement, "settled");
  assert.deepEqual(e.issues.filter((i) => i.material), []);
});

test("D01 motor: faltar dias degrada la fuente y lo dice, no lo da por bueno", () => {
  const e = assessSource(
    { ...fuenteSana(), observed_dates: SIETE_DIAS.slice(0, 4) },
    VENTANA,
    DIARIA,
  );
  assert.ok(e.coverage != null && e.coverage < 1);
  assert.equal(e.missingness, "time_range");
  assert.notEqual(e.reliability, "high");
  assert.ok(e.degradation_reasons.length > 0);
  assert.ok(e.issues.some((i) => i.issue_type === "partial_sync" && i.material));
});

test("D01 motor: sin datos no se concluye 'no hay ventas', se bloquea (guardrail 14)", () => {
  const e = assessSource({ ...fuenteSana(), observed_dates: [] }, VENTANA, DIARIA);
  assert.equal(e.reliability, "unusable");
  assert.ok(
    e.issues.some((i) => i.downstream_effect === "blocked"),
    "cero observaciones tiene que bloquear el diagnostico, no rebajarlo",
  );
});

test("D01 motor: un periodo abierto se declara aunque no sea una averia (rama D)", () => {
  const e = assessSource(fuenteSana(), { ...VENTANA, now: "2026-09-24T12:00:00.000Z" }, DIARIA);
  assert.equal(e.period_settlement, "open");
  const aviso = e.issues.find((i) => i.issue_type === "partial_period");
  assert.ok(aviso, "un periodo abierto tiene que quedar declarado");
  assert.equal(aviso!.material, false);
});

test("D01 motor: la conexion revocada no produce una fuente 'fresca y vacia'", () => {
  const e = assessSource(
    { ...fuenteSana(), connection_status: "revoked", observed_dates: [] },
    VENTANA,
    DIARIA,
  );
  assert.equal(e.reliability, "unusable");
  assert.ok(e.issues.some((i) => i.issue_type === "credential_expired"));
});

// --- La guardia contra la deriva -------------------------------------------

test("D01 motor: todo lo que produce el motor lo acepta el contrato de D01", () => {
  // Esta es la guardia que impide que el motor escriba filas que la base
  // rechazaria: los dos esquemas son el espejo de las check constraints.
  const casos: IngestionFacts[] = [
    fuenteSana(),
    { ...fuenteSana(), observed_dates: SIETE_DIAS.slice(0, 2) },
    { ...fuenteSana(), observed_dates: [] },
    { ...fuenteSana(), connection_status: "revoked" },
    { ...fuenteSana(), missing_scopes: ["read_orders"] },
    { ...fuenteSana(), last_sync_at: "2026-08-01T00:00:00.000Z" },
    { ...fuenteSana(), failed_webhooks: 3 },
    { ...fuenteSana(), recent_runs: [{ status: "failed", records_written: 0, error_code: "500" }] },
  ];

  for (const facts of casos) {
    const e = assessSource(facts, VENTANA, DIARIA);
    dataQualityAssessmentSchema.parse({
      source: e.source,
      dataset: e.dataset,
      phenomenon: e.phenomenon,
      scope: e.scope,
      freshness: e.freshness,
      coverage: e.coverage,
      missingness: e.missingness,
      period_settlement: e.period_settlement,
      reliability: e.reliability,
      degradation_reasons: e.degradation_reasons,
    });
    for (const issue of e.issues) dataQualityIssueSchema.parse(issue);
  }
});

test("D01 motor: solo marca como del cliente lo que el cliente puede arreglar", () => {
  const e = assessSource(
    { ...fuenteSana(), missing_scopes: ["read_orders"], failed_webhooks: 2 },
    VENTANA,
    DIARIA,
  );
  for (const issue of e.issues.filter((i) => i.client_actionable)) {
    assert.ok(
      (CLIENT_ACTIONABLE_ISSUE_TYPES as readonly string[]).includes(issue.issue_type),
      `${issue.issue_type} no lo puede resolver el cliente y esta marcado como suyo`,
    );
  }
  // Un webhook que falla es tuberia nuestra: pedirselo a el es ruido.
  const webhook = e.issues.find((i) => i.issue_type === "webhook_failure");
  assert.ok(webhook);
  assert.equal(webhook!.client_actionable, false);
});
