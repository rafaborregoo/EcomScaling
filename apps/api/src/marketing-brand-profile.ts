import { z } from "zod";

const optionalText = (max: number) => z.string().max(max).nullable().optional();
const textList = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).nullable().optional();
const safeLogoUrl = z.string().url().max(1000).refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}).nullable().optional();

export const marketingBrandProfileInputSchema = z.object({
  store_connection_id: z.string().uuid().nullable().optional(),
  brand_name: optionalText(120),
  logo_url: safeLogoUrl,
  palette: z.record(z.string().max(40), z.string().regex(/^#[0-9a-fA-F]{6}$/))
    .superRefine((palette, ctx) => {
      if (Object.keys(palette).length > 12) {
        ctx.addIssue({ code: "custom", message: "palette_too_large" });
      }
    })
    .nullable()
    .optional(),
  available_fonts: textList(12, 80),
  tone_guidelines: optionalText(2000),
  preferred_vocabulary: textList(30, 120),
  avoided_vocabulary: textList(30, 120),
  required_texts: textList(20, 2000),
  claim_restrictions: textList(30, 500),
  image_guidelines: optionalText(2000),
  legal_footer: optionalText(2000),
}).strict();

export type MarketingBrandProfileInput = z.infer<typeof marketingBrandProfileInputSchema>;

export const MARKETING_BRAND_PROFILE_FIELDS = [
  "brand_name",
  "logo_url",
  "palette",
  "available_fonts",
  "tone_guidelines",
  "preferred_vocabulary",
  "avoided_vocabulary",
  "required_texts",
  "claim_restrictions",
  "image_guidelines",
  "legal_footer",
] as const;

export type MarketingBrandProfileValues = Partial<
  Record<(typeof MARKETING_BRAND_PROFILE_FIELDS)[number], unknown>
>;

export type ResolvedMarketingBrandProfile = {
  profile: Record<string, unknown> | null;
  resolved_from: "store_and_organization" | "store" | "organization" | "none";
  missing_fields: string[];
};

/**
 * Merge a store override over its organization's defaults. `null` means
 * inherit; explicit empty arrays/objects/strings remain deliberate overrides.
 * Only the public brand fields cross this boundary (never ids or editor data).
 */
export function resolveMarketingBrandProfile(
  organizationProfile: MarketingBrandProfileValues | null,
  storeProfile: MarketingBrandProfileValues | null,
): ResolvedMarketingBrandProfile {
  const merged: Record<string, unknown> = {};
  for (const field of MARKETING_BRAND_PROFILE_FIELDS) {
    const storeValue = storeProfile?.[field];
    const organizationValue = organizationProfile?.[field];
    const value = storeValue ?? organizationValue;
    if (value !== null && value !== undefined) merged[field] = value;
  }

  const hasStore = MARKETING_BRAND_PROFILE_FIELDS.some(
    (field) => storeProfile?.[field] !== null && storeProfile?.[field] !== undefined,
  );
  const hasOrganization = MARKETING_BRAND_PROFILE_FIELDS.some(
    (field) => organizationProfile?.[field] !== null && organizationProfile?.[field] !== undefined,
  );
  const resolved_from = hasStore && hasOrganization
    ? "store_and_organization"
    : hasStore
      ? "store"
      : hasOrganization
        ? "organization"
        : "none";

  return {
    profile: Object.keys(merged).length > 0 ? merged : null,
    resolved_from,
    missing_fields: MARKETING_BRAND_PROFILE_FIELDS.filter(
      (field) => merged[field] === undefined,
    ),
  };
}
