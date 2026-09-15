/**
 * FASE 3 / D06: el motor de sintomas.
 *
 * Cada test reproduce un salto que un guardrail prohibe -- casi siempre el
 * mismo salto: dar por relacionado lo que solo coincide, o por explicado lo que
 * solo se parece a algo de antes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSymptoms,
  checkSymptomInvariants,
  classifyPersistence,
  engineSymptomFields,
  engineSymptomSchema,
  symptomEvidenceSchema,
  symptomRelationSchema,
  SYMPTOM_RELATIONS,
  type EngineSymptom,
  type MetricDependency,
  type SignalForSymptom,
  type SymptomCheckInput,
} from "./symptoms.js";

function sintoma(over: Partial<EngineSymptom> & { symptom_id?: string } = {}): EngineSymptom {
  return engineSymptomSchema.parse({
    symptom_id: "SY-1",
    symptom_family: "conversion",
    canonical_type: "cvr_drop",
    label: "La conversion se ablanda en movil",
    valence: "negative",
    ...over,
  });
}

const reglas = (over: Partial<SymptomCheckInput> = {}) =>
  checkSymptomInvariants({ symptoms: [sintoma()], ...over }).map((x) => x.rule);

// --- El contrato de la fila ------------------------------------------------

test("un sintoma descriptivo y modesto no dispara nada", () => {
  assert.deepEqual(reglas(), []);
});

test("§9 y §10: afirmar relacion obliga a decir de que clase", () => {
  assert.throws(() =>
    engineSymptomSchema.parse({
      symptom_id: "SY-2",
      symptom_family: "acquisition",
      canonical_type: "cac_up",
      label: "CAC al alza",
      valence: "negative",
      known_relationship: true,
    }),
  );
});

test("§12 y §34: un cluster debil no se eleva a sintoma fuerte", () => {
  assert.throws(() =>
    engineSymptomSchema.parse({
      symptom_id: "SY-3",
      symptom_family: "creative",
      canonical_type: "ctr_decay",
      label: "CTR cayendo",
      valence: "negative",
      confidence: "high",
      context_reviewed: true,
      known_relationship: true,
      coherence_relationship: "funnel",
      compatible_scope: true,
      sufficient_signal_quality: false,
    }),
  );
});

test("§33: la confianza del sintoma no supera a la del dato", () => {
  assert.throws(() =>
    engineSymptomSchema.parse({
      symptom_id: "SY-4",
      symptom_family: "data",
      canonical_type: "tracking_gap",
      label: "Hueco de tracking",
      valence: "negative",
      data_confidence: "insufficient_data",
      confidence: "high",
      context_reviewed: true,
      known_relationship: true,
      coherence_relationship: "functional",
      compatible_scope: true,
      sufficient_signal_quality: true,
    }),
  );
});

test("§19 y §20: sin mirar el contexto no se afirma con fuerza", () => {
  assert.throws(() =>
    engineSymptomSchema.parse({
      symptom_id: "SY-5",
      symptom_family: "offer",
      canonical_type: "discount_dependency",
      label: "Dependencia del descuento",
      valence: "negative",
      confidence: "high",
      context_reviewed: false,
      known_relationship: true,
      coherence_relationship: "economic",
      compatible_scope: true,
      sufficient_signal_quality: true,
    }),
  );
});

test("§23, §25 y §26: un sintoma localizado tiene que decir donde", () => {
  assert.throws(() =>
    engineSymptomSchema.parse({
      symptom_id: "SY-6",
      symptom_family: "conversion",
      canonical_type: "checkout_fail",
      label: "Fallo de checkout",
      valence: "negative",
      scope: "market",
    }),
  );
  // Con el detalle puesto, el mismo sintoma entra.
  assert.ok(
    sintoma({ symptom_id: "SY-6b", scope: "market", scope_detail: { market: "FR" } }),
  );
});

test("§35: tres resenas no son trescientas, y callarlo las iguala", () => {
  assert.throws(() =>
    symptomEvidenceSchema.parse({
      symptom_id: "SY-1",
      source_kind: "review",
      observation: "Se quejan del envio",
    }),
  );
  assert.throws(() =>
    symptomEvidenceSchema.parse({
      symptom_id: "SY-1",
      source_kind: "survey",
      observation: "La mayoria se queja",
      representativeness: "high",
    }),
  );
});

// --- Las reglas que miran mas de una fila ----------------------------------

test("§9: agrupar dos senales sin relacion declarada es coincidencia, no sintoma", () => {
  const r = reglas({
    signals: [
      { symptom_id: "SY-1", signal_id: "S-a", role: "supporting" },
      { symptom_id: "SY-1", signal_id: "S-b", role: "supporting" },
    ],
  });
  assert.ok(r.includes("simultaneidad_no_es_sintoma"));
});

test("§9: con la relacion declarada, las mismas dos senales si forman sintoma", () => {
  const r = checkSymptomInvariants({
    symptoms: [
      sintoma({ known_relationship: true, coherence_relationship: "funnel" }),
    ],
    signals: [
      { symptom_id: "SY-1", signal_id: "S-a", role: "supporting" },
      { symptom_id: "SY-1", signal_id: "S-b", role: "supporting" },
    ],
  }).map((x) => x.rule);
  assert.deepEqual(r, []);
});

test("§13: lo que contradice se conserva y baja la confianza", () => {
  const r = checkSymptomInvariants({
    symptoms: [
      sintoma({
        confidence: "high",
        context_reviewed: true,
        known_relationship: true,
        coherence_relationship: "funnel",
        compatible_scope: true,
        sufficient_signal_quality: true,
      }),
    ],
    signals: [{ symptom_id: "SY-1", signal_id: "S-x", role: "contradicting" }],
  }).map((x) => x.rule);
  assert.ok(r.includes("contradiccion_preservada"));
});

test("§28: profundo sin evidencia es especificidad inventada", () => {
  const r = reglas({ symptoms: [sintoma({ diagnostic_depth: "deep" })] });
  assert.ok(r.includes("profundidad_exige_evidencia"));
});

test("§23: no se declara global lo que solo pasa en un sitio", () => {
  const r = checkSymptomInvariants({
    symptoms: [sintoma({ known_relationship: true, coherence_relationship: "funnel" })],
    signals: [
      { symptom_id: "SY-1", signal_id: "S-a", role: "supporting", signal_scope: "market:FR" },
      { symptom_id: "SY-1", signal_id: "S-b", role: "supporting", signal_scope: "market:FR" },
    ],
  }).map((x) => x.rule);
  assert.ok(r.includes("local_no_se_generaliza"));
});

test("§24: pero un sintoma local declarado como local no molesta a nadie", () => {
  const r = checkSymptomInvariants({
    symptoms: [
      sintoma({
        scope: "market",
        scope_detail: { market: "FR" },
        known_relationship: true,
        coherence_relationship: "funnel",
      }),
    ],
    signals: [
      { symptom_id: "SY-1", signal_id: "S-a", role: "supporting", signal_scope: "market:FR" },
      { symptom_id: "SY-1", signal_id: "S-b", role: "supporting", signal_scope: "market:FR" },
    ],
  }).map((x) => x.rule);
  assert.deepEqual(r, []);
});

test("§36: que ya pasara antes no sostiene el sintoma de ahora", () => {
  const r = reglas({
    symptoms: [
      sintoma({
        previous_symptom_id: "SY-viejo",
        confidence: "high",
        context_reviewed: true,
        known_relationship: true,
        coherence_relationship: "temporal",
        compatible_scope: true,
        sufficient_signal_quality: true,
      }),
    ],
  });
  assert.ok(r.includes("memoria_no_es_causa"));
});

test("§43 y §44: el diagnostico no se para en el resultado si hay con que bajar", () => {
  const r = checkSymptomInvariants({
    symptoms: [
      sintoma({
        symptom_family: "financial",
        canonical_type: "revenue_decline",
        label: "Los ingresos bajan",
        process_position: "downstream",
        diagnostic_depth: "surface",
        known_relationship: true,
        coherence_relationship: "mathematical",
      }),
    ],
    signals: [
      { symptom_id: "SY-1", signal_id: "S-a", role: "supporting" },
      { symptom_id: "SY-1", signal_id: "S-b", role: "supporting" },
    ],
  }).map((x) => x.rule);
  assert.ok(r.includes("downstream_no_detiene_la_investigacion"));
});

test("§32: un positivo comercial no cancela un negativo economico", () => {
  const r = checkSymptomInvariants({
    symptoms: [
      sintoma({
        symptom_id: "SY-padre",
        label: "El trimestre va bien",
        valence: "positive",
        known_relationship: true,
        coherence_relationship: "economic",
      }),
      sintoma({
        symptom_id: "SY-hijo",
        symptom_family: "financial",
        canonical_type: "margin_erosion",
        label: "El margen se erosiona",
        valence: "negative",
        parent_symptom_id: "SY-padre",
      }),
    ],
  }).map((x) => x.rule);
  assert.ok(r.includes("economico_no_se_cancela"));
});

test("§30 y §31: no se fuerza una narrativa unica sobre problemas independientes", () => {
  const r = checkSymptomInvariants({
    symptoms: [
      sintoma({ symptom_id: "SY-padre", label: "Todo es lo mismo", valence: "mixed" }),
      sintoma({ symptom_id: "SY-a", symptom_family: "inventory", parent_symptom_id: "SY-padre" }),
      sintoma({ symptom_id: "SY-b", symptom_family: "creative", parent_symptom_id: "SY-padre" }),
    ],
  }).map((x) => x.rule);
  assert.ok(r.includes("narrativa_unica_forzada"));
});

test("§31: sintomas positivos y negativos pueden convivir sin cancelarse", () => {
  const r = checkSymptomInvariants({
    symptoms: [
      sintoma({ symptom_id: "SY-a", valence: "negative" }),
      sintoma({ symptom_id: "SY-b", symptom_family: "retention", valence: "positive" }),
    ],
  }).map((x) => x.rule);
  assert.deepEqual(r, []);
});

// --- Lo estructural --------------------------------------------------------

test("§22 y §1-§8: el sintoma no tiene donde escribir causa, accion ni prioridad", () => {
  const campos = Object.keys(engineSymptomFields.shape);
  for (const prohibido of [
    "hypothesis",
    "cause",
    "root_cause",
    "constraint",
    "action",
    "recommendation",
    "priority",
    "severity",
    "health_state",
    "maturity_gap",
  ]) {
    assert.ok(
      !campos.includes(prohibido),
      `"${prohibido}" esta fuera de la frontera de D06 (guardrails 1 a 8 y 22)`,
    );
  }
});

test("§21 y §22: no hay `direction` de la que derivar la valencia", () => {
  // "CAC arriba" no es automaticamente un sintoma negativo. La garantia no es
  // una regla que lo prohiba: es que el dato no esta en esta tabla.
  const campos = Object.keys(engineSymptomFields.shape);
  assert.ok(!campos.includes("direction"));
  assert.ok(!campos.includes("metric_direction"));
  assert.ok(campos.includes("valence"));
});

test("§18: el catalogo de relaciones no admite causalidad", () => {
  for (const causal of ["causes", "caused_by", "because_of", "explains"]) {
    assert.ok(
      !(SYMPTOM_RELATIONS as readonly string[]).includes(causal),
      `"${causal}" convertiria el grafo de sintomas en un grafo causal (guardrail 18); eso es D07`,
    );
  }
  assert.throws(() =>
    symptomRelationSchema.parse({
      from_symptom_id: "SY-1",
      to_symptom_id: "SY-2",
      relation: "causes",
    }),
  );
});

test("§40, §41 y §42: salud y sintoma coexisten, y eso se permite a proposito", () => {
  // Una capacidad sana puede presentar un sintoma adelantado de riesgo. No hay
  // ninguna regla que lo impida, y este test existe para que nadie anada una.
  const r = reglas({
    symptoms: [
      sintoma({
        canonical_type: "repeat_softening",
        label: "La recompra se ablanda en clientes nuevos",
        time_role: "leading",
        scope: "segment",
        scope_detail: { segment: "clientes nuevos" },
      }),
    ],
  });
  assert.deepEqual(r, []);
});

// ---------------------------------------------------------------------------
// EL MOTOR
// ---------------------------------------------------------------------------
//
// El fallo que persiguen estos tests es siempre el mismo y es el del bloque
// entero: **convertir una coincidencia en un patron**. Todo lo demas --las
// familias, la profundidad, el rol temporal-- es catalogo; esto es la linea.

const SENAL_BASE: SignalForSymptom = {
  signal_id: "s-ventas",
  metric: "net_sales",
  capability: "unit_economics",
  scope: "global",
  direction: "down",
  window_start: "2026-08-01T00:00:00.000Z",
  window_end: "2026-09-27T00:00:00.000Z",
  persistence: "persistent",
  business_relevance: "medium",
  data_confidence: "high",
  signal_confidence: "medium",
  low_sample: false,
};

const senal = (over: Partial<SignalForSymptom> = {}): SignalForSymptom => ({
  ...SENAL_BASE,
  ...over,
});

/** La dependencia real que ya vive en `metric_dependencies`. */
const COMPOSICION: MetricDependency[] = [
  {
    metric: "net_sales",
    depends_on: "orders_count",
    relation: "component",
    rationale: "las ventas netas son pedidos por ticket medio",
  },
];

