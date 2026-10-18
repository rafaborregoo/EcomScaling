import type { SupabaseClient } from "@supabase/supabase-js";

export type CampaignPlanStore = {
  id: string;
  connection_id: string;
  shop_name: string | null;
  timezone: string | null;
  myshopify_domain: string | null;
  country_code?: string | null;
  market_codes?: string[] | null;
  business_vertical?: string | null;
};

export type CampaignPlanStoreScope =
  | { ok: true; store: CampaignPlanStore }
  | {
      ok: false;
      statusCode: 409 | 404 | 503;
      error: string;
      message: string;
    };

/**
 * Resolve exactly one active Shopify store. A05 must never fall back to an
 * organization-wide aggregate because its plan belongs to a specific shop.
 */
export async function resolveCampaignPlanStoreScope(
  supabase: SupabaseClient,
  organizationId: string,
  connectionId?: string | null,
): Promise<CampaignPlanStoreScope> {
  if (!connectionId) {
    return {
      ok: false,
      statusCode: 409,
      error: "campaign_plan_store_required",
      message: "Selecciona la tienda activa antes de consultar o proponer su calendario.",
    };
  }
  let query = supabase
    .from("shopify_stores")
    .select("id, connection_id, shop_name, timezone, myshopify_domain, country_code, market_codes, business_vertical")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  query = query.eq("connection_id", connectionId);

  const result = await query.maybeSingle().then((value) => ({
        data: value.data ? [value.data] : [],
        error: value.error,
      }));
  if (result.error)
    return {
      ok: false,
      statusCode: 503,
      error: "campaign_plan_store_lookup_failed",
      message: "No se pudo comprobar la tienda para preparar el calendario.",
    };

  const stores = (result.data ?? []) as CampaignPlanStore[];
  const store = stores[0];
  if (!store)
    return {
      ok: false,
      statusCode: connectionId ? 404 : 409,
      error: connectionId
        ? "campaign_plan_store_not_found"
        : "campaign_plan_store_required",
      message: connectionId
        ? "La tienda seleccionada no está disponible."
        : "Conecta o selecciona una tienda antes de proponer el calendario.",
    };
  return { ok: true, store };
}
