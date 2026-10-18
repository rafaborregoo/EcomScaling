import test from "node:test";
import assert from "node:assert/strict";
import { planQueryEvidence, resolvePlanStoreScope, scopeAlertsForPlan, summarizeActiveCaminoForPlan, summarizeActiveMonthlyInitiatives, summarizeMonthlyPlanCapacity, summarizeRecentPlanAgentRuns, summarizeRecentPlanTaskOutcomes, summarizeSiblingPlanRuns, taskBelongsToPlanStore } from "./plan-horizon-context.js";

const options = {
  currentAgentCode: "a04_generador_tareas",
  horizonByAgent: { a17: "semanal", a18: "mensual", a04_generador_tareas: "diario" },
  staleAfterMsByAgent: {
    a04_generador_tareas: 20 * 60 * 60 * 1000,
    a17: 6 * 24 * 60 * 60 * 1000,
    a18: 27 * 24 * 60 * 60 * 1000,
  },
  now: Date.parse("2026-09-27T12:00:00Z"),
};

test("distingue consulta disponible vacia de un error al cargar contexto", () => {
  assert.deepEqual(planQueryEvidence([], null), { status: "available", data: [] });
  assert.deepEqual(planQueryEvidence([], { message: "database unavailable" }), {
    status: "unavailable",
    reason: "query_error",
  });
});

test("el alcance agregado solo se usa cuando no se solicita connectionId", () => {
  assert.deepEqual(resolvePlanStoreScope(null, { data: null, error: null }), {
    ok: true,
    storeId: null,
    storeLabel: "todas las tiendas de la organizacion",
  });
  assert.deepEqual(resolvePlanStoreScope("connection-a", {
    data: { id: "store-a", shop_name: "Tienda A" },
    error: null,
  }), {
    ok: true,
    storeId: "store-a",
    storeLabel: 'la tienda "Tienda A"',
  });
});

test("un connectionId ausente/inactivo o una consulta fallida no amplían a todas las tiendas", () => {
  assert.deepEqual(resolvePlanStoreScope("connection-b", { data: null, error: null }), {
    ok: false,
    statusCode: 404,
    error: "plan_store_not_found",
  });
  assert.deepEqual(resolvePlanStoreScope("connection-a", { data: null, error: { message: "timeout" } }), {
    ok: false,
    statusCode: 503,
    error: "plan_store_scope_unavailable",
  });
});

function run(code: string, title: string, startedAt: string, status = "pending_approval", approvalRequired = true) {
  return {
    started_at: startedAt,
    agent_versions: { agent_definitions: { code } },
    agent_outputs: { status, approval_required: approvalRequired, output: { proposed_writes: [{ kind: "task", title, description: "entregable", rationale: "impacto", evidence: "dato" }] } },
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
    ["mensual", "Plan mensual", "published", false],
  ]);
  assert.equal(result[0]?.approval_required, true);
});

test("conserva evidencia estructurada y la decisión efectiva de una propuesta hermana", () => {
  const weekly = run("a17", "Revisar cobertura", "2026-09-26T12:00:00Z", "approved", false) as any;
  weekly.id = "run-week";
  weekly.agent_outputs.id = "output-week";
  weekly.agent_outputs.output.proposed_writes[0].evidence = [
    { label: "Cobertura", value: "2 días", period: "semana", source: "Shopify" },
  ];
  weekly.agent_outputs.output.proposal_decisions = [
    { index: 0, decision: "approved", status: "created", title: "Revisar cobertura actualizada", task_id: "task-1" },
  ];
  const [proposal] = summarizeSiblingPlanRuns([weekly], options);
  assert.equal(proposal?.run_id, "run-week");
  assert.equal(proposal?.output_id, "output-week");
  assert.equal(proposal?.proposals[0]?.title, "Revisar cobertura actualizada");
  assert.equal((proposal?.proposals[0]?.evidence as Array<{ value: string }>)[0]?.value, "2 días");
  assert.equal(proposal?.proposals[0]?.task_id, "task-1");
});

