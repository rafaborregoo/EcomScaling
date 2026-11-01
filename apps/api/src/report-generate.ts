import type { SupabaseClient } from "@supabase/supabase-js";
import { renderReportPdf } from "./report-pdf.js";
import { isReportAccentColor, isReportLogo, reportLogoStoragePath } from "./report-branding.js";
import { buildLiveReportDocument, reportDigest } from "./report-data.js";
import {
  getReportTemplate,
  type ReportAnalysis,
  type ReportDocument,
  type ReportTemplateId,
} from "./report-templates.js";

/**
 * Generación de informes PDF, compartida por la tool `generate_report` del
 * copiloto, el informe mensual programado (apps/worker) y el informe de
 * cartera. Recibe un cliente service role: quien llama ya comprobó el acceso.
 */

export const REPORT_BUCKET = "copilot-reports";

export type ReportFailure = { ok: false; error: string; why: string; how_to_fix: string };
export type ReportSource = "copilot" | "scheduled" | "portfolio";

export type BuiltReport = {
  ok: true;
  report: ReportDocument;
  storeId: string | null;
  storeScope: "selected_store" | "single_store" | "organization_scope";
  /** RPCs de las que salen las cifras, para la procedencia de la tool. */
  sources: string;
};

const failure = (error: string, why: string, howToFix: string): ReportFailure => ({ ok: false, error, why, how_to_fix: howToFix });
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Último mes natural completo (UTC). */
export function lastFullMonth(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  return { start: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)), end };
}

/** Periodo anterior de la misma duración, pegado al inicio del actual. */
export function previousPeriod(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime() + 1;
  const previousEnd = new Date(start.getTime() - 1);
  return { start: new Date(previousEnd.getTime() - duration + 1), end: previousEnd };
}

type Row = Record<string, unknown>;
const firstRow = (value: unknown): Row => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? row as Row : {};
};
const rows = (value: unknown) => Array.isArray(value) ? value.filter((row): row is Row => Boolean(row && typeof row === "object")) : [];

/** Marca de la consultora que lleva a un cliente: nombre comercial (o el de la organización) y correo de respuesta. */
export async function consultoraBrandFor(supabase: SupabaseClient, organizationId: string): Promise<{ name: string | null; replyTo: string | null; logoUrl: string | null; accentColor: string | null }> {
  const { data: assignment } = await supabase.from("consultant_assignments").select("consulting_organization_id").eq("organization_id", organizationId).eq("is_active", true).not("consulting_organization_id", "is", null).order("is_primary", { ascending: false }).limit(1).maybeSingle();
  const fields = "display_name, brand_name, brand_reply_to, brand_logo_url, brand_accent_color, kind, created_by";
  const organizationResult = await supabase.from("organizations").select(fields).eq("id", assignment?.consulting_organization_id ?? organizationId).maybeSingle();
  let consultora: Row | null = organizationResult.data;
  if (!assignment?.consulting_organization_id && consultora?.kind !== "consulting") {
    // Own stores have a real owner membership, not a consultant assignment.
    const creator = consultora?.created_by;
    consultora = null;
    if (creator) {
      const memberships = await supabase.from("organization_members").select(`organizations!inner(${fields})`).eq("user_id", creator).eq("is_active", true).eq("organizations.kind", "consulting").limit(2);
      if (memberships.data?.length === 1) {
        const joined = memberships.data[0]!.organizations;
        consultora = (Array.isArray(joined) ? joined[0] : joined) as Row | null;
      }
    }
  }
  const pick = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return { name: pick(consultora?.brand_name) ?? pick(consultora?.display_name), replyTo: pick(consultora?.brand_reply_to), logoUrl: pick(consultora?.brand_logo_url), accentColor: isReportAccentColor(consultora?.brand_accent_color) ? consultora.brand_accent_color : null };
}

/** Consultora que firma los informes de un cliente; null si no tiene o no se puede leer. */
export async function consultoraNameFor(supabase: SupabaseClient, organizationId: string): Promise<string | null> {
  return (await consultoraBrandFor(supabase, organizationId)).name;
}

