/**
 * FASE 3 / D01 — Calidad y fiabilidad de los datos.
 *
 * Fuentes: conocimiento/fase-03/02-contratos-IA/d01-requisitos-contrato-calidad-datos.md
 *          conocimiento/fase-03/04-policies-guardrails/d01-guardrails-calidad-diagnostico.md
 *
 * D01 es la puerta que hay antes de D00: decide si el dato disponible aguanta
 * la interpretacion que se le quiere dar. Sin el, "las ventas han caido" y "el
 * pixel dejo de disparar" producen el mismo diagnostico.
 *
 * Los catalogos de aqui son los mismos que las check constraints de
 * `20260914160000_f3_d01_calidad_y_fiabilidad_de_datos.sql`. Estan duplicados a
 * proposito: la base protege lo que se escribe y esto protege lo que se razona
 * antes de escribir. Si cambia uno, cambian los dos.
 *
 * Los guardrails que caben en una fila son check constraints y no se repiten
 * aqui. `checkDataQualityGate` solo sostiene los que necesitan mirar el caso
 * diagnostico y la calidad del dato a la vez, que es justo lo que ninguna de
 * las dos tablas puede ver sola.
 */
import { z } from "zod";

import {
  type DiagnosticInvariantViolation,
  type DiagnosticOutput,
  type DiagnosticStatus,
} from "./diagnostics.js";

// --- Catalogos (contrato apartados 1, 2, 7, 13, 14) -------------------------

/** Contrato apartado 1. */
export const FRESHNESS_STATES = [
  "real_time",
  "fresh",
  "delayed",
  "stale",
  "severely_stale",
  "unknown",
] as const;

/** Contrato apartado 1. El tipo de ausencia importa: faltar dias sueltos no es faltar un mercado entero. */
export const MISSINGNESS_TYPES = [
  "random",
  "systematic",
  "time_range",
  "segment",
  "source",
] as const;

export const RELIABILITY_LEVELS = ["high", "medium", "low", "unusable"] as const;

/** Contrato apartado 2. */
export const SOURCE_ROLES = ["primary", "secondary", "validation", "derived"] as const;

/** Contrato apartado 2. */
export const RECONCILIATION_STATUSES = [
  "matched",
  "acceptable_variance",
  "material_variance",
  "severe_variance",
  "not_comparable",
] as const;

/** Contrato apartado 2: DATA_DISCREPANCY y DATA_ERROR no son lo mismo. */
export const RECONCILIATION_CLASSIFICATIONS = ["unknown", "discrepancy", "error"] as const;

/** Contrato apartado 14. */
export const PERIOD_SETTLEMENTS = ["open", "partially_settled", "settled", "unknown"] as const;

/** Contrato apartado 13. */
export const EVIDENCE_FRAGILITIES = [
  "low_sample",
  "high_variance",
  "insufficient_observations",
] as const;

/** Contrato apartado 7. */
export const DATA_GRANULARITIES = [
  "real_time",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "campaign",
  "adset",
  "ad",
  "product",
  "sku",
  "customer",
] as const;

/** Contrato apartados 4, 8, 12, 17. */
export const DATA_QUALITY_ISSUE_TYPES = [
  "permission_gap",
  "credential_expired",
  "rate_limited",
  "partial_sync",
  "webhook_failure",
  "duplicate_delivery",
  "ingestion_degraded",
  "schema_drift",
  "missing_events",
  "duplicate_events",
  "payload_error",
  "timestamp_error",
  "funnel_inconsistency",
  "tracking_regression",
  "definition_drift",
  "attribution_change",
  "modeled_conversions",
  "consent_loss",
  "historical_backfill",
  "late_arriving_data",
  "timezone_misalignment",
  "currency_unresolved",
  "partial_period",
  "contaminated_data",
  "sampling",
  "math_inconsistency",
] as const;

export const DATA_QUALITY_ISSUE_STATUSES = [
  "open",
  "investigating",
  "explained",
  "resolved",
  "false_positive",
] as const;

/** Contrato apartado 17: que le pasa al diagnostico de aguas abajo. */
export const DOWNSTREAM_EFFECTS = ["none", "degraded", "blocked"] as const;

/**
 * Los tipos de fallo que pueden ser del cliente, porque ocurren en algo suyo:
 * su cuenta de anuncios, sus credenciales, su web, su configuracion de
 * consentimiento, sus pedidos de prueba.
 *
 * Es un catalogo de lo POSIBLE, no de lo automatico: que un caso concreto sea
 * suyo lo declara quien escribe el issue (`client_actionable`). La misma
 * regresion de tracking puede estar en el tema de su tienda o en nuestro pixel.
 *
 * Espejo de la check constraint `data_quality_issues_accionable_por_cliente`.
 */
export const CLIENT_ACTIONABLE_ISSUE_TYPES = [
  "permission_gap",
  "credential_expired",
  "consent_loss",
  "tracking_regression",
  "missing_events",
  "schema_drift",
  "contaminated_data",
] as const;

