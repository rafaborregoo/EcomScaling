/** Shared deterministic demand signal for stock planning and product views. */
export type StockDemandForecast = {
  forecast30d: number | null;
  coverageDays: number | null;
  trend: number | null;
  weeks: number;
  sellingWeeks: number;
  quality: "strong" | "medium" | "limited" | "none";
  risk: "high" | "watch" | "covered" | "unknown" | "no_demand";
};

/**
 * Estimates 30-day demand from up to 12 complete weekly buckets. Recent weeks
 * receive more weight; a damped trend correction is capped at +/-12.5%.
 * Seasonal and promotion effects are deliberately excluded from this signal.
 */
export function forecastStockDemand(
  weeklyUnits: readonly number[] | null | undefined,
  available: number | null = null,
  tracked = false,
): StockDemandForecast {
  const values = (weeklyUnits ?? []).map((value) => Number.isFinite(value) ? Math.max(0, value) : 0).slice(-12);
  const weeks = values.length;
  const sellingWeeks = values.filter((value) => value > 0).length;
  const quality: StockDemandForecast["quality"] = weeks >= 8 && sellingWeeks >= 6
    ? "strong"
    : weeks >= 6 && sellingWeeks >= 3
      ? "medium"
      : weeks >= 3 && sellingWeeks > 0
        ? "limited"
        : "none";

  if (!weeks || !sellingWeeks || quality === "none") {
    return { forecast30d: null, coverageDays: null, trend: null, weeks, sellingWeeks, quality, risk: "no_demand" };
  }

  const recent = values.slice(-8);
  const weightedTotal = recent.reduce((total, value, index) => total + value * (index + 1), 0);
  const totalWeight = recent.reduce((total, _value, index) => total + index + 1, 0);
  const weeklyBaseline = weightedTotal / totalWeight;
  const mean = (items: number[]) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : null;
  const recentMean = mean(values.slice(-4));
  const priorMean = mean(values.slice(-8, -4));
  const trend = priorMean != null && priorMean > 0 && recentMean != null ? recentMean / priorMean - 1 : null;
  const adjustedWeekly = weeklyBaseline * (trend == null ? 1 : 1 + Math.max(-0.125, Math.min(0.125, trend * 0.5)));
  const forecast30d = Math.max(0, Math.round(adjustedWeekly * 30 / 7));
  const coverageDays = !tracked || available == null || adjustedWeekly <= 0 ? null : Math.max(0, available / (adjustedWeekly / 7));
  const risk: StockDemandForecast["risk"] = !tracked || available == null
    ? "unknown"
    : coverageDays == null
      ? (available <= 0 ? "high" : "no_demand")
      : coverageDays <= 7
        ? "high"
        : coverageDays <= 14
          ? "watch"
          : "covered";

  return { forecast30d, coverageDays, trend, weeks, sellingWeeks, quality, risk };
}
