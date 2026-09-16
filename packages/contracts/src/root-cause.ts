/**
 * FASE 3 / D09 — Root cause & constraint engine.
 *
 * Fuentes: `02-contratos-IA/d09-requisitos-contrato-root-cause-constraint.md` (26 apartados),
 * `04-policies-guardrails/d09-guardrails-root-cause-constraint.md` (48 guardrails),
 * `03-runtime/d09-flujo-root-cause-constraint.md`,
 * `06-tenant-context/d09-contexto-root-cause-constraint.md`.
 *
 * El unico bloque de la fase autorizado a cerrar una causa. Y aun asi no
 * prioriza: severidad, prioridad, playbook y ranking de impacto no salen de
 * aqui (guardrails 25 y 37). Eso es F4.
 *
 * DOS ENTIDADES INDEPENDIENTES. Causa raiz responde "por que paso"; constraint
 * responde "que nos limita". El apartado 23 exige que las cuatro combinaciones
 * existan -- incluida causa resuelta con constraint activo -- y por eso no hay
 * ninguna clave ajena que las ate.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";
import { EXPLANATORY_COVERAGE } from "./hypotheses.js";

/** Apartado 5. */
export const ROOT_CAUSE_FAMILIES = [
  "market", "product", "offer", "economics", "acquisition", "creative", "conversion",
  "retention", "inventory", "operations", "finance", "data", "technology", "team",
  "strategy", "external",
] as const;

/** Apartado 4. `positive_driver` existe por los guardrails 43 y 45. */
export const ROOT_CAUSE_TYPES = [
  "acute", "chronic", "structural", "event_driven", "process", "capacity",
  "configuration", "quality", "planning", "dependency", "external", "positive_driver",
] as const;

/** Apartado 3. */
export const ROOT_CAUSE_ROLES = ["primary", "secondary", "contributing"] as const;

/** Apartado 2. `unresolved` es una salida valida (guardrail 13), no un fracaso. */
export const ROOT_CAUSE_STATUSES = [
  "probable", "confirmed", "partial_root_cause", "unresolved",
  "active", "resolved", "recurrent",
] as const;

/**
 * Apartado 6. **Los cuatro primeros guardrails viven en este array.**
 *
 * Sintoma, causa inmediata, causa raiz y driver estructural son eslabones
 * distintos de la misma cadena. Confundirlos es el error que mas veces se
 * comete, y tener que elegir un rol obliga a decir en cual se esta.
 */
export const CHAIN_ROLES = [
  "structural_driver", "root_cause", "immediate_cause",
  "intermediate_cause", "symptom", "outcome",
] as const;

/** Apartado 11. */
export const CONSTRAINT_TYPES = [
  "demand", "product", "offer", "acquisition", "creative", "conversion", "retention",
  "inventory", "operations", "financial", "data", "technology", "team", "strategy",
] as const;

/** Apartado 12. `none` es una conclusion (apartado 22), no un hueco. */
export const BINDING_STATUSES = ["binding", "secondary", "latent", "none"] as const;

/** Apartado 13. */
export const CONSTRAINT_NATURES = ["hard", "soft", "structural_bottleneck", "temporary"] as const;

/** Apartados 19 y 20. */
export const CONTROLLABILITY = [
  "controllable", "partially_controllable", "external", "unknown",
] as const;
export const REVERSIBILITY = [
  "easily_reversible", "reversible", "difficult", "unknown",
] as const;

/**
 * Guardrails 46 y 47: el lenguaje se calibra a la confianza. Estas formas
 * afirman sin matiz y solo caben con evidencia que las sostenga.
 *
 * **LINT SOBRE TEXTO INTERNO, NO GARANTIA.** Una expresion regular no entiende
 * negacion ni cita: se le escapa "fue el equipo quien no lo vio" y salta con
 * "no hay duda de que NO es la causa". Ademas solo cubre castellano. Sirve como
 * aviso al consultor sobre lo que el escribe, y nada mas.
 *
 * La calibracion de verdad no se vigila, **se genera**: los guardrails 43 a 46
 * de `D11` dan la formula de cada nivel ("no puede determinarse", "compatible
 * con", "la explicacion mas probable"), asi que la frase que ve el cliente se
 * compone desde los campos en `D14` y el lenguaje descalibrado deja de poder
 * escribirse. Mientras `D14` no exista, este guardrail **no esta cubierto**.
 */
