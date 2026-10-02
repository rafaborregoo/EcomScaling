import assert from "node:assert/strict";
import test from "node:test";
import { forEachBulkRootBatch, forEachBulkRootChildrenBatch } from "./shopify-bulk.js";

async function withBulkLines<T>(lines: unknown[], run: () => Promise<T>) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    lines.map((line) => JSON.stringify(line)).join("\n"),
    { status: 200, headers: { "content-type": "application/jsonl" } },
  );
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("streaming Shopify root children keeps a large collection within the configured batch size", async () => {
  const lines = [
    { id: "gid://shopify/Collection/1", title: "Grande" },
    ...Array.from({ length: 1_101 }, (_, index) => ({
      id: `gid://shopify/Product/${index + 1}`,
      __parentId: "gid://shopify/Collection/1",
    })),
    { id: "gid://shopify/Collection/2", title: "Vacía" },
  ];
  const batches: Array<{ rootId: string; childIds: string[]; rootComplete: boolean }> = [];

  const count = await withBulkLines(lines, () =>
    forEachBulkRootChildrenBatch("https://storage.googleapis.com/shopify/result", 500, (batch) => {
      batches.push({
        rootId: batch.root.id,
        childIds: batch.children.map(({ id }) => id),
        rootComplete: batch.rootComplete,
      });
    }),
  );

  assert.equal(count, 1_103);
  assert.deepEqual(batches.map(({ childIds }) => childIds.length), [500, 500, 101, 0]);
  assert.ok(batches.every(({ childIds }) => childIds.length <= 500));
  assert.deepEqual(batches.map(({ rootComplete }) => rootComplete), [false, false, true, true]);
  assert.ok(batches.every(({ rootId }) => rootId === "gid://shopify/Collection/1" || rootId === "gid://shopify/Collection/2"));
  assert.equal(batches[3]?.rootId, "gid://shopify/Collection/2");
});

test("streaming Shopify root children fails closed when a child has no active root", async () => {
  await withBulkLines([
    { id: "gid://shopify/Product/1", __parentId: "gid://shopify/Collection/missing" },
  ], async () => {
    await assert.rejects(
      forEachBulkRootChildrenBatch("https://storage.googleapis.com/shopify/result", 10, () => undefined),
      /bulk_result_direct_child_parent_not_found/,
    );
  });
});

test("streaming Shopify root children rejects an invalid batch size", async () => {
  await assert.rejects(
    forEachBulkRootChildrenBatch(null, 0, () => undefined),
    /bulk_result_child_batch_size_invalid/,
  );
});

test("bulk root grouping aborts a pathological order before retaining unbounded descendants", async () => {
  const lines = [
    { id: "gid://shopify/Order/1" },
    ...Array.from({ length: 5_001 }, (_, index) => ({
      id: `gid://shopify/LineItem/${index + 1}`,
      __parentId: "gid://shopify/Order/1",
    })),
  ];

  await withBulkLines(lines, async () => {
    await assert.rejects(
      forEachBulkRootBatch("https://storage.googleapis.com/shopify/result", 25, () => undefined),
      /bulk_result_root_group_exceeds_memory_limit/,
    );
  });
});
