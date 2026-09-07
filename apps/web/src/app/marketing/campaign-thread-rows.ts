import type { CampaignItem } from "@/hooks/use-campaign-items";

/** Cuánto tiempo sigue siendo relevante una campaña ya terminada. */
export const CAMPAIGN_THREAD_TAIL_DAYS = 7;
export const CAMPAIGN_THREAD_LIMIT = 12;

/**
 * Qué campañas se ven en el hilo.
 *
 * Es un filtro, y un filtro sobre la única pantalla que enseña las campañas
 * falla callando: una campaña que desaparece no se distingue de una que no
 * existe, y el consultor da por hecho que no hay nada que sacar.
 *
 * Una campaña sin `ends_at` dura lo que dura su día de inicio: se mide por
 * `starts_at` o se descartaría siempre.
 */
export function visibleCampaignRows(
  items: CampaignItem[],
  // El reloj entra por parametro para poder fijarlo en los tests; el valor por
  // defecto se resuelve aqui dentro, no en el cuerpo de un render (mismo
  // motivo que `@/lib/elapsed`: `react-hooks/purity`).
  nowMs: number = Date.now(),
): CampaignItem[] {
  const horizon = nowMs - CAMPAIGN_THREAD_TAIL_DAYS * 86_400_000;
  return items
    .filter((item) => item.status !== "cancelled")
    .filter((item) => {
      const ends = Date.parse(item.ends_at ?? item.starts_at);
      return Number.isFinite(ends) && ends >= horizon;
    })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, CAMPAIGN_THREAD_LIMIT);
}
