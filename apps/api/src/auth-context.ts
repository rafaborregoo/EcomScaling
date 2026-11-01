import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import WebSocket from "ws";
import { isErr } from "./result-guard.js";
import { createSingleFlight } from "./single-flight.js";
import { gatedFetch } from "./request-gate.js";

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
  onboarding_completed_at?: string | null;
};

// BE-01/Q-008 (cerrado 2026-07-28, ver ADR-0012): antes de esto, una
// membership sintetica de platform_admin/consultant (sin fila real en
// organization_members) era indistinguible de una membership real -- misma
// forma de dato, sin campo que dijera de donde vino el acceso. accessSource
// lo hace explicito sin cambiar el comportamiento de autorizacion existente
// (nada consume este campo todavia, es aditivo).
export type AccessSource =
  | "membership"
  | "consultant_assignment"
  | "platform_admin"
  // La consultora (organizations.kind = 'consulting', ver 20261018090000) es
  // una membership real, pero NO es una tienda: no tiene pedidos, ni
  // integraciones, ni dashboard. Once sitios filtran por
  // `accessSource === "membership"` para decir "mis tiendas propias"; sin una
  // fuente propia, la consultora salia en todos ellos como una tienda mas.
  | "consulting_organization";

type Membership = {
  organization_id: string;
  role: string;
  accessSource: AccessSource;
  access_scope?: "organization" | "store";
  /** Histórico: desde 20261219100000 manda `store_ids`. */
  store_id?: string | null;
  /** Tiendas a las que se limita una membership con `access_scope = 'store'`. */
  store_ids?: string[];
};

/** ¿Esta membership puede ver esta tienda? Las de organización, todas. */
export function membershipCoversStore(
  membership: { accessSource: string; access_scope?: string; store_ids?: string[] },
  storeId: string | null | undefined,
): boolean {
  if (membership.accessSource !== "membership" || membership.access_scope !== "store") {
    return true;
  }
  return Boolean(storeId) && (membership.store_ids ?? []).includes(storeId as string);
}

export type OperationalMembership = Membership & {
  organization: Organization | null;
};

export type OperationalOrganizationResult =
  | { ok: true; membership: OperationalMembership }
  | { ok: false; statusCode: number; error: string; message?: string };

type Organization = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
  /** 'client' = tienda de un cliente (o propia). 'consulting' = la consultora,
   *  que no tiene tiendas: tiene el plan y la gente. Ver 20261018090000. */
  kind: string;
  /** El propietario exige 2FA al equipo (20261219100000). */
  require_mfa?: boolean;
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
  storeMemberships?: Array<Membership & { organization: Organization | null }>;
  subscriptions: Subscription[];
};

export type AuthContextError = {
  statusCode: number;
  error: string;
  message?: string;
  detail?: string;
};

export type AuthContextResult =
  { ok: true; context: AuthContext } | { ok: false; error: AuthContextError };

/**
 * Integraciones (y solo integraciones, de momento) es del cliente: cuentas,
 * tokens y estado de Shopify/Meta/Klaviyo de SU organizacion. El selector de
 * cabecera deja a un consultor "entrar" en un cliente sin membership real
 * (accessSource `consultant_assignment`) para operar dashboard, tareas y
 * marketing en su nombre -- eso es lo que hace el panel consultor. Pero
 * /integraciones renderizaba igual con esa membership sintetica, asi que
 * elegir un cliente en el selector le enseñaba (y a veces le dejaba tocar) sus
 * conexiones reales sin que el cliente lo supiera. Un consultor solo ve aqui
 * lo que sea suyo de verdad (`membership`) o de su consultora
 * (`consulting_organization`); para gestionar la conexion de un cliente esta
 * el CRUD de `/v1/consultant/organizations/:id/stores`, que es un sitio
 * distinto y ya pide su propia autoridad.
 */