test("D06 motor: coincidir en el tiempo no crea un sintoma compuesto", () => {
  // Guardrail 9, que es el motivo de existir del bloque. Sin relacion
  // declarada, dos senales simultaneas son dos sintomas independientes.
  const salida = buildSymptoms({
    signals: [
      senal(),
      senal({ signal_id: "s-pedidos", metric: "orders_count", capability: "conversion" }),
    ],
    dependencies: [],
    scope: "business",
  });

  assert.equal(salida.symptoms.length, 2);
  assert.ok(salida.symptoms.every((s) => s.parent_symptom_id == null));
  assert.ok(salida.symptoms.every((s) => !s.known_relationship));
  // Lo que si se anota es que coinciden: candidata, no causal.
  assert.equal(salida.relations.length, 1);
  assert.equal(salida.relations[0]!.relation, "often_cooccurs");
});

test("D06 motor: con la relacion declarada, el dependiente es el padre", () => {
  // Paso 15: revenue decline -> sus componentes. El padre es la metrica de
  // aguas abajo, no la primera de la lista.
  const salida = buildSymptoms({
    signals: [
      senal({ signal_id: "s-pedidos", metric: "orders_count", capability: "conversion" }),
      senal(),
    ],
    dependencies: COMPOSICION,
    scope: "business",
  });

  const padre = salida.symptoms.find((s) => s.canonical_type === "net_sales_decline")!;
  const hijo = salida.symptoms.find((s) => s.canonical_type === "order_volume_decline")!;
  assert.equal(hijo.parent_symptom_id, padre.symptom_id);
  assert.equal(padre.parent_symptom_id, undefined);
  assert.equal(padre.coherence_relationship, "mathematical");
  // Guardrail 43: descompuesto deja de ser superficie.
  assert.equal(padre.diagnostic_depth, "intermediate");
});

