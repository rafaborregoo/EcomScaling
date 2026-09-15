/**
 * FASE 3 / D04 — lo que esta pantalla no puede dejar que pase.
 *
 * El fallo que persigue: **que declarar cualquier cosa parezca desbloquear el
 * diagnostico**. Solo el guardrail economico dice "a partir de aqui duele"; el
 * histórico y el objetivo sirven para comparar. Si la pantalla los trata igual,
 * alguien declara su baseline, ve que sigue saliendo `not_assessable` y concluye
 * que el sistema esta roto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  judges,
  missingCapabilities,
  REFERENCE_TYPES,
  referenceSentence,
  referenceTypeLabel,
  validateDraft,
  type HealthReferenceView,
} from "./health-references-view-model";

function referencia(overrides: Partial<HealthReferenceView> = {}): HealthReferenceView {
  return {
    id: "r1",
    organization_id: "o1",
    organization_name: "Tienda",
    capability: "acquisition",
    metric: "cac",
    scope: "global",
    reference_type: "economic_guardrail",
    value: 32,
    value_text: null,
    unit: "EUR",
    direction: "max",
    source: null,
    effective_from: "2026-09-15T10:00:00.000Z",
    ...overrides,
  };
}

test("solo el guardrail económico juzga", () => {
  // Es la distincion que evita la decepcion: declarar el historico no desbloquea
  // el diagnostico, declarar el guardrail si.
  assert.equal(judges("economic_guardrail"), true);
  assert.equal(judges("self_baseline"), false);
  assert.equal(judges("business_target"), false);
  assert.equal(judges("external_benchmark"), false);
});

test("la dirección cambia lo que significa el mismo número", () => {
  // Un CAC sostenible es un techo y una cobertura de stock es un suelo. El mismo
  // 32 significa lo contrario en cada caso.
  assert.equal(referenceSentence(referencia()), "cac como máximo 32 EUR");
  assert.equal(
    referenceSentence(referencia({ metric: "cobertura_stock", direction: "min", unit: "días", value: 21 })),
    "cobertura_stock como mínimo 21 días",
  );
  assert.equal(
    referenceSentence(referencia({ direction: null, unit: null, value: null, value_text: "el del año pasado" })),
    "cac el del año pasado",
  );
});

test("lo que falta declarar sale de lo que los motores dicen que les falta", () => {
  // No es una lista de "rellena estas quince": son exactamente las capacidades
  // que hoy salen no evaluables.
  const faltan = missingCapabilities(
    ["acquisition", "retention", "conversion"],
    [referencia({ capability: "acquisition" })],
  );

  assert.deepEqual(faltan, ["retention", "conversion"]);
});

test("un histórico declarado no tapa el hueco", () => {
  // Si contara, la capacidad seguiria saliendo not_assessable y la pantalla
  // estaria diciendo que ya esta hecho.
  const faltan = missingCapabilities(
    ["acquisition"],
    [referencia({ capability: "acquisition", reference_type: "self_baseline" })],
  );

  assert.deepEqual(faltan, ["acquisition"]);
});

test("el formulario dice qué falta, no solo que no", () => {
  // Un boton apagado sin explicacion es una pared.
  const vacio = { organization_id: "", capability: "", metric: "", reference_type: "economic_guardrail", value: "", source: "" };

  assert.match(validateDraft(vacio) ?? "", /tienda/);
  assert.match(validateDraft({ ...vacio, organization_id: "o1" }) ?? "", /capacidad/);
  assert.match(
    validateDraft({ ...vacio, organization_id: "o1", capability: "acquisition" }) ?? "",
    /métrica/,
  );
  assert.match(
    validateDraft({ ...vacio, organization_id: "o1", capability: "acquisition", metric: "cac" }) ?? "",
    /sin valor/,
  );
  assert.match(
    validateDraft({ organization_id: "o1", capability: "acquisition", metric: "cac", reference_type: "economic_guardrail", value: "muchos", source: "" }) ?? "",
    /número/,
  );

  assert.equal(
    validateDraft({ organization_id: "o1", capability: "acquisition", metric: "cac", reference_type: "economic_guardrail", value: "32", source: "" }),
    null,
  );
});

test("una referencia externa tiene que decir de dónde sale", () => {
  // Guardrail 13: no prohibe el benchmark externo, exige poder discutirlo.
  const sinFuente = {
    organization_id: "o1",
    capability: "acquisition",
    metric: "cac",
    reference_type: "external_benchmark",
    value: "32",
    source: "",
  };

  assert.match(validateDraft(sinFuente) ?? "", /de dónde sale/);
  assert.equal(validateDraft({ ...sinFuente, source: "Informe sectorial 2026" }), null);
});

test("los cinco tipos del esquema están en pantalla y explicados", () => {
  assert.equal(REFERENCE_TYPES.length, 5);
  assert.ok(REFERENCE_TYPES.every((t) => t.hint.length > 0));
  assert.equal(referenceTypeLabel("economic_guardrail"), "Guardrail económico");
  assert.equal(referenceTypeLabel("inventado"), "inventado");
});
