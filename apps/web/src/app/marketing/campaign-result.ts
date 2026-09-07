import type { CampaignItem } from "@/hooks/use-campaign-items";
import type {
  KlaviyoAttribution,
  MetaAttribution,
} from "@/hooks/use-attribution-report";

export type CampaignResult = {
  /** Quién atribuye. Nunca "ingresos" a secas (ADR-0021). */
  source: "Klaviyo" | "Meta";
  revenue: number;
  /** Métrica secundaria propia de la plataforma, ya formateada por el emisor. */
  detail: string | null;
  /** `null` cuando la plataforma no da retorno comparable. */
  roas: number | null;
};

// Copia deliberada del helper del hook: Postgres devuelve numeric como texto.
// Importarlo de alli arrastraria el hook de cliente (y su `apiFetch`) a este
// modulo, que tiene que poder cargarse suelto desde su test.
const num = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? Number(parsed) : 0;
};

/**
 * Lo que atribuyó UNA campaña del calendario.
 *
 * Devuelve una lista, no un total, y esa es toda la gracia: una campaña puede
 * estar enlazada a Klaviyo y a Meta a la vez (un lanzamiento con email y
 * anuncios), y las dos plataformas se apuntan la misma venta. Sumarlas daría
 * una cifra que no existe y que además supera a la venta real de Shopify
 * (ADR-0021). Se muestran las dos, cada una con su nombre.
 */
export function campaignResults(
  item: Pick<CampaignItem, "klaviyo_campaign_id" | "meta_campaign_id">,
  klaviyo: KlaviyoAttribution | null,
  meta: MetaAttribution | null,
): CampaignResult[] {
  const results: CampaignResult[] = [];

  if (item.klaviyo_campaign_id && klaviyo?.connected) {
    const row = klaviyo.campaigns.find(
      (campaign) => campaign.id === item.klaviyo_campaign_id,
    );
    if (row) {
      results.push({
        source: "Klaviyo",
        revenue: num(row.revenue),
        detail: `${num(row.conversions).toLocaleString("es-ES")} conversiones`,
        roas: null,
      });
    }
  }

  if (item.meta_campaign_id && meta) {
    const row = meta.campaigns.find(
      (campaign) => campaign.campaign_id === item.meta_campaign_id,
    );
    if (row) {
      const spend = num(row.spend);
      results.push({
        source: "Meta",
        revenue: num(row.purchase_value),
        detail: `${spend.toLocaleString("es-ES", { maximumFractionDigits: 0 })} € de gasto`,
        roas: row.roas == null ? null : num(row.roas),
      });
    }
  }

  return results;
}

/** Una campaña puede medirse cuando ya ha empezado. Antes no hay nada que leer. */
export function canMeasureCampaign(
  item: Pick<CampaignItem, "starts_at" | "status">,
  nowMs: number = Date.now(),
): boolean {
  const starts = Date.parse(item.starts_at);
  return (
    item.status !== "cancelled" && Number.isFinite(starts) && starts <= nowMs
  );
}
