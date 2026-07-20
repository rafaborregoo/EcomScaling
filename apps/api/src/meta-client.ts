const META_GRAPH_VERSION = "v23.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;

// Codigos de error de rate limiting de la Graph API (ADR-0006: backoff desde el
// primer commit del cliente HTTP). 4 = app-level, 17 = user-level, 32 = page,
// 613 = custom rate limit de Marketing API, 80004 = ads insights throttling.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80004]);

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly httpStatus: number,
    public readonly fbtraceId: string | null,
  ) {
    super(message);
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

export async function metaGraphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);

  let lastError: MetaGraphError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }

    const response = await fetch(url.toString());
    const body = (await response.json().catch(() => null)) as (T & GraphErrorBody) | null;

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
      response.status === 429 || (graphError?.code != null && RATE_LIMIT_CODES.has(graphError.code));

    if (!isRateLimited) {
      throw lastError;
    }
  }

  throw lastError ?? new MetaGraphError("meta_graph_retries_exhausted", null, 0, null);
}

/**
 * Recorre todas las paginas de un edge con paging.next. Sin limite de paginas:
 * el import completo trae todo lo que la cuenta tenga (ADR-0006 punto 3).
 */
export async function metaGraphGetAll<TNode>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<TNode[]> {
  const nodes: TNode[] = [];
  let response = await metaGraphGet<{ data?: TNode[]; paging?: { next?: string } }>(
    path,
    accessToken,
    { limit: "100", ...params },
  );

  nodes.push(...(response.data ?? []));

  while (response.paging?.next) {
    const nextUrl = response.paging.next;
    const fetched = await fetch(nextUrl);
    const body = (await fetched.json().catch(() => null)) as
      | { data?: TNode[]; paging?: { next?: string }; error?: { message?: string; code?: number; fbtrace_id?: string } }
      | null;

    if (!fetched.ok || !body || body.error) {
      // El retry con backoff de metaGraphGet no aplica a la URL opaca de paging;
      // se relanza el edge desde el ultimo cursor via after= si esta disponible.
      throw new MetaGraphError(
        body?.error?.message ?? `meta_graph_paging_http_${fetched.status}`,
        body?.error?.code ?? null,
        fetched.status,
        body?.error?.fbtrace_id ?? null,
      );
    }

    nodes.push(...(body.data ?? []));
    response = body;
  }

  return nodes;
}
