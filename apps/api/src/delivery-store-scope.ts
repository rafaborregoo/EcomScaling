export type DeliveryStoreScope =
  | { ok: true; storeId: string | null; storeLabel: string }
  | { ok: false; statusCode: 404 | 503; error: string; detail?: string };

/** Resolve an explicit connection strictly; never downgrade a bad store ID to
 * organization-wide data. A missing connectionId intentionally means aggregate. */
export function resolveDeliveryStoreScope(
  connectionId: string | null | undefined,
  lookup: { data: { id: string; shop_name: string } | null; error?: { message: string } | null },
): DeliveryStoreScope {
  if (!connectionId) return { ok: true, storeId: null, storeLabel: "todas las tiendas de la organización" };
  if (lookup.error) return { ok: false, statusCode: 503, error: "delivery_store_scope_unavailable", detail: lookup.error.message };
  if (!lookup.data) return { ok: false, statusCode: 404, error: "delivery_store_not_found" };
  return { ok: true, storeId: lookup.data.id, storeLabel: `la tienda "${lookup.data.shop_name}"` };
}
