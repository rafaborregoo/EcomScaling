import test from "node:test";
import assert from "node:assert/strict";
import {
  getInternalMailingPlaybookEntry,
  listInternalMailingPlaybook,
  previewInternalMailingPlaybook,
  saveInternalMailingPlaybookDraft,
  setInternalMailingPlaybookStatus,
} from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const env = {} as never;

test("invalid internal template slots fail before database access", async () => {
  const result = await saveInternalMailingPlaybookDraft(env, context("platform_admin"), {
    kind: "example", title: "Demo", objective: "Demo editable", audience_tags: [], lifecycle_tags: [],
    content: { raw_html: "<p>{{undeclared}}</p>", template: { version: 1, key: "safe-demo", description: "Example", variables: [{ key: "headline", label: "Titular", kind: "text", example: "Texto" }] } },
    evidence: {}, source: { type: "internal", rights_confirmed: true },
  });
  assert.ok(!result.ok); if (!result.ok) assert.equal(result.error, "invalid_mailing_template");
});
const serviceEnv = {
  SUPABASE_URL: "https://playbook-test.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
} as never;
const context = (platformRole: string): AuthContext => ({
  user: { id: "user-1" },
  profile: {
    id: "user-1",
    full_name: null,
    avatar_url: null,
    platform_role: platformRole,
    is_active: true,
  },
  memberships: [],
  subscriptions: [],
});

