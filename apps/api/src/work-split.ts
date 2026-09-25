// Reparto de trabajo entre los consultores de cada tienda (Configuracion ->
// Accesos).
//
// El peso vive en `consultant_assignments.work_share` y lo consume
// `task-assignment.ts`. Aqui solo esta la gestion: quien es el principal, que
// parte le toca a cada uno, y a que tienda o a toda la cartera se aplica.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requireConsultant(context: AuthContext) {
  if (
    !["consultant", "platform_admin"].includes(context.profile.platform_role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message: "Solo un consultor puede repartir el trabajo de su cartera.",
    };
  }
  return { ok: true as const };
}

const OPEN_STATUSES = ["pending", "in_progress"] as const;

export type RequestedShare = { user_id: string; work_share: number };

/**
 * Los pesos que tocan a UNA tienda, filtrados a los consultores que realmente
 * la llevan.
 *
 * Devuelve null si con eso no quedaria nadie recibiendo trabajo. Es la trampa
 * del "aplicar a toda la cartera": si mando "50 Ana / 50 Bruno" a una tienda
 * donde Bruno no esta asignado, Ana se quedaria a 50 y Bruno a nada -- pero si
 * mando "0 Ana / 100 Bruno" a esa misma tienda, Ana caeria a 0 y la tienda
 * dejaria de asignar tareas a NADIE en silencio. Mejor saltarsela y decirlo.
 */
export function sharesForOrganization(
  requested: RequestedShare[],
  activeConsultantIds: string[],
): RequestedShare[] | null {
  const applicable = requested.filter((share) =>
    activeConsultantIds.includes(share.user_id),
  );

  if (applicable.every((share) => share.work_share <= 0)) return null;

  // Un consultor de la tienda al que el reparto no menciona se queda como
  // estaba: nadie ha decidido nada sobre el.
  return applicable;
}

/** Valida rango y forma. El "quien" se comprueba por tienda mas abajo. */
function parseShares(input: unknown): RequestedShare[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const shares: RequestedShare[] = [];
  for (const raw of input) {
    const userId =
      raw && typeof raw === "object"
        ? (raw as { user_id?: unknown }).user_id
        : undefined;
    const value =
      raw && typeof raw === "object"
        ? (raw as { work_share?: unknown }).work_share
        : undefined;

    if (typeof userId !== "string" || !userId.trim()) return null;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 100
    ) {
      return null;
    }
    shares.push({ user_id: userId, work_share: value });
  }

  if (shares.every((share) => share.work_share <= 0)) return null;
  return shares;
}

/** Ids de las tiendas de la cartera del consultor. */
async function myOrganizationIds(
  supabase: SupabaseClient,
  consultantUserId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("consultant_assignments")
    .select("organization_id")
    .eq("consultant_user_id", consultantUserId)
    .eq("is_active", true);

  return (data ?? []).map((row) => row.organization_id as string);
}

