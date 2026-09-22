import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  insightSpotsFromFindingAreas,
  insightSpotForAnchor,
  insightSpotsFromAiAssessments,
  insightSpotsFromPlaybookAssessments,
} from "./insights-registry";

test("el feed transversal de playbooks crea un insight con enlace a la card exacta", () => {
  const spots = insightSpotsFromPlaybookAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: true },
    [{ domain: "SCALABILITY", disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["capacity"], reason_codes: [] }],
  );
  assert.equal(spots.length, 1);
  assert.equal(spots[0]?.id, "playbook-scalability");
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-scalability");
  assert.equal(spots[0]?.insights[0]?.severity, "medium");
});

test("el feed no enseña diagnósticos de playbooks a un cliente", () => {
  const spots = insightSpotsFromPlaybookAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: false },
    [{ domain: "RECOVERY_CRISIS", disposition: "BLOCKED", unresolved_unknowns: [], reason_codes: [] }],
  );
  assert.deepEqual(spots, []);
});

test("el feed F3 enlaza D12, D13 y D14 con sus cards exactas", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "store-1", isConsultant: true },
    [
      { domain: "F3_D12_ADVERSARIAL", disposition: "REASSESS_DIAGNOSIS", store_id: "store-1", reason_codes: ["high_risk"] },
      { domain: "F3_D13_TEMPORAL", disposition: "VALIDATION_REQUIRED", store_id: "store-1", reason_codes: ["trajectory_unknown"] },
      { domain: "F3_D14_OUTPUT", disposition: "VALIDATION_REQUIRED", store_id: "store-1", reason_codes: ["invalid_output"] },
    ],
  );

  assert.deepEqual(spots.map((spot) => spot.href), [
    "/shopify/diagnostico#insight-d12-adversarial",
    "/shopify/diagnostico#insight-d13-temporal",
    "/shopify/diagnostico#insight-d14-output",
  ]);
  assert.equal(spots[0]?.insights[0]?.severity, "high");
});

test("el mismo destino semantico sirve para el menu y para el icono de la card", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "store-1", isConsultant: true },
    [{ domain: "F3_D12_ADVERSARIAL", disposition: "REASSESS_DIAGNOSIS", store_id: "store-1" }],
  );

  const spot = insightSpotForAnchor(spots, "insight-d12-adversarial");
  assert.equal(spot?.href, "/shopify/diagnostico#insight-d12-adversarial");
  assert.equal(spot?.insights[0]?.title, "Confusores: REASSESS_DIAGNOSIS");
});

test("los hallazgos de los agentes colocan el icono en cada dato clave que citan", () => {
  const spots = insightSpotsFromFindingAreas(
    [
      {
        title: "Las ventas caen",
        severity: "high",
        evidence: "Ventas netas -18% frente al periodo anterior.",
        area: "ventas",
      },
      {
        title: "Falta contexto",
        severity: "medium",
        evidence: "No hay cohortes maduras.",
        area: "cohortes",
      },
    ],
    {
      ventas: { label: "Ver las ventas", href: "#shopify-ventas" },
      cohortes: { label: "Ver las cohortes", href: "#shopify-cohortes" },
    },
  );

  assert.deepEqual(spots.map((spot) => spot.href), [
    "#shopify-ventas",
    "#shopify-cohortes",
  ]);
  assert.equal(spots[0]?.insights[0]?.severity, "high");
});

test("el feed F3 no mezcla una revisión de otra tienda", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "store-1", isConsultant: true },
    [{ domain: "F3_D12_ADVERSARIAL", disposition: "REASSESS_DIAGNOSIS", store_id: "store-2" }],
  );
  assert.deepEqual(spots, []);
});

test("el feed F7.02 enlaza el matching causal con su card", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: true },
    [{ domain: "F7_02_MATCHING", disposition: "VALIDATION_REQUIRED", reason_codes: ["MATCHING.CAUSAL_STORY_INCOMPLETE"] }],
  );
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-matching");
});

test("el feed F7.03 enlaza la prioridad con su card", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: true },
    [{ domain: "F7_03_PRIORITIZATION", disposition: "VALIDATION_REQUIRED", reason_codes: ["PRIORITY.ABSTAINED"] }],
  );
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-prioritization");
});

test("el feed F7.04 enlaza la expectativa de impacto con su card", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: true },
    [{ domain: "F7_04_IMPACT", disposition: "VALIDATION_REQUIRED", reason_codes: ["IMPACT.MECHANISM_MISSING"] }],
  );
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-impact");
});

