import { KLAVIYO_API_REVISION } from "./klaviyo-oauth.js";

export const KLAVIYO_API_BASE_URL = "https://a.klaviyo.com/api";

export type KlaviyoResource<T = Record<string, unknown>> = {
  type: string;
  id: string;
  attributes: T;
  relationships?: Record<string, unknown>;
  links?: Record<string, string | null>;
};

export type KlaviyoListResponse<T = Record<string, unknown>> = {
  data: Array<KlaviyoResource<T>>;
  links?: { self?: string; next?: string | null; prev?: string | null };
  meta?: Record<string, unknown>;
};

export type KlaviyoReportType =
  | "campaign-values-report"
  | "flow-values-report"
  | "form-values-report"
  | "segment-values-report";

export type KlaviyoReportRequest = {
  type: KlaviyoReportType;
  statistics: string[];
  timeframe: { start: string; end: string } | { key: string };
  conversion_metric_id: string;
  filter?: string;
  group_by?: string[];
  interval?: "hourly" | "daily" | "weekly" | "monthly";
};

export type KlaviyoClient = {
  request<T>(pathOrUrl: string, init?: RequestInit): Promise<T>;
  listAll<T = Record<string, unknown>>(
    path: string,
    options?: { maxPages?: number },
  ): Promise<Array<KlaviyoResource<T>>>;
  getAccount(): Promise<KlaviyoResource>;
  listResources<T = Record<string, unknown>>(
    resource:
      "lists" | "segments" | "flows" | "campaigns" | "forms" | "metrics",
  ): Promise<Array<KlaviyoResource<T>>>;
  queryReport<T = Record<string, unknown>>(
    input: KlaviyoReportRequest,
  ): Promise<T>;
};

function isKlaviyoApiUrl(value: string): boolean {
  const url = new URL(value, KLAVIYO_API_BASE_URL);
  return (
    url.origin === new URL(KLAVIYO_API_BASE_URL).origin &&
    url.pathname.startsWith("/api/")
  );
}

function normalizeApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl.startsWith("http")) {
    return `${KLAVIYO_API_BASE_URL}/${pathOrUrl.replace(/^\/+/, "")}`;
  }
  const url = new URL(pathOrUrl, KLAVIYO_API_BASE_URL);
  if (!isKlaviyoApiUrl(url.toString())) {
    throw new Error("klaviyo_pagination_url_invalid");
  }
  return url.toString();
}

function errorCode(status: number): {
  code: string;
  retryable: boolean;
  reauth: boolean;
} {
  if (status === 401)
    return { code: "REAUTHORIZATION_REQUIRED", retryable: false, reauth: true };
  if (status === 403)
    return { code: "PERMISSION_MISSING", retryable: false, reauth: false };
  if (status === 408 || status === 409 || status === 425 || status === 429)
    return { code: "RATE_LIMITED", retryable: true, reauth: false };
  if (status >= 500)
    return { code: "EXTERNAL_API_UNAVAILABLE", retryable: true, reauth: false };
  return {
    code: "EXTERNAL_RESOURCE_NOT_FOUND",
    retryable: false,
    reauth: false,
  };
}

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Espera antes del siguiente intento. Klaviyo documenta `Retry-After` en los
 * 429 y usa dos ventanas (burst por segundo y steady por minuto); el Reporting
 * API llega a 1/s y 2/min, asi que respetar la cabecera es obligatorio y el
 * backoff exponencial con jitter solo es el fallback cuando no viene.
 */
export function klaviyoRetryDelayMs(
  attempt: number,
  retryAfterHeader: string | null,
  jitter = Math.random(),
): number {
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, MAX_BACKOFF_MS);
  }
  const exponential = BASE_BACKOFF_MS * 2 ** attempt;
  return Math.min(exponential + jitter * BASE_BACKOFF_MS, MAX_BACKOFF_MS);
}

function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_BACKOFF_MS);
  }
  const date = Date.parse(header);
  return Number.isFinite(date)
    ? Math.max(0, Math.min(MAX_BACKOFF_MS, date - Date.now()))
    : null;
}

export function createKlaviyoClient(
  accessToken: string,
  options: {
    fetchImpl?: typeof fetch;
    revision?: string;
    sleepImpl?: (ms: number) => Promise<unknown>;
  } = {},
): KlaviyoClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const revision = options.revision ?? KLAVIYO_API_REVISION;
  const sleepImpl = options.sleepImpl ?? sleep;

  async function request<T>(
    pathOrUrl: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = normalizeApiUrl(pathOrUrl);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        const signal = init.signal
          ? AbortSignal.any([init.signal, controller.signal])
          : controller.signal;
        response = await fetchImpl(url, {
          ...init,
          signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
            revision,
            ...init.headers,
          },
        });
      } catch (error) {
        clearTimeout(timeout);
        lastError = new Error(
          `klaviyo_api_error:${error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "NETWORK"}`,
        );
        if (attempt === MAX_RETRIES) throw lastError;
        await sleepImpl(klaviyoRetryDelayMs(attempt, null));
        continue;
      } finally {
        clearTimeout(timeout);
      }

      if (response.ok) {
        return (await response.json()) as T;
      }

      const body = await response.text().catch(() => "");
      const classification = errorCode(response.status);
      lastError = new Error(
        `klaviyo_api_error:${classification.code}:${response.status}:${body.slice(0, 300)}`,
      );

      // 401/403/404 y errores de validacion no mejoran reintentando: el token,
      // el scope o el payload tienen que corregirse antes.
      if (!classification.retryable || attempt === MAX_RETRIES) {
        throw lastError;
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      await sleepImpl(
        retryAfterMs(retryAfterHeader) ??
          klaviyoRetryDelayMs(attempt, retryAfterHeader),
      );
    }

    throw lastError ?? new Error("klaviyo_api_error:retries_exhausted");
  }

  async function listAll<T>(
    path: string,
    listOptions: { maxPages?: number } = {},
  ) {
    const resources: Array<KlaviyoResource<T>> = [];
    let next: string | null = normalizeApiUrl(path);
    let pages = 0;
    const maxPages = listOptions.maxPages ?? 100;

    while (next && pages < maxPages) {
      const page: KlaviyoListResponse<T> =
        await request<KlaviyoListResponse<T>>(next);
      resources.push(...(page.data ?? []));
      next = page.links?.next ?? null;
      pages += 1;
    }

    if (next) throw new Error("klaviyo_pagination_limit_reached");
    return resources;
  }

  return {
    request,
    listAll,
    getAccount: async () => {
      const response = await request<KlaviyoListResponse>("/accounts");
      const account = response.data?.[0];
      if (!account) throw new Error("klaviyo_account_not_found");
      return account;
    },
    listResources: (resource) => listAll(`/${resource}`),
    queryReport: <T = Record<string, unknown>>(input: KlaviyoReportRequest) => {
      const endpoint = {
        "campaign-values-report": "campaign-values-reports",
        "flow-values-report": "flow-values-reports",
        "form-values-report": "form-values-reports",
        "segment-values-report": "segment-values-reports",
      }[input.type];
      const { type, ...attributes } = input;
      return request<T>(`/${endpoint}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { type, attributes } }),
      });
    },
  };
}
