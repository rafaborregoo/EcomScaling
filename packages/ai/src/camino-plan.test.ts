import assert from "node:assert/strict";
import test from "node:test";
import { caminoCalendarHorizonDays, caminoPlanSchemaForHorizon, caminoWeeklyReviewSchema, normalizeCaminoTimeline, parseCaminoDurationMonths, type CaminoPlanOutput } from "./index.js";

const plan: CaminoPlanOutput = {
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
      rationale: "",
      tasks: [],
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

test("A19 rechaza hitos fuera del orden cronológico entre fases", () => {
  const ordered = structuredClone(plan);
  ordered.phases.push({
    name: "Medición",
    description: "Comparar resultados.",
    rationale: "Después de completar los fundamentos.",
    evidence: [],
    milestones: [{
      name: "Revisar serie",
      description: "Comparación mensual.",
      target_offset_days: 60,
      success_metric: "Ventanas comparables registradas.",
      rationale: "",
      tasks: [],
    }],
  });
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse(ordered).success, true);

  ordered.phases[1]!.milestones[0]!.target_offset_days = 30;
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse(ordered).success, false);
  ordered.phases[1]!.milestones[0]!.target_offset_days = 29;
  const result = caminoPlanSchemaForHorizon(120, 4).safeParse(ordered);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.message.includes("orden cronológico")));
  }
});

test("A19 normaliza fases y fechas antes de validar la propuesta", () => {
  const outOfOrder = structuredClone(plan) as CaminoPlanOutput;
  outOfOrder.phases[0]!.milestones.push({
    name: "Cierre de medición",
    description: "Cerrar la serie.",
    target_offset_days: 50,
    success_metric: "Serie documentada.",
    rationale: "",
    tasks: [],
  });
  outOfOrder.phases.push({
    name: "Seguimiento mensual",
    description: "Revisar ventanas comparables.",
    rationale: "Mantener aprendizaje.",
    evidence: [],
    milestones: [{
      name: "Checkpoint",
      description: "Actualizar resultados.",
      target_offset_days: 40,
      success_metric: "Revisión documentada.",
      rationale: "",
      tasks: [{ title: "Actualizar serie", description: "Registrar datos.", target_offset_days: 35, priority: "medium", owner: "shared", kind: "analisis", track: "puesta_a_punto", cadence: "una_vez", effort_hours: 1, definition_of_done: "Serie actualizada.", evidence: [] }],
    }],
  });

  const normalized = normalizeCaminoTimeline(outOfOrder);
  assert.deepEqual(normalized.phases.map((phase) => phase.name), ["Fundamentos", "Seguimiento mensual"]);
  assert.deepEqual(normalized.phases.flatMap((phase) => phase.milestones.map((milestone) => milestone.target_offset_days)), [30, 50, 51]);
  assert.equal(normalized.phases[1]!.milestones[0]!.tasks[0]!.target_offset_days, 46);
  assert.ok(normalized.warnings.some((warning) => warning.includes("orden cronológico")));
  assert.equal(caminoPlanSchemaForHorizon(120, 4).safeParse(normalized).success, true);
});

test("A19 convierte meses calendario a días reales y limita al último día del mes", () => {
  assert.equal(caminoCalendarHorizonDays(new Date("2026-10-05T12:00:00.000Z"), 12), 365);
  assert.equal(caminoCalendarHorizonDays(new Date("2023-03-01T00:00:00.000Z"), 12), 366);
  assert.equal(caminoCalendarHorizonDays(new Date("2026-01-31T00:00:00.000Z"), 1), 28);
  assert.equal(caminoCalendarHorizonDays(new Date("2024-01-31T00:00:00.000Z"), 1), 29);
});

test("A19 alinea los checkpoints mensuales que existan sin exigirlos", () => {
  const monthly = structuredClone(plan);
  monthly.horizon_months = 12;
  monthly.phases[0]!.milestones = Array.from({ length: 12 }, (_, index) => ({
    ...monthly.phases[0]!.milestones[0]!,
    name: index === 0
      ? "Validar definiciones y primera medición mensual"
      : index === 11
        ? "Cierre anual y decisión"
        : `Revisión mensual ${index}`,
    target_offset_days: 30 + index * 30,
  }));
  const referenceDate = new Date("2026-10-05T12:00:00.000Z");
  const normalized = normalizeCaminoTimeline(monthly, { referenceDate, horizonMonths: 12 });
  assert.deepEqual(
    normalized.phases[0]!.milestones.map((milestone) => milestone.target_offset_days),
    Array.from({ length: 12 }, (_, index) => caminoCalendarHorizonDays(referenceDate, index + 1)),
  );
  assert.match(normalized.phases[0]!.milestones[0]!.name, /revisión mensual 1/i);
  assert.equal(normalized.phases[0]!.milestones[1]!.name, "Revisión mensual 2");
  assert.match(normalized.phases[0]!.milestones[11]!.name, /revisión mensual 12/i);
  assert.equal(caminoPlanSchemaForHorizon(365, 12).safeParse(normalized).success, true);

  // Las revisiones las hace el agente de revisión semanal: ya no se exige un hito de revisión por mes.
  const missingMonth = structuredClone(monthly);
  missingMonth.phases[0]!.milestones.pop();
  assert.equal(caminoPlanSchemaForHorizon(365, 12).safeParse(missingMonth).success, true);
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
    learnings: [],
    next_actions: [{ priority: "high", title: "Validar margen", rationale: "Evita escalar sin rentabilidad observada.", owner: "shared", due_in_days: 7 }],
    change_proposals: [{ change: "edit", target_type: "milestone", target_id: "milestone-1", description: "Revisar fecha objetivo.", reason: "Bloqueo documentado.", evidence: "La tarea sigue bloqueada." }],
    confidence: "medium",
    warnings: ["No hay dato de margen actualizado."],
  };
  assert.equal(caminoWeeklyReviewSchema.safeParse(review).success, true);
  assert.equal(caminoWeeklyReviewSchema.safeParse({ ...review, next_actions: [{ ...review.next_actions[0], due_in_days: 45 }] }).success, false);
});