/**
 * Lo que llega al panel del cliente: suyo **y ya verificado**. Un issue recien
 * detectado sigue en `open`, y avisar de una averia que no lo era erosiona la
 * confianza mas rapido que el fallo original.
 *
 * Espejo de la politica RLS `data_quality_issues_select_cliente`. Si cambia
 * una, cambia la otra: esto decide que se pinta, aquella que se puede leer.
 */
export function isVisibleToClient(issue: DataQualityIssue): boolean {
  return issue.client_actionable && CLIENT_VISIBLE_STATUSES.includes(issue.status as (typeof CLIENT_VISIBLE_STATUSES)[number]);
}

/**
 * Verificado y todavía vigente. `open` es una sospecha sin verificar;
 * `resolved` y `false_positive` ya no son un problema: enseñarlos como «necesita
 * tu mano» hacía que un aviso de septiembre siguiera saliendo semanas después de
 * reconectar.
 */
export const CLIENT_VISIBLE_STATUSES = ["investigating", "explained"] as const;

export type FreshnessState = (typeof FRESHNESS_STATES)[number];
export type ReliabilityLevel = (typeof RELIABILITY_LEVELS)[number];
export type SourceRole = (typeof SOURCE_ROLES)[number];
export type DataQualityIssueType = (typeof DATA_QUALITY_ISSUE_TYPES)[number];
export type DownstreamEffect = (typeof DOWNSTREAM_EFFECTS)[number];

// --- Esquemas ---------------------------------------------------------------

export const dataQualityAssessmentSchema = z
  .object({
    source: z.string().min(1),
    dataset: z.string().min(1),
    phenomenon: z.string().min(1),
    scope: z.string().default("global"),

    /** Para que se miro esta fuente en el caso que se esta evaluando. */
    role: z.enum(["primary", "validation", "context"]).default("primary"),

    freshness: z.enum(FRESHNESS_STATES),
    coverage: z.number().min(0).max(1).nullable().optional(),
    missingness: z.enum(MISSINGNESS_TYPES).nullable().optional(),

    period_settlement: z.enum(PERIOD_SETTLEMENTS).default("unknown"),
    granularity_available: z.enum(DATA_GRANULARITIES).nullable().optional(),
    granularity_required: z.enum(DATA_GRANULARITIES).nullable().optional(),
    granularity_sufficient: z.boolean().nullable().optional(),

    sampled: z.boolean().default(false),
    evidence_fragility: z.enum(EVIDENCE_FRAGILITIES).nullable().optional(),

    reliability: z.enum(RELIABILITY_LEVELS),
    degradation_reasons: z.array(z.string()).default([]),
  })
  // Mismo invariante que la check constraint homonima: degradar sin motivo
  // escrito no es evaluar, es opinar.
  .refine(
    (a) => !["low", "unusable"].includes(a.reliability) || a.degradation_reasons.length > 0,
    { message: "una fiabilidad low o unusable exige degradation_reasons" },
  )
  // Guardrail 2: si falta dato, hay que decir que tipo de ausencia es.
  .refine((a) => a.coverage == null || a.coverage >= 1 || a.missingness != null, {
    message: "coverage incompleto exige declarar missingness",
  });

export const dataQualityIssueSchema = z
  .object({
    issue_type: z.enum(DATA_QUALITY_ISSUE_TYPES),
    source: z.string().min(1),
    phenomenon: z.string().nullable().optional(),
    description: z.string().min(1),
    severity: z.enum(["info", "low", "moderate", "high", "critical"]),
    /** Si cambia la interpretacion. Un fallo real pero inmaterial no bloquea nada. */
    material: z.boolean().default(false),
    status: z.enum(DATA_QUALITY_ISSUE_STATUSES).default("open"),
    downstream_effect: z.enum(DOWNSTREAM_EFFECTS).default("none"),
    explanation: z.string().nullable().optional(),
    /**
     * Si el fallo vive en los sistemas del cliente y solo el puede resolverlo:
     * dar un permiso en su cuenta de anuncios, reconectar una credencial,
     * confirmar que esos pedidos eran pruebas suyas. Decision 2026-09-14.
     */
    client_actionable: z.boolean().default(false),
  })
  // Mismo catalogo que la check constraint `data_quality_issues_accionable_por
  // _cliente`: lo que no esta en la lista es nuestro, y pedirle al cliente que
  // arregle nuestra tuberia no es transparencia, es ruido.
  .refine(
    (i) =>
      !i.client_actionable ||
      (CLIENT_ACTIONABLE_ISSUE_TYPES as readonly string[]).includes(i.issue_type),
    { message: "ese tipo de fallo no lo puede resolver el cliente" },
  )
  // Guardrail 4: cerrar un issue sin escribir por que convierte una sospecha
  // en veredicto.
  .refine(
    (i) =>
      !["explained", "resolved", "false_positive"].includes(i.status) || i.explanation != null,
    { message: "cerrar un issue exige explanation" },
  );

