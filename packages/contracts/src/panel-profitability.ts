/**
 * Reglas puras del panel de rentabilidad del consultor (/panel).
 *
 * Viven aqui, y no en la API ni en la pantalla, porque las dos las necesitan y
 * una cifra que se calcula dos veces acaba siendo dos cifras: la API agrega
 * cartera y cliente, la pantalla construye la tienda con los mismos criterios
 * de tramo, palanca y titular.
 *
 * El panel tiene tres alcances -- cartera, cliente, tienda -- y el consultor
 * recorre los tres con la misma gramatica. Esta es la pantalla del CONSULTOR:
 * los titulares hablan de "tu cliente" en tercera persona y con vocabulario de
 * rentabilidad. El cliente no ve nada de esto; su dashboard dice otras cosas.
 */

import { METRIC_SPECS } from "./metric-analyst.js";

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };

/**
 * Por debajo de estos clientes nuevos el CAC lo decide el azar: 4.000 € de
 * publicidad entre 1 cliente nuevo no es un CAC de 4.000 €, es que no hay
 * muestra. Mismo umbral que el analista de métricas (ADR-0027).
 */
export const CAC_MIN_NEW_CUSTOMERS = METRIC_SPECS.cac_new.minSample.min;

function groupedAbs(value: number, digits: number): string {
  const [integer, decimals] = Math.abs(value).toFixed(digits).split(".");
  const grouped = (integer ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals ? `${grouped},${decimals}` : grouped;
}

function signOf(value: number, digits: number): string {
  return Number(value.toFixed(digits)) < 0 ? "−" : "";
}

/**
 * Importe agrupado en miles ("2.150 €"). No se usa `Intl` a proposito: en
 * es-ES omite el separador de miles en los numeros de cuatro cifras ("2150 €")
 * y en un panel de comparacion eso hace ilegible una columna entera.
 */
export function panelMoney(
  value: number,
  currency: string | null = "EUR",
  digits = 0,
): string {
  const symbol = currency ? (CURRENCY_SYMBOLS[currency] ?? currency) : "€";
  return `${signOf(value, digits)}${groupedAbs(value, digits)} ${symbol}`;
}

export function panelPct(value: number, digits = 1): string {
  return `${signOf(value, digits)}${groupedAbs(value, digits)} %`;
}

export function panelNumber(value: number, digits = 0): string {
  return `${signOf(value, digits)}${groupedAbs(value, digits)}`;
}

// ---------------------------------------------------------------------------
// Objetivos y palancas ("dinero sobre la mesa")
// ---------------------------------------------------------------------------

export type MetricTarget = {
  metric_key: string;
  target_value: number;
  period: string;
};

/**
 * Objetivos por clave. Si llegan varios de la misma metrica con distinta
 * periodicidad, manda el mensual: el panel enseña un periodo, no un año.
 */
export function targetsByKey(targets: MetricTarget[]): Record<string, number> {
  const byKey: Record<string, number> = {};

  for (const target of targets) {
    if (byKey[target.metric_key] === undefined || target.period === "monthly") {
      byKey[target.metric_key] = Number(target.target_value);
    }
  }

  return byKey;
}

export type LeverFinancial = {
  net_revenue_ex_tax: number;
  net_margin_pct: number;
  contribution_per_order: number;
  cac_blended: number | null;
  new_customers: number;
};

export type LeverFunnel = {
  has_sessions: boolean;
  sessions: number;
  orders_count: number;
};

export type Opportunity = {
  palanca: string;
  /** Euros de BENEFICIO extra al mes. Todos los escenarios en la misma unidad. */
  eur_mes: number;
  /** La cuenta, en palabras, para poder discutirla con el cliente. */
  regla: string;
  /** Que metrica mueve: sirve para agrupar la palanca de toda una cartera. */
  clave: "margen" | "conversion" | "cac";
};

/** Dias de un mes medio: el mismo divisor que usa el prorrateo de gastos fijos. */
const DIAS_MES = 30.44;

/**
 * "Dinero sobre la mesa": lo que ganarias si cada metrica llegara al objetivo
 * que TU le has puesto.
 *
 * Tres reglas para que esto sea una herramienta y no un powerpoint:
 *
 *  1. **Solo con objetivo puesto.** Sin objetivo no hay escenario. No se
 *     inventan "medias del sector": el numero tiene que poder defenderse
 *     delante del cliente, y para eso alguien ha tenido que decidirlo.
 *  2. **Todo en euros de beneficio al mes.** Mezclar euros de facturacion con
 *     euros de beneficio en la misma lista es como se construye una cifra
 *     bonita que no significa nada.
 *  3. **Solo si vas por debajo.** Una metrica que ya cumple no tiene dinero
 *     encima de la mesa; sale de la lista en vez de restar.
 *
 * El ticket medio se queda fuera a proposito: subirlo da mas facturacion, pero
 * cuanto de eso es beneficio depende de si sube por precio (casi todo) o por
 * unidades (casi nada, porque el producto cuesta). Sin saber cual, el numero
 * seria inventado.
 */
export function opportunities(
  financial: LeverFinancial,
  funnel: LeverFunnel | null,
  targets: Record<string, number>,
  periodDays: number,
  currency: string | null = "EUR",
): Opportunity[] {
  const found: Opportunity[] = [];
  const aMes = (valorDelPeriodo: number) =>
    periodDays > 0 ? (valorDelPeriodo * DIAS_MES) / periodDays : 0;

  // Margen: misma facturacion, mejor margen. La cuenta mas directa que hay.
  const margenObjetivo = targets.net_margin_pct;
  if (margenObjetivo !== undefined && financial.net_margin_pct < margenObjetivo) {
    const puntos = margenObjetivo - financial.net_margin_pct;
    found.push({
      palanca: "Margen neto al objetivo",
      eur_mes: aMes((financial.net_revenue_ex_tax * puntos) / 100),
      regla: `${panelNumber(puntos, 1)} puntos de margen sobre la facturación actual`,
      clave: "margen",
    });
  }

  // Conversion: mismas visitas, mas pedidos, cada uno dejando lo que deja hoy.
  const conversionObjetivo = targets.conversion_rate;
  const conversionActual =
    funnel && funnel.has_sessions && funnel.sessions > 0
      ? (funnel.orders_count / funnel.sessions) * 100
      : null;
  if (
    conversionObjetivo !== undefined &&
    conversionActual !== null &&
    conversionActual < conversionObjetivo &&
    financial.contribution_per_order > 0
  ) {
    const pedidosExtra =
      (funnel!.sessions * (conversionObjetivo - conversionActual)) / 100;
    found.push({
      palanca: "Conversión al objetivo",
      eur_mes: aMes(pedidosExtra * financial.contribution_per_order),
      regla: `${panelNumber(pedidosExtra)} pedidos más con el mismo tráfico, a ${panelMoney(financial.contribution_per_order, currency, 2)} de margen cada uno`,
      clave: "conversion",
    });
  }

  // CAC: mismos clientes, pagando menos por cada uno. Lo que te ahorras es
  // beneficio directo.
  const cacObjetivo = targets.cac_blended;
  if (
    cacObjetivo !== undefined &&
    financial.cac_blended !== null &&
    financial.cac_blended > cacObjetivo &&
    financial.new_customers >= CAC_MIN_NEW_CUSTOMERS
  ) {
    const ahorroPorCliente = financial.cac_blended - cacObjetivo;
    found.push({
      palanca: "CAC al objetivo",
      eur_mes: aMes(financial.new_customers * ahorroPorCliente),
      regla: `${panelMoney(ahorroPorCliente, currency, 2)} menos por cada uno de los ${panelNumber(financial.new_customers)} clientes nuevos`,
      clave: "cac",
    });
  }

  return found.sort((a, b) => b.eur_mes - a.eur_mes);
}

export function opportunitiesTotal(found: Opportunity[]): number {
  return found.reduce((total, item) => total + item.eur_mes, 0);
}

// ---------------------------------------------------------------------------
// Tramo y fiabilidad de una tienda
// ---------------------------------------------------------------------------

/**
 * El tramo dice que hacer con una tienda, no como le va:
 *   pierde -> hay que intervenir ya (el beneficio es negativo y se puede creer)
 *   datos  -> no se puede decir nada todavia: faltan costes
 *   bajo   -> gana dinero pero no llega al objetivo de margen
 *   ok     -> cumple (o no hay objetivo contra el que medirla)
 */
export type ProfitTier = "pierde" | "datos" | "bajo" | "ok";

export const PROFIT_TIER_ORDER: readonly ProfitTier[] = [
  "pierde",
  "datos",
  "bajo",
  "ok",
];

export type ProfitFlagKey =
  | "no_orders"
  | "no_cogs"
  | "partial_cogs"
  | "no_fixed"
  | "no_settings"
  | "no_sessions"
  | "no_currency"
  | "mixed_currency"
  | "financial_unverified";

export type ProfitFlag = {
  key: ProfitFlagKey;
  label: string;
  /** Un aviso bloqueante invalida el beneficio; uno informativo solo lo matiza. */
  blocking: boolean;
};

export type ProfitFlagsInput = {
  orders_count: number;
  cogs: number;
  items_without_cost: number;
  fixed_expenses_count: number;
  has_settings: boolean;
};

export function dataFlags(
  financial: ProfitFlagsInput,
  sessions: { has_sessions: boolean } | null,
): ProfitFlag[] {
  const flags: ProfitFlag[] = [];

  if (financial.orders_count <= 0) {
    flags.push({ key: "no_orders", label: "Sin pedidos", blocking: true });
    return flags;
  }
  if (financial.cogs <= 0) {
    flags.push({ key: "no_cogs", label: "Sin coste de producto", blocking: true });
  } else if (financial.items_without_cost > 0) {
    flags.push({ key: "partial_cogs", label: "Productos sin coste", blocking: false });
  }
  if (financial.fixed_expenses_count <= 0) {
    flags.push({ key: "no_fixed", label: "Sin gastos fijos", blocking: true });
  }
  if (!financial.has_settings) {
    flags.push({ key: "no_settings", label: "Sin comisiones ni envío", blocking: true });
  }
  if (sessions && !sessions.has_sessions) {
    flags.push({ key: "no_sessions", label: "Sin sesiones", blocking: false });
  }

  return flags;
}

export function classifyTier(args: {
  flags: ProfitFlag[];
  net_profit: number;
  net_margin_pct: number;
  margin_target: number | null;
}): ProfitTier {
  if (args.flags.some((flag) => flag.blocking)) return "datos";
  if (args.net_profit < 0) return "pierde";
  if (args.margin_target !== null && args.net_margin_pct < args.margin_target) {
    return "bajo";
  }
  return "ok";
}

// ---------------------------------------------------------------------------
// Fila de tienda
// ---------------------------------------------------------------------------

export type PerOrder = {
  aov_ex_tax: number;
  cogs: number;
  shipping: number;
  fees: number;
  ads: number;
  fixed: number;
  profit: number;
  contribution: number;
  breakeven_cac: number;
};

export type ProfitLever = {
  clave: Opportunity["clave"];
  palanca: string;
  eur_mes: number;
  regla: string;
};

export type ProfitStoreRow = {
  store_id: string;
  organization_id: string;
  organization_name: string;
  connection_id: string | null;
  shop_name: string;
  domain: string | null;
  currency_code: string | null;
  revenue: number;
  orders: number;
  net_profit: number;
  /** Parte de los gastos fijos del cliente que carga esta tienda (ver StoreRowInput.fixedShare). */
  fixed_share: number;
  margin_pct: number;
  margin_target: number | null;
  per_order: PerOrder;
  ads_spend: number;
  new_customers: number;
  cac: number | null;
  cac_target: number | null;
  /** Sesiones del periodo; `null` si la tienda no tiene informe de sesiones. */
  sessions: number | null;
  /** Pedidos entre sesiones, en %: la misma cuenta que la palanca de conversión. */
  conversion_pct: number | null;
  conversion_target: number | null;
  prev_revenue: number | null;
  prev_profit: number | null;
  prev_orders: number | null;
  revenue_change_pct: number | null;
  profit_change_pct: number | null;
  tier: ProfitTier;
  flags: ProfitFlag[];
  levers: ProfitLever[];
  lever_total: number;
  /** Ingresos diarios del periodo (solo en el nivel cliente: sparkline). */
  daily: number[];
};

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Variacion porcentual; `null` cuando no hay base contra la que comparar. */
export function changePct(
  current: number,
  previous: number | null | undefined,
): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Fila cruda de `shopify_financial_summary`: solo lo que usa el panel. */
export type FinancialSummaryRow = Record<string, unknown>;

export type StoreRowInput = {
  store: {
    id: string;
    organization_id: string;
    organization_name: string;
    connection_id: string | null;
    shop_name: string | null;
    domain: string | null;
    currency_code: string | null;
  };
  financial: FinancialSummaryRow | null;
  financialComparability: { can_use_financial_model: boolean } | null;
  previous: FinancialSummaryRow | null;
  funnel: { days_with_sessions?: unknown; sessions?: unknown } | null;
  targets: Record<string, number>;
  periodDays: number;
  /**
   * Parte de los gastos fijos que carga esta tienda (0-1). Los gastos fijos son
   * de la ORGANIZACION: `shopify_financial_summary` los aplica enteros a cada
   * tienda, asi que sumar tiendas contaria los fijos tantas veces como tiendas
   * tenga el cliente. El panel los reparte por facturacion y las tiendas suman
   * el beneficio real del cliente. Por defecto 1 (la tienda lo carga todo).
   */
  fixedShare?: number;
  daily?: number[];
};

export function buildStoreRow(input: StoreRowInput): ProfitStoreRow {
  const f = input.financial ?? {};
  const orders = num(f.orders_count);
  const revenue = num(f.net_revenue_ex_tax);
  const share = Math.min(1, Math.max(0, input.fixedShare ?? 1));
  const netProfit = num(f.net_profit) + num(f.fixed_costs) * (1 - share);
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : num(f.net_margin_pct);
  const sessions = input.funnel
    ? { has_sessions: num(input.funnel.days_with_sessions) > 0, sessions: num(input.funnel.sessions) }
    : null;

  const flags = dataFlags(
    {
      orders_count: orders,
      cogs: num(f.cogs),
      items_without_cost: num(f.items_without_cost),
      fixed_expenses_count: num(f.fixed_expenses_count),
      has_settings: f.has_settings === true,
    },
    sessions,
  );
  // Sin moneda confirmada no se pueden poner importes: se avisa y la tienda
  // queda en "datos" en vez de enseñar euros que podrian ser otra divisa.
  if (!input.store.currency_code) {
    flags.unshift({ key: "no_currency", label: "Moneda sin confirmar", blocking: true });
  }
  if (input.financialComparability?.can_use_financial_model !== true) {
    flags.unshift({ key: "financial_unverified", label: "Rentabilidad pendiente de verificar", blocking: true });
  }
  const marginTarget = input.targets.net_margin_pct ?? null;
  const tier = classifyTier({
    flags,
    net_profit: netProfit,
    net_margin_pct: marginPct,
    margin_target: marginTarget,
  });

  const newCustomers = num(f.new_customers);
  const cac = f.cac_blended === null || f.cac_blended === undefined || newCustomers < CAC_MIN_NEW_CUSTOMERS ? null : num(f.cac_blended);
  const contribution = num(f.contribution_per_order);

  // La palanca solo se calcula cuando el beneficio se puede creer (regla F7 del
  // panel): sobre un coste de producto a cero seria una cifra inventada.
  const levers: ProfitLever[] =
    tier === "datos" || num(f.cogs) <= 0
      ? []
      : opportunities(
          {
            net_revenue_ex_tax: revenue,
            net_margin_pct: marginPct,
            contribution_per_order: contribution,
            cac_blended: cac,
            new_customers: newCustomers,
          },
          sessions ? { ...sessions, orders_count: orders } : null,
          input.targets,
          input.periodDays,
          input.store.currency_code,
        ).map(({ clave, palanca, eur_mes, regla }) => ({ clave, palanca, eur_mes, regla }));

  const prev = input.previous;
  const prevRevenue = prev ? num(prev.net_revenue_ex_tax) : null;
  const prevProfit = prev ? num(prev.net_profit) + num(prev.fixed_costs) * (1 - share) : null;

  return {
    store_id: input.store.id,
    organization_id: input.store.organization_id,
    organization_name: input.store.organization_name,
    connection_id: input.store.connection_id,
    shop_name: input.store.shop_name ?? input.store.domain ?? "Tienda",
    domain: input.store.domain,
    currency_code: input.store.currency_code,
    revenue,
    orders,
    net_profit: netProfit,
    fixed_share: share,
    margin_pct: marginPct,
    margin_target: marginTarget,
    per_order: {
      aov_ex_tax: num(f.aov_ex_tax),
      cogs: num(f.cogs_per_order),
      shipping: num(f.shipping_per_order),
      fees: num(f.payment_fee_per_order),
      ads: num(f.cac_per_order),
      fixed: num(f.fixed_per_order) * share,
      profit: orders > 0 ? netProfit / orders : 0,
      contribution,
      breakeven_cac: num(f.breakeven_cac_per_order),
    },
    ads_spend: num(f.ads_spend),
    new_customers: newCustomers,
    cac,
    cac_target: input.targets.cac_blended ?? null,
    sessions: sessions?.has_sessions ? sessions.sessions : null,
    conversion_pct: sessions?.has_sessions && sessions.sessions > 0 ? (orders / sessions.sessions) * 100 : null,
    conversion_target: input.targets.conversion_rate ?? null,
    prev_revenue: prevRevenue,
    prev_profit: prevProfit,
    prev_orders: prev ? num(prev.orders_count) : null,
    revenue_change_pct: prevRevenue === null ? null : changePct(revenue, prevRevenue),
    profit_change_pct: prevProfit === null ? null : changePct(netProfit, prevProfit),
    tier,
    flags,
    levers,
    lever_total: levers.reduce((total, lever) => total + lever.eur_mes, 0),
    daily: input.daily ?? [],
  };
}

export const overCacTarget = (store: Pick<ProfitStoreRow, "cac" | "cac_target">): boolean =>
  store.cac !== null && store.cac_target !== null && store.cac > store.cac_target;

// ---------------------------------------------------------------------------
// Agregados: cliente y cartera
// ---------------------------------------------------------------------------

export type ProfitClientRow = {
  organization_id: string;
  name: string;
  store_count: number;
  /** `null` si el cliente mezcla monedas: no se suman importes de divisas distintas. */
  currency_code: string | null;
  revenue: number | null;
  net_profit: number | null;
  margin_pct: number | null;
  margin_target: number | null;
  revenue_change_pct: number | null;
  contribution_per_order: number | null;
  cac: number | null;
  cac_target: number | null;
  tier: ProfitTier;
  flags: ProfitFlag[];
  lever_total: number;
  orders: number;
};

const weighted = (
  items: Array<{ value: number | null; weight: number }>,
): number | null => {
  const usable = items.filter(
    (item): item is { value: number; weight: number } => item.value !== null && item.weight > 0,
  );
  const weight = usable.reduce((total, item) => total + item.weight, 0);
  if (weight <= 0) return null;
  return usable.reduce((total, item) => total + item.value * item.weight, 0) / weight;
};

function mergeFlags(stores: ProfitStoreRow[]): ProfitFlag[] {
  const byKey = new Map<ProfitFlagKey, ProfitFlag>();
  for (const flag of stores.flatMap((store) => store.flags)) {
    if (!byKey.has(flag.key)) byKey.set(flag.key, flag);
  }
  return [...byKey.values()].sort((a, b) => Number(b.blocking) - Number(a.blocking));
}

export function compareRows(
  a: { tier: ProfitTier; net_profit: number | null; margin_pct: number | null; revenue: number | null },
  b: { tier: ProfitTier; net_profit: number | null; margin_pct: number | null; revenue: number | null },
): number {
  const tierDelta = PROFIT_TIER_ORDER.indexOf(a.tier) - PROFIT_TIER_ORDER.indexOf(b.tier);
  if (tierDelta !== 0) return tierDelta;
  if (a.tier === "pierde") return (a.net_profit ?? 0) - (b.net_profit ?? 0);
  if (a.tier === "datos") return (b.revenue ?? 0) - (a.revenue ?? 0);
  return (a.margin_pct ?? 0) - (b.margin_pct ?? 0);
}

export function sortStores(stores: ProfitStoreRow[]): ProfitStoreRow[] {
  return [...stores].sort(compareRows);
}

export function aggregateClients(stores: ProfitStoreRow[]): ProfitClientRow[] {
  const byOrg = new Map<string, ProfitStoreRow[]>();
  for (const store of stores) {
    byOrg.set(store.organization_id, [...(byOrg.get(store.organization_id) ?? []), store]);
  }

  const clients = [...byOrg.entries()].map(([organizationId, own]): ProfitClientRow => {
    const currencies = new Set(own.map((store) => store.currency_code));
    const currency = currencies.size === 1 ? ([...currencies][0] ?? null) : null;
    const mixed = currencies.size > 1 || currency === null;
    const flags = mergeFlags(own);
    if (currencies.size > 1) {
      flags.unshift({ key: "mixed_currency", label: "Varias monedas", blocking: true });
    }

    if (mixed || own.some((store) => store.flags.some((flag) => flag.key === "financial_unverified"))) {
      return {
        organization_id: organizationId,
        name: own[0]?.organization_name ?? "Cliente",
        store_count: own.length,
        currency_code: mixed ? null : currency,
        revenue: null,
        net_profit: null,
        margin_pct: null,
        margin_target: null,
        revenue_change_pct: null,
        contribution_per_order: null,
        cac: null,
        cac_target: null,
        tier: "datos",
        flags,
        lever_total: 0,
        orders: own.reduce((total, store) => total + store.orders, 0),
      };
    }

    const revenue = own.reduce((total, store) => total + store.revenue, 0);
    const profit = own.reduce((total, store) => total + store.net_profit, 0);
    const orders = own.reduce((total, store) => total + store.orders, 0);
    const ads = own.reduce((total, store) => total + store.ads_spend, 0);
    const newCustomers = own.reduce((total, store) => total + store.new_customers, 0);
    const prevRevenue = own.every((store) => store.prev_revenue !== null)
      ? own.reduce((total, store) => total + (store.prev_revenue ?? 0), 0)
      : null;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const marginTarget = weighted(own.map((store) => ({ value: store.margin_target, weight: store.revenue })));
    const hasBlocking = own.some((store) => store.tier === "datos");

    return {
      organization_id: organizationId,
      name: own[0]?.organization_name ?? "Cliente",
      store_count: own.length,
      currency_code: currency,
      revenue,
      net_profit: profit,
      margin_pct: margin,
      margin_target: marginTarget,
      revenue_change_pct: prevRevenue === null ? null : changePct(revenue, prevRevenue),
      contribution_per_order: weighted(
        own.map((store) => ({
          value: store.tier === "datos" ? null : store.per_order.contribution,
          weight: store.orders,
        })),
      ),
      cac: newCustomers >= CAC_MIN_NEW_CUSTOMERS && ads > 0 ? ads / newCustomers : null,
      cac_target: weighted(own.map((store) => ({ value: store.cac_target, weight: store.new_customers }))),
      tier: hasBlocking
        ? "datos"
        : classifyTier({ flags: [], net_profit: profit, net_margin_pct: margin, margin_target: marginTarget }),
      flags,
      lever_total: own.reduce((total, store) => total + store.lever_total, 0),
      orders,
    };
  });

  return clients.sort((a, b) => compareRows(a, b));
}

export type ProfitTotals = {
  /** Moneda de los totales: la mayoritaria de la cartera. Las demas no suman. */
  currency_code: string | null;
  stores_counted: number;
  stores_excluded: number;
  revenue: number;
  net_profit: number;
  margin_pct: number;
  orders: number;
  aov: number;
  ads_spend: number;
  prev_revenue: number | null;
  prev_profit: number | null;
  revenue_change_pct: number | null;
  profit_change_pct: number | null;
  orders_change_pct: number | null;
  aov_change_pct: number | null;
  /** Costes del periodo en la moneda de los totales, reconstruidos desde el coste por pedido. */
  costs: { cogs: number; shipping: number; fees: number; ads: number; fixed: number };
  lever_total: number;
  levers_by_key: Record<Opportunity["clave"], number>;
  counts: {
    stores: number;
    clients: number;
    pierde: number;
    datos: number;
    bajo: number;
    ok: number;
    reliable: number;
    over_cac: number;
    with_ads: number;
  };
};

function baseCurrency(stores: ProfitStoreRow[]): string | null {
  const tally = new Map<string, number>();
  for (const store of stores) {
    if (store.currency_code) tally.set(store.currency_code, (tally.get(store.currency_code) ?? 0) + 1);
  }
  const ranked = [...tally.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] === "EUR" ? -1 : b[0] === "EUR" ? 1 : a[0].localeCompare(b[0])),
  );
  return ranked[0]?.[0] ?? null;
}