test("la frescura de los horizontes usa la cadencia diaria, semanal y mensual", () => {
  const result = summarizeSiblingPlanRuns([
    run("a04_generador_tareas", "Plan diario antiguo", "2026-09-25T12:00:00Z"),
    run("a17", "Plan semanal vigente", "2026-09-24T12:00:00Z", "approved", false),
    run("a18", "Plan mensual vigente", "2026-09-10T12:00:00Z", "approved", false),
  ], {
    ...options,
    currentAgentCode: "a17",
  });
  assert.deepEqual(result.map((item) => [item.agent_code, item.stale, item.approval_required]), [
    ["a04_generador_tareas", true, true],
    ["a18", false, false],
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

test("A18 cuantifica compromisos por tienda sin inventar horas de capacidad", () => {
  const summary = summarizeMonthlyPlanCapacity([
    { status: "in_progress", priority: "high", due_at: "2026-09-28T12:00:00Z", store_id: "store-a", metadata: { ai_effort_estimate: "high" } },
    { status: "pending", priority: "urgent", due_at: "2026-10-10T12:00:00Z", store_id: null, metadata: { ai_effort_estimate: "low" } },
    { status: "pending", priority: "low", due_at: null, store_id: "store-a" },
    { status: "pending", priority: "high", due_at: "2026-09-30T12:00:00Z", store_id: "store-b" },
    { status: "completed", priority: "urgent", due_at: "2026-09-20T12:00:00Z", store_id: "store-a" },
  ], "store-a", { now: Date.parse("2026-09-29T12:00:00Z"), horizonDays: 30 });

  assert.deepEqual(summary, {
    scope: "store_plus_unscoped",
    observed_commitments: 3,
    in_progress: 1,
    pending: 2,
    overdue: 1,
    due_within_horizon: 1,
    high_or_urgent: 2,
    effort_estimates: { low: 1, medium: 0, high: 1, unknown: 1 },
    effort_estimate_coverage: 2 / 3,
    estimated_effort_hours: null,
    available_capacity_hours: null,
    capacity_status: "not_quantifiable",
    capacity_limit: "Las bandas cualitativas de esfuerzo describen solo tareas que las tienen; no hay capacidad mensual configurada ni equivalencia validada a horas, así que los datos no calculan disponibilidad.",
  });
});

test("A18 solo puede versionar iniciativas publicadas del scope exacto", () => {
  const summary = summarizeActiveMonthlyInitiatives([
    { id: "task-a", title: "Iniciativa A", status: "pending", source: "ai_consultant", store_id: "store-a", metadata: { ai_monthly_initiative: {} } },
    { id: "task-global", title: "Iniciativa global", status: "pending", source: "ai_consultant", store_id: null, metadata: { ai_monthly_initiative: {} } },
    { id: "task-b", title: "Otra tienda", status: "pending", source: "ai_consultant", store_id: "store-b", metadata: { ai_monthly_initiative: {} } },
    { id: "task-manual", title: "No es del agente", status: "pending", source: "manual", store_id: "store-a", metadata: { ai_monthly_initiative: {} } },
    { id: "task-closed", title: "Retirada", status: "pending", source: "ai_consultant", store_id: "store-a", metadata: { ai_monthly_initiative: { lifecycle_status: "retired" } } },
  ], "store-a");
  assert.deepEqual(summary.map((item) => item.task_id), ["task-a"]);
});

test("A19 recibe las salidas aprobadas más recientes de A04/A17/A18 con tienda y frescura", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  const summaries = summarizeRecentPlanAgentRuns([
    {
      id: "run-day", organization_id: "org-a", store_id: "store-a", status: "succeeded", finished_at: "2026-09-28T00:00:00Z",
      agent_versions: { version: "v1", agent_definitions: { code: "a04_generador_tareas" } },
      agent_outputs: { id: "out-day", status: "approved", output: { answer: "Señal diaria.", findings: [{ title: "Venta detenida", severity: "high" }], proposed_writes: [{ kind: "task", title: "Revisar campaña", priority: "high" }] } },
    },
    {
      id: "run-week", organization_id: "org-a", store_id: "store-a", status: "succeeded", finished_at: "2026-09-29T11:00:00Z",
      agent_versions: { version: "v3", agent_definitions: { code: "a17_plan_semanal" } },
      agent_outputs: { id: "out-week", status: "pending_approval", output: { answer: "No aprobada." } },
    },
    {
      id: "run-week-approved", organization_id: "org-a", store_id: "store-a", status: "succeeded", finished_at: "2026-09-21T12:00:00Z",
      agent_versions: { version: "v3", agent_definitions: { code: "a17_plan_semanal" } },
      agent_outputs: { id: "out-week-approved", status: "approved", output: { answer: "Señal semanal dentro de la ventana." } },
    },
    {
      id: "run-month-old", organization_id: "org-a", store_id: "store-a", status: "succeeded", finished_at: "2026-08-24T11:59:59Z",
      agent_versions: { version: "v6", agent_definitions: { code: "a18_plan_mensual" } },
      agent_outputs: { id: "out-month-old", status: "published", output: { answer: "Señal mensual antigua." } },
    },
    {
      id: "run-other-store", organization_id: "org-a", store_id: "store-b", status: "succeeded", finished_at: "2026-09-29T11:30:00Z",
      agent_versions: { version: "v3", agent_definitions: { code: "a17_plan_semanal" } },
      agent_outputs: { id: "out-other", status: "approved", output: { answer: "No mezclar." } },
    },
  ], { organizationId: "org-a", storeId: "store-a", now });

  assert.deepEqual(summaries.map((summary) => summary.agent_code), ["a04_generador_tareas", "a17_plan_semanal", "a18_plan_mensual"]);
  assert.equal(summaries[0]?.stale, false);
  const dailySummary = summaries[0] as { summary?: { proposed_tasks?: unknown[] } };
  assert.deepEqual(dailySummary.summary?.proposed_tasks, [{ title: "Revisar campaña", description: null, rationale: null, priority: "high", milestone_id: null }]);
  assert.equal(summaries[1]?.stale, false);
  assert.equal(summaries[2]?.stale, true);
});

test("incluye solo alertas atribuidas a la tienda y omite las organizativas", () => {
  const alerts = [
    { title: "Caída de ventas tienda A", severity: "high", store_id: "store-a" },
    { title: "Caída de ventas tienda B", severity: "high", store_id: "store-b" },
    { title: "Alerta antigua agregada", severity: "medium", store_id: null },
  ];
  assert.deepEqual(scopeAlertsForPlan(alerts, "store-a"), {
    status: "available",
    scope: "store",
    alerts: [alerts[0]],
    unscoped_omitted: 2,
  });
  assert.deepEqual(scopeAlertsForPlan(alerts, null), {
    status: "available",
    scope: "organization",
    alerts: alerts.slice(0, 30),
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
    goal: { metric_key: "net_margin_pct", metric_label: "Margen neto", unit: "pct", currency_code: null, baseline: 12, target: 18, target_offset_days: 90, rationale: "Mejorar rentabilidad" },
    version: 3,
    strategic_plan_phases: [{
      name: "Fundamentos",
      status: "active",
      position: 1,
      strategic_plan_milestones: [
        {
          name: "Revisar descuentos",
          description: "Evaluar promociones y margen",
          status: "active",
          position: 1,
          target_date: "2026-10-15",
          milestone_task_links: [
            { tasks: { title: "Tarea tienda A", status: "pending", store_id: "store-a" } },
            { tasks: { title: "Tarea tienda B", status: "pending", store_id: "store-b" } },
            { tasks: { title: "Tarea compartida", status: "in_progress", store_id: null } },
            { tasks: { title: "Tarea completada", status: "completed", store_id: "store-a" } },
          ],
        },
        { name: "Hito ya cerrado", status: "completed" },
      ],
    }],
  }, "store-a");
  assert.equal(summary.status, "available");
  assert.equal((summary.goal as { metric_key?: string })?.metric_key, "net_margin_pct");
  assert.deepEqual(summary.phases, [{ name: "Fundamentos", status: "active" }]);
  assert.deepEqual(summary.milestones[0]?.linked_tasks.map((task) => task.title), ["Tarea tienda A", "Tarea compartida"]);
  assert.deepEqual(summarizeActiveCaminoForPlan(null, "store-a"), { status: "unavailable", reason: "no_active_path" });
});

test("summarizeOpenTasksForPlan separa lo cercano del backlog lejano", async () => {
  const { summarizeOpenTasksForPlan } = await import("./plan-horizon-context.js");
  const now = Date.parse("2026-10-15T10:00:00Z");
  const day = 86_400_000;
  const task = (title: string, dueDays: number | null, status = "pending") => ({
    title, status, priority: "high", source: "strategic_plan", store_id: null,
    description: "x".repeat(500), due_at: dueDays === null ? null : new Date(now + dueDays * day).toISOString(),
  });
  const out = summarizeOpenTasksForPlan(
    [task("vence hoy", 0), task("lejana", 60), task("sin fecha", null), task("vencida", -2), task("cerrada", 1, "completed")],
    null,
    { now },
  );
  assert.equal(out.total_open, 4);
  assert.deepEqual(out.near_term.map((t) => t.title), ["vencida", "vence hoy", "sin fecha"]);
  assert.equal(out.later_count, 1);
  assert.equal(out.later[0]?.title, "lejana");
  assert.equal((out.near_term[0]?.description as string).length, 240);
  const prioritized = summarizeOpenTasksForPlan([
    ...Array.from({ length: 3 }, (_, index) => ({ ...task(`pendiente ${index}`, 1), id: `p${index}` })),
    { ...task("en curso", null, "in_progress"), id: "doing" },
  ], null, { now, nearLimit: 1, totalCount: 4 });
  assert.equal(prioritized.near_term[0]?.title, "en curso");
  assert.equal(prioritized.total_open, 4);
  assert.equal(prioritized.sample_truncated, false);
});

test("stock risk for the daily plan puts the soonest stock-out first and keeps unknown cover after", async () => {
  const { summarizeStockRiskForPlan } = await import("./plan-horizon-context.js");
  const result = summarizeStockRiskForPlan([
    { title: "Lento", available_quantity: 90, quantity_sold_in_period: 10, days_of_cover: 30 },
    { title: "Sin cobertura", available_quantity: null, quantity_sold_in_period: 200, days_of_cover: null },
    { title: "Urgente", available_quantity: 6, quantity_sold_in_period: 132, days_of_cover: 1.4 },
  ]);
  assert.deepEqual(result.items.map((item) => item.title), ["Urgente", "Lento", "Sin cobertura"]);
  assert.equal(summarizeStockRiskForPlan([]).status, "no_sales_in_period");
});

test("specialist outputs for the daily plan keep conclusion, findings and recommendations with provenance", async () => {
  const { compactSpecialistOutputsForPlan } = await import("./plan-horizon-context.js");
  const result = compactSpecialistOutputsForPlan({
    status: "available",
    outputs: [{ agent_code: "a24_medicion_meta", output_id: "o1", as_of: "2026-10-14", valid_until: "2026-11-13",
      summary: { answer: "x".repeat(900), findings: [{ title: "Evento de compra duplicado", severity: "high", evidence: "e" }],
        recommendations: [{ action: "Desduplicar píxel y CAPI", priority: "high" }], sources: [{ reference: "r" }] } }],
  });
  const [output] = result.outputs;
  assert.equal(output?.output_id, "o1");
  assert.equal(output?.conclusion?.length, 320);
  assert.equal(output?.recommendations[0]?.action, "Desduplicar píxel y CAPI");
  assert.equal(compactSpecialistOutputsForPlan(null).outputs.length, 0);
});