export const sourceReconciliationSchema = z
  .object({
    phenomenon: z.string().min(1),
    source_a: z.string().min(1),
    source_b: z.string().min(1),
    comparable: z.boolean(),
    non_comparability_reason: z.string().nullable().optional(),
    difference_relative: z.number().nullable().optional(),
    status: z.enum(RECONCILIATION_STATUSES),
    classification: z.enum(RECONCILIATION_CLASSIFICATIONS).default("unknown"),
    explanation: z.string().nullable().optional(),
  })
  .refine((r) => (r.status === "not_comparable") === (r.comparable === false), {
    message: "status not_comparable y comparable dicen lo mismo y deben coincidir",
  })
  // Guardrail 6: lo que no es comparable no se resta.
  .refine((r) => r.comparable || r.difference_relative == null, {
    message: "no se calcula diferencia entre fuentes no comparables",
  })
  // Guardrail 4: una discrepancia no es un error hasta que alguien dice cual.
  .refine((r) => r.classification !== "error" || r.explanation != null, {
    message: "declarar error exige explanation",
  });

/** Contrato apartado 3: METRIC_DEFINITION_DRIFT. */
export const metricDefinitionChangeSchema = z.object({
  metric: z.string().min(1),
  changed_at: z.string().min(1),
  change_reason: z.string().min(1),
});

export type DataQualityAssessment = z.infer<typeof dataQualityAssessmentSchema>;
export type DataQualityIssue = z.infer<typeof dataQualityIssueSchema>;
export type SourceReconciliation = z.infer<typeof sourceReconciliationSchema>;
export type MetricDefinitionChange = z.infer<typeof metricDefinitionChangeSchema>;

/**
 * Lo que hace falta para decidir si un caso puede sostenerse.
 *
 * Quien llama ya ha acotado las evaluaciones, los issues y las reconciliaciones
 * al fenomeno y periodo del caso: la puerta no vuelve a filtrar por scope
 * porque eso exigiria reimplementar aqui el modelo de segmentos, y hacerlo dos
 * veces es garantizar que un dia digan cosas distintas.
 */
export type DataQualityGateInput = {
  diagnostic: DiagnosticOutput;
  assessments: DataQualityAssessment[];
  issues: DataQualityIssue[];
  reconciliations?: SourceReconciliation[];
  metricDefinitionChanges?: MetricDefinitionChange[];
};

// --- La puerta --------------------------------------------------------------

const CONCLUDED: readonly DiagnosticStatus[] = ["confirmed", "partially_confirmed"];
const ABIERTO: readonly DataQualityIssue["status"][] = ["open", "investigating"];

const concluye = (d: DiagnosticOutput) => CONCLUDED.includes(d.status);
const afirmaCausaDeNegocio = (d: DiagnosticOutput) =>
  concluye(d) && d.diagnosis_type !== "data";
const declaraAlgo = (d: DiagnosticOutput) =>
  d.data_gaps.length > 0 || d.limitations.length > 0;

/**
 * Comprueba que un diagnostico no afirma mas de lo que su dato sostiene.
 *
 * Devuelve las violaciones en vez de lanzar, igual que
 * `checkDiagnosticInvariants`: el runtime se niega a persistir la conclusion,
 * una evaluacion de agente las cuenta y sigue.
 *
 * Lo que NO esta aqui, por honestidad y no por olvido:
 *
 * - Guardrails 5, 25 y 26 (no sumar atribucion entre plataformas) los sostiene
 *   ADR-0021 en la capa de integraciones, que es donde se construyen las
 *   cifras. Repetirlos aqui daria por comprobado algo que en realidad depende
 *   de como se agrego el dato tres capas mas abajo.
 * - Guardrail 15 (descartar duplicacion, backfill o schema drift antes de leer
 *   un spike como cambio de negocio) necesita la serie temporal, no la
 *   estructura del caso: es trabajo del motor de senales (D05).
 * - Guardrail 7 (preferir source of truth y corroboracion independiente) es un
 *   criterio de diseno de la jerarquia de fuentes, no una comprobacion.
 */