export async function buildOrganizationReport(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    storeId: string | null;
    templateId: ReportTemplateId;
    periodStart: Date;
    periodEnd: Date;
    analysis?: ReportAnalysis;
  },
): Promise<ReportFailure | BuiltReport> {
  const { organizationId, storeId, templateId, periodStart, periodEnd } = input;
  const template = getReportTemplate(templateId);
  if (!template) return failure("report_template_unavailable", "La plantilla solicitada no existe.", "Elige una plantilla disponible.");
  const { start: previousPeriodStart, end: previousPeriodEnd } = previousPeriod(periodStart, periodEnd);

  let storesQuery = supabase
    .from("shopify_stores")
    .select("id, currency_code, shop_name, myshopify_domain")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (storeId) storesQuery = storesQuery.eq("id", storeId);
  const { data: stores, error: storesError } = await storesQuery.limit(2);
  if (storesError) return failure("report_store_scope_unavailable", storesError.message, "Reintentar cuando Shopify esté disponible.");
  const activeStores = stores ?? [];
  if (!storeId && activeStores.length > 1) {
    return failure("shopify_store_selection_required", "Hay varias tiendas y no se pueden mezclar sus monedas en un único informe.", "Selecciona una tienda y vuelve a pedir el informe.");
  }
  const store = activeStores[0];
  if (!store && template.applications.includes("Shopify")) {
    return failure("shopify_store_unavailable", "No hay una tienda Shopify activa en el alcance seleccionado.", "Conecta Shopify o selecciona una tienda activa.");
  }
  const currencyCode = typeof store?.currency_code === "string" ? store.currency_code.toUpperCase() : "EUR";
  if (store && !/^[A-Z]{3}$/.test(currencyCode)) {
    return failure("shopify_currency_unavailable", "La moneda de la tienda no está confirmada.", "Sincroniza la tienda y confirma su moneda antes de generar importes.");
  }

  const scopeStoreId = store?.id ?? storeId ?? null;
  const rpcArgs = (start: Date, end: Date) => ({
    target_organization_id: organizationId,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    target_store_id: scopeStoreId,
  });
  const providerArgsFor = (start: Date, end: Date) => ({
    target_organization_id: organizationId,
    period_start: isoDate(start),
    period_end: isoDate(end),
    target_store_id: scopeStoreId,
  });
  const providerArgs = providerArgsFor(periodStart, periodEnd);
  const previousProviderArgs = providerArgsFor(previousPeriodStart, previousPeriodEnd);
  const financeArgsFor = (start: Date, end: Date) => ({ ...providerArgsFor(start, end), period_start: start.toISOString(), period_end: end.toISOString() });
  const none = Promise.resolve({ data: null, error: null });
  const noRows = Promise.resolve({ data: [], error: null });
  const needsShopify = template.applications.includes("Shopify");
  const needsMeta = template.applications.includes("Meta Ads");
  const needsKlaviyo = template.applications.includes("Klaviyo");
  const needsProducts = ["shopify_comercial", "adquisicion_multicanal", "resumen_multicanal"].includes(templateId);
  const needsFinance = templateId === "shopify_rentabilidad" || templateId === "resumen_multicanal";
  const needsDaily = needsShopify && templateId !== "shopify_clientes";
  const calls = await Promise.all([
    needsShopify ? supabase.rpc("shopify_sales_summary", rpcArgs(periodStart, periodEnd)) : none,
    needsShopify ? supabase.rpc("shopify_sales_summary", rpcArgs(previousPeriodStart, previousPeriodEnd)) : none,
    needsFinance ? supabase.rpc("shopify_financial_summary", financeArgsFor(periodStart, periodEnd)) : none,
    templateId === "shopify_clientes" ? supabase.rpc("shopify_customer_value", { target_organization_id: organizationId, target_store_id: scopeStoreId }) : none,
    templateId === "shopify_clientes" ? supabase.rpc("shopify_cohorts", { target_organization_id: organizationId, target_store_id: scopeStoreId, months_back: 12 }) : none,
    needsProducts ? supabase.rpc("shopify_top_products", { ...rpcArgs(periodStart, periodEnd), result_limit: 8 }) : none,
    needsMeta ? supabase.rpc("meta_spend_summary", providerArgs) : none,
    needsMeta ? supabase.rpc("meta_spend_by_campaign", providerArgs) : none,
    // También para rentabilidad: su inversión publicitaria sale de Meta.
    needsMeta || needsFinance ? (() => { let query = supabase.from("meta_ad_accounts").select("currency_code").eq("organization_id", organizationId).eq("is_active", true); if (store?.id) query = query.eq("store_id", store.id); return query; })() : noRows,
    needsKlaviyo ? supabase.rpc("klaviyo_email_report", providerArgs) : none,
    supabase.from("organizations").select("display_name, currency_code").eq("id", organizationId).maybeSingle(),
    // Periodo anterior: cada bloque se compara consigo mismo, no solo las ventas.
    needsFinance ? supabase.rpc("shopify_financial_summary", financeArgsFor(previousPeriodStart, previousPeriodEnd)) : none,
    needsMeta ? supabase.rpc("meta_spend_summary", previousProviderArgs) : none,
    needsKlaviyo ? supabase.rpc("klaviyo_email_report", previousProviderArgs) : none,
    // La moneda de Klaviyo solo se da por confirmada si está configurada en Costes.
    needsKlaviyo ? supabase.from("organization_financial_settings").select("klaviyo_revenue_currency_code").eq("organization_id", organizationId).not("klaviyo_revenue_currency_code", "is", null).limit(1) : noRows,
    // Evolución diaria (UTC, como el resto de la plataforma).
    needsDaily ? supabase.rpc("shopify_sales_daily", rpcArgs(periodStart, periodEnd)) : none,
    needsDaily ? supabase.rpc("shopify_sales_daily", rpcArgs(previousPeriodStart, previousPeriodEnd)) : none,
    templateId === "meta_publicidad" ? supabase.rpc("meta_spend_daily", providerArgs) : none,
    templateId === "klaviyo_email" ? supabase.rpc("klaviyo_daily_revenue", providerArgs) : none,
    consultoraNameFor(supabase, organizationId).catch(() => null),
  ]);
  const [currentResult, previousResult, financeResult, customerResult, cohortResult, productsResult, metaResult, campaignResult, metaAccountsResult, klaviyoResult, organizationResult, previousFinanceResult, previousMetaResult, previousKlaviyoResult, klaviyoCurrencyResult, salesDailyResult, previousSalesDailyResult, metaDailyResult, klaviyoDailyResult, preparedBy] = calls;
  if (organizationResult.error) return failure("report_data_unavailable", organizationResult.error.message, "Vuelve a intentarlo más tarde.");

  const current = firstRow(currentResult.data);
  const generatedAt = new Date().toISOString();
  const metaAccountRows = rows(metaAccountsResult.data);
  const metaCurrencies = [...new Set(metaAccountRows.map((row) => String(row.currency_code ?? "").toUpperCase()).filter((code) => /^[A-Z]{3}$/.test(code)))];
  const metaCurrencyMismatch = metaCurrencies.length > 1;
  const metaCurrencyUnconfirmed = needsMeta && (metaCurrencies.length !== 1 || metaAccountRows.length === 0 || metaAccountRows.some((row) => !/^[A-Z]{3}$/.test(String(row.currency_code ?? "").toUpperCase())));
  const hideMetaTotals = metaCurrencyMismatch || metaCurrencyUnconfirmed;
  const organizationCurrencyCode = typeof organizationResult.data?.currency_code === "string" ? organizationResult.data.currency_code.toUpperCase() : "";
  const reportCurrencyCode = store ? currencyCode : metaCurrencies.length === 1 ? metaCurrencies[0]! : /^[A-Z]{3}$/.test(organizationCurrencyCode) ? organizationCurrencyCode : currencyCode;
  const sourceState = (data: unknown, error: { message?: string } | null, emptyIsPartial = false) => ({
    status: error ? "unavailable" as const : data === null || data === undefined ? "unavailable" as const : emptyIsPartial ? "partial" as const : "available" as const,
    detail: error?.message ? `Fuente no disponible: ${error.message}` : data === null || data === undefined ? "La fuente no devolvió datos para este periodo." : emptyIsPartial ? "La consulta no contiene actividad registrada; revisa sincronización y cobertura antes de interpretar el cero." : "Datos sincronizados consultados directamente por el backend.",
  });
  const configuredKlaviyoCurrency = String(rows(klaviyoCurrencyResult.data)[0]?.klaviyo_revenue_currency_code ?? "").toUpperCase();
  const klaviyoCurrencyCode = /^[A-Z]{3}$/.test(configuredKlaviyoCurrency) ? configuredKlaviyoCurrency : null;
  const klaviyoState = sourceState(klaviyoResult.data, klaviyoResult.error, rows(klaviyoResult.data).length === 0);
  // ads_spend_summary suma el gasto tal cual: si Meta no está en la moneda de la tienda, el beneficio lo resta sin convertir.
  const adsCurrencyWarning = needsFinance && Number(firstRow(financeResult.data).ads_spend ?? 0) > 0 && (metaCurrencies.length !== 1 || metaCurrencies[0] !== reportCurrencyCode)
    ? metaCurrencies.length > 1 || (metaCurrencies.length === 1 && metaCurrencies[0] !== reportCurrencyCode)
      ? `La inversión publicitaria está en ${metaCurrencies.join(" y ")} y la tienda en ${reportCurrencyCode}; el beneficio neto la resta sin convertir, así que tómalo como aproximado.`
      : "No se pudo confirmar la moneda de las cuentas publicitarias; el beneficio neto puede restar inversión en otra moneda."
    : null;
  const storeLabel = store ? String(store.shop_name ?? "").trim() || String(store.myshopify_domain ?? "").trim() || "Tienda Shopify" : "Alcance de integraciones";

  const report = buildLiveReportDocument({
    templateId,
    organizationName: organizationResult.data?.display_name ?? "Organización",
    storeName: storeLabel,
    currencyCode: reportCurrencyCode,
    periodStart: isoDate(periodStart),
    periodEnd: isoDate(periodEnd),
    previousPeriodStart: isoDate(previousPeriodStart),
    previousPeriodEnd: isoDate(previousPeriodEnd),
    generatedAt,
    data: {
      shopify: current,
      previousShopify: firstRow(previousResult.data),
      finance: firstRow(financeResult.data),
      ...(needsFinance && !previousFinanceResult.error ? { previousFinance: firstRow(previousFinanceResult.data) } : {}),
      customer: firstRow(customerResult.data),
      cohorts: rows(cohortResult.data),
      products: rows(productsResult.data),
      ...(hideMetaTotals ? {} : { meta: firstRow(metaResult.data) }),
      ...(hideMetaTotals || previousMetaResult.error ? {} : { previousMeta: firstRow(previousMetaResult.data) }),
      ...(metaCurrencies[0] ? { metaCurrencyCode: metaCurrencies[0] } : {}),
      campaigns: rows(campaignResult.data),
      metaCampaigns: hideMetaTotals ? [] : rows(campaignResult.data),
      klaviyo: rows(klaviyoResult.data),
      ...(needsKlaviyo && !previousKlaviyoResult.error ? { previousKlaviyo: rows(previousKlaviyoResult.data) } : {}),
      ...(klaviyoCurrencyCode ? { klaviyoCurrencyCode } : {}),
      salesDaily: rows(salesDailyResult.data),
      previousSalesDaily: rows(previousSalesDailyResult.data),
      metaDaily: hideMetaTotals ? [] : rows(metaDailyResult.data),
      klaviyoDaily: rows(klaviyoDailyResult.data),
      ...(adsCurrencyWarning ? { adsCurrencyWarning } : {}),
    },
    ...(preparedBy ? { preparedBy } : {}),
    sourceStatus: {
      Shopify: sourceState(
        templateId === "shopify_clientes" ? customerResult.data : needsFinance ? financeResult.data : currentResult.data,
        templateId === "shopify_clientes" ? customerResult.error : needsFinance ? financeResult.error : currentResult.error,
        templateId === "shopify_clientes"
          ? Number(firstRow(customerResult.data).customers ?? 0) === 0
          : needsFinance
            ? firstRow(financeResult.data).has_settings === false || Number(firstRow(financeResult.data).items_without_cost ?? 0) > 0
            : Number(current.orders_count ?? 0) === 0,
      ),
      "Meta Ads": hideMetaTotals
        ? { status: "partial" as const, detail: metaCurrencyMismatch ? "Las cuentas conectadas usan monedas distintas; se ocultan los totales para no sumar importes incompatibles." : "No se pudo confirmar una moneda única para las cuentas de Meta; se omiten los importes." }
        : sourceState(metaResult.data, metaResult.error ?? metaAccountsResult.error, Number(firstRow(metaResult.data).days_with_data ?? 0) === 0),
      // Sin moneda de Klaviyo configurada los importes se muestran en la del
      // informe, pero la fuente queda como parcial y lo dice.
      Klaviyo: klaviyoCurrencyCode || klaviyoState.status === "unavailable"
        ? klaviyoState
        : { status: "partial" as const, detail: `Moneda de los ingresos de Klaviyo sin confirmar: se muestran en ${reportCurrencyCode}. Configúrala en Configuración › Costes.` },
    },
    ...(input.analysis ? { analysis: input.analysis } : {}),
  });

  return {
    ok: true,
    report,
    storeId: scopeStoreId,
    storeScope: storeId ? "selected_store" : store ? "single_store" : "organization_scope",
    sources: [
      ...(needsShopify ? [templateId === "shopify_clientes" ? "shopify_customer_value+shopify_cohorts" : needsFinance ? "shopify_financial_summary" : "shopify_sales_summary"] : []),
      ...(needsMeta ? ["meta_spend_summary+meta_spend_by_campaign"] : []),
      ...(needsKlaviyo ? ["klaviyo_email_report"] : []),
    ].join(";"),
  };
}

