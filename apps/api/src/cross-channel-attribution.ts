// Fase 10 (conocimiento/fase-10/03-runtime/10.03): adaptadores de cada fuente
// al contrato canonico AttributionEvidence. Cada uno declara lo que su fuente
// entrega de verdad; lo que no entrega queda null (desconocido), nunca un
// default ni un 0.
import type { AttributionEvidence } from "@e-nora/contracts";

export type MeasurementPeriod = { start: string; end: string };

/** Una moneda solo si todas las filas coinciden en un ISO 4217 valido. */
export function singleCurrency(codes: ReadonlyArray<string | null | undefined>): string | null {
  const distinct = new Set(codes.map((code) => code?.trim().toUpperCase() ?? ""));
  if (distinct.size !== 1) return null;
  const [code] = distinct;
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
}

/** Monedas de las cuentas/tiendas de cada organizacion, sin resolver aun. */
export function currenciesByOrganization(
  rows: ReadonlyArray<{ organization_id: string; currency_code: string | null }> | null,
): Map<string, Array<string | null>> {
  const map = new Map<string, Array<string | null>>();
  for (const row of rows ?? []) {
    map.set(row.organization_id, [...(map.get(row.organization_id) ?? []), row.currency_code]);
  }
  return map;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const CURRENCY_LIMITATION =
  "moneda desconocida o varias monedas entre cuentas: no se compara con otras fuentes";

/** Ancla economica: ventas observadas de Shopify (G-XCA-004). */
export function shopifyNetSalesEvidence(input: {
  period: MeasurementPeriod;
  netSales: unknown;
  storeCurrencies: ReadonlyArray<string | null>;
}): AttributionEvidence {
  const limitations: string[] = [];
  const hasStore = input.storeCurrencies.length > 0;
  const value = hasStore ? toNumberOrNull(input.netSales) : null;
  if (!hasStore) limitations.push("sin tienda Shopify: no hay ancla economica observada");
  const currency = singleCurrency(input.storeCurrencies);
  if (hasStore && currency === null) limitations.push(CURRENCY_LIMITATION);
  return {
    metric_id: "shopify.net_sales",
    source_system: "shopify",
    channel: "store",
    measurement_period: input.period,
    measurement_basis: "observed",
    attribution_basis: null,
    attribution_model: null,
    attribution_window: null,
    // Definicion canonica de shopify_financial_summary.net_sales (con IVA y envio).
    revenue_basis: "shopify_current_total_price_minus_refunds",
    currency_code: currency,
    value,
    value_state: value === null ? "missing" : "available",
    evidence_role: "economic_anchor",
    lineage: ["rpc:shopify_financial_summary.net_sales"],
    data_maturity: "provisional",
    limitations,
  };
}

/** Revenue que Meta se atribuye (compra canonica de la cuenta, una ventana por fila). */
export function metaPurchaseValueEvidence(input: {
  period: MeasurementPeriod;
  purchaseValue: unknown;
  accountCurrencies: ReadonlyArray<string | null>;
  attributionWindow: string | null | undefined;
}): AttributionEvidence {
  const value = toNumberOrNull(input.purchaseValue);
  const currency = singleCurrency(input.accountCurrencies);
  const window = input.attributionWindow?.trim() || null;
  const limitations = [
    "credito que Meta se adjudica bajo su modelo; no es revenue incremental ni ventas de la tienda",
    "Meta puede reatribuir conversiones de dias recientes",
  ];
  if (currency === null) limitations.push(CURRENCY_LIMITATION);
  if (window === null) {
    limitations.push("ventana de atribucion no identificada o mezcla de ventanas entre filas");
  }
  return {
    metric_id: "meta.purchase_value",
    source_system: "meta",
    channel: "paid_social",
    measurement_period: input.period,
    measurement_basis: "observed",
    attribution_basis: "attributed",
    attribution_model: "platform_reported",
    attribution_window: window,
    revenue_basis: "platform_attributed_purchase_value",
    currency_code: currency,
    value,
    value_state: value === null ? "missing" : "available",
    evidence_role: "channel_signal",
    lineage: ["rpc:consultant_meta_by_org.purchase_value"],
    data_maturity: "provisional",
    limitations,
  };
}

/**
 * Revenue que Klaviyo atribuye a las campanas enviadas en el periodo.
 * - Sin metrica de conversion elegida la integracion esta incompleta (ADR-0021
 *   pto. 4): valor desconocido, no 0.
 * - recipients 0 = el RPC no encontro valores del Reporting API para esas
 *   campanas (los coalesce a 0): tampoco es un 0 observado.
 * - La ventana de atribucion de Klaviyo es un ajuste de la cuenta que la API
 *   no devuelve (ni /accounts ni el Reporting API la traen): siempre null.
 *   KLAVIYO_CLICK_WINDOW_DAYS de klaviyo-sync.ts es la ventana de descarga de
 *   eventos "Clicked Email", no una ventana de atribucion.
 */
export function klaviyoCampaignRevenueEvidence(input: {
  period: MeasurementPeriod;
  revenue: unknown;
  recipients: number;
  accountCurrencies: ReadonlyArray<string | null>;
  conversionMetricSelected: boolean;
}): AttributionEvidence {
  const limitations = [
    "credito que Klaviyo se adjudica bajo su modelo; no es revenue incremental ni ventas de la tienda",
    "Klaviyo no expone por API la ventana de atribucion de la cuenta",
    "solo campanas enviadas en el periodo; excluye flows",
    "Reporting API en buckets mensuales (aproximacion de consultant_klaviyo_by_org)",
  ];
  let value = toNumberOrNull(input.revenue);
  if (!input.conversionMetricSelected) {
    value = null;
    limitations.push("conversion_metric_not_selected: integracion incompleta");
  } else if (input.recipients <= 0) {
    value = null;
    limitations.push("sin valores del Reporting API para las campanas del periodo");
  }
  const currency = singleCurrency(input.accountCurrencies);
  if (currency === null) limitations.push(CURRENCY_LIMITATION);
  return {
    metric_id: "klaviyo.campaign_conversion_value",
    source_system: "klaviyo",
    channel: "email",
    measurement_period: input.period,
    measurement_basis: "observed",
    attribution_basis: "attributed",
    attribution_model: "platform_reported",
    attribution_window: null,
    revenue_basis: "klaviyo_conversion_metric_value",
    currency_code: currency,
    value,
    value_state: value === null ? "missing" : "available",
    evidence_role: "channel_signal",
    lineage: ["rpc:consultant_klaviyo_by_org.revenue", "klaviyo_accounts.conversion_metric_id"],
    data_maturity: "provisional",
    limitations,
  };
}
