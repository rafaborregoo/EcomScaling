export const KNOWLEDGE_CATALOG_PAGE_SIZE = 200;
export const KNOWLEDGE_CATALOG_MAX_DOCUMENTS = 1000;
export const KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT = 16;

export type KnowledgeCatalogDocument = {
  id: string;
  title: string;
  description: string | null;
  source_type: string;
  visibility: string;
  audience: string;
  embedding_model: string | null;
  version?: number;
  checksum?: string;
  store_id?: string | null;
  updated_at: string;
};

function compareFreshness(left: KnowledgeCatalogDocument, right: KnowledgeCatalogDocument) {
  const leftTime = Date.parse(left.updated_at);
  const rightTime = Date.parse(right.updated_at);
  const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
  const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
  return safeRightTime - safeLeftTime || left.id.localeCompare(right.id);
}

/**
 * Keep the full coverage counters, but send only a bounded, stratified sample
 * of metadata to the model. This avoids turning a large catalog into a huge
 * prompt and makes it impossible to mistake the inspected sample for the
 * complete catalog.
 */
export function buildKnowledgeCatalogPromptContext<T extends {
  documents: KnowledgeCatalogDocument[];
  total: number | null;
  coverage_status: "complete" | "coverage_incomplete";
  truncated: boolean;
}>(catalog: T) {
  const groups = new Map<string, KnowledgeCatalogDocument[]>();
  for (const document of [...catalog.documents].sort(compareFreshness)) {
    const key = [document.visibility, document.audience, document.source_type].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(document);
    groups.set(key, group);
  }

  const orderedGroups = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, documents]) => documents);
  const selected: KnowledgeCatalogDocument[] = [];
  for (let index = 0; selected.length < KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT; index += 1) {
    let addedInRound = false;
    for (const group of orderedGroups) {
      const document = group[index];
      if (!document) continue;
      selected.push(document);
      addedInRound = true;
      if (selected.length >= KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT) break;
    }
    if (!addedInRound) break;
  }

  const documents = selected.map((document) => ({
    id: document.id,
    title: document.title.slice(0, 160),
    description: document.description?.slice(0, 120) ?? null,
    source_type: document.source_type.slice(0, 60),
    visibility: document.visibility.slice(0, 40),
    audience: document.audience.slice(0, 40),
    embedding_model: document.embedding_model?.slice(0, 80) ?? null,
    ...(typeof document.version === "number" ? { version: document.version } : {}),
    ...(typeof document.checksum === "string" ? { checksum: document.checksum.slice(0, 64) } : {}),
    ...(document.store_id ? { store_id: document.store_id } : {}),
    updated_at: document.updated_at,
  }));

  return {
    ...catalog,
    documents,
    document_sample: {
      included_documents: documents.length,
      available_documents: catalog.documents.length,
      sample_limit: KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT,
      selection: "round_robin_by_visibility_audience_source_type_then_freshness",
      truncated: documents.length < catalog.documents.length,
      catalog_coverage_status: catalog.coverage_status,
    },
  };
}

export async function loadKnowledgeCatalogPages(
  fetchPage: (cursor: string | null, limit: number) => Promise<{
    documents: KnowledgeCatalogDocument[] | null;
    total: number | null;
    error: unknown | null;
  }>,
) {
  const documents: KnowledgeCatalogDocument[] = [];
  let total: number | null = null;
  let pagesRead = 0;
  let failure: unknown | null = null;
  let cursor: string | null = null;
  let failureCursor: string | null = null;
  const seen = new Set<string>();

  while (documents.length < KNOWLEDGE_CATALOG_MAX_DOCUMENTS) {
    const requestedCursor = cursor;
    let page: Awaited<ReturnType<typeof fetchPage>>;
    try {
      page = await fetchPage(requestedCursor, Math.min(
        KNOWLEDGE_CATALOG_PAGE_SIZE,
        KNOWLEDGE_CATALOG_MAX_DOCUMENTS - documents.length,
      ));
    } catch (error) {
      failure = error;
      failureCursor = requestedCursor;
      break;
    }
    pagesRead += 1;
    if (total === null && typeof page.total === "number" && Number.isFinite(page.total)) {
      total = page.total;
    }
    if (page.error || !page.documents) {
      failure = page.error ?? new Error("knowledge_catalog_page_missing");
      failureCursor = requestedCursor;
      break;
    }
    const freshDocuments = page.documents.filter((document) => {
      if (!document.id || seen.has(document.id)) return false;
      seen.add(document.id);
      return true;
    });
    if (freshDocuments.length !== page.documents.length) {
      failure = new Error("knowledge_catalog_cursor_overlap");
      failureCursor = requestedCursor;
    }
    documents.push(...freshDocuments);
    cursor = freshDocuments.at(-1)?.id ?? cursor;
    if (failure) break;
    if (total !== null && documents.length >= total) break;
    if (page.documents.length === 0 && total !== null && documents.length < total) {
      failure = new Error("knowledge_catalog_short_page_before_total");
      failureCursor = requestedCursor;
      break;
    }
    if (page.documents.length < KNOWLEDGE_CATALOG_PAGE_SIZE && (total === null || total <= documents.length)) break;
  }

  const exhaustedByCount = total !== null && documents.length >= total;
  const nextCursor = failure ? failureCursor : exhaustedByCount ? null : cursor;
  const truncated = nextCursor !== null || total === null || total > documents.length;
  return {
    documents,
    total,
    pages_read: pagesRead,
    page_size: KNOWLEDGE_CATALOG_PAGE_SIZE,
    next_cursor: nextCursor,
    cursor_kind: "document_id",
    truncated,
    coverage_status: failure || total === null || truncated ? "coverage_incomplete" as const : "complete" as const,
    failure_code: failure ? "catalog_page_load_failed" as const : null,
  };
}
