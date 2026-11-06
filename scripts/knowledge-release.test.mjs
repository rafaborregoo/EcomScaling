import assert from "node:assert/strict";
import test from "node:test";
import {
  loadKnowledgeRelease,
  planKnowledgeRelease,
  applyKnowledgeRelease,
  rollbackKnowledgeRelease,
} from "./knowledge-release.mjs";
import { checksumDe } from "./ingest-conocimiento.mjs";

const release = await loadKnowledgeRelease(process.cwd());
// The public regression suite does not depend on the temporary inventory file.
function baseline() {
  return release.documents
    .filter((d) => d.base)
    .map((d) => ({
      ...d.base,
      content: null,
      visibility: "global",
      organization_id: null,
      store_id: null,
      authority: "operational",
      origin: "human_authored",
      ingested_by: "human",
      source_actor_id: null,
    }));
}
function fixture() {
  const rows = new Map(baseline().map((d) => [d.id, structuredClone(d)]));
  let writes = 0,
    failReview = false,
    failRestore = false,
    loseResponse = false;
  const api = {
    authorize: async () => "admin",
    describe: async (id) => {
      assert.ok(rows.has(id));
      return structuredClone(rows.get(id));
    },
    update: async (id, content, revision) => {
      const d = rows.get(id);
      assert.equal(d.version, revision.version);
      assert.equal(d.checksum, revision.checksum);
      writes++;
      Object.assign(d, {
        content,
        checksum: checksumDe(content),
        version: d.version + 1,
      });
      if (loseResponse) {
        loseResponse = false;
        throw Error("response lost");
      }
      return { version: d.version };
    },
    create: async (doc) => {
      const id = `new-${rows.size}`;
      writes++;
      rows.set(id, {
        id,
        title: doc.title,
        description: doc.path,
        content: doc.content,
        checksum: doc.checksum,
        version: 1,
        status: "active",
        visibility: "global",
        audience: "consultant_only",
        organization_id: null,
        store_id: null,
        embedding_model: release.manifest.profile.model,
      });
      return { document_id: id };
    },
    markReviewed: async (change) => {
      if (failReview) {
        failReview = false;
        throw Error("metadata unavailable");
      }
      Object.assign(rows.get(change.id), {
        authority: "operational",
        origin: "human_approved_ai",
        source_actor_id: "admin",
        ingested_by: "human",
      });
    },
    restoreMetadata: async (id, before) => {
      if (failRestore) {
        failRestore = false;
        throw Error("metadata unavailable");
      }
      Object.assign(rows.get(id), {
        origin: before.origin,
        source_actor_id: before.source_actor_id,
      });
    },
    archive: async (id) => {
      rows.get(id).status = "archived";
    },
  };
  return {
    api,
    rows,
    inventory: () => [...rows.values()],
    get writes() {
      return writes;
    },
    failReview: () => {
      failReview = true;
    },
    failRestore: () => {
      failRestore = true;
    },
    loseResponse: () => {
      loseResponse = true;
    },
  };
}

