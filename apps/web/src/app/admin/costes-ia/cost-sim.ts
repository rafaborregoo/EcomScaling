/** Aritmética del simulador de coste de IA: pura, para poder probarla. */

export type SimModel = {
  id: string;
  label: string;
  input: number;
  output: number;
  cache_read: number;
  long_context_threshold?: number;
  long_input_multiplier?: number;
  long_output_multiplier?: number;
};
export type SimProfile = {
  input_total: number;
  cache_read: number;
  output: number;
};

export const DAYS_PER_MONTH = 30;

/** Escenario con una tienda: A04 tiene ámbito organizativo y de tienda. */
export function plannedRunsPerDay(
  code: string,
  runs: number,
  additionalRuns = 0,
) {
  if (runs === 0) return 0;
  return code === "a04_generador_tareas" ? runs * 2 : runs + additionalRuns;
}

/** USD de una ejecucion. La entrada total incluye la cache leida, que se cobra a su precio. */
export function costPerRun(profile: SimProfile, model: SimModel): number {
  const fresh = Math.max(0, profile.input_total - profile.cache_read);
  const long =
    model.long_context_threshold !== undefined &&
    profile.input_total > model.long_context_threshold;
  return (
    ((fresh * model.input + profile.cache_read * model.cache_read) *
      (long ? (model.long_input_multiplier ?? 1) : 1) +
      profile.output *
        model.output *
        (long ? (model.long_output_multiplier ?? 1) : 1)) /
    1_000_000
  );
}

export type SimRow = {
  code: string;
  profile: SimProfile;
  model: SimModel;
  runsPerDay: number;
};

/** Estimación acumulada de agentes cerrados; la frecuencia de A01 puede ser desconocida. */
export function closedAgentsCost(rows: SimRow[], meetingsPerMonth: number | null) {
  const agents = rows.map((row) => ({
    code: row.code,
    monthly: row.code === "a01_analista_llamadas"
      ? meetingsPerMonth === null ? null : costPerRun(row.profile, row.model) * meetingsPerMonth
      : row.code === "a08_gestor_conocimiento" && row.runsPerDay === 0
        ? null
        : costPerRun(row.profile, row.model) * row.runsPerDay * DAYS_PER_MONTH,
  }));
  return { agents, partial: agents.reduce((sum, row) => sum + (row.monthly ?? 0), 0), complete: agents.every((row) => row.monthly !== null), pending: agents.filter((row) => row.monthly === null).map((row) => row.code) };
}

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
  return {
    perDay,
    perMonth: perDay * DAYS_PER_MONTH,
    runsPerDay,
    inputPerMonth,
    outputPerMonth,
  };
}
