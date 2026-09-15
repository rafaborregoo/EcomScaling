/**
 * FASE 3 / D11: confianza e incertidumbre.
 *
 * El bloque que audita a los diez anteriores. Casi todos estos tests comprueban
 * lo mismo por sitios distintos: que la confianza salga de la evidencia y no de
 * lo seguro que suene la frase, y que decir "no lo se" siga siendo una salida
 * valida del sistema.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  checkConfidenceInvariants,
  claimConfidenceFields,
  claimConfidenceSchema,
  confidenceDimensionSchema,
  confidenceCapSchema,
  confidenceHistorySchema,
  knowledgeApplicabilitySchema,
  uncertaintySchema,
  CONFIDENCE_DIMENSIONS,
  EPISTEMIC_STATES,
  type ClaimConfidence,
  type ConfidenceCheckInput,
} from "./confidence.js";

function claim(over: Partial<ClaimConfidence> = {}): ClaimConfidence {
  return claimConfidenceSchema.parse({
    claim_id: "CL-1",
    claim_layer: "why",
    claim: "La caida de conversion se concentra en el paso de pago",
    target_question: "Por que cae la conversion del checkout?",
    // El defecto del esquema es `unknown`, y `unknown` solo admite
    // INSUFFICIENT_DATA (guardrail 22). Los claims de estos tests afirman algo,
    // asi que parten de inferido.
    epistemic_state: "inferred",
    ...over,
  });
}

const alta = (over: Partial<ClaimConfidence> = {}) =>
  claim({
    confidence_level: "high",
    alternative_separation: "strong",
    epistemic_state: "observed",
    ...over,
  });

const dimension = (over: Record<string, unknown> = {}) =>
  confidenceDimensionSchema.parse({
    claim_id: "CL-1",
    dimension: "data_reliability",
    rating: "strong",
    reason: "Shopify reconciliado contra el proveedor de pagos sin desajuste",
    ...over,
  });

const reglas = (input: ConfidenceCheckInput) =>
  checkConfidenceInvariants(input).map((x) => x.rule);

// --- El contrato de la fila ------------------------------------------------

test("un claim con confianza alta y sus insumos no dispara nada", () => {
  assert.deepEqual(reglas({ claims: [alta()], dimensions: [dimension()] }), []);
});

test("§17 y §94: no hay confianza sin claim y sin pregunta", () => {
  assert.throws(() => claim({ claim: "pagos" }));
  assert.throws(() => claim({ target_question: "por que" }));
});

test("§5: un cap que no baja el nivel no es un cap", () => {
  assert.throws(() =>
    alta({ capped_at: "medium", cap_reason: "La reconciliacion tiene un 6% de desajuste" }),
  );
  assert.throws(() => claim({ capped_at: "medium" }));
  assert.ok(
    claim({
      confidence_level: "medium",
      capped_at: "medium",
      cap_reason: "La reconciliacion con el proveedor tiene un 6% de desajuste",
    }),
  );
});

test("§25 y §78: importa la fuerza de las alternativas que sobreviven, no cuantas hay", () => {
  assert.throws(() => claim({ confidence_level: "high", alternative_separation: "weak" }));
  // Y `not_applicable` tambien deja subir: hay claims sin alternativas rivales.
  assert.ok(claim({ confidence_level: "high", alternative_separation: "not_applicable" }));
});

test("§12: una contradiccion material no convive con confianza alta", () => {
  assert.throws(() => alta({ contradiction_level: "material" }));
  assert.throws(() => alta({ contradiction_level: "decisive" }));
});

test("§23 y §2: CONFIRMED exige validacion, y alta no exime de limitaciones", () => {
  assert.throws(() => alta({ epistemic_state: "confirmed" }));
  assert.ok(
    alta({
      epistemic_state: "confirmed",
      limitations: "No se pudo comparar con un mercado control durante el periodo",
    }),
  );
});

test("§24: una suposicion no se presenta como un hecho", () => {
  assert.throws(() => alta({ epistemic_state: "hypothesized" }));
});

test("§22 y §60: el sistema puede decir que todavia no lo sabe", () => {
  assert.throws(() => claim({ epistemic_state: "unknown", confidence_level: "medium" }));
  assert.ok(claim({ epistemic_state: "unknown", confidence_level: "insufficient_data" }));
});

test("§8, §29, §30 y §31: no haber visto no es haber visto que no", () => {
  // Sin cobertura declarada no se afirma ausencia.
  assert.throws(() =>
    claim({ negative_claim_state: "evidence_of_no_problem", confidence_level: "medium" }),
  );
  // La estabilidad exige ademas medicion completa y observada.
  assert.throws(() =>
    claim({
      negative_claim_state: "evidence_of_stability",
      coverage_declared: "Los cuatro canales con gasto",
      completeness: "partial",
    }),
  );
  // Si faltan datos, lo unico que cabe es NO_EVIDENCE.
  assert.throws(() =>
    claim({
      negative_claim_state: "evidence_of_no_problem",
      coverage_declared: "Los cuatro canales",
      confidence_level: "insufficient_data",
    }),
  );
  assert.ok(
    claim({
      negative_claim_state: "evidence_of_stability",
      coverage_declared: "Los cuatro canales con gasto, reconciliados con la plataforma",
      completeness: "complete_enough",
      epistemic_state: "observed",
      confidence_level: "high",
      alternative_separation: "not_applicable",
    }),
  );
});

test("§23: querer mas confianza sin decir que falta no es un plan", () => {
  assert.throws(() => claim({ desired_level: "high" }));
});

test("§35: una limitacion de plantilla no es una limitacion", () => {
  assert.throws(() => claim({ limitations: "Datos limitados" }));
});

test("§30: una dimension puntuada sin motivo no explica nada", () => {
  assert.throws(() => dimension({ reason: "ok" }));
});

test("§4: la separacion frente a alternativas no es una dimension, vive en el claim", () => {
  assert.ok(!(CONFIDENCE_DIMENSIONS as readonly string[]).includes("alternative_separation"));
  assert.ok(!(CONFIDENCE_DIMENSIONS as readonly string[]).includes("contradiction_level"));
  assert.throws(() => dimension({ dimension: "alternative_separation" }));
});

test("§33 y §34: un critical unknown no se deja caer, y el boilerplate no informa", () => {
  assert.throws(() =>
    uncertaintySchema.parse({
      uncertainty_id: "U-1", uncertainty_type: "data", description: "Hay incertidumbre",
    }),
  );
  assert.throws(() =>
    uncertaintySchema.parse({
      uncertainty_id: "U-1", uncertainty_type: "causal", materiality: "critical_unknown",
      description: "No sabemos si el cambio de 3DS coincide con la caida de autorizaciones",
    }),
  );
  assert.ok(
    uncertaintySchema.parse({
      uncertainty_id: "U-1", uncertainty_type: "causal", materiality: "critical_unknown",
      claim_id: "CL-1",
      description: "No sabemos si el cambio de 3DS coincide con la caida de autorizaciones",
      required_evidence: "Logs de autenticacion del proveedor",
    }),
  );
});

test("§10: lo que no tiene solucion no pide evidencia para resolverse", () => {
  assert.throws(() =>
    uncertaintySchema.parse({
      uncertainty_id: "U-2", uncertainty_type: "knowledge", resolvability: "not_resolvable",
      description: "No se puede saber que promociones lanzo la competencia en el periodo",
      required_evidence: "El plan de la competencia",
    }),
  );
  assert.ok(
    uncertaintySchema.parse({
      uncertainty_id: "U-2", uncertainty_type: "knowledge", resolvability: "not_resolvable",
      description: "No se puede saber que promociones lanzo la competencia en el periodo",
    }),
  );
});

test("§18 y §120: un cambio sin motivo, o sin cambio, no es historico", () => {
  assert.throws(() =>
    confidenceHistorySchema.parse({
      claim_id: "CL-1", previous_level: "medium", new_level: "medium",
      reason: "Revisado de nuevo sin novedades relevantes",
    }),
  );
  assert.throws(() =>
    confidenceHistorySchema.parse({
      claim_id: "CL-1", previous_level: "low", new_level: "medium", reason: "subio",
    }),
  );
});

test("§6 y §39: ni el parecido ni la autoridad hacen aplicable algo", () => {
  assert.throws(() =>
    knowledgeApplicabilitySchema.parse({
      claim_id: "CL-1", source_ref: "rag://benchmarks", applicability: "high",
      retrieval_similarity: 0.97, source_authority: "canonical",
    }),
  );
  // Un 0.97 con aplicabilidad baja es perfectamente valido: el numero no sube nada.
  assert.ok(
    knowledgeApplicabilitySchema.parse({
      claim_id: "CL-1", source_ref: "rag://benchmarks", applicability: "low",
      retrieval_similarity: 0.97, source_authority: "expert",
    }),
  );
});

test("§41: lo caducado no puede ser muy aplicable", () => {
  assert.throws(() =>
    knowledgeApplicabilitySchema.parse({
      claim_id: "CL-1", source_ref: "rag://guia-2019", applicability: "medium", is_stale: true,
    }),
  );
});

// --- Las reglas que miran el conjunto --------------------------------------

test("§1 y §30: una confianza alta sin insumos sale de como suena la frase", () => {
  assert.ok(reglas({ claims: [alta()] }).includes("confianza_sin_insumos"));
});

test("§7 y §11: tres metricas del mismo origen son una, no tres", () => {
  const r = reglas({
    claims: [claim({ confidence_level: "medium" })],
    dimensions: [
      dimension({
        dimension: "evidence_independence", rating: "weak",
        reason: "Las tres metricas salen del mismo pixel de GA",
      }),
    ],
  });
  assert.ok(r.includes("evidencia_dependiente_infla"));
});

test("§4: confianza y completitud no se colapsan", () => {
  const r = reglas({
    claims: [claim({ completeness: "incomplete", explanatory_coverage: "full" })],
    dimensions: [dimension()],
  });
  assert.ok(r.includes("completitud_leida_como_confianza"));
});

test("§8: afirmar que no hay problema con cobertura debil", () => {
  const r = reglas({
    claims: [
      claim({
        negative_claim_state: "evidence_of_no_problem",
        coverage_declared: "Solo el canal directo",
        confidence_level: "medium",
      }),
    ],
    dimensions: [
      dimension({
        dimension: "data_coverage", rating: "weak",
        reason: "Solo se observa uno de los cuatro canales con gasto",
      }),
    ],
  });
  assert.ok(r.includes("ausencia_no_es_prueba"));
});

test("§33: un critical unknown sobre el claim y la confianza sigue alta", () => {
  const r = reglas({
    claims: [alta({ limitations: "Los logs de autenticacion del proveedor no estan disponibles" })],
    dimensions: [dimension()],
    uncertainties: [
      uncertaintySchema.parse({
        uncertainty_id: "U-1", claim_id: "CL-1", uncertainty_type: "causal",
        materiality: "critical_unknown",
        description: "No sabemos si el cambio de 3DS coincide con la caida de autorizaciones",
        required_evidence: "Logs de autenticacion",
      }),
    ],
  });
  assert.ok(r.includes("unknown_critico_ignorado"));
});

test("§33 y §37: critical unknowns en el caso y ningun claim con limitaciones", () => {
  const r = reglas({
    claims: [claim({ confidence_level: "medium" })],
    dimensions: [dimension()],
    uncertainties: [
      uncertaintySchema.parse({
        uncertainty_id: "U-1", claim_id: "CL-9", uncertainty_type: "data",
        materiality: "critical_unknown",
        description: "La reconciliacion de pedidos con el ERP lleva once dias sin correr",
        required_evidence: "Ejecucion de la reconciliacion",
      }),
    ],
  });
  assert.ok(r.includes("unknown_critico_oculto"));
});

test("§48 y §51: una confianza caducada no sostiene una alta", () => {
  const r = reglas({
    claims: [alta({ is_stale: true, decay_reason: "Cambio el proveedor de pagos hace dos semanas" })],
    dimensions: [dimension()],
  });
  assert.ok(r.includes("caducado_no_sostiene_alta"));
});

test("§52 y §53: una confianza baja no puede tapar un riesgo serio", () => {
  const r = reglas({
    claims: [claim({ confidence_level: "low", error_cost: "severe" })],
    dimensions: [dimension()],
  });
  assert.ok(r.includes("riesgo_serio_sin_declarar"));
});

test("§23: identificar el hueco sin decir como se llena deja el plan a medias", () => {
  const r = reglas({
    claims: [claim({ desired_level: "high", missing_evidence: "Logs de autenticacion" })],
    dimensions: [dimension()],
  });
  assert.ok(r.includes("mejora_sin_siguiente_paso"));
});

test("§6, §39 y §40: la confianza no se apoya solo en documentos recuperados", () => {
  const r = reglas({
    claims: [claim({ confidence_level: "medium" })],
    knowledge: [
      knowledgeApplicabilitySchema.parse({
        claim_id: "CL-1", source_ref: "rag://benchmarks-checkout",
        source_authority: "canonical", retrieval_similarity: 0.94, applicability: "medium",
      }),
    ],
  });
  assert.ok(r.includes("autoridad_no_sustituye_evidencia"));
});

test("§43 a §47: el lenguaje se calibra a la confianza", () => {
  const r = reglas({
    claims: [
      claim({
        claim: "Esta claro que la caida viene del cambio de proveedor de pagos",
        confidence_level: "low",
      }),
    ],
    dimensions: [dimension()],
  });
  assert.ok(r.includes("lenguaje_por_encima_de_la_confianza"));
});

test("§181: la global puede quedar por debajo de sus capas, nunca por encima", () => {
  const porEncima = reglas({
    claims: [
      alta({ claim_id: "CL-0", claim_layer: "overall", claim: "La explicacion global del caso es el cambio de pagos" }),
      claim({ claim_id: "CL-1", claim_layer: "root_cause", confidence_level: "medium" }),
    ],
    dimensions: [dimension({ claim_id: "CL-0" })],
  });
  assert.ok(porEncima.includes("global_por_encima_de_sus_capas"));

  // Al reves es justo lo que el apartado 181 describe como correcto.
  const bien = reglas({
    claims: [
      claim({ claim_id: "CL-0", claim_layer: "overall", claim: "La explicacion global del caso es el cambio de pagos", confidence_level: "medium" }),
      alta({ claim_id: "CL-1", claim_layer: "severity", claim: "La gravedad es critica: el 82% del checkout esta expuesto" }),
    ],
    dimensions: [dimension({ claim_id: "CL-1" })],
  });
  assert.ok(!bien.includes("global_por_encima_de_sus_capas"));
});

test("§5: un cap declarado que el claim ignora no ha capado nada", () => {
  const r = reglas({
    claims: [alta()],
    dimensions: [dimension()],
    caps: [
      confidenceCapSchema.parse({
        claim_id: "CL-1", cap_source: "data_quality", capped_level: "medium",
        reason: "La reconciliacion con el proveedor tiene un 6% de desajuste",
      }),
    ],
  });
  assert.ok(r.includes("cap_declarado_sin_efecto"));
});

// --- Lo estructural --------------------------------------------------------

test("§36 y §149: el unico numero del bloque esta en la tabla que no decide nada", () => {
  // "Confianza: 75%" esta literalmente prohibido. La garantia no es una regla
  // de estilo: es que en todo D11 solo hay un campo numerico, y vive en la
  // entidad de conocimiento recuperado, que por si sola no valida nada.
  const esquemas: Record<string, z.ZodObject<z.ZodRawShape>> = {
    claim: claimConfidenceFields,
    dimension: confidenceDimensionSchema,
    cap: confidenceCapSchema,
  };
  const numericos: string[] = [];
  for (const [nombre, esquema] of Object.entries(esquemas)) {
    for (const [campo, def] of Object.entries(esquema.shape)) {
      let t: unknown = def;
      let guardia = 0;
      while (typeof (t as { unwrap?: unknown }).unwrap === "function" && guardia++ < 5) {
        t = (t as { unwrap: () => unknown }).unwrap();
      }
      if (t instanceof z.ZodNumber) numericos.push(`${nombre}.${campo}`);
    }
  }
  assert.deepEqual(numericos, [], "la confianza no se expresa con un numero (guardrail 36)");
});

test("§36: no hay donde escribir un score ni un porcentaje de certeza", () => {
  const campos = Object.keys(claimConfidenceFields.shape);
  for (const prohibido of [
    "confidence_score", "score", "probability", "certainty_pct", "percent",
    "confidence_value", "weight",
  ]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" seria el porcentaje opaco del guardrail 36`);
  }
});

test("§57 y §58: D11 no prioriza ni convierte la confianza en accion", () => {
  const campos = Object.keys(claimConfidenceFields.shape);
  for (const prohibido of ["priority", "action", "recommendation", "next_step", "severity"]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" no sale de D11 (guardrails 57 y 58)`);
  }
});

test("§21 y §53 del corpus: los seis estados epistemicos siguen siendo seis", () => {
  // Aplanarlos a "lo sabemos / no lo sabemos" es el error que el bloque existe
  // para impedir: derivado, inferido e hipotetizado no son la misma cosa.
  assert.deepEqual(
    [...EPISTEMIC_STATES],
    ["observed", "derived", "inferred", "hypothesized", "confirmed", "unknown"],
  );
});

test("§9: la confianza de la gravedad y la de la causa son independientes", () => {
  // Apartado 184: severidad alta con causa raiz baja tiene que caber. No hay
  // ninguna regla que las ate, y este test existe para que nadie las ate luego.
  const r = reglas({
    claims: [
      alta({
        claim_id: "CL-1", claim_layer: "severity",
        claim: "La gravedad es critica: el 82% del checkout esta expuesto",
        alternative_separation: "not_applicable",
      }),
      claim({
        claim_id: "CL-2", claim_layer: "root_cause", confidence_level: "low",
        claim: "El cambio de configuracion de 3DS encaja temporalmente",
        epistemic_state: "inferred", alternative_separation: "weak",
      }),
    ],
    dimensions: [dimension({ claim_id: "CL-1" }), dimension({ claim_id: "CL-2" })],
  });
  assert.deepEqual(r, []);
});

test("§8 del contrato: no se modela el unknown unknown, y es deliberado", () => {
  // Solo existe `is_known_unknown`. Fingir un catalogo de lo que no se sabe que
  // no se sabe seria la sobreconfianza que el bloque combate (guardrail 38).
  const u = uncertaintySchema.parse({
    uncertainty_id: "U-1", uncertainty_type: "model",
    description: "El modelo de atribucion podria estar repartiendo mal entre canales",
  });
  assert.equal(u.is_known_unknown, true);
  assert.ok(!Object.keys(u).includes("is_unknown_unknown"));
});