test("thirty source decisions cover nine curated targets, with explicit video and unverified-case exclusions", () => {
  assert.equal(release.manifest.sources.length, 30);
  assert.equal(release.documents.length, 9);
  assert.equal(release.documents.filter((d) => d.base).length, 6);
  assert.deepEqual(
    release.manifest.sources
      .filter((s) => ["exclude", "defer"].includes(s.decision))
      .map((s) => s.id)
      .sort(),
    ["GAP-VIDEO", "META-CR-010"],
  );
  assert.equal(release.manifest.questions.length, 12);
  for (const q of release.manifest.questions) {
    assert.ok(q.question);
    assert.ok(
      q.expected_paths.every((p) =>
        release.documents.some((d) => d.path === p),
      ),
    );
  }
});
test("the pinned baseline produces six updates, three creates and no pruning", () => {
  const remote = [
    ...baseline(),
    {
      ...baseline()[0],
      id: "unrelated",
      title: "Unrelated",
      description: "conocimiento/fase-05/01-rag-produccion/unrelated.md",
    },
  ];
  const plan = planKnowledgeRelease(release, remote);
  assert.equal(plan.update.length, 6);
  assert.equal(plan.create.length, 3);
  assert.deepEqual(plan.archive, []);
  assert.deepEqual(plan.error, []);
});
test("profile, scope, audience and revision drift block the plan", () => {
  const base = baseline();
  assert.throws(
    () =>
      planKnowledgeRelease(release, [
        { ...base[0], organization_id: "foreign" },
      ]),
    /tenant/,
  );
  for (const patch of [
    { embedding_model: "other-model" },
    { version: 999 },
    { audience: "client_visible" },
    { store_id: "foreign-store" },
  ]) {
    const rows = structuredClone(base);
    Object.assign(rows[0], patch);
    assert.ok(planKnowledgeRelease(release, rows).error.length);
  }
});
test("apply is incremental and preserves IDs; rollback restores original bodies and retires only the three creations", async () => {
  const f = fixture();
  const receipt = await applyKnowledgeRelease(release, f.inventory(), f.api);
  assert.equal(receipt.status, "verified");
  assert.equal(receipt.changes.length, 9);
  assert.equal(f.writes, 9);
  const again = await applyKnowledgeRelease(release, f.inventory(), f.api);
  assert.equal(again.changes.length, 0);
  assert.equal(f.writes, 9);
  const report = await rollbackKnowledgeRelease(receipt, f.api);
  assert.equal(report.status, "restored");
  assert.equal(f.writes, 15);
  for (const doc of release.documents.filter((d) => d.base)) {
    const restored = f.rows.get(doc.base.id);
    assert.equal(restored.checksum, doc.base.checksum);
    assert.equal(restored.version, doc.base.version + 2);
    assert.equal(restored.origin, "human_authored");
  }
  assert.equal(
    [...f.rows.values()].filter((d) => d.status === "archived").length,
    3,
  );
  assert.equal(
    (await rollbackKnowledgeRelease(receipt, f.api)).status,
    "restored",
  );
  assert.equal(f.writes, 15);
});
test("partial metadata failure resumes without reembedding or losing the original before-image", async () => {
  const f = fixture();
  f.failReview();
  const partial = await applyKnowledgeRelease(release, f.inventory(), f.api);
  assert.equal(partial.status, "partial");
  assert.equal(f.writes, 1);
  assert.ok(partial.changes[0].before.content);
  const resumed = await applyKnowledgeRelease(
    release,
    f.inventory(),
    f.api,
    async () => {},
    partial,
  );
  assert.equal(resumed.status, "verified");
  assert.equal(f.writes, 9);
  assert.equal(resumed.changes.length, 9);
  assert.equal(
    (await rollbackKnowledgeRelease(resumed, f.api)).status,
    "restored",
  );
});
test("a lost index response is recovered from the checkpoint and current revision", async () => {
  const f = fixture();
  f.loseResponse();
  const partial = await applyKnowledgeRelease(release, f.inventory(), f.api);
  assert.equal(partial.changes[0].status, "prepared");
  assert.equal(f.writes, 1);
  const resumed = await applyKnowledgeRelease(
    release,
    f.inventory(),
    f.api,
    async () => {},
    partial,
  );
  assert.equal(resumed.status, "verified");
  assert.equal(f.writes, 9);
});
test("rollback retries failed metadata restoration without another embedding and rejects subsequent edits", async () => {
  const f = fixture();
  const receipt = await applyKnowledgeRelease(release, f.inventory(), f.api);
  f.failRestore();
  assert.equal(
    (await rollbackKnowledgeRelease(receipt, f.api)).status,
    "partial",
  );
  const writes = f.writes;
  assert.equal(
    (await rollbackKnowledgeRelease(receipt, f.api)).status,
    "restored",
  );
  assert.equal(f.writes, writes + 5);
  const other = fixture(),
    saved = await applyKnowledgeRelease(release, other.inventory(), other.api);
  other.rows.get(saved.changes.at(-1).id).version++;
  assert.equal(
    (await rollbackKnowledgeRelease(saved, other.api)).status,
    "partial",
  );
  assert.equal(other.writes, 9);
});
test("authorization fails before any index writes", async () => {
  const f = fixture();
  f.api.authorize = async () => {
    throw Error("denied");
  };
  await assert.rejects(
    applyKnowledgeRelease(release, f.inventory(), f.api),
    /denied/,
  );
  assert.equal(f.writes, 0);
});
