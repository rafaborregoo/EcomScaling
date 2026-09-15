/**
 * FASE 3 / D03: los invariantes de la madurez por capacidad.
 *
 * Los 30 guardrails de D03 son casi todos la misma frase, `X != MADUREZ`, y la
 * mayoria se cumplen porque el campo X no existe. Los tests estructurales del
 * final son los que impiden que alguien lo anade sin darse cuenta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  capabilityMaturityFields,
  capabilityMaturitySchema,
  checkMaturityInvariants,
  classifyProfileChange,
  levelFromDimensions,
  maturityEvidenceSchema,
  maturityProfileFields,
  maturityProfileSchema,
  maturityRank,
  measureComplexity,
  observeMaturity,
  MATURITY_LEVELS,
  type BusinessFacts,
  type CapabilityDependency,
  type CapabilityMaturity,
  type MaturityProfile,
} from "./maturity.js";

/** Evidencia objetiva: comportamiento observado. La mas fuerte del apartado 10. */
const observada = (description: string) =>
  maturityEvidenceSchema.parse({ evidence_type: "observed_behavior", description });

function capacidad(over: Partial<CapabilityMaturity> = {}): CapabilityMaturity {
  return capabilityMaturitySchema.parse({
    capability: "retention",
    current_level: "defined",
    has_existence: true,
    has_consistency: true,
    has_repeatability: true,
    evidence: [observada("Flows de bienvenida y carrito activos y revisados cada mes")],
    ...over,
  });
}

function perfil(over: Partial<MaturityProfile> = {}): MaturityProfile {
  return maturityProfileSchema.parse({
    profile_id: "MAT-001",
    business_stage: "e4",
    change_type: "initial",
    confidence: "medium",
    capabilities: [capacidad()],
    ...over,
  });
}

const reglas = (
  p: MaturityProfile,
  dependencies: CapabilityDependency[] = [],
  previous?: MaturityProfile,
) =>
  checkMaturityInvariants(
    previous
      ? { profile: p, dependencies, previous }
      : { profile: p, dependencies },
  ).map((x) => x.rule);

test("la escalera esta ordenada y comparar por posicion tiene sentido", () => {
  assert.ok(maturityRank("absent") < maturityRank("ad_hoc"));
  assert.ok(maturityRank("measured") < maturityRank("adaptive"));
  assert.equal(MATURITY_LEVELS.length, 7);
});

test("un perfil bien sostenido no dispara nada", () => {
  assert.deepEqual(reglas(perfil()), []);
});

test("§15: a partir de defined no basta con lo que dice el cliente", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        evidence: [
          maturityEvidenceSchema.parse({
            evidence_type: "user_claim",
            description: "Dicen que segmentan bien",
          }),
        ],
      }),
    ],
  });
  assert.ok(reglas(p).includes("evidencia_por_encima_de_la_autopercepcion"));
});

test("§16: un proceso documentado describe lo que deberia pasar, no lo que pasa", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        evidence: [
          maturityEvidenceSchema.parse({
            evidence_type: "documented_process",
            description: "Tienen un manual de retencion en Notion",
          }),
        ],
      }),
    ],
  });
  assert.ok(reglas(p).includes("evidencia_por_encima_de_la_autopercepcion"));
});

test("§3: tener Klaviyo no es saber hacer email marketing", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        current_level: "repeatable",
        evidence: [
          maturityEvidenceSchema.parse({
            evidence_type: "tool_presence",
            description: "Klaviyo conectado",
          }),
          maturityEvidenceSchema.parse({
            evidence_type: "user_claim",
            description: "Dicen que mandan campanas todas las semanas",
          }),
        ],
      }),
    ],
  });
  assert.ok(reglas(p).includes("herramienta_no_es_capacidad"));
});

test("§13: una regresion no se declara con la averia de esta semana", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        finding: "maturity_regression",
        gap_interpretation: "Parece que ha bajado",
      }),
    ],
  });
  assert.ok(reglas(p).includes("regresion_exige_persistencia"));
});

