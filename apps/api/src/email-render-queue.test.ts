import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  a26RenderIdFromSnapshot,
  enqueueKlaviyoEmailRender,
  isAllowedA26RenderCaptureName,
  KLAVIYO_RENDER_MAX_PENDING_JOBS,
  prepareKlaviyoEmailRenderReview,
  reconcileA26RenderReceipts,
  readKlaviyoEmailRenderCapture,
  readKlaviyoEmailRenderState,
  stableKlaviyoRenderJobId,
  validateKlaviyoRenderQueueJob,
} from "./email-render-queue.js";

const id = "123e4567-e89b-42d3-a456-426614174000";

test("A26 archives asynchronous worker receipts and marks expired artifacts without generating again", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "a26-reconcile-"));
  const expiredId = "123e4567-e89b-42d3-a456-426614174001";
  const writes: Array<{ id: string; receipt: Record<string, unknown> }> = [];
  try {
    await mkdir(path.join(spool, "completed", id), { recursive: true });
    await writeFile(path.join(spool, "completed", id, "result.json"), JSON.stringify({ id, status: "completed", htmlHash: "observed-hash" }));
    const client = { from: () => ({
      select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [id, expiredId].map((render_id) => ({ render_id, receipt: { status: "queued", html_hash: "observed-hash" }, created_at: "2020-01-01" })), error: null }) }) }) }),
      update: (value: { receipt: Record<string, unknown> }) => ({ eq: async (_column: string, renderId: string) => { writes.push({ id: renderId, receipt: value.receipt }); return { error: null }; } }),
    }) } as unknown as Parameters<typeof reconcileA26RenderReceipts>[0];
    await reconcileA26RenderReceipts(client, spool);
    assert.equal(writes[0]?.receipt.status, "completed");
    assert.equal(writes[1]?.receipt.status, "expired_or_not_available");
    assert.equal(writes[0]?.receipt.model_review_status, "human_review_available_without_model_rerun");
    assert.deepEqual(writes[0]?.receipt.worker_receipt, { id, status: "completed", htmlHash: "observed-hash" });
  } finally { await rm(spool, { recursive: true, force: true }); }
});

test("rejects unsafe IDs, empty HTML, and oversized queue payloads", () => {
  assert.equal(
    validateKlaviyoRenderQueueJob({ id: "../../secrets", html: "x" }),
    false,
  );
  assert.equal(validateKlaviyoRenderQueueJob({ id, html: "" }), false);
  assert.equal(
    validateKlaviyoRenderQueueJob({ id, html: "x".repeat(150_001) }),
    false,
  );
});

test("extracts capture IDs only from the exact A26 context block and allowlists PNG variants", () => {
  const renderId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(a26RenderIdFromSnapshot({ blocks: [{ label: "otro", data: { render_id: renderId } }] }), null);
  assert.equal(a26RenderIdFromSnapshot({ blocks: [{ label: "Revision visual asincrona A26; solo simulacion de primera pantalla desktop/movil, no evidencia de entrega real", data: { render_id: "../../secret" } }] }), null);
  assert.equal(a26RenderIdFromSnapshot({ blocks: [{ label: "Revision visual asincrona A26; solo simulacion de primera pantalla desktop/movil, no evidencia de entrega real", data: { render_id: renderId } }] }), renderId);
  assert.equal(isAllowedA26RenderCaptureName("desktop-first-screen.png"), true);
  assert.equal(isAllowedA26RenderCaptureName("../../secret"), false);
});

