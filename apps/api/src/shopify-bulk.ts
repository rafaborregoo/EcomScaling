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

export async function fetchBulkResult(url: string | null): Promise<BulkLine[]> {
  if (!url) {
    return [];
  }

  const response = await fetch(validateBulkResultUrl(url));

  if (!response.ok) {
    throw new Error(`bulk_result_download_failed_${response.status}`);
  }

  const text = await response.text();

  if (!text.trim()) {
    return [];
  }

  return text
    .split("\n")
    .filter((line) => line.trim().length)
    .map((line) => JSON.parse(line) as BulkLine);
}

/**
 * Groups flattened bulk JSONL lines by their `__parentId`. Shopify emits a
 * separate line for every node reached through a paginated connection,
 * tagging it with the id of the nearest ancestor object that owns that
 * connection - even when that ancestor is itself an inline (non-connection)
 * field, such as an inventory item embedded inside a variant.
 */
export function groupBulkLinesByParent(lines: BulkLine[]) {
  const topLevel: BulkLine[] = [];
  const childrenByParentId = new Map<string, BulkLine[]>();

  for (const line of lines) {
    if (!line.__parentId) {
      topLevel.push(line);
      continue;
    }

    const siblings = childrenByParentId.get(line.__parentId) ?? [];
    siblings.push(line);
    childrenByParentId.set(line.__parentId, siblings);
  }

  return { topLevel, childrenByParentId };
}