export const DEFINITIVE_LANGUAGE =
  /\b(definitivamente|sin duda|con certeza|es la causa|causado por|demuestra que|prueba que)\b/i;

/**
 * Guardrails 38 a 40: se describen procesos, no personas. Estas formas senalan a
 * alguien en vez de a algo observable.
 *
 * **LINT, NO GARANTIA** -- ver la nota de `DEFINITIVE_LANGUAGE`. La garantia de
 * estos tres guardrails es otra y esa si es estructural: **no existe ninguna
 * columna donde quepa una persona** en todo `D09`. Esta regex solo caza el caso
 * en que alguien mete un nombre dentro del enunciado.
 */
export const BLAME_LANGUAGE =
  /\b(culpa de|por culpa|responsable de(?:l| la)? (?:error|fallo|problema)|no hizo su trabajo|se olvido de|negligencia)\b/i;

export const rootCauseFields = z.object({
  root_cause_id: z.string().min(1),
  code: z.string().min(1).max(12),
  statement: z.string().min(1),
  family: z.enum(ROOT_CAUSE_FAMILIES),
  cause_type: z.enum(ROOT_CAUSE_TYPES),
  role: z.enum(ROOT_CAUSE_ROLES).default("primary"),
  scope: z.string().default("business"),

  status: z.enum(ROOT_CAUSE_STATUSES).default("unresolved"),
  confidence: z.enum(["high", "medium", "low", "insufficient"]).default("insufficient"),
  explanatory_coverage: z.enum(EXPLANATORY_COVERAGE).default("unknown"),
  residual_material: z.boolean().default(false),

  causal_path_id: z.string().optional(),
  hypothesis_id: z.string().optional(),

  controllability: z.enum(CONTROLLABILITY).default("unknown"),
  reversibility: z.enum(REVERSIBILITY).default("unknown"),
  affects_observability_only: z.boolean().default(false),
  limitations: z.string().optional(),
});

export const rootCauseSchema = rootCauseFields
  // Guardrail 16.
  .refine(
    (c) => !["probable", "confirmed"].includes(c.status) || c.causal_path_id != null,
    { message: "Una causa raiz afirmada necesita cadena causal soportada (guardrail 16)." },
  )
  // Guardrails 12 y 48.
  .refine(
    (c) =>
      c.status !== "confirmed" ||
      (c.confidence === "high" && c.hypothesis_id != null && c.limitations != null),
    { message: "CONFIRMED es excepcional: exige confianza alta, contraste y limitaciones (guardrails 12 y 48)." },
  )
  // Guardrail 24.
  .refine((c) => c.explanatory_coverage !== "full" || !c.residual_material, {
    message: "No hay explicacion completa con residual material (guardrail 24).",
  })
  // Guardrail 42.
  .refine(
    (c) =>
      !c.affects_observability_only ||
      ["minimal", "unknown"].includes(c.explanatory_coverage),
    { message: "Un fallo de medicion no explica un deterioro del negocio (guardrail 42)." },
  );

export type RootCause = z.infer<typeof rootCauseSchema>;

export const chainStepSchema = z.object({
  root_cause_id: z.string().min(1),
  step_order: z.number().int().min(1),
  chain_role: z.enum(CHAIN_ROLES),
  statement: z.string().min(1),
  supported: z.boolean().default(false),
});

export type ChainStep = z.infer<typeof chainStepSchema>;

