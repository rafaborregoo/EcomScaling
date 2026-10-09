const CAMINO_REVIEW_STALE_AFTER_MS = 30 * 60 * 1000;
export const CAMINO_REVIEW_CADENCE_DAYS = 3;
const CAMINO_REVIEW_CADENCE_MS = CAMINO_REVIEW_CADENCE_DAYS * 24 * 60 * 60 * 1000;

/** Compatibility helper for older calendar-week review rows. */
export function caminoReviewWeekStart(date: Date): string {
  const monday = new Date(date);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

/** Stable UTC three-day bucket used to deduplicate Camino follow-up reviews. */
export function caminoReviewCycleStart(date: Date): string {
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const cycleStart = Math.floor(dayStart / CAMINO_REVIEW_CADENCE_MS) * CAMINO_REVIEW_CADENCE_MS;
  return new Date(cycleStart).toISOString().slice(0, 10);
}

/** First follow-up is due three days after the Camino was activated. */
export function isCaminoReviewDue(
  activatedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!activatedAt) return false;
  const timestamp = Date.parse(activatedAt);
  return Number.isFinite(timestamp) && now - timestamp >= CAMINO_REVIEW_CADENCE_MS;
}

/** Inclusive 7-calendar-day UTC windows for the current and prior Meta summaries. */
export function caminoReviewCalendarWindows(endDate: Date, windowDays = 7): {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
} {
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  const boundedWindowDays = Math.max(1, Math.floor(windowDays));
  const currentStart = new Date(end);
  currentStart.setUTCDate(currentStart.getUTCDate() - (boundedWindowDays - 1));
  const previousEnd = new Date(end);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - boundedWindowDays);
  const previousStart = new Date(end);
  previousStart.setUTCDate(previousStart.getUTCDate() - (boundedWindowDays * 2 - 1));
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
