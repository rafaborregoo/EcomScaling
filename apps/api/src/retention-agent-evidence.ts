type UnknownRow = Record<string, unknown>;

function rows(value: unknown): UnknownRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is UnknownRow => Boolean(item) && typeof item === "object");
}

function rowOrNull(value: unknown): UnknownRow | null {
  if (Array.isArray(value)) return value.find((item) => item && typeof item === "object") as UnknownRow | undefined ?? null;
  return value && typeof value === "object" ? value as UnknownRow : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function monthIndex(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12 ? year * 12 + month - 1 : null;
}

/**
 * Regla determinista previa al juicio de A20. Solo describe cobertura,
 * madurez y tamaño; no estima causalidad ni calcula tasas de recompra.
 */
export function buildRetentionAgentEvidenceGate({
  recurrence,
  cohorts,
  asOf = new Date().toISOString(),
  minimumCohortSize = 30,
}: {
  recurrence: unknown;
  cohorts: unknown;
  asOf?: string;
  minimumCohortSize?: number;
}) {
  const recurrenceRow = rowOrNull(recurrence);
  const newOrders = finiteNumber(recurrenceRow?.new_orders);
  const returningOrders = finiteNumber(recurrenceRow?.returning_orders);
  const unknownOrders = finiteNumber(recurrenceRow?.unknown_orders);
  const knownOrders = newOrders === null || returningOrders === null ? null : newOrders + returningOrders;
  const allOrders = knownOrders === null || unknownOrders === null ? null : knownOrders + unknownOrders;
  const unknownShare = allOrders && allOrders > 0 && unknownOrders !== null
    ? unknownOrders / allOrders
    : null;
  // Unknown customer identity changes the denominator: never present a rate
  // over known orders as the store-wide repeat-purchase rate.
  const repeatRateAssessable = knownOrders !== null && knownOrders > 0 && unknownOrders === 0;

  const asOfIndex = monthIndex(asOf);
  const byMonth = new Map<string, { cohortSize: number; monthIndex: number; offsets: Set<number> }>();
  for (const row of rows(cohorts)) {
    const index = monthIndex(row.cohort_month);
    const size = finiteNumber(row.cohort_customers);
    if (index === null || size === null) continue;
    const key = String(row.cohort_month).slice(0, 7);
    const entry = byMonth.get(key) ?? { cohortSize: size, monthIndex: index, offsets: new Set<number>() };
    entry.cohortSize = Math.max(entry.cohortSize, size);
    const offset = finiteNumber(row.month_offset);
    if (offset !== null && Number.isInteger(offset)) entry.offsets.add(offset);
    byMonth.set(key, entry);
  }

  const cohortMonths = [...byMonth.entries()].sort((a, b) => a[1].monthIndex - b[1].monthIndex);
  const maturity = cohortMonths.map(([cohortMonth, cohort]) => {
    const completeMonthsObserved = asOfIndex === null ? null : Math.max(0, asOfIndex - cohort.monthIndex - 1);
    return {
      cohort_month: cohortMonth,
      cohort_customers: cohort.cohortSize,
      complete_months_observed: completeMonthsObserved,
      sample_sufficient: cohort.cohortSize >= minimumCohortSize,
      offsets_with_orders: [...cohort.offsets].sort((a, b) => a - b),
    };
  });
  const comparableByAge = [1, 3, 6, 12].map((ageMonths) => ({
    age_months: ageMonths,
    eligible_cohorts: maturity.filter((cohort) =>
      cohort.sample_sufficient && cohort.complete_months_observed !== null && cohort.complete_months_observed >= ageMonths,
    ).length,
    comparison_ready: maturity.filter((cohort) =>
      cohort.sample_sufficient && cohort.complete_months_observed !== null && cohort.complete_months_observed >= ageMonths,
    ).length >= 2,
  }));
  const anyComparableAge = comparableByAge.some((entry) => entry.comparison_ready);

  return {
    status: recurrenceRow && cohortMonths.length
      ? repeatRateAssessable && anyComparableAge ? "descriptive_comparison_ready" : "limited_evidence"
      : "insufficient_evidence",
    period_repeat_rate: {
      assessable: repeatRateAssessable,
      unknown_orders_share: unknownShare,
      majority_unclassified: unknownShare !== null && unknownShare > 0.5,
      classified_orders_only: knownOrders !== null && knownOrders > 0 && unknownOrders !== null && unknownOrders > 0,
    },
    minimum_cohort_size: minimumCohortSize,
    comparable_by_age: comparableByAge,
    cohorts: maturity.slice(-12),
    constraints: [
      "Este gate comprueba madurez, volumen y pedidos sin clasificar; no demuestra causa ni calcula retención acumulada.",
      "No tratar cohortes no maduras o por debajo del tamaño mínimo como tendencia.",
      "Una cohorte sin fila de compra en un offset no demuestra por sí sola que ningún cliente haya repetido antes o después.",
      "La cohorte se basa en el primer pedido observado en el historial sincronizado; no garantiza que el historial cubra toda la vida de la tienda.",
    ],
  } as const;
}