/**
 * Renderiza, sube a `copilot-reports/<org>/<id>.pdf` y deja la fila en
 * `copilot_reports` (historial). Si la fila falla el PDF sigue valiendo:
 * se devuelve igual y se avisa en `historyError`.
 */
export async function saveReport(
  supabase: SupabaseClient,
  report: ReportDocument,
  meta: { organizationId: string; storeId: string | null; source: ReportSource; requestedBy: string | null },
): Promise<ReportFailure | { ok: true; reportId: string; fileName: string; pdf: Buffer; historyError: string | null }> {
  const brand = await consultoraBrandFor(supabase, meta.organizationId).catch(() => ({ name: null, replyTo: null, logoUrl: null, accentColor: null }));
  const brandedReport = brand.name ? { ...report, preparedBy: brand.name } : report;
  let logo: Buffer | undefined;
  const logoPath = reportLogoStoragePath(brand.logoUrl);
  if (logoPath) {
    try {
      const file = await supabase.storage.from("avatars").download(logoPath);
      if (file.data && file.data.size <= 2 * 1024 * 1024) {
        const buffer = Buffer.from(await file.data.arrayBuffer());
        if (isReportLogo(buffer)) logo = buffer;
      }
    } catch { /* Keep the text signature if the logo cannot be read. */ }
  }
  const pdf = await renderReportPdf(brandedReport, { ...(logo ? { logo } : {}), accentColor: brand.accentColor });
  const reportId = crypto.randomUUID();
  const fileName = `informe-${report.templateId}-${report.periodStart}-${report.periodEnd}.pdf`;
  const storagePath = `${meta.organizationId}/${reportId}.pdf`;
  const { error: uploadError } = await supabase.storage.from(REPORT_BUCKET)
    .upload(storagePath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) return failure("report_storage_unavailable", uploadError.message, "Reintentar más tarde.");

  const reading = report.sections.find((section) => section.kind === "summary" && section.title === "Lectura del periodo");
  const actions = report.sections.find((section) => section.kind === "summary" && section.title === "Recomendaciones");
  const { error: historyError } = await supabase.from("copilot_reports").insert({
    id: reportId,
    organization_id: meta.organizationId,
    store_id: meta.storeId,
    template_id: report.templateId,
    template_version: report.templateVersion,
    title: report.title,
    period_start: report.periodStart,
    period_end: report.periodEnd,
    currency_code: report.currencyCode,
    file_name: fileName,
    storage_path: storagePath,
    source: meta.source,
    requested_by: meta.requestedBy,
    prepared_by: brandedReport.preparedBy ?? null,
    highlights: reading?.kind === "summary" ? reading.points : [],
    recommendations: actions?.kind === "summary" ? actions.points : [],
    key_metrics: reportDigest(report),
  });
  return { ok: true, reportId, fileName, pdf, historyError: historyError?.message ?? null };
}
