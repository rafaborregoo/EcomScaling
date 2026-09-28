import assert from "node:assert/strict";
import test from "node:test";
import { caminoPlanSchemaForHorizon, caminoWeeklyReviewSchema, parseCaminoDurationMonths } from "./index.js";

const plan = {
  plan_name: "Ruta de crecimiento",
  horizon_months: 4,
  diagnosis: "Datos de ejemplo",
  goal: {
    metric_key: "net_sales",
    metric_label: "Ingresos netos",
    unit: "money",
    currency_code: "EUR",
    baseline: 8000,
    target: 10000,
    target_offset_days: 90,
    rationale: "Objetivo sujeto a recuperar margen.",
    assumptions: [],
    confidence: "medium",
  },
  phases: [{
    name: "Fundamentos",
    description: "Resolver límites medidos.",
    rationale: "Antes de escalar.",
    evidence: [],
    milestones: [{
      name: "Completar costes",
      description: "Costes del catálogo principal.",
      target_offset_days: 30,
      success_metric: "Todos los productos principales tienen coste.",
    }],
  }],
  sources: [],
  confidence: "medium",
  warnings: [],
};

test("A19 rechaza objetivo e hitos posteriores al horizonte pedido", () => {
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse(plan).success, true);
  assert.equal(caminoPlanSchemaForHorizon(60, 2).safeParse(plan).success, false);
  const missingHorizon = structuredClone(plan) as Record<string, any>;
  delete missingHorizon.horizon_months;
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse(missingHorizon).success, false);
  const lateMilestone = structuredClone(plan);
  lateMilestone.phases[0]!.milestones[0]!.target_offset_days = 61;
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse(lateMilestone).success, true);
  assert.equal(caminoPlanSchemaForHorizon(60, 2).safeParse(lateMilestone).success, false);
});

test("A19 acepta cualquier duración entera de 1 a 12 meses y conserva alias antiguos", () => {
  assert.equal(parseCaminoDurationMonths(4), 4);
  assert.equal(parseCaminoDurationMonths("4"), 4);
  assert.equal(parseCaminoDurationMonths("quarter"), 3);
  assert.equal(parseCaminoDurationMonths(13), null);
  assert.equal(parseCaminoDurationMonths("0"), null);
});

test("A19 conserva metadata de periodo añadida por servidor sin exigirla a propuestas antiguas", () => {
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse(plan).success, true);
  const enriched = structuredClone(plan) as any;
  enriched.goal!.baseline_window_days = 240;
  enriched.goal!.baseline_observed_at = "2026-09-28T12:00:00.000Z";
  enriched.goal!.target_date = "2027-01-26";
  const parsed = caminoPlanSchemaForHorizon(120, 4).parse(enriched);
  assert.equal(parsed.goal?.baseline_window_days, 240);
  assert.equal(parsed.goal?.target_date, "2027-01-26");
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse({ ...enriched, goal: { ...enriched.goal, baseline_window_days: 0 } }).success, false);
});

test("la revisión A19 es estructurada y sus propuestas no implican escrituras", () => {
  const review = {
    plan_version: 2,
    period_start: "2026-09-20T00:00:00.000Z",
    period_end: "2026-09-27T00:00:00.000Z",
    executive_summary: "Un hito se completó y otro está en riesgo.",
    goal_progress: { status: "at_risk", observed_value: 8200, comparison_value: 7900, explanation: "La cifra aún está bajo el ritmo esperado." },
    progress: [{ item: "Completar costes", status: "completed", evidence: "Tarea vinculada completada." }],
    risks: [{ severity: "medium", detail: "El margen no está sincronizado.", evidence: "Sin cobertura financiera suficiente." }],
    next_actions: [{ priority: "high", title: "Validar margen", rationale: "Evita escalar sin rentabilidad observada.", owner: "shared", due_in_days: 7 }],
    change_proposals: [{ change: "edit", target_type: "milestone", target_id: "milestone-1", description: "Revisar fecha objetivo.", reason: "Bloqueo documentado.", evidence: "La tarea sigue bloqueada." }],
    confidence: "medium",
    warnings: ["No hay dato de margen actualizado."],
  };
  assert.equal(caminoWeeklyReviewSchema.safeParse(review).success, true);
  assert.equal(caminoWeeklyReviewSchema.safeParse({ ...review, next_actions: [{ ...review.next_actions[0], due_in_days: 45 }] }).success, false);
});
