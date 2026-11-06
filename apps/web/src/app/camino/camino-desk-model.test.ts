import assert from "node:assert/strict";
import test from "node:test";
import { accumulates, byUrgency, closeDate, countableTasks, criteriaList, filterTasks, indicatorGap, indicatorState, lateTaskAdvice, milestoneState, milestoneTitle, monthPace, planTitle, todayIn, type TaskFilter } from "./camino-desk-model";
import { monthToDate, monthlyTargetFor } from "./monthly-route-model";

test("quita la fecha final del nombre del hito y deja las que no son la fecha de cierre", () => {
  assert.equal(milestoneTitle("Black Friday preparado: stock, oferta y campaña listos el 13 de noviembre"), "Black Friday preparado: stock, oferta y campaña listos");
  assert.equal(milestoneTitle("Transición de catálogo tras invierno lista el 9 de abril"), "Transición de catálogo tras invierno lista");
  assert.equal(milestoneTitle("Rebajas de enero preparadas"), "Rebajas de enero preparadas");
  assert.equal(milestoneTitle("Preparar la campaña del 27 de noviembre con stock"), "Preparar la campaña del 27 de noviembre con stock");
});

test("separa la marca del título solo si es breve", () => {
  assert.deepEqual(planTitle("E-NORA Demo: vender sin perder margen"), { title: "Vender sin perder margen", prefix: "E-NORA Demo" });
  assert.deepEqual(planTitle("Campaña de invierno"), { title: "Campaña de invierno", prefix: null });
});

test("separa el criterio en puntos solo por frases, no por comas", () => {
  assert.deepEqual(criteriaList("Stock comprobado; envío preparado. Oferta aprobada."), ["Stock comprobado", "envío preparado", "Oferta aprobada"]);
  assert.deepEqual(criteriaList("Variantes aprobadas, colección accesible y plan revisado."), ["Variantes aprobadas, colección accesible y plan revisado"]);
});

test("ordena por vencimiento, luego por prioridad, y deja al final lo que no tiene fecha", () => {
  const tasks = [
    { id: "sin-fecha", due_at: null, priority: "urgent" },
    { id: "normal", due_at: "2026-11-07T00:00:00Z", priority: "medium" },
    { id: "urgente", due_at: "2026-11-07", priority: "urgent" },
    { id: "vencida", due_at: "2026-11-01", priority: "low" },
  ];
  assert.deepEqual(byUrgency(tasks).map((task) => task.id), ["vencida", "urgente", "normal", "sin-fecha"]);
});

test("toma la meta del mes natural aunque el camino empiece a mitad de mes", () => {
  const targets = [
    { month: 1, target_value: 22000, rationale: "" },
    { month: 2, target_value: 75000, rationale: "" },
    { month: 3, target_value: null, rationale: "" },
  ];
  assert.equal(monthlyTargetFor("2026-10-15", targets, new Date(2026, 10, 4))?.target_value, 75000);
  assert.equal(monthlyTargetFor("2026-10-15", targets, new Date(2026, 11, 4)), null);
  assert.equal(monthlyTargetFor("2026-10-15", targets, new Date(2027, 5, 1)), null);
});

test("suma solo las ventas del mes en curso; sin días del mes no hay dato, no hay cero", () => {
  const daily = [
    { date: "2026-10-31", net_sales: 900 },
    { date: "2026-11-01", net_sales: 100 },
    { date: "2026-11-02", net_sales: 50.5 },
  ];
  assert.equal(monthToDate(daily, new Date(2026, 10, 4)), 150.5);
  assert.equal(monthToDate(daily, new Date(2026, 11, 4)), null);
});

test("el mismo estado de hito para la hoja de ruta y la estructura", () => {
  const today = new Date(2026, 10, 4);
  const hito = { status: "pending", target_date: "2026-11-16", milestone_task_links: [{ tasks: { status: "completed" } }] };
  assert.equal(milestoneState(hito, "active", "active", today), "active");
  assert.equal(milestoneState({ ...hito, milestone_task_links: [] }, "active", "active", today), "next");
  assert.equal(milestoneState(hito, "pending", "active", today), "locked");
  assert.equal(milestoneState({ ...hito, target_date: "2026-11-01" }, "active", "active", today), "late");
  assert.equal(milestoneState(hito, "active", "draft", today), "draft");
});

