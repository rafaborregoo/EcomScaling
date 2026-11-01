export type PortfolioStore = {
  store_id: string;
  organization_id: string;
  organization_name: string;
  shop_name: string;
  orders_count: number;
  currency_code: string | null;
  net_sales: number | null;
  aov: number | null;
};

export type MatrixKey =
  | "name"
  | "sales"
  | "orders"
  | "roas"
  | "cac"
  | "dep"
  | "email"
  | "emailRev"
  | "alerts";
export type MatrixRow = {
  id: string;
  name: string;
  tier: "urgente" | "revisar" | "vigilar" | "al_dia";
  rank: number;
  sales: number | null;
  salesCurrencyCode: string | null;
  orders: number | null;
  roas: number | null;
  breakEven: number | null;
  cac: number | null;
  cacCurrencyCode: string | null;
  cacDelta: number | null;
  dep: number | null;
  sent: number | null;
  lastSend: string | null;
  emailRev: number | null;
  emailRevCurrencyCode: string | null;
  alerts: number;
};

/** Una referencia ausente o inválida no permite declarar que una cuenta va bien. */
export function roasPosition(value: number | null, benchmark: number | null) {
  if (value == null || benchmark == null || benchmark <= 0) return null;
  return value < benchmark ? "below" : value === benchmark ? "at" : "above";
}

/** Una devolución también cuenta: las monedas se agrupan, nunca se convierten ni se suman entre sí. */
export function revenueByCurrency(stores: readonly PortfolioStore[]) {
  const groups = new Map<string, { sales: number; orders: number }>();
  for (const store of stores) {
    if (store.net_sales == null || !store.currency_code) continue;
    const entry = groups.get(store.currency_code) ?? { sales: 0, orders: 0 };
    entry.sales += store.net_sales;
    entry.orders += store.orders_count;
    groups.set(store.currency_code, entry);
  }
  return [...groups.entries()]
    .filter(([, value]) => value.orders > 0 || value.sales !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

export function sortPortfolio(
  rows: readonly MatrixRow[],
  sort: { key: MatrixKey; dir: 1 | -1 } | null,
) {
  if (!sort) return [...rows];
  const currency = (row: MatrixRow) =>
    sort.key === "sales"
      ? row.salesCurrencyCode
      : sort.key === "cac"
        ? row.cacCurrencyCode
        : sort.key === "emailRev"
          ? row.emailRevCurrencyCode
          : null;
  const value = (row: MatrixRow) =>
    sort.key === "name"
      ? row.name
      : sort.key === "email"
        ? row.sent
        : row[sort.key];
  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av == null && bv == null) return a.rank - b.rank;
    if (av == null) return 1;
    if (bv == null) return -1;
    const ac = currency(a);
    const bc = currency(b);
    if (["sales", "cac", "emailRev"].includes(sort.key) && (!ac || !bc)) {
      if (!ac && !bc) return a.rank - b.rank;
      return ac ? -1 : 1;
    }
    if (ac !== bc) return (ac ?? "~").localeCompare(bc ?? "~");
    return (
      (typeof av === "string" || typeof bv === "string"
        ? String(av).localeCompare(String(bv), "es")
        : av - bv) * sort.dir || a.rank - b.rank
    );
  });
}
