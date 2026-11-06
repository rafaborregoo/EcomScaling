import assert from "node:assert/strict";
import test from "node:test";
import {
  createKnowledgeDocument,
  getKnowledgeDocument,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
} from "./knowledge.js";
import type { AuthContext } from "./auth-context.js";

const org = "10000000-0000-4000-8000-000000000001",
  store = "20000000-0000-4000-8000-000000000001",
  id = "30000000-0000-4000-8000-000000000001";
const checksum = "a".repeat(64);
const env = {
  SUPABASE_URL: "https://imp04.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-key",
  VOYAGE_API_KEY: "synthetic-key",
} as Parameters<typeof createKnowledgeDocument>[0];
function context(role = "user", scoped = false): AuthContext {
  const membership = {
    organization_id: org,
    role: "owner",
    accessSource: "membership" as const,
    organization: null,
    ...(scoped ? { access_scope: "store" as const, store_ids: [store] } : {}),
  };
  return {
    user: { id },
    profile: {
      id,
      full_name: null,
      avatar_url: null,
      is_active: true,
      platform_role: role,
    },
    memberships: scoped ? [] : [membership],
    storeMemberships: scoped ? [membership] : [],
    subscriptions: [],
  };
}
const document = {
  id,
  organization_id: org,
  store_id: store,
  audience: "client_visible",
  visibility: "organization",
  version: 2,
  checksum,
};
async function transport<T>(
  respond: (url: URL, body: any) => unknown,
  work: () => Promise<T>,
) {
  const original = globalThis.fetch,
    calls: string[] = [],
    failures: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.hostname + url.pathname);
    // A typo must never turn a unit test into a live embedding or database call.
    try {
      assert.ok(["imp04.invalid", "api.voyageai.com"].includes(url.hostname));
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(JSON.stringify(respond(url, body)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      failures.push(error);
      throw error;
    }
  };
  try {
    const result = await work();
    assert.deepEqual(failures, []);
    return { result, calls };
  } finally {
    globalThis.fetch = original;
  }
}
function row(value: unknown) {
  return (url: URL) => {
    assert.ok(url.pathname.endsWith("/knowledge_documents"));
    return value;
  };
}

test("full document reads deny private and unknown audiences to a client, including an owner", async () => {
  for (const audience of ["consultant_only", "system_only", "unknown"]) {
    const { result } = await transport(row({ ...document, audience }), () =>
      getKnowledgeDocument(env, context(), org, id),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "knowledge_audience_denied");
  }
});
test("full document reads preserve exact store scope and assigned consultant access", async () => {
  for (const [shop, allowed] of [
    [store, true],
    ["other-store", false],
    [null, false],
  ] as const) {
    const { result } = await transport(
      row({ ...document, store_id: shop }),
      () => getKnowledgeDocument(env, context("user", true), org, id),
    );
    assert.equal(result.ok, allowed);
  }
  const { result } = await transport(
    row({ ...document, audience: "consultant_only" }),
    () => getKnowledgeDocument(env, context("consultant"), org, id),
  );
  assert.equal(result.ok, true);
});
test("foreign tenant and inactive profile fail closed", async () => {
  const inactive = context();
  inactive.profile.is_active = false;
  const { result } = await transport(row(document), () =>
    getKnowledgeDocument(env, inactive, org, id),
  );
  assert.equal(result.ok, false);
  const foreign = await transport(
    () => {
      throw Error("must not read foreign data");
    },
    () => getKnowledgeDocument(env, context(), "foreign", id),
  );
  assert.equal(foreign.result.ok, false);
  assert.equal(foreign.calls.length, 0);
});
test("an inactive administrator cannot authorize a release through the global catalog", async () => {
  const c = context("platform_admin");
  c.profile.is_active = false;
  const { result, calls } = await transport(
    () => {
      throw Error("must not read the catalog");
    },
    () => listKnowledgeDocuments(env, "Bearer synthetic", c, "global"),
  );
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});
test("updates reject hidden documents and stale or malformed revisions before calling Voyage", async () => {
  const cases = [
    {
      doc: { ...document, audience: "consultant_only" },
      payload: { content: "new" },
      status: 403,
    },
    {
      doc: document,
      payload: { content: "new", expected_version: 1 },
      status: 409,
    },
    {
      doc: document,
      payload: { content: "new", expected_checksum: "b".repeat(64) },
      status: 409,
    },
    {
      doc: document,
      payload: { content: "new", expected_version: 0 },
      status: 400,
    },
    {
      doc: document,
      payload: { content: "new", expected_checksum: "invalid" },
      status: 400,
    },
  ];
  for (const item of cases) {
    const { result, calls } = await transport(row(item.doc), () =>
      updateKnowledgeDocument(env, context(), org, id, item.payload),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.statusCode, item.status);
    assert.ok(calls.every((c) => c.startsWith("imp04.invalid/")));
  }
});
test("create rejects a connection outside the organization and a store scope on global knowledge before Voyage", async () => {
  const { result, calls } = await transport(
    (url) => {
      assert.ok(url.pathname.endsWith("/shopify_stores"));
      assert.equal(url.searchParams.get("organization_id"), `eq.${org}`);
      return null;
    },
    () =>
      createKnowledgeDocument(env, context(), org, {
        title: "doc",
        content: "content",
        connection_id: "foreign",
      }),
  );
  assert.equal(result.ok, false);
  assert.equal(calls.length, 1);
  const global = await transport(
    () => {
      throw Error("must not call providers");
    },
    () =>
      createKnowledgeDocument(env, context("platform_admin"), null, {
        title: "doc",
        content: "content",
        connection_id: "any",
      }),
  );
  assert.equal(global.result.ok, false);
  assert.equal(global.calls.length, 0);
});
test("a valid revision uses Voyage and the atomic replacement RPC with the observed version", async () => {
  let reads = 0;
  const { result, calls } = await transport(
    (url, body) => {
      if (url.hostname === "api.voyageai.com")
        return {
          data: [
            {
              index: 0,
              data: [{ index: 0, embedding: Array(1024).fill(0.01) }],
            },
          ],
        };
      if (url.pathname.endsWith("/knowledge_documents"))
        return ++reads === 1
          ? document
          : { ...document, title: "Updated", version: 3 };
      if (url.pathname.endsWith("/replace_knowledge_document_index")) {
        assert.equal(body.p_expected_version, 2);
        assert.equal(body.p_chunks[0].chunk_index, 0);
        assert.equal(body.p_embedding_model, "voyage-context-4");
        return true;
      }
      if (url.pathname.endsWith("/audit_logs")) return null;
      throw Error(`Unexpected call ${url.pathname}`);
    },
    () =>
      updateKnowledgeDocument(env, context(), org, id, {
        content: "Updated document content.",
        expected_version: 2,
        expected_checksum: checksum,
      }),
  );
  assert.equal(result.ok, true);
  assert.equal(
    calls.filter((c) => c.startsWith("api.voyageai.com/")).length,
    1,
  );
});
