export type ShopifyDiscountAllocation = {
  allocatedAmountSet?: {
    shopMoney?: { amount?: string | null } | null;
  } | null;
  discountApplication?: { index?: number | null } | null;
};

/** Adds actual line and shipping allocations by the discount application index. */
export function aggregateShopifyDiscountAllocations(
  allocationGroups: Array<Array<ShopifyDiscountAllocation> | null | undefined>,
) {
  const amountByIndex = new Map<number, number>();

  for (const group of allocationGroups) {
    for (const allocation of group ?? []) {
      const index = allocation.discountApplication?.index;
      const amount = Number(allocation.allocatedAmountSet?.shopMoney?.amount);
      if (!Number.isInteger(index) || (index as number) < 0 || !Number.isFinite(amount)) {
        continue;
      }
      amountByIndex.set(index as number, (amountByIndex.get(index as number) ?? 0) + amount);
    }
  }

  return amountByIndex;
}
