export type MetaAdCreationInput = {
  adAccountId: string;
  campaignName: string;
  campaignObjective: string;
  adSetName: string;
  dailyBudgetMinor: number;
  creativeName: string;
  creativeSpec: Record<string, unknown>;
  adName: string;
  idempotencyKey: string;
};

export type MetaAdCreationPlan = {
  provider: "meta_ads";
  adAccountId: string;
  status: "PAUSED";
  approvalRequired: true;
  idempotencyKey: string;
  steps: readonly ["campaign", "adset", "creative", "ad"];
  input: MetaAdCreationInput;
  existingExternalIds: {
    campaignId: string | null;
    adSetId: string | null;
    creativeId: string | null;
    adId: string | null;
  };
};

export type MetaAdCreationPlanResult =
  | { ok: true; plan: MetaAdCreationPlan }
  | { ok: false; error: string };

function nonEmpty(value: string) {
  return value.trim().length > 0;
}

function hasSecretField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value as Record<string, unknown>).some((key) =>
    /(^|_)(access_?token|app_?secret|client_?secret|password|secret)($|_)/i.test(key),
  );
}

export function normalizeMetaAdAccountId(value: string) {
  const trimmed = value.trim();
  if (/^act_[0-9]+$/.test(trimmed)) return trimmed;
  if (/^[0-9]+$/.test(trimmed)) return `act_${trimmed}`;
  return null;
}

/** Builds a dry, approval-gated plan; it never calls Meta or creates an ad. */
export function buildMetaAdCreationPlan(
  input: MetaAdCreationInput,
  existingExternalIds?: Partial<MetaAdCreationPlan["existingExternalIds"]>,
): MetaAdCreationPlanResult {
  const adAccountId = normalizeMetaAdAccountId(input.adAccountId);
  if (!adAccountId) return { ok: false, error: "meta_ad_account_id_invalid" };
  if (!nonEmpty(input.campaignName) || !nonEmpty(input.campaignObjective)) {
    return { ok: false, error: "meta_campaign_fields_required" };
  }
  if (!nonEmpty(input.adSetName) || !nonEmpty(input.creativeName) || !nonEmpty(input.adName)) {
    return { ok: false, error: "meta_ad_hierarchy_names_required" };
  }
  if (!Number.isSafeInteger(input.dailyBudgetMinor) || input.dailyBudgetMinor <= 0) {
    return { ok: false, error: "meta_daily_budget_invalid" };
  }
  if (!/^[A-Za-z0-9:_-]{16,200}$/.test(input.idempotencyKey)) {
    return { ok: false, error: "meta_idempotency_key_invalid" };
  }
  if (hasSecretField(input) || hasSecretField(input.creativeSpec)) {
    return { ok: false, error: "meta_write_plan_must_not_contain_secrets" };
  }

  return {
    ok: true,
    plan: {
      provider: "meta_ads",
      adAccountId,
      status: "PAUSED",
      approvalRequired: true,
      idempotencyKey: input.idempotencyKey,
      steps: ["campaign", "adset", "creative", "ad"],
      input: { ...input, adAccountId },
      existingExternalIds: {
        campaignId: existingExternalIds?.campaignId ?? null,
        adSetId: existingExternalIds?.adSetId ?? null,
        creativeId: existingExternalIds?.creativeId ?? null,
        adId: existingExternalIds?.adId ?? null,
      },
    },
  };
}

