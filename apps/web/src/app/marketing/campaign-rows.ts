import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { klaviyoCampaignStatus, type KAudience, type KCampaign, type KStats } from "./klaviyo-workspace";
import type { MetaCampaignListRow } from "../meta/campaign-types";

/**
 * Una sola lista por tienda: propuestas A05, calendario y piezas de NORA, más
 * las campañas conectadas de Klaviyo y Meta, deduplicadas cuando se enlazan.
 */

export type CampaignState =
  | "late" // planificada, la fecha pasó y no ha salido
  | "plan" // accion A05 en calendario, requiere revision y preparacion
  | "nopiece" // planificada sin pieza
  | "review" // pieza en borrador o esperando aprobación
  | "ready" // pieza aprobada, falta programar
  | "scheduled"
  | "sending"
  | "active"
  | "paused"
  | "sent"
  | "draft" // borrador sin aprobar en NORA o en Klaviyo
  | "cancelled";

export type CampaignRow = {
  key: string;
  source: "nora" | "klaviyo" | "meta" | "both" | "proposal";
  name: string;
  subject: string | null;
  state: CampaignState;
  date: string | null;
  createdAt?: string | null;
  channel: string;
  audiences: { included: KAudience[]; excluded: KAudience[] };
  stats: KStats | null;
  campaign: KCampaign | null;
  item: CampaignItem | null;
  draft: MarketingDraft | null;
  proposalIndex?: number;
  initiative?: string;
  metaCampaign?: MetaCampaignListRow;
};

export type CampaignPlanSummary = {
  output_id: string;
  generated_at?: string;
  applied_indexes?: number[];
  content: {
    campaigns: Array<{
      initiative?: string;
      title: string;
      channel: string;
      objective: string;
      scheduled_date: string;
    }>;
    calendar_actions?: Array<{
      index: number;
      title: string;
      channel: string;
      objective: string;
      scheduled_date: string;
      initiative: string;
      breadcrumb: string[];
      action_type: string;
    }>;
  } | null;
};

