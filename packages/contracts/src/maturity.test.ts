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
  maturityEvidenceSchema,
  maturityProfileFields,
  maturityProfileSchema,
  maturityRank,
  MATURITY_LEVELS,
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
