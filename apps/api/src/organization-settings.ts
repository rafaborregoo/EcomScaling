import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  type AuthContext,
  type AuthContextError,
  isAuthContextError,
  resolveAuthContext,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { internalSecretMatches } from "./internal-auth.js";
import { runNotificationEmails } from "./notification-email.js";
import { runDailyNotifications } from "./notification-daily.js";
import { runNotificationOutbox } from "./notification-outbox.js";
import { registerPushToken, removePushToken, runMobilePush } from "./mobile-push.js";
import { getNotificationSettings, setNotificationSettings } from "./notification-settings.js";
import { consultantsOf, notify } from "./notify.js";
import {
  CONSULTANT_PERMISSION_KEYS,
  type ConsultantPermissionKey,
  type ConsultantPermissions,
  DEFAULT_CONSULTANT_PERMISSIONS,
  consultantPermissionFor,
  decideOrgAccess,
  readJwtAal,
} from "./org-access-guard.js";

/**
 * Configuración v3 (2026-10-12): permisos del consultor, traspaso de
 * propiedad, 2FA obligatoria y actividad de la cuenta. Las escrituras van con
 * service role y chequeo manual de rol (ADR-0006 punto 7).
 */

type ApiEnv = LoadedApiEnv;
type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function membershipOf(context: AuthContext, organizationId: string) {
  return (
    [...context.memberships, ...(context.storeMemberships ?? [])].find(
      (item) => item.organization_id === organizationId,
    ) ?? null
  );
}

function isOwner(context: AuthContext, organizationId: string) {
  const membership = membershipOf(context, organizationId);
  return (
    context.profile.platform_role === "platform_admin" ||
    (membership?.accessSource === "membership" && membership.role === "owner")
  );
}

const denied = (message: string): Failure => ({
  ok: false,
  statusCode: 403,
  error: "organization_settings_denied",
  message,
});

// --- Permisos del consultor ------------------------------------------------

/** Lo que permite cada permiso, dicho al consultor («Ya no puedes …»). */
const PERMISSION_COPY: Record<ConsultantPermissionKey, string> = {
  edit_config: "editar costes, objetivos y alertas",
  manage_tasks: "crear, asignar y cerrar tareas",
  marketing_drafts: "preparar campañas y piezas en borrador",
  marketing_publish: "programar y enviar campañas en Klaviyo",
  invite_members: "invitar personas a su cuenta",
};

export async function loadConsultantPermissions(
  env: ApiEnv,
  organizationId: string,
): Promise<ConsultantPermissions> {
  const { data } = await createServiceClient(env)
    .from("organization_consultant_permissions")
    .select(CONSULTANT_PERMISSION_KEYS.join(", "))
    .eq("organization_id", organizationId)
    .maybeSingle();
  return { ...DEFAULT_CONSULTANT_PERMISSIONS, ...((data as Partial<ConsultantPermissions> | null) ?? {}) };
}

export async function getConsultantPermissions(env: ApiEnv, context: AuthContext, organizationId: string) {
  if (!membershipOf(context, organizationId)) return denied("Sin acceso a esta organización.");
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("organization_consultant_permissions")
    .select(`${CONSULTANT_PERMISSION_KEYS.join(", ")}, updated_at, updated_by`)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    return { ok: false as const, statusCode: 500, error: "consultant_permissions_load_failed", detail: error.message };
  }
  const row = data as (Partial<ConsultantPermissions> & { updated_at?: string; updated_by?: string | null }) | null;
  const permissions = { ...DEFAULT_CONSULTANT_PERMISSIONS };
  for (const key of CONSULTANT_PERMISSION_KEYS) {
    if (typeof row?.[key] === "boolean") permissions[key] = row[key] as boolean;
  }
  return {
    ok: true as const,
    data: {
      permissions,
      can_edit: isOwner(context, organizationId),
      updated_at: row?.updated_at ?? null,
    },
  };
}

/**
 * Lo que el consultor puede hacer en cada cliente asignado (no en sus tiendas
 * propias, donde es miembro y no aplica). Sin fila = valores por defecto.
 * Es la pantalla a la que lleva el aviso «X ha cambiado tus permisos».
 */
