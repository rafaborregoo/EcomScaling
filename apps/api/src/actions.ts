import type { AccountAction } from "@ecomscaling/contracts";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SHOPIFY_SCOPES: string;
};

type IntegrationConnection = {
  organization_id: string;
  provider: string;
  provider_account_id: string | null;
  provider_account_name: string | null;
  status: string;
  scopes: string[] | null;
};

const reauthorizableConnectionStatuses = new Set(["connected", "syncing", "error"]);

function parseScopes(value: string) {
  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export async function listAccountActions(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const organizationIds = context.memberships.map((membership) => membership.organization_id);
  const requiredShopifyScopes = parseScopes(env.SHOPIFY_SCOPES);

  if (!organizationIds.length || !requiredShopifyScopes.length) {
    return { ok: true as const, data: { actions: [] } };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("integration_connections")
    .select("organization_id, provider, provider_account_id, provider_account_name, status, scopes")
    .in("organization_id", organizationIds)
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "account_actions_load_failed",
      detail: error.message,
    };
  }

  const connections = (data ?? []) as IntegrationConnection[];
  const actions = context.memberships.flatMap((membership) => {
    const orgConnections = connections.filter(
      (item) => item.organization_id === membership.organization_id,
    );
    const organizationName = membership.organization?.display_name ?? null;
    const membershipActions: AccountAction[] = [];

    for (const connection of orgConnections) {
      // Cualquier integracion en error requiere accion de empresa (FE-02):
      // reconectar/reautorizar desde Integraciones.
      if (connection.status === "error") {
        membershipActions.push({
          id: `integration_error:${membership.organization_id}:${connection.provider}:${connection.provider_account_id ?? "primary"}`,
          type: "integration_error",
          severity: "error",
          organization_id: membership.organization_id,
          organization_name: organizationName ?? connection.provider_account_name,
          provider: connection.provider,
          title: `${connection.provider === "shopify" ? "Shopify" : connection.provider === "meta_ads" ? "Meta Ads" : connection.provider} ha dejado de sincronizar`,
          message:
            "La conexion esta en error y los datos pueden estar desactualizados. Reconectala desde Integraciones.",
          cta_label: "Reconectar",
          cta_href: `/integraciones?organizationId=${membership.organization_id}`,
        });
        continue;
      }

      if (
        connection.provider === "shopify" &&
        connection.provider_account_id &&
        reauthorizableConnectionStatuses.has(connection.status)
      ) {
        const grantedScopes = new Set(connection.scopes ?? []);
        const missingScopes = requiredShopifyScopes.filter((scope) => !grantedScopes.has(scope));

        if (missingScopes.length) {
          membershipActions.push({
            id: `shopify_reauthorization_required:${membership.organization_id}`,
            type: "shopify_reauthorization_required",
            severity: "warning",
            organization_id: membership.organization_id,
            organization_name: organizationName ?? connection.provider_account_name,
            provider: "shopify",
            title: "Shopify necesita reautorizacion",
            message:
              "Hay permisos nuevos pendientes de aprobar para activar todos los bloques de datos Shopify.",
            cta_label: "Reautorizar",
            cta_href: `/integraciones?organizationId=${membership.organization_id}`,
            missing_scopes: missingScopes,
          });
        }
      }
    }

    return membershipActions;
  });

  return {
    ok: true as const,
    data: { actions },
  };
}
