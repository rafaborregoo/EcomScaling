import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  hasQueuedRenderJobs,
  getCompletedRenderArtifactBytes,
  hasRenderArtifactCapacity,
  MAX_JOB_HTML_CHARS,
  makeIsolatedDocument,
  pruneExpiredRenderArtifacts,
  renderEmailHtml,
  recoverInterruptedRenderJobs,
  validateRenderJob,
} from "./render-core.mjs";

test("rejects invalid and oversized jobs before opening a browser", () => {
  assert.equal(validateRenderJob(null), null);
  assert.equal(validateRenderJob({ id: "../x", html: "<p>x</p>" }), null);
  assert.equal(
    validateRenderJob({
      id: "123e4567-e89b-12d3-a456-426614174000",
      html: "x".repeat(MAX_JOB_HTML_CHARS + 1),
    }),
    null,
  );
});

test("validates a bounded UUID job", () => {
  const job = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    html: "<p>hello</p>",
  };
  assert.deepEqual(validateRenderJob(job), job);
});

test("does not start Chromium when the queue is empty and detects only valid job filenames", async () => {
  const spool = await mkdtemp(
    path.join(os.tmpdir(), "e-nora-email-render-idle-"),
  );
  try {
    assert.equal(await hasQueuedRenderJobs(spool), false);
    await writeFile(path.join(spool, "queued", "not-a-job.json"), "{}");
    assert.equal(await hasQueuedRenderJobs(spool), false);
    await writeFile(
      path.join(spool, "queued", "123e4567-e89b-12d3-a456-426614174000.json"),
      "{}",
    );
    assert.equal(await hasQueuedRenderJobs(spool), true);
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("prunes expired screenshot artifacts but preserves recent and malformed entries", async () => {
  const spool = await mkdtemp(
    path.join(os.tmpdir(), "e-nora-email-render-expiry-"),
  );
  const completed = path.join(spool, "completed");
  const oldJob = path.join(completed, "123e4567-e89b-12d3-a456-426614174000");
  const recentJob = path.join(
    completed,
    "123e4567-e89b-12d3-a456-426614174001",
  );
  const malformed = path.join(completed, "not-a-job");
  const failed = path.join(spool, "failed");
  try {
    await Promise.all([
      mkdir(oldJob, { recursive: true }),
      mkdir(recentJob, { recursive: true }),
      mkdir(malformed, { recursive: true }),
      mkdir(failed, { recursive: true }),
    ]);
    await writeFile(path.join(oldJob, "desktop-full.png"), "private capture");
    const failedMarker = path.join(failed, "123e4567-e89b-12d3-a456-426614174002.json");
    await writeFile(failedMarker, JSON.stringify({ id: "123e4567-e89b-12d3-a456-426614174002", status: "failed" }));
    const stale = new Date(1_000);
    await utimes(oldJob, stale, stale);
    await utimes(failedMarker, stale, stale);
    assert.equal(
      await pruneExpiredRenderArtifacts(spool, Date.now(), 60_000),
      2,
    );
    await assert.rejects(readFile(path.join(oldJob, "desktop-full.png")));
    await assert.rejects(readFile(failedMarker));
    assert.deepEqual((await readdir(completed)).sort(), [
      "123e4567-e89b-12d3-a456-426614174001",
      "not-a-job",
    ]);
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("recovers interrupted jobs and removes stale partial captures", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-render-recovery-"));
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const completedId = "123e4567-e89b-12d3-a456-426614174001";
  try {
    await mkdir(path.join(spool, "processing"), { recursive: true });
    await mkdir(path.join(spool, "completed", id), { recursive: true });
    await mkdir(path.join(spool, "completed", completedId), { recursive: true });
    await writeFile(path.join(spool, "processing", `${id}.json`), JSON.stringify({ id, html: "<p>retry</p>" }));
    await writeFile(path.join(spool, "processing", `${completedId}.json`), JSON.stringify({ id: completedId, html: "<p>done</p>" }));
    await writeFile(path.join(spool, "completed", id, "desktop-first-screen.png"), "partial");
    await writeFile(path.join(spool, "completed", completedId, "result.json"), JSON.stringify({ id: completedId, status: "completed" }));
    await writeFile(path.join(spool, "processing", "not-a-job.json"), "{}");

    assert.equal(await recoverInterruptedRenderJobs(spool), 1);
    assert.equal(await readFile(path.join(spool, "queued", `${id}.json`), "utf8"), JSON.stringify({ id, html: "<p>retry</p>" }));
    await assert.rejects(readFile(path.join(spool, "completed", id, "desktop-first-screen.png")));
    await assert.rejects(readFile(path.join(spool, "processing", `${completedId}.json`)));
    assert.equal(await readFile(path.join(spool, "processing", "not-a-job.json"), "utf8"), "{}");
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("reserves a bounded artifact budget and counts only known renderer outputs", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-render-budget-"));
  const job = path.join(spool, "completed", "123e4567-e89b-12d3-a456-426614174000");
  try {
    await mkdir(job, { recursive: true });
    await writeFile(path.join(job, "desktop-first-screen.png"), Buffer.alloc(80));
    await writeFile(path.join(job, "result.json"), "12345");
    await writeFile(path.join(job, "unexpected.bin"), Buffer.alloc(10_000));
    assert.equal(await getCompletedRenderArtifactBytes(spool), 85);
    assert.equal(await hasRenderArtifactCapacity(spool, 165, 80), true);
    assert.equal(await hasRenderArtifactCapacity(spool, 164, 80), false);
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});

test("injects a strict no-network, no-script policy into the email document", () => {
  const document = makeIsolatedDocument(
    '<html><head><title>x</title></head><body><img src="https://example.com/a.png"></body></html>',
  );
  assert.match(document, /default-src 'none'/);
  assert.match(document, /script-src 'none'/);
  assert.match(document, /connect-src 'none'/);
  assert.match(document, /<base href=\"about:blank\">/);
  assert.match(document, /https:\/\/example\.com\/a\.png/);
});

test("renders both viewports with scripts off, requests blocked and bounded full-page captures", async () => {
  const spool = await mkdtemp(path.join(os.tmpdir(), "e-nora-email-render-"));
  const contexts = [];
  const screenshotClips = [];
  const browser = {
    async newContext(options) {
      contexts.push(options);
      let routeHandler;
      return {
        async route(pattern, handler) {
          assert.equal(pattern, "**/*");
          routeHandler = handler;
          await routeHandler({
            abort: async (reason) => assert.equal(reason, "blockedbyclient"),
          });
        },
        async newPage() {
          return {
            setDefaultTimeout() {},
            async setContent(html) {
              assert.match(html, /script-src 'none'/);
            },
            async evaluate() {
              return 14_000;
            },
            async screenshot(options) {
              screenshotClips.push(options.clip?.height ?? options.fullPage);
              return Buffer.from("png-fixture");
            },
          };
        },
        async close() {},
      };
    },
  };
  try {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const result = await renderEmailHtml(
      { id, html: "<p>Test</p>" },
      browser,
      spool,
    );
    assert.equal(result.simulation, true);
    assert.equal(result.externalRequestsBlocked, 2);
    assert.deepEqual(
      contexts.map((item) => item.viewport.width),
      [1280, 390],
    );
    assert.ok(
      contexts.every(
        (item) =>
          item.javaScriptEnabled === false && item.serviceWorkers === "block",
      ),
    );
    assert.ok(result.captures.every((item) => item.clipped === true));
    assert.deepEqual(screenshotClips, [false, 12_000, false, 12_000]);
    const resultFile = JSON.parse(
      await readFile(path.join(spool, "completed", id, "result.json"), "utf8"),
    );
    assert.equal(resultFile.captures.length, 2);
    assert.equal((await readdir(path.join(spool, "completed", id))).length, 5);
  } finally {
    await rm(spool, { recursive: true, force: true });
  }
});