test("§26: con deterioro persistente y fechado, la regresion es legitima", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        finding: "maturity_regression",
        gap_interpretation: "Sin responsable desde la salida del CRM manager",
        evidence: [
          observada("Flows activos y revisados"),
          maturityEvidenceSchema.parse({
            evidence_type: "observed_behavior",
            description: "Cuatro meses sin revisar ni un flow",
            supports: "regression",
            persistent: true,
            observed_at: "2026-05-01T00:00:00Z",
          }),
        ],
      }),
    ],
  });
  assert.ok(!reglas(p).includes("regresion_exige_persistencia"));
});

test("§9: no se penaliza la simplicidad que cubre lo que el negocio necesita", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        current_level: "defined",
        required_level: "repeatable",
        finding: "structural_weakness",
        gap_interpretation: "Nos parece poco",
      }),
    ],
  });
  assert.ok(reglas(p).includes("simplicidad_no_se_penaliza"));
});

test("§10: no se premia la complejidad de una capacidad que se queda corta", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        current_level: "defined",
        required_level: "optimized",
        finding: "overengineering",
        gap_interpretation: "Tienen mucha herramienta",
      }),
    ],
  });
  assert.ok(reglas(p).includes("complejidad_no_se_premia"));
});

test("§17: una asimetria sin dependencia es especializacion sana, no problema", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        finding: "structural_imbalance",
        gap_interpretation: "Retencion muy por encima de adquisicion",
      }),
    ],
  });
  assert.ok(reglas(p).includes("asimetria_no_es_problema"));
});

test("§18: con una dependencia declarada, el desequilibrio si es un riesgo", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        finding: "structural_imbalance",
        gap_interpretation: "Retencion sostiene sola el negocio y adquisicion no acompana",
      }),
    ],
  });
  const deps: CapabilityDependency[] = [
    {
      capability: "retention",
      depends_on: "acquisition",
      relation: "requires",
      rationale: "Sin entrada de clientes nuevos, la retencion agota la base",
    },
  ];
  assert.ok(!reglas(p, deps).includes("asimetria_no_es_problema"));
});

test("§24: no se escala adquisicion sobre capacidades base que no llegan", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        capability: "acquisition",
        current_level: "optimized",
        required_level: "defined",
        has_measurement: true,
        influences_decisions: true,
        has_ownership: true,
        finding: "sustainable_growth",
        gap_interpretation: "Escalando bien",
      }),
      capacidad({
        capability: "inventory",
        current_level: "ad_hoc",
        required_level: "defined",
        has_consistency: false,
        has_repeatability: false,
        evidence: [observada("Roturas de stock recurrentes en los productos estrella")],
      }),
    ],
  });
  const deps: CapabilityDependency[] = [
    {
      capability: "acquisition",
      depends_on: "inventory",
      relation: "requires",
      rationale: "Traer mas demanda de la que se puede servir quema dinero y clientes",
    },
  ];
  assert.ok(reglas(p, deps).includes("escalado_sin_base"));
});

test("§14: una capacidad con techo por debajo no crece de forma sostenible", () => {
  const p = perfil({
    capabilities: [
      capacidad({
        capability: "acquisition",
        current_level: "measured",
        has_measurement: true,
        influences_decisions: true,
        finding: "sustainable_growth",
        gap_interpretation: "Paid escalando con ROAS estable",
      }),
      capacidad({
        capability: "creative",
        current_level: "ad_hoc",
        has_consistency: false,
        has_repeatability: false,
        evidence: [observada("Dos creatividades nuevas al mes, hechas por el fundador")],
      }),
    ],
  });
  const deps: CapabilityDependency[] = [
    {
      capability: "acquisition",
      depends_on: "creative",
      relation: "ceiling",
      rationale: "La produccion de creatividades pone techo a cuanto se puede escalar en paid",
    },
  ];
  assert.ok(reglas(p, deps).includes("techo_declarado"));
});

