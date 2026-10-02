import assert from "node:assert/strict";
import test from "node:test";
import { buildCaminoRoute } from "./camino-routes.js";

const HOY = "2026-09-29";
const phase = (id: string, position: number, status: string) => ({ id, plan_id: "p", name: `Fase ${id}`, status, position });
const ms = (id: string, phase_id: string, position: number, status: string, target_date: string | null = null) => ({ id, phase_id, name: id, status, position, target_date });

test("la ruta marca hechos, el hito en curso, los pendientes y las fases bloqueadas", () => {
  const route = buildCaminoRoute(
    [phase("b", 2, "active"), phase("a", 1, "completed"), phase("c", 3, "locked")],
    [ms("a1", "a", 1, "completed"), ms("b1", "b", 1, "completed"), ms("b2", "b", 2, "in_progress", "2026-10-18"), ms("b3", "b", 3, "pending", "2026-11-08"), ms("c1", "c", 1, "locked")],
    HOY,
  );
  assert.deepEqual(route.phases.map((p) => p.stops), [["done"], ["done", "current", "pending"], ["locked"]]);
  assert.deepEqual(route.focus, { code: "2.2", name: "b2", target_date: "2026-10-18", days: 19 });
  assert.equal(route.late_milestones, 0);
  assert.equal(route.milestones_done, 2);
  assert.equal(route.milestones_total, 5);
});

test("un hito abierto con la fecha pasada va tarde, sea o no el que está en curso", () => {
  const route = buildCaminoRoute(
    [phase("a", 1, "active")],
    [ms("a1", "a", 1, "pending", "2026-09-23"), ms("a2", "a", 2, "pending", "2026-09-01")],
    HOY,
  );
  assert.deepEqual(route.phases[0]?.stops, ["late", "late"]);
  assert.equal(route.focus?.days, -6);
  assert.equal(route.late_milestones, 2);
});

test("sin fase activa no hay hito en curso", () => {
  const route = buildCaminoRoute([phase("a", 1, "pending")], [ms("a1", "a", 1, "pending")], HOY);
  assert.equal(route.focus, null);
  assert.deepEqual(route.phases[0]?.stops, ["locked"]);
});