export async function listWorkSplit(env: ApiEnv, context: AuthContext) {
  const gate = requireConsultant(context);
  if (gate.ok === false) return gate;

  const supabase = createServiceClient(env);
  const orgIds = await myOrganizationIds(supabase, context.user.id);

  if (orgIds.length === 0) {
    return {
      ok: true as const,
      data: { clients: [], solo_clients: 0, workload: [] },
    };
  }

  const { data: assignments } = await supabase
    .from("consultant_assignments")
    .select("organization_id, consultant_user_id, is_primary, work_share")
    .in("organization_id", orgIds)
    .eq("is_active", true)
    .order("consultant_user_id");

  const byOrg = new Map<
    string,
    Array<{ user_id: string; is_primary: boolean; work_share: number }>
  >();
  for (const row of assignments ?? []) {
    const orgId = row.organization_id as string;
    const list = byOrg.get(orgId) ?? [];
    list.push({
      user_id: row.consultant_user_id as string,
      is_primary: Boolean(row.is_primary),
      work_share: Number(row.work_share ?? 100),
    });
    byOrg.set(orgId, list);
  }

  // Con un solo consultor no hay nada que repartir: se cuentan, no se listan.
  const sharedOrgIds = orgIds.filter(
    (orgId) => (byOrg.get(orgId)?.length ?? 0) > 1,
  );

  if (sharedOrgIds.length === 0) {
    return {
      ok: true as const,
      data: { clients: [], solo_clients: orgIds.length, workload: [] },
    };
  }

  const consultantIds = [
    ...new Set(
      sharedOrgIds.flatMap((orgId) =>
        (byOrg.get(orgId) ?? []).map((entry) => entry.user_id),
      ),
    ),
  ];

  const [{ data: organizations }, { data: profiles }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, display_name")
      .in("id", sharedOrgIds),
    supabase.from("profiles").select("id, full_name").in("id", consultantIds),
  ]);

  const nameByOrg = new Map(
    (organizations ?? []).map((row) => [
      row.id as string,
      row.display_name as string,
    ]),
  );
  const nameByUser = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      row.full_name as string | null,
    ]),
  );

  // La misma cuenta que usa el reparto (cartera entera, no esta tienda), para
  // que el numero que se ve al decidir sea el que decide.
  const openTasks = await Promise.all(
    consultantIds.map(async (userId) => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .in("status", OPEN_STATUSES);
      return count ?? 0;
    }),
  );

  return {
    ok: true as const,
    data: {
      clients: sharedOrgIds
        .map((orgId) => ({
          organization_id: orgId,
          display_name: nameByOrg.get(orgId) ?? orgId,
          consultants: (byOrg.get(orgId) ?? []).map((entry) => ({
            ...entry,
            full_name: nameByUser.get(entry.user_id) ?? null,
          })),
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
      solo_clients: orgIds.length - sharedOrgIds.length,
      workload: consultantIds.map((userId, index) => ({
        user_id: userId,
        full_name: nameByUser.get(userId) ?? null,
        open_tasks: openTasks[index] ?? 0,
      })),
    },
  };
}

/**
 * Fija el reparto (y opcionalmente el principal) en una tienda o en varias.
 *
 * El bulk existe porque el caso real es "entre los dos llevamos todo": sin el,
 * emparejarse y luego entrar cliente a cliente a poner 50/50 es la misma
 * friccion que el emparejamiento vino a quitar.
 */
export async function updateWorkSplit(
  env: ApiEnv,
  context: AuthContext,
  body: {
    organization_ids?: unknown;
    shares?: unknown;
    primary_user_id?: unknown;
  },
) {
  const gate = requireConsultant(context);
  if (gate.ok === false) return gate;

  const shares = parseShares(body.shares);
  if (!shares) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_shares",
      message:
        "Cada reparto es un entero de 0 a 100, y alguien tiene que quedarse por encima de 0.",
    };
  }

  const requestedOrgIds = Array.isArray(body.organization_ids)
    ? body.organization_ids.filter(
        (value): value is string => typeof value === "string" && !!value.trim(),
      )
    : [];
  if (requestedOrgIds.length === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "organization_ids_required",
    };
  }

  const primaryUserId =
    typeof body.primary_user_id === "string" && body.primary_user_id.trim()
      ? body.primary_user_id
      : null;

  const supabase = createServiceClient(env);
  const myOrgIds = new Set(await myOrganizationIds(supabase, context.user.id));

  // Solo sobre la propia cartera: el id de organizacion llega del cliente.
  const foreign = requestedOrgIds.filter((orgId) => !myOrgIds.has(orgId));
  if (foreign.length > 0) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const { data: assignments } = await supabase
    .from("consultant_assignments")
    .select("organization_id, consultant_user_id")
    .in("organization_id", requestedOrgIds)
    .eq("is_active", true);

  const consultantsByOrg = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const orgId = row.organization_id as string;
    consultantsByOrg.set(orgId, [
      ...(consultantsByOrg.get(orgId) ?? []),
      row.consultant_user_id as string,
    ]);
  }

  const eligibleOrgIds = requestedOrgIds.filter(
    (orgId) =>
      sharesForOrganization(shares, consultantsByOrg.get(orgId) ?? []) !== null,
  );
  const skipped = requestedOrgIds.length - eligibleOrgIds.length;

  if (eligibleOrgIds.length === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "no_applicable_organizations",
      message:
        "Ese reparto dejaria esas tiendas sin nadie a quien asignar las tareas.",
    };
  }

  // Una escritura por consultor sobre las tiendas donde esta: el peso pedido es
  // el mismo en todas, lo unico que cambia es en cuales aplica.
  for (const share of shares) {
    const orgIds = eligibleOrgIds.filter((orgId) =>
      (consultantsByOrg.get(orgId) ?? []).includes(share.user_id),
    );
    if (orgIds.length === 0) continue;

    const { error } = await supabase
      .from("consultant_assignments")
      .update({ work_share: share.work_share })
      .in("organization_id", orgIds)
      .eq("consultant_user_id", share.user_id);

    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "work_split_update_failed",
        detail: error.message,
      };
    }
  }

  if (primaryUserId) {
    const orgIds = eligibleOrgIds.filter((orgId) =>
      (consultantsByOrg.get(orgId) ?? []).includes(primaryUserId),
    );

    if (orgIds.length > 0) {
      // Degradar antes de promover: el indice unico parcial
      // `consultant_assignments_one_primary_active_per_org` no admite dos.
      await supabase
        .from("consultant_assignments")
        .update({ is_primary: false })
        .in("organization_id", orgIds)
        .eq("is_primary", true)
        .neq("consultant_user_id", primaryUserId);

      const { error } = await supabase
        .from("consultant_assignments")
        .update({ is_primary: true })
        .in("organization_id", orgIds)
        .eq("consultant_user_id", primaryUserId)
        .eq("is_active", true);

      if (error) {
        return {
          ok: false as const,
          statusCode: 500,
          error: "primary_assignment_update_failed",
          detail: error.message,
        };
      }
    }
  }

  await recordAuditLog(supabase, {
    organizationId:
      eligibleOrgIds.length === 1 ? (eligibleOrgIds[0] ?? null) : null,
    actorUserId: context.user.id,
    action: "consultant.update_work_split",
    entityType: "consultant_assignment",
    entityId: null,
    newData: {
      organization_ids: eligibleOrgIds,
      shares,
      primary_user_id: primaryUserId,
    },
  });

  return {
    ok: true as const,
    data: { updated: eligibleOrgIds.length, skipped },
  };
}