test("D06 motor: lo que contradice se guarda, no se descarta", () => {
  // Ventas abajo con pedidos arriba: el ticket medio se hundio. Descartar la
  // senal que no encaja es como se fabrica un diagnostico limpio y falso.
  const salida = buildSymptoms({
    signals: [
      senal(),
      senal({
        signal_id: "s-pedidos",
        metric: "orders_count",
        capability: "conversion",
        direction: "up",
      }),
    ],
    dependencies: COMPOSICION,
    scope: "business",
  });

  const ventas = salida.symptoms.find((s) => s.canonical_type === "net_sales_decline")!;
  assert.equal(ventas.compatible_direction, false);
  assert.equal(ventas.valence, "mixed", "un patron con sus componentes en contra no es solo negativo");
  assert.notEqual(ventas.confidence, "high");
  assert.ok(salida.links.some((l) => l.role === "contradicting"));
  assert.ok(salida.evidence.some((e) => e.stance === "contradicting"));

  // Y la otra mitad, que es la que se olvida: "crecimiento de pedidos" no puede
  // quedarse pintado como buena noticia mientras la facturacion cae.
  const pedidos = salida.symptoms.find((s) => s.canonical_type === "order_volume_growth")!;
  assert.equal(pedidos.valence, "mixed");
  assert.equal(
    pedidos.known_relationship,
    true,
    "la relacion declarada lo es de los dos lados, no solo del padre",
  );
  assert.equal(salida.evidence.filter((e) => e.stance === "contradicting").length, 2);
});

