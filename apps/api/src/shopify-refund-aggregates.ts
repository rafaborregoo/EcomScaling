import type { SupabaseClient } from "@supabase/supabase-js";

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

  const { data: refundItems } = await supabase
    .from("shopify_refund_items")
    .select("order_item_id, quantity, subtotal, total_tax")
    .in("order_item_id", uniqueIds);

  const aggregates = new Map<string, { quantity: number; amount: number }>();

  for (const row of refundItems ?? []) {
    const current = aggregates.get(row.order_item_id) ?? { quantity: 0, amount: 0 };
    current.quantity += row.quantity ?? 0;
    current.amount += (row.subtotal ?? 0) + (row.total_tax ?? 0);
    aggregates.set(row.order_item_id, current);
  }

  for (const id of uniqueIds) {
    const aggregate = aggregates.get(id) ?? { quantity: 0, amount: 0 };
    await supabase
      .from("shopify_order_items")
      .update({ refunded_quantity: aggregate.quantity, refunded_amount: aggregate.amount })
      .eq("id", id);
  }
}
