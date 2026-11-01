import type { SupabaseClient } from "@supabase/supabase-js";

export function mailingObservationReadiness(plan: unknown, sentAt: string | null, now = Date.now()) {
  if (!sentAt || !Number.isFinite(Date.parse(sentAt))) return { status: "no_confirmed_send", eligible_at: null };
  const evaluation = (plan as { experiment?: { evaluation?: { window_days?: number; review_at?: string } | null } } | null)?.experiment?.evaluation;
  if (!evaluation || !Number.isSafeInteger(evaluation.window_days) || evaluation.window_days! < 1 ||
    !evaluation.review_at || !Number.isFinite(Date.parse(evaluation.review_at))) {
    return { status: "not_evaluable_without_criteria", eligible_at: null };
  }
  const eligibleAt = Math.max(Date.parse(sentAt) + evaluation.window_days! * 86_400_000, Date.parse(evaluation.review_at));
  return { status: now < eligibleAt ? "immature" : "awaiting_metrics_and_sample_check", eligible_at: new Date(eligibleAt).toISOString() };
}

/** A manual link identifies the observation to inspect; it never proves identical content or causality. */
export async function loadMailingDeliveryContext(
  supabase: SupabaseClient,
  organizationId: string,
  storeId: string | null,
) {
  if (!storeId) return { status: "store_scope_required", receipts: [] };
  const { data, error, count } = await supabase
    .from("marketing_mailing_delivery_receipts")
    .select(
      "id, sequence_id, revision, sequence_number, draft_id, draft_version, provider_account_id, provider_campaign_id, provider_message_id, provider_send_time, content_match_status, marketing_mailing_sequences!inner(plan, status)",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .eq("store_id", storeId)
    .order("provider_send_time", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);
  if (error) return { status: "unavailable", receipts: [] };
  return {
    status: data?.length ? "available" : "empty",
    total: count,
    truncated: (count ?? 0) > (data?.length ?? 0),
    interpretation:
      "user_linked_sent_message_content_match_unverified_not_incremental_attribution",
    receipts: (data ?? []).map((row) => {
      const sequence = Array.isArray(row.marketing_mailing_sequences)
        ? row.marketing_mailing_sequences[0]
        : row.marketing_mailing_sequences;
      const plan = sequence?.plan as Record<string, unknown> | undefined;
      return {
        receipt_id: row.id,
        sequence_id: row.sequence_id,
        revision: row.revision,
        email_number: row.sequence_number,
        draft_id: row.draft_id,
        draft_version: row.draft_version,
        account_id: row.provider_account_id,
        campaign_id: row.provider_campaign_id,
        message_id: row.provider_message_id,
        sent_at: row.provider_send_time,
        production_status: sequence?.status,
        content_match_status: row.content_match_status,
        observation: mailingObservationReadiness(plan, row.provider_send_time),
        experiment: plan?.experiment ?? null,
        success_criteria: plan?.success_criteria ?? [],
        stop_criteria: plan?.stop_criteria ?? [],
      };
    }),
  };
}
