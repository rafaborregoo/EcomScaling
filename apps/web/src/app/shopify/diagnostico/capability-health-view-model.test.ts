/**
 * FASE 3 / D04 — lo que esta pantalla no puede dejar que pase.
 *
 * Diez de los cincuenta guardrails del bloque son `X != SALUD`, y los dos que
 * mas facil se rompen en una pantalla son fundir estado con trayectoria y
 * dejar que el peor hallazgo pinte la capacidad entera.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  capabilityLabel,
  riskNote,
  severityLabel,
  splitByAssessability,
  splitEvidence,
  stateLabel,
  trajectoryLabel,
  type CapabilityHealthView,
} from "./capability-health-view-model";

function lectura(overrides: Partial<CapabilityHealthView> = {}): CapabilityHealthView {
  return {
    id: "1",
    organization_name: "Tienda",
    capability: "acquisition",
    scope: "global",
    health_state: "not_assessable",
    trajectory: null,
    near_term_risk: "low",
    risk_horizon: null,
    has_leading_signals: false,
    structural_risk: "none",
    chronicity: null,
    issue_role: null,
    impact_vector: [],
    current_failure: null,
    maturity_profile_id: null,
    confidence: "insufficient_data",
    assessment_blocker:
      "No hay baseline propio, objetivo ni guardrail economico declarado para acquisition.",
    contradiction_resolution: null,
    state_justification: null,
    assessed_at: "2026-09-15T10:00:00.000Z",
    findings: [],
    evidence: [],
    ...overrides,
  };
}

test("estado y trayectoria no se funden", () => {
  // Apartado 3 con el ejemplo que lo explica todo: BAD mejorando y HEALTHY
  // cayendo en picado son situaciones muy distintas, y una sola etiqueta las
  // iguala.
  const malMejorando = lectura({ health_state: "bad", trajectory: "improving" });
  const sanaCayendo = lectura({
    health_state: "healthy",
    trajectory: "rapidly_deteriorating",
  });

  assert.equal(stateLabel(malMejorando.health_state).label, "Mal");
  assert.equal(trajectoryLabel(malMejorando.trajectory), "mejorando");
  assert.equal(stateLabel(sanaCayendo.health_state).label, "Sana");
  assert.equal(trajectoryLabel(sanaCayendo.trajectory), "empeorando rápido");

  // Y los tonos no se contagian: el de la tarjeta sale del estado, punto.
  assert.equal(stateLabel(malMejorando.health_state).tone, "danger");
  assert.equal(stateLabel(sanaCayendo.health_state).tone, "success");
});

test("sin trayectoria no se inventa 'estable'", () => {
  // Decir "estable" seria afirmar que no se mueve, y eso es una afirmacion que
  // no tenemos.
  assert.equal(trajectoryLabel(null), null);
  assert.equal(trajectoryLabel("desconocida"), null);
});

test("no evaluable no se pinta como una mala noticia", () => {
  // No saber no es que la tienda vaya mal: es una declaracion que nos falta.
  // Pintarlo de rojo le diria al consultor lo contrario de lo que pasa.
  assert.equal(stateLabel("not_assessable").tone, "neutral");
  assert.equal(stateLabel("unknown").tone, "neutral");
  assert.equal(stateLabel("bad").tone, "danger");
});

test("la severidad es del hallazgo y se dice entera", () => {
  // Guardrail 6: la salud es el estado de una capacidad, la severidad el dano
  // de un hallazgo. Acortar `business_threat` a "critico" los confundiria.
  assert.equal(severityLabel("business_threat").label, "Amenaza al negocio");
  assert.equal(severityLabel("info").label, "Informativa");
  assert.equal(severityLabel("info").tone, "neutral");
});

test("la evidencia que contradice va aparte, no en el mismo montón", () => {
  // Guardrails 26, 27 y 28. La inconsistencia no se resuelve por escrito si la
  // pantalla la esconde entre lo que encaja.
  const conEvidencia = lectura({
    evidence: [
      { relation: "supporting", metric: "cac", observation: "a", indicator_type: "lagging", window_start: null, window_end: null, source: "d05_signal", confidence: "high" },
      { relation: "contradicting", metric: "orders_count", observation: "b", indicator_type: "leading", window_start: null, window_end: null, source: "d05_signal", confidence: "high" },
      { relation: "positive", metric: "x", observation: "c", indicator_type: "lagging", window_start: null, window_end: null, source: "d06_symptom", confidence: "medium" },
    ],
  });

  const { apoya, contradice, positiva } = splitEvidence(conEvidencia);
  assert.equal(apoya.length, 1);
  assert.equal(contradice.length, 1);
  assert.equal(positiva.length, 1);
  assert.equal(contradice[0]?.metric, "orders_count");
});

test("un riesgo bajo sin indicadores adelantados lleva su aviso", () => {
  // Guardrail 25: mirando solo los rezagados el aviso llega con el dano hecho,
  // y eso hay que saberlo al leer el "bajo".
  assert.match(riskNote(lectura()) ?? "", /confirma, no avisa/);

  assert.equal(
    riskNote(lectura({ has_leading_signals: true, near_term_risk: "low" })),
    null,
  );
  assert.match(
    riskNote(
      lectura({ has_leading_signals: true, near_term_risk: "high", risk_horizon: "30d" }),
    ) ?? "",
    /Riesgo alto.*30d/,
  );
});

test("las capacidades no se ordenan de peor a mejor", () => {
  // Ordenar de peor a mejor es pintar una prioridad, y D04 no la tiene: es uno
  // de los diez guardrails `X != SALUD`.
  const { evaluadas, sinEvaluar } = splitByAssessability([
    lectura({ id: "a", capability: "retention", health_state: "healthy" }),
    lectura({ id: "b", capability: "acquisition", health_state: "critical" }),
    lectura({ id: "c", capability: "inventory" }),
  ]);

  assert.deepEqual(
    evaluadas.map((a) => a.capability),
    ["acquisition", "retention"],
    "alfabetico por su nombre en pantalla, no por gravedad",
  );
  assert.deepEqual(sinEvaluar.map((a) => a.capability), ["inventory"]);
});

test("las capacidades se nombran en castellano", () => {
  assert.equal(capabilityLabel("unit_economics"), "Economía unitaria");
  assert.equal(capabilityLabel("inventada"), "inventada");
});
