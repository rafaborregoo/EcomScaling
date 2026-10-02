import { shopifyGraphql } from "./shopify-client.js";

type BulkOperationStatus =
  | "CREATED"
  | "RUNNING"
  | "COMPLETED"
  | "CANCELING"
  | "CANCELED"
  | "FAILED"
  | "EXPIRED";

type BulkOperationNode = {
  id: string;
  status: BulkOperationStatus;
  errorCode: string | null;
  url: string | null;
  objectCount: string;
};

export type BulkLine = {
  id: string;
  __parentId?: string;
  [key: string]: unknown;
};

const SHOPIFY_BULK_RESULT_HOST = "storage.googleapis.com";
const MAX_BULK_ROOT_DESCENDANTS = 5_000;

/**
 * Shopify returns signed bulk JSONL files from Google Cloud Storage. Keep the
 * destination allowlisted because the URL is returned by an external system
 * and is later fetched by our server (SSRF boundary).
 */
export function validateBulkResultUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("bulk_result_url_invalid");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== SHOPIFY_BULK_RESULT_HOST ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443")
  ) {
    throw new Error("bulk_result_url_host_not_allowed");
  }

  return parsed.toString();
}

/**
 * Only a COMPLETED bulk operation produces a result URL. Shopify's bulk JSONL
 * exhausts selected nested connections into child rows with `__parentId`;
 * `cursor` and `pageInfo` are ignored, so coverage must not infer missing
 * children from absent pagination metadata.
 * See https://shopify.dev/docs/apps/build/apis/graphql-admin/bulk-operations/queries.
 */