test("§28: observar mejor no es haber mejorado", () => {
  // El ejemplo literal del artefacto: Finance E3-E5 con confianza baja pasa a
  // Finance E4 con confianza alta. Eso es mejor observacion, no progreso.
  const antes = perfil({
    profile_id: "MAT-000",
    confidence: "low",
    capabilities: [capacidad({ capability: "finance", current_level: "ad_hoc" })],
  });
  const ahora = perfil({
    change_type: "confidence_increase",
    confidence: "high",
    capabilities: [
      capacidad({
        capability: "finance",
        current_level: "defined",
        evidence: [observada("P&L mensual cerrado y revisado")],
      }),
    ],
  });
  assert.ok(reglas(ahora, [], antes).includes("confianza_no_es_madurez"));
});

test("§28: declarado como cambio real, la subida es legitima", () => {
  const antes = perfil({
    profile_id: "MAT-000",
    capabilities: [capacidad({ capability: "finance", current_level: "ad_hoc" })],
  });
  const ahora = perfil({
    change_type: "real_change",
    capabilities: [
      capacidad({
        capability: "finance",
        current_level: "defined",
        evidence: [observada("P&L mensual cerrado y revisado desde enero")],
      }),
    ],
  });
  assert.ok(!reglas(ahora, [], antes).includes("confianza_no_es_madurez"));
});

// --- Invariantes del esquema -----------------------------------------------

test("§20: no se es measured sin medir", () => {
  assert.throws(() =>
    capabilityMaturitySchema.parse({
      capability: "finance",
      current_level: "measured",
      has_existence: true,
      influences_decisions: true,
    }),
  );
});

test("§20: medir sin que cambie ninguna decision es un panel que nadie mira", () => {
  assert.throws(() =>
    capabilityMaturitySchema.parse({
      capability: "finance",
      current_level: "measured",
      has_existence: true,
      has_measurement: true,
      influences_decisions: false,
    }),
  );
});

test("§30: adaptive exige aprendizaje y resiliencia reales", () => {
  assert.throws(() =>
    capabilityMaturitySchema.parse({
      capability: "data",
      current_level: "adaptive",
      has_existence: true,
      has_measurement: true,
      influences_decisions: true,
      has_ownership: true,
      has_resilience: true,
      has_learning: false,
    }),
  );
});

test("§11: un hallazgo sin interpretacion es una etiqueta vacia", () => {
  assert.throws(() =>
    capabilityMaturitySchema.parse({
      capability: "inventory",
      current_level: "ad_hoc",
      has_existence: true,
      finding: "structural_weakness",
    }),
  );
});

test("lo que no existe no tiene nivel", () => {
  assert.throws(() =>
    capabilityMaturitySchema.parse({
      capability: "creative",
      current_level: "repeatable",
      has_existence: false,
    }),
  );
});

// --- Lo estructural: los guardrails que se cumplen por ausencia -------------

test("§1-§6: nada de lo que NO es madurez tiene donde escribirse", () => {
  // REVENUE, PERFORMANCE, USING TOOL, AUTOMATION, TEAM SIZE y DOCUMENTATION no
  // son madurez. La forma barata de cumplirlo es que no exista el campo: si
  // alguien lo anade, tiene que pasar por aqui y leer los guardrails 1 a 6.
  const campos = Object.keys(capabilityMaturityFields.shape);
  for (const prohibido of [
    "revenue",
    "monthly_revenue",
    "performance",
    "tools",
    "tool_count",
    "team_size",
    "headcount",
    "documentation",
  ]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" no es madurez (D03 guardrails 1-6)`);
  }
});

test("§11: no hay puntuacion global de madurez en ninguna parte", () => {
  // "No usar una puntuacion vanity sin interpretacion diagnostica". Un perfil
  // es niveles, requisitos y hallazgos; reducirlo a un 72/100 es justo lo que
  // el guardrail no quiere.
  const deCapacidad = Object.keys(capabilityMaturityFields.shape);
  const delPerfil = Object.keys(maturityProfileFields.shape);
  for (const prohibido of ["score", "overall_score", "maturity_score", "maturity_index", "rating"]) {
    assert.ok(!deCapacidad.includes(prohibido), `"${prohibido}" es una nota vanity (D03 guardrail 11)`);
    assert.ok(!delPerfil.includes(prohibido), `"${prohibido}" es una nota vanity (D03 guardrail 11)`);
  }
});