export function aggregateTotals(stores: ProfitStoreRow[]): ProfitTotals {
  const verified = stores.filter((store) => !store.flags.some((flag) => flag.key === "financial_unverified"));
  const currency = baseCurrency(verified);
  const counted = verified.filter((store) => store.currency_code === currency && currency !== null);
  const revenue = counted.reduce((total, store) => total + store.revenue, 0);
  const profit = counted.reduce((total, store) => total + store.net_profit, 0);
  const orders = counted.reduce((total, store) => total + store.orders, 0);
  const prevComparable = counted.length > 0 && counted.every((store) => store.prev_revenue !== null);
  const prevRevenue = prevComparable ? counted.reduce((total, store) => total + (store.prev_revenue ?? 0), 0) : null;
  const prevProfit = prevComparable ? counted.reduce((total, store) => total + (store.prev_profit ?? 0), 0) : null;
  const prevOrders = prevComparable ? counted.reduce((total, store) => total + (store.prev_orders ?? 0), 0) : null;
  const levers: Record<Opportunity["clave"], number> = { margen: 0, conversion: 0, cac: 0 };
  for (const lever of counted.flatMap((store) => store.levers)) levers[lever.clave] += lever.eur_mes;

  return {
    currency_code: currency,
    stores_counted: counted.length,
    stores_excluded: stores.length - counted.length,
    revenue,
    net_profit: profit,
    margin_pct: revenue > 0 ? (profit / revenue) * 100 : 0,
    orders,
    aov: orders > 0 ? revenue / orders : 0,
    ads_spend: counted.reduce((total, store) => total + store.ads_spend, 0),
    prev_revenue: prevRevenue,
    prev_profit: prevProfit,
    revenue_change_pct: prevRevenue === null ? null : changePct(revenue, prevRevenue),
    profit_change_pct: prevProfit === null ? null : changePct(profit, prevProfit),
    orders_change_pct: prevOrders === null ? null : changePct(orders, prevOrders),
    aov_change_pct:
      prevOrders === null || prevRevenue === null || prevOrders === 0 || orders === 0
        ? null
        : changePct(revenue / orders, prevRevenue / prevOrders),
    costs: {
      cogs: counted.reduce((total, store) => total + store.per_order.cogs * store.orders, 0),
      shipping: counted.reduce((total, store) => total + store.per_order.shipping * store.orders, 0),
      fees: counted.reduce((total, store) => total + store.per_order.fees * store.orders, 0),
      ads: counted.reduce((total, store) => total + store.ads_spend, 0),
      fixed: counted.reduce((total, store) => total + store.per_order.fixed * store.orders, 0),
    },
    lever_total: levers.margen + levers.conversion + levers.cac,
    levers_by_key: levers,
    counts: {
      stores: stores.length,
      clients: new Set(stores.map((store) => store.organization_id)).size,
      pierde: stores.filter((store) => store.tier === "pierde").length,
      datos: stores.filter((store) => store.tier === "datos").length,
      bajo: stores.filter((store) => store.tier === "bajo").length,
      ok: stores.filter((store) => store.tier === "ok").length,
      reliable: stores.filter((store) => store.tier !== "datos").length,
      over_cac: stores.filter(overCacTarget).length,
      with_ads: stores.filter((store) => store.cac !== null).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Titulares del consultor (primer h1 de cada alcance)
// ---------------------------------------------------------------------------

export type PanelHeadline = { title: string; detail: string };

export function periodLabel(days: number): string {
  if (days >= 365) return "el último año";
  return `${days} días`;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

const FLAG_PHRASE: Partial<Record<ProfitFlagKey, string>> = {
  financial_unverified: "faltan importes, costes o sincronización verificables",
  no_cogs: "falta el coste de producto",
  no_fixed: "no hay gastos fijos",
  no_settings: "faltan comisiones y envío por pedido",
  no_currency: "la tienda no tiene moneda confirmada",
  mixed_currency: "hay tiendas en monedas distintas",
};

function flagPhrase(flags: ProfitFlag[]): string {
  const phrases = flags
    .filter((flag) => flag.blocking)
    .flatMap((flag) => FLAG_PHRASE[flag.key] ?? []);
  if (phrases.length === 0) return "faltan datos de costes";
  if (phrases.length === 1) return phrases[0]!;
  return `${phrases.slice(0, -1).join(", ")} y ${phrases[phrases.length - 1]}`;
}

/** "Vende un 4,8 % más que el periodo anterior, pero gana un 6,2 % menos." */
function comparison(
  revenueChange: number | null,
  profitChange: number | null,
  verb: string,
): string {
  if (revenueChange === null) return "";
  const direction = (value: number) => (value >= 0 ? "más" : "menos");
  const amount = (value: number) => panelPct(Math.abs(value));
  const sales = `${verb} un ${amount(revenueChange)} ${direction(revenueChange)} que el periodo anterior`;
  if (profitChange === null) return `${sales}.`;
  const sameDirection = revenueChange >= 0 === profitChange >= 0;
  return `${sales}${sameDirection ? " y" : ", pero"} gana un ${amount(profitChange)} ${direction(profitChange)}.`;
}

export function buildPortfolioHeadline(totals: ProfitTotals, days: number): PanelHeadline {
  const { counts } = totals;
  const money = (value: number, digits = 0) => panelMoney(value, totals.currency_code, digits);

  let title: string;
  if (counts.stores === 0) {
    title = "Todavía no hay tiendas en tu cartera para calcular la rentabilidad.";
  } else if (totals.orders === 0 && counts.datos === counts.stores) {
    title = `Ninguna tienda tiene pedidos en ${periodLabel(days)}: no hay rentabilidad que calcular.`;
  } else if (counts.pierde > 0 && counts.datos > 0) {
    title = `${counts.pierde} ${plural(counts.pierde, "tienda pierde", "tiendas pierden")} dinero y ${counts.datos} no ${plural(counts.datos, "tiene", "tienen")} datos para saber si lo ${plural(counts.datos, "gana", "ganan")}.`;
  } else if (counts.pierde > 0) {
    title = `${counts.pierde} ${plural(counts.pierde, "tienda pierde", "tiendas pierden")} dinero en ${periodLabel(days)}.`;
  } else if (counts.datos > 0) {
    title = `${counts.datos} ${plural(counts.datos, "tienda no tiene", "tiendas no tienen")} datos para saber si ${plural(counts.datos, "gana", "ganan")} dinero.`;
  } else if (counts.bajo > 0) {
    title = `Ninguna tienda pierde dinero, pero ${counts.bajo} ${plural(counts.bajo, "está", "están")} por debajo de su objetivo de margen.`;
  } else {
    title = "Tu cartera cumple sus objetivos de margen.";
  }

  const base =
    counts.stores > 0 && totals.currency_code && totals.revenue > 0
      ? `La cartera factura ${money(totals.revenue)} sin IVA y deja ${money(totals.net_profit)} de beneficio neto, un ${panelPct(totals.margin_pct)} de margen. `
      : "";
  const detail = `${base}${comparison(totals.revenue_change_pct, totals.profit_change_pct, "Vende")}`.trim();

  return { title, detail };
}

export function buildClientHeadline(
  client: ProfitClientRow,
  stores: ProfitStoreRow[],
  days: number,
): PanelHeadline {
  const money = (value: number, digits = 0) => panelMoney(value, client.currency_code, digits);
  const own = stores.filter((store) => store.organization_id === client.organization_id);
  const name = client.name;

  if (client.orders === 0) {
    return {
      title: `${name} no tiene pedidos en ${periodLabel(days)}: no hay rentabilidad que calcular.`,
      detail: "",
    };
  }
  if (client.tier === "datos" || client.net_profit === null || client.revenue === null || client.margin_pct === null) {
    return {
      title: `El beneficio de ${name} es una estimación: ${flagPhrase(client.flags)}.`,
      detail: "Hasta completarlo, ninguna cifra de beneficio, margen o palanca de este cliente es firme.",
    };
  }

  const worstByProfit = [...own].sort((a, b) => a.net_profit - b.net_profit)[0];
  const overCac = own
    .filter(overCacTarget)
    .sort((a, b) => b.cac! / b.cac_target! - a.cac! / a.cac_target!)[0];
  const target = client.margin_target;

  let title: string;
  if (client.tier === "pierde") {
    title = `${name} pierde ${money(Math.abs(client.net_profit))} en ${periodLabel(days)}${
      own.length > 1 && worstByProfit && worstByProfit.net_profit < 0 ? `: ${worstByProfit.shop_name} es la que más resta` : ""
    }.`;
  } else if (overCac) {
    title = `${name} gana ${money(client.net_profit)}, pero ${overCac.shop_name} paga ${panelMoney(overCac.cac!, overCac.currency_code, 1)} por cada cliente nuevo y su objetivo es ${panelMoney(overCac.cac_target!, overCac.currency_code, 1)}.`;
  } else if (client.tier === "bajo" && target !== null) {
    title = `${name} gana ${money(client.net_profit)}, pero se queda en un ${panelPct(client.margin_pct)} de margen frente al ${panelPct(target, 0)} que fijaste.`;
  } else {
    title = `${name} cumple su objetivo: ${money(client.net_profit)} de beneficio con un ${panelPct(client.margin_pct)} de margen.`;
  }

  const lowestPerOrder = [...own]
    .filter((store) => store.orders > 0)
    .sort((a, b) => a.per_order.profit - b.per_order.profit)[0];
  const summary = `${own.length > 1 ? `Las ${own.length} tiendas suman` : "La tienda factura"} ${money(client.revenue)} sin IVA${
    client.revenue_change_pct === null
      ? ""
      : `, un ${panelPct(Math.abs(client.revenue_change_pct))} ${client.revenue_change_pct >= 0 ? "más" : "menos"} que el periodo anterior`
  }, con un ${panelPct(client.margin_pct)} de margen${target !== null ? ` frente al ${panelPct(target, 0)} fijado` : ""}.`;
  const weakest =
    own.length > 1 && lowestPerOrder
      ? ` ${lowestPerOrder.shop_name} es la que menos deja por pedido (${panelMoney(lowestPerOrder.per_order.profit, lowestPerOrder.currency_code, 2)}).`
      : "";

  return { title, detail: `${summary}${weakest}` };
}

export function buildStoreHeadline(store: ProfitStoreRow, days: number): PanelHeadline {
  const money = (value: number, digits = 2) => panelMoney(value, store.currency_code, digits);

  if (store.orders === 0) {
    return {
      title: `Sin pedidos en ${periodLabel(days)}: no hay rentabilidad que calcular en esta tienda.`,
      detail: "",
    };
  }
  if (store.tier === "datos") {
    return {
      title: `El beneficio de esta tienda es una estimación: ${flagPhrase(store.flags)}.`,
      detail: "Hasta completarlo, el beneficio, el margen y las palancas de esta tienda no son firmes.",
    };
  }

  const aov = store.per_order.aov_ex_tax;
  const productShipping = aov > 0 ? ((store.per_order.cogs + store.per_order.shipping) / aov) * 100 : 0;
  const ads = aov > 0 ? (store.per_order.ads / aov) * 100 : 0;
  const verb = store.per_order.profit >= 0 ? "deja" : "pierde";
  const adsClause =
    store.per_order.ads > 0
      ? ` y la publicidad ${store.per_order.profit >= 0 ? "otro" : "el"} ${panelNumber(ads)} %`
      : "";
  const title = `Cada pedido ${verb} ${money(Math.abs(store.per_order.profit))}: producto y envío se llevan el ${panelNumber(productShipping)} % del ticket${adsClause}.`;

  const target = store.margin_target;
  const profitLine = `Beneficio neto de ${money(store.net_profit, 0)} en ${periodLabel(days)}, un ${panelPct(store.margin_pct)} de margen${
    target !== null ? ` frente al ${panelPct(target, 0)} que fijaste` : ""
  }.`;
  const compare = comparison(store.revenue_change_pct, store.profit_change_pct, "Vende");
  return { title, detail: `${profitLine} ${compare}`.trim() };
}
