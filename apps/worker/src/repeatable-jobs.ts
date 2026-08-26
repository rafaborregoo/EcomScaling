export const SHOPIFY_RECONCILE_CRON = "0 2 * * *";
export const SHOPIFY_RECONCILE_TZ = "Europe/Madrid";
export const FATHOM_WEBHOOK_CRON = "* * * * *";
export const FATHOM_WEBHOOK_TZ = "Europe/Madrid";

// BullMQ indexa los jobs repetibles por su configuracion de repeat, no solo por
// jobId: cambiar de `every` (6h) a `pattern` (cron diario) deja el job viejo
// huerfano en Redis si no se borra explicitamente, duplicando el reconcile.
export function isStaleShopifyReconcileRepeatable(
  repeatable: { name: string; pattern?: string | null },
  currentCronPattern: string,
): boolean {
  return (
    repeatable.name === "shopify-reconcile" &&
    repeatable.pattern !== currentCronPattern
  );
}
