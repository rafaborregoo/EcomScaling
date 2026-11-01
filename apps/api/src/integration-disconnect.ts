import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import {
  type AuthContext,
  isOperationalOrganizationError,
  requireOwnOrganizationAccess,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { decryptCredential } from "./credential-crypto.js";
import { revokeKlaviyoToken } from "./klaviyo-oauth.js";
import { META_GRAPH_VERSION } from "./meta-client.js";

const logger = createLogger("integration-disconnect");

// Desconectar Meta Ads o Klaviyo. Antes no habia forma: ni endpoint ni boton,
// y el permiso seguia vivo en el proveedor. Ahora:
//   1. se retira el permiso en origen cuando se puede (sin bloquear si falla);
//   2. se borran las credenciales guardadas;
//   3. la conexion queda "disconnected" (los datos importados se conservan:
//      volver a conectar retoma sin reimportar todo);
//   4. queda en la auditoria quien y cuando.
// Shopify no pasa por aqui: quitar una tienda es el borrado con 30 dias de
// gracia de /v1/consultant/organizations/:id/stores/:connectionId.

export type DisconnectProvider = "meta_ads" | "klaviyo";

type Result =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; statusCode: number; error: string; message?: string; detail?: string };

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

type RevokeOutcome = { revoked: boolean; reason: string };

async function revokeMeta(
  env: LoadedApiEnv,
  supabase: ReturnType<typeof serviceClient>,
  connection: { id: string; provider_account_id: string },
  credentials: Array<{ credential_kind: string; encrypted_payload: string }>,
): Promise<RevokeOutcome> {
  // El permiso de Meta es del usuario de Facebook, no de la cuenta publicitaria:
  // revocarlo cortaria tambien cualquier otra conexion hecha con ese mismo
  // usuario (por ejemplo, la de otra tienda). En ese caso solo se desconecta aqui.
  const { data: siblings } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("provider", "meta_ads")
    .eq("provider_account_id", connection.provider_account_id)
    .in("status", ["connected", "syncing", "error"])
    .neq("id", connection.id)
    .limit(1);
  if ((siblings ?? []).length > 0) return { revoked: false, reason: "shared_meta_user" };

  const token = credentials
    .map((row) => {
      try {
        return (JSON.parse(decryptCredential(row.encrypted_payload, env, connection.id)) as { access_token?: string })
          .access_token;
      } catch {
        return undefined;
      }
    })
    .find(Boolean);
  if (!token) return { revoked: false, reason: "no_token" };

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/permissions`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`meta_revoke_failed:${response.status}`);
  return { revoked: true, reason: "revoked" };
}

async function revokeKlaviyo(
  env: LoadedApiEnv,
  connectionId: string,
  credentials: Array<{ credential_kind: string; encrypted_payload: string }>,
): Promise<RevokeOutcome> {
  if (credentials.some((row) => row.credential_kind === "klaviyo_private_api_key")) {
    // Una clave privada no se revoca por API: la borra el usuario en Klaviyo.
    return { revoked: false, reason: "api_key" };
  }
  const oauth = credentials.find((row) => row.credential_kind === "klaviyo_oauth_tokens");
  if (!oauth) return { revoked: false, reason: "no_token" };
  if (!env.KLAVIYO_CLIENT_ID || !env.KLAVIYO_CLIENT_SECRET || !env.KLAVIYO_REDIRECT_URI) {
    return { revoked: false, reason: "app_not_configured" };
  }
  const payload = JSON.parse(decryptCredential(oauth.encrypted_payload, env, connectionId)) as {
    refresh_token?: string;
  };
  if (!payload.refresh_token) return { revoked: false, reason: "no_token" };
  await revokeKlaviyoToken(
    {
      KLAVIYO_CLIENT_ID: env.KLAVIYO_CLIENT_ID,
      KLAVIYO_CLIENT_SECRET: env.KLAVIYO_CLIENT_SECRET,
      KLAVIYO_REDIRECT_URI: env.KLAVIYO_REDIRECT_URI,
      KLAVIYO_SCOPES: env.KLAVIYO_SCOPES ?? "",
    },
    payload.refresh_token,
  );
  return { revoked: true, reason: "revoked" };
}

export async function disconnectIntegration(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  provider: DisconnectProvider,
  connectionId: string,
): Promise<Result> {
  if (!context.profile.is_active) {
    return { ok: false, statusCode: 403, error: "inactive_user" };
  }
  // Mismas reglas que conectar: la tienda tiene que ser propia (un consultor no
  // toca las conexiones de sus clientes) y hace falta ser owner o manager.
  const operational = requireOwnOrganizationAccess(context, organizationId);
  if (isOperationalOrganizationError(operational)) return operational;
  if (
    context.profile.platform_role !== "platform_admin" &&
    !["owner", "manager"].includes(operational.membership.role)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo el propietario o un gestor pueden desconectar integraciones.",
    };
  }
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) {
    return { ok: false, statusCode: 404, error: "connection_not_found" };
  }

  const supabase = serviceClient(env);
  const { data: connection, error: loadError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider, provider_account_id, provider_account_name, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (loadError) {
    return { ok: false, statusCode: 500, error: "connection_load_failed", detail: loadError.message };
  }
  if (!connection || connection.organization_id !== organizationId || connection.provider !== provider) {
    return { ok: false, statusCode: 404, error: "connection_not_found" };
  }
  if (connection.status === "disconnected") {
    return { ok: true, data: { connection_id: connectionId, status: "disconnected", already: true } };
  }

  const { data: credentials, error: credentialsError } = await supabase
    .schema("private")
    .from("integration_credentials")
    .select("credential_kind, encrypted_payload")
    .eq("connection_id", connectionId);
  if (credentialsError) {
    return {
      ok: false,
      statusCode: 500,
      error: "credential_load_failed",
      detail: credentialsError.message,
    };
  }

  let revoke: RevokeOutcome;
  try {
    revoke =
      provider === "meta_ads"
        ? await revokeMeta(env, supabase, connection, credentials ?? [])
        : await revokeKlaviyo(env, connectionId, credentials ?? []);
  } catch (error) {
    // Que el proveedor no conteste no puede dejar al usuario sin poder
    // desconectar: se borra el token de nuestro lado igualmente y se avisa.
    const detail = error instanceof Error ? error.message : "unknown_error";
    logger.info("provider_revoke_failed", { connection_id: connectionId, provider, detail });
    revoke = { revoked: false, reason: "provider_error" };
  }

  const { error: deleteError } = await supabase
    .schema("private")
    .from("integration_credentials")
    .delete()
    .eq("connection_id", connectionId);
  if (deleteError) {
    return {
      ok: false,
      statusCode: 500,
      error: "credential_delete_failed",
      detail: deleteError.message,
    };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("integration_connections")
    .update({
      status: "disconnected",
      last_error_at: null,
      last_error_message: null,
      updated_at: now,
    })
    .eq("id", connectionId);
  if (updateError) {
    return {
      ok: false,
      statusCode: 500,
      error: "connection_update_failed",
      detail: updateError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: `${provider === "meta_ads" ? "meta" : "klaviyo"}.disconnected`,
    entityType: "integration_connection",
    entityId: connectionId,
    oldData: { status: connection.status },
    newData: {
      status: "disconnected",
      account: connection.provider_account_name,
      provider_revoked: revoke.revoked,
      revoke_reason: revoke.reason,
    },
  });

  return {
    ok: true,
    data: {
      connection_id: connectionId,
      status: "disconnected",
      provider_revoked: revoke.revoked,
      revoke_reason: revoke.reason,
    },
  };
}
