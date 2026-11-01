import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import nodemailer from "nodemailer";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { runScheduledReports, upsertReportSchedule } from "./reports-api.js";

const env = { SUPABASE_URL: "https://audit.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } as LoadedApiEnv;
const context: AuthContext = {
  user: { id: "consultant" },
  profile: { id: "consultant", full_name: null, avatar_url: null, platform_role: "consultant", is_active: true },
  memberships: [{ organization_id: "client", role: "owner", accessSource: "membership", organization: null }],
  subscriptions: [],
};

test("monthly schedules require a store for multi-store clients and persist the selected scope", async (t) => {
  const writes: Array<Record<string, unknown>> = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/shopify_stores")) {
      return Response.json(url.searchParams.has("id") ? [{ id: "store-a" }] : [{ id: "store-a" }, { id: "store-b" }]);
    }
    assert.equal(url.searchParams.get("on_conflict"), "organization_id,template_id,store_id");
    const saved = JSON.parse(String(init?.body));
    writes.push(saved);
    return Response.json({ id: "schedule", ...saved });
  });
  const unscoped = await upsertReportSchedule(env, context, "client", { template_id: "shopify_comercial", recipients: ["audit@example.invalid"] });
  assert.equal(unscoped.ok, false);
  assert.equal(writes.length, 0);
  const scoped = await upsertReportSchedule(env, context, "client", { template_id: "shopify_comercial", store_id: "store-a", recipients: ["audit@example.invalid"] });
  assert.equal(scoped.ok, true);
  assert.equal(writes[0]?.store_id, "store-a");
});

test("a foreign or inactive store cannot be scheduled", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json([]));
  const result = await upsertReportSchedule(env, context, "client", { template_id: "shopify_comercial", store_id: "foreign-store", recipients: ["audit@example.invalid"] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "invalid_store");
});

function deliveryFixture(t: TestContext, pending = false, leased = false) {
  const state: Record<string, any> = { id: "schedule", organization_id: "client", template_id: "shopify_comercial", store_id: "store-a", recipients: ["audit@example.invalid"], last_period_end: null, pending_report_id: pending ? "report" : null, pending_period_end: pending ? "2026-09-30" : null, delivery_attempts: 0 };
  let generated = 0;
  let history: Record<string, any> | null = pending ? { id: "report", title: "Report", period_start: "2026-09-01", period_end: "2026-09-30", file_name: "report.pdf", storage_path: "client/report.pdf" } : null;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.pathname.endsWith("/report_schedules")) {
      if (method === "GET") return Response.json(state.last_period_end && !state.pending_report_id ? [] : [{ ...state }]);
      const patch = JSON.parse(String(init?.body));
      if (patch.delivery_lease_id && leased) return Response.json(null);
      if (patch.delivery_lease_id) assert.equal(url.searchParams.get("last_period_end"), "is.null");
      Object.assign(state, patch);
      return url.searchParams.has("select") ? Response.json({ id: "schedule" }) : new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/copilot_reports")) {
      if (method === "POST") { generated++; history = JSON.parse(String(init?.body)); }
      if (method === "PATCH" && history) Object.assign(history, JSON.parse(String(init?.body)));
      return method === "GET" ? Response.json(history) : new Response(null, { status: 201 });
    }
    if (url.pathname.includes("/storage/v1/object/")) return method === "POST" ? Response.json({ Key: "report.pdf" }) : new Response("%PDF-fixture", { headers: { "Content-Type": "application/pdf" } });
    if (url.pathname.endsWith("/shopify_stores")) return Response.json(url.searchParams.get("select") === "id" ? { id: "store-a" } : [{ id: "store-a", currency_code: "EUR", shop_name: "Audit" }]);
    if (url.pathname.endsWith("/organizations")) return Response.json({ display_name: "Audit", currency_code: "EUR", status: fixtureStatus });
    if (url.pathname.endsWith("/consultant_assignments")) return Response.json(null);
    if (url.pathname.endsWith("/shopify_sales_summary")) return Response.json([{ net_sales: 100, orders_count: 2 }]);
    if (url.pathname.includes("/rpc/")) return Response.json([]);
    throw new Error(`Unexpected test request: ${method} ${url.pathname}`);
  });
  let fixtureStatus = "active";
  return { state, generated: () => generated, suspend: () => { fixtureStatus = "suspended"; } };
}

