const CAMINO_REVIEW_STALE_AFTER_MS = 30 * 60 * 1000;

/** UTC Monday used as the stable idempotency key for a calendar-week review. */
export function caminoReviewWeekStart(date: Date): string {
  const monday = new Date(date);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

/** Inclusive 7-calendar-day UTC windows for the current and prior Meta summaries. */
export function caminoReviewCalendarWindows(endDate: Date): {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
} {
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  const currentStart = new Date(end);
  currentStart.setUTCDate(currentStart.getUTCDate() - 6);
  const previousEnd = new Date(end);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 7);
  const previousStart = new Date(end);
  previousStart.setUTCDate(previousStart.getUTCDate() - 13);
  return {
    currentStart: currentStart.toISOString().slice(0, 10),
    currentEnd: end.toISOString().slice(0, 10),
    previousStart: previousStart.toISOString().slice(0, 10),
    previousEnd: previousEnd.toISOString().slice(0, 10),
  };
}

export function isCaminoReviewClaimStale(updatedAt: string | null, nowMs = Date.now()): boolean {
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
  return Number.isFinite(updatedAtMs) && nowMs - updatedAtMs > CAMINO_REVIEW_STALE_AFTER_MS;
}

/** A manual retry is available only after a failed run or an expired lease. */
export function canRetryCaminoReview(status: string, updatedAt: string | null, nowMs = Date.now()): boolean {
  return status === "failed" || (status === "running" && isCaminoReviewClaimStale(updatedAt, nowMs));
}