export function checkDataQualityGate(
  input: DataQualityGateInput,
): DiagnosticInvariantViolation[] {
  const { diagnostic, assessments, issues } = input;
  const reconciliations = input.reconciliations ?? [];
  const cambiosDeDefinicion = input.metricDefinitionChanges ?? [];

  const v: DiagnosticInvariantViolation[] = [];
  const push = (rule: string, source: string, message: string) =>
    v.push({ rule, source, message });

  const abiertos = issues.filter((i) => ABIERTO.includes(i.status));
  const bloqueantes = abiertos.filter((i) => i.downstream_effect === "blocked");
  const degradantes = abiertos.filter((i) => i.downstream_effect === "degraded");
  const materiales = abiertos.filter((i) => i.material);
  const primarias = assessments.filter((a) => a.role === "primary");
  const confianzaAlta = diagnostic.confidence === "high";

  // Guardrail 36 -- si la fuente necesaria falla de forma material, el
  // diagnostico de aguas abajo queda bloqueado. Concluir igualmente es
  // convertir un fallo tecnico conocido en una afirmacion sobre el negocio.
  if (bloqueantes.length > 0 && concluye(diagnostic)) {
    push(
      "bloqueo_respetado",
      "D01 guardrail 36",
      `el caso concluye con ${bloqueantes.length} fallo(s) de datos que bloquean el diagnostico: ${bloqueantes
        .map((i) => i.issue_type)
        .join(", ")}`,
    );
  }

  // Guardrails 23 y 35 -- una salida no recibe fiabilidad alta si una
  // dependencia critica la tiene baja. La confianza del diagnostico no puede
  // superar la del peor dato que lo sostiene.
  const primariasDebiles = primarias.filter((a) =>
    ["low", "unusable"].includes(a.reliability),
  );
  if (confianzaAlta && (primariasDebiles.length > 0 || degradantes.length > 0)) {
    push(
      "confianza_degradada",
      "D01 guardrails 23 y 35",
      "confianza alta sobre datos degradados: la confianza del diagnostico no puede superar la de la fuente que lo sostiene",
    );
  }

  // Guardrail 34 -- no forzar una causa empresarial cuando hay un problema de
  // datos material sin resolver. Es la rama A del runtime: si el tracking cae
  // y el negocio no, el diagnostico es del tracking.
  if (materiales.length > 0 && afirmaCausaDeNegocio(diagnostic)) {
    push(
      "causa_tecnica_antes_que_negocio",
      "D01 guardrail 34",
      `se afirma una causa de negocio con ${materiales.length} problema(s) de datos material(es) sin resolver: ${materiales
        .map((i) => i.issue_type)
        .join(", ")}`,
    );
  }

  // Guardrail 37 -- declarar el data_gap que impide confirmar. Saber que el
  // dato falla y no decirlo deja al consultor defendiendo una conclusion cuyo
  // punto debil solo conoce el sistema.
  if ((bloqueantes.length > 0 || degradantes.length > 0) && !declaraAlgo(diagnostic)) {
    push(
      "gap_declarado",
      "D01 guardrail 37",
      "hay fallos de datos que afectan al diagnostico y el caso no declara ningun data_gap ni limitacion",
    );
  }

  // Guardrail 14 -- ausencia de datos no es ausencia del fenomeno. Si no se
  // puede ver el gasto de Meta, no se puede concluir que Meta esta sano.
  const sinPermiso = abiertos.filter((i) => i.issue_type === "permission_gap");
  if (
    sinPermiso.length > 0 &&
    diagnostic.finding != null &&
    ["healthy", "strength"].includes(diagnostic.finding)
  ) {
    push(
      "permiso_no_es_ausencia",
      "D01 guardrail 14",
      "se concluye que no hay problema sobre una fuente a la que faltan permisos: no ver el fenomeno no es comprobar que no existe",
    );
  }

  // Guardrail 28 -- cuando backend y plataformas divergen, se investiga
  // atribucion y tracking ANTES de declarar deterioro del negocio.
  const divergenciasSinClasificar = reconciliations.filter(
    (r) =>
      ["material_variance", "severe_variance"].includes(r.status) &&
      r.classification === "unknown",
  );
  if (divergenciasSinClasificar.length > 0 && afirmaCausaDeNegocio(diagnostic)) {
    push(
      "divergencia_sin_clasificar",
      "D01 guardrails 4 y 28",
      `se afirma una causa de negocio con ${divergenciasSinClasificar.length} divergencia(s) entre fuentes todavia sin clasificar como discrepancia o error`,
    );
  }

  // Guardrails 18 y 19 -- un periodo abierto o a medio liquidar no sostiene
  // una conclusion de maxima confianza: los datos tardios aun pueden moverlo.
  const periodoAbierto = primarias.filter((a) =>
    ["open", "partially_settled"].includes(a.period_settlement),
  );
  if (confianzaAlta && periodoAbierto.length > 0) {
    push(
      "comparabilidad_temporal",
      "D01 guardrails 18 y 19",
      "confianza alta sobre un periodo que todavia no esta cerrado",
    );
  }

  // Guardrails 29, 30 y 31 -- evidencia muestreada o fragil no produce
  // conclusiones de alta precision.
  const fragiles = primarias.filter((a) => a.sampled || a.evidence_fragility != null);
  if (confianzaAlta && fragiles.length > 0) {
    push(
      "evidencia_fragil",
      "D01 guardrails 29, 30 y 31",
      "confianza alta sobre datos muestreados o con fragilidad estadistica declarada",
    );
  }

  // Guardrail 10 -- una metrica cuya formula cambio no se compara con su
  // historico como si fuera constante. O el caso trata el cambio como lo que
  // es (un asunto de datos), o no puede concluir con maxima confianza.
  const drift = cambiosDeDefinicion.filter((c) => c.metric === diagnostic.target_metric);
  if (drift.length > 0 && confianzaAlta && diagnostic.diagnosis_type !== "data") {
    push(
      "definicion_estable",
      "D01 guardrail 10",
      `la definicion de "${diagnostic.target_metric}" cambio dentro del periodo analizado: la comparacion historica no sostiene confianza alta`,
    );
  }

  return v;
}

