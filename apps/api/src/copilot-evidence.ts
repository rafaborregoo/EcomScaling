import type { CopilotEvidenceReference } from "@e-nora/contracts";
import type { LoadedApiEnv } from "@e-nora/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserScopedClient, type AuthContext } from "./auth-context.js";
import { getMetaCampaignDetail } from "./meta-campaigns.js";
import { getShopifyCatalogDiscount, getShopifyCatalogProduct } from "./shopify-catalog.js";
import { getKlaviyoEmailDetail } from "./klaviyo-emails.js";
import { getMarketingKlaviyoWorkspace } from "./marketing-klaviyo.js";
import { providerCurrencyCode } from "./provider-currency.js";

export type CopilotEvidenceBlock = { label: string; data: unknown };

function dayOffset(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function metricValue(row: Record<string, unknown>, key: "meta_spend" | "meta_roas") {
  const value = key === "meta_spend" ? row.spend : row.roas;
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? null
    : Number(value);
}

function selectFields(data: unknown, fields: readonly string[]) {
  if (!data || typeof data !== "object") return {};
  const record = data as Record<string, unknown>;
  return Object.fromEntries(fields.map((field) => [
    field,
    Array.isArray(record[field]) ? record[field].slice(0, 14) : record[field] ?? null,
  ]));
}

function routeMatchesReference(ref: CopilotEvidenceReference) {
  if (ref.entity?.type === "marketing_draft") {
    return ref.kind === "entity" && (ref.route.startsWith("/marketing") || ref.route.startsWith("/consultor"));
  }
  if (ref.entity?.type === "klaviyo_flow") {
    return ref.kind === "entity" && ref.route.startsWith("/marketing");
  }
  const prefix: Partial<Record<CopilotEvidenceReference["source"], string>> = {
    meta: "/meta", shopify: "/shopify", klaviyo: "/klaviyo", marketing: "/marketing",
  };
  const expected = prefix[ref.source];
  if (expected && ref.kind !== "section" && !ref.route.startsWith(expected)) return false;
  if (!ref.entity) return ref.kind !== "entity";
  const routes: Record<string, string> = {
    meta_campaign: "/meta/campanas/",
    shopify_product: "/shopify/productos/",
    shopify_discount: "/shopify/promociones/",
    klaviyo_email: "/klaviyo/emails/",
  };
  const entityPrefix = routes[ref.entity.type];
  return Boolean(entityPrefix && ref.route === `${entityPrefix}${encodeURIComponent(ref.entity.id)}`);
}

export async function resolveCopilotEvidenceReference(input: {
  env: LoadedApiEnv;
  supabase: SupabaseClient;
  authorization?: string | undefined;
  context: AuthContext;
  organizationId: string;
  storeId: string | null;
  reference: CopilotEvidenceReference;
}): Promise<CopilotEvidenceBlock> {
  const { reference: ref, supabase, organizationId, storeId } = input;
  if (!routeMatchesReference(ref)) {
    return { label: "Referencia de interfaz inválida", data: { status: "unavailable", reason: "route_mismatch" } };
  }
  if (ref.kind === "chart_point" && ref.metric) {
    const { date, key } = ref.metric;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ||
      !ref.period || date < ref.period.start || date > ref.period.end ||
      parsed.getTime() > Date.now() + 86_400_000) {
      return { label: "Evidencia del gráfico de Meta", data: { status: "unavailable", reason: "invalid_date_or_period" } };
    }
    const [daily, accounts] = await Promise.all([
      supabase.rpc("meta_performance_daily", {
        target_organization_id: organizationId,
        period_start: dayOffset(date, -3),
        period_end: dayOffset(date, 3),
        target_store_id: storeId,
      }),
      (() => {
        let query = supabase.from("meta_ad_accounts")
          .select("currency_code, raw_data")
          .eq("organization_id", organizationId);
        if (storeId) query = query.eq("store_id", storeId);
        return query;
      })(),
    ]);
    if (daily.error) {
      return { label: "Evidencia del gráfico de Meta", data: { status: "unavailable", reason: "provider_data_unavailable" } };
    }
    const rows = (daily.data ?? []) as Record<string, unknown>[];
    const target = rows.find((row) => String(row.bucket_date) === date);
    let accountIds: string[] | null = null;
    let accountLookupFailed = false;
    if (storeId) {
      const scopedAccounts = await supabase.from("meta_ad_accounts")
        .select("id").eq("organization_id", organizationId).eq("store_id", storeId);
      accountLookupFailed = Boolean(scopedAccounts.error);
      accountIds = scopedAccounts.error ? null : (scopedAccounts.data ?? []).map((row) => row.id);
    }
    const coverage = await Promise.all(rows.map(async (row) => {
      const day = String(row.bucket_date);
      if (accountLookupFailed) return { date: day, source_rows: null };
      if (accountIds?.length === 0) return { date: day, source_rows: 0 };
      let countQuery = supabase.from("meta_insight_rows_daily")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("metric_date", day)
        .eq("level", "ad")
        .eq("breakdown_hash", "none");
      if (accountIds) countQuery = countQuery.in("ad_account_id", accountIds);
      const countResult = await countQuery;
      return { date: day, source_rows: countResult.error ? null : countResult.count ?? 0 };
    }));
    const observedRows = coverage.find((item) => item.date === date)?.source_rows ?? null;
    const currencies = new Set(accounts.error ? [] : (accounts.data ?? []).map((row) =>
      providerCurrencyCode(row.currency_code, row.raw_data, "currency")
    ));
    const currency = currencies.size === 1 ? [...currencies][0] ?? null : null;
    const neighbors = rows.map((row) => {
      const day = String(row.bucket_date);
      const sourceRows = coverage.find((item) => item.date === day)?.source_rows ?? null;
      return { date: day, value: sourceRows === 0 ? null : metricValue(row, key),
        status: sourceRows === 0 ? "no_data" : sourceRows === null ? "coverage_unknown" : "available",
        source_rows: sourceRows };
    });
    return {
      label: "Evidencia verificada del gráfico de Meta (datos de Meta, no conocimiento RAG)",
      data: {
        status: !target || observedRows === 0 ? "no_data" : observedRows === null ? "coverage_unknown" : "available",
        source: "meta_performance_daily",
        metric: key,
        date,
        value: target && observedRows !== 0 ? metricValue(target, key) : null,
        currency: key === "meta_spend" ? currency : null,
        currency_comparable: currency !== null,
        store_id: storeId,
        period_selected: ref.period,
        neighboring_days: neighbors,
        coverage: { target_day_source_rows: observedRows, neighboring_days_returned: rows.length, days_requested: 7 },
        limitations: [
          ...(!currency ? ["Moneda de Meta no comparable o desconocida; no comparar importes ni ROAS agregados entre cuentas"] : []),
          ...(!target || observedRows === 0 ? ["No hay filas de Meta observadas para el día seleccionado; el RPC rellena los huecos con cero"] : []),
          ...(observedRows === null ? ["No se pudo verificar la cobertura de filas originales de Meta"] : []),
          "El ROAS y el valor de compra de Meta usan la atribución de Meta; no son ventas de Shopify",
        ],
      },
    };
  }

  if (ref.kind === "entity" && ref.entity) {
    const { type, id } = ref.entity;
    const connectionId = ref.connection_id ?? undefined;
    const periodDays = ref.filters.periodDays ?? ref.filters.days;
    const scopedInput = {
      ...(connectionId ? { connectionId } : {}),
      ...(periodDays ? { periodDays } : {}),
    };
    if (!input.authorization && type !== "klaviyo_email") {
      return { label: "Evidencia de entidad", data: { status: "unavailable", reason: "authorization_missing" } };
    }
    try {
      if (type === "meta_campaign") {
        const result = await getMetaCampaignDetail(input.env, input.authorization!, input.context, organizationId, id, scopedInput);
        return { label: "Evidencia verificada de campaña de Meta", data: result.ok
          ? { status: "available", source: "meta_campaign_detail", ...selectFields(result.data, ["campaign", "daily", "ad_sets", "ads", "currency", "period", "unavailable"]) }
          : { status: "unavailable", reason: result.error } };
      }
      if (type === "shopify_product") {
        const result = await getShopifyCatalogProduct(input.env, input.authorization!, input.context, organizationId, id, { ...scopedInput, page: "1" });
        return { label: "Evidencia verificada de producto Shopify", data: result.ok
          ? { status: "available", source: "shopify_catalog_product", ...selectFields(result.data, ["product", "product_metrics", "metrics_coverage", "weekly", "product_activity", "inventory_levels_coverage", "related_promotions"]) }
          : { status: "unavailable", reason: result.error } };
      }
      if (type === "shopify_discount") {
        const result = await getShopifyCatalogDiscount(input.env, input.authorization!, input.context, organizationId, id, { ...scopedInput, page: "1", targetsPage: "1" });
        return { label: "Evidencia verificada de promoción Shopify", data: result.ok
          ? { status: "available", source: "shopify_catalog_discount", ...selectFields(result.data, ["discount", "metrics", "metrics_coverage", "weekly_orders", "top_products", "codes_usage", "details_coverage", "target_coverage"]) }
          : { status: "unavailable", reason: result.error } };
      }
      if (type === "klaviyo_email") {
        const result = await getKlaviyoEmailDetail(input.env, input.context, organizationId, id, {
          ...(connectionId ? { connectionId } : {}),
          ...(periodDays ? { days: periodDays } : {}),
        });
        return { label: "Evidencia verificada de email Klaviyo", data: result.ok
          ? { status: "available", source: "klaviyo_email_detail", ...selectFields(result.data, ["entity", "period", "currency", "stats_coverage", "account", "steps", "links", "links_coverage", "audience"]) }
          : { status: "unavailable", reason: result.error } };
      }
      if (type === "marketing_draft") {
        if (!input.authorization?.startsWith("Bearer ")) {
          return { label: "Evidencia de pieza de marketing", data: { status: "unavailable", reason: "authorization_missing" } };
        }
        const userClient = createUserScopedClient(input.env, input.authorization.slice("Bearer ".length));
        const { data, error } = await userClient.from("marketing_content_drafts")
          .select("id, template_name, subject, preheader, plain_text, status, content_type, request, created_at, updated_at")
          .eq("organization_id", organizationId)
          .eq("id", id).maybeSingle();
        const draftStoreId = (data?.request as { store_id?: unknown } | null)?.store_id;
        const storeMismatch = Boolean(storeId && typeof draftStoreId === "string" &&
          draftStoreId !== storeId && draftStoreId !== connectionId);
        return { label: "Evidencia verificada de pieza de marketing", data: error || !data || storeMismatch
          ? { status: "unavailable", reason: "draft_not_found_or_unavailable" }
          : { status: "available", source: "marketing_content_drafts", draft: data } };
      }
      if (type === "klaviyo_flow") {
        const result = await getMarketingKlaviyoWorkspace(input.env, input.context, organizationId, {
          ...(connectionId ? { connectionId } : {}),
          ...(periodDays ? { days: periodDays } : {}),
        });
        const flow = result.ok && Array.isArray(result.data.flows)
          ? (result.data.flows as Array<Record<string, unknown>>).find((item) => item.id === id)
          : null;
        return { label: "Evidencia verificada de flow Klaviyo", data: flow
          ? { status: "available", source: "marketing_klaviyo_workspace", period: result.ok ? result.data.period : null,
              currency: null, limitations: ["La moneda del flow no está verificada para esta respuesta"],
              flow: selectFields(flow, ["id", "name", "status", "trigger_type", "updated_at", "graph", "messages", "stats"]) }
          : { status: "unavailable", reason: "flow_not_found_or_unavailable" } };
      }
    } catch {
      return { label: "Evidencia de entidad", data: { status: "unavailable", reason: "provider_data_unavailable" } };
    }
  }

  return {
    label: "Referencia estructurada de la interfaz (alcance, no evidencia de métricas)",
    data: { source: ref.source, route: ref.route, section: ref.section, entity: ref.entity,
      period: ref.period, period_label: ref.period_label, filters: ref.filters },
  };
}
