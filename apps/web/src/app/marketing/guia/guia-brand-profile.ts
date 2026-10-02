/**
 * Guía de marca: contrato, fusión org → tienda, validación y el probador de
 * textos. Sin React ni fetch para poder probarse aislado; mira los mismos
 * límites que apps/api/src/marketing-brand-profile.ts (marketingBrandProfileInputSchema)
 * para que un valor que el API rechaza ya se vea marcado aquí antes de guardar.
 */

export const BRAND_PROFILE_FIELDS = [
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

export type BrandProfileField = (typeof BRAND_PROFILE_FIELDS)[number];

export type BrandProfile = {
  brand_name: string | null;
  logo_url: string | null;
  palette: Record<string, string> | null;
  available_fonts: string[] | null;
  tone_guidelines: string | null;
  preferred_vocabulary: string[] | null;
  avoided_vocabulary: string[] | null;
  required_texts: string[] | null;
  claim_restrictions: string[] | null;
  image_guidelines: string | null;
  legal_footer: string | null;
};

export const FIELD_LABEL: Record<BrandProfileField, string> = {
  brand_name: "Nombre de marca",
  logo_url: "Logo",
  palette: "Colores",
  available_fonts: "Tipografías",
  tone_guidelines: "Voz y tono",
  preferred_vocabulary: "Palabras que usamos",
  avoided_vocabulary: "Palabras que evitamos",
  required_texts: "Textos obligatorios",
  claim_restrictions: "Lo que no podemos afirmar",
  image_guidelines: "Dirección de imagen",
  legal_footer: "Pie legal",
};

type TextLimit = { kind: "text"; max: number };
type ListLimit = { kind: "list"; maxItems: number; maxLength: number };
export const FIELD_LIMIT: Record<BrandProfileField, TextLimit | ListLimit | null> = {
  brand_name: { kind: "text", max: 120 },
  logo_url: { kind: "text", max: 1000 },
  palette: null, // regla propia: como mucho 12 pares rol/hex, validada en validateBrandProfile
  available_fonts: { kind: "list", maxItems: 12, maxLength: 80 },
  tone_guidelines: { kind: "text", max: 2000 },
  preferred_vocabulary: { kind: "list", maxItems: 30, maxLength: 120 },
  avoided_vocabulary: { kind: "list", maxItems: 30, maxLength: 120 },
  required_texts: { kind: "list", maxItems: 20, maxLength: 2000 },
  claim_restrictions: { kind: "list", maxItems: 30, maxLength: 500 },
  image_guidelines: { kind: "text", max: 2000 },
  legal_footer: { kind: "text", max: 2000 },
};
export const PALETTE_MAX_ROLES = 12;

export const PALETTE_ROLE_LABEL: Record<string, string> = {
  primary: "Principal",
  accent: "Acento",
  text: "Texto",
  background: "Fondo",
  button: "Botón",
  button_text: "Texto del botón",
  card: "Tarjeta",
  link: "Enlaces",
  secondary: "Secundario",
};

export function emptyBrandProfile(): BrandProfile {
  return {
    brand_name: null,
    logo_url: null,
    palette: null,
    available_fonts: null,
    tone_guidelines: null,
    preferred_vocabulary: null,
    avoided_vocabulary: null,
    required_texts: null,
    claim_restrictions: null,
    image_guidelines: null,
    legal_footer: null,
  };
}

export function hasValue(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

export type MergedField<T> = { value: T | null; inherited: boolean };

/**
 * Fusiona org (base) con tienda (override). Un campo de tienda en `null`
 * hereda de la organización; `[]` o `""` en tienda es un vacío deliberado y
 * NO hereda. Mismo criterio que resolveMarketingBrandProfile en el API.
 */
export function mergeBrandProfile(
  org: BrandProfile,
  store: BrandProfile | null,
): Record<BrandProfileField, MergedField<unknown>> {
  const merged = {} as Record<BrandProfileField, MergedField<unknown>>;
  for (const field of BRAND_PROFILE_FIELDS) {
    const storeValue = store?.[field] ?? null;
    if (store && storeValue !== null) {
      merged[field] = { value: storeValue, inherited: false };
    } else {
      merged[field] = { value: org[field], inherited: store != null };
    }
  }
  return merged;
}

export function missingFields(
  org: BrandProfile,
  store: BrandProfile | null,
): BrandProfileField[] {
  const merged = mergeBrandProfile(org, store);
  return BRAND_PROFILE_FIELDS.filter((field) => !hasValue(merged[field].value));
}

const HEX_RE = /^#[0-9a-f]{6}$/i;
export function isHex(value: string): boolean {
  return HEX_RE.test(value);
}

function safeHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export type FieldErrors = Partial<Record<BrandProfileField, string>>;

/** Mismas reglas que marketingBrandProfileInputSchema (zod) del API. */
export function validateBrandProfile(profile: BrandProfile): FieldErrors {
  const errors: FieldErrors = {};
  if (profile.brand_name && profile.brand_name.length > 120) {
    errors.brand_name = "Máximo 120 caracteres.";
  }
  if (profile.logo_url) {
    if (profile.logo_url.length > 1000 || !safeHttpsUrl(profile.logo_url)) {
      errors.logo_url = "Tiene que ser una dirección https:// completa.";
    }
  }
  if (profile.palette) {
    const entries = Object.entries(profile.palette);
    if (entries.length > PALETTE_MAX_ROLES) {
      errors.palette = `Como mucho ${PALETTE_MAX_ROLES} colores.`;
    } else if (entries.some(([, hex]) => !isHex(hex))) {
      errors.palette = "Cada color necesita un código de 6 cifras, como #2F4A3A.";
    }
  }
  for (const field of ["tone_guidelines", "image_guidelines", "legal_footer"] as const) {
    const limit = FIELD_LIMIT[field] as TextLimit;
    const value = profile[field];
    if (value && value.length > limit.max) errors[field] = `Máximo ${limit.max} caracteres.`;
  }
  for (const field of [
    "available_fonts",
    "preferred_vocabulary",
    "avoided_vocabulary",
    "required_texts",
    "claim_restrictions",
  ] as const) {
    const limit = FIELD_LIMIT[field] as ListLimit;
    const value = profile[field];
    if (!value) continue;
    if (value.length > limit.maxItems) errors[field] = `Como mucho ${limit.maxItems} elementos.`;
    else if (value.some((item) => item.length > limit.maxLength)) {
      errors[field] = `Cada elemento admite ${limit.maxLength} caracteres como mucho.`;
    }
  }
  return errors;
}

/** Contraste WCAG 2.x entre dos colores hex (relative luminance). */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastGrade = "ok" | "warn" | "bad";
export function contrastGrade(ratio: number): ContrastGrade {
  if (ratio >= 4.5) return "ok";
  if (ratio >= 3) return "warn";
  return "bad";
}

/** Color de texto legible (blanco o casi negro) sobre un fondo dado. */
export function readableTextColor(backgroundHex: string): string {
  return contrastRatio(backgroundHex, "#ffffff") >= contrastRatio(backgroundHex, "#111111")
    ? "#ffffff"
    : "#111111";
}

/** Extrae las frases «entre comillas» de una restricción, para el probador. */
export function quotedPhrases(text: string): string[] {
  const matches = [...text.matchAll(/[«"“]([^»"”]{2,80})[»"”]/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

export type TextMatch = { start: number; end: number; kind: "avoid" | "claim" | "preferred" };
export type TextAnalysis = {
  matches: TextMatch[];
  hitAvoided: string[];
  hitClaims: Array<{ phrase: string; rule: string }>;
  hitPreferred: string[];
  missingRequired: string[];
};

function findAll(text: string, needle: string): Array<[number, number]> {
  if (!needle) return [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(/^\w/.test(needle) ? `\\b${escaped}` : escaped, "gi");
  return [...text.matchAll(re)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
}

/**
 * Comprueba un texto contra la guía: palabras evitadas, afirmaciones que las
 * restricciones vetan (lo que va entre comillas en claim_restrictions),
 * textos obligatorios ausentes y palabras preferidas ya usadas. Corre en el
 * navegador, sin IA.
 */
export function analyzeText(
  text: string,
  guide: {
    preferred: string[];
    avoided: string[];
    claimRestrictions: string[];
    requiredTexts: string[];
  },
): TextAnalysis {
  const matches: TextMatch[] = [];
  const hitAvoided = guide.avoided.filter((word) => {
    const hits = findAll(text, word);
    hits.forEach(([start, end]) => matches.push({ start, end, kind: "avoid" }));
    return hits.length > 0;
  });
  const claimPairs = guide.claimRestrictions.flatMap((rule) =>
    quotedPhrases(rule).map((phrase) => ({ phrase, rule })),
  );
  const hitClaims = claimPairs.filter(({ phrase }) => {
    const hits = findAll(text, phrase);
    hits.forEach(([start, end]) => matches.push({ start, end, kind: "claim" }));
    return hits.length > 0;
  });
  const hitPreferred = guide.preferred.filter((word) => {
    const hits = findAll(text, word);
    hits.forEach(([start, end]) => matches.push({ start, end, kind: "preferred" }));
    return hits.length > 0;
  });
  const lowerText = text.toLowerCase();
  const missingRequired = guide.requiredTexts.filter(
    (required) => required && !lowerText.includes(required.toLowerCase().replace(/\.$/, "")),
  );
  matches.sort((a, b) => a.start - b.start);
  // descarta solapes: el primer match que empieza gana el tramo
  const resolved: TextMatch[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    resolved.push(match);
    cursor = match.end;
  }
  return { matches: resolved, hitAvoided, hitClaims, hitPreferred, missingRequired };
}

const SAFE_EMAIL_FONTS = new Set([
  "arial",
  "helvetica",
  "georgia",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "times new roman",
  "courier new",
  "serif",
  "sans-serif",
]);
export function isEmailSafeFont(name: string): boolean {
  return SAFE_EMAIL_FONTS.has(name.trim().toLowerCase());
}

/** Convierte el estado del formulario (siempre arrays) en lo que espera el PUT. */
export function toApiPayload(profile: BrandProfile, { isStoreScope }: { isStoreScope: boolean }) {
  const clean = <T extends string>(list: T[] | null) => {
    const trimmed = (list ?? []).map((item) => item.trim()).filter(Boolean);
    return trimmed.length > 0 ? trimmed : isStoreScope ? [] : null;
  };
  const cleanText = (value: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed || (isStoreScope ? "" : null);
  };
  return {
    brand_name: cleanText(profile.brand_name),
    logo_url: profile.logo_url?.trim() || (isStoreScope ? "" : null),
    palette: profile.palette && Object.keys(profile.palette).length > 0
      ? profile.palette
      : isStoreScope ? {} : null,
    available_fonts: clean(profile.available_fonts),
    tone_guidelines: cleanText(profile.tone_guidelines),
    preferred_vocabulary: clean(profile.preferred_vocabulary),
    avoided_vocabulary: clean(profile.avoided_vocabulary),
    required_texts: clean(profile.required_texts),
    claim_restrictions: clean(profile.claim_restrictions),
    image_guidelines: cleanText(profile.image_guidelines),
    legal_footer: cleanText(profile.legal_footer),
  };
}

export function profileFromApi(value: unknown): BrandProfile {
  if (!value || typeof value !== "object") return emptyBrandProfile();
  const row = value as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : null);
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : null;
  const palette = (v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const entries = Object.entries(v as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  };
  return {
    brand_name: text(row.brand_name),
    logo_url: text(row.logo_url),
    palette: palette(row.palette),
    available_fonts: list(row.available_fonts),
    tone_guidelines: text(row.tone_guidelines),
    preferred_vocabulary: list(row.preferred_vocabulary),
    avoided_vocabulary: list(row.avoided_vocabulary),
    required_texts: list(row.required_texts),
    claim_restrictions: list(row.claim_restrictions),
    image_guidelines: text(row.image_guidelines),
    legal_footer: text(row.legal_footer),
  };
}
