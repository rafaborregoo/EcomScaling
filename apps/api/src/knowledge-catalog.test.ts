import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKnowledgeCatalogPromptContext,
  KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT,
  loadKnowledgeCatalogPages,
} from "./knowledge-catalog.js";

function documents(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `doc-${String(index).padStart(4, "0")}`,
    title: `Doc ${index}`,
    description: null,
    source_type: "manual",
    visibility: index % 2 ? "organization" : "global",
    audience: "client_visible",
    embedding_model: "test-model",
    updated_at: "2026-09-27T00:00:00Z",
  }));
}

test("pagina mas de 200 documentos y devuelve un catalogo completo", async () => {
  const all = documents(201);
  const result = await loadKnowledgeCatalogPages(async (cursor, limit) => {
    const offset = cursor ? all.findIndex((item) => item.id === cursor) + 1 : 0;
    return {
    documents: all.slice(offset, offset + limit),
    total: all.length,
    error: null,
    };
  });
  assert.equal(result.documents.length, 201);
  assert.equal(result.pages_read, 2);
  assert.equal(result.coverage_status, "complete");
  assert.equal(result.next_cursor, null);
});

test("continua si un servidor devuelve una pagina corta pero el total dice que faltan documentos", async () => {
  const all = documents(250);
  let calls = 0;
  const result = await loadKnowledgeCatalogPages(async (cursor) => {
    calls += 1;
    const offset = cursor ? all.findIndex((item) => item.id === cursor) + 1 : 0;
    const limit = calls === 1 ? 50 : 200;
    return { documents: all.slice(offset, offset + limit), total: all.length, error: null };
  });
  assert.equal(result.documents.length, 250);
  assert.equal(result.pages_read, 2);
  assert.equal(result.coverage_status, "complete");
});

test("cap de seguridad informa truncamiento y cursor explicito", async () => {
  const all = documents(1250);
  const result = await loadKnowledgeCatalogPages(async (cursor, limit) => {
    const offset = cursor ? all.findIndex((item) => item.id === cursor) + 1 : 0;
    return {
    documents: all.slice(offset, offset + limit),
    total: all.length,
    error: null,
    };
  });
  assert.equal(result.documents.length, 1000);
  assert.equal(result.pages_read, 5);
  assert.equal(result.coverage_status, "coverage_incomplete");
  assert.equal(result.truncated, true);
  assert.equal(result.next_cursor, "doc-0999");
});

test("un error en una pagina devuelve cobertura incompleta y conserva lo leido", async () => {
  const all = documents(201);
  const result = await loadKnowledgeCatalogPages(async (cursor, limit) => cursor
    ? { documents: null, total: null, error: new Error("db down") }
    : { documents: all.slice(0, limit), total: all.length, error: null });
  assert.equal(result.documents.length, 200);
  assert.equal(result.coverage_status, "coverage_incomplete");
  assert.equal(result.failure_code, "catalog_page_load_failed");
  assert.equal(result.next_cursor, "doc-0199");
});

test("el contexto A08 mantiene cobertura completa y limita la muestra por segmento", () => {
  const all = documents(240).map((document, index) => ({
    ...document,
    title: `Título ${index}`.repeat(40),
    description: `Descripción ${index}`.repeat(100),
    visibility: index % 2 ? "organization" : "global",
    audience: index % 3 ? "client_visible" : "consultant_only",
    source_type: index % 4 ? "manual" : "imported",
    updated_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
  }));
  const context = buildKnowledgeCatalogPromptContext({
    documents: all,
    total: all.length,
    coverage_status: "complete" as const,
    truncated: false,
    indexed_documents: 230,
  });

  assert.equal(context.documents.length, KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT);
  assert.equal(context.document_sample.available_documents, 240);
  assert.equal(context.document_sample.included_documents, KNOWLEDGE_CATALOG_PROMPT_SAMPLE_LIMIT);
  assert.equal(context.document_sample.truncated, true);
  assert.equal(context.document_sample.catalog_coverage_status, "complete");
  assert.equal(context.coverage_status, "complete");
  assert.equal(context.total, 240);
  assert.equal(context.indexed_documents, 230);
  assert.ok(context.documents.every((document) => document.title.length <= 180));
  assert.ok(context.documents.every((document) => (document.description?.length ?? 0) <= 240));
  assert.ok(new Set(context.documents.map((document) => document.visibility)).size > 1);
  assert.ok(new Set(context.documents.map((document) => document.audience)).size > 1);
  assert.ok(new Set(context.documents.map((document) => document.source_type)).size > 1);
});
