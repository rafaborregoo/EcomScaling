import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { recordProtectedDataAccess } from "./protected-data-access.js";

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
  // El propietario puede llevarse los datos de su propia tienda (portabilidad);
  // el resto de la cartera sigue siendo solo de platform_admin.
  const isOwner = context.memberships.some(
    (membership) =>
      membership.organization_id === organizationId &&
      membership.role === "owner" &&
      membership.accessSource === "membership",
  );
  if (context.profile.platform_role !== "platform_admin" && !isOwner) {
    return { ok: false as const, statusCode: 403, error: "platform_admin_or_owner_required" };
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

  // Dos filas a proposito para la misma operacion: la de arriba es la accion
  // (alguien exporto una organizacion) y esta es el acceso a datos protegidos.
  // El export incluye `shopify_customers`, y es el acceso mas amplio que existe
  // en el producto: tiene que salir al filtrar por `protected_data.` sin que
  // haya que acordarse de que un export tambien los lleva dentro.
  await recordProtectedDataAccess(client, {
    organizationId,
    actorUserId: context.user.id,
    surface: "organization_export",
    resources: ["shopify_customers"],
    purpose: "Export completo de la organizacion (platform_admin o propietario)",
    detail: { schema_version: "v1" },
  });

  return { ok: true as const, data };
}
