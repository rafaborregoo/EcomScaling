/**
 * Cuentas del panel del cliente (vista "Pulso"): cómo se convierte la
 * respuesta de /shopify/metrics en las piezas que se pintan.
 *
 * Todo lo que suma o reparte dinero vive aquí y no en el componente, para que
 * el test pueda comprobar lo único que no se puede permitir: que las barras de
 * "De las ventas al beneficio" no cuadren con el beneficio que se enseña.
 */

export function fmtNum(value: number, decimals = 0) {
  const negative = value < 0;
  const [int, frac] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "−" : ""}${grouped}${frac ? `,${frac}` : ""}`;
}

export function fmtEur(value: number, decimals = 0) {
  return `${fmtNum(value, decimals)} €`;
}

export function fmtCurrency(value: number | null | undefined, currencyCode: string | null | undefined, decimals = 0) {
  if (value == null || !currencyCode) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${fmtNum(value, decimals)} ${currencyCode}`;
  }
}

export type PulseFinancial = {
  net_sales: number;
  net_revenue_ex_tax: number;
  cogs: number;
  shipping_costs: number;
  payment_fees: number;
  ads_spend: number;
  fixed_costs: number;
  net_profit: number;
  orders_count: number;
  aov_ex_tax: number;
  cogs_per_order: number;
  shipping_per_order: number;
  payment_fee_per_order: number;
  cac_per_order: number;
  fixed_per_order: number;
};

export type FlowRow = {
  label: string;
  value: number;
  kind: "total" | "cost" | "profit";
  hint?: string;
};

/** Menos de un euro de diferencia es redondeo, no una partida que explicar. */
const RESIDUAL_EUR = 1;

/**
 * De las ventas netas al beneficio, en escalones que cuadran.
 *
 * Si el motor financiero trata algo distinto de lo que aquí se resta (envíos
 * cobrados, reembolsos...), el hueco sale como "Otros ajustes" en vez de
 * esconderse: una cascada que no llega a su propio total es peor que una fila
 * de más.
 */
export function moneyFlow(f: PulseFinancial, adsHint?: string): FlowRow[] {
  const rows: FlowRow[] = [
    { label: "Ventas netas", value: f.net_sales, kind: "total", hint: "Con IVA y envío cobrado" },
  ];
  const taxGap = f.net_revenue_ex_tax - f.net_sales;
  if (Math.abs(taxGap) >= RESIDUAL_EUR) {
    rows.push({ label: "IVA", value: taxGap, kind: "cost" });
  }
  rows.push({ label: "Ingreso sin IVA", value: f.net_revenue_ex_tax, kind: "total" });

  const costs: FlowRow[] = [
    { label: "Producto", value: -f.cogs, kind: "cost", hint: "Coste de lo vendido" },
    { label: "Envíos", value: -f.shipping_costs, kind: "cost" },
    { label: "Comisiones", value: -f.payment_fees, kind: "cost", hint: "Pasarela de pago" },
    { label: "Publicidad", value: -f.ads_spend, kind: "cost", hint: adsHint },
    { label: "Gastos fijos", value: -f.fixed_costs, kind: "cost", hint: "Parte de este periodo" },
  ];
  rows.push(...costs.filter((row) => Math.abs(row.value) >= RESIDUAL_EUR));

  const afterCosts = costs.reduce((acc, row) => acc + row.value, f.net_revenue_ex_tax);
  const residual = f.net_profit - afterCosts;
  if (Math.abs(residual) >= RESIDUAL_EUR) {
    rows.push({ label: "Otros ajustes", value: residual, kind: "cost" });
  }
  rows.push({ label: "Beneficio neto", value: f.net_profit, kind: "profit" });
  return rows;
}

export type UnitSlice = { key: string; label: string; value: number };

/** Qué se lleva cada partida de un pedido medio sin IVA, y qué queda. */
export function unitEconomics(f: PulseFinancial): UnitSlice[] {
  const profit = f.orders_count > 0 ? f.net_profit / f.orders_count : 0;
  const slices: UnitSlice[] = [
    { key: "prod", label: "Producto", value: f.cogs_per_order },
    { key: "ship", label: "Envío", value: f.shipping_per_order },
    { key: "fee", label: "Comisión", value: f.payment_fee_per_order },
    { key: "ads", label: "Publicidad", value: f.cac_per_order },
    { key: "fix", label: "Gastos fijos", value: f.fixed_per_order },
  ];
  const other = f.aov_ex_tax - slices.reduce((acc, s) => acc + s.value, 0) - profit;
  if (Math.abs(other) >= 0.01) slices.push({ key: "other", label: "Otros", value: other });
  slices.push({ key: "profit", label: "Te queda", value: profit });
  return slices;
}

export type MonthPoint = { month: string; value: number; kind: "real" | "current" | "projection" };

/**
 * Meses reales + proyección hasta diciembre al ritmo reciente.
 *
 * El mes en curso está a medias, así que la proyección arranca desde el último
 * mes cerrado.
 */
// ponytail: crecimiento medio geométrico de los últimos 6 meses cerrados; sin
// estacionalidad. Si hace falta, pasar a mismo-mes-año-anterior (previous_year).
export function monthlyWithProjection(
  monthly: Array<{ month: string; value: number }>,
  today: Date,
): MonthPoint[] {
  const currentKey = today.toISOString().slice(0, 7);
  const points: MonthPoint[] = monthly
    .filter((m) => m.month.slice(0, 4) === currentKey.slice(0, 4))
    .map((m) => ({
      month: m.month.slice(0, 7),
      value: m.value,
      kind: m.month.slice(0, 7) === currentKey ? "current" : "real",
    }));
  const closed = points.filter((p) => p.kind === "real" && p.value > 0).slice(-7);
  if (closed.length < 3) return points;

  const growth = Math.pow(closed[closed.length - 1].value / closed[0].value, 1 / (closed.length - 1));
  let value = closed[closed.length - 1].value;
  const year = today.getUTCFullYear();
  for (let month = today.getUTCMonth() + 1; month < 12; month += 1) {
    value *= growth;
    points.push({ month: `${year}-${String(month + 1).padStart(2, "0")}`, value, kind: "projection" });
  }
  return points;
}