// ---------------------------------------------------------------------------
// EL MOTOR — evaluar una fuente (runtime `d01-flujo-evaluacion-calidad-datos`)
// ---------------------------------------------------------------------------
//
// Todo lo de aqui es puro: entran hechos de ingesta y sale una evaluacion con
// sus issues. La parte sucia --leer Supabase, escribir las dos tablas-- vive en
// `apps/api/src/data-quality-engine.ts`, igual que `detectSignals` y el motor
// de senales de D05.
//
// QUE PASOS DEL RUNTIME CUBRE, de los 19:
//
//   paso 2  freshness contra la cadencia esperada
//   paso 3  completeness, coverage y tipo de ausencia
//   paso 11 salud de ingestion (permisos, credenciales, syncs, webhooks)
//   paso 16 cierre temporal del periodo
//   paso 19 emitir el resultado con sus motivos
//
// QUE NO CUBRE, y se anota en vez de fingirse: los pasos 4, 5, 6 y 17
// (source of truth, reconciliacion, consistencia semantica, cross-validation)
// necesitan **dos fuentes comparables sobre el mismo fenomeno**, y hoy solo
// Shopify tiene serie diaria; 7 y 8 (schema drift, checks matematicos) exigen
// el evento crudo, que no llega hasta aqui; 12 (lineage), 13 (atribucion), 14
// (limpieza de no representativos) y 18 (ponderacion) dependen de piezas que
// todavia no existen. Cuando Meta y Klaviyo tengan su serie diaria, los pasos
// 4 a 6 y 17 dejan de estar bloqueados y `data_source_reconciliations` --que ya
// tiene tabla y contrato-- empieza a llenarse.

/** Multiplos de la cadencia tolerada a partir de los cuales cambia el estado. */
const FRESCURA_RATIOS = { delayed: 1, stale: 2, severely_stale: 6 } as const;

/** Por debajo de esta cadencia, una fuente al dia se considera tiempo real. */
const CADENCIA_TIEMPO_REAL_MINUTOS = 15;

const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;

function minutosEntre(desde: string, hasta: string): number {
  return (Date.parse(hasta) - Date.parse(desde)) / MINUTO;
}

/** Dia UTC en `YYYY-MM-DD`. La fuente puede estar en otro huso; eso es el paso 9. */
function diaUtc(instante: number): string {
  return new Date(instante).toISOString().slice(0, 10);
}

/**
 * Paso 2 — freshness contra la cadencia esperada.
 *
 * Sin cadencia esperada no hay obsolescencia: un dato de hace tres dias esta
 * perfecto si la fuente se actualiza semanalmente. Por eso la ausencia de
 * expectativa devuelve `unknown` y no un estado inventado.
 */
export function classifyFreshness(input: {
  lastSyncAt: string | null | undefined;
  now: string;
  expectedCadenceMinutes?: number | null;
  delayToleranceMinutes?: number | null;
}): FreshnessState {
  const { lastSyncAt, now, expectedCadenceMinutes } = input;
  if (!lastSyncAt || !expectedCadenceMinutes || expectedCadenceMinutes <= 0) return "unknown";

  const tolerado = expectedCadenceMinutes + (input.delayToleranceMinutes ?? 0);
  const edad = minutosEntre(lastSyncAt, now);
  // Un reloj desfasado puede dar edad negativa. No es frescura perfecta, es una
  // fuente que dice venir del futuro: mejor no saber que afirmar de mas.
  if (edad < 0) return "unknown";

  const ratio = edad / tolerado;
  if (ratio > FRESCURA_RATIOS.severely_stale) return "severely_stale";
  if (ratio > FRESCURA_RATIOS.stale) return "stale";
  if (ratio > FRESCURA_RATIOS.delayed) return "delayed";
  return expectedCadenceMinutes <= CADENCIA_TIEMPO_REAL_MINUTOS ? "real_time" : "fresh";
}

export type CoverageResult = {
  expected_observations: number;
  available_observations: number;
  coverage: number;
  missingness: (typeof MISSINGNESS_TYPES)[number] | null;
};

/**
 * Paso 3 — cobertura con denominador, y que TIPO de ausencia es.
 *
 * El guardrail 32 prohibe una cobertura sin denominador y el 2 prohibe tratar
 * lo incompleto como completo, asi que aqui salen siempre los tres numeros
 * juntos. El tipo de ausencia importa: faltar dias sueltos es ruido, faltar un
 * tramo seguido es una ventana ciega, y no tener nada es no tener la fuente.
 *
 * Solo sabe de huecos en el tiempo. `segment` y `systematic` exigen ver el
 * dato por segmento, que es justo lo que hoy no llega hasta aqui.
 */
export function evaluateCoverage(input: {
  observedDates: string[];
  periodStart: string;
  periodEnd: string;
}): CoverageResult {
  const inicio = Date.parse(input.periodStart);
  const fin = Date.parse(input.periodEnd);
  const esperadas = Math.max(0, Math.round((fin - inicio) / DIA));

  const esperados: string[] = [];
  for (let i = 0; i < esperadas; i += 1) esperados.push(diaUtc(inicio + i * DIA));

  const vistos = new Set(input.observedDates.map((d) => d.slice(0, 10)));
  const presentes = esperados.filter((d) => vistos.has(d));
  const disponibles = presentes.length;

  if (esperadas === 0) {
    return {
      expected_observations: 0,
      available_observations: disponibles,
      coverage: 1,
      missingness: null,
    };
  }

  const coverage = disponibles / esperadas;
  return {
    expected_observations: esperadas,
    available_observations: disponibles,
    coverage,
    missingness: clasificarAusencia(esperados, vistos),
  };
}

