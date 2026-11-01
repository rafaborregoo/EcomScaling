/** Unidad comercial fija: 1.000.000 de créditos cubren 5 USD de coste API. */
export const COPILOT_CREDITS_PER_USD = 200_000;
export const COPILOT_DEFAULT_MONTHLY_CREDITS = 1_000_000;

/** Redondeo por ejecución, igual que la RPC; un coste desconocido nunca es gratis. */
export function copilotCreditsForCost(costUsd: number | null): number {
  if (costUsd === null || !Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error("copilot_cost_unavailable");
  }
  return Math.ceil(Number((costUsd * COPILOT_CREDITS_PER_USD).toFixed(8)));
}
