import { IntegrationError } from "@e-nora/integrations";

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const SHOPIFY_API_VERSION_PATTERN = /^\d{4}-\d{2}$/;
const configuredShopifyApiVersion = process.env.SHOPIFY_API_VERSION?.trim();
export const SHOPIFY_API_VERSION =
  configuredShopifyApiVersion &&
  SHOPIFY_API_VERSION_PATTERN.test(configuredShopifyApiVersion)
    ? configuredShopifyApiVersion
    : "2026-07";

export class ShopifyGraphError extends IntegrationError {
  constructor(message: string, status?: number, integrationCode: "RATE_LIMITED" | "EXTERNAL_API_UNAVAILABLE" = "EXTERNAL_API_UNAVAILABLE") {
    super(integrationCode, "shopify", message, integrationCode === "RATE_LIMITED", false, status);
    this.name = "ShopifyGraphError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isThrottled(payload: ShopifyGraphQLResponse<unknown>) {
  return (payload.errors ?? []).some(
    (error) => error.extensions?.code === "THROTTLED" || error.message === "Throttled",
  );
}

export async function shopifyGraphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      lastError = new ShopifyGraphError(
        error instanceof Error && error.name === "AbortError"
          ? "shopify_graphql_timeout"
          : "shopify_graphql_network_error",
        error instanceof Error && error.name === "AbortError" ? 408 : 503,
      );
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1)));
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      (response.status >= 500 && response.status < 600)
    ) {
      lastError = new ShopifyGraphError(
        `shopify_graphql_http_${response.status}`,
        response.status,
        response.status === 429 ? "RATE_LIMITED" : "EXTERNAL_API_UNAVAILABLE",
      );
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(
          Math.min(
            MAX_BACKOFF_MS,
            retryAfterMs && Number.isFinite(retryAfterMs)
              ? retryAfterMs
              : BASE_BACKOFF_MS * 2 ** (attempt - 1),
          ),
        );
      }
      continue;
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new ShopifyGraphError(
        `shopify_graphql_http_${response.status}${bodyText ? `: ${bodyText.slice(0, 500)}` : ""}`,
        response.status,
      );
    }

    const payload = (await response.json()) as ShopifyGraphQLResponse<T>;

    if (payload.errors?.length) {
      if (isThrottled(payload) && attempt < MAX_ATTEMPTS) {
        lastError = new ShopifyGraphError("shopify_graphql_throttled", 429, "RATE_LIMITED");
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
        continue;
      }

      throw new ShopifyGraphError(payload.errors.map((item) => item.message ?? "shopify_graphql_error").join("; "));
    }

    if (!payload.data) {
      throw new ShopifyGraphError("shopify_graphql_empty_payload");
    }

    return payload.data;
  }

  throw lastError ?? new ShopifyGraphError("shopify_graphql_retries_exhausted");
}
