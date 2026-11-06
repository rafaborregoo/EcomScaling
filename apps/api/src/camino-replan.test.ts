import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorCaminoMonths, caminoPlanOutputSchema, type CaminoPlanOutput } from "@e-nora/ai";
import { analyzeReplan, dropUnknownReferences, monthRoute, proposalExpired, type CurrentPlan, type ManualDecisions, type Restriction } from "./camino-replan.js";
import { adjustCaminoProposal } from "./camino-proposal-adjustment.js";
import { buildPlanTree, caminoProposalToPlanInput, type PlanInput } from "./strategic-plans.js";

const task = (id: string, title: string, status = "pending", due = "2026-11-20", source = "strategic_plan") => ({
  id,
  title,
  description: `Pasos de ${title}`,
  status,
  priority: "medium",
  due_at: `${due}T00:00:00+00:00`,
  source,
  owner_role: "shared",
  kind: "otro",
  track: "puesta_a_punto",
  cadence: "una_vez",
  effort_hours: 2,
  definition_of_done: "Hecha",
  rationale: null,
  evidence: [],
});

const money = {
  metric_key: "net_sales" as const,
  metric_label: "Ventas netas",
  unit: "money" as const,
  currency_code: "EUR",
  baseline: 20000,
  target: 75000,
  target_offset_days: 49,
  rationale: "Temporada",
  assumptions: [],
  confidence: "medium" as const,
};

function currentPlan(): CurrentPlan {
  return {
    id: "plan-1",
    name: "Invierno",
    version: 1,
    status: "active",
    currency_code: "EUR",
    starts_on: "2026-10-15",
    created_at: "2026-10-15T08:00:00Z",
    goal: {
      ...money,
      monthly_targets: [
        { month: 1, target_value: 22000, rationale: "Octubre" },
        { month: 2, target_value: 75000, rationale: "Noviembre" },
        { month: 3, target_value: 46000, rationale: "Diciembre" },
      ],
    },
    phases: [
      {
        name: "Preparar",
        milestones: [
          {
            id: "m-done",
            name: "Medición lista",
            description: null,
            success_criteria: null,
            rationale: null,
            status: "completed",
            target_date: "2026-10-20",
            deadline_date: null,
            measurement_date: null,
            tasks: [task("t-done", "Revisar píxel", "completed", "2026-10-18")],
          },
          {
            id: "m-open",
            name: "Black Friday",
            description: "Campaña",
            success_criteria: "Campaña lista",
            rationale: null,
            status: "pending",
            target_date: "2026-11-20",
            deadline_date: null,
            measurement_date: null,
            tasks: [task("t-open", "Preparar oferta"), task("t-other", "Revisar stock de héroes")],
          },
        ],
      },
    ],
  };
}

const proposedTask = (title: string, overrides: Partial<NonNullable<NonNullable<NonNullable<PlanInput["phases"]>[number]["milestones"]>[number]["tasks"]>[number]> = {}) => ({
  title,
  description: "",
  dueAt: "2026-11-20",
  priority: "medium",
  owner: "shared",
  kind: "otro",
  track: "puesta_a_punto",
  cadence: "una_vez",
  effortHours: 2,
  definitionOfDone: "",
  evidence: [],
  ...overrides,
});

function proposalInput(overrides: { months?: Array<[string, number | null]>; target?: number | null; metric?: "net_sales" | "net_margin_pct"; currency?: string; tasks?: ReturnType<typeof proposedTask>[]; date?: string } = {}): PlanInput {
  const months = overrides.months ?? [["2026-11", 75000], ["2026-12", 46000]];
  return {
    name: "Invierno v2",
    goal: {
      ...money,
      metric_key: overrides.metric ?? "net_sales",
      target: overrides.target === undefined ? 75000 : overrides.target,
      currency_code: overrides.currency ?? "EUR",
      horizon_end_date: "2027-01-05",
      monthly_targets: months.map(([period, target_value], index) => ({ month: index + 1, period, target_value, rationale: `Para ${period}` })),
    },
    phases: [{
      name: "Preparar",
      milestones: [{
        name: "Black Friday",
        sourceMilestoneId: "m-open",
        successCriteria: "Campaña lista",
        targetDate: overrides.date ?? "2026-11-20",
        tasks: overrides.tasks ?? [proposedTask("Preparar oferta", { sourceTaskId: "t-open" }), proposedTask("Revisar stock de héroes", { sourceTaskId: "t-other" })],
      }],
    }],
  };
}

