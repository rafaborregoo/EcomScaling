/**
 * El titular del panel del cliente: cómo va la tienda, en una frase.
 *
 * El consultor lee una rejilla de KPIs y saca la conclusión él. El cliente no
 * tiene por qué: si abre su panel y ve "Ventas 12.400 €" no sabe si eso está
 * bien. La frase es el producto; la cifra solo la sostiene.
 *
 * La trampa que resuelve este módulo: **vender más y ganar menos**. Comparar
 * solo ventas contra el periodo anterior daría "vas bien" a una tienda que ha
 * subido facturación quemando margen en descuentos o en publicidad. Un panel
 * que felicita a alguien que está perdiendo dinero es peor que uno vacío.
 */

export type PulseInput = {
  netSales: number;
  netProfit: number | null;
  hasFinancialSettings: boolean;
  previousNetSales: number | null;
};

export type Pulse = {
  tone: "success" | "warn" | "danger" | "neutral";
  headline: string;
  detail: string | null;
};

/** Punto muerto: por debajo de esto un cambio porcentual es ruido. */
const MIN_BASE = 1;
/** Menos de esto arriba o abajo es "plano", no una tendencia. */
const FLAT_PCT = 3;

export function salesChangePct(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null || Math.abs(previous) < MIN_BASE) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function storePulse(input: PulseInput): Pulse {
  const change = salesChangePct(input.netSales, input.previousNetSales);
  const losingMoney =
    input.hasFinancialSettings &&
    input.netProfit !== null &&
    input.netProfit < 0;

  // El beneficio manda sobre la tendencia de ventas. Vender más y perder
  // dinero no es una buena semana, por mucho que suba la cifra de arriba.
  if (losingMoney) {
    return {
      tone: "danger",
      headline: "Estás vendiendo por debajo de tus costes",
      detail:
        change !== null && change > FLAT_PCT
          ? `Las ventas suben un ${Math.round(change)}%, pero el beneficio sigue en negativo.`
          : "Cada pedido te está costando más de lo que deja.",
    };
  }

  if (change === null) {
    // Sin base con la que comparar: no se inventa una tendencia.
    return {
      tone: "neutral",
      headline: input.netSales > 0 ? "Primeros datos de tu tienda" : "Todavía sin ventas en este periodo",
      detail:
        input.netSales > 0
          ? "Cuando haya un periodo anterior completo, aquí verás si subes o bajas."
          : null,
    };
  }

  if (change > FLAT_PCT) {
    return {
      tone: "success",
      headline: `Tu tienda va mejor que el periodo anterior`,
      detail: `Las ventas suben un ${Math.round(change)}%.`,
    };
  }

  if (change < -FLAT_PCT) {
    return {
      tone: "warn",
      headline: "Tu tienda ha bajado respecto al periodo anterior",
      detail: `Las ventas caen un ${Math.abs(Math.round(change))}%.`,
    };
  }

  return {
    tone: "neutral",
    headline: "Tu tienda se mantiene estable",
    detail: `Las ventas se mueven menos de un ${FLAT_PCT}% respecto al periodo anterior.`,
  };
}

/**
 * Si no hay configuración financiera, el beneficio que se enseñe es mentira a
 * medias: exige configuración, costes de producto y cobertura neta de líneas.
 * Mejor no enseñarlo que enseñar un número parcial que el cliente creerá.
 */
export function canShowProfit(input: {
  hasFinancialSettings: boolean;
  itemsWithoutCost: number;
  linesWithoutNetMetrics: number | null | undefined;
}): boolean {
  return input.hasFinancialSettings &&
    input.itemsWithoutCost === 0 &&
    input.linesWithoutNetMetrics === 0;
}
export type FinancialComparabilityView = {
  status: "comparable" | "estimated" | "incomplete" | "incompatible" | "unknown" | "not_assessable";
  can_use_financial_model: boolean;
  reason_codes: string[];
  currency_status?: "compatible" | "incompatible" | "unknown";
};

export function financialComparabilityMessage(coverage?: FinancialComparabilityView) {
  const reasons = coverage?.reason_codes ?? [];
  if (reasons.includes("shopify_source_stale_or_unavailable") || reasons.includes("ads_source_stale_or_unavailable")) return "Actualiza las conexiones y espera a que termine la sincronización para verificar la rentabilidad.";
  if (reasons.includes("financial_currency_mismatch") || reasons.includes("financial_currency_unknown")) return "Confirma las monedas de ventas, costes y publicidad antes de comparar la rentabilidad.";
  if (reasons.includes("product_costs_missing")) return "Completa los costes de los productos vendidos para verificar la rentabilidad.";
  if (reasons.includes("organization_fixed_costs_unallocated_between_stores")) return "Revisa cómo repartir los gastos compartidos entre las tiendas antes de comparar su rentabilidad.";
  if (reasons.includes("order_totals_basis_unverified") || reasons.includes("order_totals_not_reconciled") || reasons.includes("refund_snapshot_pending") || reasons.includes("order_line_metrics_missing")) return "Completa una sincronización de Shopify para verificar importes y devoluciones.";
  if (reasons.includes("current_cost_used_for_historical_order") || reasons.includes("order_line_metrics_estimated")) return "La rentabilidad es una estimación: revisa los costes históricos y los importes de los pedidos.";
  if (reasons.includes("partial_utc_days_not_comparable_to_daily_ads")) return "La rentabilidad es una estimación: el periodo incluye días parciales y la publicidad se registra por día completo.";
  if (coverage?.status === "not_assessable") return "No hay ingresos positivos suficientes para comparar rentabilidad en este periodo.";
  return "Faltan datos verificados para comparar rentabilidad. Revisa costes, importes y sincronización.";
}
