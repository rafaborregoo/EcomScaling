import {
  requireOperationalOrganization,
  requireOperationalStore,
  type AuthContext,
} from "./auth-context.js";

export function requireMailingAccess(
  context: AuthContext,
  organizationId: string,
  storeId: string | null,
) {
  const access = storeId
    ? requireOperationalStore(context, organizationId, storeId)
    : requireOperationalOrganization(context, organizationId);
  if (!access.ok) return access;
  if (
    !["platform_admin", "consultant"].includes(context.profile.platform_role) &&
    !["owner", "manager"].includes(access.membership.role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "marketing_access_required",
    };
  }
  return access;
}