function clasificarAusencia(
  esperados: string[],
  vistos: Set<string>,
): (typeof MISSINGNESS_TYPES)[number] | null {
  const faltan = esperados.filter((d) => !vistos.has(d));
  if (faltan.length === 0) return null;
  // Nada de nada no es un hueco: es que la fuente no esta.
  if (faltan.length === esperados.length) return "source";

  let rachaMaxima = 0;
  let racha = 0;
  for (const dia of esperados) {
    racha = vistos.has(dia) ? 0 : racha + 1;
    rachaMaxima = Math.max(rachaMaxima, racha);
  }
  return rachaMaxima >= 2 ? "time_range" : "random";
}

/**
 * Paso 16 — cierre temporal.
 *
 * Un periodo no esta cerrado por haber terminado, sino cuando ha pasado al
 * menos una actualizacion completa despues de su final: hasta entonces pueden
 * seguir llegando datos tardios. Sin cadencia esperada no se puede afirmar el
 * cierre, y decir `settled` sin saberlo es justo lo que rompe el guardrail 18.
 */
export function classifyPeriodSettlement(input: {
  periodEnd: string;
  now: string;
  expectedCadenceMinutes?: number | null;
  delayToleranceMinutes?: number | null;
}): (typeof PERIOD_SETTLEMENTS)[number] {
  const transcurrido = minutosEntre(input.periodEnd, input.now);
  if (transcurrido <= 0) return "open";
  if (!input.expectedCadenceMinutes || input.expectedCadenceMinutes <= 0) return "unknown";

  const cicloCompleto = input.expectedCadenceMinutes + (input.delayToleranceMinutes ?? 0);
  return transcurrido >= cicloCompleto ? "settled" : "partially_settled";
}

/** Lo que el motor sabe de una fuente al evaluarla (paso 1). */
export type IngestionFacts = {
  source: string;
  dataset: string;
  phenomenon: string;
  scope?: string;
  /** `integration_connections.status`. */
  connection_status?: string | null;
  last_sync_at?: string | null;
  last_error_message?: string | null;
  credential_expires_at?: string | null;
  /** Permisos que la integracion necesita para este dataset y no tiene. */
  missing_scopes?: string[];
  recent_runs?: {
    status: string;
    sync_type?: string | null;
    records_written?: number | null;
    records_failed?: number | null;
    error_code?: string | null;
    finished_at?: string | null;
  }[];
  failed_webhooks?: number;
  /** Duplicados que la huella ya descarto: sanidad, no averia. */
  ignored_duplicate_webhooks?: number;
  /** Dias con dato dentro del periodo. */
  observed_dates?: string[];
};

export type SourceExpectation = {
  source_role?: SourceRole;
  expected_cadence_minutes?: number | null;
  delay_tolerance_minutes?: number | null;
};

export type AssessmentWindow = { periodStart: string; periodEnd: string; now: string };

/** Lo que el motor produce por fuente: una evaluacion y los issues que la explican. */
export type EvaluatedSource = {
  source: string;
  dataset: string;
  phenomenon: string;
  scope: string;
  period_start: string;
  period_end: string;
  last_sync_at: string | null;
  expected_cadence_minutes: number | null;
  freshness: FreshnessState;
  period_settlement: (typeof PERIOD_SETTLEMENTS)[number];
  expected_observations: number | null;
  available_observations: number | null;
  coverage: number | null;
  missingness: (typeof MISSINGNESS_TYPES)[number] | null;
  reliability: ReliabilityLevel;
  degradation_reasons: string[];
  issues: (DataQualityIssue & { dataset: string; scope: string })[];
};

type IssueBorrador = Omit<DataQualityIssue, "explanation"> & { dataset: string; scope: string };

/**
 * Paso 11 — salud de ingestion.
 *
 * "Una respuesta HTTP correcta no finaliza la validacion si la cobertura real
 * de datos es incompleta": por eso esto no mira si la ultima llamada fue 200,
 * mira credenciales, permisos, ejecuciones y webhooks.
 *
 * El criterio de `material` es uno solo: si puede mover las cifras de la
 * ventana que se esta analizando. Un rate limit que se reintento y acabo bien
 * es verdad y es irrelevante, y marcarlo como material convertiria el panel en
 * una alarma permanente.
 */