export const STATE_LABEL: Record<CampaignState, { label: string; tone: "neutral" | "brand" | "success" | "warn" | "danger" }> = {
  late: { label: "Va tarde", tone: "danger" },
  plan: { label: "Plan IA · por revisar", tone: "brand" },
  nopiece: { label: "Sin pieza", tone: "warn" },
  review: { label: "Pieza en revisión", tone: "warn" },
  ready: { label: "Lista para programar", tone: "brand" },
  scheduled: { label: "Programada en Klaviyo", tone: "success" },
  sending: { label: "Enviándose", tone: "brand" },
  active: { label: "Activa en Meta", tone: "success" },
  paused: { label: "En pausa en Meta", tone: "neutral" },
  sent: { label: "Enviada", tone: "neutral" },
  draft: { label: "Borrador", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

export const UPCOMING: CampaignState[] = ["late", "plan", "nopiece", "review", "ready", "scheduled", "sending"];

function planState(item: CampaignItem, draft: MarketingDraft | null, nowMs: number): CampaignState {
  const past = Date.parse(item.ends_at ?? item.starts_at) < nowMs;
  if (!item.marketing_draft_id) return past ? "late" : item.metadata?.a05_proposal ? "plan" : "nopiece";
  if (draft && ["approved", "published"].includes(draft.status)) return past ? "late" : "ready";
  return past ? "late" : "review";
}

export function buildCampaignRows(
  items: CampaignItem[],
  drafts: MarketingDraft[],
  campaigns: KCampaign[],
  nowMs: number = Date.now(),
  proposal: CampaignPlanSummary | null = null,
  metaCampaigns: MetaCampaignListRow[] = [],
): CampaignRow[] {
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const metaCampaignById = new Map(metaCampaigns.map((campaign) => [campaign.campaign_id, campaign]));
  const linked = new Set<string>();
  const linkedMeta = new Set<string>();
  const linkedDrafts = new Set<string>();
  const rows: CampaignRow[] = [];

  for (const item of items) {
    if (item.status === "cancelled") continue;
    // Solo canales de campaña que esta vista puede preparar: email, Meta e Instagram.
    if (!/email|klaviyo|meta|instagram/i.test(item.channel)) continue;
    const draft = item.marketing_draft_id ? (draftById.get(item.marketing_draft_id) ?? null) : null;
    if (draft) linkedDrafts.add(draft.id);
    const campaign = item.klaviyo_campaign_id ? (campaignById.get(item.klaviyo_campaign_id) ?? null) : null;
    if (campaign) {
      linked.add(campaign.id);
      rows.push(fromCampaign(campaign, item, draft));
      continue;
    }
    const metaCampaign = item.meta_campaign_id
      ? (metaCampaignById.get(item.meta_campaign_id) ?? null)
      : null;
    if (metaCampaign) {
      linkedMeta.add(metaCampaign.campaign_id);
      rows.push(fromMetaCampaign(metaCampaign, item, draft));
      continue;
    }
    // Una planificada ya completada o publicada sin campaña enlazada no va tarde.
    if (["published", "completed"].includes(item.status)) continue;
    rows.push({
      key: `item:${item.id}`,
      source: "nora",
      name: item.title,
      subject: draft?.subject || null,
      state: planState(item, draft, nowMs),
      date: item.starts_at,
      createdAt: draft?.created_at ?? item.created_at,
      channel: item.channel,
      audiences: { included: [], excluded: [] },
      stats: null,
      campaign: null,
      item,
      draft,
      initiative: item.metadata?.a05_proposal?.initiative,
    });
  }
  for (const campaign of campaigns) {
    if (!linked.has(campaign.id)) rows.push(fromCampaign(campaign, null, null));
  }
  for (const campaign of metaCampaigns) {
    if (!linkedMeta.has(campaign.campaign_id)) rows.push(fromMetaCampaign(campaign, null, null));
  }
  for (const draft of drafts) {
    const channel = draft.request?.channel ?? "";
    if (
      draft.content_type !== "campaign" ||
      linkedDrafts.has(draft.id) ||
      !/email|klaviyo|meta|instagram/i.test(channel) ||
      draft.status === "published"
    ) continue;
    rows.push({
      key: `draft:${draft.id}`,
      source: "nora",
      name: draft.template_name || draft.subject || "Borrador de campaña",
      subject: draft.subject || null,
      state:
        draft.status === "pending_approval"
          ? "review"
          : draft.status === "approved"
            ? draft.scheduled_for && Date.parse(draft.scheduled_for) < nowMs ? "late" : "ready"
            : "draft",
      date: draft.scheduled_for,
      createdAt: draft.created_at,
      channel,
      audiences: { included: [], excluded: [] },
      stats: null,
      campaign: null,
      item: null,
      draft,
    });
  }
  if (proposal?.content) {
    const actions = proposal.content.calendar_actions ?? proposal.content.campaigns.map((campaign, index) => ({
      index,
      title: campaign.title,
      channel: campaign.channel,
      objective: campaign.objective,
      scheduled_date: campaign.scheduled_date,
      initiative: campaign.initiative || campaign.title,
      breadcrumb: [campaign.title],
      action_type: "legacy_action",
    }));
    for (const campaign of actions) {
      const index = campaign.index;
      if (proposal.applied_indexes?.includes(index)) continue;
      rows.push({
        key: `proposal:${proposal.output_id}:${index}`,
        source: "proposal",
        name: campaign.title,
        subject: campaign.objective,
        state: "review",
        date: campaign.scheduled_date,
        createdAt: proposal.generated_at,
        channel: campaign.channel,
        audiences: { included: [], excluded: [] },
        stats: null,
        campaign: null,
        item: null,
        draft: null,
        proposalIndex: index,
        initiative: campaign.initiative,
      });
    }
  }
  return rows.sort((a, b) => {
    const upcomingA = UPCOMING.includes(a.state);
    const upcomingB = UPCOMING.includes(b.state);
    if (upcomingA !== upcomingB) return upcomingA ? -1 : 1;
    const timeA = a.date ? Date.parse(a.date) : Number.POSITIVE_INFINITY;
    const timeB = b.date ? Date.parse(b.date) : Number.POSITIVE_INFINITY;
    // Próximas: la más cercana arriba. Pasadas: la más reciente arriba.
    return upcomingA ? timeA - timeB : timeB - timeA;
  });
}

function fromCampaign(campaign: KCampaign, item: CampaignItem | null, draft: MarketingDraft | null): CampaignRow {
  return {
    key: `klaviyo:${campaign.id}`,
    source: item ? "both" : "klaviyo",
    name: item?.title ?? campaign.name,
    subject: campaign.subject,
    state: klaviyoCampaignStatus(campaign.status).key,
    date: campaign.send_time ?? item?.starts_at ?? null,
    createdAt: draft?.created_at ?? item?.created_at ?? campaign.created_at,
    channel: campaign.channel,
    audiences: campaign.audiences,
    stats: campaign.stats,
    campaign,
    item,
    draft,
  };
}

function fromMetaCampaign(
  campaign: MetaCampaignListRow,
  item: CampaignItem | null,
  draft: MarketingDraft | null,
): CampaignRow {
  const status = campaign.effective_status?.toUpperCase();
  const state: CampaignState =
    status === "ACTIVE"
      ? "active"
      : status === "PAUSED"
        ? "paused"
        : ["ARCHIVED", "DELETED"].includes(status ?? "")
          ? "cancelled"
          : ["PENDING_REVIEW", "IN_PROCESS"].includes(status ?? "")
            ? "review"
            : "draft";
  return {
    key: `meta:${campaign.campaign_id}`,
    source: item ? "both" : "meta",
    name: item?.title ?? campaign.name,
    subject: campaign.objective,
    state,
    date: item?.starts_at ?? null,
    createdAt: draft?.created_at ?? item?.created_at,
    channel: "meta_ads",
    audiences: { included: [], excluded: [] },
    stats: null,
    campaign: null,
    item,
    draft,
    metaCampaign: campaign,
  };
}

export function audienceSize(audiences: KAudience[]) {
  const sizes = audiences.map((audience) => audience.size);
  return sizes.length && sizes.every((size) => typeof size === "number")
    ? (sizes as number[]).reduce((sum, size) => sum + size, 0)
    : null;
}