async function pollBulkOperation(
  shopDomain: string,
  accessToken: string,
  operationId: string,
) {
  const maxAttempts = 180;
  const intervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await shopifyGraphql<{ node: BulkOperationNode | null }>(
      shopDomain,
      accessToken,
      `
        query BulkStatus($id: ID!) {
          node(id: $id) {
            ... on BulkOperation {
              id
              status
              errorCode
              url
              objectCount
            }
          }
        }
      `,
      { id: operationId },
    );

    const operation = result.node;

    if (!operation) {
      throw new Error("bulk_operation_not_found");
    }

    if (operation.status === "COMPLETED") {
      return {
        url: operation.url,
        objectCount: Number(operation.objectCount ?? 0),
      };
    }

    if (
      operation.status === "FAILED" ||
      operation.status === "CANCELED" ||
      operation.status === "EXPIRED"
    ) {
      throw new Error(
        `bulk_operation_${operation.status.toLowerCase()}${operation.errorCode ? `: ${operation.errorCode}` : ""}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("bulk_operation_timeout");
}

export async function runBulkOperation(
  shopDomain: string,
  accessToken: string,
  bulkQuery: string,
) {
  const current = await shopifyGraphql<{
    currentBulkOperation: BulkOperationNode | null;
  }>(
    shopDomain,
    accessToken,
    `query { currentBulkOperation { id status errorCode url objectCount } }`,
    {},
  );

  if (
    current.currentBulkOperation &&
    ["CREATED", "RUNNING"].includes(current.currentBulkOperation.status)
  ) {
    await pollBulkOperation(
      shopDomain,
      accessToken,
      current.currentBulkOperation.id,
    );
  }

  const started = await shopifyGraphql<{
    bulkOperationRunQuery: {
      bulkOperation: { id: string } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(
    shopDomain,
    accessToken,
    `
      mutation BulkQuery($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation { id }
          userErrors { field message }
        }
      }
    `,
    { query: bulkQuery },
  );

  const userErrors = started.bulkOperationRunQuery.userErrors;

  if (userErrors?.length) {
    throw new Error(
      `bulk_operation_start_failed: ${userErrors.map((item) => item.message).join("; ")}`,
    );
  }

  const operationId = started.bulkOperationRunQuery.bulkOperation?.id;

  if (!operationId) {
    throw new Error("bulk_operation_start_missing_id");
  }

  return pollBulkOperation(shopDomain, accessToken, operationId);
}

export async function forEachBulkResultBatch(
  url: string | null,
  batchSize: number,
  onBatch: (batch: BulkLine[]) => Promise<void> | void,
): Promise<number> {
  if (!url) {
    return 0;
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("bulk_result_batch_size_invalid");
  }

  // Shopify signs the initial GCS URL, but fetch follows redirects by default.
  // A redirect could escape the host allowlist above, so the download must
  // fail closed if storage ever returns one.
  const response = await fetch(validateBulkResultUrl(url), { redirect: "error" });

  if (!response.ok) {
    throw new Error(`bulk_result_download_failed_${response.status}`);
  }

  let count = 0;
  let batch: BulkLine[] = [];
  const emitLine = async (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;
    batch.push(JSON.parse(line) as BulkLine);
    count += 1;
    if (batch.length >= batchSize) {
      const completed = batch;
      batch = [];
      await onBatch(completed);
    }
  };
  const flush = async () => {
    if (!batch.length) return;
    const completed = batch;
    batch = [];
    await onBatch(completed);
  };

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    for (const line of text.split("\n")) await emitLine(line);
    await flush();
    return count;
  }

  const decoder = new TextDecoder();
  let pending = "";

  const parseCompleteLines = async () => {
    let newline = pending.indexOf("\n");
    while (newline >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      await emitLine(line);
      newline = pending.indexOf("\n");
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      await parseCompleteLines();
      if (done) break;
    }

    await emitLine(pending);
    await flush();
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  return count;
}

export type BulkRootGroup = {
  root: BulkLine;
  childrenByParentId: Map<string, BulkLine[]>;
};

export type BulkRootChildrenBatch = {
  root: BulkLine;
  children: BulkLine[];
  /** True for the final segment of this root, including roots with no children. */
  rootComplete: boolean;
};

/**
 * Streams a JSONL bulk export as bounded groups of top-level objects. Shopify
 * emits each parent before its descendants, so child IDs can be associated
 * with the current root and released as soon as that root batch is consumed.
 */
export async function forEachBulkRootBatch(
  url: string | null,
  rootBatchSize: number,
  onBatch: (batch: BulkRootGroup[]) => Promise<void> | void,
  options: { inlineParentIds?: (line: BulkLine) => string[] } = {},
): Promise<number> {
  if (!Number.isInteger(rootBatchSize) || rootBatchSize < 1) {
    throw new Error("bulk_result_root_batch_size_invalid");
  }

  let rootGroups: BulkRootGroup[] = [];
  let rootGroupByObjectId = new Map<string, BulkRootGroup>();
  let descendantCountByRoot = new WeakMap<BulkRootGroup, number>();
  let currentRoot: BulkRootGroup | null = null;
  let count = 0;

  const registerObjectAndInlineParents = (line: BulkLine, group: BulkRootGroup) => {
    rootGroupByObjectId.set(line.id, group);
    for (const id of options.inlineParentIds?.(line) ?? []) {
      if (id) rootGroupByObjectId.set(id, group);
    }
  };

  const flushRoots = async () => {
    if (currentRoot) {
      rootGroups.push(currentRoot);
      currentRoot = null;
    }
    if (!rootGroups.length) return;
    const completed = rootGroups;
    rootGroups = [];
    rootGroupByObjectId = new Map();
    descendantCountByRoot = new WeakMap();
    await onBatch(completed);
  };

  const acceptLines = async (lines: BulkLine[]) => {
    for (const line of lines) {
      count += 1;
      if (!line.__parentId) {
        if (currentRoot) {
          rootGroups.push(currentRoot);
          currentRoot = null;
        }
        if (rootGroups.length >= rootBatchSize) await flushRoots();
        currentRoot = { root: line, childrenByParentId: new Map() };
        registerObjectAndInlineParents(line, currentRoot);
        continue;
      }

      const rootGroup = rootGroupByObjectId.get(line.__parentId);
      if (!rootGroup) {
        throw new Error("bulk_result_parent_not_found");
      }
      const descendantCount = (descendantCountByRoot.get(rootGroup) ?? 0) + 1;
      if (descendantCount > MAX_BULK_ROOT_DESCENDANTS) {
        throw new Error("bulk_result_root_group_exceeds_memory_limit");
      }
      descendantCountByRoot.set(rootGroup, descendantCount);
      const siblings = rootGroup.childrenByParentId.get(line.__parentId) ?? [];
      siblings.push(line);
      rootGroup.childrenByParentId.set(line.__parentId, siblings);
      registerObjectAndInlineParents(line, rootGroup);
    }
  };

  await forEachBulkResultBatch(url, 500, acceptLines);
  await flushRoots();
  return count;
}

/**
 * Streams one root and bounded chunks of its direct children. This is useful
 * for Shopify connections such as collection.products: a single collection
 * can contain far more rows than a normal root batch and must not be retained
 * in memory until the next collection arrives.
 */
export async function forEachBulkRootChildrenBatch(
  url: string | null,
  childBatchSize: number,
  onBatch: (batch: BulkRootChildrenBatch) => Promise<void> | void,
): Promise<number> {
  if (!Number.isInteger(childBatchSize) || childBatchSize < 1) {
    throw new Error("bulk_result_child_batch_size_invalid");
  }

  let currentRoot: BulkLine | null = null;
  let children: BulkLine[] = [];
  let count = 0;

  const emit = async (root: BulkLine, rootComplete: boolean) => {
    const completed = children;
    children = [];
    await onBatch({ root, children: completed, rootComplete });
  };

  await forEachBulkResultBatch(url, childBatchSize, async (lines) => {
    for (const line of lines) {
      count += 1;
      if (!line.__parentId) {
        if (currentRoot) await emit(currentRoot, true);
        currentRoot = line;
        children = [];
        continue;
      }

      if (!currentRoot || line.__parentId !== currentRoot.id) {
        throw new Error("bulk_result_direct_child_parent_not_found");
      }
      children.push(line);
      if (children.length >= childBatchSize) {
        await emit(currentRoot, false);
      }
    }
  });

  if (currentRoot) await emit(currentRoot, true);
  return count;
}
