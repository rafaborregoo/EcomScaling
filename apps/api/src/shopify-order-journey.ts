/**
 * El customer journey de los pedidos que entran por webhook.
 *
 * EL PROBLEMA, medido en produccion el 2026-09-15: de 788 pedidos, **35 traen
 * origen de visita y 753 no**, y los 35 son todos del ultimo mes. No es un
 * problema de permisos ni de scopes -- el campo se rellena cuando llega. Es que
 * hay dos puertas de entrada y solo una lo trae:
 *
 *   * la importacion masiva pide `customerJourneySummary` y lo guarda;
 *   * el webhook **no lo trae en el payload**, y el manejador no va a buscarlo;
 *   * la reconciliacion incremental filtra por `updated_at >= last_sync_at`, de
 *     modo que un pedido que entro por webhook y no se volvio a tocar nunca se
 *     vuelve a pedir.
 *
 * Cada pedido nuevo nacia sin atribucion y se quedaba asi. Y sin atribucion,
 * `D03` declara la capacidad de adquisicion **no observable**: es exactamente
 * el hueco que el motor de madurez saco a la luz.
 *
 * POR QUE NO SE PIDE DENTRO DEL WEBHOOK. El webhook se procesa dentro de la
 * peticion HTTP, asi que una llamada a Shopify ahi significa dos cosas malas:
 * Shopify esperando por nosotros, y --peor-- que un fallo suyo marque el
 * webhook como fallido y **perdamos el pedido entero** por no haber podido
 * averiguar de donde venia. El pedido se guarda primero y la atribucion se
 * busca despues, que es el orden correcto de prioridades.
 *
 * DONDE CORRE. En la reconciliacion, que es el sitio que el ADR-0006 punto 4
 * reserva justamente para esto: lo que los webhooks no traen. No hace falta un
 * cron nuevo.
 */
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { shopifyGraphql } from "./shopify-client.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";

const logger = createLogger("shopify-order-journey");

type ApiEnv = LoadedApiEnv;

/**
 * Cuantos dias hacia atras tiene sentido preguntar.
 *
 * Shopify no conserva el customer journey indefinidamente, y pedirle el de un
 * pedido de hace un ano gasta una llamada para recibir `null`. Sesenta dias es
 * holgado para lo que tarda la reconciliacion en pasar y corto frente a la
 * historia entera. **El numero es nuestro**: si algun dia se documenta la
 * retencion real de Shopify, se ajusta aqui.
 */
export const DIAS_DE_JOURNEY = 60;

/** Cuantos pedidos se preguntan por llamada. `nodes` admite hasta 250. */
export const PEDIDOS_POR_LOTE = 50;

/** Cuantos pedidos como mucho por pasada, para no monopolizar el rate limit. */
export const MAXIMO_POR_PASADA = 500;

export type JourneyNode = {
  id: string;
  customerJourneySummary?: {
    customerOrderIndex?: number | null;
    daysToConversion?: number | null;
    firstVisit?: {
      occurredAt?: string | null;
      landingPage?: string | null;
      referrerUrl?: string | null;
      source?: string | null;
      sourceType?: string | null;
      utmParameters?: {
        source?: string | null;
        medium?: string | null;
        campaign?: string | null;
      } | null;
    } | null;
    lastVisit?: { source?: string | null; sourceType?: string | null } | null;
  } | null;
};

export const ORDER_JOURNEY_QUERY = `
  query OrderJourneys($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        customerJourneySummary {
          customerOrderIndex
          daysToConversion
          firstVisit {
            occurredAt
            landingPage
            referrerUrl
            source
            sourceType
            utmParameters { source medium campaign }
          }
          lastVisit { source sourceType }
        }
      }
    }
  }
`;

/**
 * Del nodo de Shopify a las columnas del pedido.
 *
 * **Las mismas columnas y en el mismo orden que la ruta masiva** (`shopify-sync.ts`):
 * dos caminos que escriben la misma fila tienen que escribirla igual, o la
 * atribucion de un pedido dependeria de por donde entro -- que es justo el
 * problema que esto viene a arreglar.
 *
 * `journey_checked_at` se sella **siempre**, incluso cuando Shopify no devuelve
 * nada: un pedido sin origen puede ser una visita directa, y eso es un dato. Si
 * no se sellara, el backfill volveria a preguntar por el eternamente y nadie
 * podria distinguir un hueco de un directo.
 */
