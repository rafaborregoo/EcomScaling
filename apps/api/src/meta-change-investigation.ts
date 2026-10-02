export type MetaChangeInvestigationPeriod = {
  period_start: string;
  period_end: string;
};

export type MetaChangeInvestigationPeriodResult =
  | { ok: true; period: MetaChangeInvestigationPeriod }
  | { ok: false; reason: "invalid_period" | "period_out_of_bounds" };

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function validateMetaChangeInvestigationPeriod(
  input: Record<string, unknown>,
  now = new Date(),
): MetaChangeInvestigationPeriodResult {
  const start = input.period_start;
  const end = input.period_end;
  if (!isIsoDate(start) || !isIsoDate(end)) {
    return { ok: false, reason: "invalid_period" };
  }

  const today = now.toISOString().slice(0, 10);
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  const daysBetween = (endMs - startMs) / 86_400_000;
  const oldestAllowed = new Date(Date.parse(`${today}T00:00:00.000Z`) - 89 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  if (daysBetween < 0 || daysBetween > 30 || end > today || start < oldestAllowed) {
    return { ok: false, reason: "period_out_of_bounds" };
  }
  return {
    ok: true,
    period: { period_start: start, period_end: end },
  };
}
