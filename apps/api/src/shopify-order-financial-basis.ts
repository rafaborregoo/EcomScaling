/** A missing amount stays unknown; zero is a valid provider amount. */
export function shopifyMoneyAmount(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function shopifyOrderFinancialBasis(beforeReturns: unknown, currentTotal: unknown, refunds: number) {
  const totalBeforeReturns = shopifyMoneyAmount(beforeReturns);
  return {
    total_before_returns: totalBeforeReturns,
    net_sales: (totalBeforeReturns ?? shopifyMoneyAmount(currentTotal) ?? 0) - refunds,
  };
}

export function isMissingShopifyFinancialBasisSchema(message: string) {
  return message.includes("total_before_returns") && /does not exist|schema cache|could not find/i.test(message);
}

/** Keep ingestion working against the previous schema without double-subtracting returns. */
export function withoutShopifyFinancialBasis<T extends Record<string, unknown>>(row: T) {
  const { total_before_returns, ...legacy } = row;
  return total_before_returns === null || total_before_returns === undefined
    ? legacy
    : { ...legacy, current_total_price: total_before_returns };
}
