/**
 * FASE 3 / D10 — lo que esta pantalla no puede dejar que pase.
 *
 * El fallo que persiguen estos tests es uno solo: **que una cifra grande se lea
 * como una gravedad**. Pasa de tres formas -- ordenando por importe, ensenando
 * el numero sin su base, y dejando que un `unknown` parezca un hueco en vez de
 * un umbral que nadie ha definido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  amountText,
  chosenShare,
  confidenceRow,
  denominatorLabel,
  quantificationLabel,
  severityAbsenceReason,
  sortAssessments,
  type SeverityView,
} from "./severity-view-model";

function medida(overrides: Partial<SeverityView["measurements"][number]> = {}) {
  return {
    dimension: "revenue",
    dimension_severity: "unknown",
    nature: "realized_loss",
    timing: "realized",
    evidence_type: "estimated",
    quantification: "estimated",
    metric: "net_sales",
    value: 2400,
    value_low: null,
    value_high: null,
    unit: "EUR",
    period_start: "2026-09-01T00:00:00.000Z",
    period_end: "2026-09-08T00:00:00.000Z",
    method: "Diferencia contra el baseline de D05.",
    assumptions: "Supone que el baseline habria seguido vigente.",
    impact_confidence: "medium",
    note: null,
    ...overrides,
  };
}

function evaluacion(overrides: Partial<SeverityView> = {}): SeverityView {
  return {
    id: "a",
    organization_name: "Tienda",
    case_id: "c1",
    target: "net_sales",
    scope: "business",
    acute_severity: "unknown",
    cumulative_severity: "unknown",
    forward_risk_severity: "unknown",
    structural_severity: "unknown",
    overall_severity: "unknown",
    cause_confidence: "insufficient",
    impact_confidence: "medium",
    severity_confidence: "insufficient",
    trajectory: "deteriorating",
    velocity: "worsening",
    recurrence: "unknown",
    measurement_compromised: false,
    material_exposure: false,
    escalation_signal: "none",
    summary: "net_sales se movio 2400 EUR frente a su baseline.",
    limitations: "Las cinco severidades quedan en unknown.",
    assessed_at: "2026-09-15T10:00:00.000Z",
    measurements: [medida()],
    exposures: [
      {
        denominator: "revenue",
        denominator_value: 78000,
        denominator_note: null,
        exposure_share: 2400 / 78000,
        affected_segment: null,
        is_chosen_denominator: true,
        confidence: "medium",
        rationale: "Se juzga sobre el revenue porque la metrica afectada es dinero facturado.",
      },
      {
        denominator: "orders",
        denominator_value: 410,
        denominator_note: "No se calcula cuota: no estan en la misma unidad.",
        exposure_share: null,
        affected_segment: "business",
        is_chosen_denominator: false,
        confidence: "medium",
        rationale: null,
      },
    ],
    ...overrides,
  };
}

test("no se ordena por cuánto dinero", () => {
  // Ordenar por importe es pintar la prioridad que los guardrails 3, 46, 47 y 48
  // dejan fuera del bloque: un HIGH puede ir antes que un CRITICAL segun
  // esfuerzo y momento, y eso es F4.
  const pequenaReciente = evaluacion({
    id: "a",
    assessed_at: "2026-09-15T10:00:00.000Z",
    measurements: [medida({ value: 40 })],
  });
  const enormeVieja = evaluacion({
    id: "b",
    assessed_at: "2026-08-01T10:00:00.000Z",
    measurements: [medida({ value: 99000 })],
  });

  assert.deepEqual(
    sortAssessments([enormeVieja, pequenaReciente]).map((a) => a.id),
    ["a", "b"],
  );
});

test("la cuota viene de la base elegida, con su razón", () => {
  // Guardrails 15 a 18: el mismo incidente es un 3% del revenue y un 30% de la
  // contribucion. Sin decir sobre que, la cuota no significa nada.
  const cuota = chosenShare(evaluacion());

  assert.ok(cuota);
  assert.ok(Math.abs(cuota.share - 2400 / 78000) < 1e-9);
  assert.equal(cuota.denominator, "la facturación del periodo");
  assert.ok((cuota.rationale ?? "").length > 0);
});

test("una cuota que no significa nada no se enseña", () => {
  // Si la unica base elegida no tiene cuota calculable, no se inventa un
  // porcentaje: se devuelve null y la tarjeta ensena solo la cifra.
  const sinCuota = evaluacion({
    exposures: [
      {
        denominator: "orders",
        denominator_value: 410,
        denominator_note: "No estan en la misma unidad.",
        exposure_share: null,
        affected_segment: "business",
        is_chosen_denominator: true,
        confidence: "medium",
        rationale: "por algo",
      },
    ],
  });

  assert.equal(chosenShare(sinCuota), null);
  assert.equal(chosenShare(evaluacion({ exposures: [] })), null);
});

test("un rango se enseña como rango, no como su punto medio", () => {
  // Guardrail 24: convertirlo en la media inventa una precision que nadie tiene.
  const rango = medida({
    quantification: "range",
    value: null,
    value_low: 1800,
    value_high: 3200,
  });

  // Sin separador de millares: en espanol los numeros de cuatro cifras no lo
  // llevan, y forzarlo seria escribir mal el castellano.
  assert.match(amountText(rango) ?? "", /entre 1800 y 3200 EUR/);
  assert.equal(amountText(medida({ value: null, quantification: "unknown" })), null);
});

test("una estimación se dice estimación", () => {
  // La perdida es la diferencia contra un baseline, y un baseline es un modelo.
  // Llamarlo cifra cerrada presentaria un calculo como una medicion.
  assert.equal(quantificationLabel(medida()).label, "Estimación");
  assert.equal(quantificationLabel(medida({ quantification: "exact" })).label, "Cifra cerrada");
  assert.equal(
    quantificationLabel(medida({ quantification: "directional" })).label,
    "Solo dirección",
  );
});

test("la severidad desconocida se explica, no se deja como hueco", () => {
  // Sin esta frase, `unknown` se lee como "el sistema no sabe hacer su trabajo"
  // cuando lo que dice es "nadie ha definido a partir de que cuota esto es
  // grave".
  assert.match(severityAbsenceReason(evaluacion()) ?? "", /nadie ha definido/);

  // Y cuando alguien si la ponga, la frase desaparece sola.
  assert.equal(severityAbsenceReason(evaluacion({ overall_severity: "high" })), null);
});

test("las tres confianzas se enseñan juntas y separadas", () => {
  // Apartado 27 y guardrail 13: se puede saber muy bien cuanto se movio el
  // dinero y no tener ni idea de por que. Colapsarlas borraria esa diferencia.
  const filas = confidenceRow(evaluacion());

  assert.equal(filas.length, 3);
  assert.deepEqual(
    filas.map((f) => f.value),
    ["media", "insuficiente", "insuficiente"],
  );
  assert.equal(filas[0]?.label, "En la cifra");
  assert.equal(filas[1]?.label, "En la causa");
});

test("los denominadores se nombran en castellano", () => {
  assert.equal(denominatorLabel("contribution"), "la contribución del periodo");
  assert.equal(denominatorLabel("inventado"), "inventado");
});
