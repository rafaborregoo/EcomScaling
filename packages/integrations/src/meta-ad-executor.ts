import type { MetaAdCreationPlan } from "./meta-ad-write-contract.js";

export type MetaAdExecutionApproval = {
  approved: true;
  approvedBy: string;
  approvalId?: string;
};

export type MetaAdExecutionContext = {
  adAccountId: string;
  idempotencyKey: string;
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
};

export type MetaAdExecutionOperations = {
  createCampaign: (input: MetaAdCreationPlan["input"], context: MetaAdExecutionContext) => Promise<string>;
  createAdSet: (input: MetaAdCreationPlan["input"], context: MetaAdExecutionContext) => Promise<string>;
  createCreative: (input: MetaAdCreationPlan["input"], context: MetaAdExecutionContext) => Promise<string>;
  createAd: (input: MetaAdCreationPlan["input"], context: MetaAdExecutionContext) => Promise<string>;
};

export type MetaAdExecutionResult =
  | {
      ok: true;
      ids: MetaAdExecutionIds;
      completedSteps: readonly ["campaign", "adset", "creative", "ad"];
    }
  | {
      ok: false;
      error: "meta_approval_required" | "meta_approval_actor_required" | "meta_execution_failed";
      completedSteps: string[];
      ids: MetaAdExecutionIds;
    };

type MetaAdExecutionIds = Pick<
  MetaAdExecutionContext,
  "campaignId" | "adSetId" | "creativeId" | "adId"
>;

const emptyIds = (): MetaAdExecutionIds => ({
  campaignId: "",
  adSetId: "",
  creativeId: "",
  adId: "",
});

function nonEmpty(value: string) {
  return value.trim().length > 0;
}

function executionId(value: unknown) {
  return typeof value === "string" && nonEmpty(value) ? value : "";
}

/**
 * Executes a previously validated plan only after explicit human approval.
 * Existing IDs make retries/resumes safe; the concrete operations must use the
 * plan idempotency key when they call the provider.
 */
export async function executeMetaAdCreationPlan(
  plan: MetaAdCreationPlan,
  approval: MetaAdExecutionApproval | null,
  operations: MetaAdExecutionOperations,
): Promise<MetaAdExecutionResult> {
  if (!approval?.approved) {
    return {
      ok: false,
      error: "meta_approval_required",
      completedSteps: [],
      ids: emptyIds(),
    };
  }
  if (!nonEmpty(approval.approvedBy)) {
    return {
      ok: false,
      error: "meta_approval_actor_required",
      completedSteps: [],
      ids: emptyIds(),
    };
  }

  const context: MetaAdExecutionContext = {
    adAccountId: plan.adAccountId,
    idempotencyKey: plan.idempotencyKey,
    campaignId: executionId(plan.existingExternalIds.campaignId),
    adSetId: executionId(plan.existingExternalIds.adSetId),
    creativeId: executionId(plan.existingExternalIds.creativeId),
    adId: executionId(plan.existingExternalIds.adId),
  };
  const completedSteps: string[] = [];

  try {
    if (!context.campaignId) {
      context.campaignId = executionId(await operations.createCampaign(plan.input, context));
      if (!context.campaignId) throw new Error("campaign_id_missing");
    }
    completedSteps.push("campaign");

    if (!context.adSetId) {
      context.adSetId = executionId(await operations.createAdSet(plan.input, context));
      if (!context.adSetId) throw new Error("adset_id_missing");
    }
    completedSteps.push("adset");

    if (!context.creativeId) {
      context.creativeId = executionId(await operations.createCreative(plan.input, context));
      if (!context.creativeId) throw new Error("creative_id_missing");
    }
    completedSteps.push("creative");

    if (!context.adId) {
      context.adId = executionId(await operations.createAd(plan.input, context));
      if (!context.adId) throw new Error("ad_id_missing");
    }
    completedSteps.push("ad");

    return {
      ok: true,
      ids: {
        campaignId: context.campaignId,
        adSetId: context.adSetId,
        creativeId: context.creativeId,
        adId: context.adId,
      },
      completedSteps: ["campaign", "adset", "creative", "ad"],
    };
  } catch {
    return {
      ok: false,
      error: "meta_execution_failed",
      completedSteps,
      ids: {
        campaignId: context.campaignId,
        adSetId: context.adSetId,
        creativeId: context.creativeId,
        adId: context.adId,
      },
    };
  }
}
