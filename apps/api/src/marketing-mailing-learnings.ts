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
};

type CampaignAggregate = {
  name: string;
  subject: string | null;
  revenue: number;
  delivered: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
};

const metric = (value: number | string | null | undefined) => {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return Number.isFinite(parsed) ? Number(parsed) : 0;
};

const rate = (numerator: number, denominator: number) =>
  denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;

function isMatureMonth(bucketMonth: string, now: Date, maturityDays: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bucketMonth)) return false;
  const start = new Date(`${bucketMonth}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== bucketMonth) return false;
  if (start.getUTCDate() !== 1) return false;
  const nextMonthStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  return nextMonthStart <= now.getTime() - maturityDays * 86_400_000;
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
  const matureRows = campaignRows.filter((row) => isMatureMonth(row.bucket_month, now, maturityDays));
  const observedIds = new Set(campaignRows.map((row) => row.entity_id!));
  const matureIds = new Set(matureRows.map((row) => row.entity_id!));
  const byCampaign = new Map<string, CampaignAggregate>();
  for (const row of matureRows) {
    const id = row.entity_id!;
    const current = byCampaign.get(id) ?? {
      name: row.entity_name ?? "(sin nombre)",
      subject: row.subject,
      revenue: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
      unsubscribes: 0,
    };
    current.revenue += metric(row.revenue);
    current.delivered += metric(row.delivered);
    current.opens += metric(row.opens_unique);
    current.clicks += metric(row.clicks_unique);
    current.unsubscribes += metric(row.unsubscribes);
    if (!current.subject && row.subject) current.subject = row.subject;
    byCampaign.set(id, current);
  }

  const eligible = [...byCampaign.values()].filter((campaign) => campaign.delivered >= minimumDelivered);
  const shape = (campaign: CampaignAggregate) => ({
    campana: campaign.name,
    asunto: campaign.subject,
    entregados: campaign.delivered,
    ingresos_atribuidos_klaviyo: Math.round(campaign.revenue),
    tasa_apertura: rate(campaign.opens, campaign.delivered),
    tasa_clic: rate(campaign.clicks, campaign.delivered),
    tasa_baja: rate(campaign.unsubscribes, campaign.delivered),
  });
  const byRevenue = [...eligible].sort((left, right) => right.revenue - left.revenue);
  const byClickRate = [...eligible].sort(
    (left, right) => (rate(right.clicks, right.delivered) ?? 0) - (rate(left.clicks, left.delivered) ?? 0),
  );
  const byLowClickRate = [...byClickRate].reverse();

  return {
    criteria: {
      monthly_cohort_mature_days: maturityDays,
      minimum_delivered: minimumDelivered,
      interpretation: "descriptive_only_no_causal_or_significance_claim",
    },
    campaigns_observed: observedIds.size,
    mature_campaigns: byCampaign.size,
    comparable_campaigns: eligible.length,
    omitted_immature_campaigns: [...observedIds].filter((id) => !matureIds.has(id)).length,
    omitted_low_sample_campaigns: [...byCampaign.values()].filter((campaign) => campaign.delivered < minimumDelivered).length,
    mejores_por_ingreso: byRevenue.slice(0, 5).map(shape),
    mejores_por_clic: byClickRate.slice(0, 5).map(shape),
    alertas_bajo_engagement: byLowClickRate.slice(0, 5).map(shape),
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
