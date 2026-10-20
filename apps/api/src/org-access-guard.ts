/**
 * Guarda única de escritura por organización.
 *
 * Antes cada servicio decidía por su cuenta quién escribe, y el resultado era
 * que «Miembro» y «Solo lectura» hacían lo mismo (nadie miraba `readonly`) y
 * que el consultor asignado tenía poderes de gestor sin que el cliente pudiera
 * recortarlos. Esto corre antes del handler en toda ruta con `:organizationId`
 * y no sustituye a los chequeos de cada servicio: los endurece.
 *
 * - Solo lectura: ninguna escritura salvo marcar leído, buscar, preguntar al
 *   copiloto, generar informes y dejar feedback.
 * - Consultor asignado: cada familia de rutas pide su permiso en
 *   `organization_consultant_permissions` (sin fila = valores por defecto).
 * - 2FA obligatoria: si la organización la exige, un miembro sin sesión AAL2
 *   no opera sobre ella (lectura incluida).
 */

export type ConsultantPermissionKey =
  | "edit_config"
  | "manage_tasks"
  | "marketing_drafts"
  | "marketing_publish"
  | "invite_members";

export type ConsultantPermissions = Record<ConsultantPermissionKey, boolean>;

export const DEFAULT_CONSULTANT_PERMISSIONS: ConsultantPermissions = {
  edit_config: true,
  manage_tasks: true,
  marketing_drafts: true,
  marketing_publish: false,
  invite_members: true,
};

export const CONSULTANT_PERMISSION_KEYS = Object.keys(
  DEFAULT_CONSULTANT_PERMISSIONS,
) as ConsultantPermissionKey[];

const ORG_PREFIX = "/v1/organizations/:organizationId/";
const CONSULTANT_ORG_PREFIX = "/v1/consultant/organizations/:organizationId/";

// Escrituras que no cambian nada del negocio: también para Solo lectura.
const READONLY_ALLOWED = [
  "consultant-messages/read",
  "knowledge/search",
  "consultant-chat",
  "consultant-chat/stream",
  "consultant-chat/messages/:messageId/feedback",
  "platform-feedback",
  "reports",
];

// Orden importa: la primera que encaja gana (publicar antes que borradores).
const CONSULTANT_RULES: Array<{ prefix: string; permission: ConsultantPermissionKey }> = [
  { prefix: "marketing/klaviyo/campaigns", permission: "marketing_publish" },
  { prefix: "marketing/drafts/:draftId/schedule", permission: "marketing_publish" },
  { prefix: "financial-config", permission: "edit_config" },
  { prefix: "alert-rules", permission: "edit_config" },
  { prefix: "objectives", permission: "edit_config" },
  { prefix: "ai-settings", permission: "edit_config" },
  { prefix: "shopify/product-costs", permission: "edit_config" },
  { prefix: "tasks", permission: "manage_tasks" },
  { prefix: "consultant-chat/escalations", permission: "manage_tasks" },
  { prefix: "milestones", permission: "manage_tasks" },
  { prefix: "strategic-plan", permission: "manage_tasks" },
  { prefix: "calls/:callId/tasks", permission: "manage_tasks" },
  { prefix: "marketing", permission: "marketing_drafts" },
  { prefix: "campaign-planning", permission: "marketing_drafts" },
  { prefix: "campaign-quick-actions", permission: "marketing_drafts" },
  { prefix: "klaviyo/templates", permission: "marketing_drafts" },
  { prefix: "instagram", permission: "marketing_drafts" },
  { prefix: "meta/ad-creation-plan", permission: "marketing_drafts" },
];

function matchesPrefix(rest: string, prefix: string) {
  return rest === prefix || rest.startsWith(`${prefix}/`);
}

export type OrgAccessInput = {
  method: string;
  /** Patrón de la ruta (`request.routeOptions.url`), no la URL real. */
  routeUrl: string;
  membership: { role: string; accessSource: string } | null;
  consultantPermissions: ConsultantPermissions | null;
  requireMfa: boolean;
  /** `aal` del JWT ya verificado. */
  aal: string | null;
};

export type OrgAccessDenial = { statusCode: number; error: string; message: string };

/** Qué permiso de consultor pide esta ruta, o null si ninguno. */
export function consultantPermissionFor(
  method: string,
  routeUrl: string,
): ConsultantPermissionKey | null {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  if (routeUrl.startsWith(CONSULTANT_ORG_PREFIX)) {
    return routeUrl.slice(CONSULTANT_ORG_PREFIX.length).startsWith("client-access")
      ? "invite_members"
      : null;
  }
  if (!routeUrl.startsWith(ORG_PREFIX)) return null;
  const rest = routeUrl.slice(ORG_PREFIX.length);
  return CONSULTANT_RULES.find((rule) => matchesPrefix(rest, rule.prefix))?.permission ?? null;
}

export function decideOrgAccess(input: OrgAccessInput): OrgAccessDenial | null {
  const { membership } = input;
  if (!membership) return null; // Sin acceso: lo deniega el servicio.

  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(input.method);
  const isOrgRoute = input.routeUrl.startsWith(ORG_PREFIX);

  if (
    isOrgRoute &&
    input.requireMfa &&
    membership.accessSource === "membership" &&
    input.aal !== "aal2"
  ) {
    return {
      statusCode: 403,
      error: "mfa_required",
      message:
        "Esta organización exige la verificación en dos pasos. Actívala en Configuración › Seguridad y vuelve a entrar.",
    };
  }

  if (!isWrite) return null;

  if (isOrgRoute && membership.accessSource === "membership" && membership.role === "readonly") {
    const rest = input.routeUrl.slice(ORG_PREFIX.length);
    if (!READONLY_ALLOWED.some((allowed) => rest === allowed)) {
      return {
        statusCode: 403,
        error: "readonly_role",
        message: "Tu rol es Solo lectura: puedes ver y descargar, pero no cambiar nada.",
      };
    }
  }

  if (membership.accessSource === "consultant_assignment") {
    const permission = consultantPermissionFor(input.method, input.routeUrl);
    const permissions = input.consultantPermissions ?? DEFAULT_CONSULTANT_PERMISSIONS;
    if (permission && !permissions[permission]) {
      return {
        statusCode: 403,
        error: "consultant_permission_denied",
        message: "El cliente no ha dado permiso a su consultor para esto. Puede cambiarlo en Configuración › Tu consultor.",
      };
    }
  }

  return null;
}

/** `aal` del payload de un JWT. Solo para tokens ya verificados por Auth. */
export function readJwtAal(authorization: string | undefined): string | null {
  const payload = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).split(".")[1]
    : undefined;
  if (!payload) return null;
  try {
    const { aal } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      aal?: unknown;
    };
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}
