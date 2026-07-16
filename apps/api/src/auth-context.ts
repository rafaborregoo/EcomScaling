import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import WebSocket from "ws";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  platform_role: string;
  is_active: boolean;
};

type Membership = {
  organization_id: string;
  role: string;
};

type Organization = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
};

type Subscription = {
  id: string;
  organization_id: string;
  plan_code: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
};

export type AuthContext = {
  user: {
    id: string;
    email?: string;
  };
  profile: Profile;
  memberships: Array<Membership & { organization: Organization | null }>;
  subscriptions: Subscription[];
};

export type AuthContextError = {
  statusCode: number;
  error: string;
  message?: string;
  detail?: string;
};

const realtimeTransport =
  WebSocket as unknown as NonNullable<
    NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"]
  >;

export function createUserScopedClient(env: ApiEnv, token: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

async function loadProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, platform_role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      error: {
        statusCode: 500,
        error: "profile_load_failed",
        detail: error.message,
      },
    };
  }

  if (!data) {
    return {
      ok: false as const,
      error: {
        statusCode: 409,
        error: "profile_missing",
        message: "The authenticated user exists but has no public profile row.",
      },
    };
  }

  return { ok: true as const, data: data as Profile };
}

async function loadMemberships(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    return {
      ok: false as const,
      error: {
        statusCode: 500,
        error: "memberships_load_failed",
        detail: error.message,
      },
    };
  }

  if (!data?.length) {
    return {
      ok: false as const,
      error: {
        statusCode: 409,
        error: "membership_missing",
        message: "The authenticated user has no active organization membership.",
      },
    };
  }

  return { ok: true as const, data: data as Membership[] };
}

export async function resolveAuthContext(
  env: ApiEnv,
  authorization: string | undefined,
): Promise<{ ok: true; context: AuthContext } | { ok: false; error: AuthContextError }> {
  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      error: { statusCode: 401, error: "missing_bearer_token" },
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    const error: AuthContextError = { statusCode: 401, error: "invalid_token" };

    if (userError?.message) {
      error.detail = userError.message;
    }

    return {
      ok: false,
      error,
    };
  }

  const profileResult = await loadProfile(supabase, user.id);
  if (!profileResult.ok) {
    return { ok: false, error: profileResult.error };
  }

  const membershipsResult = await loadMemberships(supabase, user.id);
  if (!membershipsResult.ok) {
    return { ok: false, error: membershipsResult.error };
  }

  const organizationIds = membershipsResult.data.map((membership) => membership.organization_id);

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, display_name, slug, status, timezone, currency_code")
    .in("id", organizationIds);

  if (organizationsError) {
    return {
      ok: false,
      error: {
        statusCode: 500,
        error: "organizations_load_failed",
        detail: organizationsError.message,
      },
    };
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("service_subscriptions")
    .select("id, organization_id, plan_code, status, starts_at, ends_at")
    .in("organization_id", organizationIds);

  if (subscriptionsError) {
    return {
      ok: false,
      error: {
        statusCode: 500,
        error: "subscriptions_load_failed",
        detail: subscriptionsError.message,
      },
    };
  }

  const memberships = membershipsResult.data.map((membership) => ({
    ...membership,
    organization:
      ((organizations ?? []) as Organization[]).find(
        (organization) => organization.id === membership.organization_id,
      ) ?? null,
  }));

  return {
    ok: true,
    context: {
      user: {
        id: user.id,
        ...(user.email ? { email: user.email } : {}),
      },
      profile: profileResult.data,
      memberships,
      subscriptions: (subscriptions ?? []) as Subscription[],
    },
  };
}