test("§7 y §19: estado no es etapa, y cuello de botella no es prioridad", () => {
  // La salud actual es D04 y la prioridad es F4. Que no quepan aqui es lo que
  // impide que una incidencia de hoy mueva la etapa estructural.
  const deCapacidad = Object.keys(capabilityMaturityFields.shape);
  const delPerfil = Object.keys(maturityProfileFields.shape);
  for (const prohibido of ["health", "current_state", "status", "priority", "rank", "urgency"]) {
    assert.ok(!deCapacidad.includes(prohibido), `"${prohibido}" no pertenece a D03`);
    assert.ok(!delPerfil.includes(prohibido), `"${prohibido}" no pertenece a D03`);
  }
});

// ---------------------------------------------------------------------------
// EL MOTOR
// ---------------------------------------------------------------------------
//
// El fallo que persiguen estos tests no es equivocarse de nivel: es **rellenar
// un hueco de datos con una afirmacion**. Decirle a un cliente que no tiene
// adquisicion porque sus pedidos no traen origen, o que tiene margen sano
// porque una referencia de cuarenta y cuatro tiene coste.

/** Los hechos de una tienda que lleva un ano vendiendo con el dato bien puesto. */
const HECHOS: BusinessFacts = {
  window_days: 365,
  orders: 800,
  net_sales: 40000,
  orders_with_attribution: 760,
  channels: 3,
  currencies: 1,
  repeat_orders: 300,
  orders_with_repeat_flag: 800,
  customers: 500,
  repeat_customers: 180,
  products: 28,
  variants: 44,
  session_days: 360,
  sessions: 20000,
  fulfillments: 780,
  fulfilled_orders: 770,
  inventory_items: 44,
  inventory_items_with_cost: 44,
  inventory_snapshots: 900,
  discounts: 12,
  discounts_used: 7,
  active_months: 12,
};

const hechos = (over: Partial<BusinessFacts> = {}): BusinessFacts => ({ ...HECHOS, ...over });

test("D03 motor: lo que el dato no puede ver no se declara ausente", () => {
  // El fallo central del bloque. `absent` es una afirmacion --"esto no
  // existe"-- y ningun dato que falta la sostiene. "No lo se" no es "no lo hay".
  const r = observeMaturity(hechos({ orders_with_attribution: 30 }));

  assert.equal(
    r.observed.find((c) => c.capability === "acquisition"),
    undefined,
    "sin atribucion no se escribe fila de adquisicion",
  );
  const fuera = r.unobserved.find((u) => u.capability === "acquisition")!;
  assert.match(fuera.reason, /4%/, "el motivo lleva el numero que lo demuestra");
  assert.ok(r.observed.every((c) => c.current_level !== "absent"));
});

test("D03 motor: un coste suelto no sostiene el margen", () => {
  // El caso real de produccion: 1 de 44 referencias con coste.
  const r = observeMaturity(hechos({ inventory_items_with_cost: 1 }));
  assert.equal(r.observed.find((c) => c.capability === "unit_economics"), undefined);
  assert.match(
    r.unobserved.find((u) => u.capability === "unit_economics")!.reason,
    /1 de 44/,
  );
});

test("D03 motor: el techo es `defined`, por bueno que sea el dato", () => {
  // Guardrail 20: `measured` exige que la medida cambie decisiones, y eso no
  // esta en ninguna tabla. El dato demuestra que algo se mide; no demuestra que
  // alguien lo mire.
  const r = observeMaturity(hechos());
  assert.ok(r.observed.length > 0);
  for (const c of r.observed) {
    assert.ok(
      maturityRank(c.current_level) <= maturityRank("defined"),
      `${c.capability} llego a ${c.current_level}`,
    );
    assert.equal(c.influences_decisions, false);
  }
});