test("D06 motor: sin dato utilizable no hay sintoma, y se dice por que", () => {
  // Guardrail 33. Lo importante del test no es que no haya sintoma: es que la
  // senal descartada sale con su motivo en vez de desaparecer.
  const salida = buildSymptoms({
    signals: [senal({ data_confidence: "insufficient_data" })],
    dependencies: COMPOSICION,
    scope: "business",
  });

  assert.equal(salida.symptoms.length, 0);
  assert.equal(salida.skipped.length, 1);
  assert.match(salida.skipped[0]!.reason, /D01/);
});

test("D06 motor: una metrica sin patron declarado no se bautiza", () => {
  const salida = buildSymptoms({
    signals: [senal({ metric: "refund_rate" })],
    dependencies: [],
    scope: "business",
  });
  assert.equal(salida.symptoms.length, 0);
  assert.match(salida.skipped[0]!.reason, /no hay patron declarado/);
});

test("D06 motor: una senal sin direccion interpretable no sostiene un patron", () => {
  const salida = buildSymptoms({
    signals: [senal({ direction: "flat" }), senal({ signal_id: "s2", direction: "unstable" })],
    dependencies: [],
    scope: "business",
  });
  assert.equal(salida.symptoms.length, 0);
  assert.equal(salida.skipped.length, 2);
});

