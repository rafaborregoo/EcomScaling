import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingShopifyNetMetricsSchema } from "./shopify-order-line-net.js";

/**
 * shopify_order_items.refunded_quantity/refunded_amount are denormalized
 * for fast reads (metrics shouldn't have to join+sum refund_items on every
 * query). This recomputes both from the full set of shopify_refund_items
 * rows for each order item, so it stays correct across partial refunds and
 * is safe to call repeatedly (idempotent, not an increment).
 */
export async function applyRefundAggregatesToOrderItems(supabase: SupabaseClient, orderItemIds: Array<string | null | undefined>) {
  const uniqueIds = [...new Set(orderItemIds.filter((id): id is string => Boolean(id)))];

  if (!uniqueIds.length) {
    return;
  }

  const { data: refundItems, error: refundItemsError } = await supabase
    .from("shopify_refund_items")
    .select("order_item_id, quantity, subtotal, total_tax")
    .in("order_item_id", uniqueIds);
  if (refundItemsError) throw new Error(refundItemsError.message);

  const aggregates = new Map<string, { quantity: number; amount: number; subtotal: number }>();

  for (const row of refundItems ?? []) {
    const current = aggregates.get(row.order_item_id) ?? { quantity: 0, amount: 0, subtotal: 0 };
    current.quantity += row.quantity ?? 0;
    current.amount += (row.subtotal ?? 0) + (row.total_tax ?? 0);
    current.subtotal += row.subtotal ?? 0;
    aggregates.set(row.order_item_id, current);
  }

  let netMetricsAvailable = true;
  let { data: orderItems, error: orderItemsError } = await supabase
    .from("shopify_order_items")
    .select("id, quantity_current, quantity_original, original_line_total, discount_total, refunded_quantity, refunded_amount, net_metrics_source")
    .in("id", uniqueIds);
  if (orderItemsError && isMissingShopifyNetMetricsSchema(orderItemsError.message)) {
    netMetricsAvailable = false;
    const legacyRead = await supabase
      .from("shopify_order_items")
      .select("id, quantity_current, quantity_original, original_line_total, discount_total, refunded_quantity, refunded_amount")
      .in("id", uniqueIds);
    orderItems = legacyRead.data as unknown as typeof orderItems;
    orderItemsError = legacyRead.error;
  }
  if (orderItemsError) throw new Error(orderItemsError.message);
  const orderItemById = new Map((orderItems ?? []).map((row) => [row.id, row as {
    id: string;
    quantity_current: number | null;
    quantity_original: number | null;
    original_line_total: number | null;
    discount_total: number | null;
    refunded_quantity: number | null;
    refunded_amount: number | null;
    net_metrics_source?: string | null;
  }]));

  for (const id of uniqueIds) {
    const orderItem = orderItemById.get(id);
    if (!orderItem) continue;
    const aggregate = aggregates.get(id) ?? {
      quantity: orderItem.refunded_quantity ?? 0,
      amount: orderItem.refunded_amount ?? 0,
      subtotal: 0,
    };

    const update: Record<string, number | string | null> = {
      refunded_quantity: aggregate.quantity,
      refunded_amount: aggregate.amount,
    };
    if (netMetricsAvailable && orderItem.net_metrics_source === "shopify_rest_estimate") {
      const originalQuantity = Math.max(0, orderItem.quantity_original ?? 0);
      const currentQuantity = Math.max(0, orderItem.quantity_current ?? 0);
      const currentRatio = originalQuantity > 0
        ? Math.min(1, currentQuantity / originalQuantity)
        : 0;
      const discountedCurrentSubtotal = Math.max(
        0,
        ((orderItem.original_line_total ?? 0) - (orderItem.discount_total ?? 0)) * currentRatio,
      );
      update.net_quantity = Math.max(0, currentQuantity - aggregate.quantity);
      if (!aggregates.has(id) && aggregate.quantity > 0) {
        // The historical aggregate says units were refunded, but without the
        // refund line subtotal we cannot calculate a trustworthy net revenue.
        update.net_revenue = null;
        update.net_metrics_source = null;
      } else {
        update.net_revenue = Math.max(0, Math.round((discountedCurrentSubtotal - aggregate.subtotal + Number.EPSILON) * 100) / 100);
      }
    }

    const { error } = await supabase
      .from("shopify_order_items")
      .update(update)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}