export function issuesFromIngestion(
  facts: IngestionFacts,
  window: AssessmentWindow,
): IssueBorrador[] {
  const scope = facts.scope ?? "global";
  const comun = { source: facts.source, dataset: facts.dataset, phenomenon: facts.phenomenon, scope };
  const issues: IssueBorrador[] = [];

  const credencialCaducada =
    facts.credential_expires_at != null &&
    Date.parse(facts.credential_expires_at) <= Date.parse(window.now);
  const conexionCaida = ["revoked", "disconnected"].includes(facts.connection_status ?? "");

  if (credencialCaducada || conexionCaida) {
    issues.push({
      ...comun,
      issue_type: "credential_expired",
      description: conexionCaida
        ? `La conexion con ${facts.source} esta ${facts.connection_status}: no entra dato nuevo.`
        : `La credencial de ${facts.source} caduco el ${facts.credential_expires_at}.`,
      severity: "critical",
      material: true,
      status: "open",
      downstream_effect: "blocked",
      // Reconectar es suyo: la credencial vive en su cuenta, no en la nuestra.
      client_actionable: true,
    });
  }

  if ((facts.missing_scopes ?? []).length > 0) {
    issues.push({
      ...comun,
      issue_type: "permission_gap",
      description: `Faltan permisos en ${facts.source} para ${facts.dataset}: ${(facts.missing_scopes ?? []).join(", ")}. No ver el fenomeno no es comprobar que no existe.`,
      severity: "high",
      material: true,
      downstream_effect: "degraded",
      status: "open",
      client_actionable: true,
    });
  }

  // Conectada y sin una sola sincronizacion. El estado dice "connected" y el
  // panel de integraciones la pinta en verde, pero no ha traido un solo dato:
  // es la forma mas silenciosa de no tener una fuente.
  if (facts.connection_status === "connected" && facts.last_sync_at == null) {
    issues.push({
      ...comun,
      issue_type: "ingestion_degraded",
      description: `La conexion con ${facts.source} figura activa pero no ha sincronizado nunca: no hay dato que evaluar.`,
      severity: "high",
      material: true,
      downstream_effect: "blocked",
      status: "open",
      client_actionable: false,
    });
  }

  const runs = facts.recent_runs ?? [];
  const fallidos = runs.filter((r) => r.status === "failed");
  if (fallidos.length > 0) {
    const escribioAlgo = fallidos.some((r) => (r.records_written ?? 0) > 0);
    issues.push({
      ...comun,
      issue_type: escribioAlgo ? "partial_sync" : "ingestion_degraded",
      description: escribioAlgo
        ? `${fallidos.length} sincronizacion(es) de ${facts.source} terminaron a medias: hay dato, pero no todo el del periodo.`
        : `${fallidos.length} sincronizacion(es) de ${facts.source} fallaron sin escribir nada${fallidos[0]?.error_code ? ` (${fallidos[0].error_code})` : ""}.`,
      severity: "high",
      material: true,
      downstream_effect: "degraded",
      status: "open",
      client_actionable: false,
    });
  }

  // Un rate limit que acabo reintentandose es cierto y no cambia ninguna cifra.
  const limitados = runs.filter((r) => /rate|429|throttl/i.test(r.error_code ?? ""));
  if (limitados.length > 0 && fallidos.length === 0) {
    issues.push({
      ...comun,
      issue_type: "rate_limited",
      description: `${facts.source} aplico limite de peticiones ${limitados.length} vez(ces); las ejecuciones acabaron bien.`,
      severity: "info",
      material: false,
      downstream_effect: "none",
      status: "open",
      client_actionable: false,
    });
  }

  if ((facts.failed_webhooks ?? 0) > 0) {
    issues.push({
      ...comun,
      issue_type: "webhook_failure",
      description: `${facts.failed_webhooks} webhook(s) de ${facts.source} no se pudieron procesar: puede faltar dato de eventos ocurridos en el periodo.`,
      severity: "moderate",
      material: true,
      downstream_effect: "degraded",
      status: "open",
      client_actionable: false,
    });
  }

  return issues;
}

/**
 * Pasos 2, 3, 11, 16 y 19 juntos: la evaluacion de una fuente.
 *
 * El orden importa y es el del runtime: primero se mira el dato (frescura y
 * cobertura), luego la tuberia (ingestion), y solo al final se decide la
 * fiabilidad, porque la fiabilidad es **consecuencia** de las dos cosas. Al
 * reves seria elegir la nota y buscarle motivos.
 */
