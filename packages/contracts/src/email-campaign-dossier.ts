export type EmailCampaignConclusion = "reuse" | "improve_and_test" | "fix_before_reuse" | "insufficient_evidence";
export type EmailCampaignDossier = {
  campaign: { id: string; name: string; subject: string | null; status: string | null; send_time: string | null; synthetic: boolean };
  organization_id: string; store_id: string; connection_id: string; currency: string | null;
  period: { start: string; end: string; granularity: "monthly_aggregates" };
  metrics: { revenue: number | null; conversions: number | null; recipients: number | null; delivered: number | null; opens_unique: number | null; clicks_unique: number | null; unsubscribes: number | null; bounced: number | null; spam_complaints: number | null; open_rate: number | null; click_rate: number | null; unsub_rate: number | null; bounce_rate: number | null };
  metric_status: "available" | "missing" | "unavailable";
  conclusion: { status: EmailCampaignConclusion; summary: string; reasons: string[]; basis: "rules_and_saved_a26"; mature_attribution_verified: false };
  messages: Array<{ id: string; subject: string | null; preheader: string | null; html: string | null; text: string | null; content_hash: string | null; source_revision: string | null; provenance: string; historical_observation: boolean; issues: string[] }>;
  reviews: Array<{ id: string; message_id: string; dimension: string; claim_type: string; observation: string; quote: string | null; change: string; criterion: string; limitation: string; status: string; current_version: boolean; created_at: string; draft_id: string | null; task_id: string | null }>;
  editorial_status: "current_review" | "not_reviewed" | "stale" | "unavailable";
  strengths: string[]; next_steps: string[]; limitations: string[];
  captured_at: string;
};
