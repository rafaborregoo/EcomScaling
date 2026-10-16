/** Aritmética del simulador de coste de IA: pura, para poder probarla. */

export type SimModel = { id: string; label: string; input: number; output: number; cache_read: number };
export type SimProfile = { input_total: number; cache_read: number; output: number };

export const DAYS_PER_MONTH = 30;

/** USD de una ejecucion. La entrada total incluye la cache leida, que se cobra a su precio. */
export function costPerRun(profile: SimProfile, model: SimModel): number {
  const fresh = Math.max(0, profile.input_total - profile.cache_read);
  return (fresh * model.input + profile.cache_read * model.cache_read + profile.output * model.output) / 1_000_000;
}

export type SimRow = {
  code: string;
  profile: SimProfile;
  model: SimModel;
  runsPerDay: number;
};

/** Totales por cliente: coste/dia, coste/mes y tokens/mes. */
export function totals(rows: SimRow[]) {
  let perDay = 0;
  let inputPerMonth = 0;
  let outputPerMonth = 0;
  let runsPerDay = 0;
  for (const row of rows) {
    perDay += costPerRun(row.profile, row.model) * row.runsPerDay;
    runsPerDay += row.runsPerDay;
    inputPerMonth += row.profile.input_total * row.runsPerDay * DAYS_PER_MONTH;
    outputPerMonth += row.profile.output * row.runsPerDay * DAYS_PER_MONTH;
  }
  return { perDay, perMonth: perDay * DAYS_PER_MONTH, runsPerDay, inputPerMonth, outputPerMonth };
}