export async function listMyConsultantPermissions(env: ApiEnv, context: AuthContext) {
  const supabase = createServiceClient(env);
  const { data: assignments, error } = await supabase
    .from("consultant_assignments")
    .select("organization_id, organizations(display_name)")
    .eq("consultant_user_id", context.user.id)
    .eq("is_active", true);
  if (error) {
    return { ok: false as const, statusCode: 500, error: "consultant_permissions_load_failed", detail: error.message };
  }
  const rows = (assignments ?? []) as Array<{ organization_id: string; organizations: { display_name?: string | null } | Array<{ display_name?: string | null }> | null }>;
  const ids = rows.map((row) => row.organization_id);
  const { data: stored } = ids.length
    ? await supabase
        .from("organization_consultant_permissions")
        .select(`organization_id, ${CONSULTANT_PERMISSION_KEYS.join(", ")}, updated_at, updated_by`)
        .in("organization_id", ids)
    : { data: [] };
  const byOrg = new Map(((stored ?? []) as unknown as Array<Record<string, unknown>>).map((row) => [row.organization_id as string, row]));
  const editorIds = [...new Set([...byOrg.values()].map((row) => row.updated_by).filter((id): id is string => typeof id === "string"))];
  const { data: editors } = editorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", editorIds)
    : { data: [] };
  const editorName = new Map((editors ?? []).map((row) => [row.id as string, (row.full_name as string | null) ?? null]));

  const clients = rows
    .map((row) => {
      const saved = byOrg.get(row.organization_id);
      const permissions = { ...DEFAULT_CONSULTANT_PERMISSIONS };
      for (const key of CONSULTANT_PERMISSION_KEYS) {
        if (typeof saved?.[key] === "boolean") permissions[key] = saved[key] as boolean;
      }
      const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      return {
        organization_id: row.organization_id,
        name: organization?.display_name ?? "Cliente",
        permissions,
        is_default: !saved,
        updated_at: (saved?.updated_at as string | undefined) ?? null,
        updated_by_name: typeof saved?.updated_by === "string" ? (editorName.get(saved.updated_by) ?? null) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ok: true as const, data: { clients, defaults: DEFAULT_CONSULTANT_PERMISSIONS } };
}

export async function setConsultantPermissions(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: Partial<Record<string, unknown>>,
) {
  if (!isOwner(context, organizationId)) {
    return denied("Solo el propietario decide qué puede hacer su consultor.");
  }
  const patch: Partial<ConsultantPermissions> = {};
  for (const key of CONSULTANT_PERMISSION_KEYS) {
    if (typeof body[key] === "boolean") patch[key] = body[key] as boolean;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "empty_update" };
  }
  const supabase = createServiceClient(env);
  const previous = await loadConsultantPermissions(env, organizationId);
  const next = { ...previous, ...patch };
  const { error } = await supabase.from("organization_consultant_permissions").upsert(
    {
      organization_id: organizationId,
      ...next,
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) {
    return { ok: false as const, statusCode: 500, error: "consultant_permissions_save_failed", detail: error.message };
  }
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "organization.consultant_permissions_updated",
    entityType: "organization",
    entityId: organizationId,
    oldData: previous,
    newData: next,
  });
  // El consultor se entera de QUÉ ya no puede (o ya puede) hacer antes de
  // chocar con un 403. Varios cambios seguidos se juntan en un solo aviso.
  const changed = CONSULTANT_PERMISSION_KEYS.filter((key) => previous[key] !== next[key]);
  if (changed.length > 0) {
    await notify(supabase, {
      type: "client_settings",
      organizationId,
      recipients: await consultantsOf(supabase, organizationId),
      actorUserId: context.user.id,
      data: {
        store: membershipOf(context, organizationId)?.organization?.display_name ?? "Tu cliente",
        changes: changed.map((key) => ({ key, label: PERMISSION_COPY[key], granted: next[key] })),
      },
    });
  }
  return { ok: true as const, data: { permissions: next } };
}

// --- Traspaso de propiedad -------------------------------------------------

