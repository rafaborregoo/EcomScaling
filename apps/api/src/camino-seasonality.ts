/**
 * Línea base y estacionalidad calculadas por el servidor a partir de la serie
 * mensual de ventas netas.
 *
 * El modelo recibía la serie cruda, con el mes como instante UTC desplazado por
 * la zona horaria ("2025-09-30T22:00Z" es octubre), y fijaba la meta a ojo: tomó
 * el mismo mes del año anterior como línea base y propuso un 13 % de subida
 * medido en un mes de temporada baja, por debajo de lo que la tienda vende ya.
 * Con esto el agente parte de cifras ya resueltas: ritmo actual, mismo mes del
 * año pasado y mes pico, con la cobertura que hay de verdad.
 */

export type MonthlySalesRow = {
  bucket_month: string;
  net_sales: number | string | null;
  orders_count?: number | string | null;
};

export type SeasonalityMonth = { month: string; net_sales: number; orders: number | null; complete: boolean };

export type CaminoSeasonality = {
  /** Meses con ventas observadas (>0). Menos de 24 = ninguna temporada se puede comparar con otra. */
  months_with_sales: number;
  comparable_seasons: number;
  series: SeasonalityMonth[];
  last_full_month: SeasonalityMonth | null;
  /** Media de los tres últimos meses completos: el ritmo de hoy. */
  run_rate_3m: number | null;
  peak_month: SeasonalityMonth | null;
  /** Mismo mes del año anterior para cada mes del horizonte, si hay dato. */
  same_month_last_year: Array<{ month: string; last_year: string; net_sales: number | null; vs_run_rate_pct: number | null }>;
  notes: string[];
};

const num = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Mes natural de la tienda (yyyy-mm). El cubo mensual llega a medianoche local expresada en UTC. */
export function monthKey(bucket: string): string {
  const shifted = new Date(Date.parse(bucket) + 12 * 3_600_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

const addMonths = (key: string, delta: number) => {
  const [year, month] = key.split("-").map(Number) as [number, number];
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

export function caminoSeasonality(rows: MonthlySalesRow[], today: Date, horizonMonths: number): CaminoSeasonality {
  const currentMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const series: SeasonalityMonth[] = rows
    .map((row) => ({
      month: monthKey(row.bucket_month),
      net_sales: Math.round(num(row.net_sales) * 100) / 100,
      orders: row.orders_count == null ? null : num(row.orders_count),
      complete: monthKey(row.bucket_month) < currentMonth,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const withSales = series.filter((entry) => entry.net_sales > 0);
  const full = withSales.filter((entry) => entry.complete);
  // Los tres ultimos meses COMPLETOS de calendario: un mes sin ventas dentro de la
  // historia cuenta como cero, no se salta (saltarlo mezclaba meses antiguos).
  const bySeries = new Map(series.map((entry) => [entry.month, entry.net_sales]));
  const lastThreeKeys = [-3, -2, -1].map((delta) => addMonths(currentMonth, delta));
  const firstMonth = series[0]?.month ?? null;
  const runRate = firstMonth !== null && lastThreeKeys[0]! >= firstMonth
    ? Math.round(lastThreeKeys.reduce((sum, key) => sum + (bySeries.get(key) ?? 0), 0) / 3)
    : null;
  const byMonth = new Map(withSales.map((entry) => [entry.month, entry]));
  const peak = full.reduce<SeasonalityMonth | null>((best, entry) => (!best || entry.net_sales > best.net_sales ? entry : best), null);

  const sameMonthLastYear = Array.from({ length: horizonMonths }, (_, index) => {
    const month = addMonths(currentMonth, index);
    const lastYear = addMonths(month, -12);
    const value = byMonth.get(lastYear)?.net_sales ?? null;
    return {
      month,
      last_year: lastYear,
      net_sales: value,
      vs_run_rate_pct: value !== null && runRate ? Math.round((value / runRate - 1) * 100) : null,
    };
  });

  const comparableSeasons = Math.floor(withSales.length / 12);
  const notes: string[] = [];
  if (comparableSeasons < 2) {
    notes.push(
      `Solo hay ${withSales.length} meses con ventas: no hay dos temporadas comparables. La estacionalidad sale de un único año; úsala como referencia, no como patrón demostrado, y dilo en las hipótesis.`,
    );
  }
  if (runRate === null) notes.push("No hay tres meses completos con ventas: no se puede fijar un ritmo actual fiable.");
  if (peak && runRate && peak.net_sales > runRate * 1.5) {
    notes.push(`El mes pico (${peak.month}, ${peak.net_sales} €) supera en un ${Math.round((peak.net_sales / runRate - 1) * 100)} % al ritmo actual: los meses de campaña pesan más que la media.`);
  }
  return {
    months_with_sales: withSales.length,
    comparable_seasons: comparableSeasons,
    series,
    last_full_month: full.at(-1) ?? null,
    run_rate_3m: runRate,
    peak_month: peak,
    same_month_last_year: sameMonthLastYear,
    notes,
  };
}