test("D06 motor: una plantilla puede negarse a decidir la valencia", () => {
  // Guardrail 22: "CAC arriba" no es automaticamente un sintoma negativo --
  // puede ser el precio de entrar en un mercado nuevo. La plantilla lo dice y
  // el motor obedece.
  const salida = buildSymptoms({
    signals: [senal({ metric: "cac", direction: "up", capability: "acquisition" })],
    dependencies: [],
    scope: "business",
    templates: [
      {
        canonical_type: "cac_increase",
        metric: "cac",
        direction: "up",
        family: "acquisition",
        valence: "contextual",
        label: "Subida del coste de adquisicion",
      },
    ],
  });

  assert.equal(salida.symptoms[0]!.valence, "neutral");
});

test("D06 motor: si D02 lo lee como cambio de composicion, el patron se degrada", () => {
  // Guardrails 19 y 20. Asi es como se fabrican los sintomas falsos de mix:
  // el agregado cae, nadie mira la composicion y se declara un deterioro.
  const conContexto = buildSymptoms({
    signals: [senal()],
    dependencies: COMPOSICION,
    scope: "business",
    contexts: { net_sales: { aggregate_interpretation: "mix_shift", comparability: "comparable" } },
  });

  const s = conContexto.symptoms[0]!;
  assert.equal(s.valence, "mixed");
  assert.notEqual(s.confidence, "high");
  assert.ok(
    conContexto.evidence.some((e) => e.stance === "contradicting" && /composicion/.test(e.observation)),
  );
});

