import { z } from "zod";
import crypto from "node:crypto";
import { isCampaignPlanDate, localCampaignDateTimeToUtc } from "./campaign-plan-window.js";

export function readWeeklyMailingDates(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7 ||
    !value.every(isCampaignPlanDate) || new Set(value).size !== value.length) return null;
  return [...value].sort();
}

export function resolveWeeklyMailingSchedule(dates: string[], timezone: string, now = Date.now()) {
  return dates.map((date) => {
    const instant = localCampaignDateTimeToUtc(date, timezone, 9, 0).toISOString();
    if (Date.parse(instant) <= now) throw new Error("weekly_mailing_schedule_in_past");
    return instant;
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(canonical(item))]),
  ));
  return JSON.stringify(value ?? null);
}

export function weeklyMailingRequestFingerprint(value: unknown) {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}

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
  selected_image_ids: z.array(z.string().uuid()).max(7).optional(),
  image_rights_confirmed: z.boolean().optional(),
  base_design_template_id: z.string().uuid().nullable().optional(),
  verbatim_texts: z.array(z.string().max(2_000)).max(20).optional(),
  plan_signature: z.string().max(80_000).optional(),
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
    "contract_version", "campaign_name", "objective", "audience", "offer", "instructions", "store_connection_id",
  ].every((key) => saved[key] === candidate[key]);
  return sameFields && ["scheduled_dates", "selected_template", "resources", "image_resources", "production", "timezone", "scheduled_for"]
    .every((key) => canonical(saved[key]) === canonical(candidate[key]));
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
  drafts: Array<{ idempotency_key: string | null; scheduled_for: string | null; status: string; request?: unknown }>,
  approvedSchedule: string[],
  storeConnectionId: string,
) {
  if (!expectedSequenceNumbers.length || approvedSchedule.length !== expectedSequenceNumbers.length ||
    new Set(expectedSequenceNumbers).size !== expectedSequenceNumbers.length) return false;
  // Browser completion means all drafts produced; their human review remains separate.
  return expectedSequenceNumbers.every((number, index) => drafts.some((draft) => {
    const request = draft.request as Record<string, unknown> | null;
    return draft.idempotency_key === `${sequenceId}:${number}` &&
      ["pending_approval", "approved", "published"].includes(draft.status) &&
      request?.store_id === storeConnectionId &&
      Boolean(draft.scheduled_for) && Number.isFinite(Date.parse(draft.scheduled_for!)) &&
      Date.parse(draft.scheduled_for!) === Date.parse(approvedSchedule[index]!);
  }));
}