export const businessConstraintFields = z.object({
  constraint_id: z.string().min(1),
  code: z.string().min(1).max(12),
  statement: z.string().min(1),
  constraint_type: z.enum(CONSTRAINT_TYPES),
  /** Apartado 14 y guardrail 30: un constraint siempre lo es respecto de algo. */
  target: z.string().min(1),
  scope: z.string().default("business"),
  binding_status: z.enum(BINDING_STATUSES).default("latent"),
  nature: z.enum(CONSTRAINT_NATURES).default("soft"),
  confidence: z.enum(["high", "medium", "low", "insufficient"]).default("insufficient"),
  capacity: z.string().optional(),
  demand_on_capacity: z.string().optional(),
  falsifier: z.string().optional(),
  counterfactual_result: z.string().optional(),
  limits_target: z.boolean().default(false),
  exposure: z.enum(["minimal", "moderate", "high", "existential", "unknown"]).default("unknown"),
});

export const businessConstraintSchema = businessConstraintFields
  // Guardrails 5 y 28: una debilidad que no limita el target no es un constraint.
  .refine((c) => c.binding_status !== "binding" || c.limits_target, {
    message: "Una debilidad que no limita el target no es un constraint vinculante (guardrails 5 y 28).",
  })
  // Guardrail 31: el contrafactual no es opcional.
  .refine(
    (c) =>
      c.binding_status !== "binding" ||
      (c.falsifier != null && c.counterfactual_result != null),
    { message: "Declararlo vinculante exige haber pasado el test contrafactual (guardrail 31)." },
  )
  // Guardrail 29: la capacidad sola no dice nada; la relacion con la demanda si.
  .refine(
    (c) =>
      c.binding_status !== "binding" ||
      (c.capacity != null && c.demand_on_capacity != null),
    { message: "Para decir que algo hace cuello hay que declarar capacidad y demanda (guardrail 29)." },
  );

export type BusinessConstraint = z.infer<typeof businessConstraintSchema>;

export const constraintTestSchema = z
  .object({
    test_id: z.string().min(1),
    constraint_id: z.string().min(1),
    target: z.string().min(1),
    counterfactual_question: z.string().min(1),
    expected_if_binding: z.string().min(10),
    expected_if_not_binding: z.string().min(10),
    result: z.enum(["pending", "binding", "not_binding", "inconclusive"]).default("pending"),
    interpretation: z.string().optional(),
  })
  .refine((t) => t.expected_if_binding.trim() !== t.expected_if_not_binding.trim(), {
    message: "Si las dos predicciones dicen lo mismo, el test no distingue nada.",
  })
  .refine((t) => t.result === "pending" || t.interpretation != null, {
    message: "Un test resuelto sin interpretacion no ha resuelto nada.",
  });

export type ConstraintTest = z.infer<typeof constraintTestSchema>;

export type RootCauseCheckInput = {
  rootCauses: RootCause[];
  chain?: ChainStep[];
  constraints?: BusinessConstraint[];
  tests?: ConstraintTest[];
  /** Niveles de evidencia de la hipotesis que sostiene cada causa (de D08). */
  evidenceLevels?: { root_cause_id: string; level: string }[];
  /** El caso declara que no hay constraint relevante (apartado 22). */
  noBusinessConstraint?: boolean;
};

