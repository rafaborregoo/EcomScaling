/** Reads a provider currency from its normalized field or original API payload. */
export function providerCurrencyCode(
  normalized: unknown,
  rawData: unknown,
  providerField: string,
): string | null {
  const rawValue = rawData && typeof rawData === "object" && !Array.isArray(rawData)
    ? (rawData as Record<string, unknown>)[providerField]
    : null;
  for (const value of [normalized, rawValue]) {
    if (typeof value !== "string") continue;
    const code = value.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) return code;
  }
  return null;
}
