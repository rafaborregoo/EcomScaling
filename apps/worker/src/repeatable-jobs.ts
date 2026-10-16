export const SHOPIFY_RECONCILE_CRON = "0 2 * * *";
export const SHOPIFY_RECONCILE_TZ = "Europe/Madrid";
// Conserva la cadencia del crontab del VPS, ahora registrada en BullMQ para
// que el mismo worker la ejecute también en desarrollo local.
export const META_RECONCILE_CRON = "17 0 * * *";
export const META_RECONCILE_TZ = "UTC";
export const KLAVIYO_RECONCILE_CRON = "43 */6 * * *";
export const KLAVIYO_RECONCILE_TZ = "UTC";
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

// Banco de imágenes de Instagram: cada minuto el worker pide al API que procese
// las siguientes imágenes en cola (extracción de visión + indexado RAG). Mismo
// ritmo que la cola de webhooks de Fathom.
export const INSTAGRAM_IMAGE_QUEUE_CRON = "* * * * *";
export const INSTAGRAM_IMAGE_QUEUE_TZ = "Europe/Madrid";

// Avisos por email (Configuración › Notificaciones): cada 10 minutos el API
// manda los «al momento» y los resúmenes que tocan a esa hora.
export const NOTIFICATION_EMAIL_CRON = "*/10 * * * *";
export const NOTIFICATION_EMAIL_TZ = "Europe/Madrid";

// Push a la app móvil: cada 2 minutos el API manda los avisos nuevos de la campana.
export const MOBILE_PUSH_CRON = "*/2 * * * *";
export const MOBILE_PUSH_TZ = "Europe/Madrid";

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
