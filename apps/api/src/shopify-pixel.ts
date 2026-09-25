/**
 * Pixel propio (Shopify Web Pixel, extensions/ecomscaling-pixel): recibe las
 * vistas de producto y activa el pixel en cada tienda conectada.
 *
 * La ruta es publica --la llama el navegador del comprador, sin sesion--, asi
 * que no se fia de nada: la tienda tiene que existir y estar ingiriendo, el
 * evento tiene que ser uno de los que sabemos contar y la fecha tiene que ser
 * plausible. Del navegador solo se guarda un resumen del client_id.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { assertConnectionIngestible } from "./operational-organization.js";
import { shopifyGraphql } from "./shopify-client.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";

const logger = createLogger("api:shopify-pixel");

type ApiEnv = LoadedApiEnv;

export const PIXEL_EVENTS = ["product_viewed"] as const;
const MAX_SKEW_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type PixelEvent = {
  event_id: string;
  event_name: (typeof PIXEL_EVENTS)[number];
  occurred_at: string;
  client_id_hash: string | null;
  product_id: string | null;
  variant_id: string | null;
};

const shortId = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).slice(0, 40) : null;

/** Del cuerpo que manda la extension a un evento que se puede guardar, o null. */
export function parsePixelEvent(raw: unknown, now = new Date()): PixelEvent | null {
  let body: unknown = raw;
  if (typeof raw === "string") {
    try {
      body = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!PIXEL_EVENTS.includes(b.name as (typeof PIXEL_EVENTS)[number])) return null;
  if (typeof b.id !== "string" || !b.id || b.id.length > 80) return null;
  const when = new Date(String(b.timestamp ?? ""));
  if (Number.isNaN(when.getTime()) || Math.abs(when.getTime() - now.getTime()) > MAX_SKEW_MS) return null;
  return {
    event_id: b.id,
    event_name: b.name as PixelEvent["event_name"],
    occurred_at: when.toISOString(),
    client_id_hash:
      typeof b.client_id === "string" && b.client_id
        ? createHash("sha256").update(b.client_id).digest("hex")
        : null,
    product_id: shortId(b.product_id),
    variant_id: shortId(b.variant_id),
  };
}

export function isPixelStoreId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export async function ingestPixelEvent(env: ApiEnv, storeId: string, raw: unknown) {
  const event = parsePixelEvent(raw);
  if (!event) return { stored: false as const, reason: "invalid_event" };

  const supabase = serviceClient(env);
  const { data: store } = await supabase
    .from("shopify_stores")
    .select("id, organization_id, integration_connections(status)")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return { stored: false as const, reason: "unknown_store" };
  const status = (store.integration_connections as { status?: string } | null)?.status ?? null;
  try {
    assertConnectionIngestible(status);
  } catch {
    return { stored: false as const, reason: "store_not_ingesting" };
  }

  const { error } = await supabase
    .from("shopify_pixel_events")
    .upsert(
      { organization_id: store.organization_id, store_id: storeId, ...event },
      { onConflict: "store_id,event_id", ignoreDuplicates: true },
    );
  if (error) {
    logger.error("pixel_event_write_failed", { store_id: storeId, error: error.message });
    return { stored: false as const, reason: "write_failed" };
  }
  return { stored: true as const };
}

const WEB_PIXEL_QUERY = `query { webPixel { id settings } }`;
const WEB_PIXEL_CREATE = `mutation webPixelCreate($webPixel: WebPixelInput!) {
  webPixelCreate(webPixel: $webPixel) { userErrors { field message code } webPixel { id } }
}`;
const WEB_PIXEL_UPDATE = `mutation webPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
  webPixelUpdate(id: $id, webPixel: $webPixel) { userErrors { field message code } webPixel { id } }
}`;

/**
 * Deja el pixel activo en la tienda con su configuracion (id de tienda y URL
 * de la API). Idempotente: si ya esta con esa configuracion no toca nada.
 * Necesita los permisos write_pixels y read_customer_events; sin ellos
 * Shopify responde ACCESS_DENIED y se registra para que se vea que falta
 * reautorizar, sin romper la reconciliacion.
 */
export async function ensureShopifyWebPixel(env: ApiEnv, connectionId: string) {
  const supabase = serviceClient(env);
  const { data: store } = await supabase
    .from("shopify_stores")
    .select("id, myshopify_domain")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!store?.myshopify_domain) return { status: "no_store" as const };

  const settings = JSON.stringify({
    accountID: store.id,
    endpoint: `${(env.API_BASE_URL ?? "https://api.ecom.noraapp.es").replace(/\/$/, "")}/v1/pixel/events`,
  });

  try {
    const token = await getValidShopifyAccessToken(env, connectionId);
    const domain = store.myshopify_domain as string;
    let existing: { id: string; settings: string | null } | null = null;
    try {
      const found = await shopifyGraphql<{ webPixel: { id: string; settings: string | null } | null }>(
        domain, token, WEB_PIXEL_QUERY, {},
      );
      existing = found.webPixel;
    } catch {
      // Shopify responde con error cuando la tienda no tiene pixel todavia.
      existing = null;
    }
    if (existing && existing.settings === settings) return { status: "active" as const };

    const result = existing
      ? await shopifyGraphql<{ webPixelUpdate: { userErrors: Array<{ message: string; code?: string }> } }>(
          domain, token, WEB_PIXEL_UPDATE, { id: existing.id, webPixel: { settings } },
        ).then((r) => r.webPixelUpdate)
      : await shopifyGraphql<{ webPixelCreate: { userErrors: Array<{ message: string; code?: string }> } }>(
          domain, token, WEB_PIXEL_CREATE, { webPixel: { settings } },
        ).then((r) => r.webPixelCreate);

    if (result.userErrors.length) {
      logger.error("web_pixel_user_errors", { connection_id: connectionId, errors: result.userErrors });
      return { status: "rejected" as const };
    }
    return { status: existing ? ("updated" as const) : ("created" as const) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("web_pixel_activation_failed", {
      connection_id: connectionId,
      // ACCESS_DENIED = faltan write_pixels / read_customer_events: reautorizar la tienda.
      error: message,
    });
    return { status: "failed" as const };
  }
}
