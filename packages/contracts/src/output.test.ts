/**
 * FASE 3 / D14: salida diagnostica, trazabilidad y validacion.
 *
 * El ultimo bloque de la fase, y el que paga la deuda del lenguaje. Los tests
 * que mas importan aqui son los del generador: la frase que ve el cliente se
 * compone desde el nivel de confianza, asi que el lenguaje descalibrado no se
 * detecta -- **no se puede construir**.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  checkOutputInvariants,
  confidenceLeadIn,
  diagnosticClosureSchema,
  diagnosticOutputRecordFields,
  diagnosticOutputRecordSchema,
  diagnosticSnapshotSchema,
  isCalibrated,
  outputEvidenceSchema,
  outputTransitionSchema,
  outputValidationSchema,
  userSummary,
  CONFIDENCE_LEAD_INS,
  FINALIZATION_GATE,
  VALIDATORS,
  type DiagnosticOutputRecord,
  type OutputCheckInput,
} from "./output.js";
import { DIAGNOSTIC_CONFIDENCES } from "./diagnostics.js";

function salida(over: Partial<DiagnosticOutputRecord> = {}): DiagnosticOutputRecord {
  return diagnosticOutputRecordSchema.parse({
    output_id: "OUT-1",
    case_id: "C-1",
    version: 1,
    ...over,
  });
}

const gateCompleto = Object.fromEntries(FINALIZATION_GATE.map((k) => [k, true]));

const finalizada = (over: Partial<DiagnosticOutputRecord> = {}) =>
  salida({
    ...gateCompleto,
    finalization_status: "finalized_valid",
    snapshot_id: "SNAP-1",
    diagnostic_summary: "La caida se concentra en el paso de pago del checkout",
    confidence_summary: "Media: el encaje temporal es bueno pero faltan los logs de 3DS",
    confidence: "medium",
    confidence_language: "medium",
    ...over,
  });

const reglas = (input: OutputCheckInput) =>
  checkOutputInvariants(input).map((x) => x.rule);

// --- El generador de lenguaje: la deuda que paga D14 -----------------------

test("§43-§46 de D11: cada nivel tiene su formula, y son las de la fuente", () => {
  assert.equal(CONFIDENCE_LEAD_INS.insufficient_data, "No puede determinarse");
  assert.equal(CONFIDENCE_LEAD_INS.low, "Es compatible con");
  assert.equal(CONFIDENCE_LEAD_INS.medium, "La explicación más probable es");
  assert.equal(CONFIDENCE_LEAD_INS.high, "La evidencia sostiene que");
});

test("el generador es total sobre los cuatro niveles", () => {
  for (const nivel of DIAGNOSTIC_CONFIDENCES) {
    const frase = userSummary(nivel, "el fallo de pagos explica la caída");
    assert.ok(frase.length > 0);
    assert.ok(isCalibrated(nivel, frase), `"${frase}" no esta calibrada para ${nivel}`);
  }
});

test("la certeza la pone el nivel, no quien escribe el cuerpo", () => {
  const cuerpo = "el fallo de pagos explica la caída";
  assert.equal(userSummary("low", cuerpo), "Es compatible con el fallo de pagos explica la caída");
  assert.equal(
    userSummary("high", cuerpo),
    "La evidencia sostiene que el fallo de pagos explica la caída",
  );
  // El mismo contenido, cuatro certezas distintas: eso es calibrar.
  const frases = DIAGNOSTIC_CONFIDENCES.map((n) => userSummary(n, cuerpo));
  assert.equal(new Set(frases).size, 4);
});

test("una entradilla sola no es un resumen", () => {
  assert.throws(() => userSummary("high", "   "));
});

test("**el lenguaje descalibrado no se puede construir**", () => {
  // Antes esto era una regex que intentaba cazar "esta claro que". Ahora no
  // hace falta cazarlo: la frase se compone y la entradilla no se elige.
  const frase = userSummary("low", "un problema en el proveedor de pagos");
  assert.ok(!frase.startsWith("Está claro"));
  assert.ok(frase.startsWith("Es compatible con"));
  // Y una frase escrita a mano con la formula de otro nivel no pasa el esquema.
  assert.throws(() =>
    salida({
      confidence: "low",
      confidence_language: "low",
      user_summary: "Está claro que la caída viene del cambio de pagos",
    }),
  );
  assert.throws(() =>
    salida({
      confidence: "insufficient_data",
      confidence_language: "insufficient_data",
      user_summary: "La evidencia sostiene que el checkout fallaba",
    }),
  );
});

test("las cuatro formulas del contrato y las del check de la migracion son las mismas", () => {
  // Estan duplicadas a proposito -- una en TypeScript y otra en SQL -- porque es
  // lo que convierte la calibracion en garantia. Este test existe para que no se
  // separen sin que nadie se entere.
  const aqui = dirname(fileURLToPath(import.meta.url));
  const migracion = readFileSync(
    join(aqui, "../../../supabase/migrations/20260925090000_f3_d14_salida_diagnostica_y_validacion.sql"),
    "utf8",
  );
  for (const [nivel, formula] of Object.entries(CONFIDENCE_LEAD_INS)) {
    assert.ok(
      migracion.includes(`like '${formula}%'`),
      `el check de la migracion no usa "${formula}" para ${nivel}`,
    );
  }
});

test("§25: el lenguaje es el nivel, no una eleccion editorial aparte", () => {
  assert.throws(() => salida({ confidence: "low", confidence_language: "high" }));
});

// --- El gate de finalizacion ------------------------------------------------

test("§38: las doce condiciones del gate, todas", () => {
  assert.equal(FINALIZATION_GATE.length, 12);
  // Quitar cualquiera de las doce tiene que impedir la finalizacion.
  for (const condicion of FINALIZATION_GATE) {
    assert.throws(
      () => finalizada({ [condicion]: false } as Partial<DiagnosticOutputRecord>),
      new RegExp("doce condiciones|gate"),
      `sin "${condicion}" la salida se marco como final igualmente`,
    );
  }
  assert.ok(finalizada());
});

test("§22: sin snapshot no hay salida final", () => {
  assert.throws(() => finalizada({ snapshot_id: undefined }));
});

test("§14: al handoff de F4 solo se llega por el gate", () => {
  assert.throws(() => salida({ handoff_ready: true }));
  assert.ok(finalizada({ handoff_ready: true }));
});

// --- Estados, evidencia y cierre -------------------------------------------

test("§17: CONFIRMED exige causa, confianza compatible y trazabilidad", () => {
  assert.throws(() => salida({ status: "confirmed", confidence: "high", confidence_language: "high" }));
  assert.ok(
    salida({
      status: "confirmed", confidence: "high", confidence_language: "high",
      root_cause_id: "RC-1", traceability_complete: true,
    }),
  );
});

test("§17: INSUFFICIENT_DATA dice que falta", () => {
  assert.throws(() => salida({ status: "insufficient_data" }));
  assert.ok(salida({ status: "insufficient_data", missing_components: ["logs_3ds"] }));
});

test("§6: sustituir conserva el motivo, y la sustituida deja de ser la vigente", () => {
  assert.throws(() => salida({ superseded_by: "OUT-0" }));
  assert.throws(() =>
    salida({ superseded_by: "OUT-0", supersession_reason: "Llegaron datos tardios", is_current: true }),
  );
  assert.ok(
    salida({ superseded_by: "OUT-0", supersession_reason: "Llegaron datos tardios", is_current: false }),
  );
});

test("§33 y §35: un fallo tecnico no es un diagnostico", () => {
  assert.throws(() =>
    finalizada({ failure_kind: "timeout", failure_detail: "El calculo supero los 120s" }),
  );
  assert.throws(() => salida({ failure_kind: "timeout" }));
  assert.ok(salida({ failure_kind: "timeout", failure_detail: "El calculo supero los 120s" }));
});

test("§7: una evidencia sin origen es una afirmacion", () => {
  assert.throws(() =>
    outputEvidenceSchema.parse({
      output_id: "OUT-1", claim: "El revenue cayo un 18%", claim_layer: "what",
      source: "shopify", source_ref: "x",
    }),
  );
});

test("§16: una advertencia sin mensaje no es una advertencia", () => {
  assert.throws(() =>
    outputValidationSchema.parse({ output_id: "OUT-1", validator: "causal", result: "pass_with_warnings" }),
  );
  assert.throws(() =>
    outputValidationSchema.parse({ output_id: "OUT-1", validator: "evidence", result: "valid", blocking: true }),
  );
});

test("§19: un caso no se reabre por un cambio de opinion", () => {
  assert.throws(() =>
    outputTransitionSchema.parse({
      case_id: "C-1", from_status: "closed", to_status: "reopened", actor: "consultant",
      reason: "Creo que nos equivocamos con esto",
    }),
  );
  assert.ok(
    outputTransitionSchema.parse({
      case_id: "C-1", from_status: "closed", to_status: "reopened", actor: "engine",
      reason: "Recaida detectada en la misma metrica y el mismo scope",
      new_evidence: "El CVR vuelve a caer un 14% doce dias despues del cierre",
    }),
  );
});

test("§18: resolver la causa no basta para cerrar", () => {
  assert.throws(() => diagnosticClosureSchema.parse({ case_id: "C-1", closure_kind: "verified" }));
  assert.throws(() =>
    diagnosticClosureSchema.parse({ case_id: "C-1", closure_kind: "administrative" }),
  );
  // Las dos salidas validas: verificar, o declarar que es administrativo.
  assert.ok(
    diagnosticClosureSchema.parse({
      case_id: "C-1", closure_kind: "verified", outcome_verified: true,
      outcome_evidence: "El CVR vuelve al rango de los 90 dias previos durante tres semanas",
    }),
  );
  assert.ok(
    diagnosticClosureSchema.parse({
      case_id: "C-1", closure_kind: "administrative",
      administrative_closure_reason: "La tienda cancelo antes de poder verificar el resultado",
    }),
  );
});

test("§22: reproducible son las cinco condiciones", () => {
  assert.throws(() =>
    diagnosticSnapshotSchema.parse({
      case_id: "C-1", as_of: "2026-09-25T00:00:00Z", reproducible: true,
      snapshot_available: true, sources_resolvable: true,
    }),
  );
  assert.ok(
    diagnosticSnapshotSchema.parse({
      case_id: "C-1", as_of: "2026-09-25T00:00:00Z", reproducible: false,
      reproducibility_limitations: "El snapshot de GA4 de septiembre no se conservo",
    }),
  );
});

// --- Las reglas que miran el conjunto --------------------------------------

test("§16: una salida final ha pasado los once validadores", () => {
  const r = reglas({ output: finalizada(), validations: [] });
  assert.ok(r.includes("validadores_sin_ejecutar"));

  const todos = VALIDATORS.map((v) =>
    outputValidationSchema.parse({ output_id: "OUT-1", validator: v, result: "valid" }),
  );
  assert.ok(!reglas({ output: finalizada(), validations: todos }).includes("validadores_sin_ejecutar"));
});

test("§16: un validador en `invalid` no deja salir nada como final", () => {
  const validaciones = VALIDATORS.map((v) =>
    outputValidationSchema.parse({
      output_id: "OUT-1", validator: v,
      result: v === "causal" ? "invalid" : "valid",
      message: v === "causal" ? "La ruta causal no se puede reconstruir" : undefined,
    }),
  );
  assert.ok(reglas({ output: finalizada(), validations: validaciones }).includes("final_con_validacion_invalida"));
});

test("§7 y §8: una causa confirmada se ancla a evidencia de su capa", () => {
  const r = reglas({
    output: salida({
      status: "confirmed", confidence: "medium", confidence_language: "medium",
      root_cause_id: "RC-1", traceability_complete: true,
    }),
    evidence: [
      outputEvidenceSchema.parse({
        output_id: "OUT-1", claim: "El revenue cayo un 18%", claim_layer: "what",
        source: "shopify", source_ref: "orders/2026-09",
      }),
    ],
  });
  assert.ok(r.includes("causa_sin_evidencia_trazable"));
});

test("§41: una conclusion en alta sin contraria registrada es sospechosa", () => {
  const r = reglas({
    output: salida({ confidence: "high", confidence_language: "high" }),
    evidence: [
      outputEvidenceSchema.parse({
        output_id: "OUT-1", claim: "El fallo de pagos explica la caida", claim_layer: "root_cause",
        source: "shopify", source_ref: "orders/2026-09", stance: "supporting",
      }),
    ],
  });
  assert.ok(r.includes("sin_contraria_registrada"));

  const conContraria = reglas({
    output: salida({ confidence: "high", confidence_language: "high" }),
    evidence: [
      outputEvidenceSchema.parse({
        output_id: "OUT-1", claim: "El fallo de pagos explica la caida", claim_layer: "root_cause",
        source: "shopify", source_ref: "orders/2026-09", stance: "supporting",
      }),
      outputEvidenceSchema.parse({
        output_id: "OUT-1", claim: "El fallo de pagos explica la caida", claim_layer: "root_cause",
        source: "ga4", source_ref: "sessions/2026-09", stance: "contradicting",
      }),
    ],
  });
  assert.ok(!conContraria.includes("sin_contraria_registrada"));
});

test("§18: cerrado sin verificar el resultado ni declararlo administrativo", () => {
  const r = reglas({ output: salida({ status: "closed" }) });
  assert.ok(r.includes("cerrado_sin_verificar_el_resultado"));
});

test("§22: una salida final sobre un snapshot no reproducible", () => {
  const r = reglas({
    output: finalizada(),
    snapshot: diagnosticSnapshotSchema.parse({
      case_id: "C-1", as_of: "2026-09-25T00:00:00Z", reproducible: false,
      reproducibility_limitations: "El snapshot de GA4 de septiembre no se conservo",
    }),
  });
  assert.ok(r.includes("final_no_reproducible"));
});

test("§12: los resumenes obligatorios de una salida final", () => {
  const r = reglas({ output: finalizada({ confidence_summary: undefined }) });
  assert.ok(r.includes("resumenes_obligatorios_ausentes"));
});

// --- Lo estructural --------------------------------------------------------

test("§13 y §41: D14 no recomienda, no prioriza y no elige estrategia", () => {
  const campos = Object.keys(diagnosticOutputRecordFields.shape);
  for (const prohibido of [
    "priority", "recommended_action", "action", "strategy", "allocation",
    "next_step", "playbook", "urgency",
  ]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" es F4, no D14 (apartados 13 y 41)`);
  }
});

test("§9 y §41: el actor de una transicion es un rol, no una persona", () => {
  // Misma decision que en D09: en fase 3 no hay donde escribir un nombre.
  assert.throws(() =>
    outputTransitionSchema.parse({
      case_id: "C-1", to_status: "investigating", actor: "rafa",
      reason: "Empieza a mirarlo el consultor asignado",
    }),
  );
});

test("§16: los once validadores, sin repetir", () => {
  assert.equal(VALIDATORS.length, 11);
  assert.equal(new Set(VALIDATORS).size, 11);
});
