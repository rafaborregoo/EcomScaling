type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;

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
    const response = await fetch(`https://${shopDomain}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      lastError = new Error(`shopify_graphql_http_${response.status}`);
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
      await sleep(retryAfterMs && Number.isFinite(retryAfterMs) ? retryAfterMs : BASE_BACKOFF_MS * 2 ** (attempt - 1));
      continue;
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`shopify_graphql_http_${response.status}${bodyText ? `: ${bodyText.slice(0, 500)}` : ""}`);
    }

    const payload = (await response.json()) as ShopifyGraphQLResponse<T>;

    if (payload.errors?.length) {
      if (isThrottled(payload) && attempt < MAX_ATTEMPTS) {
        lastError = new Error("shopify_graphql_throttled");
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(payload.errors.map((item) => item.message ?? "shopify_graphql_error").join("; "));
    }

    if (!payload.data) {
      throw new Error("shopify_graphql_empty_payload");
    }

    return payload.data;
  }

  throw lastError ?? new Error("shopify_graphql_retries_exhausted");
}
