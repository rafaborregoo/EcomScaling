import test from "node:test";
import assert from "node:assert/strict";
import {
  readWeeklyMailingClientState,
  isWeeklyMailingGenerationLeaseExpired,
  sameWeeklyMailingPlanRequest,
  weeklyMailingDraftsAreComplete,
  readWeeklyMailingDates,
  resolveWeeklyMailingSchedule,
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
    status: "pending_approval",
    request: { store_id: "store-connection" },
  }));
  const check = (drafts: typeof complete) => weeklyMailingDraftsAreComplete(sequenceId, expected, drafts,
    complete.map((item) => item.scheduled_for), "store-connection");
  assert.equal(check(complete), true);
  assert.equal(check(complete.slice(0, 2)), false);
  const third = complete[2]!;
  assert.equal(weeklyMailingDraftsAreComplete(sequenceId, expected, [
    ...complete.slice(0, 2), { ...third, scheduled_for: null },
  ], complete.map((item) => item.scheduled_for), "store-connection"), false);
  assert.equal(check([
    ...complete.slice(0, 2), { ...third, idempotency_key: `${sequenceId}:4` },
  ]), false);
  assert.equal(check([{ ...complete[0]!, status: "rejected" }, ...complete.slice(1)]), false);
  assert.equal(check([{ ...complete[0]!, scheduled_for: "1900-01-01T00:00:00Z" }, ...complete.slice(1)]), false);
  assert.equal(check([{ ...complete[0]!, request: { store_id: "another-store" } }, ...complete.slice(1)]), false);
});

test("dates reject impossible, duplicate and excessive dates; store timezone controls UTC instants", () => {
  assert.equal(readWeeklyMailingDates(["2026-02-31"]), null);
  assert.equal(readWeeklyMailingDates(["2026-10-22", "2026-10-22"]), null);
  assert.equal(readWeeklyMailingDates(Array(8).fill("2026-10-22")), null);
  assert.deepEqual(readWeeklyMailingDates(["2028-02-29"]), ["2028-02-29"]);
  const now = Date.parse("2026-10-01T00:00:00Z");
  assert.deepEqual(resolveWeeklyMailingSchedule(["2026-10-24", "2026-10-26"], "Europe/Madrid", now),
    ["2026-10-24T07:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
  assert.throws(() => resolveWeeklyMailingSchedule(["2000-01-01"], "Europe/Madrid", now), /in_past/);
});

test("idempotency includes effective design, resources, images and literal copy", () => {
  const saved = { selected_template: { id: "template", design: { blocks: [1], colors: { a: "red", b: "blue" } } },
    production: { image_urls: ["https://example/image"], verbatim_texts: ["Gratis"] } };
  assert.equal(sameWeeklyMailingPlanRequest(saved, structuredClone(saved)), true);
  assert.equal(sameWeeklyMailingPlanRequest(saved, { ...saved, selected_template: { id: "template", design: { blocks: [2] } } }), false);
  assert.equal(sameWeeklyMailingPlanRequest(saved, { ...saved, production: { ...saved.production, verbatim_texts: ["Descuento"] } }), false);
});
