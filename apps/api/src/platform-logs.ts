// Lecturas de /admin/logs: el rastro de auditoria y lo que se ha roto.
//
// `audit_logs` existe desde DB-02 y `recordAuditLog` la escribe desde 61
// puntos del codigo (crear un cliente, cambiar un rol, editar una
// organizacion, ingerir conocimiento, configurar una alerta...). No habia una
// sola lectura en todo el repo: el registro de quien hizo que se acumulaba
// desde julio sin que nadie pudiera verlo. El comentario de `audit-log.ts`
// cuenta la mitad de la historia -- SQO-03 arreglo la escritura y dejo la
// lectura sin construir.
//
// Los errores ya existen tambien, repartidos: `integration_sync_runs` con
// status 'failed' se ven por integracion, y los `agent_runs` fallidos en
// observabilidad. Aqui se juntan para responder "que se ha roto hoy".
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { triggerKlaviyoSync } from "./klaviyo.js";
import { triggerShopifySync } from "./shopify.js";
import { triggerMetaSync } from "./meta.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requirePlatformAdmin(context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
      message: "Solo un platform admin puede consultar los logs de plataforma.",
    };
  }
  return { ok: true as const };
}

const MAX_PAGE = 200;

function boundedLimit(raw: unknown, fallback = 50): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_PAGE);
}

/**
 * Paginacion por cursor sobre `created_at` y no por offset: el rastro crece
 * mientras se navega, y un `offset` iria repitiendo y saltandose filas segun
 * entran registros nuevos por arriba.
 */
export async function getAuditLog(
  env: ApiEnv,
  context: AuthContext,
  query: {
    organizationId?: unknown;
    action?: unknown;
    actorUserId?: unknown;
    before?: unknown;
    limit?: unknown;
  },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const limit = boundedLimit(query.limit);

  let request = supabase
    .from("audit_logs")
    .select(
      "id, organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (typeof query.organizationId === "string" && query.organizationId) {
    request = request.eq("organization_id", query.organizationId);
  }
  if (typeof query.actorUserId === "string" && query.actorUserId) {
    request = request.eq("actor_user_id", query.actorUserId);
  }
  // Prefijo, no exacto: las acciones se nombran "area.verbo"
  // (`knowledge.create_document`, `consultant.update_organization`), asi que
  // filtrar por "knowledge" tiene que traer toda el area.
  if (typeof query.action === "string" && query.action.trim()) {
    request = request.like("action", `${query.action.trim()}%`);
  }
  if (typeof query.before === "string" && query.before) {
    request = request.lt("created_at", query.before);
  }

  const { data, error } = await request;

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "audit_log_load_failed",
      detail: error.message,
    };
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Nombres solo de los implicados en esta pagina.
  const actorIds = [
    ...new Set(
      page.map((row) => row.actor_user_id as string | null).filter(Boolean),
    ),
  ] as string[];
  const orgIds = [
    ...new Set(
      page.map((row) => row.organization_id as string | null).filter(Boolean),
    ),
  ] as string[];

  const [profilesResult, organizationsResult] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    orgIds.length
      ? supabase
          .from("organizations")
          .select("id, display_name")
          .in("id", orgIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const actorById = new Map(
    (profilesResult.data ?? []).map((row) => [
      row.id as string,
      row.full_name as string | null,
    ]),
  );
  const orgById = new Map(
    (organizationsResult.data ?? []).map((row) => [
      row.id as string,
      row.display_name as string,
    ]),
  );

  return {
    ok: true as const,
    data: {
      entries: page.map((row) => ({
        id: row.id,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        created_at: row.created_at,
        organization_id: row.organization_id,
        organization_name: row.organization_id
          ? (orgById.get(row.organization_id as string) ?? null)
          : null,
        actor_user_id: row.actor_user_id,
        actor_name: row.actor_user_id
          ? (actorById.get(row.actor_user_id as string) ?? null)
          : null,
        old_data: row.old_data,
        new_data: row.new_data,
      })),
      // El cursor es el `created_at` de la ultima fila servida.
      next_before: hasMore
        ? ((page[page.length - 1]?.created_at as string) ?? null)
        : null,
    },
  };
}

type PlatformError = {
  id: string;
  kind: "sync" | "agent";
  source: string;
  organization_id: string | null;
  organization_name: string | null;
  message: string | null;
  occurred_at: string;
};