export function assessSource(
  facts: IngestionFacts,
  window: AssessmentWindow,
  expectation: SourceExpectation = {},
): EvaluatedSource {
  const scope = facts.scope ?? "global";
  const cadencia = expectation.expected_cadence_minutes ?? null;
  const tolerancia = expectation.delay_tolerance_minutes ?? null;

  const freshness = classifyFreshness({
    lastSyncAt: facts.last_sync_at,
    now: window.now,
    expectedCadenceMinutes: cadencia,
    delayToleranceMinutes: tolerancia,
  });

  const settlement = classifyPeriodSettlement({
    periodEnd: window.periodEnd,
    now: window.now,
    expectedCadenceMinutes: cadencia,
    delayToleranceMinutes: tolerancia,
  });

  const cobertura =
    facts.observed_dates == null
      ? null
      : evaluateCoverage({
          observedDates: facts.observed_dates,
          periodStart: window.periodStart,
          periodEnd: window.periodEnd,
        });

  const issues = issuesFromIngestion(facts, window);

  // Paso 3 -- la falta de dato es un issue por derecho propio, no solo una
  // nota al pie de la evaluacion: es lo que impide calcular derivadas que
  // asumen completitud (rama C del runtime).
  if (cobertura && cobertura.coverage < 1) {
    const vacia = cobertura.available_observations === 0;
    issues.push({
      source: facts.source,
      dataset: facts.dataset,
      phenomenon: facts.phenomenon,
      scope,
      issue_type: "partial_sync",
      description: vacia
        ? `No hay ni un dia de ${facts.dataset} en el periodo analizado.`
        : `Faltan ${cobertura.expected_observations - cobertura.available_observations} de ${cobertura.expected_observations} dias de ${facts.dataset} (ausencia ${cobertura.missingness}).`,
      severity: vacia ? "critical" : cobertura.coverage < 0.7 ? "high" : "moderate",
      material: true,
      downstream_effect: vacia ? "blocked" : "degraded",
      status: "open",
      client_actionable: false,
    });
  }

  // Paso 16 -- que el periodo siga abierto no es una averia, pero callarlo
  // hace que se compare media semana contra una semana entera (rama D).
  if (settlement === "open" || settlement === "partially_settled") {
    issues.push({
      source: facts.source,
      dataset: facts.dataset,
      phenomenon: facts.phenomenon,
      scope,
      issue_type: "partial_period",
      description:
        settlement === "open"
          ? "El periodo analizado todavia no ha terminado: no se puede comparar con uno completo."
          : "El periodo termino hace poco y aun pueden llegar datos tardios.",
      severity: "info",
      material: false,
      downstream_effect: "none",
      status: "open",
      client_actionable: false,
    });
  }

  if (["stale", "severely_stale"].includes(freshness)) {
    issues.push({
      source: facts.source,
      dataset: facts.dataset,
      phenomenon: facts.phenomenon,
      scope,
      issue_type: "ingestion_degraded",
      description: `El dato de ${facts.source} esta ${freshness === "stale" ? "obsoleto" : "muy obsoleto"} para la cadencia esperada (ultima carga ${facts.last_sync_at ?? "desconocida"}).`,
      severity: freshness === "severely_stale" ? "high" : "moderate",
      material: true,
      downstream_effect: freshness === "severely_stale" ? "blocked" : "degraded",
      status: "open",
      client_actionable: false,
    });
  }

  const { reliability, degradation_reasons } = deriveReliability({
    freshness,
    coverage: cobertura?.coverage ?? null,
    issues,
  });

  return {
    source: facts.source,
    dataset: facts.dataset,
    phenomenon: facts.phenomenon,
    scope,
    period_start: window.periodStart,
    period_end: window.periodEnd,
    last_sync_at: facts.last_sync_at ?? null,
    expected_cadence_minutes: cadencia,
    freshness,
    period_settlement: settlement,
    expected_observations: cobertura?.expected_observations ?? null,
    available_observations: cobertura?.available_observations ?? null,
    coverage: cobertura?.coverage ?? null,
    missingness: cobertura?.missingness ?? null,
    reliability,
    degradation_reasons,
    issues: issues.map((i) => ({ ...i, explanation: null })),
  };
}

/**
 * Paso 19 — la nota, con sus motivos obligatorios.
 *
 * Nunca sube: empieza en `high` y cada hallazgo la baja. La base tiene los
 * mismos topes como check constraints (`..._alta_exige_frescura`,
 * `..._degradacion_motivada`), asi que esto no puede producir una fila que la
 * base rechace -- y si algun dia divergen, la base gana y el motor falla al
 * escribir, que es el orden correcto.
 */
export function deriveReliability(input: {
  freshness: FreshnessState;
  coverage: number | null;
  issues: { material: boolean; downstream_effect: DownstreamEffect; description: string }[];
  sampled?: boolean;
  evidenceFragility?: string | null;
}): { reliability: ReliabilityLevel; degradation_reasons: string[] } {
  const orden: ReliabilityLevel[] = ["unusable", "low", "medium", "high"];
  let nivel = 3;
  const motivos: string[] = [];
  const bajarA = (maximo: number, motivo: string) => {
    if (maximo < nivel) nivel = maximo;
    motivos.push(motivo);
  };

  if (input.freshness === "severely_stale") bajarA(0, "el dato esta gravemente obsoleto");
  else if (input.freshness === "stale") bajarA(1, "el dato esta obsoleto para su cadencia");
  else if (input.freshness === "delayed") bajarA(2, "el dato llega con retraso sobre lo esperado");
  else if (input.freshness === "unknown") bajarA(2, "no se puede juzgar la frescura: no hay cadencia esperada o no hay ultima carga");

  if (input.coverage != null) {
    if (input.coverage === 0) bajarA(0, "no hay ninguna observacion en el periodo");
    else if (input.coverage < 0.7) bajarA(0, `cobertura del ${Math.round(input.coverage * 100)}%`);
    else if (input.coverage < 0.95) bajarA(1, `cobertura del ${Math.round(input.coverage * 100)}%`);
    else if (input.coverage < 1) bajarA(2, `cobertura del ${Math.round(input.coverage * 100)}%`);
  }

  for (const issue of input.issues) {
    if (issue.downstream_effect === "blocked") bajarA(0, issue.description);
    else if (issue.downstream_effect === "degraded") bajarA(1, issue.description);
  }

  if (input.sampled) bajarA(2, "el dato viene muestreado");
  if (input.evidenceFragility) bajarA(2, `fragilidad estadistica: ${input.evidenceFragility}`);

  const reliability = orden[nivel] ?? "unusable";
  // La check constraint exige motivos para low y unusable; para high y medium
  // sobran, y guardar los de medium ayuda a entender por que no es high.
  return { reliability, degradation_reasons: nivel === 3 ? [] : motivos };
}
