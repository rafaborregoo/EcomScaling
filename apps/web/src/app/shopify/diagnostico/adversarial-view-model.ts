/** F3/D12. Traducción pura de estados adversariales a lenguaje de lectura. */
export type AdversarialTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type AdversarialConfounderView = {
  id: string;
  case_id: string;
  confounder_type: string;
  category: string;
  description: string;
  evidence: string | null;
  plausibility: string;
  strength: string;
  materiality: string;
  status: string;
  resolution: string;
  confidence_effect: string | null;
  masking_effect: boolean;
};

export type AdversarialReviewView = {
  id: string;
  organization_name: string | null;
  case_id: string;
  false_diagnosis_risk: string;
  survival_status: string;
  robustness: string;
  diagnosis_stability: string;
  confidence_before: string | null;
  confidence_after: string | null;
  confidence_adjustment: string | null;
  red_team_counter_explanation: string | null;
  red_team_supporting_evidence: string | null;
  red_team_required_evidence: string | null;
  red_team_effect: string | null;
  revision_triggered: boolean;
  reopened_blocks: string[];
  revision_state?: string | null;
  revision_budget_used?: number;
  revisions?: Array<{ id: string; status: string; attempt: number; reopened_blocks: string[]; decided_at: string | null }>;
  remaining_limitations: string | null;
  confounders: AdversarialConfounderView[];
  gates: Array<Record<string, string | null>>;
  checks: Array<{ id: string; check_key: string; status: string; outcome: string | null; reason: string | null }>;
  sensitivity: Array<{ id: string; assumption: string; diagnosis_changes: boolean; note: string | null }>;
};

export function survivalStatusLabel(status: string): { label: string; hint: string; tone: AdversarialTone } {
  switch (status) {
    case "survives": return { label: "Resiste", hint: "La contraexplicación fue revisada y no encontró un cambio material con las fuentes disponibles.", tone: "success" };
    case "survives_with_limitations": return { label: "Resiste con límites", hint: "La lectura sigue en pie, pero hay controles o supuestos que deben quedar visibles.", tone: "warn" };
    case "weakened": return { label: "Debilitado", hint: "Un confusor observado cambia cuánto puede sostenerse la interpretación.", tone: "warn" };
    case "requires_revision": return { label: "Requiere revisión", hint: "La evidencia adversarial impide cerrar el diagnóstico tal como está.", tone: "danger" };
    case "invalidated": return { label: "Invalidado", hint: "La interpretación no sobrevive a la evidencia disponible.", tone: "danger" };
    default: return { label: "Sin revisión", hint: "Todavía no hay una revisión adversarial persistida.", tone: "neutral" };
  }
}

export function riskLabel(risk: string): { label: string; tone: AdversarialTone } {
  switch (risk) {
    case "critical": return { label: "Riesgo crítico", tone: "danger" };
    case "high": return { label: "Riesgo alto", tone: "danger" };
    case "medium": return { label: "Riesgo medio", tone: "warn" };
    default: return { label: "Riesgo bajo", tone: "success" };
  }
}

export function confounderStatusLabel(status: string): { label: string; hint: string; tone: AdversarialTone } {
  switch (status) {
    case "material": return { label: "Material", hint: "Tiene evidencia y cambia la fuerza de la lectura.", tone: "danger" };
    case "supported": return { label: "Soportado", hint: "Hay evidencia observable; todavía hay que leer su efecto con el test.", tone: "warn" };
    case "plausible": return { label: "Plausible", hint: "Podría influir, pero aún falta evidencia para sostenerlo.", tone: "brand" };
    case "rejected": return { label: "Descartado", hint: "La evidencia muestra que no explica este movimiento.", tone: "neutral" };
    case "resolved": return { label: "Controlado", hint: "Su efecto ya está aislado o contado en la lectura.", tone: "success" };
    default: return { label: "Candidato", hint: "Es una posibilidad abierta, no un hecho.", tone: "neutral" };
  }
}

export function comparabilityLabel(value: string): { label: string; tone: AdversarialTone } {
  switch (value) {
    case "comparable": return { label: "Comparable", tone: "success" };
    case "partially_comparable": return { label: "Parcialmente comparable", tone: "warn" };
    case "not_comparable": return { label: "No comparable", tone: "danger" };
    default: return { label: "Comparabilidad desconocida", tone: "neutral" };
  }
}

export function checkStatusLabel(status: string): { label: string; tone: AdversarialTone } {
  switch (status) {
    case "executed": return { label: "Ejecutado", tone: "success" };
    case "not_possible": return { label: "No posible", tone: "warn" };
    case "skipped": return { label: "Omitido con motivo", tone: "danger" };
    default: return { label: "Pendiente", tone: "neutral" };
  }
}

export function groupReviewsByCase(reviews: AdversarialReviewView[]) {
  const groups = new Map<string, AdversarialReviewView[]>();
  for (const review of reviews) groups.set(review.case_id, [...(groups.get(review.case_id) ?? []), review]);
  return [...groups.entries()].map(([caseId, items]) => ({ caseId, reviews: items }));
}
