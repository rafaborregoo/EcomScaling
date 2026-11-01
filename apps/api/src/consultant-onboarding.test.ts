import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClientOnboarding } from "./consultant-onboarding.js";

const base = { organizationId: "client", connections: [], hasFinancialSettings: false, reviewedAt: null, tasks: [], sources: { connections: "ok", financial: "ok", reviews: "ok", tasks: "ok" }, nowMs: Date.parse("2026-10-26T12:00:00Z") };

test("linked client starts with a real next step and scoped destinations", () => {
  const model = buildClientOnboarding(base);
  assert.equal(model.completed, 1);
  assert.equal(model.next, "connected");
  for (const step of model.steps) assert.match(step.href, /organizationId=client/);
});

test("unknown sources cannot mark onboarding steps completed", () => {
  const model = buildClientOnboarding({ ...base, hasFinancialSettings: true, reviewedAt: "2026-10-26", sources: { ...base.sources, financial: "error" } });
  assert.equal(model.steps[2]?.status, "unknown");
  assert.equal(model.completed, 1);
});

test("onboarding requires fresh Shopify data, review, settings, assignee and due date", () => {
  const model = buildClientOnboarding({ ...base, connections: [{ provider: "shopify", status: "connected", last_sync_at: "2026-10-26T11:00:00Z" }], hasFinancialSettings: true, reviewedAt: "2026-10-26", tasks: [{ assigned_to: "consultant", due_at: "2026-10-27" }] });
  assert.equal(model.completed, 4);
  assert.equal(model.next, null);
  const stale = buildClientOnboarding({ ...base, connections: [{ provider: "shopify", status: "connected", last_sync_at: "2026-10-20T11:00:00Z" }], tasks: [{ assigned_to: "consultant", due_at: null }] });
  assert.equal(stale.steps[1]?.status, "pending");
  assert.equal(stale.steps[3]?.status, "pending");
});