test("D03 motor: no inventa `required_level` ni hallazgos de brecha", () => {
  // El apartado 19 dice que el algoritmo de scoring y los umbrales **no estan
  // definidos**. Calcularlos aqui seria fabricar la respuesta y presentarla
  // como derivada del documento.
  const r = observeMaturity(hechos());
  assert.ok(r.observed.every((c) => c.required_level == null));
  assert.ok(r.observed.every((c) => c.finding == null));
});

test("D03 motor: la escalera no se salta", () => {
  // Medir sin repetir no es `defined`: es ad_hoc con un panel.
  assert.equal(levelFromDimensions({ existence: false, consistency: true, repeatability: true, measurement: true }), null);
  assert.equal(levelFromDimensions({ existence: true, consistency: false, repeatability: true, measurement: true }), "ad_hoc");
  assert.equal(levelFromDimensions({ existence: true, consistency: true, repeatability: false, measurement: true }), "repeatable");
  assert.equal(levelFromDimensions({ existence: true, consistency: true, repeatability: true, measurement: false }), "repeatable");
  assert.equal(levelFromDimensions({ existence: true, consistency: true, repeatability: true, measurement: true }), "defined");
});

test("D03 motor: un hueco de atribucion no se cuenta como negocio monocanal", () => {
  // Con el 4% de los pedidos atribuidos, "1 canal" no describe al negocio:
  // describe a esos pedidos.
  const conHueco = measureComplexity(hechos({ orders_with_attribution: 30, channels: 1 }));
  assert.equal(conHueco.find((m) => m.key === "channels"), undefined);

  const conDato = measureComplexity(hechos());
  assert.equal(conDato.find((m) => m.key === "channels")!.value, 3);
});

test("D03 motor: tres meses de actividad no son una racha, uno si", () => {
  const nuevo = observeMaturity(hechos({ active_months: 1 }));
  const producto = nuevo.observed.find((c) => c.capability === "product")!;
  assert.equal(producto.current_level, "ad_hoc", "sin recorrido no hay consistencia");

  const asentado = observeMaturity(hechos());
  assert.notEqual(
    asentado.observed.find((c) => c.capability === "product")!.current_level,
    "ad_hoc",
  );
});

test("D03 motor: la capacidad de datos se mide por los huecos de las demas", () => {
  // Es la unica que no se observa con sus propias filas. Un negocio que factura
  // y no sabe de donde vienen sus pedidos tiene un problema de datos, y el
  // numero que lo demuestra ya esta calculado.
  const ciego = observeMaturity(
    hechos({ orders_with_attribution: 30, inventory_items_with_cost: 1, inventory_snapshots: 0 }),
  );
  const datos = ciego.observed.find((c) => c.capability === "data")!;
  assert.equal(datos.has_measurement, false);
  assert.match(datos.evidence[0]!.description, /origen de los pedidos/);
  assert.match(datos.evidence[0]!.description, /coste por referencia/);

  const completo = observeMaturity(hechos());
  assert.equal(completo.observed.find((c) => c.capability === "data")!.has_measurement, true);
});

test("D03 motor: crear un descuento y que alguien lo use son cosas distintas", () => {
  const sinUso = observeMaturity(hechos({ discounts: 12, discounts_used: 0 }));
  assert.equal(sinUso.observed.find((c) => c.capability === "offer")!.current_level, "ad_hoc");
});

test("D03 motor: sin historico de existencias se sabe lo de hoy, no lo que paso", () => {
  const r = observeMaturity(hechos({ inventory_snapshots: 0 }));
  const inv = r.observed.find((c) => c.capability === "inventory")!;
  assert.equal(inv.has_measurement, false);
  assert.equal(inv.current_level, "ad_hoc");
});

test("D03 motor: las capacidades que ninguna tienda puede demostrar salen con motivo", () => {
  // Y el motivo no puede ser un encogimiento de hombros: el tamano del equipo
  // no es madurez (guardrail 5) y la estrategia no esta en los pedidos.
  const r = observeMaturity(hechos());
  for (const c of ["market", "creative", "finance", "technology", "team", "strategy"] as const) {
    const fuera = r.unobserved.find((u) => u.capability === c);
    assert.ok(fuera, `${c} deberia salir como no observable`);
    assert.ok(fuera!.reason.length > 20, `${c} sale sin motivo de verdad`);
  }
});

