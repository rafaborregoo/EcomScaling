const ATTRIBUTION_COVERAGE = new Set([
  "complete",
  "partial",
  "unavailable",
]);

/**
 * Fail closed for old RPC deployments and orders whose allocations were not
 * captured. `order_discount_total` remains available as whole-order context,
 * but only a complete application allocation can be cited as code-level cost.
 */
export function normalizeShopifyDiscountAttributionRows(
  rows: unknown,
): Array<Record<string, any>> {
  if (!Array.isArray(rows)) return [];

  return rows.map((value) => {
    const row = value && typeof value === "object"
      ? value as Record<string, any>
      : {};
    const knownCoverage = typeof row.attribution_coverage === "string" &&
      ATTRIBUTION_COVERAGE.has(row.attribution_coverage)
      ? row.attribution_coverage
      : "migration_pending";
    const amount = row.attributed_discount_total;
    const exactAmount = knownCoverage === "complete" &&
      amount !== null && amount !== undefined &&
      Number.isFinite(Number(amount))
      ? Number(amount)
      : null;

    return {
      ...row,
      attributed_discount_total: exactAmount,
      attribution_coverage: exactAmount === null ? knownCoverage : "complete",
      discount_share: exactAmount === null ? null : row.discount_share ?? null,
      order_discount_total_note:
        "Total de todo el pedido; no es atribuible a este código y puede repetirse entre códigos.",
      order_revenue_note:
        "Ventas de pedidos que usaron el código; no son ventas causadas exclusivamente por él.",
    };
  });
}
