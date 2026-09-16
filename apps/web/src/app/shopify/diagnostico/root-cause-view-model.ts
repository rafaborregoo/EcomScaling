/**
 * FASE 3 / D09 — de la causa raiz y el constraint a lo que se lee en pantalla.
 *
 * LA DECISION DE FONDO: **`unresolved` se ensena igual de claro que cualquier
 * otro estado, no se atenua ni se esconde**. Casi todo llega asi hoy, y no es
 * un motor flojo: es que la evidencia disponible es co-movimiento, y cerrar mas
 * seria mentir. Una pantalla que suaviza "sin resolver" hasta que parece "casi
 * resuelto" reintroduce por la puerta de atras la certeza que el esquema
 * prohibe.
 *
 * Y LA SEGUNDA: **causa raiz y constraint se ensenan en dos bloques separados,
 * nunca fundidos**. Responden preguntas distintas ("¿por que paso?" y "¿que me
 * limita?") y el esquema las mantiene sin clave ajena entre si a proposito
 * (apartado 23): una causa resuelta puede convivir con un constraint activo, y
 * juntarlas en una sola tarjeta sugeriria que son la misma respuesta.
 */

export type RootCauseTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type ChainStepView = {
  root_cause_id: string;
  step_order: number;
  chain_role: string;
  statement: string;
  supported: boolean;
};

export type RootCauseView = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  case_id: string;
  code: string;
  statement: string;
  family: string;
  cause_type: string;
  role: string;
  scope: string;
  status: string;
  confidence: string;
  explanatory_coverage: string;
  residual_material: boolean;
  residual_note: string | null;
  controllability: string;
  reversibility: string;
  recurrence: string;
  affects_observability_only: boolean;
  limitations: string | null;
  updated_at: string;
  chain: ChainStepView[];
};

export type ConstraintTestView = {
  id: string;
  constraint_id: string;
  counterfactual_question: string;
  expected_if_binding: string;
  expected_if_not_binding: string;
  result: string;
  interpretation: string | null;
};

export type ConstraintView = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  case_id: string;
  code: string;
  statement: string;
  constraint_type: string;
  target: string;
  scope: string;
  binding_status: string;
  nature: string;
  timing: string;
  confidence: string;
  capacity: string | null;
  demand_on_capacity: string | null;
  falsifier: string | null;
  counterfactual_question: string | null;
  counterfactual_result: string | null;
  limits_target: boolean;
  exposure: string;
  status: string;
  updated_at: string;
  tests: ConstraintTestView[];
};

/**
 * El estado de la causa, dicho como lo que significa.
 *
 * `unresolved` no es un vacio: es "se ha mirado y no se puede cerrar", y la
 * etiqueta lo dice con esas palabras para que no se lea como "no se ha mirado".
 */
export function rootCauseStatusLabel(status: string): {
  label: string;
  hint: string;
  tone: RootCauseTone;
} {
  switch (status) {
    case "confirmed":
      return { label: "Confirmada", hint: "Confianza alta, contrastada y con límites declarados.", tone: "success" };
    case "probable":
      return { label: "Probable", hint: "La cadena está soportada, sin llegar a confirmarse.", tone: "success" };
    case "partial_root_cause":
      return {
        label: "Causa parcial",
        hint: "La cadena se ha medido entera y explica una parte del movimiento.",
        tone: "brand",
      };
    case "resolved":
      return { label: "Resuelta", hint: "Ya no está activa.", tone: "neutral" };
    case "recurrent":
      return { label: "Recurrente", hint: "Ha vuelto a aparecer en casos anteriores.", tone: "warn" };
    case "active":
      return { label: "Activa", tone: "warn", hint: "Sigue afectando hoy." };
    default:
      return {
        label: "Sin resolver",
        hint: "Se ha mirado y no se puede cerrar: falta un tramo medido o la evidencia no llega a más.",
        tone: "neutral",
      };
  }
}

export function confidenceLabel(confidence: string): { label: string; tone: RootCauseTone } {
  switch (confidence) {
    case "high":
      return { label: "Confianza alta", tone: "success" };
    case "medium":
      return { label: "Confianza media", tone: "brand" };
    case "low":
      return { label: "Confianza baja", tone: "warn" };
    default:
      return { label: "Sin evidencia suficiente", tone: "neutral" };
  }
}

