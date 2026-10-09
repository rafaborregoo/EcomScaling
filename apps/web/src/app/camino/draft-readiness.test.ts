import assert from "node:assert/strict";
import test from "node:test";
import { draftReadiness, type ReadinessPhase } from "./draft-readiness";

const phase = (...milestones: Array<[string | null, number]>): ReadinessPhase => ({
  strategic_plan_milestones: milestones.map(([target_date, tasks]) => ({
    target_date,
    milestone_task_links: Array.from({ length: tasks }, () => ({ tasks: {} })),
  })),
});

test("cuenta fases, hitos, tareas y lo que falta", () => {
  const result = draftReadiness(
    [phase(["2026-10-20", 2], [null, 0]), phase(["2026-11-03", 1])],
    { target: 16 },
  );
  assert.deepEqual(result, {
    phases: 2,
    milestones: 3,
    tasks: 3,
    undated: 1,
    withoutTasks: 1,
    hasGoalTarget: true,
  });
});

test("un enlace sin tarea visible no cuenta y una meta sin cifra se avisa", () => {
  const hidden: ReadinessPhase = {
    strategic_plan_milestones: [{ target_date: "2026-10-20", milestone_task_links: [{ tasks: null }] }],
  };
  const result = draftReadiness([hidden], { target: null });
  assert.equal(result.tasks, 0);
  assert.equal(result.withoutTasks, 1);
  assert.equal(result.hasGoalTarget, false);
});
