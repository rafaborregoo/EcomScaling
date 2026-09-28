import test from "node:test";
import assert from "node:assert/strict";
import { planQueryEvidence, scopeAlertsForPlan, summarizeActiveCaminoForPlan, summarizeRecentPlanTaskOutcomes, summarizeSiblingPlanRuns, taskBelongsToPlanStore } from "./plan-horizon-context.js";

const options = {
  currentAgentCode: "a04_generador_tareas",
  horizonByAgent: { a17: "semanal", a18: "mensual", a04_generador_tareas: "diario" },
  now: Date.parse("2026-09-27T12:00:00Z"),
};

test("distingue consulta disponible vacia de un error al cargar contexto", () => {
  assert.deepEqual(planQueryEvidence([], null), { status: "available", data: [] });
  assert.deepEqual(planQueryEvidence([], { message: "database unavailable" }), {
    status: "unavailable",
    reason: "query_error",
  });
});

function run(code: string, title: string, startedAt: string, status = "pending_approval") {
  return {
    started_at: startedAt,
    agent_versions: { agent_definitions: { code } },
    agent_outputs: { status, output: { proposed_writes: [{ kind: "task", title, description: "entregable", rationale: "impacto", evidence: "dato" }] } },
  };
}

test("conserva solo la ejecucion mas reciente de cada horizonte hermano y su estado", () => {
  const result = summarizeSiblingPlanRuns([
    run("a17", "Plan semanal nuevo", "2026-09-26T12:00:00Z"),
    run("a17", "Plan semanal antiguo", "2026-09-20T12:00:00Z"),
    run("a18", "Plan mensual", "2026-09-10T12:00:00Z", "published"),
    run("a04_generador_tareas", "No incluir", "2026-09-27T11:00:00Z"),
  ], options);
  assert.deepEqual(result.map((item) => [item.horizon, item.proposals[0]?.title, item.output_status, item.stale]), [
    ["semanal", "Plan semanal nuevo", "pending_approval", false],
    ["mensual", "Plan mensual", "published", true],
  ]);
});

test("el resumen mensual conserva el hito y la medición estructurada para A17", () => {
  const milestoneId = "83000000-0000-4000-8000-000000000017";
  const result = summarizeSiblingPlanRuns([
    {
      ...run("a18_plan_mensual", "Reducir descuentos sin margen", "2026-09-26T12:00:00Z", "approved"),
      agent_versions: { agent_definitions: { code: "a18_plan_mensual" } },
      agent_outputs: {
        status: "approved",
        output: {
          proposed_writes: [{
            kind: "task",
            title: "Reducir descuentos sin margen",
            description: "Probar una regla de descuento por margen.",
            milestone_id: milestoneId,
            owner_role: "cliente",
            completion_criteria: "La regla queda activa y revisada.",
            expected_metric: "Margen de contribución; 30 días.",
            initiative_measurement: {
              metric_name: "Margen de contribución",
              unit: "%",
              baseline: 18.5,
              target: 20,
              evaluation_window: "30 días desde la activación",
              internal_note: "no propagar",
            },
          }],
        },
      },
    },
  ], {
    ...options,
    horizonByAgent: { ...options.horizonByAgent, a18_plan_mensual: "mensual" },
  });
  assert.equal(result[0]?.output_status, "approved");
  assert.deepEqual(result[0]?.proposals[0], {
    kind: "task",
    title: "Reducir descuentos sin margen",
    description: "Probar una regla de descuento por margen.",
    rationale: null,
    priority: null,
    owner: null,
    owner_role: "cliente",
    milestone_id: milestoneId,
    completion_criteria: "La regla queda activa y revisada.",
    expected_metric: "Margen de contribución; 30 días.",
    initiative_measurement: {
      metric_name: "Margen de contribución",
      unit: "%",
      baseline: 18.5,
      target: 20,
      evaluation_window: "30 días desde la activación",
    },
    evidence: null,
  });
});

test("ignora runs corruptos y codigos desconocidos", () => {
  assert.deepEqual(summarizeSiblingPlanRuns([
    null,
    run("a99", "desconocido", "2026-09-27T11:00:00Z"),
    { started_at: "2026-09-27T11:00:00Z", agent_versions: { agent_definitions: { code: "a17" } }, agent_outputs: null },
  ], options), []);
});