const ROL_EN_PALABRAS: Record<string, string> = {
  primary: "Única candidata sobre la mesa",
  secondary: "Candidata secundaria",
  contributing: "Contribuye, entre varias",
};

export function roleLabel(role: string): string {
  return ROL_EN_PALABRAS[role] ?? role;
}

const CADENA_EN_PALABRAS: Record<string, string> = {
  structural_driver: "Driver estructural",
  root_cause: "Causa raíz",
  immediate_cause: "Causa inmediata",
  intermediate_cause: "Paso intermedio",
  symptom: "Síntoma",
  outcome: "Lo que se observó",
};

export function chainRoleLabel(role: string): string {
  return CADENA_EN_PALABRAS[role] ?? role;
}

/** La cadena, en el orden en que se recorrió: de la causa hacia el efecto. */
export function sortChain(chain: ChainStepView[]): ChainStepView[] {
  return [...chain].sort((a, b) => a.step_order - b.step_order);
}

/**
 * El estado del cuello, dicho como lo que significa.
 *
 * `latent` es casi siempre el resultado hoy, y por el mismo motivo que
 * `unresolved` en causas: declararlo vinculante exige capacidad y demanda
 * medidas, y esos datos no existen todavía.
 */
export function bindingStatusLabel(status: string): {
  label: string;
  hint: string;
  tone: RootCauseTone;
} {
  switch (status) {
    case "binding":
      return {
        label: "Vinculante",
        hint: "Es el primer límite que impide más output, con el contraste hecho.",
        tone: "danger",
      };
    case "secondary":
      return { label: "Secundario", hint: "Limita, pero no es el primer límite.", tone: "warn" };
    case "none":
      return { label: "No es un límite", hint: "Se comprobó y no limita el objetivo.", tone: "neutral" };
    default:
      return {
        label: "Candidata sin probar",
        hint: "Podría estar limitando, pero falta medir capacidad y demanda para saberlo.",
        tone: "neutral",
      };
  }
}

export function exposureLabel(exposure: string): string {
  switch (exposure) {
    case "existential":
      return "Pone en riesgo el negocio entero";
    case "high":
      return "Expone una parte grande del negocio";
    case "moderate":
      return "Expone una parte moderada";
    case "minimal":
      return "Expone muy poco";
    default:
      return "No se sabe cuánto expone";
  }
}

/**
 * Qué haría falta para poder decidir si esto limita de verdad.
 *
 * Guardrails 29 y 31 en pantalla: sin capacidad ni demanda medidas no hay test
 * que resolver. Se dice qué falta, no solo que "está pendiente".
 */
export function missingForBinding(constraint: ConstraintView): string | null {
  if (constraint.binding_status !== "latent") return null;
  const falta: string[] = [];
  if (!constraint.capacity) falta.push("cuánta capacidad hay");
  if (!constraint.demand_on_capacity) falta.push("cuánta demanda recibe");
  if (falta.length === 0) return null;
  return `Falta declarar ${falta.join(" y ")} para poder correr el contraste.`;
}

/** Agrupa por caso, conservando el orden de lectura dentro de cada uno. */
export function groupRootCausesByCase(
  rootCauses: RootCauseView[],
): { caseId: string; rootCauses: RootCauseView[] }[] {
  const porCaso = new Map<string, RootCauseView[]>();
  for (const rc of rootCauses) {
    porCaso.set(rc.case_id, [...(porCaso.get(rc.case_id) ?? []), rc]);
  }
  return [...porCaso.entries()].map(([caseId, lista]) => ({
    caseId,
    rootCauses: [...lista].sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })),
  }));
}

export function groupConstraintsByCase(
  constraints: ConstraintView[],
): { caseId: string; constraints: ConstraintView[] }[] {
  const porCaso = new Map<string, ConstraintView[]>();
  for (const k of constraints) {
    porCaso.set(k.case_id, [...(porCaso.get(k.case_id) ?? []), k]);
  }
  return [...porCaso.entries()].map(([caseId, lista]) => ({
    caseId,
    constraints: [...lista].sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })),
  }));
}