const ALL_SCOPES = ["dates", "margin", "tasks", "goals", "strategy"];
const noManual: ManualDecisions = { milestones: {}, tasks: {}, goal: false };
const run = (proposal: PlanInput, extra: { manual?: ManualDecisions; restrictions?: Restriction[]; scopes?: string[]; decisions?: Record<string, "accept" | "keep">; retired?: Array<{ source_id: string; reason: string }> } = {}) =>
  analyzeReplan({
    current: currentPlan(),
    proposal,
    manual: extra.manual ?? noManual,
    restrictions: extra.restrictions ?? [],
    scopes: extra.scopes ?? ALL_SCOPES,
    ...(extra.decisions ? { decisions: extra.decisions } : {}),
    ...(extra.retired ? { retired: extra.retired } : {}),
    startsOn: "2026-11-05",
  });
const find = (analysis: ReturnType<typeof analyzeReplan>, id: string) => analysis.changes.find((change) => change.id === id);
const finalTasks = (analysis: ReturnType<typeof analyzeReplan>) => analysis.final.phases.flatMap((phase) => phase.milestones ?? []).flatMap((milestone) => milestone.tasks ?? []);

test("sin cambios: todo se conserva y no hay nada que decidir", () => {
  const analysis = run(proposalInput());
  assert.deepEqual(analysis.blockers, []);
  assert.equal(analysis.counts.changes.kept, 3);
  assert.deepEqual(analysis.retire, []);
  assert.equal(analysis.counts.final.inherited_completed, 1);
});

test("T05: cambiar la duración deja cada meta en su mes", () => {
  const analysis = run(proposalInput({ months: [["2026-11", 75000], ["2026-12", 46000], ["2027-01", 30000]] }));
  const november = analysis.route.find((month) => month.period === "2026-11");
  assert.equal(november?.final, 75000);
  assert.equal(analysis.route.find((month) => month.period === "2027-01")?.final, 30000);
  assert.equal(analysis.blockers.length, 0);
});

test("T06: mover noviembre a diciembre bloquea hasta decidirlo", () => {
  const moved = proposalInput({ months: [["2026-11", 30000], ["2026-12", 75000]] });
  const blocked = run(moved);
  assert.equal(find(blocked, "month:2026-11")?.kind, "conflict");
  assert.ok(blocked.blockers.some((item) => item.change_id === "month:2026-11"));
  const kept = run(moved, { decisions: { "month:2026-11": "keep", "month:2026-12": "keep" } });
  assert.equal(kept.blockers.length, 0);
  assert.equal(kept.route.find((month) => month.period === "2026-11")?.final, 75000);
  assert.equal(kept.route.find((month) => month.period === "2026-12")?.final, 46000);
  assert.equal(kept.final.goal?.target_date, "2026-11-30");
});

test("T06 con ámbito de objetivos apagado: no se bloquea, se conserva y no se puede aceptar", () => {
  const analysis = run(proposalInput({ months: [["2026-11", 30000], ["2026-12", 75000]] }), { scopes: ["tasks"], decisions: { "month:2026-11": "accept" } });
  assert.equal(analysis.blockers.length, 0);
  assert.equal(find(analysis, "month:2026-11")?.decision, "keep");
  assert.equal(analysis.route.find((month) => month.period === "2026-11")?.final, 75000);
});

test("una cifra distinta sin traslado se conserva salvo que se acepte", () => {
  const proposal = proposalInput({ months: [["2026-11", 70000], ["2026-12", 46000]] });
  assert.equal(run(proposal).route[0]?.final, 75000);
  assert.equal(run(proposal, { decisions: { "month:2026-11": "accept" } }).route[0]?.final, 70000);
});

test("la fecha de la meta sale de su mes, no de los días desde el inicio", () => {
  assert.equal(run(proposalInput()).final.goal?.target_date, "2026-11-30");
  assert.equal(run(proposalInput()).final.goal?.measured_from, "2026-11-01");
});