test("el backlog de un plan incluye tareas globales y de su tienda, nunca de otra tienda", () => {
  assert.equal(taskBelongsToPlanStore("store-a", "store-a"), true);
  assert.equal(taskBelongsToPlanStore(null, "store-a"), true);
  assert.equal(taskBelongsToPlanStore("store-b", "store-a"), false);
  assert.equal(taskBelongsToPlanStore("store-b", null), true);
});

test("omite alertas de organizacion de un plan de tienda para no atribuirlas mal", () => {
  const alerts = [{ title: "Caída de ventas tienda B", severity: "high" }];
  assert.deepEqual(scopeAlertsForPlan(alerts, "store-a"), {
    status: "omitted_unscoped",
    scope: "organization",
  });
  assert.deepEqual(scopeAlertsForPlan(alerts, null), {
    status: "available",
    scope: "organization",
    alerts,
  });
});

test("resume feedback operativo reciente sin convertir el estado completado en impacto", () => {
  const summary = summarizeRecentPlanTaskOutcomes([
    { title: "Ajustar landing", status: "completed", source: "ai", store_id: "store-a", updated_at: "2026-09-26T12:00:00Z", completed_at: "2026-09-26T11:00:00Z", outcome_metric_name: "Conversión", outcome_before_value: 1.8, outcome_after_value: 2.1, outcome_unit: "%", outcome_summary: "Misma ventana de 7 días", outcome_measured_at: "2026-09-26" },
    { title: "Revisar oferta", status: "ignored", ignored_reason: "sin margen", store_id: "store-a", updated_at: "2026-09-25T12:00:00Z" },
    { title: "No mezclar", status: "completed", store_id: "store-b", updated_at: "2026-09-26T12:00:00Z" },
    { title: "Antigua", status: "completed", store_id: "store-a", updated_at: "2026-06-01T12:00:00Z" },
    { title: "Abierta", status: "pending", store_id: "store-a", updated_at: "2026-09-26T12:00:00Z" },
  ], "store-a", { now: Date.parse("2026-09-27T12:00:00Z"), lookbackDays: 60 });
  assert.deepEqual(summary, [
    { title: "Ajustar landing", status: "completed", source: "ai", completed_at: "2026-09-26T11:00:00Z", updated_at: "2026-09-26T12:00:00Z", ignored_reason: null, measured_outcome: { metric_name: "Conversión", evidence_status: "user_reported_unverified", before_value: 1.8, after_value: 2.1, unit: "%", summary: "Misma ventana de 7 días", measured_at: "2026-09-26" } },
    { title: "Revisar oferta", status: "ignored", source: null, completed_at: null, updated_at: "2026-09-25T12:00:00Z", ignored_reason: "sin margen" },
  ]);
});

test("los tres horizontes reciben objetivo e hitos del Camino sin tareas de otra tienda", () => {
  const summary = summarizeActiveCaminoForPlan({
    name: "Camino crecimiento",
    goal: "Mejorar margen de contribucion",
    version: 3,
    strategic_plan_phases: [{
      name: "Fundamentos",
      status: "in_progress",
      strategic_plan_milestones: [
        {
          name: "Revisar descuentos",
          description: "Evaluar promociones y margen",
          status: "in_progress",
          target_date: "2026-10-15",
          milestone_task_links: [
            { tasks: { title: "Tarea tienda A", status: "pending", store_id: "store-a" } },
            { tasks: { title: "Tarea tienda B", status: "pending", store_id: "store-b" } },
            { tasks: { title: "Tarea compartida", status: "in_progress", store_id: null } },
          ],
        },
        { name: "Hito ya cerrado", status: "completed" },
      ],
    }],
  }, "store-a");
  assert.equal(summary.status, "available");
  assert.equal(summary.goal, "Mejorar margen de contribucion");
  assert.deepEqual(summary.milestones[0]?.linked_tasks.map((task) => task.title), ["Tarea tienda A", "Tarea compartida"]);
  assert.deepEqual(summarizeActiveCaminoForPlan(null, "store-a"), { status: "unavailable", reason: "no_active_path" });
});
