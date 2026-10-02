export type KlaviyoEmailAlert = { kind: "spam" | "unsub" | "low_open"; text: string } | null;

export type KlaviyoEmailListRow = {
  id: string;
  kind: "campaign" | "flow";
  name: string;
  subject: string | null;
  trigger_type: string | null;
  send_time: string | null;
  revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  unsubscribes: number;
  bounced: number;
  spam_complaints: number;
  opens_unique: number;
  clicks_unique: number;
  open_rate: number | null;
  click_rate: number | null;
  ctor: number | null;
  revenue_per_recipient: number | null;
  unsub_rate: number | null;
  bounce_rate: number | null;
  spam_rate: number | null;
  alert: KlaviyoEmailAlert;
};

export type KlaviyoEmailsResponse = {
  organization_id: string;
  connected: boolean;
  currency: string | null;
  period: { days: number; start?: string; end?: string };
  total: number;
  page: number;
  page_size: number;
  emails: KlaviyoEmailListRow[];
  summary: {
    total: number;
    campaigns: number;
    flows: number;
    revenue: number;
    flow_revenue: number;
    flow_share_pct: number | null;
    account_open_rate: number | null;
    account_click_rate: number | null;
    account_revenue_per_recipient: number | null;
    alerts: number;
  } | null;
};

export type KlaviyoEmailStep = {
  message_id: string;
  position: number;
  subject: string | null;
  preview_text: string | null;
  template_name: string | null;
  body_chars: number | null;
  adds_utm: boolean;
  tracks_clicks: boolean | null;
  revenue: number;
  recipients: number;
  delivered: number;
  open_rate: number | null;
  click_rate: number | null;
};

export type KlaviyoEmailDetailResponse = {
  organization_id: string;
  currency: string | null;
  period: { days: number; start: string; end: string };
  stats_coverage: "period" | "lifetime" | "not_found";
  entity: KlaviyoEmailListRow & { type: "campaign" | "flow"; has_utm: boolean };
  account: { open_rate: number | null; click_rate: number | null; revenue_per_recipient: number | null };
  steps: KlaviyoEmailStep[];
  links: Array<{ url: string; clicks: number; personas: number }>;
  links_coverage: "available" | "unavailable";
  audience: Array<{ kind: string; role: string; name: string }>;
};