const admin = context("platform_admin");
const entryId = "00000000-0000-4000-8000-000000000001";
const entryKey = "00000000-0000-4000-8000-000000000002";
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Content-Range": "0-0/*" },
});

async function withRestMock<T>(handler: (url: URL, init?: RequestInit) => Response, run: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    return handler(url, init);
  }) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("cada operación API del playbook deniega cliente/consultor antes de tocar la DB", async () => {
  for (const role of ["client", "consultant", "platform_support", null]) {
    const unauthorized = context(role ?? "");
    const results = await Promise.all([
      listInternalMailingPlaybook(env, unauthorized),
      previewInternalMailingPlaybook(env, unauthorized, { objective: "welcome" }),
      getInternalMailingPlaybookEntry(env, unauthorized, "not-a-uuid"),
      saveInternalMailingPlaybookDraft(env, unauthorized, {}),
      setInternalMailingPlaybookStatus(env, unauthorized, "not-a-uuid", "published"),
    ]);

    for (const result of results) {
      assert.deepEqual(result, {
        ok: false,
        statusCode: 403,
        error: "platform_admin_required",
      });
    }
  }
});

test("el preview admin consulta solo estrategias publicadas y devuelve una explicación sin HTML de origen", async () => {
  const queryUrls: URL[] = [];
  const result = await withRestMock((url) => {
    queryUrls.push(url);
    return jsonResponse([{
      id: entryId, entry_key: entryKey, version: 1, kind: "strategy", title: "Welcome series",
      objective: "welcome new customers", audience_tags: ["new customers"], lifecycle_tags: ["welcome"],
      status: "published", created_at: "2026-09-27T00:00:00Z", updated_at: "2026-09-27T00:00:00Z",
      source_type: "authorized_import", rights_confirmed: true,
      when_to_use: "After first purchase", when_not_to_use: null, sequence_arc: "Teach then invite",
      visual_direction: "Modular editorial blocks", persuasion_principles: ["Lead with value"],
      cta_guidance: "One clear action", risks: ["Avoid excessive frequency"],
    }]);
  }, () => previewInternalMailingPlaybook(serviceEnv, admin, { objective: "welcome new customers", audience: "new customers" }));

  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.data.matched_count, 1);
  assert.equal(result.data.selected[0]?.title, "Welcome series");
  assert.equal(result.data.selected[0]?.planner_context.sequence_arc, "Teach then invite");
  const queryUrl = queryUrls[0];
  assert.ok(queryUrl);
  assert.equal(queryUrl.searchParams.get("status"), "eq.published");
  assert.equal(queryUrl.searchParams.get("kind"), "eq.strategy");
  assert.equal(queryUrl.searchParams.get("limit"), "100");
  const projection = queryUrl.searchParams.get("select") ?? "";
  assert.ok(projection.includes("source_type:source->>type"));
  assert.ok(projection.includes("rights_confirmed:source->rights_confirmed"));
  assert.equal(projection.includes("raw_html"), false);
});

test("version creation checks the current parent and writes audit", async () => {
  const requests: Array<{ path: string; method: string; select?: string | null | undefined; body?: Record<string, unknown> | undefined }> = [];
  const result = await withRestMock((url, init) => {
    const path = url.pathname.split("/").pop() ?? "";
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    requests.push({ path, method, select: url.searchParams.get("select"), body });
    if (path === "internal_mailing_playbook_entries" && method === "GET") {
      if (url.searchParams.get("select") === "id,entry_key,version,status") {
        return jsonResponse([{ id: entryId, entry_key: entryKey, version: 3, status: "published" }]);
      }
      if (url.searchParams.get("select") === "id,version") return jsonResponse([{ id: entryId, version: 3 }]);
    }
    if (path === "internal_mailing_playbook_entries" && method === "POST") {
      return jsonResponse({ ...body, id: "00000000-0000-4000-8000-000000000003", created_at: "2026-09-27T00:00:00Z", updated_at: "2026-09-27T00:00:00Z" });
    }
    if (path === "audit_logs" && method === "POST") return jsonResponse([], 201);
    return jsonResponse({ message: `Unexpected request ${method} ${path}` }, 500);
  }, () => saveInternalMailingPlaybookDraft(serviceEnv, admin, {
    kind: "strategy",
    title: "Onboarding with value proof",
    objective: "welcome new customers",
    audience_tags: ["new customers"],
    lifecycle_tags: ["welcome"],
    content: { when_to_use: "After first purchase" },
    evidence: {},
    source: { type: "internal" },
  }, entryId));

  assert.equal(result.ok, true, JSON.stringify({ result, requests }));
  if (!result.ok) return;
  assert.equal(result.data.entry_key, entryKey);
  assert.equal(result.data.version, 4);
  assert.equal(result.data.supersedes, entryId);
  assert.equal(result.data.status, "draft");
  assert.ok(requests.some((request) => request.path === "audit_logs" && request.method === "POST"));
});

test("rejects a stale parent version without inserting a new record", async () => {
  const requests: Array<{ method: string; path: string; select?: string | null | undefined }> = [];
  const result = await withRestMock((url, init) => {
    const path = url.pathname.split("/").pop() ?? "";
    const method = init?.method ?? "GET";
    const select = url.searchParams.get("select");
    requests.push({ method, path, select });
    if (path === "internal_mailing_playbook_entries" && method === "GET") {
      if (select === "id,entry_key,version,status") return jsonResponse([{ id: entryId, entry_key: entryKey, version: 3, status: "published" }]);
      if (select === "id,version") return jsonResponse([{ id: "00000000-0000-4000-8000-000000000004", version: 4 }]);
    }
    return jsonResponse({ message: `Unexpected request ${method} ${path}` }, 500);
  }, () => saveInternalMailingPlaybookDraft(serviceEnv, admin, {
    kind: "strategy", title: "Current principle", objective: "welcome customers",
    audience_tags: [], lifecycle_tags: [], content: {}, evidence: {}, source: { type: "internal" },
  }, entryId));

  assert.deepEqual(result, { ok: false, statusCode: 409, error: "mailing_playbook_stale_version" });
  assert.equal(requests.some((request) => request.method === "POST"), false);
});

test("publishing an imported reference requires rights confirmation and is audited", async () => {
  const requests: Array<{ method: string; path: string; body?: Record<string, unknown> | undefined }> = [];
  let rightsConfirmed = false;
  const result = await withRestMock((url, init) => {
    const path = url.pathname.split("/").pop() ?? "";
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    requests.push({ method, path, body });
    if (path === "internal_mailing_playbook_entries" && method === "GET") {
      return jsonResponse([{
        id: entryId,
        entry_key: entryKey,
        version: 1,
        status: "draft",
        source: { type: "authorized_import", rights_confirmed: rightsConfirmed },
        content: { raw_html: "<p>authorized pattern</p>" },
      }]);
    }
    if (path === "internal_mailing_playbook_entries" && method === "PATCH") {
      return jsonResponse([{ id: entryId, entry_key: entryKey, version: 1, status: "published", updated_at: "2026-09-27T00:00:00Z" }]);
    }
    if (path === "audit_logs" && method === "POST") return jsonResponse([], 201);
    return jsonResponse({ message: `Unexpected request ${method} ${path}` }, 500);
  }, async () => {
    const denied = await setInternalMailingPlaybookStatus(serviceEnv, admin, entryId, "published");
    rightsConfirmed = true;
    const allowed = await setInternalMailingPlaybookStatus(serviceEnv, admin, entryId, "published");
    return { denied, allowed };
  });

  assert.deepEqual(result.denied, {
    ok: false,
    statusCode: 400,
    error: "mailing_playbook_rights_confirmation_required",
  });
  assert.equal(result.allowed.ok, true);
  assert.equal(requests.filter((request) => request.path === "internal_mailing_playbook_entries" && request.method === "PATCH").length, 1);
  assert.equal(requests.find((request) => request.path === "audit_logs")?.body?.action, "marketing.internal_playbook.published");
});
