import crypto from "node:crypto";

// `uuid:N` (email N de la secuencia) o `uuid:N:rK` (K=1..4, reintento tras un
// rechazo dentro del grafo de ADR-0025).
const SEQUENCE_IDEMPOTENCY_KEY =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([1-9][0-9]?)(:r[1-4])?$/i;

export type MarketingDraftIdempotencyInput = {
  contentType: string;
  channel: string;
  brief: string;
  storeConnectionId: string | null;
  templateIds: string[];
  baseDesignTemplateId: string | null;
  baseDesign: Record<string, unknown> | null;
  referenceImageUrls: string[];
  contentImageUrls: string[];
  brandColors: Record<string, string>;
  verbatimTexts: string[];
  caminoTaskContext?: Record<string, unknown>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

export function readMarketingDraftIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key.length <= 64 && SEQUENCE_IDEMPOTENCY_KEY.test(key)
    ? key.toLowerCase()
    : null;
}

export function fingerprintMarketingDraftRequest(
  input: MarketingDraftIdempotencyInput,
): string {
  const canonical = JSON.stringify(stableValue({
    contentType: input.contentType,
    channel: input.channel,
    brief: input.brief,
    storeConnectionId: input.storeConnectionId,
    templateIds: input.templateIds,
    baseDesignTemplateId: input.baseDesignTemplateId,
    baseDesign: input.baseDesign,
    referenceImageUrls: input.referenceImageUrls,
    contentImageUrls: input.contentImageUrls,
    brandColors: input.brandColors,
    verbatimTexts: input.verbatimTexts,
    ...(input.caminoTaskContext
      ? { caminoTaskContext: input.caminoTaskContext }
      : {}),
  }));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
