import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationalOrganizationResult =
  | { ok: true }
  | {
      ok: false;
      error: "organization_not_operational" | "subscription_not_active";
      detail?: string;
    };

export function isOperationalOrganizationError(
  result: OperationalOrganizationResult,
): result is Extract<OperationalOrganizationResult, { ok: false }> {
  return result.ok === false;
}

export function classifyOperationalOrganization(
  organizationStatus: string | null | undefined,
  subscriptionStatus?: string | null,
): OperationalOrganizationResult {
  if (
    !organizationStatus ||
    !["active", "onboarding"].includes(organizationStatus)
  ) {
    return { ok: false, error: "organization_not_operational" };
  }

  if (
    organizationStatus === "active" &&
    subscriptionStatus &&
    !["active", "trial"].includes(subscriptionStatus)
  ) {
    return { ok: false, error: "subscription_not_active" };
  }

  return { ok: true };
}

/** Re-checks tenant state immediately before a service-role job writes. */
export async function checkOperationalOrganization(
  client: SupabaseClient,
  organizationId: string,
): Promise<OperationalOrganizationResult> {
  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    return {
      ok: false,
      error: "organization_not_operational",
      detail: organizationError.message,
    };
  }

  if (!organization)
    return { ok: false, error: "organization_not_operational" };

  if (organization.status === "active") {
    const { data: subscription, error: subscriptionError } = await client
      .from("service_subscriptions")
      .select("status")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      return {
        ok: false,
        error: "subscription_not_active",
        detail: subscriptionError.message,
      };
    }

    return classifyOperationalOrganization(
      organization.status,
      subscription?.status ?? null,
    );
  }

  return classifyOperationalOrganization(organization.status);
}

/**
 * Una conexion marcada para borrado no se sincroniza. Era el bypass del
 * guardrail de `pending_deletion`: un sync manual la pasaba a `syncing`, y como
 * la purga solo borra conexiones en `pending_deletion`, el borrado pedido no
 * llegaba a ejecutarse nunca y los datos se repoblaban. Mismo criterio que
 * `acceptsWebhookIngest` para los webhooks.
 */
export const RETIRING_CONNECTION_STATUSES = ["pending_deletion", "disconnected", "revoked"];

export function assertConnectionIngestible(status: string | null | undefined) {
  if (status && RETIRING_CONNECTION_STATUSES.includes(status)) {
    throw new Error(`connection_not_ingestible:${status}`);
  }
}