test("D06 motor: una comparacion que D02 no da por valida tampoco sostiene el patron", () => {
  const salida = buildSymptoms({
    signals: [senal()],
    dependencies: COMPOSICION,
    scope: "business",
    contexts: { net_sales: { aggregate_interpretation: "within_performance", comparability: "not_comparable" } },
  });
  assert.notEqual(salida.symptoms[0]!.confidence, "high");
  assert.ok(salida.evidence.some((e) => /artefacto/.test(e.observation)));
});

test("D06 motor: sin haber mirado el contexto no se puede afirmar con fuerza", () => {
  // El contrato ya lo exige (`symptoms_alta_confianza_exige_contexto`); esto
  // comprueba que el motor no intenta saltarselo.
  const sinContexto = buildSymptoms({
    signals: [
      senal(),
      senal({ signal_id: "s-pedidos", metric: "orders_count", capability: "conversion" }),
    ],
    dependencies: COMPOSICION,
    scope: "business",
  });
  assert.ok(sinContexto.symptoms.every((s) => s.confidence !== "high"));
  assert.ok(sinContexto.symptoms.every((s) => !s.context_reviewed));
});

test("D06 motor: la confianza del sintoma no supera a la del dato", () => {
  const salida = buildSymptoms({
    signals: [
      senal({ data_confidence: "low" }),
      senal({
        signal_id: "s-pedidos",
        metric: "orders_count",
        capability: "conversion",
        data_confidence: "low",
      }),
    ],
    dependencies: COMPOSICION,
    scope: "business",
    contexts: {
      net_sales: { aggregate_interpretation: "within_performance", comparability: "comparable" },
      orders_count: { aggregate_interpretation: "within_performance", comparability: "comparable" },
    },
  });
  assert.ok(salida.symptoms.every((s) => s.confidence === "low"));
});

test("D06 motor: un sintoma localizado dice donde", () => {
  // Guardrails 23 y 25: una tienda de varias no es "el negocio".
  const salida = buildSymptoms({
    signals: [senal()],
    dependencies: [],
    scope: "segment",
    scopeDetail: { store: "tienda-fr" },
  });
  assert.equal(salida.symptoms[0]!.scope, "segment");
  assert.deepEqual(salida.symptoms[0]!.scope_detail, { store: "tienda-fr" });
});

test("D06 motor: lo que produce pasa sus propios invariantes", () => {
  // El test que mas veces va a salvar el bloque: el motor no puede emitir algo
  // que el contrato del bloque rechace.
  const salida = buildSymptoms({
    signals: [
      senal(),
      senal({ signal_id: "s-pedidos", metric: "orders_count", capability: "conversion" }),
    ],
    dependencies: COMPOSICION,
    scope: "business",
    contexts: {
      net_sales: { aggregate_interpretation: "within_performance", comparability: "comparable" },
      orders_count: { aggregate_interpretation: "within_performance", comparability: "comparable" },
    },
  });

  for (const s of salida.symptoms) engineSymptomSchema.parse(s);
  const violaciones = checkSymptomInvariants({
    symptoms: salida.symptoms,
    signals: salida.links,
    evidence: salida.evidence,
    relations: salida.relations,
  });
  assert.deepEqual(violaciones, [], JSON.stringify(violaciones, null, 2));
});

test("D06 persistencia: el primer episodio es agudo y cuenta uno", () => {
  const r = classifyPersistence({ signalPersistence: "persistent", now: "2026-09-27T00:00:00Z" });
  assert.equal(r.persistence, "acute");
  assert.equal(r.recurrence_count, 1);
  assert.equal(r.new_episode, true);
});

test("D06 persistencia: volver despues de resolverse es recurrencia", () => {
  const r = classifyPersistence({
    previous: {
      symptom_id: "viejo",
      canonical_type: "net_sales_decline",
      status: "resolved",
      first_seen_at: "2026-05-01T00:00:00Z",
      recurrence_count: 1,
    },
    signalPersistence: "persistent",
    now: "2026-09-27T00:00:00Z",
  });
  assert.equal(r.recurrence_count, 2);
  assert.equal(r.persistence, "recurring", "haberlo visto dos veces es exactamente ser recurrente");
  assert.equal(r.new_episode, true);
});

