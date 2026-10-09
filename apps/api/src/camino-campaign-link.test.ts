import assert from "node:assert/strict";
import { test } from "node:test";
import { pickMilestoneForDate } from "./camino-campaign-link.js";

const milestones = [
  { id: "bases", target_date: "2026-10-16" },
  { id: "bf", target_date: "2026-11-20" },
  { id: "navidad", target_date: "2026-12-15" },
];

test("la campaña cuelga del primer hito que cierra en su fecha o después", () => {
  assert.equal(pickMilestoneForDate(milestones, "2026-10-10"), "bases");
  assert.equal(pickMilestoneForDate(milestones, "2026-11-20"), "bf");
  assert.equal(pickMilestoneForDate(milestones, "2026-11-27"), "navidad");
});

test("tras el ultimo hito va al ultimo; sin fechas, al primero; sin hitos, a ninguno", () => {
  assert.equal(pickMilestoneForDate(milestones, "2027-02-01"), "navidad");
  assert.equal(pickMilestoneForDate([{ id: "a", target_date: null }, { id: "b", target_date: null }], "2026-11-01"), "a");
  assert.equal(pickMilestoneForDate([], "2026-11-01"), null);
});
