/** Deterministic pilot gate. Numeric thresholds are review signals, never purchase instructions. */
export type A06InventoryChange = {
  inventory_state_id: string;
  product_id: string;
  variant_id: string;
  location_id: string;
  previous_quantity: number | null;
  available_quantity: number | null;
  observed_at: string;
};
export type A06EventProduct = {
  product_id: string | null;
  available_quantity: number | null;
  inventory_status: string;
  inventory_sync_is_stale: boolean;
  stock_coverage_sample_sufficient: boolean;
  average_daily_sales: number | null;
  days_of_cover: number | null;
  quantity_sold_in_period?: number | null;
  period_days?: number;
};
export type A06EventSignal = {
  product_id: string;
  reason: "location_empty" | "coverage_crossed" | "coverage_critical";
  inventory_state_id?: string;
  days_of_cover: number | null;
  previous_days_of_cover: number | null;
  threshold_days: number;
};

export function evaluateA06StockEvent(
  changes: readonly A06InventoryChange[],
  products: readonly A06EventProduct[],
  coverageReviewDays: number,
) {
  if (
    !Number.isFinite(coverageReviewDays) ||
    coverageReviewDays < 0.25 ||
    coverageReviewDays > 90
  )
    throw new Error("a06_invalid_coverage_threshold");
  const signals: A06EventSignal[] = [];
  const abstentions: Array<{ product_id: string; reason: string }> = [];
  const byProduct = new Map<string, A06InventoryChange[]>();
  for (const change of changes)
    byProduct.set(change.product_id, [
      ...(byProduct.get(change.product_id) ?? []),
      change,
    ]);
  const productMap = new Map(
    products.map((product) => [product.product_id, product]),
  );
  for (const [productId, levels] of byProduct) {
    const product = productMap.get(productId);
    if (
      !product ||
      product.inventory_status !== "tracked_current" ||
      product.inventory_sync_is_stale ||
      product.available_quantity === null ||
      levels.some((level) => level.available_quantity === null)
    ) {
      abstentions.push({
        product_id: productId,
        reason: "inventory_unreliable_or_product_outside_sample",
      });
      continue;
    }
    const emptied = levels.filter(
      (level) =>
        level.available_quantity! <= 0 &&
        (level.previous_quantity === null || level.previous_quantity > 0),
    );
    for (const level of emptied)
      signals.push({
        product_id: productId,
        reason: "location_empty",
        inventory_state_id: level.inventory_state_id,
        days_of_cover: product.days_of_cover,
        previous_days_of_cover: null,
        threshold_days: coverageReviewDays,
      });
    if (
      !product.stock_coverage_sample_sufficient ||
      product.average_daily_sales === null ||
      product.average_daily_sales <= 0 ||
      product.days_of_cover === null
    ) {
      abstentions.push({
        product_id: productId,
        reason: "demand_sample_insufficient",
      });
      continue;
    }
    const baselineKnown = levels.every(
      (level) => level.previous_quantity !== null,
    );
    const netDecrease = levels.reduce(
      (sum, level) =>
        sum +
        (level.previous_quantity ?? level.available_quantity!) -
        level.available_quantity!,
      0,
    );
    if ((baselineKnown && netDecrease <= 0) || emptied.length) continue;
    const velocity =
      product.quantity_sold_in_period != null &&
      product.period_days &&
      product.period_days > 0
        ? product.quantity_sold_in_period / product.period_days
        : product.average_daily_sales;
    const currentCover = product.available_quantity / velocity;
    const previousCover = baselineKnown
      ? (product.available_quantity + netDecrease) / velocity
      : null;
    const criticalDays = Math.min(1, coverageReviewDays);
    const reason =
      currentCover <= criticalDays &&
      (previousCover === null || previousCover > criticalDays)
        ? "coverage_critical"
        : currentCover <= coverageReviewDays &&
            (previousCover === null || previousCover > coverageReviewDays)
          ? "coverage_crossed"
          : null;
    if (reason)
      signals.push({
        product_id: productId,
        reason,
        days_of_cover: Math.round(currentCover * 10) / 10,
        previous_days_of_cover:
          previousCover === null ? null : Math.round(previousCover * 10) / 10,
        threshold_days: coverageReviewDays,
      });
  }
  const signature = signals.length
    ? signals
        .map((s) => `${s.product_id}:${s.reason}:${s.inventory_state_id ?? ""}`)
        .sort()
        .join("|")
    : null;
  return { shouldReview: signals.length > 0, signals, abstentions, signature };
}

export function a06StockEventExamples() {
  const productId = "11111111-1111-4111-8111-111111111106";
  const base: A06InventoryChange = {
    inventory_state_id: "level-1",
    product_id: productId,
    variant_id: "variant-1",
    location_id: "location-1",
    previous_quantity: 30,
    available_quantity: 20,
    observed_at: "2026-10-29T08:00:00Z",
  };
  const scenarios = [
    {
      id: "slow",
      label: "30 → 20; vende 1 unidad al día",
      before: 30,
      after: 20,
      daily: 1,
      threshold: 3,
      expected: false,
    },
    {
      id: "fast",
      label: "30 → 20; vende 8 unidades al día",
      before: 30,
      after: 20,
      daily: 8,
      threshold: 3,
      expected: true,
    },
    {
      id: "sale10",
      label: "30 → 10; vende 4 unidades al día",
      before: 30,
      after: 10,
      daily: 4,
      threshold: 3,
      expected: true,
    },
    {
      id: "restock",
      label: "10 → 30; aumenta el stock",
      before: 10,
      after: 30,
      daily: 4,
      threshold: 3,
      expected: false,
    },
    {
      id: "empty",
      label: "4 → 0; se agota una ubicación",
      before: 4,
      after: 0,
      daily: 1,
      threshold: 3,
      expected: true,
    },
    {
      id: "relative",
      label: "30 → 20; umbral de revisión configurado en 14 días",
      before: 30,
      after: 20,
      daily: 2,
      threshold: 14,
      expected: true,
    },
    {
      id: "already_low",
      label: "8 → 7; sigue dentro de la misma franja de riesgo",
      before: 8,
      after: 7,
      daily: 4,
      threshold: 3,
      expected: false,
    },
  ];
  return scenarios.map((s) => ({
    ...s,
    result: evaluateA06StockEvent(
      [{ ...base, previous_quantity: s.before, available_quantity: s.after }],
      [
        {
          product_id: productId,
          available_quantity: s.after,
          inventory_status: "tracked_current",
          inventory_sync_is_stale: false,
          stock_coverage_sample_sufficient: true,
          average_daily_sales: s.daily,
          days_of_cover: Math.round((s.after / s.daily) * 10) / 10,
        },
      ],
      s.threshold,
    ),
  }));
}