test("D06 persistencia: seguir abierto mucho tiempo es cronico, no recurrente", () => {
  // Son dos cosas distintas y confundirlas cambia el diagnostico: uno vuelve,
  // el otro nunca se fue.
  const r = classifyPersistence({
    previous: {
      symptom_id: "abierto",
      canonical_type: "net_sales_decline",
      status: "active",
      first_seen_at: "2026-06-01T00:00:00Z",
      recurrence_count: 1,
    },
    signalPersistence: "persistent",
    now: "2026-09-27T00:00:00Z",
  });
  assert.equal(r.persistence, "chronic");
  assert.equal(r.new_episode, false, "el mismo episodio no cuenta como uno nuevo");
});

test("D06 motor: el episodio anterior se apunta, no se usa como prueba", () => {
  // Guardrail 36: un historico parecido orienta; no confirma el mecanismo.
  const salida = buildSymptoms({
    signals: [senal()],
    dependencies: [],
    scope: "business",
    previous: [
      {
        symptom_id: "viejo",
        canonical_type: "net_sales_decline",
        status: "resolved",
        first_seen_at: "2026-05-01T00:00:00Z",
        recurrence_count: 1,
      },
    ],
    now: "2026-09-27T00:00:00Z",
  });

  const s = salida.symptoms[0]!;
  assert.equal(s.previous_symptom_id, "viejo");
  assert.equal(s.persistence, "recurring");
  assert.notEqual(s.confidence, "high", "haber pasado antes no sube la confianza de hoy");
});

test("D06 motor: dos senales que no se solapan en el tiempo no se relacionan", () => {
  const salida = buildSymptoms({
    signals: [
      senal({ window_start: "2026-01-01T00:00:00Z", window_end: "2026-02-01T00:00:00Z" }),
      senal({
        signal_id: "s-pedidos",
        metric: "orders_count",
        capability: "conversion",
        window_start: "2026-08-01T00:00:00Z",
        window_end: "2026-09-01T00:00:00Z",
      }),
    ],
    dependencies: COMPOSICION,
    scope: "business",
  });

  assert.ok(salida.symptoms.every((s) => s.parent_symptom_id == null));
  assert.equal(salida.relations.length, 0);
});

test("D06 motor: una muestra pequena impide la coherencia suficiente", () => {
  const salida = buildSymptoms({
    signals: [
      senal({ low_sample: true }),
      senal({
        signal_id: "s-pedidos",
        metric: "orders_count",
        capability: "conversion",
        low_sample: true,
      }),
    ],
    dependencies: COMPOSICION,
    scope: "business",
    contexts: {
      net_sales: { aggregate_interpretation: "within_performance", comparability: "comparable" },
      orders_count: { aggregate_interpretation: "within_performance", comparability: "comparable" },
    },
  });
  assert.ok(salida.symptoms.every((s) => !s.sufficient_signal_quality));
  assert.ok(salida.symptoms.every((s) => s.confidence === "low"));
});

test("D06 motor: la lectura de D02 no se contagia entre metricas", () => {
  // Que la caida de ventas se explique por composicion no dice nada sobre el
  // volumen de pedidos. Degradar el segundo por lo que se sabe del primero
  // seria inventarse una correccion que D02 no hizo.
  const salida = buildSymptoms({
    signals: [
      senal(),
      senal({ signal_id: "s-pedidos", metric: "orders_count", capability: "conversion" }),
    ],
    dependencies: COMPOSICION,
    scope: "business",
    contexts: {
      net_sales: { aggregate_interpretation: "mix_shift", comparability: "comparable" },
    },
  });

  const ventas = salida.symptoms.find((s) => s.canonical_type === "net_sales_decline")!;
  const pedidos = salida.symptoms.find((s) => s.canonical_type === "order_volume_decline")!;
  assert.equal(ventas.valence, "mixed");
  assert.equal(pedidos.valence, "negative");
  assert.equal(pedidos.context_reviewed, false, "de esta metrica D02 no dijo nada");
});