test("T07: una tarea completada no se puede modificar", () => {
  const analysis = run(proposalInput({ tasks: [proposedTask("Revisar píxel otra vez", { sourceTaskId: "t-done" }), proposedTask("Preparar oferta", { sourceTaskId: "t-open" }), proposedTask("Revisar stock de héroes", { sourceTaskId: "t-other" })] }), { decisions: { "task:t-done": "accept" } });
  const change = find(analysis, "task:t-done");
  assert.equal(change?.locked, true);
  assert.equal(change?.decision, "keep");
  assert.ok(!finalTasks(analysis).some((item) => item.sourceTaskId === "t-done"));
});

test("T08: una decisión manual solo cambia si se acepta", () => {
  const manual = { ...noManual, milestones: { "m-open": ["target_date"] } };
  const proposal = proposalInput({ date: "2026-11-25" });
  const untouched = run(proposal, { manual });
  assert.equal(find(untouched, "milestone:m-open")?.kind, "conflict");
  assert.equal(find(untouched, "milestone:m-open")?.decision, "keep");
  assert.equal(untouched.final.phases[0]?.milestones?.[0]?.targetDate, "2026-11-20");
  const accepted = run(proposal, { manual, decisions: { "milestone:m-open": "accept" } });
  assert.equal(accepted.final.phases[0]?.milestones?.[0]?.targetDate, "2026-11-25");
});

test("una tarea manual que la propuesta omite se conserva", () => {
  const current = currentPlan();
  current.phases[0]!.milestones[1]!.tasks.push(task("t-manual", "Llamar al proveedor", "pending", "2026-11-15", "manual"));
  const analysis = analyzeReplan({ current, proposal: proposalInput(), manual: noManual, restrictions: [], scopes: ALL_SCOPES, startsOn: "2026-11-05" });
  assert.equal(find(analysis, "task:t-manual")?.kind, "conflict");
  assert.ok(finalTasks(analysis).some((item) => item.sourceTaskId === "t-manual"));
  assert.equal(analysis.retire.length, 0);
});

test("T09: una tarea casi igual a otra se marca como duplicado y no entra sola", () => {
  const tasks = [
    proposedTask("Preparar oferta", { sourceTaskId: "t-open" }),
    proposedTask("Revisar stock de héroes", { sourceTaskId: "t-other" }),
    proposedTask("Revisar el stock de los héroes"),
    proposedTask("Revisar píxel"),
  ];
  const analysis = run(proposalInput({ tasks }));
  assert.equal(find(analysis, "new:0.0.2")?.kind, "conflict");
  assert.equal(find(analysis, "new:0.0.3")?.kind, "conflict");
  assert.equal(finalTasks(analysis).length, 2);
});

test("el mismo título sin id continúa la tarea existente en vez de duplicarla", () => {
  const analysis = run(proposalInput({ tasks: [proposedTask("preparar oferta"), proposedTask("Revisar stock de héroes", { sourceTaskId: "t-other" })] }));
  assert.equal(find(analysis, "task:t-open")?.kind, "kept");
  assert.ok(finalTasks(analysis).some((item) => item.sourceTaskId === "t-open"));
});

test("T10: bajar del margen mínimo bloquea hasta autorizarlo", () => {
  const restrictions: Restriction[] = [{ metric_key: "net_margin_pct", label: "Margen neto", target_value: 20, unit: "pct", period: "monthly" }];
  const current = currentPlan();
  current.goal = { ...money, metric_key: "net_margin_pct", unit: "pct", target: 20, monthly_targets: [] };
  const proposal = proposalInput({ metric: "net_margin_pct", target: 15, currency: "EUR" });
  const blocked = analyzeReplan({ current, proposal, manual: noManual, restrictions, scopes: ALL_SCOPES, startsOn: "2026-11-05" });
  assert.ok(blocked.blockers.some((item) => item.change_id === "goal:target"));
  const accepted = analyzeReplan({ current, proposal, manual: noManual, restrictions, scopes: ALL_SCOPES, decisions: { "goal:target": "accept" }, startsOn: "2026-11-05" });
  assert.equal(accepted.blockers.length, 0);
  assert.equal(accepted.final.goal?.target, 15);
});

test("cambiar la métrica de la meta exige decisión; conservarla mantiene la meta vigente", () => {
  const proposal = proposalInput({ metric: "net_margin_pct", target: 25 });
  assert.ok(run(proposal).blockers.some((item) => item.change_id === "goal:metric"));
  const kept = run(proposal, { decisions: { "goal:metric": "keep" } });
  assert.equal(kept.final.goal?.metric_key, "net_sales");
  assert.equal(kept.final.goal?.target, 75000);
});