export async function transferOwnership(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { to_user_id?: unknown },
) {
  const membership = membershipOf(context, organizationId);
  if (!(membership?.accessSource === "membership" && membership.role === "owner")) {
    return denied("Solo el propietario puede traspasar la propiedad.");
  }
  const toUserId = typeof body.to_user_id === "string" ? body.to_user_id : "";
  if (!toUserId || toUserId === context.user.id) {
    return { ok: false as const, statusCode: 400, error: "invalid_new_owner" };
  }
  const supabase = createServiceClient(env);
  const { data, error } = await supabase.rpc("transfer_organization_ownership", {
    p_organization_id: organizationId,
    p_from_user: context.user.id,
    p_to_user: toUserId,
  });
  if (error) {
    return { ok: false as const, statusCode: 500, error: "ownership_transfer_failed", detail: error.message };
  }
  if (data !== true) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "ownership_transfer_rejected",
      message: "La persona tiene que ser miembro activo de la cuenta.",
    };
  }
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "organization.ownership_transferred",
    entityType: "organization_member",
    entityId: toUserId,
    newData: { from: context.user.id, to: toUserId },
  });
  return { ok: true as const, data: { owner_user_id: toUserId } };
}

// --- Seguridad del equipo --------------------------------------------------

export async function getOrganizationSecurity(env: ApiEnv, context: AuthContext, organizationId: string) {
  const membership = membershipOf(context, organizationId);
  const canSee =
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    (membership?.accessSource === "membership" && ["owner", "manager"].includes(membership.role));
  if (!membership || !canSee) return denied("Solo propietario y gestores ven la seguridad del equipo.");

  const supabase = createServiceClient(env);
  const [{ data: organization, error: organizationError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase.from("organizations").select("require_mfa").eq("id", organizationId).maybeSingle(),
      supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", organizationId)
        .eq("is_active", true),
    ]);
  if (organizationError || membersError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_security_load_failed",
      detail: organizationError?.message ?? membersError?.message,
    };
  }
  // ponytail: una llamada a Auth por persona; con equipos de 2-10 basta. Si
  // crecen, cachear o leer auth.mfa_factors con una función SQL.
  const withMfa = await Promise.all(
    (members ?? []).map(async (member) => {
      const { data } = await supabase.auth.admin.mfa.listFactors({ userId: member.user_id as string });
      const hasMfa = (data?.factors ?? []).some((factor) => factor.status === "verified");
      return { user_id: member.user_id as string, role: member.role as string, has_mfa: hasMfa };
    }),
  );
  return {
    ok: true as const,
    data: {
      require_mfa: Boolean(organization?.require_mfa),
      can_edit: isOwner(context, organizationId),
      members: withMfa,
    },
  };
}

export async function setOrganizationSecurity(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { require_mfa?: unknown },
) {
  if (!isOwner(context, organizationId)) return denied("Solo el propietario cambia la seguridad del equipo.");
  if (typeof body.require_mfa !== "boolean") {
    return { ok: false as const, statusCode: 400, error: "invalid_require_mfa" };
  }
  const supabase = createServiceClient(env);
  if (body.require_mfa) {
    // Sin esto el propietario se dejaba fuera a sí mismo.
    const { data } = await supabase.auth.admin.mfa.listFactors({ userId: context.user.id });
    if (!(data?.factors ?? []).some((factor) => factor.status === "verified")) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "owner_mfa_required",
        message: "Activa primero tu verificación en dos pasos.",
      };
    }
  }
  const { error } = await supabase
    .from("organizations")
    .update({ require_mfa: body.require_mfa })
    .eq("id", organizationId);
  if (error) {
    return { ok: false as const, statusCode: 500, error: "organization_security_save_failed", detail: error.message };
  }
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "organization.require_mfa_updated",
    entityType: "organization",
    entityId: organizationId,
    newData: { require_mfa: body.require_mfa },
  });
  return { ok: true as const, data: { require_mfa: body.require_mfa } };
}

// --- Actividad --------------------------------------------------------------