test("queues render jobs atomically and treats duplicate IDs as idempotent", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-render-queue-"));
  try {
    const job = { id, html: "<p>Hello</p>" };
    assert.deepEqual(await enqueueKlaviyoEmailRender(spool, job), {
      status: "queued",
    });
    assert.deepEqual(await enqueueKlaviyoEmailRender(spool, job), {
      status: "already_queued",
    });
    assert.deepEqual(
      JSON.parse(
        await readFile(path.join(spool, "queued", `${id}.json`), "utf8"),
      ),
      job,
    );
    assert.deepEqual(await readKlaviyoEmailRenderState(spool, id), {
      status: "queued",
    });
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("bounds queued work to prevent unbounded HTML spool growth", async () => {
  const spool = await mkdtemp(
    path.join(os.tmpdir(), "e-nora-render-queue-cap-"),
  );
  const queued = path.join(spool, "queued");
  try {
    await mkdir(queued, { recursive: true });
    for (let i = 0; i < KLAVIYO_RENDER_MAX_PENDING_JOBS; i++) {
      await writeFile(
        path.join(
          queued,
          `${i.toString(16).padStart(8, "0")}-e89b-42d3-a456-426614174000.json`,
        ),
        "{}",
      );
    }
    await assert.rejects(
      enqueueKlaviyoEmailRender(spool, { id, html: "<p>new</p>" }),
      /klaviyo_render_queue_full/,
    );
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("reads only known capture filenames after a matching completed result", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-render-result-"));
  const output = path.join(spool, "completed", id);
  try {
    await mkdir(output, { recursive: true });
    await writeFile(
      path.join(output, "result.json"),
      JSON.stringify({ id, status: "completed" }),
    );
    await writeFile(
      path.join(output, "desktop-first-screen.png"),
      Buffer.from("fixture"),
    );
    assert.equal(
      (await readKlaviyoEmailRenderState(spool, id)).status,
      "completed",
    );
    assert.deepEqual(
      Buffer.from(
        (await readKlaviyoEmailRenderCapture(
          spool,
          id,
          "desktop-first-screen.png",
        ))!,
      ),
      Buffer.from("fixture"),
    );
    assert.equal(
      await readKlaviyoEmailRenderCapture(spool, id, "../../result.json"),
      null,
    );
    assert.equal(
      (await readKlaviyoEmailRenderState(spool, "../other")).status,
      "missing",
    );
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("queues a tenant-scoped simulation once and supplies completed previews to vision in memory", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-render-vision-"));
  const scope = {
    organizationId: "org-a",
    storeId: "store-a",
    accountId: "account-a",
    externalTemplateId: "template-a",
  };
  const html = "<table><tr><td>Sale</td></tr></table>";
  const renderId = stableKlaviyoRenderJobId(scope, html);
  try {
    const pending = await prepareKlaviyoEmailRenderReview(spool, scope, html);
    assert.equal(pending.review.status, "queued");
    assert.equal(pending.images.length, 0);
    assert.equal(
      (await readKlaviyoEmailRenderState(spool, renderId)).status,
      "queued",
    );
    assert.notEqual(
      stableKlaviyoRenderJobId({ ...scope, organizationId: "org-b" }, html),
      renderId,
    );
    assert.notEqual(stableKlaviyoRenderJobId(scope, `${html} `), renderId);

    const output = path.join(spool, "completed", renderId);
    await mkdir(output, { recursive: true });
    await writeFile(
      path.join(output, "result.json"),
      JSON.stringify({ id: renderId, status: "completed" }),
    );
    await writeFile(
      path.join(output, "desktop-first-screen.png"),
      Buffer.from("desktop"),
    );
    await writeFile(
      path.join(output, "mobile-first-screen.png"),
      Buffer.from("mobile"),
    );
    const completed = await prepareKlaviyoEmailRenderReview(spool, scope, html);
    assert.equal(completed.review.status, "completed");
    assert.equal(completed.review.screenshots_supplied_to_vision, 2);
    assert.deepEqual(
      completed.images.map((image) =>
        "base64" in image
          ? Buffer.from(image.base64, "base64").toString("utf8")
          : "url",
      ),
      ["desktop", "mobile"],
    );
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("a new A26 run retries a previously failed deterministic render job", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-render-retry-"));
  const scope = {
    organizationId: "org-retry",
    storeId: null,
    accountId: "account-retry",
    externalTemplateId: "template-retry",
  };
  const html = "<p>retry me</p>";
  const renderId = stableKlaviyoRenderJobId(scope, html);
  try {
    await mkdir(path.join(spool, "failed"), { recursive: true });
    await writeFile(
      path.join(spool, "failed", `${renderId}.json`),
      JSON.stringify({ id: renderId, status: "failed", code: "render_failed" }),
    );
    const result = await prepareKlaviyoEmailRenderReview(spool, scope, html);
    assert.equal(result.review.status, "queued");
    assert.deepEqual(
      JSON.parse(await readFile(path.join(spool, "queued", `${renderId}.json`), "utf8")),
      { id: renderId, html },
    );
    await assert.rejects(readFile(path.join(spool, "failed", `${renderId}.json`)));
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("A26 backs off a new failure and retains the retry budget after artifact cleanup", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-render-backoff-"));
  const scope = { organizationId: "org", storeId: "store", accountId: "account", externalTemplateId: "template" };
  const html = "<p>Retry</p>", renderId = stableKlaviyoRenderJobId(scope, html);
  try {
    await mkdir(path.join(spool, "failed"), { recursive: true });
    await writeFile(path.join(spool, "failed", `${renderId}.json`), JSON.stringify({ id: renderId, status: "failed", failedAt: new Date().toISOString() }));
    assert.equal((await prepareKlaviyoEmailRenderReview(spool, scope, html)).review.status, "failed");
    await rm(path.join(spool, "failed", `${renderId}.json`));
    await writeFile(path.join(spool, "failed", `${renderId}.retry`), JSON.stringify({ attempts: 3, last_at: 0 }));
    assert.equal((await prepareKlaviyoEmailRenderReview(spool, scope, html)).review.status, "failed");
  } finally { await rm(spool, { recursive: true, force: true }); }
});
