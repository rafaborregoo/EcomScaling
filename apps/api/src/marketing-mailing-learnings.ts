export type MailingCampaignMetricRow = {
  bucket_month: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  subject: string | null;
  revenue: number | string | null;
  delivered: number | string | null;
  opens_unique: number | string | null;
  clicks_unique: number | string | null;
  unsubscribes: number | string | null;
  account_id?: string | null;
  currency_code?: string | null;
  period_end?: string | null;
};

type CampaignAggregate = {
  id: string;
  name: string;
  subject: string | null;
  accountId: string | null;
  currency: string | null;
  revenue: number | null;
  delivered: number | null;
  opens: number | null;
  clicks: number | null;
  unsubscribes: number | null;
};

const metric = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) && Number(parsed) >= 0 ? Number(parsed) : null;
};

const rate = (numerator: number | null, denominator: number | null) =>
  numerator !== null && denominator !== null && denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
const sum = (a: number | null, b: number | null) => a !== null && b !== null ? a + b : null;

function isMatureMonth(bucketMonth: string, now: Date, maturityDays: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bucketMonth)) return false;
  const start = new Date(`${bucketMonth}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== bucketMonth) return false;
  if (start.getUTCDate() !== 1) return false;
  const nextMonthStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  return nextMonthStart <= now.getTime() - maturityDays * 86_400_000;
}

/** Keep SQL observations separate: no cross-account/currency totals or absent-to-zero conversion. */
export function summarizeMailingReportObservations(rows: MailingCampaignMetricRow[], limit = 30) {
  return {
    observations: rows.slice(0, limit).map((row) => ({
      bucket_month: row.bucket_month, account_id: row.account_id ?? null, entity_id: row.entity_id,
      entity_type: row.entity_type, name: row.entity_name, subject: row.subject,
      period_end: row.period_end ?? null, currency_code: row.currency_code ?? null,
      revenue_attributed_klaviyo: row.account_id && row.currency_code ? metric(row.revenue) : null,
      delivered: metric(row.delivered), opens_unique: metric(row.opens_unique), clicks_unique: metric(row.clicks_unique),
      open_rate: rate(metric(row.opens_unique), metric(row.delivered)),
      click_rate: rate(metric(row.clicks_unique), metric(row.delivered)),
      unsubscribe_rate: rate(metric(row.unsubscribes), metric(row.delivered)),
    })),
    rows_total: rows.length, rows_returned: Math.min(limit, rows.length), truncated: rows.length > limit,
    interpretation: "monthly_observations_not_aggregate_or_causal_verdict",
  };
}

/**
 * Only completed monthly cohorts with a seven-day attribution buffer and at
 * least 50 deliveries may appear in comparative mailing lists. Small or recent
 * campaigns remain counted as omitted evidence instead of becoming winners.
 */
export function summarizeCampaignMailingLearnings(
  rows: MailingCampaignMetricRow[],
  now = new Date(),
  minimumDelivered = 50,
  maturityDays = 7,
) {
  const campaignRows = rows.filter((row) => row.entity_type === "campaign" && row.entity_id);
  const matureRows = campaignRows.filter((row) => row.period_end && Number.isFinite(Date.parse(row.period_end))
    ? Date.parse(row.period_end) + (maturityDays + 1) * 86_400_000 <= now.getTime()
    : isMatureMonth(row.bucket_month, now, maturityDays));
  const observedIds = new Set(campaignRows.map((row) => row.entity_id!));
  const matureIds = new Set(matureRows.map((row) => row.entity_id!));
  const byCampaign = new Map<string, CampaignAggregate>();
  for (const row of matureRows) {
    const id = row.entity_id!;
    const key = `${row.account_id ?? "unknown"}:${id}:${row.currency_code ?? "unknown"}`;
    const currency = typeof row.currency_code === "string" && /^[A-Z]{3}$/.test(row.currency_code) ? row.currency_code : null;
    const current = byCampaign.get(key) ?? {
      id,
      name: row.entity_name ?? "(sin nombre)",
      subject: row.subject,
      accountId: row.account_id ?? null,
      currency,
      revenue: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
      unsubscribes: 0,
    };
    current.revenue = sum(current.revenue, currency && row.account_id ? metric(row.revenue) : null);
    current.delivered = sum(current.delivered, metric(row.delivered));
    current.opens = sum(current.opens, metric(row.opens_unique));
    current.clicks = sum(current.clicks, metric(row.clicks_unique));
    current.unsubscribes = sum(current.unsubscribes, metric(row.unsubscribes));
    if (!current.subject && row.subject) current.subject = row.subject;
    byCampaign.set(key, current);
  }

  const eligible = [...byCampaign.values()].filter((campaign) => campaign.delivered !== null && campaign.delivered >= minimumDelivered);
  const shape = (campaign: CampaignAggregate) => ({
    campaign_id: campaign.id,
    campana: campaign.name,
    asunto: campaign.subject,
    entregados: campaign.delivered,
    account_id: campaign.accountId,
    currency_code: campaign.currency,
    ingresos_atribuidos_klaviyo: campaign.revenue === null ? null : Math.round(campaign.revenue),
    tasa_apertura: rate(campaign.opens, campaign.delivered),
    tasa_clic: rate(campaign.clicks, campaign.delivered),
    tasa_baja: rate(campaign.unsubscribes, campaign.delivered),
  });
  const revenueCurrencies = new Set(eligible.filter((item) => item.revenue !== null).map((item) => item.currency));
  const byRevenue = revenueCurrencies.size === 1
    ? eligible.filter((item) => item.revenue !== null).sort((left, right) => right.revenue! - left.revenue!) : [];
  const byClickRate = eligible.filter((item) => rate(item.clicks, item.delivered) !== null).sort(
    (left, right) => (rate(right.clicks, right.delivered) ?? 0) - (rate(left.clicks, left.delivered) ?? 0),
  );

  return {
    criteria: {
      monthly_cohort_mature_days: maturityDays,
      minimum_delivered: minimumDelivered,
      interpretation: "descriptive_only_no_causal_or_significance_claim",
      revenue_comparison: revenueCurrencies.size > 1 ? "incompatible_currencies" : byRevenue.length ? "known_currency" : "unknown",
      low_engagement_alerts: "not_evaluated_without_an_approved_threshold",
    },
    campaigns_observed: observedIds.size,
    mature_campaigns: byCampaign.size,
    comparable_campaigns: eligible.length,
    omitted_immature_campaigns: [...observedIds].filter((id) => !matureIds.has(id)).length,
    omitted_low_sample_campaigns: [...byCampaign.values()].filter((campaign) => campaign.delivered !== null && campaign.delivered < minimumDelivered).length,
    omitted_unknown_delivery_campaigns: [...byCampaign.values()].filter((campaign) => campaign.delivered === null).length,
    mejores_por_ingreso: byRevenue.slice(0, 5).map(shape),
    mejores_por_clic: byClickRate.slice(0, 5).map(shape),
    alertas_bajo_engagement: [],
  };
}

/** Organization-wide reference templates can be reused; store-bound ones cannot cross stores. */
export function templateIsAvailableInMailingScope(
  templateStoreConnectionId: unknown,
  requestedStoreConnectionId: string | null,
) {
  if (templateStoreConnectionId === null || templateStoreConnectionId === undefined || templateStoreConnectionId === "") {
    return true;
  }
  return typeof templateStoreConnectionId === "string" &&
    requestedStoreConnectionId !== null &&
    templateStoreConnectionId === requestedStoreConnectionId;
}
