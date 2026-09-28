import type { AccountAction } from "@e-nora/contracts";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import {
  freshnessMessage,
  summarizeFreshness,
  type ScopeRun,
} from "./integration-freshness.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SHOPIFY_SCOPES: string;
};

// Bloques cuya frescura se comprueba al avisar de una conexion en error. Se
// consultan uno a uno y no con un solo `order desc + limit`: el bloque parado
// es, por definicion, el que tiene la fecha mas vieja, asi que en una lista
// ordenada por fecha queda al final y es justo el que se perderia.
const FRESHNESS_SCOPES = [
  "orders",
  "catalog",
  "inventory",
  "customers",
  "refunds",
  "sessions",
  "abandoned_checkouts",
  "discounts",
  "marketing_events",
  "collections",
] as const;

type IntegrationConnection = {
  id: string;
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
  // La membership virtual "platform_admin" (ADR-0012) da acceso a TODAS las
  // organizaciones para autorizar rutas de forma uniforme, pero no es
  // responsabilidad personal de nadie: un platform_admin no gestiona cada
  // cliente de la plataforma. Colarla aqui convertía este aviso en "todas las
  // integraciones rotas de todos los clientes", ruido ajeno en el panel del
  // propio admin. Solo generan aviso las organizaciones con las que hay
  // relacion real: membership propia o cartera de consultor.
  const ownedMemberships = context.memberships.filter(
    (membership) => membership.accessSource !== "platform_admin",
  );
  const organizationIds = ownedMemberships.map((membership) => membership.organization_id);
  const requiredShopifyScopes = parseScopes(env.SHOPIFY_SCOPES);

  if (!organizationIds.length) {
    return { ok: true as const, data: { actions: [] } };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider, provider_account_id, provider_account_name, status, scopes")
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

  // Frescura por bloque, solo de las conexiones que van a generar aviso: el
  // texto generico ("los datos pueden estar desactualizados") no lo cree nadie
  // cuando la pantalla enseña las ventas de hoy, porque los pedidos siguen
  // entrando por webhook aunque el token este caducado.
  const brokenConnectionIds = connections
    .filter((connection) => connection.status === "error")
    .map((connection) => connection.id);

  // Una consulta por conexion y bloque, cada una con `limit(1)`. Pedir varias
  // filas de golpe y quedarse con la primera de cada conexion no vale: al
  // ordenar por fecha, las N primeras pueden ser todas de la misma conexion.
  // Solo se ejecuta cuando algo esta roto, que es cuando compensa.
  const freshnessByConnection = new Map<string, ScopeRun[]>();
  const lookups = await Promise.all(
    brokenConnectionIds.flatMap((connectionId) =>
      FRESHNESS_SCOPES.map(async (scope) => {
        const { data: row } = await supabase
          .from("integration_sync_runs")
          .select("created_at")
          .eq("connection_id", connectionId)
          .eq("sync_scope", scope)
          .eq("status", "succeeded")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return row
          ? {
              connectionId,
              run: {
                sync_scope: scope,
                last_success_at: row.created_at as string,
              },
            }
          : null;
      }),
    ),
  );

  for (const item of lookups) {
    // Un bloque que nunca ha corrido no se inventa: no tiene "desde cuando",
    // y decir que lleva parado desde siempre confunde mas que callar.
    if (!item) continue;
    freshnessByConnection.set(item.connectionId, [
      ...(freshnessByConnection.get(item.connectionId) ?? []),
      item.run,
    ]);
  }

  const now = new Date();
  const actions = ownedMemberships.flatMap((membership) => {
    // Un cliente pausado o marcado para borrado no genera avisos: que su sync
    // esté parado es la consecuencia esperada, no algo que reconectar.
    if (["suspended", "pending_deletion"].includes(membership.organization?.status ?? "")) {
      return [] as AccountAction[];
    }

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
          message: `${
            freshnessMessage(
              summarizeFreshness(
                freshnessByConnection.get(connection.id) ?? [],
                now,
              ),
              now,
            ) ?? "La conexion esta en error y los datos pueden estar desactualizados."
          } Reconectala desde Integraciones.`,
          cta_label: "Reconectar",
          cta_href: `/integraciones?organizationId=${membership.organization_id}`,
        });
        continue;
      }

      if (
        ["reauthorization_required", "needs_reauth"].includes(connection.status) &&
        connection.provider !== "shopify"
      ) {
        membershipActions.push({
          id: `integration_reauthorization_required:${membership.organization_id}:${connection.provider}:${connection.provider_account_id ?? "primary"}`,
          type: "integration_reauthorization_required",
          severity: "warning",
          organization_id: membership.organization_id,
          organization_name: organizationName ?? connection.provider_account_name,
          provider: connection.provider,
          title: `${connection.provider} necesita renovar el acceso`,
          message: "La autorización ha caducado o ha cambiado. Renueva el acceso desde Integraciones para reanudar la sincronización.",
          cta_label: "Revisar acceso",
          cta_href: `/integraciones?organizationId=${membership.organization_id}`,
        });
        continue;
      }

      if (
        connection.provider === "shopify" &&
        ["reauthorization_required", "needs_reauth"].includes(connection.status)
      ) {
        membershipActions.push({
          id: `shopify_reauthorization_required:${membership.organization_id}:${connection.id}`,
          type: "shopify_reauthorization_required",
          severity: "warning",
          organization_id: membership.organization_id,
          organization_name: organizationName ?? connection.provider_account_name,
          provider: "shopify",
          title: "Shopify necesita renovar el acceso",
          message: "La autorización de esta tienda ha caducado o ha cambiado. Renueva el acceso desde Integraciones.",
          cta_label: "Reautorizar",
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