export function checkRootCauseInvariants(
  input: RootCauseCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const chain = input.chain ?? [];
  const constraints = input.constraints ?? [];
  const tests = input.tests ?? [];
  const niveles = input.evidenceLevels ?? [];
  const afirmada = (s: string) => ["probable", "confirmed", "active", "recurrent"].includes(s);

  for (const c of input.rootCauses) {
    const suCadena = chain
      .filter((x) => x.root_cause_id === c.root_cause_id)
      .sort((a, b) => a.step_order - b.step_order);
    const suNivel = niveles.filter((n) => n.root_cause_id === c.root_cause_id);

    // Guardrail 15: la correlacion no basta para cerrar una causa.
    if (
      afirmada(c.status) &&
      suNivel.length > 0 &&
      suNivel.every((n) => n.level === "correlation_only")
    ) {
      violations.push({
        rule: "correlacion_no_cierra_una_causa",
        source: "D09 guardrail 15",
        message: `"${c.code}" se afirma apoyada solo en correlacion.`,
      });
    }

    // Guardrail 20: un patron conocido nunca pesa mas que la evidencia directa.
    if (
      c.status === "confirmed" &&
      suNivel.length > 0 &&
      suNivel.every((n) => n.level === "pattern_match")
    ) {
      violations.push({
        rule: "patron_no_supera_evidencia_directa",
        source: "D09 guardrail 20",
        message: `"${c.code}" se confirma porque encaja con un patron conocido, sin evidencia directa.`,
      });
    }

    // Guardrail 9: pararse en la causa inmediata es pararse demasiado pronto.
    if (afirmada(c.status) && suCadena.length > 0) {
      const tieneRaiz = suCadena.some((s) => s.chain_role === "root_cause");
      const tieneInmediata = suCadena.some((s) => s.chain_role === "immediate_cause");
      if (!tieneRaiz && tieneInmediata) {
        violations.push({
          rule: "causa_inmediata_no_es_raiz",
          source: "D09 guardrails 2 y 9",
          message: `La cadena de "${c.code}" llega a la causa inmediata y para ahi. Esa no es la raiz.`,
        });
      }
    }

    // Guardrail 10: no profundizar hasta lo abstracto sin evidencia.
    const driverSinApoyo = suCadena.find(
      (s) => s.chain_role === "structural_driver" && !s.supported,
    );
    if (driverSinApoyo && afirmada(c.status)) {
      violations.push({
        rule: "driver_estructural_sin_evidencia",
        source: "D09 guardrail 10",
        message: `"${c.code}" llega a un driver estructural que nada sostiene. Profundizar sin evidencia es inventar.`,
      });
    }

    // Guardrails 46 y 47: el lenguaje se calibra a la confianza.
    if (DEFINITIVE_LANGUAGE.test(c.statement) && c.confidence !== "high") {
      violations.push({
        rule: "lenguaje_sin_calibrar",
        source: "D09 guardrails 46 y 47",
        message: `"${c.code}" afirma sin matiz con confianza ${c.confidence}.`,
      });
    }

    // Guardrails 38 a 40: se describen procesos, no personas.
    if (BLAME_LANGUAGE.test(c.statement)) {
      violations.push({
        rule: "senala_a_personas",
        source: "D09 guardrails 38, 39 y 40",
        message: `"${c.code}" senala a alguien en vez de describir el proceso, la capacidad o la configuracion.`,
      });
    }

    // Guardrail 23: el residual material se mantiene, no se redondea a cero.
    if (c.explanatory_coverage === "partial" && !c.residual_material && afirmada(c.status)) {
      violations.push({
        rule: "residual_no_declarado",
        source: "D09 guardrails 23 y 24",
        message: `"${c.code}" cubre solo parte y no declara que queda algo sin explicar.`,
      });
    }
  }

  // Guardrail 21: no obsesionarse con una unica causa cuando la cobertura no
  // llega. Si la unica causa afirmada es parcial, falta algo por decir.
  const afirmadas = input.rootCauses.filter((c) => afirmada(c.status));
  if (
    afirmadas.length === 1 &&
    afirmadas[0]!.explanatory_coverage === "partial" &&
    input.rootCauses.length === 1
  ) {
    violations.push({
      rule: "causa_unica_con_cobertura_parcial",
      source: "D09 guardrails 21, 22 y 23",
      message:
        "Una sola causa que explica una parte, y ninguna otra sobre la mesa. O hay mas causas o hay que decir que queda sin explicar.",
    });
  }

  for (const k of constraints) {
    // Guardrails 25 y 26: lo local no se generaliza.
    if (k.binding_status === "binding" && k.scope !== "business" && k.target === "revenue") {
      const tieneExposicion = ["high", "existential"].includes(k.exposure);
      if (!tieneExposicion) {
        violations.push({
          rule: "constraint_local_no_limita_el_todo",
          source: "D09 guardrails 26 y 27",
          message: `"${k.code}" limita un scope concreto y se declara vinculante para el negocio entero sin exposicion material.`,
        });
      }
    }

    // Guardrail 31: sin test ejecutado, vinculante es una opinion.
    if (k.binding_status === "binding") {
      const suTest = tests.filter((t) => t.constraint_id === k.constraint_id);
      if (suTest.length > 0 && suTest.every((t) => t.result === "pending")) {
        violations.push({
          rule: "vinculante_sin_test_resuelto",
          source: "D09 guardrail 31",
          message: `"${k.code}" se declara vinculante con su test contrafactual todavia pendiente.`,
        });
      }
    }
  }

  // Apartado 22 y guardrail 32: que no haya constraint es una conclusion. Si no
  // se probo ninguno, no es una conclusion: es no haber mirado.
  if (input.noBusinessConstraint && constraints.length === 0 && tests.length === 0) {
    violations.push({
      rule: "sin_constraint_no_es_no_haber_mirado",
      source: "D09 apartado 22 y guardrail 32",
      message:
        "Se declara que no hay constraint relevante sin haber evaluado ni uno solo. Eso no es una conclusion.",
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// EL MOTOR (root cause)
// ---------------------------------------------------------------------------
//
// Entra lo que D07 y D08 dejaron -- rutas y sus hipotesis -- y sale una
// conclusion causal calibrada: casi siempre `unresolved` o `partial_root_cause`,
// **nunca `probable` ni `confirmed`**, porque la evidencia disponible hoy es
// co-movimiento (`correlation_only`) y el guardrail 15 prohibe cerrar una causa
// con solo eso. Que el motor no cierre nada no es un defecto: es la regla del
// eslabon mas debil (paso 4 del runtime) funcionando tal como se pidio.
//
// LA REGLA DEL ESLABON MAS DEBIL, hecha literal: si algun paso de la cadena
// tiene `case_support = 'untested'` --nadie mide esa metrica-- la cadena entera
// se queda en `unresolved` con confianza `insufficient`, por fuerte que sea el
// resto. Una cadena no es mas fuerte que su tramo mas flojo.
//
// D09 NO ELIGE, IGUAL QUE D07 Y D08: se emite una fila por candidata viva, no
// una "ganadora". El rol `primary` solo se usa cuando hay una sola candidata
// sobre la mesa; con varias, todas quedan `contributing` porque la separacion
// es baja (D08 ya lo dijo) y nombrar una "primaria" seria fingir un criterio que
// no existe.

/** Un nodo de la cadena, del origen hacia el target, sin incluir el target. */
export type ChainNodeInput = {
  node_id: string;
  label: string;
  case_support: "supported" | "contradicted" | "untested" | "partial";
};

/** Una hipotesis viva de D08, con su cadena ya resuelta. */
export type RootCauseCandidateInput = {
  hypothesis_id: string;
  source_path_id: string | null;
  hypothesis_type: string;
  relative_role: string | null;
  confidence: "high" | "medium" | "low" | "insufficient";
  explanatory_coverage: (typeof EXPLANATORY_COVERAGE)[number];
  /** La capacidad del nodo origen, tal cual la declara el grafo (D07). */
  capability: string | null;
  limitations: string | null;
  chain: readonly ChainNodeInput[];
};

export type RootCauseEngineInput = {
  targetNodeId: string;
  targetLabel: string;
  scope: string;
  scopeDetail: Record<string, string>;
  candidates: readonly RootCauseCandidateInput[];
};

export type ChainStepDraft = {
  step_order: number;
  chain_role: (typeof CHAIN_ROLES)[number];
  statement: string;
  supported: boolean;
  node_id: string | null;
};

export type RootCauseDraft = {
  code: string;
  statement: string;
  family: (typeof ROOT_CAUSE_FAMILIES)[number];
  cause_type: (typeof ROOT_CAUSE_TYPES)[number];
  role: (typeof ROOT_CAUSE_ROLES)[number];
  scope: string;
  scope_detail: Record<string, string>;
  status: (typeof ROOT_CAUSE_STATUSES)[number];
  confidence: "high" | "medium" | "low" | "insufficient";
  explanatory_coverage: (typeof EXPLANATORY_COVERAGE)[number];
  residual_material: boolean;
  residual_note: string;
  causal_path_id: string | null;
  hypothesis_id: string;
  controllability: (typeof CONTROLLABILITY)[number];
  reversibility: (typeof REVERSIBILITY)[number];
  affects_observability_only: boolean;
  limitations: string | null;
  chain: ChainStepDraft[];
};

/**
 * De la capacidad del grafo a la familia de D09.
 *
 * Las dos listas son casi la misma con dos nombres distintos para lo mismo
 * (`unit_economics` aqui, `economics` alli) -- el mismo tipo de desajuste que ya
 * aparecio entre D00/D05/D07 con el alcance del negocio entero. Se traduce en un
 * sitio con nombre, no se descubre en un check.
 *
 * Sin capacidad conocida (el challenger no tiene nodo origen), cae en `data`:
 * es la familia mas honesta para "no sabemos que es, sabemos que podria ser la
 * medicion".
 */
const CAPACIDAD_A_FAMILIA: Partial<Record<string, (typeof ROOT_CAUSE_FAMILIES)[number]>> = {
  unit_economics: "economics",
  market: "market",
  product: "product",
  offer: "offer",
  acquisition: "acquisition",
  creative: "creative",
  conversion: "conversion",
  retention: "retention",
  inventory: "inventory",
  operations: "operations",
  finance: "finance",
  data: "data",
  technology: "technology",
  team: "team",
  strategy: "strategy",
};

export function familyFromCapability(
  capability: string | null,
): (typeof ROOT_CAUSE_FAMILIES)[number] {
  if (capability && capability in CAPACIDAD_A_FAMILIA) {
    return CAPACIDAD_A_FAMILIA[capability]!;
  }
  return "data";
}

/**
 * El eslabon mas debil de la cadena (paso 4 del runtime).
 *
 * `allMeasured` es lo unico que hoy decide el status: una cadena con un tramo
 * `untested` no se puede ni confirmar ni descartar, asi que no se cierra nada.
 */
export function weakestLink(chain: readonly ChainNodeInput[]): {
  allMeasured: boolean;
  anyContradicted: boolean;
} {
  return {
    allMeasured: chain.every((s) => s.case_support !== "untested"),
    anyContradicted: chain.some((s) => s.case_support === "contradicted"),
  };
}

function esDesafiante(candidate: RootCauseCandidateInput): boolean {
  return candidate.hypothesis_type === "data_quality_explanation";
}

/**
 * Estado y confianza de la conclusion (guardrails 15 y 16).
 *
 * Nunca `probable` ni `confirmed`: la evidencia de D07-D08 es siempre
 * `correlation_only`, y el guardrail 15 prohibe cerrar una causa con solo eso.
 * `partial_root_cause` es la conclusion mas fuerte que hoy se puede sostener, y
 * solo cuando la cadena entera se ha medido.
 */
export function statusAndConfidence(
  candidate: RootCauseCandidateInput,
): { status: (typeof ROOT_CAUSE_STATUSES)[number]; confidence: RootCauseDraft["confidence"] } {
  if (esDesafiante(candidate)) {
    return { status: "unresolved", confidence: candidate.confidence };
  }
  const { allMeasured } = weakestLink(candidate.chain);
  if (!allMeasured) {
    return { status: "unresolved", confidence: "insufficient" };
  }
  if (["partial", "minimal"].includes(candidate.explanatory_coverage)) {
    return { status: "partial_root_cause", confidence: candidate.confidence };
  }
  return { status: "unresolved", confidence: candidate.confidence };
}

/**
 * La cadena: origen -> mediadores -> target (paso 2 del runtime).
 *
 * El origen es siempre `immediate_cause`, nunca `root_cause`. No es prudencia
 * de mas: el guardrail 9 exige evidencia y profundidad para llegar a raiz, y
 * hoy nunca hay mas alla de una serie que se movio a la vez. Etiquetarlo
 * `root_cause` seria afirmar una profundidad que no se ha buscado.
 */
export function buildChain(
  candidate: RootCauseCandidateInput,
  targetNodeId: string,
  targetLabel: string,
): ChainStepDraft[] {
  const pasos: ChainStepDraft[] = candidate.chain.map((nodo, i) => ({
    step_order: i + 1,
    chain_role: i === 0 ? "immediate_cause" : "intermediate_cause",
    statement:
      nodo.case_support === "untested"
        ? `Nadie mide "${nodo.label}": no se sabe si se movio.`
        : `"${nodo.label}" se movio en la ventana del caso.`,
    supported: nodo.case_support === "supported" || nodo.case_support === "partial",
    node_id: nodo.node_id,
  }));
  pasos.push({
    step_order: pasos.length + 1,
    chain_role: "outcome",
    statement: `"${targetLabel}" es lo que este caso trata de explicar.`,
    supported: true,
    node_id: targetNodeId,
  });
  return pasos;
}

function enunciadoRaiz(candidate: RootCauseCandidateInput, targetLabel: string): string {
  if (esDesafiante(candidate)) {
    return `Puede que "${targetLabel}" no se haya movido de verdad: la medida podria estar rota.`;
  }
  const origen = candidate.chain[0];
  if (!origen) return `Sin candidata identificable para "${targetLabel}".`;
  const { allMeasured } = weakestLink(candidate.chain);
  if (!allMeasured) {
    return `"${targetLabel}" podria venir de "${origen.label}", pero la cadena tiene un tramo sin medir: no se puede ni confirmar ni descartar.`;
  }
  return `"${origen.label}" mueve a "${targetLabel}". Por que se movio "${origen.label}" sigue sin explicarse.`;
}

/**
 * De las hipotesis vivas de D08 a conclusiones causales.
 *
 * Una fila por candidata, no una "ganadora". Con una sola candidata sobre la
 * mesa, su rol es `primary`; con varias, todas `contributing` -- porque D08 ya
 * establecio que la separacion es baja, y elegir una seria fingir un criterio
 * que no existe.
 */
export function generateRootCauses(input: RootCauseEngineInput): RootCauseDraft[] {
  const noDesafiantes = input.candidates.filter((c) => !esDesafiante(c));
  const soloUna = noDesafiantes.length === 1;

  return input.candidates.map((candidate, i) => {
    const { status, confidence } = statusAndConfidence(candidate);
    const chain = buildChain(candidate, input.targetNodeId, input.targetLabel);
    const desafiante = esDesafiante(candidate);

    return {
      code: `RC${i + 1}`,
      statement: enunciadoRaiz(candidate, input.targetLabel),
      family: desafiante ? "data" : familyFromCapability(candidate.capability),
      // Ninguna cadena de hoy tiene mecanismo mas alla de la aritmetica o una
      // co-ocurrencia: `process` es la clasificacion neutra que no inventa una
      // profundidad que no se ha comprobado. El status, no el tipo, es lo que
      // dice cuanto se sabe.
      cause_type: desafiante ? "quality" : "process",
      role: desafiante ? "primary" : soloUna ? "primary" : "contributing",
      scope: input.scope,
      scope_detail: input.scopeDetail,
      status,
      confidence,
      explanatory_coverage: desafiante ? "unknown" : candidate.explanatory_coverage,
      residual_material: true,
      residual_note: desafiante
        ? "Si la medida esta rota, no hay negocio real que explicar. Si no lo esta, esto no explica nada."
        : "Por que se movio la causa candidata sigue sin explicarse: eso es residual, y es material.",
      causal_path_id: candidate.source_path_id,
      hypothesis_id: candidate.hypothesis_id,
      controllability: "unknown",
      reversibility: "unknown",
      affects_observability_only: desafiante,
      limitations: candidate.limitations,
      chain,
    };
  });
}

// ---------------------------------------------------------------------------
// EL MOTOR (business constraint)
// ---------------------------------------------------------------------------
//
// La otra mitad, independiente de la primera (apartado 23): responde "que nos
// limita", no "por que paso". Hoy la respuesta honesta es **siempre `latent`**:
// declarar `binding` exige capacidad y demanda medidas y un test contrafactual
// resuelto (guardrails 29 y 31), y la plataforma no tiene ninguna de las dos
// cosas todavia. Lo que el motor si aporta es **la lista de candidatas y el
// test que haria falta correr**, que es lo que hasta hoy no existia en ningun
// sitio.

export type ConstraintCandidateInput = {
  capability: string;
  health_state: string;
  confidence: string;
};

export type ConstraintEngineInput = {
  targetMetric: string;
  scope: string;
  scopeDetail: Record<string, string>;
  candidates: readonly ConstraintCandidateInput[];
};

export type ConstraintDraft = {
  code: string;
  statement: string;
  constraint_type: (typeof CONSTRAINT_TYPES)[number];
  target: string;
  scope: string;
  scope_detail: Record<string, string>;
  binding_status: (typeof BINDING_STATUSES)[number];
  nature: (typeof CONSTRAINT_NATURES)[number];
  timing: "acute" | "structural";
  arrangement: "serial" | "parallel" | "unknown";
  confidence: string;
  limits_target: boolean;
  exposure: "minimal" | "moderate" | "high" | "existential" | "unknown";
  counterfactual_question: string;
  test: {
    expected_if_binding: string;
    expected_if_not_binding: string;
  };
};

const CAPACIDAD_A_CONSTRAINT_TYPE: Partial<Record<string, (typeof CONSTRAINT_TYPES)[number]>> = {
  unit_economics: "financial",
  finance: "financial",
  acquisition: "acquisition",
  creative: "creative",
  conversion: "conversion",
  offer: "offer",
  retention: "retention",
  inventory: "inventory",
  operations: "operations",
  data: "data",
  technology: "technology",
  team: "team",
  strategy: "strategy",
  product: "product",
};

export function constraintTypeFromCapability(
  capability: string,
): (typeof CONSTRAINT_TYPES)[number] {
  return CAPACIDAD_A_CONSTRAINT_TYPE[capability] ?? "operations";
}

/**
 * De una capacidad con salud mala a una candidata a cuello, sin declararla
 * vinculante.
 *
 * `binding_status: "latent"` en todas, siempre: es la unica respuesta que el
 * esquema deja dar sin capacidad ni demanda medidas. Lo que si se escribe es el
 * test que las despejaria -- el contrafactual del paso 5 del runtime -- para
 * que declarar la capacidad y la demanda el dia de manana sea rellenar un
 * hueco, no empezar de cero.
 */
export function generateConstraintCandidates(input: ConstraintEngineInput): ConstraintDraft[] {
  return input.candidates.map((c, i) => {
    const tipo = constraintTypeFromCapability(c.capability);
    const gravedad = c.health_state === "critical" ? "critica" : "mala";
    return {
      code: `K${i + 1}`,
      statement: `"${c.capability}" tiene salud ${gravedad} y podria estar limitando "${input.targetMetric}". No se ha comprobado si lo hace: falta capacidad y demanda medidas.`,
      constraint_type: tipo,
      target: input.targetMetric,
      scope: input.scope,
      scope_detail: input.scopeDetail,
      binding_status: "latent",
      nature: "soft",
      // Una salud mala es una condicion que persiste, no un evento puntual: es
      // el default mas defendible sin datos que digan lo contrario.
      timing: "structural",
      arrangement: "unknown",
      confidence: c.confidence,
      limits_target: false,
      exposure: "unknown",
      counterfactual_question: `Si "${c.capability}" tuviera la capacidad que necesita, ¿mejoraria "${input.targetMetric}"?`,
      test: {
        expected_if_binding: `"${input.targetMetric}" mejora en cuanto se resuelve la limitacion de "${c.capability}", sin que cambie nada mas alrededor.`,
        expected_if_not_binding: `"${input.targetMetric}" no mejora al resolver "${c.capability}": el limite real esta en otro sitio.`,
      },
    };
  });
}