/** Lo que ha fallado en la plataforma, de las dos fuentes que ya lo registran. */
export async function getPlatformErrors(
  env: ApiEnv,
  context: AuthContext,
  query: { days?: unknown; limit?: unknown },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const days = Math.min(Math.max(Number(query.days) || 7, 1), 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const limit = boundedLimit(query.limit, 100);

  const [syncResult, agentResult] = await Promise.all([
    supabase
      .from("integration_sync_runs")
      .select(
        "id, organization_id, provider, sync_type, error_code, error_message, finished_at, created_at",
      )
      .in("status", ["failed", "cancelled"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("agent_runs")
      .select(
        "id, organization_id, status, error_message, started_at, agent_versions!inner(agent_definitions!inner(code, name))",
      )
      .in("status", ["failed", "rejected_output"])
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(limit),
  ]);

  if (syncResult.error || agentResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "platform_errors_load_failed",
      detail: syncResult.error?.message ?? agentResult.error?.message,
    };
  }

  const syncErrors: PlatformError[] = (syncResult.data ?? []).map((row) => ({
    id: row.id as string,
    kind: "sync",
    source: `${row.provider} · ${row.sync_type}`,
    organization_id: (row.organization_id as string) ?? null,
    organization_name: null,
    message:
      (row.error_message as string | null) ??
      (row.error_code as string | null) ??
      null,
    occurred_at: (row.finished_at as string) ?? (row.created_at as string),
  }));

  const agentErrors: PlatformError[] = (agentResult.data ?? []).map((row) => {
    const definition = (
      row as unknown as {
        agent_versions?: { agent_definitions?: { code?: string; name?: string } };
      }
    ).agent_versions?.agent_definitions;
    return {
      id: row.id as string,
      kind: "agent" as const,
      // `rejected_output` no es una caida: el agente respondio y el validador
      // tiro la salida. Se distingue, porque se arreglan de forma distinta.
      source: `${definition?.code ?? "agente"}${row.status === "rejected_output" ? " · salida rechazada" : ""}`,
      organization_id: (row.organization_id as string) ?? null,
      organization_name: null,
      message: (row.error_message as string | null) ?? null,
      occurred_at: row.started_at as string,
    };
  });

  const all = [...syncErrors, ...agentErrors].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );

  const orgIds = [
    ...new Set(all.map((item) => item.organization_id).filter(Boolean)),
  ] as string[];
  const { data: organizations } = orgIds.length
    ? await supabase
        .from("organizations")
        .select("id, display_name")
        .in("id", orgIds)
    : { data: [] };

  const orgById = new Map(
    (organizations ?? []).map((row) => [
      row.id as string,
      row.display_name as string,
    ]),
  );

  return {
    ok: true as const,
    data: {
      window_days: days,
      errors: all.slice(0, limit).map((item) => ({
        ...item,
        organization_name: item.organization_id
          ? (orgById.get(item.organization_id) ?? null)
          : null,
      })),
      counts: {
        sync: syncErrors.length,
        agent: agentErrors.length,
      },
    },
  };
}

/**
 * Relanza un sync caído desde /admin/logs/errores-sync, sin tener que ir a
 * la ficha de la integración. Reutiliza los trigger*Sync de cada proveedor
 * (ya aceptan platform_admin en su chequeo de permisos); solo hace falta
 * resolver `organization_id` + `provider` a partir del run que fallo.
 */
export async function retryPlatformSyncError(
  env: ApiEnv,
  context: AuthContext,
  runId: string,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: run, error } = await supabase
    .from("integration_sync_runs")
    .select("id, organization_id, provider")
    .eq("id", runId)
    .maybeSingle();
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "sync_run_load_failed",
      detail: error.message,
    };
  }
  if (!run) {
    return { ok: false as const, statusCode: 404, error: "sync_run_not_found" };
  }

  const organizationId = run.organization_id as string;
  switch (run.provider as string) {
    case "klaviyo":
      return triggerKlaviyoSync(env, context, organizationId);
    case "shopify":
      return triggerShopifySync(env, context, organizationId);
    case "meta_ads":
      return triggerMetaSync(env, context, organizationId);
    default:
      return {
        ok: false as const,
        statusCode: 400,
        error: "sync_retry_unsupported_provider",
        message: `No hay reintento manual para el proveedor "${run.provider}" todavía.`,
      };
  }
}
