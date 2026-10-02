export type DeliveryComparisonWindow = {
  period_start: string;
  period_end: string;
};

/** Equal, adjacent windows for carrier diagnostics, ending at one shared as-of. */
export function buildDeliveryComparisonWindows(
  end: Date,
  windowDays: number,
) {
  if (!Number.isFinite(end.getTime())) throw new Error("invalid_window_end");
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) {
    throw new Error("invalid_window_days");
  }

  const durationMs = windowDays * 24 * 60 * 60 * 1000;
  const currentStart = new Date(end.getTime() - durationMs);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return {
    as_of: end.toISOString(),
    window_days: windowDays,
    current: {
      period_start: currentStart.toISOString(),
      period_end: end.toISOString(),
    } satisfies DeliveryComparisonWindow,
    previous: {
      period_start: previousStart.toISOString(),
      period_end: previousEnd.toISOString(),
    } satisfies DeliveryComparisonWindow,
  };
}
