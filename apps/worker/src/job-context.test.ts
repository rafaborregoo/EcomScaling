import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

test("crea una correlación estable y no contiene secretos", () => {
  const context = createWorkerJobContext("shopify-reconcile", "job-123");
  assert.deepEqual(context, {
    job_name: "shopify-reconcile",
    job_id: "job-123",
    correlation_id: "worker:shopify-reconcile:job-123",
  });
  assert.equal(JSON.stringify(context).includes("SECRET"), false);
});

test("combina metadata del job sin perder la correlación", () => {
  const context = createWorkerJobContext("memory-ingestion", null);
  const meta = workerJobMeta(context, { organization_id: "org-1", count: 2 });
  assert.equal(meta.job_name, "memory-ingestion");
  assert.equal(meta.organization_id, "org-1");
  assert.equal(meta.count, 2);
  assert.match(meta.correlation_id, /^worker:memory-ingestion:/);
});
