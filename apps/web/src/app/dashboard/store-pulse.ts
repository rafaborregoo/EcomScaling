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
 * medias: no incluye costes de producto ni gastos fijos. Mejor no enseñarlo
 * que enseñar un número que el cliente creerá.
 */
export function canShowProfit(input: {
  hasFinancialSettings: boolean;
  itemsWithoutCost: number;
}): boolean {
  return input.hasFinancialSettings && input.itemsWithoutCost === 0;
}
