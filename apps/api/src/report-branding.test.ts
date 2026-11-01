import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { isReportAccentColor, isReportLogo, reportLogoStoragePath } from "./report-branding.js";
import { consultoraBrandFor } from "./report-generate.js";
import { renderReportPdf } from "./report-pdf.js";
import { buildSampleReportDocument } from "./report-data.js";
import type { AuthContext } from "./auth-context.js";
import type { LoadedApiEnv } from "@e-nora/config";
import { setConsultoraBrand } from "./consultora-settings.js";

const env = { SUPABASE_URL: "https://audit.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } as LoadedApiEnv;
const owner: AuthContext = { user: { id: "consultant" }, profile: { id: "consultant", full_name: null, avatar_url: null, platform_role: "consultant", is_active: true }, memberships: [{ organization_id: "consultora", role: "owner", accessSource: "consulting_organization", organization: null }], subscriptions: [] };

test("report accents must be dark hexadecimal colors with readable contrast", () => {
  assert.equal(isReportAccentColor("#14532D"), true);
  assert.equal(isReportAccentColor("#1D4ED8"), true);
  for (const value of ["#FFFFFF", "#FFFF00", "red", "url(https://example.invalid)", null]) assert.equal(isReportAccentColor(value), false);
});

test("only the consultora owner can save a readable report accent", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { assert.fail("Rejected settings must not reach the database"); });
  const invalid = await setConsultoraBrand(env, owner, { brand_accent_color: "#FFFFFF" });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error, "invalid_brand_color");
  const manager = { ...owner, memberships: owner.memberships.map((item) => ({ ...item, role: "manager" })) };
  const denied = await setConsultoraBrand(env, manager, { brand_accent_color: "#14532D" });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, "consultora_brand_denied");
});

test("the report accent is persisted and returned by brand settings", async (t) => {
  let saved: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") { saved = JSON.parse(String(init.body)); return new Response(null, { status: 204 }); }
    return new URL(String(input)).pathname.endsWith("/organizations") ? Response.json(saved) : new Response(null, { status: 201 });
  });
  const result = await setConsultoraBrand(env, owner, { brand_accent_color: "#14532d" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.brand_accent_color, "#14532D");
});

test("logos resolve to a public uploaded Storage key without fetching arbitrary URLs", () => {
  assert.equal(reportLogoStoragePath("https://project.supabase.co/storage/v1/object/public/avatars/user-1/marca-logo-1.png"), "user-1/marca-logo-1.png");
  for (const value of ["http://127.0.0.1/private.png", "https://example.invalid/logo.png", "https://project.supabase.co/storage/v1/object/public/avatars/user-1/%2e%2e/private.png", "https://project.supabase.co/storage/v1/object/public/avatars/user-1/marca-logo.svg"]) assert.equal(reportLogoStoragePath(value), null);
  assert.equal(isReportLogo(Buffer.alloc(2 * 1024 * 1024 + 1)), false);
  const hugePng = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(hugePng);
  hugePng.writeUInt32BE(100_000, 16); hugePng.writeUInt32BE(100_000, 20);
  assert.equal(isReportLogo(hugePng), false);
});

test("own stores and portfolio reports resolve their consultora's configured brand", async (t) => {
  const row = { kind: "consulting", brand_name: "Demo Consultora", brand_reply_to: "demo@example.invalid", brand_accent_color: "#14532D", brand_logo_url: null };
  let own = false;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/consultant_assignments")) return Response.json(null);
    if (url.pathname.endsWith("/organization_members")) return Response.json([{ organizations: row }]);
    return Response.json(own ? { kind: "client", created_by: "consultant" } : row);
  });
  const db = createClient("https://audit.invalid", "test-only");
  assert.equal((await consultoraBrandFor(db, "consultora")).name, "Demo Consultora");
  own = true;
  assert.equal((await consultoraBrandFor(db, "own-store")).accentColor, "#14532D");
});

test("concurrent PDF renders keep their branding isolated and tolerate a damaged logo", async () => {
  const report = { ...buildSampleReportDocument("shopify_comercial"), preparedBy: "Demo Consultora" };
  const [green, blue] = await Promise.all([
    renderReportPdf(report, { accentColor: "#14532D", logo: Buffer.from("not-an-image") }),
    renderReportPdf(report, { accentColor: "#1D4ED8" }),
  ]);
  assert.equal(green.subarray(0, 4).toString(), "%PDF");
  assert.equal(blue.subarray(0, 4).toString(), "%PDF");
  assert.ok(green.length > 10_000);
  const content = (pdf: Buffer) => [...pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) => { try { return inflateSync(Buffer.from(match[1]!, "latin1")).toString("latin1"); } catch { return ""; } }).join("\n");
  const greenColor = "0.0784313725490196 0.3254901960784314 0.17647058823529413 scn";
  assert.ok(content(green).includes(greenColor));
  assert.equal(content(blue).includes(greenColor), false);
});
