import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export async function exportOrganizationData(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  if (context.profile.platform_role !== "platform_admin") {
    return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  }

  const client = createServiceClient(env);
  const { data, error } = await client.schema("private").rpc(
    "export_organization_data",
    { p_organization_id: organizationId },
  );
  if (error) {
    const notFound = error.message.includes("organization_not_found");
    return {
      ok: false as const,
      statusCode: notFound ? 404 : 500,
      error: notFound ? "organization_not_found" : "organization_export_failed",
      detail: notFound ? undefined : error.message,
    };
  }

  await recordAuditLog(client, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.export_organization_data",
    entityType: "organization",
    entityId: organizationId,
    newData: { schema_version: "v1", credential_data_excluded: true },
  });

  return { ok: true as const, data };
}
