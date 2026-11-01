import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSULTANT_TASK_PRESETS, consultantTaskPreset } from "./consultant-task-presets";

test("three editable consultant procedures contain steps, due date and a closing criterion", () => {
  assert.equal(CONSULTANT_TASK_PRESETS.length, 3);
  for (const preset of CONSULTANT_TASK_PRESETS) {
    const task = consultantTaskPreset(preset.id, new Date(2026, 9, 30, 12));
    assert.ok(task);
    assert.match(task.description, /1\. .*\n2\. .*\n3\. /);
    assert.match(task.description, /Criterio de cierre:/);
    assert.match(task.dueAt, /^2026-11-/);
  }
  assert.equal(consultantTaskPreset("free"), null);
});