test("un ratio por debajo no es «en curso», y sin dato no hay veredicto", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const ratio = { metric_key: "net_margin_pct", unit: "pct", direction: "up" as const, source: "shopify", target_value: 20, actual_value: 12.4, progress_pct: 62, status: "en_curso" };
  assert.equal(indicatorState(ratio, now), "below");
  assert.equal(indicatorState({ ...ratio, status: "cumplido", actual_value: 21 }, now), "reached");
  assert.equal(indicatorState({ ...ratio, actual_value: null, status: "sin_datos" }, now), "no_data");
  assert.equal(indicatorState({ ...ratio, measurement: { last_sync_at: "2026-11-01T00:00:00Z" } }, now), "stale");
  assert.ok(Math.abs(indicatorGap(ratio)! + 7.6) < 1e-9);
  assert.equal(accumulates(ratio), false);
});

test("el ritmo solo se juzga en un acumulado de mes natural", () => {
  const now = new Date(2026, 10, 15);
  const base = { metric_key: "orders_count", unit: "count", direction: "up" as const, source: "shopify", target_value: 3000, progress_pct: 50, status: "en_curso", period: "monthly" };
  assert.equal(indicatorState({ ...base, actual_value: 1600, measurement_basis: "calendar" }, now), "on_track");
  assert.equal(indicatorState({ ...base, actual_value: 900, measurement_basis: "calendar" }, now), "at_risk");
  assert.equal(indicatorState({ ...base, actual_value: 1600, measurement_basis: "rolling_30_days" }, now), "below");
});

test("los filtros de tareas no mezclan pendientes con cerradas", () => {
  const today = new Date(2026, 10, 4);
  const tasks = [
    { id: "a", status: "pending", due_at: "2026-11-01", assigned_to: "yo" },
    { id: "b", status: "pending", due_at: "2026-11-09", assigned_to: null },
    { id: "c", status: "completed", due_at: "2026-10-01", assigned_to: "yo" },
    { id: "d", status: "cancelled", due_at: null, assigned_to: null },
  ];
  const ids = (filter: TaskFilter) => filterTasks(tasks, filter, "yo", today).map((task) => task.id);
  assert.deepEqual(ids("open"), ["a", "b"]);
  assert.deepEqual(ids("late"), ["a"]);
  assert.deepEqual(ids("mine"), ["a"]);
  assert.deepEqual(ids("done"), ["c", "d"]);
});

test("un hito va tarde por su fecha límite, no por la objetivo", () => {
  const today = new Date(2026, 10, 18);
  const hito = { status: "pending", target_date: "2026-11-16", deadline_date: "2026-11-20", milestone_task_links: [] };
  assert.equal(closeDate(hito), "2026-11-20");
  assert.equal(milestoneState(hito, "active", "active", today), "next");
  assert.equal(milestoneState({ ...hito, deadline_date: null }, "active", "active", today), "late");
});

test("el día de hoy es el de la tienda", () => {
  const now = new Date("2026-11-05T23:30:00Z");
  assert.equal(todayIn("Europe/Madrid", now).getDate(), 6);
  assert.equal(todayIn("America/New_York", now).getDate(), 5);
  assert.equal(todayIn("zona/rara", now), now);
  assert.equal(todayIn(null, now), now);
});

test("el ritmo del mes extrapola y calla los primeros días", () => {
  const pace = monthPace(10000, 60000, new Date(2026, 10, 10));
  assert.equal(pace?.projected, 30000);
  assert.equal(pace?.pct, 50);
  assert.equal(monthPace(100, 1000, new Date(2026, 10, 2)), null);
  assert.equal(monthPace(100, 0, new Date(2026, 10, 10)), null);
});

test("una tarea vencida se orienta según lo que le queda al hito", () => {
  const today = new Date(2026, 10, 5);
  assert.match(lateTaskAdvice("2026-11-02", "2026-11-16", today), /hace 3 días.*reprográmala/);
  assert.match(lateTaskAdvice("2026-11-04", "2026-11-01", today), /hace 1 día.*mueve el hito/);
});

test("lo descartado no cuenta para el avance", () => {
  const tasks = [{ status: "completed" }, { status: "ignored" }, { status: "cancelled" }, { status: "pending" }];
  assert.deepEqual(countableTasks(tasks).map((task) => task.status), ["completed", "pending"]);
});
