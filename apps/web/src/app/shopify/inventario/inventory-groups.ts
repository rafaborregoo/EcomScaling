import { fmtNum } from "../../dashboard/client-pulse-model";

export type InventoryFilter = "" | "out" | "low" | "ok" | "unread" | "untracked";

export type InventoryRow = {
  product_id: string;
  store_id: string;
  store_name: string;
  product_title: string;
  category: string | null;
  variant_id: string;
  variant_title: string | null;
  inventory_item_id: string | null;
  sku: string | null;
  tracked: boolean;
  location_id: string | null;
  location_name: string | null;
  available_quantity: number | null;
  on_hand_quantity: number | null;
  committed_quantity: number | null;
  incoming_quantity: number | null;
  updated_at: string | null;
  is_stale: boolean | null;
};

export type InventorySummary = {
  total_count: number;
  out_count: number;
  low_count: number;
  ok_count: number;
  untracked_count: number;
  unread_count: number;
  out_products: number;
  low_products: number;
};

export type InventoryResponse = {
  organization_id: string;
  page: number;
  page_size: number;
  total: number;
  coverage: "available" | "migration_pending";
  summary?: InventorySummary | null;
  rows: InventoryRow[];
};

export type InventoryTone = "bad" | "warn" | undefined;

/** Cada grupo tiene su página: /shopify/inventario/<slug>. */
export const INVENTORY_GROUPS: Array<{ slug: string; filter: InventoryFilter; label: string }> = [
  { slug: "agotados", filter: "out", label: "Agotados" },
  { slug: "stock-bajo", filter: "low", label: "Stock bajo" },
  { slug: "con-stock", filter: "ok", label: "Con stock" },
  { slug: "sin-lectura", filter: "unread", label: "Sin lectura" },
  { slug: "sin-seguimiento", filter: "untracked", label: "Sin seguimiento" },
  { slug: "todo", filter: "", label: "Todo el inventario" },
];

export function groupBySlug(slug: string) {
  return INVENTORY_GROUPS.find((group) => group.slug === slug) ?? null;
}

export function groupByFilter(filter: string) {
  return INVENTORY_GROUPS.find((group) => group.filter === filter && filter !== "") ?? null;
}

function productsText(count: number) {
  return count === 1 ? "en 1 producto" : `en ${fmtNum(count)} productos`;
}

/** Cifra y explicación de cada card. Los grupos de calidad del dato solo salen si tienen algo. */
export function groupCards(summary: InventorySummary) {
  const cards: Array<{ filter: InventoryFilter; value: number; hint: string; tone: InventoryTone }> = [
    { filter: "out", value: summary.out_count, hint: productsText(summary.out_products), tone: summary.out_count ? "bad" : undefined },
    { filter: "low", value: summary.low_count, hint: `5 uds. o menos · ${productsText(summary.low_products)}`, tone: summary.low_count ? "warn" : undefined },
    { filter: "ok", value: summary.ok_count, hint: "más de 5 uds.", tone: undefined },
    { filter: "unread", value: summary.unread_count, hint: "Shopify no ha enviado el dato", tone: undefined },
    { filter: "untracked", value: summary.untracked_count, hint: "Shopify no cuenta su stock", tone: undefined },
  ];
  return cards
    .filter((card) => card.value > 0 || card.filter === "out" || card.filter === "low" || card.filter === "ok")
    .map((card) => ({ ...card, ...groupByFilter(card.filter)! }));
}

/** Conserva organizationId/connectionId de la URL al saltar entre páginas del inventario. */
export function inventoryHref(slug: string | null, search: string) {
  const current = new URLSearchParams(search);
  const params = new URLSearchParams();
  for (const key of ["organizationId", "connectionId"]) {
    const value = current.get(key);
    if (value) params.set(key, value);
  }
  return `/shopify/inventario${slug ? `/${slug}` : ""}${params.size ? `?${params.toString()}` : ""}`;
}
