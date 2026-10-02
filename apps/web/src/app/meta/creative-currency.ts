export type CreativeSpendRow = {
  spend: number;
  spend_currency: string | null;
};

export type CreativeSpendSummary = {
  totals: Array<{ currencyCode: string; amount: number }>;
  unknownCurrencyRows: number;
};

export function summarizeCreativeSpendByCurrency(
  rows: readonly CreativeSpendRow[],
): CreativeSpendSummary {
  const totals = new Map<string, number>();
  let unknownCurrencyRows = 0;

  for (const row of rows) {
    const currencyCode = row.spend_currency?.trim().toUpperCase() ?? "";
    if (!/^[A-Z]{3}$/.test(currencyCode) || !Number.isFinite(row.spend)) {
      unknownCurrencyRows += 1;
      continue;
    }
    totals.set(currencyCode, (totals.get(currencyCode) ?? 0) + row.spend);
  }

  return {
    totals: [...totals.entries()]
      .map(([currencyCode, amount]) => ({ currencyCode, amount }))
      .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode)),
    unknownCurrencyRows,
  };
}

export type RankingCurrencyRow = {
  dimension: string;
  currency_code: string | null;
};

export type RankingCurrencyGroup<T extends RankingCurrencyRow> = {
  dimension: string;
  currencyCode: string | null;
  rows: T[];
};

export function groupRankingRowsByDimensionCurrency<T extends RankingCurrencyRow>(
  rows: readonly T[],
): RankingCurrencyGroup<T>[] {
  const groups = new Map<string, RankingCurrencyGroup<T>>();

  for (const row of rows) {
    const currencyCode = row.currency_code?.trim().toUpperCase() || null;
    const key = JSON.stringify([row.dimension, currencyCode]);
    const group = groups.get(key) ?? {
      dimension: row.dimension,
      currencyCode,
      rows: [],
    };
    group.rows.push(row);
    groups.set(key, group);
  }

  return [...groups.values()];
}
