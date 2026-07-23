import { supabase } from "@/lib/supabase";
import type { AccountAction } from "@ecomscaling/contracts";

export type { AccountAction };

export type BootstrapResponse = {
  user: {
    id: string;
    email?: string;
  };
  profile: {
    id: string;
    full_name: string | null;
    platform_role: string;
    is_active: boolean;
  };
  memberships: Array<{
    organization_id: string;
    role: string;
    organization: {
      id: string;
      display_name: string;
      slug: string;
      status: string;
      timezone: string;
      currency_code: string;
    } | null;
  }>;
  subscriptions: Array<{
    id: string;
    organization_id: string;
    plan_code: string;
    status: string;
  }>;
};

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const shouldRefresh = expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000;

  if (!shouldRefresh) {
    return session.access_token;
  }

  const {
    data: { session: refreshedSession },
    error,
  } = await supabase.auth.refreshSession();

  if (error) {
    return null;
  }

  return refreshedSession?.access_token ?? session.access_token;
}

async function refreshAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();

  if (error) {
    return null;
  }

  return session?.access_token ?? null;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("No hay sesion activa.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();

  if (!refreshedToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);

  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: retryHeaders,
  });
}

export async function fetchBootstrap(token: string) {
  const response = await apiFetch("/v1/bootstrap", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;

    throw new Error(
      [
        `Bootstrap failed with status ${response.status}`,
        payload?.error,
        payload?.message,
        payload?.detail,
      ]
        .filter(Boolean)
        .join(" - "),
    );
  }

  return (await response.json()) as BootstrapResponse;
}

export async function fetchAccountActions(token: string) {
  const response = await apiFetch("/v1/actions", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return [] as AccountAction[];
  }

  const payload = (await response.json()) as { actions?: AccountAction[] };
  return payload.actions ?? [];
}
