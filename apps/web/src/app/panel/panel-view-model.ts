/**
 * Derivaciones del panel del manager.
 *
 * Aparte de la pantalla porque son las reglas que deciden que numero se ve:
 * como se reparte el coste total, si una cifra va por encima o por debajo de su
 * objetivo, y como se etiqueta cada mes del grafico. Un fallo aqui no rompe
 * nada visiblemente -- pinta un numero equivocado con aspecto de correcto.
 */

export function monthlyChartScale(max: number, currency: string | null) {
  const divisor = max >= 1000 ? 1000 : 1;
  return {
    divisor,
    digits: max >= 100_000 || divisor === 1 ? 0 : 1,
    label: currency
      ? `Importes en ${divisor === 1000 ? "miles de " : ""}${currency}`
      : `Escala en ${divisor === 1000 ? "miles" : "unidades"} · moneda sin confirmar`,
  };
}

export type PanelFinancial = {
  net_revenue_ex_tax: number;
  net_profit: number;
  net_margin_pct: number;
  cogs: number;
  payment_fees: number;
  shipping_costs: number;
  shipping_charged: number;
  shipping_net: number;
  fixed_costs: number;
  fixed_pct_revenue: number;
  ads_spend: number;
  ads_by_platform: Record<string, number>;
  orders_count: number;
  new_customers: number;
  cac_blended: number | null;
  aov_ex_tax: number;
  cogs_per_order: number;
  shipping_per_order: number;
  fixed_per_order: number;
  cac_per_order: number;
  contribution_per_order: number;
  breakeven_cac_per_order: number;
  mbee: number;
  breakeven_roas: number | null;
};

export type MonthlyRow = {
  month: string;
  orders_count: number;
  net_revenue_ex_tax: number;
  net_profit: number;
};

// Los objetivos y las palancas viven en @e-nora/contracts: la API calcula las
// mismas palancas por tienda para la cartera y el cliente, y una cuenta que se
// escribe dos veces acaba dando dos cifras.
export {
  opportunities,
  opportunitiesTotal,
  targetsByKey,
  type MetricTarget,
  type Opportunity,
} from "@e-nora/contracts";

export type TargetStatus = "cumple" | "no_cumple" | null;

/**
 * En unas metricas ganar es subir (margen, ticket medio) y en otras es bajar
 * (CAC). Sin decirlo, un CAC por debajo del objetivo se pintaria en rojo, que
 * es justo al reves de la realidad.
 */
export function targetStatus(
  value: number | null | undefined,
  target: number | undefined,
  direction: "arriba" | "abajo",
): TargetStatus {
  if (value === null || value === undefined || target === undefined) {
    return null;
  }

  if (direction === "arriba") {
    return value >= target ? "cumple" : "no_cumple";
  }

  return value <= target ? "cumple" : "no_cumple";
}

export type CostSlice = {
  concepto: string;
  importe: number;
  pct_ingresos: number;
};

/**
 * Reparto del coste total, de mayor a menor. El orden no es fijo a proposito:
 * lo que importa del desglose es cual es el bocado grande, y eso cambia de
 * tienda a tienda.
 *
 * Los conceptos a cero se quedan fuera: una barra de cero euros no informa de
 * nada y desplaza a las que si.
 */
export function costBreakdown(financial: PanelFinancial): CostSlice[] {
  const revenue = financial.net_revenue_ex_tax;
  const slices: Array<{ concepto: string; importe: number }> = [
    { concepto: "Producto (COGS)", importe: financial.cogs },
    { concepto: "Envíos", importe: financial.shipping_costs },
    { concepto: "Publicidad", importe: financial.ads_spend },
    { concepto: "Gastos fijos", importe: financial.fixed_costs },
    { concepto: "Comisiones de pago", importe: financial.payment_fees },
  ];

  return slices
    .filter((slice) => slice.importe > 0)
    .sort((a, b) => b.importe - a.importe)
    .map((slice) => ({
      ...slice,
      pct_ingresos: revenue > 0 ? (slice.importe / revenue) * 100 : 0,
    }));
}