test("T21: una moneda distinta bloquea y no se convierte sola", () => {
  const analysis = run(proposalInput({ currency: "USD" }));
  assert.ok(analysis.blockers.some((item) => item.code === "currency_mismatch"));
});

test("T22: un mes sin dato real queda vacío, no a cero", () => {
  const analysis = analyzeReplan({ current: currentPlan(), proposal: proposalInput(), manual: noManual, restrictions: [], scopes: ALL_SCOPES, actuals: { "2026-11": 12000 }, startsOn: "2026-11-05" });
  assert.equal(analysis.route.find((month) => month.period === "2026-11")?.actual, 12000);
  assert.equal(analysis.route.find((month) => month.period === "2026-12")?.actual, null);
});

test("una tarea omitida se retira con su motivo, y rechazar la retirada la conserva", () => {
  const tasks = [proposedTask("Preparar oferta", { sourceTaskId: "t-open" })];
  const retired = run(proposalInput({ tasks }), { retired: [{ source_id: "t-other", reason: "Ya no aplica" }] });
  assert.deepEqual(retired.retire, [{ task_id: "t-other", reason: "Ya no aplica" }]);
  const kept = run(proposalInput({ tasks }), { decisions: { "task:t-other": "keep" } });
  assert.deepEqual(kept.retire, []);
  assert.ok(finalTasks(kept).some((item) => item.sourceTaskId === "t-other"));
});

test("toda tarea abierta acaba conservada o retirada", () => {
  const analysis = run({ ...proposalInput(), phases: [{ name: "Nueva", milestones: [{ name: "Hito nuevo", targetDate: "2026-12-10", tasks: [proposedTask("Algo distinto")] }] }] });
  const placed = new Set(finalTasks(analysis).flatMap((item) => (item.sourceTaskId ? [item.sourceTaskId] : [])));
  const retired = new Set(analysis.retire.map((item) => item.task_id));
  for (const id of ["t-open", "t-other"]) assert.ok(placed.has(id) || retired.has(id));
});

test("conservar un hito que la propuesta quita lo devuelve con sus tareas", () => {
  const analysis = run(
    { ...proposalInput(), phases: [{ name: "Nueva", milestones: [{ name: "Hito nuevo", targetDate: "2026-12-10", tasks: [proposedTask("Algo distinto", { dueAt: "2026-12-01" })] }] }] },
    { decisions: { "milestone:m-open": "keep" } },
  );
  const milestones = analysis.final.phases.flatMap((phase) => phase.milestones ?? []);
  assert.deepEqual(milestones.map((item) => item.sourceMilestoneId ?? null), ["m-open", null]);
  assert.equal(milestones[0]?.tasks?.length, 2);
  assert.deepEqual(analysis.retire, []);
});

test("sin el ámbito de fechas, un cambio de fecha se conserva", () => {
  const analysis = run(proposalInput({ date: "2026-11-25" }), { scopes: ["tasks"] });
  assert.equal(find(analysis, "milestone:m-open")?.out_of_scope, true);
  assert.equal(analysis.final.phases[0]?.milestones?.[0]?.targetDate, "2026-11-20");
});

test("una referencia que no existe bloquea", () => {
  const analysis = run(proposalInput({ tasks: [proposedTask("Otra", { sourceTaskId: "inventada" })] }));
  assert.ok(analysis.blockers.some((item) => item.code === "invalid_reference"));
});

test("una propuesta sin meses reales no se puede confirmar", () => {
  const proposal = proposalInput();
  proposal.goal!.monthly_targets = [{ month: 1, target_value: 75000, rationale: "x" }];
  assert.ok(run(proposal).blockers.some((item) => item.code === "proposal_without_periods"));
});

test("las rutinas nuevas cuentan como las tareas que se crearán", () => {
  const analysis = run(proposalInput({ tasks: [proposedTask("Preparar oferta", { sourceTaskId: "t-open" }), proposedTask("Revisar stock de héroes", { sourceTaskId: "t-other" }), proposedTask("Revisar ROAS", { cadence: "semanal", dueAt: "2026-11-06" })] }));
  assert.equal(analysis.counts.final.open_tasks, 5);
});

