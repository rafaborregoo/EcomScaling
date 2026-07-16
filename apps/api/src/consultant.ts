import type { SupabaseClient } from "@supabase/supabase-js";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

type OrganizationRow = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
};

type SubscriptionRow = {
  organization_id: string;
  plan_code: string;
  status: string;
};

type AssignmentRow = {
  organization_id: string;
  consultant_user_id: string;
  is_primary: boolean;
};

async function loadOrganizations(supabase: SupabaseClient, organizationIds?: string[]) {
  let query = supabase
    .from("organizations")
    .select("id, display_name, slug, status, timezone, currency_code")
    .order("display_name", { ascending: true });

  if (organizationIds) {
    if (organizationIds.length === 0) {
      return { ok: true as const, data: [] as OrganizationRow[] };
    }

    query = query.in("id", organizationIds);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, data: (data ?? []) as OrganizationRow[] };
}

export async function listConsultantOrganizations(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const role = context.profile.platform_role;

  if (role !== "platform_admin" && role !== "consultant") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message: "El panel consultor requiere rol platform_admin o consultant.",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  let organizationIds: string[] | undefined;

  if (role === "consultant") {
    const { data, error } = await supabase
      .from("consultant_assignments")
      .select("organization_id")
      .eq("consultant_user_id", context.user.id)
      .eq("is_active", true);

    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "consultant_assignments_load_failed",
        detail: error.message,
      };
    }

    organizationIds = [...new Set((data ?? []).map((row) => row.organization_id as string))];
  }

  const organizationsResult = await loadOrganizations(supabase, organizationIds);

  if (!organizationsResult.ok) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_organizations_load_failed",
      detail: organizationsResult.error,
    };
  }

  const organizations = organizationsResult.data;
  const ids = organizations.map((organization) => organization.id);

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("service_subscriptions")
    .select("organization_id, plan_code, status")
    .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  if (subscriptionsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_subscriptions_load_failed",
      detail: subscriptionsError.message,
    };
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("consultant_assignments")
    .select("organization_id, consultant_user_id, is_primary")
    .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .eq("is_active", true);

  if (assignmentsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_assignments_summary_failed",
      detail: assignmentsError.message,
    };
  }

  const subscriptionRows = (subscriptions ?? []) as SubscriptionRow[];
  const assignmentRows = (assignments ?? []) as AssignmentRow[];

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        ...organization,
        subscription:
          subscriptionRows.find(
            (subscription) => subscription.organization_id === organization.id,
          ) ?? null,
        consultant_count: assignmentRows.filter(
          (assignment) => assignment.organization_id === organization.id,
        ).length,
      })),
    },
  };
}
