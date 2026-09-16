/**
 * FASE 3 / D11 — lo que esta pantalla no puede dejar que pase.
 *
 * El fallo que persigue: **que un caso descrito se lea como un caso
 * explicado**. Pasa de dos formas -- resumiendo las capas en una sola confianza,
 * y tratando "no lo hemos mirado" como "no hay nada".
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  confidenceLabel,
  dimensionLabel,
  epistemicLabel,
  groupByCase,
  layerQuestion,
  LAYER_ORDER,
  negativeClaimLabel,
  ratingTone,
  resolvabilityLabel,
  sortLayers,
  splitUncertainties,
  weakDimensions,
  type ClaimView,
  type UncertaintyView,
} from "./confidence-view-model";

function capa(overrides: Partial<ClaimView> = {}): ClaimView {
  return {
    id: "1",
    organization_name: "Tienda",
    case_id: "c1",
    claim_layer: "what",
    claim: "net_sales se movio fuera de su rango esperado.",
    target_question: "¿Que ha cambiado?",
    epistemic_state: "observed",
    confidence_level: "high",
    alternative_separation: "not_applicable",
    contradiction_level: "none",
    completeness: "complete_enough",
    explanatory_coverage: "unknown",
    negative_claim_state: null,
    coverage_declared: null,
    capped_at: null,
    cap_reason: null,
    desired_level: null,
    missing_evidence: null,
    next_evidence_required: null,
    error_cost: "moderate",
    limitations: null,
    assessed_at: "2026-09-16T10:00:00.000Z",
    dimensions: [],
    caps: [],
    ...overrides,
  };
}

test("las capas se leen de lo que se mide a lo que se concluye", () => {
  // No es alfabetico ni por confianza: es el orden en que se construye un
  // diagnostico. Leerlo al reves es empezar por la conclusion.
  const ordenadas = sortLayers([
    capa({ id: "a", claim_layer: "overall" }),
    capa({ id: "b", claim_layer: "what" }),
    capa({ id: "c", claim_layer: "why" }),
    capa({ id: "d", claim_layer: "measurement" }),
  ]);

  assert.deepEqual(
    ordenadas.map((c) => c.claim_layer),
    ["measurement", "what", "why", "overall"],
  );
});

test("saber QUÉ y no saber POR QUÉ se enseñan a la vez", () => {
  // Si la pantalla resumiera esto en una confianza media, la frase "no puede
  // determinarse por que" desapareceria justo cuando mas falta hace.
  const grupos = groupByCase([
    capa({ id: "a", claim_layer: "why", confidence_level: "insufficient_data" }),
    capa({ id: "b", claim_layer: "what", confidence_level: "high" }),
  ]);

  assert.equal(grupos.length, 1);
  assert.deepEqual(
    grupos[0]?.claims.map((c) => [c.claim_layer, c.confidence_level]),
    [
      ["what", "high"],
      ["why", "insufficient_data"],
    ],
  );
});

test("cada nivel tiene su frase, y ninguna suena a certeza", () => {
  // Guardrails 43 a 46: "es compatible con" y "la explicacion mas probable es"
  // no dicen lo mismo, y esa diferencia separa una hipotesis de una conclusion.
  assert.equal(confidenceLabel("insufficient_data").phrase, "no puede determinarse si");
  assert.equal(confidenceLabel("low").phrase, "es compatible con que");
  assert.equal(confidenceLabel("medium").phrase, "la explicación más probable es que");
  assert.match(confidenceLabel("high").phrase, /sostiene con solidez/);

  // Guardrail 47: ni la mas alta se presenta como absoluta.
  for (const nivel of ["insufficient_data", "low", "medium", "high"]) {
    assert.ok(
      !/(está claro|es evidente|sin duda|con total seguridad|demostrado)/i.test(
        confidenceLabel(nivel).phrase,
      ),
    );
  }
});

test("'no lo hemos mirado' no es 'no hay nada'", () => {
  // El corazon de toda la fase, en la pantalla que lo dice con palabras.
  assert.match(negativeClaimLabel("no_evidence") ?? "", /No es lo mismo que no haya nada/);
  assert.match(negativeClaimLabel("evidence_of_no_problem") ?? "", /cobertura declarada/);
  assert.match(negativeClaimLabel("evidence_of_stability") ?? "", /estable/);
  assert.equal(negativeClaimLabel(null), null);
});

test("de dónde sale la afirmación es distinto de cuánto se fía", () => {
  // Una serie medida y una suposicion pueden tener la misma confianza y no
  // valen igual.
  assert.equal(epistemicLabel("observed").label, "Observado");
  assert.equal(epistemicLabel("hypothesized").label, "Supuesto");
  assert.equal(epistemicLabel("unknown").tone, "neutral");
});

test("solo se enseñan las dimensiones que restan", () => {
  // Lo que se cumple no cambia ninguna decision; lo que falla, si.
  const conMezcla = capa({
    dimensions: [
      { dimension: "data_reliability", rating: "strong", reason: "x" },
      { dimension: "mechanism_strength", rating: "absent", reason: "y" },
      { dimension: "sample_sufficiency", rating: "weak", reason: "z" },
    ],
  });

  assert.deepEqual(
    weakDimensions(conMezcla).map((d) => d.dimension),
    ["mechanism_strength", "sample_sufficiency"],
  );
  assert.equal(weakDimensions(capa()).length, 0);
});

test("un mecanismo ausente se pinta distinto de uno débil", () => {
  // Coincidir en el tiempo no es un mecanismo a medias: es ningun mecanismo.
  assert.equal(ratingTone("absent"), "danger");
  assert.equal(ratingTone("weak"), "warn");
  assert.equal(ratingTone("strong"), "success");
});

test("lo que bloquea el caso se separa de lo que solo lo matiza", () => {
  // Un critical unknown no es una duda mas: es lo que impide cerrarlo.
  const lista: UncertaintyView[] = [
    {
      id: "u1",
      case_id: "c1",
      claim_id: "1",
      uncertainty_type: "causal",
      description: "No existe grafo causal.",
      materiality: "critical_unknown",
      is_known_unknown: true,
      resolvability: "resolvable_now",
      required_evidence: "Las relaciones causales escritas.",
    },
    {
      id: "u2",
      case_id: "c1",
      claim_id: null,
      uncertainty_type: "impact",
      description: "No hay coste por referencia.",
      materiality: "material",
      is_known_unknown: true,
      resolvability: "with_new_data",
      required_evidence: "Coste por variante.",
    },
  ];

  const { criticas, resto } = splitUncertainties(lista);
  assert.deepEqual(criticas.map((u) => u.id), ["u1"]);
  assert.deepEqual(resto.map((u) => u.id), ["u2"]);
});

test("se dice si se puede resolver hoy o hay que esperar", () => {
  assert.equal(resolvabilityLabel("resolvable_now"), "se puede resolver ya");
  assert.match(resolvabilityLabel("with_new_data"), /dato que no tenemos/);
  assert.match(resolvabilityLabel("not_resolvable"), /no tiene solución/);
});

test("cada capa se enuncia como la pregunta que contesta", () => {
  // Una etiqueta tecnica ("root_cause") no le dice nada a quien lee; la pregunta
  // si, y ademas deja claro que hay una respuesta esperada.
  assert.equal(layerQuestion("why"), "¿Por qué pasa?");
  assert.equal(layerQuestion("overall"), "¿Se puede concluir el caso?");
  assert.equal(layerQuestion("inventada"), "inventada");

  // Las trece capas del esquema tienen su pregunta escrita.
  for (const capaConocida of LAYER_ORDER) {
    assert.notEqual(layerQuestion(capaConocida), capaConocida, capaConocida);
  }
});

test("las dimensiones se nombran en castellano", () => {
  assert.equal(dimensionLabel("mechanism_strength"), "Fuerza del mecanismo");
  assert.equal(dimensionLabel("inventada"), "inventada");
});
