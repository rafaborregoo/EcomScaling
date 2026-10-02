const METADATA_COLUMNS = /description_html|tags|shopify_category_id|shopify_category_name|metadata_coverage/i;

export function isMissingShopifyProductMetadataSchema(error: { code?: string; message?: string }) {
  return (error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205") &&
    METADATA_COLUMNS.test(error.message ?? "") &&
    /shopify_products|column|schema cache|table/i.test(error.message ?? "");
}

/** Convert merchant-authored HTML into safe text for UI and AI contexts. */
export function shopifyProductDescriptionText(value: unknown, limit = 4_000): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value
    .replace(/<(script|style|iframe|object|svg)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6]|section|article|blockquote)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : " ";
    })
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : " ";
    })
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, limit) : null;
}

export function normalizeShopifyProductTags(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(values.flatMap((item) =>
    typeof item === "string" && item.trim() ? [item.trim().slice(0, 255)] : [],
  ))].slice(0, 250);
}
