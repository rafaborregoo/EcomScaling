import { IntegrationError } from "@ecomscaling/integrations";
import crypto from "node:crypto";

/** Single source of truth for every Graph API request in the Meta adapter. */
const META_GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/;
const configuredMetaGraphVersion = process.env.META_GRAPH_VERSION?.trim();
export const META_GRAPH_VERSION =
  configuredMetaGraphVersion &&
  META_GRAPH_VERSION_PATTERN.test(configuredMetaGraphVersion)
    ? configuredMetaGraphVersion
    : "v23.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

// Codigos de error de rate limiting de la Graph API (ADR-0006: backoff desde el
// primer commit del cliente HTTP). 4 = app-level, 17 = user-level, 32 = page,
// 613 = custom rate limit de Marketing API, 80004 = ads insights throttling.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80004]);

export class MetaGraphError extends IntegrationError {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly httpStatus: number,
    public readonly fbtraceId: string | null,
  ) {
    super(
      httpStatus === 429 ||
        code === 4 ||
        code === 17 ||
        code === 32 ||
        code === 613 ||
        code === 80000 ||
        code === 80004
        ? "RATE_LIMITED"
        : "EXTERNAL_API_UNAVAILABLE",
      "meta_ads",
      message,
      httpStatus === 429 ||
        code === 4 ||
        code === 17 ||
        code === 32 ||
        code === 613 ||
        code === 80000 ||
        code === 80004,
      false,
      httpStatus,
      code == null ? undefined : String(code),
    );
    this.name = "MetaGraphError";
  }
}

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_BACKOFF_MS, seconds * 1_000);
  }
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(0, Math.min(MAX_BACKOFF_MS, date - Date.now()))
    : null;
}

// Backoff compartido por URL absoluta: lo usan tanto la primera peticion
// (metaGraphGet, URL propia con access_token en query) como el seguimiento de
// paginacion (metaGraphGetAll, URL opaca que Meta devuelve en paging.next) --
// antes solo la primera reintentaba, y una pagina intermedia con rate limit
// tumbaba el import completo en vez de reintentarse igual que el resto.
async function fetchGraphJsonWithRetry<T>(
  url: string,
): Promise<T & GraphErrorBody> {
  let lastError: MetaGraphError | null = null;
  let nextDelayMs = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (nextDelayMs > 0) await sleep(nextDelayMs);
    nextDelayMs = 0;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      clearTimeout(timeout);
      lastError = new MetaGraphError(
        error instanceof Error ? error.message : "meta_graph_network_error",
        null,
        error instanceof DOMException && error.name === "AbortError" ? 408 : 503,
        null,
      );
      if (attempt === MAX_RETRIES) throw lastError;
      nextDelayMs = Math.min(
        MAX_BACKOFF_MS,
        BASE_BACKOFF_MS * 2 ** attempt,
      );
      continue;
    } finally {
      clearTimeout(timeout);
    }
    const body = (await response.json().catch(() => null)) as
      (T & GraphErrorBody) | null;

    if (response.ok && body) {
      return body;
    }

    const graphError = body?.error;
    lastError = new MetaGraphError(
      graphError?.message ?? `meta_graph_http_${response.status}`,
      graphError?.code ?? null,
      response.status,
      graphError?.fbtrace_id ?? null,
    );

    const isRateLimited =
      response.status === 429 ||
      (graphError?.code != null && RATE_LIMIT_CODES.has(graphError.code));
    const isTransientHttp =
      response.status === 408 ||
      response.status === 425 ||
      response.status >= 500;

    if (!isRateLimited && !isTransientHttp) {
      throw lastError;
    }

    if (attempt < MAX_RETRIES) {
      const providerDelay = retryAfterMs(response);
      nextDelayMs =
        providerDelay ??
        Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
    }
  }

  throw (
    lastError ??
    new MetaGraphError("meta_graph_retries_exhausted", null, 0, null)
  );
}

export async function metaGraphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
  appSecret?: string,
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);
  if (appSecret) {
    url.searchParams.set(
      "appsecret_proof",
      crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex"),
    );
  }

  return fetchGraphJsonWithRetry<T>(url.toString());
}

/**
 * Recorre todas las paginas de un edge con paging.next. Sin limite de paginas:
 * el import completo trae todo lo que la cuenta tenga (ADR-0006 punto 3).
 */
export async function metaGraphGetAll<TNode>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
  appSecret?: string,
): Promise<TNode[]> {
  const nodes: TNode[] = [];
  let response = await metaGraphGet<{
    data?: TNode[];
    paging?: { next?: string };
  }>(path, accessToken, { limit: "100", ...params }, appSecret);

  nodes.push(...(response.data ?? []));

  while (response.paging?.next) {
    const nextUrl = new URL(response.paging.next);
    if (appSecret) {
      nextUrl.searchParams.set(
        "appsecret_proof",
        crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex"),
      );
    }
    const body = await fetchGraphJsonWithRetry<{
      data?: TNode[];
      paging?: { next?: string };
    }>(nextUrl.toString());

    nodes.push(...(body.data ?? []));
    response = body;
  }

  return nodes;
}