export function requireOwnOrganizationAccess(
  context: AuthContext,
  organizationId: string,
): OperationalOrganizationResult {
  const operational = requireOperationalOrganization(context, organizationId);
  if (!operational.ok) return operational;

  if (operational.membership.accessSource === "consultant_assignment") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_integrations_access_denied",
      message:
        "Las integraciones de los clientes no están disponibles para cuentas de consultor.",
    };
  }

  return operational;
}

export function isOperationalOrganizationError(
  result: OperationalOrganizationResult,
): result is Extract<OperationalOrganizationResult, { ok: false }> {
  return result.ok === false;
}

export function requireOperationalOrganization(
  context: AuthContext,
  organizationId: string,
): OperationalOrganizationResult {
  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );

  if (!membership) {
    if (
      context.storeMemberships?.some(
        (item) => item.organization_id === organizationId,
      )
    ) {
      return {
        ok: false as const,
        statusCode: 403,
        error: "store_scope_required",
        message: "Esta cuenta solo tiene acceso a una tienda concreta.",
      };
    }
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const organizationStatus = membership.organization?.status;
  if (
    ["suspended", "cancelled", "pending_deletion"].includes(
      organizationStatus ?? "",
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_not_operational",
      message: `Esta cuenta no admite cambios ahora mismo. Escribe a tu consultor si crees que es un error.`,
    };
  }

  const subscription = context.subscriptions.find(
    (item) => item.organization_id === organizationId,
  );
  if (
    organizationStatus === "active" &&
    subscription &&
    !["active", "trial"].includes(subscription.status)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "subscription_not_active",
      message: "El plan de esta cuenta no está activo. Revísalo en Configuración › Plan.",
    };
  }

  return { ok: true as const, membership };
}

/** Authorize a diagnostic against the exact store selected by the caller. */
export function requireOperationalStore(
  context: AuthContext,
  organizationId: string,
  storeId: string,
): OperationalOrganizationResult {
  const organizationMembership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  if (organizationMembership) {
    const operational = requireOperationalOrganization(context, organizationId);
    if (!operational.ok) return operational;
    if (!membershipCoversStore(operational.membership, storeId)) {
      return { ok: false, statusCode: 403, error: "store_access_denied" };
    }
    return operational;
  }

  const storeMembership = context.storeMemberships?.find(
    (item) => item.organization_id === organizationId &&
      membershipCoversStore(item, storeId),
  );
  if (!storeMembership) {
    return { ok: false, statusCode: 403, error: "store_access_denied" };
  }
  const organizationStatus = storeMembership.organization?.status;
  if (["suspended", "cancelled", "pending_deletion"].includes(organizationStatus ?? "")) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_not_operational",
      message: `Esta cuenta no admite cambios ahora mismo. Escribe a tu consultor si crees que es un error.`,
    };
  }
  const subscription = context.subscriptions.find(
    (item) => item.organization_id === organizationId,
  );
  if (organizationStatus === "active" && subscription && !["active", "trial"].includes(subscription.status)) {
    return {
      ok: false,
      statusCode: 403,
      error: "subscription_not_active",
      message: "El plan de esta cuenta no está activo. Revísalo en Configuración › Plan.",
    };
  }
  return { ok: true, membership: storeMembership };
}

export function isAuthContextError(
  result: AuthContextResult,
): result is { ok: false; error: AuthContextError } {
  return result.ok === false;
}

const realtimeTransport = WebSocket as unknown as NonNullable<
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
      // Cola en la API en vez de en el pool de PostgREST (ver request-gate.ts).
      fetch: gatedFetch,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * El rol, derivado. No se lee de ninguna columna de rol porque no existe una
 * que sea la verdad (migracion 20261006090000):
 *
 *   staff     -> profiles.is_platform_staff. No lo otorga ningun plan: si
 *                dependiera de una fila de facturacion, cancelarla dejaria la
 *                plataforma sin administradores.
 *   consultor -> tiene una suscripcion vigente A SU NOMBRE. Cuando caduca deja
 *                de ser consultor solo, sin que nadie tenga que acordarse de
 *                bajar una columna -- que es justo la deriva que habia antes.
 *   cliente   -> lo demas.
 *
 * Se devuelve en `platform_role` con los mismos tres valores de siempre para
 * que los ~149 sitios que lo leen no se enteren de nada: todos pasan por aqui.
 */
