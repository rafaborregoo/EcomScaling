/**
 * FASE 3 / D00: los invariantes del contrato de diagnostico.
 *
 * El apartado 60 exige que estas reglas no dependan de que el vector search
 * encuentre el documento. Estos tests son la otra mitad de eso: sin ellos,
 * `checkDiagnosticInvariants` puede dejar de detectar una violacion y nadie se
 * entera hasta que el copiloto afirme una causa sin evidencia delante de un
 * cliente.
 *
 * Cada test reproduce un salto de razonamiento que el contrato prohibe
 * expresamente, citando su apartado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkDiagnosticInvariants,
  diagnosticOutputSchema,
  type DiagnosticOutput,
} from "./diagnostics.js";

/** Caso base sano: conclusion bien sostenida. Cada test lo rompe por un sitio. */
function casoSano(): DiagnosticOutput {
  return diagnosticOutputSchema.parse({
    diagnostic_id: "DIAG-2041",
    scope: "conversion",
    granularity: "L3",
    target_metric: "revenue",
    target_question: "Por que ha caido el revenue un 18%?",
    status: "confirmed",
    finding: "critical_problem",
    diagnosis_type: "regression",
    primary_issue: "Deterioro de la tasa de exito de pago",
    root_cause: "Fallo de configuracion del proveedor de pago",
    limiting_constraint: "payment_completion",
    severity: "critical",
    trajectory: "deteriorating",
    confidence: "high",
    hypotheses: [
      { code: "H3", statement: "Regresion de UX en checkout", status: "untested" },
      { code: "H4", statement: "Fallo de configuracion de pago", status: "most_likely" },
      {
        code: "H5",
        statement: "Estacionalidad",
        status: "invalidated",
        rejection_reason: "El mismo periodo del ano anterior no muestra el patron",
      },
    ],
    evidence: [
      { code: "EV-004", source: "shopify", observation: "payment success -21%", supports: ["H4"] },
      { code: "EV-005", source: "shopify", observation: "payment errors +184%", supports: ["H4"] },
      { code: "EV-002", source: "shopify", observation: "ATC estable", contradicts: ["H3"] },
    ],
    data_quality: { shopify: "high" },
    impact_scope: { revenue_share_affected: 0.9 },
  });
}

const reglas = (output: DiagnosticOutput) =>
  checkDiagnosticInvariants(output).map((v) => v.rule);

test("un caso bien sostenido no dispara ningun invariante", () => {
  assert.deepEqual(checkDiagnosticInvariants(casoSano()), []);
});

test("§11: no se afirma una causa con una sola explicacion barajada", () => {
  const caso = casoSano();
  caso.hypotheses = [caso.hypotheses[1]!];
  assert.ok(reglas(caso).includes("alternativas_consideradas"));
});

test("§34: enumerar alternativas sin descartar ninguna no es contraste", () => {
  const caso = casoSano();
  caso.hypotheses = caso.hypotheses.map((h) =>
    h.status === "invalidated"
      ? { ...h, status: "untested" as const, rejection_reason: null }
      : h,
  );
  assert.ok(reglas(caso).includes("alternativas_resueltas"));
});

test("§46: una sola evidencia no confirma una causa con confianza alta", () => {
  const caso = casoSano();
  caso.evidence = [caso.evidence[0]!, { ...caso.evidence[2]! }];
  assert.ok(reglas(caso).includes("evidencia_minima"));
});

test("§36: confianza alta sin evidencia en contra ni data gap es sesgo de confirmacion", () => {
  const caso = casoSano();
  caso.evidence = caso.evidence.map((e) => ({ ...e, contradicts: [] }));
  caso.data_gaps = [];
  assert.ok(reglas(caso).includes("falsacion_intentada"));
});

test("§36: declarar el hueco como data gap sustituye a la evidencia en contra", () => {
  const caso = casoSano();
  caso.evidence = caso.evidence.map((e) => ({ ...e, contradicts: [] }));
  caso.data_gaps = [
    {
      required_data: "logs de error del proveedor de pago",
      reason: "Para separar fallo del proveedor de friccion de UX",
      impact_on_diagnosis: "high",
      affected_hypothesis: "H3",
    },
  ];
  assert.ok(!reglas(caso).includes("falsacion_intentada"));
});

test("§58: no se concluye con confianza alta sin evaluar la calidad del dato", () => {
  const caso = casoSano();
  caso.data_quality = {};
  assert.ok(reglas(caso).includes("calidad_de_datos_evaluada"));
});

test("§14: decir que faltan datos sin decir cuales deja al consultor sin nada", () => {
  const caso = casoSano();
  caso.status = "insufficient_data";
  caso.data_gaps = [];
  assert.ok(reglas(caso).includes("hueco_declarado"));
});

test("§20: root cause y constraint no pueden ser el mismo texto", () => {
  const caso = casoSano();
  caso.limiting_constraint = caso.root_cause;
  assert.ok(reglas(caso).includes("causa_distinta_de_constraint"));
});

test("§26: no se afirma una causa diciendo a la vez que no hay datos suficientes", () => {
  const caso = casoSano();
  caso.confidence = "insufficient_data";
  assert.ok(reglas(caso).includes("confianza_coherente"));
});

test("§58: un problema localizado no se diagnostica como global", () => {
  const caso = casoSano();
  caso.scope = "business_global";
  caso.impact_scope = { revenue_share_affected: 0.31 };
  assert.ok(reglas(caso).includes("no_generalizar"));
});

test("§34: el esquema rechaza una hipotesis descartada sin motivo", () => {
  assert.throws(() =>
    diagnosticOutputSchema.parse({
      diagnostic_id: "DIAG-1",
      scope: "conversion",
      target_metric: "cvr",
      target_question: "x",
      status: "open",
      hypotheses: [{ code: "H1", statement: "Fatiga creativa", status: "invalidated" }],
    }),
  );
});

test("§13: una observacion puede existir sin valor -- unknown es informacion", () => {
  const parsed = diagnosticOutputSchema.parse({
    diagnostic_id: "DIAG-2",
    scope: "acquisition",
    target_metric: "cac",
    target_question: "x",
    status: "investigating",
    observations: [
      {
        metric: "creative_production_volume",
        value: null,
        source: "manual",
        knowledge_state: "unknown",
      },
    ],
  });
  assert.equal(parsed.observations[0]?.knowledge_state, "unknown");
});

test("el motor diagnostico no tiene donde escribir una recomendacion (§40)", () => {
  // El contrato termina en diagnostico: prioridad es F4 y accion F5+. La
  // garantia es estructural -- no existe el campo -- y este test la fija para
  // que anadirlo obligue a pasar por aqui y leer el apartado 40.
  const campos = Object.keys(diagnosticOutputSchema.shape);
  for (const prohibido of ["action", "recommendation", "priority", "next_steps", "playbook"]) {
    assert.ok(
      !campos.includes(prohibido),
      `el contrato de salida no puede exponer "${prohibido}" (D00 §40)`,
    );
  }
});
