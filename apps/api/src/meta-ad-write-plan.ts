import {
  buildMetaAdCreationPlan,
  type MetaAdCreationInput,
} from "@ecomscaling/integrations";
import {
  isOperationalOrganizationError,
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";

type Result =
  | {
      ok: true;
      data: {
        mode: "dry_run";
        executionReady: false;
        plan: unknown;
      };
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
      message?: string;
    };

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}

function creativeSpecValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canManageMetaWrite(context: AuthContext, organizationId: string) {
  const operational = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(operational)) return operational;

  if (
    !["platform_admin", "consultant"].includes(context.profile.platform_role) &&
    !["owner", "manager"].includes(operational.membership.role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "meta_write_access_denied",
      message:
        "Solo owner, manager, consultor o administrador de plataforma puede preparar un plan Meta.",
    };
  }

  return { ok: true as const };
}

/**
 * Prepares a validated Meta hierarchy without calling Meta or persisting an
 * external object. The reusable executor exists in the integrations package,
 * but this API route intentionally remains dry-run until approval, credentials,
 * scopes and provider-side idempotency are available.
 */
export function prepareMetaAdCreationPlan(
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
): Result {
  const access = canManageMetaWrite(context, organizationId);
  if (access.ok === false) return access;

  const input: MetaAdCreationInput = {
    adAccountId: stringValue(payload.adAccountId),
    campaignName: stringValue(payload.campaignName),
    campaignObjective: stringValue(payload.campaignObjective),
    adSetName: stringValue(payload.adSetName),
    dailyBudgetMinor: numberValue(payload.dailyBudgetMinor),
    creativeName: stringValue(payload.creativeName),
    creativeSpec: creativeSpecValue(payload.creativeSpec),
    adName: stringValue(payload.adName),
    idempotencyKey: stringValue(payload.idempotencyKey),
  };
  const result = buildMetaAdCreationPlan(input);

  if (result.ok === false) {
    return { ok: false, statusCode: 400, error: result.error };
  }

  return {
    ok: true,
    data: {
      mode: "dry_run",
      executionReady: false,
      plan: result.plan,
    },
  };
}