// Las acciones se nombran "area.verbo"; cada filtro de la pantalla agrupa áreas.
export const ACTIVITY_CATEGORIES: Record<string, string[]> = {
  config: ["financial_config.", "shopify_product_costs.", "alert_rules.", "objectives."],
  team: [
    "consultant.invite_client_member",
    "consultant.update_client_member",
    "organization.",
  ],
  integrations: ["integrations.", "shopify.", "meta.", "klaviyo.", "store_scope_updated", "meta_", "klaviyo_"],
  work: ["operations.", "calls.", "strategic_plan."],
  marketing: ["marketing", "campaign_"],
};

export function activityCategory(action: string): string {
  for (const [category, prefixes] of Object.entries(ACTIVITY_CATEGORIES)) {
    if (prefixes.some((prefix) => action.startsWith(prefix))) return category;
  }
  return "other";
}

export async function getOrganizationActivity(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  query: { before?: unknown; category?: unknown; limit?: unknown },
) {
  const membership = membershipOf(context, organizationId);
  const canSee =
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    (membership?.accessSource === "membership" && ["owner", "manager"].includes(membership.role));
  if (!membership || !canSee) return denied("Solo propietario y gestores ven la actividad de la cuenta.");

  const limit = Math.min(Math.max(Math.trunc(Number(query.limit) || 50), 1), 100);
  const supabase = createServiceClient(env);
  let request = supabase
    .from("audit_logs")
    .select("id, actor_user_id, action, entity_type, created_at")
    .eq("organization_id", organizationId)
    // Las lecturas de datos protegidos por la IA son rastro técnico (una por
    // ejecución): ahogaban los cambios que el cliente quiere ver.
    .not("action", "like", "protected_data.%")
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  const prefixes =
    typeof query.category === "string" ? ACTIVITY_CATEGORIES[query.category] : undefined;
  if (prefixes) {
    request = request.or(prefixes.map((prefix) => `action.like.${prefix}*`).join(","));
  }
  if (typeof query.before === "string" && query.before) {
    request = request.lt("created_at", query.before);
  }
  const { data, error } = await request;
  if (error) {
    return { ok: false as const, statusCode: 500, error: "activity_load_failed", detail: error.message };
  }
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const actorIds = [...new Set(page.map((row) => row.actor_user_id as string | null).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    supabase
      .from("consultant_assignments")
      .select("consultant_user_id")
      .eq("organization_id", organizationId),
  ]);
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id as string, profile.full_name as string | null]));
  const consultantIds = new Set((assignments ?? []).map((row) => row.consultant_user_id as string));
  return {
    ok: true as const,
    data: {
      items: page.map((row) => {
        const actor = row.actor_user_id as string | null;
        return {
          id: row.id as string,
          action: row.action as string,
          category: activityCategory(row.action as string),
          created_at: row.created_at as string,
          actor: actor
            ? {
                id: actor,
                name: nameById.get(actor) ?? null,
                kind: consultantIds.has(actor) ? "consultant" : "member",
              }
            : null,
        };
      }),
      next_before: rows.length > limit ? (page[page.length - 1]?.created_at as string) : null,
    },
  };
}

// --- Rutas y guarda ---------------------------------------------------------

type Helpers = {
  sendAuthFailure: (reply: FastifyReply, error: AuthContextError) => unknown;
  sendServiceFailure: (reply: FastifyReply, result: unknown) => unknown;
};

/**
 * Guarda de escritura por organización (ver org-access-guard.ts). Corre antes
 * de cada handler con `:organizationId`; el contexto de auth va cacheado por
 * token, así que no añade otra resolución completa. Se registra con los demás
 * hooks, antes de las rutas.
 */
export function registerOrgAccessGuard(app: FastifyInstance, env: ApiEnv) {
  app.addHook("preHandler", async (request, reply) => {
    const organizationId = (request.params as { organizationId?: string } | undefined)?.organizationId;
    const routeUrl = request.routeOptions.url ?? "";
    if (!organizationId || !request.headers.authorization) return;
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return; // El handler responde con su propio error.
    const membership = membershipOf(auth.context, organizationId);
    if (!membership) return;
    const needsPermissions =
      membership.accessSource === "consultant_assignment" &&
      consultantPermissionFor(request.method, routeUrl) !== null;
    const denial = decideOrgAccess({
      method: request.method,
      routeUrl,
      membership,
      consultantPermissions: needsPermissions ? await loadConsultantPermissions(env, organizationId) : null,
      requireMfa: Boolean(membership.organization?.require_mfa),
      aal: readJwtAal(request.headers.authorization),
    });
    if (denial) return reply.code(denial.statusCode).send(denial);
  });
}

