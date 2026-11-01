export type ShopifyInventoryLevel = {
  variant_id: string;
  variant_title: string | null;
  sku: string | null;
  location_id: string;
  location_name: string | null;
  available_quantity: number | null;
  updated_at: string | null;
};

type Variant = { id: string; product_id: string; title: string | null };
type InventoryItem = { id: string; variant_id: string; sku: string | null };
type InventoryState = {
  inventory_item_id: string;
  location_id: string;
  available_quantity: number | null;
  updated_at: string | null;
};
type Location = { id: string; name: string | null };

async function readAllRows<T>(buildQuery: () => any) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await buildQuery().range(offset, offset + 999);
    if (error) return { data: null, error };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) return { data: rows, error: null };
  }
}

async function readRowsForIds<T>(
  ids: string[],
  buildQuery: (batch: string[]) => any,
) {
  const rows: T[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await readAllRows<T>(() =>
      buildQuery(ids.slice(offset, offset + 100)),
    );
    if (result.error) return result;
    rows.push(...(result.data ?? []));
  }
  return { data: rows, error: null };
}

export function mapShopifyInventoryLevels(
  variants: Variant[],
  inventoryItems: InventoryItem[],
  states: InventoryState[],
  locations: Location[],
) {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const itemById = new Map(inventoryItems.map((item) => [item.id, item]));
  const locationById = new Map(
    locations.map((location) => [location.id, location]),
  );
  const levelsByProduct = new Map<string, ShopifyInventoryLevel[]>();
  for (const state of states) {
    const inventoryItem = itemById.get(state.inventory_item_id);
    const variant = inventoryItem
      ? variantById.get(inventoryItem.variant_id)
      : null;
    if (!inventoryItem || !variant) continue;
    const levels = levelsByProduct.get(variant.product_id) ?? [];
    levels.push({
      variant_id: variant.id,
      variant_title: variant.title,
      sku: inventoryItem.sku,
      location_id: state.location_id,
      location_name: locationById.get(state.location_id)?.name ?? null,
      available_quantity:
        state.available_quantity == null
          ? null
          : Number(state.available_quantity),
      updated_at: state.updated_at,
    });
    levelsByProduct.set(variant.product_id, levels);
  }
  for (const levels of levelsByProduct.values()) {
    levels.sort(
      (a, b) =>
        (a.location_name ?? "").localeCompare(b.location_name ?? "") ||
        (a.variant_title ?? "").localeCompare(b.variant_title ?? ""),
    );
  }
  return levelsByProduct;
}

/** Reads the canonical product → variant → inventory item → location chain. */
export async function loadShopifyInventoryLevels(
  supabase: any,
  organizationId: string,
  productIds: string[],
) {
  if (!productIds.length) {
    return { data: new Map<string, ShopifyInventoryLevel[]>(), error: null };
  }
  const variantsResult = await readAllRows<Variant>(() =>
    supabase
      .from("shopify_variants")
      .select("id, product_id, title")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("product_id", productIds)
      .order("position", { ascending: true })
      .order("id", { ascending: true }),
  );
  if (variantsResult.error) return { data: null, error: variantsResult.error };
  const variants = variantsResult.data ?? [];
  const inventoryItemsResult = await readRowsForIds<InventoryItem>(
    variants.map((variant) => variant.id),
    (batch) =>
      supabase
        .from("shopify_inventory_items")
        .select("id, variant_id, sku")
        .eq("organization_id", organizationId)
        .in("variant_id", batch)
        .order("id", { ascending: true }),
  );
  if (inventoryItemsResult.error)
    return { data: null, error: inventoryItemsResult.error };
  const inventoryItems = inventoryItemsResult.data ?? [];
  const statesResult = await readRowsForIds<InventoryState>(
    inventoryItems.map((item) => item.id),
    (batch) =>
      supabase
        .from("shopify_inventory_current_state")
        .select(
          "inventory_item_id, location_id, available_quantity, updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("inventory_item_id", batch)
        .order("inventory_item_id", { ascending: true })
        .order("location_id", { ascending: true }),
  );
  if (statesResult.error) return { data: null, error: statesResult.error };
  const states = statesResult.data ?? [];
  const locationIds = [...new Set(states.map((state) => state.location_id))];
  const locationsResult = await readRowsForIds<Location>(locationIds, (batch) =>
    supabase
      .from("shopify_locations")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", batch)
      .order("id", { ascending: true }),
  );
  if (locationsResult.error)
    return { data: null, error: locationsResult.error };
  return {
    data: mapShopifyInventoryLevels(
      variants,
      inventoryItems,
      states,
      locationsResult.data ?? [],
    ),
    error: null,
  };
}
