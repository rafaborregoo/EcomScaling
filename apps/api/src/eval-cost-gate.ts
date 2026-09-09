/**
 * AI-30: gate de coste de un escenario de eval, compartido por los cuatro
 * runners (A01, A02, A06, A08) que antes repetian el mismo bloque literal.
 *
 * Existe por un cambio de contrato: `estimated_cost_usd` puede ser `null`
 * cuando el modelo no esta tarifado en MODEL_PRICING. Antes ese caso valia 0 y
 * el gate de coste lo daba por bueno -- es decir, la forma mas facil de colar
 * un modelo caro por el gate era usar uno cuyo precio no conocieramos.
 *
 * Regla: un escenario cuyo coste no se puede calcular NO pasa el gate de coste.
 * No se suma al total (sumar 0 abarataria el informe) y se cuenta como
 * violacion, igual que si se hubiera pasado del umbral.
 */
export type CostGateOutcome = {
  /** Coste a acumular en el total del eval. 0 cuando no es calculable. */
  addToTotalUsd: number;
  /** Violaciones a registrar; vacio si el escenario pasa el gate. */
  violations: string[];
};

export function evaluateCostGate(
  scenarioName: string,
  estimatedCostUsd: number | null,
  maxCostUsd: number,
): CostGateOutcome {
  if (estimatedCostUsd === null) {
    return {
      addToTotalUsd: 0,
      violations: [
        `[GATE FAIL] ${scenarioName}: coste no calculable (modelo sin tarifa en MODEL_PRICING). ` +
          `Un escenario cuyo coste no se puede medir no puede pasar el gate de coste.`,
      ],
    };
  }

  if (estimatedCostUsd > maxCostUsd) {
    return {
      addToTotalUsd: estimatedCostUsd,
      violations: [
        `[GATE FAIL] ${scenarioName}: coste $${estimatedCostUsd} supera el umbral $${maxCostUsd}`,
      ],
    };
  }

  return { addToTotalUsd: estimatedCostUsd, violations: [] };
}