export function derivePlatformRole(input: {
  isPlatformStaff: boolean;
  isConsultant: boolean;
}): string {
  if (input.isPlatformStaff) return "platform_admin";
  return input.isConsultant ? "consultant" : "user";
}

async function loadProfile(supabase: SupabaseClient, userId: string) {
  const [{ data, error }, { data: esConsultor, error: subscriptionError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, is_platform_staff, is_active, onboarding_completed_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      // Antes esto repetia en TypeScript la condicion de private.is_consultant.
      // Con la regla nueva (miembro de una consultora con plan vigente) son
      // tres tablas y la vigencia del plan: dos copias acaban discrepando, y
      // entonces la API dice una cosa y la RLS otra. Se llama a la funcion, que
      // es exactamente la que usan las policies.
      supabase.rpc("es_consultor"),
    ]);

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

  if (subscriptionError) {
    return {
      ok: false as const,
      error: {
        statusCode: 500,
        error: "profile_load_failed",
        detail: subscriptionError.message,
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

  const profile: Profile = {
    id: data.id as string,
    full_name: (data.full_name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    is_active: Boolean(data.is_active),
    onboarding_completed_at:
      (data.onboarding_completed_at as string | null) ?? null,
    platform_role: derivePlatformRole({
      isPlatformStaff: Boolean(data.is_platform_staff),
      isConsultant: Boolean(esConsultor),
    }),
  };

  return { ok: true as const, data: profile };
}

async function loadMemberships(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, access_scope, store_id, store_ids")
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

  const memberships: Membership[] = (data ?? []).map((row) => ({
    organization_id: row.organization_id as string,
    role: row.role as string,
    accessSource: "membership" as const,
    access_scope: (row.access_scope as "organization" | "store") ?? "organization",
    store_id: (row.store_id as string | null) ?? null,
    store_ids:
      (row.store_ids as string[] | null) ??
      (row.store_id ? [row.store_id as string] : []),
  }));

  return { ok: true as const, data: memberships };
}

/**
 * Organizaciones a las que un consultor/admin accede sin membership propia:
 * platform_admin -> todas; consultant -> sus consultant_assignments activas.
 * Se materializan como memberships virtuales con role "consultant" para que
 * todos los servicios (y el selector del portal) funcionen sin casos aparte.
 * RLS ya lo respalda: private.can_access_org cubre ambos roles.
 */
async function loadConsultantOrganizationIds(
  supabase: SupabaseClient,
  userId: string,
  platformRole: string,
) {
  if (platformRole === "platform_admin") {
    const { data, error } = await supabase.from("organizations").select("id");
    if (error) {
      return { ok: false as const, detail: error.message };
    }
    return {
      ok: true as const,
      ids: (data ?? []).map((row) => row.id as string),
      accessSource: "platform_admin" as const,
    };
  }

  if (platformRole === "consultant") {
    const { data, error } = await supabase
      .from("consultant_assignments")
      .select("organization_id")
      .eq("consultant_user_id", userId)
      .eq("is_active", true);
    if (error) {
      return { ok: false as const, detail: error.message };
    }
    return {
      ok: true as const,
      ids: (data ?? []).map((row) => row.organization_id as string),
      accessSource: "consultant_assignment" as const,
    };
  }

  return {
    ok: true as const,
    ids: [] as string[],
    accessSource: "membership" as const,
  };
}

async function resolveAuthContextUncached(
  env: ApiEnv,
  authorization: string | undefined,
): Promise<AuthContextResult> {
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

  // Cada await de aqui abajo es un round-trip a Supabase, y esta funcion corre
  // en TODA ruta autenticada. Perfil y memberships solo dependen de user.id,
  // asi que van juntos: la cadena baja de 6 saltos secuenciales a 4.
  const [profileResult, membershipsResult] = await Promise.all([
    loadProfile(supabase, user.id),
    loadMemberships(supabase, user.id),
  ]);

  if (isErr(profileResult)) {
    return { ok: false, error: profileResult.error };
  }

  if (isErr(membershipsResult)) {
    return { ok: false, error: membershipsResult.error };
  }

  const consultantOrgsResult = await loadConsultantOrganizationIds(
    supabase,
    user.id,
    profileResult.data.platform_role,
  );

  if (isErr(consultantOrgsResult)) {
    return {
      ok: false,
      error: {
        statusCode: 500,
        error: "consultant_organizations_load_failed",
        detail: consultantOrgsResult.detail,
      },
    };
  }

  const realMembershipIds = new Set(
    membershipsResult.data.map((membership) => membership.organization_id),
  );
  const virtualMemberships: Membership[] = consultantOrgsResult.ids
    .filter((organizationId) => !realMembershipIds.has(organizationId))
    .map((organizationId) => ({
      organization_id: organizationId,
      role: "consultant",
      accessSource: consultantOrgsResult.accessSource,
    }));

  const allMemberships = [...membershipsResult.data, ...virtualMemberships];

  // Un consultor/admin recien creado aun no tiene clientes asignados: puede
  // entrar igualmente (cartera vacia). Solo un usuario cliente sin ninguna
  // membership activa esta realmente sin sitio al que entrar.
  const isPortfolioRole = ["consultant", "platform_admin"].includes(
    profileResult.data.platform_role,
  );
  if (allMemberships.length === 0 && !isPortfolioRole) {
    return {
      ok: false,
      error: {
        statusCode: 409,
        error: "membership_missing",
        message:
          "The authenticated user has no active organization membership.",
      },
    };
  }

  const organizationIds = allMemberships.map(
    (membership) => membership.organization_id,
  );

  // Mismo motivo: ninguna de las dos depende de la otra.
  const [
    { data: organizations, error: organizationsError },
    { data: subscriptions, error: subscriptionsError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, display_name, slug, status, timezone, currency_code, kind, require_mfa")
      .in("id", organizationIds),
    supabase
      .from("service_subscriptions")
      .select("id, organization_id, plan_code, status, starts_at, ends_at")
      .in("organization_id", organizationIds),
  ]);

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

  const resolvedMemberships = allMemberships
    .map((membership) => {
      const organization =
        ((organizations ?? []) as Organization[]).find(
          (item) => item.id === membership.organization_id,
        ) ?? null;

      return {
        ...membership,
        organization,
        accessSource:
          organization?.kind === "consulting" &&
          membership.accessSource === "membership"
            ? ("consulting_organization" as const)
            : membership.accessSource,
      };
    })
    .sort((a, b) =>
      (a.organization?.display_name ?? "").localeCompare(
        b.organization?.display_name ?? "",
        "es",
      ),
    );

  // El contexto que consultan las rutas existentes solo contiene acceso a
  // nivel de organización. Así, los handlers que comprueban pertenencia
  // directamente quedan en denegación por defecto para cuentas limitadas a
  // tienda; las pocas rutas con filtro fiable validan storeMemberships aparte.
  const storeMemberships = resolvedMemberships.filter(
    (membership) =>
      membership.accessSource === "membership" &&
      membership.access_scope === "store",
  );
  const memberships = resolvedMemberships.filter(
    (membership) => !storeMemberships.includes(membership),
  );

  return {
    ok: true,
    context: {
      user: {
        id: user.id,
        ...(user.email ? { email: user.email } : {}),
      },
      profile: profileResult.data,
      memberships,
      storeMemberships,
      subscriptions: (subscriptions ?? []) as Subscription[],
    },
  };
}

// Toda ruta autenticada resuelve el contexto, y una sola pantalla del portal
// dispara ~10 peticiones a la vez con el mismo token (bootstrap, acciones,
// notificaciones, overview, metricas, insights...). Sin esto cada una repetia
// la misma cadena de round-trips a Supabase -- getUser + perfil + memberships
// + orgs + suscripciones -- y en local, con el navegador limitando a 6
// conexiones por origen, la rafaga se encolaba hasta pasarse del timeout del
// cliente. El single-flight colapsa la rafaga en una sola resolucion; el TTL
// corto cubre las recargas inmediatas.
//
// Lo cacheado es solo el chequeo de membership a nivel API: toda query real
// sigue yendo con el token del usuario y la RLS de Postgres decide igual, asi
// que una revocacion queda cubierta aunque el contexto siga en cache.
const AUTH_CONTEXT_TTL_MS = 30_000;

// `refreshAfter`: pasado ese instante el contexto sigue valiendo (hasta `expiresAt`),
// pero la siguiente petición lo renueva en segundo plano: quien está activo no paga
// nunca los ~4 viajes seguidos a Supabase de un fallo de caché (con el REST atascado
// son segundos por cada petición). La cota de revocación no cambia: sigue siendo `expiresAt`.
const AUTH_CONTEXT_REFRESH_AFTER_MS = 15_000;

const authContextCache = new Map<
  string,
  { expiresAt: number; refreshAfter: number; context: AuthContext }
>();
const authContextSingleFlight = createSingleFlight<AuthContextResult>();

/** `exp` del JWT en ms, sin verificar la firma: solo para no cachear de mas. */
function tokenExpiryMs(token: string): number | null {
  const payload = token.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    const { exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Solo para tests: deja el proceso sin contextos cacheados. */
export function clearAuthContextCache() {
  authContextCache.clear();
}

export async function withAuthContextCache(
  token: string,
  resolve: () => Promise<AuthContextResult>,
): Promise<AuthContextResult> {
  const cached = authContextCache.get(token);

  if (cached && cached.expiresAt > Date.now()) {
    if (cached.refreshAfter <= Date.now()) {
      void refreshAuthContext(token, resolve).catch(() => undefined);
    }
    return { ok: true, context: cached.context };
  }

  return refreshAuthContext(token, resolve);
}

function refreshAuthContext(
  token: string,
  resolve: () => Promise<AuthContextResult>,
): Promise<AuthContextResult> {
  return authContextSingleFlight(token, async () => {
    const result = await resolve();

    // Un fallo puede ser transitorio (Supabase caido, red): cachearlo dejaria
    // al usuario fuera durante todo el TTL.
    if (!result.ok) {
      return result;
    }

    const now = Date.now();
    const expiresAt = Math.min(
      now + AUTH_CONTEXT_TTL_MS,
      tokenExpiryMs(token) ?? Number.POSITIVE_INFINITY,
    );

    if (expiresAt > now) {
      // Un proceso vivo acumula un token por sesion y por hora; purgar lo
      // caducado en cada miss basta para que el Map no crezca sin limite.
      for (const [key, entry] of authContextCache) {
        if (entry.expiresAt <= now) {
          authContextCache.delete(key);
        }
      }
      authContextCache.set(token, {
        expiresAt,
        refreshAfter: Math.min(now + AUTH_CONTEXT_REFRESH_AFTER_MS, expiresAt),
        context: result.context,
      });
    }

    return result;
  });
}

export function resolveAuthContext(
  env: ApiEnv,
  authorization: string | undefined,
): Promise<AuthContextResult> {
  if (!authorization?.startsWith("Bearer ")) {
    return Promise.resolve({
      ok: false,
      error: { statusCode: 401, error: "missing_bearer_token" },
    });
  }

  return withAuthContextCache(authorization.slice("Bearer ".length), () =>
    resolveAuthContextUncached(env, authorization),
  );
}
