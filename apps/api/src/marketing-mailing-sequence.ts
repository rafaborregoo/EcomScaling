import { z } from "zod";

const weeklyMailingClientStateSchema = z.object({
  campaign_name: z.string().max(160).optional(),
  objective: z.string().max(120).optional(),
  audience: z.string().max(500).optional(),
  offer: z.string().max(500).optional(),
  instructions: z.string().max(4_000).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration_days: z.string().max(2).optional(),
  selected_days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  number_of_emails: z.string().max(1).optional(),
  selected_template_ids: z.array(z.string().uuid()).max(3).optional(),
  selected_image_urls: z.array(z.string().max(2_000)).max(7).optional(),
  base_design_template_id: z.string().uuid().nullable().optional(),
  plan_signature: z.string().max(6_000).optional(),
}).strict();

export type WeeklyMailingClientState = z.infer<typeof weeklyMailingClientStateSchema>;

export function readWeeklyMailingClientState(value: unknown) {
  const parsed = weeklyMailingClientStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function sameWeeklyMailingPlanRequest(
  saved: Record<string, unknown>,
  candidate: Record<string, unknown>,
) {
  const sameFields = [
    "campaign_name", "objective", "audience", "offer", "instructions", "store_connection_id",
  ].every((key) => saved[key] === candidate[key]);
  const sameDates = JSON.stringify(saved.scheduled_dates) === JSON.stringify(candidate.scheduled_dates);
  const savedTemplate = saved.selected_template as Record<string, unknown> | null;
  const candidateTemplate = candidate.selected_template as Record<string, unknown> | null;
  return sameFields && sameDates &&
    (savedTemplate?.id ?? null) === (candidateTemplate?.id ?? null);
}

export function isWeeklyMailingGenerationLeaseExpired(
  updatedAt: string,
  nowMs: number,
  leaseMs = 15 * 60 * 1_000,
) {
  const updatedAtMs = Date.parse(updatedAt);
  return !Number.isFinite(updatedAtMs) || nowMs - updatedAtMs >= leaseMs;
}

export function weeklyMailingDraftsAreComplete(
  sequenceId: string,
  expectedSequenceNumbers: number[],
  drafts: Array<{ idempotency_key: string | null; scheduled_for: string | null }>,
) {
  if (!expectedSequenceNumbers.length) return false;
  const expected = new Set(expectedSequenceNumbers.map((number) => `${sequenceId}:${number}`));
  const scheduled = new Set(drafts
    .filter((draft) => Boolean(draft.scheduled_for))
    .map((draft) => draft.idempotency_key)
    .filter((key): key is string => typeof key === "string"));
  return expected.size === expectedSequenceNumbers.length &&
    scheduled.size === expected.size && [...expected].every((key) => scheduled.has(key));
}