export function registerOrganizationSettingsRoutes(app: FastifyInstance, env: ApiEnv, helpers: Helpers) {
  const withAuth =
    <P extends Record<string, string>, B>(
      run: (context: AuthContext, params: P, body: B, query: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown }>,
    ) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return helpers.sendAuthFailure(reply, auth.error);
      const result = await run(
        auth.context,
        request.params as P,
        (request.body ?? {}) as B,
        (request.query ?? {}) as Record<string, unknown>,
      );
      if (!result.ok) return helpers.sendServiceFailure(reply, result);
      return result.data;
    };

  type OrgParams = { organizationId: string };
  const base = "/v1/organizations/:organizationId";

  app.get(`${base}/consultant-permissions`, withAuth<OrgParams, unknown>((context, params) =>
    getConsultantPermissions(env, context, params.organizationId),
  ));
  // El consultor: lo que puede hacer en cada cliente de su cartera, de un vistazo.
  app.get("/v1/consultant/permissions", withAuth<Record<string, string>, unknown>((context) =>
    listMyConsultantPermissions(env, context),
  ));
  app.put(`${base}/consultant-permissions`, withAuth<OrgParams, Record<string, unknown>>((context, params, body) =>
    setConsultantPermissions(env, context, params.organizationId, body),
  ));
  app.post(`${base}/transfer-ownership`, withAuth<OrgParams, { to_user_id?: unknown }>((context, params, body) =>
    transferOwnership(env, context, params.organizationId, body),
  ));
  app.get(`${base}/security`, withAuth<OrgParams, unknown>((context, params) =>
    getOrganizationSecurity(env, context, params.organizationId),
  ));
  app.put(`${base}/security`, withAuth<OrgParams, { require_mfa?: unknown }>((context, params, body) =>
    setOrganizationSecurity(env, context, params.organizationId, body),
  ));
  app.get("/v1/me/notification-settings", withAuth<Record<string, string>, unknown>((context) =>
    getNotificationSettings(env, context),
  ));
  app.put(
    "/v1/me/notification-settings",
    withAuth<Record<string, string>, Parameters<typeof setNotificationSettings>[2]>((context, _params, body) =>
      setNotificationSettings(env, context, body),
    ),
  );
  // Tick del worker (cada 10 minutos): avisos al momento y resúmenes.
  app.post("/v1/internal/notifications/email-tick", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      return await runNotificationEmails(env);
    } catch (error) {
      return reply.code(503).send({
        error: "notification_email_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });
  // App móvil: registro del dispositivo y tick del worker (cada 2 minutos) que manda los push.
  app.post("/v1/me/push-token", withAuth<Record<string, string>, { token?: unknown; platform?: unknown }>((context, _params, body) =>
    registerPushToken(env, context, body),
  ));
  app.delete("/v1/me/push-token", withAuth<Record<string, string>, { token?: unknown }>((context, _params, body) =>
    removePushToken(env, context, body),
  ));
  app.post("/v1/internal/notifications/push-tick", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      return await runMobilePush(env);
    } catch (error) {
      return reply.code(503).send({ error: "mobile_push_failed", detail: error instanceof Error ? error.message : "unknown_error" });
    }
  });
  // Eventos que deja la base de datos (integraciones): cada minuto.
  app.post("/v1/internal/notifications/outbox-tick", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      return await runNotificationOutbox(env);
    } catch (error) {
      return reply.code(503).send({ error: "notification_outbox_failed", detail: error instanceof Error ? error.message : "unknown_error" });
    }
  });
  // «Para hoy» y propuestas de la IA pendientes: una vez al dia, a las 8:00.
  app.post("/v1/internal/notifications/daily-tick", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    return runDailyNotifications(env);
  });
  app.get(`${base}/activity`, withAuth<OrgParams, unknown>((context, params, _body, query) =>
    getOrganizationActivity(env, context, params.organizationId, query),
  ));
}