test("una rutina unificada sigue repitiéndose y no se pierden sus vueltas", () => {
  const analysis = run(proposalInput({ tasks: [proposedTask("Preparar oferta", { sourceTaskId: "t-open", cadence: "semanal", dueAt: "2026-11-06", changeReason: "Pasa a semanal" }), proposedTask("Revisar stock de héroes", { sourceTaskId: "t-other" })] }));
  const routine = finalTasks(analysis).find((item) => item.sourceTaskId === "t-open");
  assert.equal(routine?.cadence, "semanal");
  assert.equal(find(analysis, "task:t-open")?.kind, "modified");
  assert.equal(analysis.counts.final.open_tasks, 3 + 1);
  const tree = buildPlanTree({ name: "x", phases: analysis.final.phases }, () => null, new Set());
  const nodes = tree.phases[0]!.milestones[0]!.tasks;
  assert.equal(nodes.filter((item) => item.source_task_id === "t-open").length, 1, "la primera vuelta es la tarea existente");
  assert.equal(nodes.length, 4);
  assert.equal(nodes.filter((item) => !item.source_task_id).every((item) => "assigned_to" in item), true);
});

test("monthRoute resuelve planes antiguos con su fecha de inicio", () => {
  assert.deepEqual(monthRoute(currentPlan().goal, "2026-10-15").map((month) => month.period), ["2026-10", "2026-11", "2026-12"]);
});

test("una propuesta caduca a los 7 días o al cambiar de mes", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  assert.equal(proposalExpired("2026-11-15T12:00:00Z", now), false);
  assert.equal(proposalExpired("2026-11-05T12:00:00Z", now), true);
  assert.equal(proposalExpired("2026-11-30T12:00:00Z", new Date("2026-12-01T01:00:00Z")), true);
  assert.equal(proposalExpired(null, now), true);
});

test("el modelo no puede colar ids: se descartan con aviso", () => {
  const proposal = {
    plan_name: "x", diagnosis: "x", sources: [], confidence: "low", warnings: [],
    phases: [{ name: "F", description: "d", rationale: "r", evidence: [], milestones: [{
      name: "H", description: "d", target_offset_days: 10, success_metric: "m", rationale: "", source_milestone_id: "no-existe",
      tasks: [{ title: "T", description: "d", target_offset_days: 5, priority: "low", source_task_id: "t-open" }, { title: "T2", description: "d", target_offset_days: 5, priority: "low", source_task_id: "t-open" }],
    }] }],
  };
  const clean = dropUnknownReferences(caminoPlanOutputSchema.parse(proposal), { milestones: new Set(), tasks: new Set(["t-open"]) });
  const milestone = clean.phases[0]!.milestones[0]!;
  assert.equal(milestone.source_milestone_id, null);
  assert.deepEqual(milestone.tasks.map((item) => item.source_task_id), ["t-open", null]);
  assert.equal(clean.warnings.length, 1);
});

test("las fechas se anclan a la generación: aceptar más tarde no las mueve", () => {
  const output = caminoPlanOutputSchema.parse({
    plan_name: "x", diagnosis: "x", sources: [], confidence: "low", warnings: [], horizon_months: 2,
    goal: { ...money, target_offset_days: 30, monthly_targets: [{ month: 1, target_value: 22000, rationale: "a" }, { month: 2, target_value: 75000, rationale: "b" }, { month: 3, target_value: 40000, rationale: "c" }] },
    phases: [{ name: "F", description: "d", rationale: "r", evidence: [], milestones: [{ name: "H", description: "d", target_offset_days: 37, success_metric: "m", rationale: "", tasks: [] }] }],
  }) as CaminoPlanOutput;
  const generated = new Date("2026-10-07T10:00:00Z");
  const anchored = anchorCaminoMonths(output, generated);
  assert.deepEqual(anchored.goal?.monthly_targets?.map((month) => month.period), ["2026-10", "2026-11", "2026-12"]);
  const input = caminoProposalToPlanInput(anchored, generated.getTime());
  assert.equal(input.phases?.[0]?.milestones?.[0]?.targetDate, "2026-11-13");
  assert.equal(input.goal?.target_date, "2026-11-30");
  // Ajustar el plazo reindexa, pero el mes real sigue siendo el de la generación.
  const adjusted = adjustCaminoProposal(anchored, 1, 22000, generated);
  assert.equal(adjusted.goal?.monthly_targets?.[1]?.period, "2026-11");
});