export function totalCosts(financial: PanelFinancial): number {
  return (
    financial.cogs +
    financial.shipping_costs +
    financial.ads_spend +
    financial.fixed_costs +
    financial.payment_fees
  );
}

const MONTH_LABELS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

/**
 * Etiqueta del mes a partir de "YYYY-MM-DD", leyendo la cadena.
 *
 * NO se usa `new Date(...)`: una fecha sin hora se interpreta como medianoche
 * UTC y, al formatearla en un huso por delante de UTC (España lo esta todo el
 * año), sale el mes anterior. Es un error real de este proyecto, no una
 * precaucion teorica: la primera comprobacion de la serie mensual imprimio doce
 * meses corridos uno hacia atras por exactamente esto.
 */
export function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return MONTH_LABELS[index] ?? month;
}

export type MonthlyChartRow = {
  mes: string;
  Ingresos: number;
  Beneficio: number;
};

export function monthlyChartRows(rows: MonthlyRow[]): MonthlyChartRow[] {
  return rows.map((row) => ({
    mes: monthLabel(row.month),
    Ingresos: Number(row.net_revenue_ex_tax) || 0,
    Beneficio: Number(row.net_profit) || 0,
  }));
}

/**
 * Variacion porcentual contra el periodo anterior. `null` cuando no hay con que
 * comparar: sin base, un "+100 %" es ruido, no informacion.
 */
export function deltaPct(
  current: number,
  previous: number | null | undefined,
): number | null {
  if (previous === null || previous === undefined || previous === 0) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

export type PanelFunnel = {
  has_sessions: boolean;
  sessions: number;
  orders_count: number;
  cart_additions: number;
  checkouts_reached: number;
  /** Visitas que compraron. NO es `orders_count`: los pedidos incluyen otros canales. */
  purchases: number;
  has_funnel_steps: boolean;
};

export type FunnelStep = {
  paso: string;
  valor: number;
  /** Porcentaje sobre el paso anterior: donde se ve la fuga. */
  pct_del_anterior: number | null;
  /** Porcentaje sobre las sesiones: el peso del paso en el total. */
  pct_del_total: number | null;
};

/**
 * Pasos del embudo con su caida.
 *
 * Un paso del que no tenemos dato NO se pinta a cero: se omite, y los
 * porcentajes se calculan contra el ultimo paso que si conocemos. Pintar un
 * cero diria que nadie inicio el pago, cuando lo que pasa es que no lo
 * medimos en ese periodo.
 *
 * UNA SOLA UNIDAD EN TODA LA COLUMNA: visitas a la tienda online. Por eso el
 * ultimo paso es "Compro" (visitas que compraron) y no "Pedidos": los pedidos
 * cuentan tambien los otros canales, y un paso medido en pedidos detras de uno
 * medido en visitas puede dar mas del 100 % del anterior sin que nadie se haya
 * equivocado. Los pedidos del periodo estan en su propia tarjeta.
 *
 * Sin los pasos intermedios queda la vista corta —sesiones y pedidos—, que es
 * lo unico que se puede afirmar entonces.
 */
export function funnelSteps(funnel: PanelFunnel | null): FunnelStep[] {
  if (!funnel || !funnel.has_sessions) return [];

  const steps: Array<{ paso: string; valor: number }> = [
    { paso: "Sesiones", valor: funnel.sessions },
  ];

  if (funnel.has_funnel_steps) {
    steps.push(
      { paso: "Añadió al carrito", valor: funnel.cart_additions },
      { paso: "Llegó al pago", valor: funnel.checkouts_reached },
      { paso: "Compró", valor: funnel.purchases },
    );
  } else {
    steps.push({ paso: "Pedidos", valor: funnel.orders_count });
  }

  const total = funnel.sessions;

  return steps.map((step, index) => {
    const previous = index === 0 ? null : steps[index - 1]!.valor;

    return {
      ...step,
      pct_del_anterior:
        previous === null || previous === 0
          ? null
          : (step.valor / previous) * 100,
      pct_del_total: total > 0 ? (step.valor / total) * 100 : null,
    };
  });
}
