import type { SupabaseClient } from "@supabase/supabase-js";
import { MARKETING_BRAND_PROFILE_FIELDS, resolveMarketingBrandProfile } from "./marketing-brand-profile.js";
import { buildInternalMailingDesignContext, internalMailingPlaybookRetrievalEntry } from "./marketing-playbook.js";
import type { MarketingCreativeRequest } from "./marketing-creative-method.js";
import { summarizeMarketingPeerHistory, type MarketingPeerHistoryRow } from "./marketing-peer-history.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CREATIVE_CONTEXT_VERSION = "verified-creative-context.v1";
const principleSelect = "kind,title,objective,audience_tags,lifecycle_tags,status,updated_at,source_type:source->>type,rights_confirmed:source->rights_confirmed,when_to_use:content->>when_to_use,when_not_to_use:content->>when_not_to_use,sequence_arc:content->>sequence_arc,visual_direction:content->>visual_direction,persuasion_principles:content->persuasion_principles,cta_guidance:content->>cta_guidance,risks:content->risks";

export async function loadMarketingDesignPrinciples(db: SupabaseClient, objective: string) {
  const result = await db.from("internal_mailing_playbook_entries").select(principleSelect).eq("kind", "strategy").eq("status", "published").order("updated_at", { ascending: false }).limit(100);
  if (result.error) throw new Error("marketing_principles_unavailable");
  return buildInternalMailingDesignContext((result.data ?? []).map((row) => internalMailingPlaybookRetrievalEntry(row as unknown as Record<string, unknown>)), { objective });
}

/** Caller resolves access before passing this exact tenant/store pair. Never query a catalog with NULL store. */
export async function loadMarketingCreativeContext(db: SupabaseClient, organizationId: string, storeId: string | null, objective: string, request: MarketingCreativeRequest) {
  if (!uuid.test(organizationId) || (storeId !== null && !uuid.test(storeId))) throw new Error("marketing_context_scope_invalid");
  if (!storeId && request.product_ids.length) throw new Error("marketing_product_store_required");
  const fields = MARKETING_BRAND_PROFILE_FIELDS.join(",");
  const [organization, store, organizationBrand, storeBrand, catalog, principles] = await Promise.all([
    db.from("organizations").select("display_name,timezone,currency_code").eq("id", organizationId).single(),
    storeId ? db.from("shopify_stores").select("id,connection_id,myshopify_domain,primary_domain,currency_code,timezone,is_active").eq("organization_id", organizationId).eq("id", storeId).eq("is_active", true).single() : Promise.resolve({ data: null, error: null }),
    db.from("marketing_brand_profiles").select(fields).eq("organization_id", organizationId).is("store_id", null).maybeSingle(),
    storeId ? db.from("marketing_brand_profiles").select(fields).eq("organization_id", organizationId).eq("store_id", storeId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    storeId ? request.product_ids.length ? db.rpc("marketing_studio_products_by_ids", { target_organization_id: organizationId, target_store_id: storeId, target_product_ids: request.product_ids }) : db.rpc("marketing_studio_products", { target_organization_id: organizationId, target_store_id: storeId, source: "best", search: null, max_rows: 12 }) : Promise.resolve({ data: [], error: null }),
    request.creative_mode === "guided" ? loadMarketingDesignPrinciples(db, objective) : Promise.resolve({ status: "not_requested", selected: [] }),
  ]);
  if ([organization, store, organizationBrand, storeBrand, catalog].some((result) => result.error)) throw new Error("marketing_verified_context_unavailable");
  if (!organization.data || (storeId && !store.data)) throw new Error("marketing_context_scope_invalid");
  const brand = resolveMarketingBrandProfile(organizationBrand.data as Record<string, unknown> | null, storeBrand.data as Record<string, unknown> | null);
  const products = (catalog.data ?? []) as Array<Record<string, unknown>>;
  if (request.product_ids.some((id) => !products.some((product) => product.product_id === id))) throw new Error("marketing_selected_product_not_available");
  const verifiedProducts = products.map((product) => ({ id: product.product_id, title: product.title, price: product.price ?? null, currency: product.currency_code ?? null,
    image_url: product.image_url ?? null, image_alt: product.image_alt ?? null, product_url: product.url ?? product.product_url ?? null,
    inventory_status: "not_checked", source: "scoped_shopify_catalog" }));
  const connectionId = store.data?.connection_id;
  const history = connectionId ? await db.from("marketing_content_drafts")
    .select("id,subject,summary,created_at,status")
    .eq("organization_id", organizationId).eq("request->>store_id", connectionId)
    .is("request->ai_lab", null)
    .order("created_at", { ascending: false }).limit(5) : { data: [], error: null };
  if (history.error) throw new Error("marketing_history_unavailable");
  const peerHistory = storeId ? await db.from("agent_outputs")
    .select("id,run_id,created_at,status,output,agent_runs!inner(store_id,status,agent_versions!inner(agent_definitions!inner(code,name)))")
    .eq("organization_id", organizationId).eq("agent_runs.store_id", storeId)
    .in("status", ["approved", "published"]).order("created_at", { ascending: false }).limit(30) : { data: [], error: null };
  if (peerHistory.error) throw new Error("marketing_peer_history_unavailable");
  const feedback = summarizeMarketingPeerHistory((peerHistory.data ?? []) as MarketingPeerHistoryRow[], storeId);
  const source = request.source_draft_id ? await db.from("marketing_content_drafts")
    .select("id,request,subject,preheader,plain_text,blocks,version")
    .eq("organization_id", organizationId).eq("id", request.source_draft_id).maybeSingle() : { data: null, error: null };
  if (source.error) throw new Error("marketing_source_unavailable");
  if (request.source_draft_id && (!connectionId || !source.data || source.data.request?.store_id !== connectionId)) throw new Error("marketing_source_scope_invalid");
  if (request.creative_task !== "create" && !source.data) throw new Error("marketing_source_draft_required");
  return {
    version: CREATIVE_CONTEXT_VERSION, captured_at: new Date().toISOString(),
    blocks: [
      { label: "Empresa y tienda verificadas", data: { organization: organization.data, store: store.data, store_selected: Boolean(storeId) } },
      { label: "Guía de marca verificada", data: brand },
      { label: "Productos de la tienda verificados", data: { status: !storeId ? "store_not_selected" : verifiedProducts.length ? "available" : "no_products", selected_explicitly: request.product_ids.length > 0, sample_limit: request.product_ids.length || 12, items: verifiedProducts } },
      { label: "Principios de diseño internos autorizados", data: principles },
      { label: "Historial editorial de esta tienda (no demuestra resultados comerciales)", data: history.data ?? [] },
      { label: "Conclusiones recientes aprobadas de agentes de esta tienda", data: { status: feedback.length ? "available" : "no_recent_approved_results", items: feedback } },
      ...(source.data ? [{ label: "Pieza origen verificada para variación/adaptación", data: { id: source.data.id, version: source.data.version, subject: source.data.subject, preheader: source.data.preheader, plain_text: source.data.plain_text, blocks: source.data.blocks } }] : []),
      { label: "Referencias externas aportadas (observaciones, no rendimiento probado)", data: request.research_references },
    ],
    products: verifiedProducts, brand,
    warnings: [...(!storeId ? ["Selecciona una tienda para incorporar su catálogo; no se han mezclado productos de varias tiendas."] : []), ...(!brand.profile ? ["No hay guía de marca guardada; no se debe inventar su identidad."] : [])],
  };
}
