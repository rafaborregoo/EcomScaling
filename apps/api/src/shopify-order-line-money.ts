export type ShopifyDiscountAllocationAmount = {
  allocatedAmountSet?: {
    shopMoney?: { amount?: string | number | null } | null;
  } | null;
};

function amountOrZero(value: string | number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/** Returns the actual discounts allocated to a line, in the shop currency. */
export function sumShopifyLineDiscountAllocations(
  allocations:
    | readonly ShopifyDiscountAllocationAmount[]
    | null
    | undefined,
) {
  return (allocations ?? []).reduce(
    (total, allocation) =>
      total + amountOrZero(allocation.allocatedAmountSet?.shopMoney?.amount),
    0,
  );
}