test("el feed F7.05 enlaza la factibilidad con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_05_FEASIBILITY", disposition: "VALIDATION_REQUIRED", reason_codes: ["RESOURCE.CONTEXT_UNKNOWN"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-feasibility");
});

test("el feed F7.06 enlaza el riesgo y la reversibilidad con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_06_RISK", disposition: "VALIDATION_REQUIRED", reason_codes: ["REVERSIBILITY.UNKNOWN"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-risk");
});

test("el feed F7.07 enlaza la secuenciación con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_07_SEQUENCING", disposition: "VALIDATION_REQUIRED", reason_codes: ["SEQUENCE.PATH_MISSING"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-sequencing");
});

test("el feed F7.08 enlaza test vs ejecución con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_08_TEST_EXECUTE", disposition: "VALIDATION_REQUIRED", reason_codes: ["MEASUREMENT.NOT_READY"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-test-execute");
});

test("el feed F7.09 enlaza intensidad con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_09_INTENSITY", disposition: "VALIDATION_REQUIRED", reason_codes: ["INTENSITY.OBSERVE_BEFORE_MORE_EXPOSURE"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-intensity");
});

test("el feed F7.10 enlaza recomendaciones por madurez con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_10_MATURITY", disposition: "VALIDATION_REQUIRED", reason_codes: ["MATURITY.READINESS_UNKNOWN"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-maturity-recommendations");
});

test("el feed F7.11 enlaza la recomendación factible con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_11_CONSTRAINTS", disposition: "VALIDATION_REQUIRED", reason_codes: ["CONSTRAINT.BINDING_REQUIRES_VALIDATION"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-constraint-recommendations");
});

test("el feed F7.12 enlaza la cartera con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_12_PORTFOLIO", disposition: "VALIDATION_REQUIRED", reason_codes: ["PORTFOLIO.PRIMARY_OR_CAPACITY_REQUIRES_VALIDATION"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-recommendation-portfolio");
});

test("el feed F7.13 enlaza la decisión dinámica con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_13_DYNAMIC_DECISION", disposition: "VALIDATION_REQUIRED", reason_codes: ["DYNAMIC.EVIDENCE_INCOMPLETE"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-dynamic-decision");
});

test("el feed F7.14 enlaza restraint reasoning con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_14_RESTRAINT_DECISION", disposition: "VALIDATION_REQUIRED", reason_codes: ["RESTRAINT.DECISION_CRITICAL_CONTEXT_UNKNOWN"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-restraint-decision");
});

test("el feed F7.15 enlaza expected outcome con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_15_EXPECTED_OUTCOME", disposition: "VALIDATION_REQUIRED", reason_codes: ["OUTCOME.DECISION_CONTEXT_UNKNOWN"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-expected-outcome");
});

test("el feed F7.17 enlaza confianza calibrada con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_17_RECOMMENDATION_CONFIDENCE", disposition: "VALIDATION_REQUIRED", reason_codes: ["CONFIDENCE.EVIDENCE_INVALID"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-recommendation-confidence");
});

test("el feed F7.18 enlaza comunicación de recomendaciones con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F7_18_RECOMMENDATION_COMMUNICATION", disposition: "VALIDATION_REQUIRED", reason_codes: ["COMMUNICATION.DECISION_CONTEXT_UNKNOWN"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-recommendation-communication");
});

// El modal de IA mostraba "Diagnóstico · F9" y "Diagnóstico · F7.10": nombres
// internos de la metodologia, que al consultor no le dicen nada y le hacen
// pensar que la aplicacion habla otro idioma. El `label` ya dice de que va
// ("Aprendizaje continuo"); el codigo de bloque sobra en pantalla y se queda
// donde sirve, que es el nombre de estos tests y conocimiento/.
test("ninguna etiqueta visible del registro lleva el codigo de fase", () => {
  const fuente = readFileSync(new URL("./insights-registry.ts", import.meta.url), "utf8");
  const visibles = [
    ...fuente.matchAll(/(?:location|label): "([^"]*)"/g),
  ].map((m) => m[1] ?? "");
  const conCodigo = visibles.filter((texto) => /\bF\d+(\.\d+)?\b|\bF3\.D\d+\b/.test(texto));
  assert.deepEqual(conCodigo, []);
});