export function mapOrderJourney(node: JourneyNode, checkedAt: string) {
  const journey = node.customerJourneySummary;
  const firstVisit = journey?.firstVisit;
  const utm = firstVisit?.utmParameters;

  return {
    customer_order_index: journey?.customerOrderIndex ?? null,
    is_first_customer_order:
      typeof journey?.customerOrderIndex === "number"
        ? journey.customerOrderIndex === 1
        : null,
    days_to_conversion: journey?.daysToConversion ?? null,
    // Adquisicion y cierre por separado: mezclarlas es el error clasico de
    // atribucion -- la campana que lo trajo no suele ser la que lo cerro.
    first_visit_at: firstVisit?.occurredAt ?? null,
    first_visit_source: firstVisit?.source ?? null,
    first_visit_source_type: firstVisit?.sourceType ?? null,
    first_visit_landing_page: firstVisit?.landingPage ?? null,
    first_visit_referrer_url: firstVisit?.referrerUrl ?? null,
    first_visit_utm_source: utm?.source ?? null,
    first_visit_utm_medium: utm?.medium ?? null,
    first_visit_utm_campaign: utm?.campaign ?? null,
    last_visit_source: journey?.lastVisit?.source ?? null,
    last_visit_source_type: journey?.lastVisit?.sourceType ?? null,
    journey_checked_at: checkedAt,
  };
}

/** Si el nodo trae algo que merezca llamarse atribucion. */
export function hasAttribution(node: JourneyNode): boolean {
  return Boolean(node.customerJourneySummary?.firstVisit?.sourceType);
}

/** La fecha a partir de la cual tiene sentido preguntar. */
export function journeyWindowStart(now: Date, dias = DIAS_DE_JOURNEY): string {
  return new Date(now.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();
}

export function chunk<T>(items: T[], size: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += size) lotes.push(items.slice(i, i + size));
  return lotes;
}

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Rellena la atribucion de los pedidos que nunca se preguntaron.
 *
 * Devuelve lo que hizo, no lo que intento. Nunca lanza por un fallo de Shopify:
 * el pedido ya esta guardado y la atribucion es un extra -- tumbar la
 * reconciliacion entera por ella seria repetir el error que esto arregla.
 */
export async function backfillOrderJourneys(
  env: ApiEnv,
  connectionId: string,
  now = new Date(),
) {
  const supabase = createServiceClient(env);
  const resumen = { pending: 0, asked: 0, withAttribution: 0, updated: 0, failed: 0 };

  const { data: tienda } = await supabase
    .from("shopify_stores")
    .select("id, myshopify_domain")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (!tienda) return resumen;

  const { data: pendientes, error } = await supabase
    .from("shopify_order_facts")
    .select("id, external_order_id")
    .eq("store_id", tienda.id as string)
    .is("journey_checked_at", null)
    .gte("processed_at", journeyWindowStart(now))
    .order("processed_at", { ascending: false })
    .limit(MAXIMO_POR_PASADA);

  if (error) {
    logger.error("journey_pending_lookup_failed", {
      connection_id: connectionId,
      error: error.message,
    });
    return resumen;
  }

  const cola = pendientes ?? [];
  resumen.pending = cola.length;
  if (cola.length === 0) return resumen;

  let accessToken: string;
  try {
    accessToken = await getValidShopifyAccessToken(env, connectionId);
  } catch (tokenError) {
    logger.error("journey_token_unavailable", {
      connection_id: connectionId,
      error: tokenError instanceof Error ? tokenError.message : String(tokenError),
    });
    return resumen;
  }

  const porGid = new Map(cola.map((o) => [o.external_order_id as string, o.id as string]));
  const checkedAt = now.toISOString();

  for (const lote of chunk([...porGid.keys()], PEDIDOS_POR_LOTE)) {
    let respuesta: { nodes: Array<JourneyNode | null> };
    try {
      respuesta = await shopifyGraphql<{ nodes: Array<JourneyNode | null> }>(
        tienda.myshopify_domain as string,
        accessToken,
        ORDER_JOURNEY_QUERY,
        { ids: lote },
      );
    } catch (graphError) {
      resumen.failed += lote.length;
      logger.error("journey_query_failed", {
        connection_id: connectionId,
        batch: lote.length,
        error: graphError instanceof Error ? graphError.message : String(graphError),
      });
      // Sin `continue`: si Shopify esta rechazando, los lotes siguientes van a
      // fallar igual y seguir solo gasta rate limit. Se reintenta en la
      // proxima reconciliacion, que es para lo que existe.
      break;
    }

    resumen.asked += lote.length;

    for (const node of respuesta.nodes ?? []) {
      if (!node?.id) continue;
      const filaId = porGid.get(node.id);
      if (!filaId) continue;

      if (hasAttribution(node)) resumen.withAttribution += 1;

      const { error: errorUpdate } = await supabase
        .from("shopify_order_facts")
        .update(mapOrderJourney(node, checkedAt))
        .eq("id", filaId);

      if (errorUpdate) {
        resumen.failed += 1;
        logger.error("journey_update_failed", {
          connection_id: connectionId,
          error: errorUpdate.message,
        });
        continue;
      }
      resumen.updated += 1;
    }
  }

  logger.info("journey_backfill_completed", { connection_id: connectionId, ...resumen });
  return resumen;
}