test("D03 motor: lo que produce pasa sus propios invariantes", () => {
  // El test que mas veces va a salvar el bloque: el motor no puede emitir algo
  // que el contrato del bloque rechace.
  const r = observeMaturity(hechos());
  const perfil = maturityProfileSchema.parse({
    profile_id: "P-1",
    change_type: "initial",
    confidence: "low",
    capabilities: r.observed,
  });
  const violaciones = checkMaturityInvariants({ profile: perfil });
  assert.deepEqual(violaciones, [], JSON.stringify(violaciones, null, 2));
});

test("D03 motor: con datos de produccion reales sale un perfil creible", () => {
  // Los numeros de la tienda de produccion el 2026-09-15. El interes del test
  // no es el nivel: es que **la mayoria de las capacidades no se pueden ver**,
  // que es exactamente lo que hay que decirle al consultor.
  const r = observeMaturity({
    window_days: 608,
    orders: 787,
    net_sales: 51000,
    orders_with_attribution: 35,
    channels: 1,
    currencies: 1,
    repeat_orders: 585,
    orders_with_repeat_flag: 783,
    customers: 11244,
    repeat_customers: 780,
    products: 28,
    variants: 44,
    session_days: 403,
    sessions: 8234,
    fulfillments: 465,
    fulfilled_orders: 465,
    inventory_items: 44,
    inventory_items_with_cost: 1,
    inventory_snapshots: 0,
    discounts: 173,
    discounts_used: 47,
    active_months: 20,
  });

  const vistas = r.observed.map((c) => c.capability).sort();
  assert.deepEqual(vistas, ["conversion", "data", "inventory", "offer", "operations", "product", "retention"]);
  assert.ok(r.unobserved.length > r.observed.length, "se ve menos de lo que no se ve, y hay que decirlo");
  assert.equal(r.observed.find((c) => c.capability === "retention")!.has_measurement, true);
});

test("D03 cambio: ver mejor no es mejorar", () => {
  // Guardrail 28, con el ejemplo del propio artefacto. Si esto se confunde, el
  // sistema felicita al cliente por un progreso que no existio.
  const antes = { capabilities: [capacidad({ capability: "data", confidence: "low" })] };
  const ahora = { capabilities: [capacidad({ capability: "data", confidence: "high" })] };
  const r = classifyProfileChange(antes, ahora)!;
  assert.equal(r.change_type, "confidence_increase");
  assert.match(r.change_summary, /no se hace mejor/);
});

test("D03 cambio: que se mueva un nivel si es el negocio", () => {
  const antes = { capabilities: [capacidad({ capability: "data", current_level: "ad_hoc", has_consistency: false, has_repeatability: false })] };
  const ahora = { capabilities: [capacidad({ capability: "data", current_level: "defined" })] };
  const r = classifyProfileChange(antes, ahora)!;
  assert.equal(r.change_type, "real_change");
  assert.match(r.change_summary, /ad_hoc -> defined/);
});

test("D03 cambio: empezar a ver una capacidad es reducir incertidumbre, no crecer", () => {
  const antes = { capabilities: [capacidad({ capability: "data" })] };
  const ahora = {
    capabilities: [capacidad({ capability: "data" }), capacidad({ capability: "inventory" })],
  };
  const r = classifyProfileChange(antes, ahora)!;
  assert.equal(r.change_type, "uncertainty_reduction");
  assert.match(r.change_summary, /ahora se pueden ver: inventory/);
});

test("D03 cambio: si no cambio nada, no hay perfil nuevo", () => {
  // Devolver `null` es la respuesta util: un perfil nuevo cada dia diciendo lo
  // mismo convierte el historico en ruido y la supersesion en una mentira.
  const igual = { capabilities: [capacidad()] };
  assert.equal(classifyProfileChange(igual, { capabilities: [capacidad()] }), null);
});

test("D03 cambio: el primero es `initial`", () => {
  assert.equal(classifyProfileChange(null, { capabilities: [] })!.change_type, "initial");
});
