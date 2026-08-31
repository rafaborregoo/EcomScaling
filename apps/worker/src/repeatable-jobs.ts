export const SHOPIFY_RECONCILE_CRON = "0 2 * * *";
export const SHOPIFY_RECONCILE_TZ = "Europe/Madrid";
export const FATHOM_WEBHOOK_CRON = "* * * * *";
export const FATHOM_WEBHOOK_TZ = "Europe/Madrid";
export const WEBHOOK_RETENTION_CRON = "30 3 * * *";
export const WEBHOOK_RETENTION_TZ = "Europe/Madrid";
export const AI_CONTEXT_RETENTION_CRON = "45 3 * * *";
export const AI_CONTEXT_RETENTION_TZ = "Europe/Madrid";

// Fase 3: orquestador de diagnosticos IA, 2 veces al dia (manana y tarde).
// Decide por org+agente si merece la pena regenerar y ejecuta como mucho N
// agentes por pasada, dentro del presupuesto de plataforma.
export const AI_DIAGNOSTICS_TICK_CRON = "0 6,15 * * *";
export const AI_DIAGNOSTICS_TICK_TZ = "Europe/Madrid";

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