test("failed delivery retains the PDF and retries it without consuming the month or generating again", async (t) => {
  const fixture = deliveryFixture(t);
  const first = await runScheduledReports(env, new Date("2026-10-02T12:00:00Z"));
  assert.equal(first.failed, 1);
  assert.equal(fixture.state.last_delivery_error, "email_not_configured");
  assert.equal(fixture.state.last_period_end, null);
  assert.ok(fixture.state.pending_report_id);
  assert.equal(fixture.state.delivery_lease_id, null);
  const second = await runScheduledReports(env, new Date("2026-10-03T12:00:00Z"));
  assert.equal(second.due, 1);
  assert.equal(second.failed, 1);
  assert.equal(fixture.generated(), 1);
  assert.equal(fixture.state.delivery_attempts, 2);
});

test("confirmed delivery advances the delivered period and stops subsequent sends", async (t) => {
  const fixture = deliveryFixture(t, true);
  let sent = 0;
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async () => { sent++; return { accepted: ["audit@example.invalid"], rejected: [] }; } }));
  const configured = { ...env, SMTP_USER: "test-only", SMTP_BREVO: "test-only" };
  const first = await runScheduledReports(configured, new Date("2026-10-02T12:00:00Z"));
  assert.equal(first.sent, 1);
  assert.equal(fixture.state.last_period_end, "2026-09-30");
  assert.equal(fixture.state.pending_report_id, null);
  const second = await runScheduledReports(configured, new Date("2026-10-03T12:00:00Z"));
  assert.equal(second.due, 0);
  assert.equal(sent, 1);
  assert.equal(fixture.generated(), 0);
});

test("partial SMTP acceptance retries only recipients not already confirmed", async (t) => {
  const fixture = deliveryFixture(t, true);
  fixture.state.recipients = ["audit@example.invalid", "second@example.invalid"];
  const deliveries: string[][] = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message: { to: string[] }) => {
    deliveries.push(message.to);
    return deliveries.length === 1 ? { accepted: ["audit@example.invalid"], rejected: ["second@example.invalid"] } : { accepted: message.to, rejected: [] };
  } }));
  const configured = { ...env, SMTP_USER: "test-only", SMTP_BREVO: "test-only" };
  const first = await runScheduledReports(configured, new Date("2026-10-02T12:00:00Z"));
  assert.equal(first.failed, 1);
  assert.equal(fixture.state.last_period_end, null);
  const second = await runScheduledReports(configured, new Date("2026-10-03T12:00:00Z"));
  assert.equal(second.sent, 1);
  assert.deepEqual(deliveries, [["audit@example.invalid", "second@example.invalid"], ["second@example.invalid"]]);
});

test("an existing delivery lease prevents a second worker from generating or sending", async (t) => {
  const fixture = deliveryFixture(t, false, true);
  const result = await runScheduledReports(env, new Date("2026-10-02T12:00:00Z"));
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.equal(fixture.generated(), 0);
  assert.equal(fixture.state.delivery_attempts, 0);
});

test("suspended clients retain pending reports without sending them", async (t) => {
  const fixture = deliveryFixture(t, true);
  fixture.suspend();
  const result = await runScheduledReports(env, new Date("2026-10-02T12:00:00Z"));
  assert.equal(result.failed, 1);
  assert.equal(fixture.state.last_delivery_error, "report_organization_inactive");
  assert.equal(fixture.state.last_period_end, null);
  assert.equal(fixture.generated(), 0);
});
