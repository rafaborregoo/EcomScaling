import test from "node:test";
import assert from "node:assert/strict";
import {
  readWeeklyMailingClientState,
  isWeeklyMailingGenerationLeaseExpired,
  sameWeeklyMailingPlanRequest,
  weeklyMailingDraftsAreComplete,
} from "./marketing-mailing-sequence.js";

const sequenceId = "550e8400-e29b-41d4-a716-446655440000";

test("client state accepts bounded planner fields and rejects unexpected or oversized data", () => {
  assert.ok(readWeeklyMailingClientState({
    campaign_name: "Semana de lanzamiento",
    selected_days: [1, 3, 5],
    selected_template_ids: ["550e8400-e29b-41d4-a716-446655440001"],
    selected_image_urls: ["https://cdn.example/image.png"],
  }));
  assert.equal(readWeeklyMailingClientState({ unexpected: "secret" }), null);
  assert.equal(readWeeklyMailingClientState({ instructions: "x".repeat(4_001) }), null);
  assert.equal(readWeeklyMailingClientState({ selected_days: [8] }), null);
});

test("sequence request idempotency rejects a reused sequence ID with changed dates or campaign", () => {
  const saved = {
    campaign_name: "Lanzamiento",
    objective: "conversion",
    audience: "Clientes activos",
    offer: "",
    instructions: "",
    store_connection_id: null,
    scheduled_dates: ["2026-10-01", "2026-10-03"],
    selected_template: { id: "template-1" },
  };
  assert.equal(sameWeeklyMailingPlanRequest(saved, { ...saved }), true);
  assert.equal(sameWeeklyMailingPlanRequest(saved, { ...saved, campaign_name: "Otra" }), false);
  assert.equal(sameWeeklyMailingPlanRequest(saved, { ...saved, scheduled_dates: ["2026-10-02"] }), false);
  assert.equal(sameWeeklyMailingPlanRequest(saved, { ...saved, selected_template: null }), false);
});

test("generation lease prevents concurrent providers but permits recovery after timeout", () => {
  const now = Date.parse("2026-09-28T12:00:00.000Z");
  assert.equal(isWeeklyMailingGenerationLeaseExpired("2026-09-28T11:50:00.000Z", now), false);
  assert.equal(isWeeklyMailingGenerationLeaseExpired("2026-09-28T11:44:59.000Z", now), true);
  assert.equal(isWeeklyMailingGenerationLeaseExpired("not-a-date", now), true);
});

test("sequence completes only when every planned email has a scheduled idempotent draft", () => {
  const expected = [1, 2, 3];
  const complete = expected.map((number) => ({
    idempotency_key: `${sequenceId}:${number}`,
    scheduled_for: `2026-10-0${number}T09:00:00.000Z`,
  }));
  assert.equal(weeklyMailingDraftsAreComplete(sequenceId, expected, complete), true);
  assert.equal(weeklyMailingDraftsAreComplete(sequenceId, expected, complete.slice(0, 2)), false);
  const third = complete[2]!;
  assert.equal(weeklyMailingDraftsAreComplete(sequenceId, expected, [
    ...complete.slice(0, 2), { ...third, scheduled_for: null },
  ]), false);
  assert.equal(weeklyMailingDraftsAreComplete(sequenceId, expected, [
    ...complete.slice(0, 2), { ...third, idempotency_key: `${sequenceId}:4` },
  ]), false);
});
