import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { klaviyoCampaignStatus, type KAudience, type KCampaign, type KStats } from "./klaviyo-workspace";

/**
 * Una sola lista de campañas: lo planificado en NORA (calendario + pieza) y lo
 * que existe en Klaviyo, enlazado cuando es la misma campaña. Es la fuente de
 * Hoy y de Campañas, para que las dos pantallas digan lo mismo.
 */

export type CampaignState =
  | "late" // planificada, la fecha pasó y no ha salido
  | "nopiece" // planificada sin pieza
  | "review" // pieza en borrador o esperando aprobación
  | "ready" // pieza aprobada, falta programar
  | "scheduled"
  | "sending"
  | "sent"
  | "draft" // borrador creado en Klaviyo
  | "cancelled";

export type CampaignRow = {
  key: string;
  source: "nora" | "klaviyo" | "both";
  name: string;
  subject: string | null;
  state: CampaignState;
  date: string | null;
  channel: string;
  audiences: { included: KAudience[]; excluded: KAudience[] };
  stats: KStats | null;
  campaign: KCampaign | null;
  item: CampaignItem | null;
  draft: MarketingDraft | null;
};

export const STATE_LABEL: Record<CampaignState, { label: string; tone: "neutral" | "brand" | "success" | "warn" | "danger" }> = {
  late: { label: "Va tarde", tone: "danger" },
  nopiece: { label: "Sin pieza", tone: "warn" },
  review: { label: "Pieza en revisión", tone: "warn" },
  ready: { label: "Lista para programar", tone: "brand" },
  scheduled: { label: "Programada en Klaviyo", tone: "success" },
  sending: { label: "Enviándose", tone: "brand" },
  sent: { label: "Enviada", tone: "neutral" },
  draft: { label: "Borrador en Klaviyo", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

export const UPCOMING: CampaignState[] = ["late", "nopiece", "review", "ready", "scheduled", "sending"];

function planState(item: CampaignItem, draft: MarketingDraft | null, nowMs: number): CampaignState {
  const past = Date.parse(item.ends_at ?? item.starts_at) < nowMs;
  if (!item.marketing_draft_id) return past ? "late" : "nopiece";
  if (draft && ["approved", "published"].includes(draft.status)) return past ? "late" : "ready";
  return past ? "late" : "review";
}

export function buildCampaignRows(
  items: CampaignItem[],
  drafts: MarketingDraft[],
  campaigns: KCampaign[],
  nowMs: number = Date.now(),
): CampaignRow[] {
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const linked = new Set<string>();
  const rows: CampaignRow[] = [];

  for (const item of items) {
    if (item.status === "cancelled") continue;
    // Solo email: Meta vive en su propio módulo y aquí no se programa.
    if (!/email|klaviyo/i.test(item.channel)) continue;
    const draft = item.marketing_draft_id ? (draftById.get(item.marketing_draft_id) ?? null) : null;
    const campaign = item.klaviyo_campaign_id ? (campaignById.get(item.klaviyo_campaign_id) ?? null) : null;
    if (campaign) {
      linked.add(campaign.id);
      rows.push(fromCampaign(campaign, item, draft));
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
      channel: "email",
      audiences: { included: [], excluded: [] },
      stats: null,
      campaign: null,
      item,
      draft,
    });
  }
  for (const campaign of campaigns) {
    if (!linked.has(campaign.id)) rows.push(fromCampaign(campaign, null, null));
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
    channel: campaign.channel,
    audiences: campaign.audiences,
    stats: campaign.stats,
    campaign,
    item,
    draft,
  };
}

export function audienceSize(audiences: KAudience[]) {
  const sizes = audiences.map((audience) => audience.size);
  return sizes.length && sizes.every((size) => typeof size === "number")
    ? (sizes as number[]).reduce((sum, size) => sum + size, 0)
    : null;
}
