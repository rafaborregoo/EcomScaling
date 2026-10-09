import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaminoPlanOutput } from "@e-nora/ai";
import { keepsDraftCommitments, detailTargets, mergeDetailedTasks, type CaminoTask } from "./camino-task-detailer.js";

const task = (title: string, day: number): CaminoTask => ({
  title,
  description: "1. Paso",
  target_offset_days: day,
  priority: "high",
  owner: "client",
  kind: "email",
  track: "puesta_a_punto",
  cadence: "una_vez",
  effort_hours: 2,
  definition_of_done: "Hecho",
  evidence: [],
});

const plan = {
  plan_name: "Temporada",
  horizon_months: 3,
  diagnosis: "",
  goal: null,
  phases: [
    { name: "Puesta a punto", description: "", rationale: "", evidence: [], milestones: [{ name: "Bases", description: "", target_offset_days: 10, success_metric: "", rationale: "", tasks: [task("borrador", 5)] }] },
    { name: "Black Friday", description: "", rationale: "", evidence: [], milestones: [{ name: "BF listo", description: "", target_offset_days: 40, success_metric: "", rationale: "", tasks: [task("borrador BF", 30)] }] },
  ],
  sources: [],
  confidence: "medium",
  warnings: [],
} as unknown as CaminoPlanOutput;

test("recorre cada hito con una clave estable", () => {
  assert.deepEqual(detailTargets(plan).map((target) => target.key), ["0.0", "1.0"]);
});

test("sustituye las tareas detalladas, las ajusta al hito y conserva el borrador donde falla", () => {
  const results = new Map<string, CaminoTask[] | null>([
    ["0.0", null],
    ["1.0", [task("oferta", 90), task("stock", 0), ...Array.from({ length: 8 }, (_, i) => task(`extra ${i}`, 20))]],
  ]);
  const { proposal, detailed } = mergeDetailedTasks(plan, results);
  assert.equal(detailed, 1);
  assert.equal(proposal.phases[0]!.milestones[0]!.tasks[0]!.title, "borrador");
  const bf = proposal.phases[1]!.milestones[0]!.tasks;
  assert.equal(bf.length, 10);
  assert.equal(bf[0]!.target_offset_days, 40);
  assert.equal(bf[1]!.target_offset_days, 1);
});

test("el detallador no puede perder tareas de crecimiento ni rutinas del borrador", () => {
  const routine = { ...task("revisar ROAS", 5), track: "crecimiento" as const, cadence: "semanal" as const };
  const prep = { ...task("preparar stock", 5), track: "temporada" as const };
  assert.equal(keepsDraftCommitments([routine, prep], [{ ...routine, title: "Revisar ROAS paso a paso" }, prep, task("extra", 3)]), true);
  assert.equal(keepsDraftCommitments([routine, prep], [prep, task("extra", 3)]), false);
  assert.equal(keepsDraftCommitments([routine], [{ ...routine, cadence: "una_vez" as const }]), false);
  // funde pasos de puesta a punto: permitido
  assert.equal(keepsDraftCommitments([task("a", 1), task("b", 2)], [task("a+b", 1)]), true);
});
