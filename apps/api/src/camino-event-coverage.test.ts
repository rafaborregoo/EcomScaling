import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaminoPlanOutput } from "@e-nora/ai";
import { commercialCalendar } from "./commercial-calendar.js";
import { insertEventMilestones, keyEvents, uncoveredEvents } from "./camino-event-coverage.js";

const milestone = (name: string, day: number) => ({ name, description: "", target_offset_days: day, success_metric: "", rationale: "", tasks: [] as never[] });
const plan = {
  plan_name: "x", horizon_months: 3, diagnosis: "", goal: null, sources: [], confidence: "medium", warnings: [],
  phases: [
    { name: "Puesta a punto", description: "", rationale: "", evidence: [], milestones: [milestone("Bases", 10)] },
    { name: "Temporada de nieve", description: "", rationale: "", evidence: [], milestones: [milestone("Stock completo", 40), milestone("Campaña de apertura", 60)] },
  ],
} as unknown as CaminoPlanOutput;

test("detecta las fechas clave que el plan no nombra", () => {
  const events = commercialCalendar(new Date("2026-10-06T00:00:00Z"), 92, "tienda de nieve");
  const missing = uncoveredEvents(plan, events).map((event) => event.key);
  assert.ok(missing.includes("black_friday"));
  assert.ok(missing.includes("navidad"));
  assert.ok(missing.includes("reyes"));
  assert.equal(missing.includes("temporada_nieve"), false);
  assert.equal(keyEvents(events).some((event) => event.key === "halloween"), false);
});

test("inserta los hitos de preparacion en la fase que cubre su fecha y los ordena", () => {
  const result = insertEventMilestones(plan, [milestone("Black Friday preparado", 52), milestone("Navidad lista", 5)], 92);
  assert.deepEqual(result.phases[0]!.milestones.map((m) => m.name), ["Navidad lista", "Bases"]);
  assert.deepEqual(result.phases[1]!.milestones.map((m) => m.name), ["Stock completo", "Black Friday preparado", "Campaña de apertura"]);
  const covered = uncoveredEvents(result, commercialCalendar(new Date("2026-10-06T00:00:00Z"), 92, "tienda de nieve")).map((event) => event.key);
  assert.equal(covered.includes("black_friday"), false);
  assert.equal(covered.includes("navidad"), false);
});
