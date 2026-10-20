import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "pgsql-ast-parser";
import {
  fingerprintMarketingDraftRequest,
  readMarketingDraftIdempotencyKey,
} from "./marketing-draft-idempotency.js";

const base = {
  contentType: "campaign",
  channel: "email_klaviyo",
  brief: "Semana de lanzamiento",
  storeConnectionId: "store-connection-1",
  templateIds: ["template-b", "template-a"],
  baseDesignTemplateId: null,
  baseDesign: null,
  referenceImageUrls: ["https://example.com/reference.png"],
  contentImageUrls: ["https://example.com/b.png", "https://example.com/a.png"],
  brandColors: { primary: "#123456", accent: "#abcdef" },
  verbatimTexts: ["Oferta válida hasta el domingo"],
};

test("solo acepta claves UUID de secuencia con número de email acotado", () => {
  const key = "550e8400-e29b-41d4-a716-446655440000:3";
  assert.equal(readMarketingDraftIdempotencyKey(key), key);
  assert.equal(readMarketingDraftIdempotencyKey(key.toUpperCase()), key);
  assert.equal(readMarketingDraftIdempotencyKey("550e8400-e29b-41d4-a716-446655440000:0"), null);
  assert.equal(readMarketingDraftIdempotencyKey("not-a-uuid:1"), null);
  assert.equal(readMarketingDraftIdempotencyKey("x".repeat(80)), null);
});

test("fingerprint is deterministic across object-key order", () => {
  const reordered = {
    ...base,
    brandColors: { accent: "#abcdef", primary: "#123456" },
  };
  assert.equal(
    fingerprintMarketingDraftRequest(base),
    fingerprintMarketingDraftRequest(reordered),
  );
});

test("fingerprint preserves ordered template and image inputs", () => {
  assert.notEqual(
    fingerprintMarketingDraftRequest(base),
    fingerprintMarketingDraftRequest({ ...base, templateIds: [...base.templateIds].reverse() }),
  );
  assert.notEqual(
    fingerprintMarketingDraftRequest(base),
    fingerprintMarketingDraftRequest({ ...base, contentImageUrls: [...base.contentImageUrls].reverse() }),
  );
  assert.notEqual(
    fingerprintMarketingDraftRequest(base),
    fingerprintMarketingDraftRequest({ ...base, referenceImageUrls: [] }),
  );
});

test("fingerprint canonicalizes nested JSON object keys", () => {
  const withDesign = { ...base, baseDesign: { blocks: [{ type: "text", content: "Hola" }] } };
  const reorderedDesign = { ...base, baseDesign: { blocks: [{ content: "Hola", type: "text" }] } };
  assert.equal(
    fingerprintMarketingDraftRequest(withDesign),
    fingerprintMarketingDraftRequest(reorderedDesign),
  );
});

test("fingerprint changes when the requested email meaning changes", () => {
  assert.notEqual(
    fingerprintMarketingDraftRequest(base),
    fingerprintMarketingDraftRequest({ ...base, brief: "Semana de rebajas" }),
  );
});

test("fingerprint distinguishes campaign source and mailing step", () => {
  const campaignSource = { campaign_id: "campaign-1", title: "Lanzamiento", starts_at: "2026-11-01T10:00:00Z" };
  assert.notEqual(
    fingerprintMarketingDraftRequest({ ...base, campaignSource }),
    fingerprintMarketingDraftRequest({ ...base, campaignSource: { ...campaignSource, campaign_id: "campaign-2" } }),
  );
  assert.notEqual(
    fingerprintMarketingDraftRequest({ ...base, mailingSequenceContext: { sequence_id: "sequence-1", email_number: 1 } }),
    fingerprintMarketingDraftRequest({ ...base, mailingSequenceContext: { sequence_id: "sequence-1", email_number: 2 } }),
  );
});

test("migration enforces one durable sequence/email key per organization", () => {
  const migration = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/migrations/20261115580000_a27_draft_idempotency.sql",
    ),
    "utf8",
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /unique index if not exists marketing_content_drafts_org_idempotency_uidx/i);
  assert.match(migration, /\(organization_id, idempotency_key\)/i);
  assert.match(migration, /where idempotency_key is not null/i);
  assert.ok(migration.includes("idempotency_fingerprint ~ '^[0-9a-f]{64}$'"));
  const parserSupportedSql = migration
    .replace(/alter table public\.marketing_content_drafts enable row level security;?/i, "")
    .replace(/comment on column [^\r\n]+\r?\n\s+'[^']*';/gi, "");
  assert.ok(parse(parserSupportedSql).length > 0, "constraint and index SQL must parse");
});
