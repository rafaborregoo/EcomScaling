const DAY_MS = 24 * 60 * 60 * 1000;

export type KlaviyoPerformanceWindow = {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
};

/** Validate an inclusive ISO-date range and derive its equally sized predecessor. */
export function parseKlaviyoPerformanceWindow(
  periodStart: unknown,
  periodEnd: unknown,
): KlaviyoPerformanceWindow | null {
  if (
    typeof periodStart !== "string" ||
    typeof periodEnd !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)
  ) return null;

  const startMs = Date.parse(`${periodStart}T00:00:00.000Z`);
  const endMs = Date.parse(`${periodEnd}T00:00:00.000Z`);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    new Date(startMs).toISOString().slice(0, 10) !== periodStart ||
    new Date(endMs).toISOString().slice(0, 10) !== periodEnd
  ) return null;

  const inclusiveDays = Math.floor((endMs - startMs) / DAY_MS) + 1;
  if (inclusiveDays < 1 || inclusiveDays > 90) return null;

  const previousEndMs = startMs - DAY_MS;
  const previousStartMs = previousEndMs - (inclusiveDays - 1) * DAY_MS;
  const date = (value: number) => new Date(value).toISOString().slice(0, 10);
  return {
    start: periodStart,
    end: periodEnd,
    previousStart: date(previousStartMs),
    previousEnd: date(previousEndMs),
  };
}
