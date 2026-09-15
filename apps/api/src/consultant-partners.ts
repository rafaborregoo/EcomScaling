// Consultores que se reparten la misma cartera.
//
// `consultant_assignments` ya era N:N, asi que dos consultores sobre la misma
// tienda siempre se pudo -- lo hacia platform admin, tienda a tienda. Lo que
// no habia es la parte persistente: si dos socios llevan TODA la cartera entre
// los dos, asignar cliente a cliente obliga a acordarse en cada alta, y el dia
// que se olvide el socio deja de ver una tienda sin que nada avise.
//
// `consultant_partners` guarda con quien trabaja cada consultor, en las dos
// direcciones. Al emparejarse se sincronizan las carteras existentes, y
// `createClientForConsultant` asigna a los socios en cada alta nueva.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
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
      message: "Solo un consultor puede gestionar con quien comparte cartera.",
    };
  }
  return { ok: true as const };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ponytail: la Admin API no filtra usuarios por email, solo pagina. Con una
// plataforma de consultores se recorre en dos o tres paginas; si algun dia hay
// miles de usuarios, toca un RPC sobre auth.users en vez de esto.
const LOOKUP_PAGES = 6;
const LOOKUP_PAGE_SIZE = 200;

async function findUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= LOOKUP_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: LOOKUP_PAGE_SIZE,
    });
    if (error) return null;

    const match = data.users.find(
      (user) => (user.email ?? "").toLowerCase() === email,
    );
    if (match) return match.id;

    if (data.users.length < LOOKUP_PAGE_SIZE) return null;
  }
  return null;
}

/** Los ids de los socios de un consultor. Vacio si trabaja solo. */
export async function getPartnerIds(
  supabase: SupabaseClient,
  consultantUserId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("consultant_partners")
    .select("partner_user_id")
    .eq("consultant_user_id", consultantUserId);

  if (error) return [];
  return (data ?? []).map((row) => row.partner_user_id as string);
}

/**
 * Asigna a los socios de `creatorUserId` a una organizacion recien creada.
 *
 * No lanza: que falle el reparto no puede tumbar el alta de un cliente, que ya
 * ha creado la organizacion, el usuario owner y la invitacion. El creador
 * queda asignado igualmente y el socio se puede añadir despues.
 */
export async function assignPartnersToOrganization(
  supabase: SupabaseClient,
  creatorUserId: string,
  organizationId: string,
): Promise<void> {
  const partnerIds = await getPartnerIds(supabase, creatorUserId);
  if (partnerIds.length === 0) return;

  await supabase.from("consultant_assignments").upsert(
    partnerIds.map((partnerId) => ({
      organization_id: organizationId,
      consultant_user_id: partnerId,
      // El principal es quien la creo: es el interlocutor que ve el cliente.
      // `work_share` cae en su default (100), igual que el del creador, asi que
      // la tienda nace a partes iguales. Se ajusta en Configuracion -> Accesos.
      is_primary: false,
      is_active: true,
      assigned_by: creatorUserId,
    })),
    { onConflict: "organization_id,consultant_user_id" },
  );
}

export type AssignmentRow = {
  organization_id: string;
  consultant_user_id: string;
};

/**
 * Qué asignaciones faltan para que dos socios lleven las mismas tiendas.
 *
 * Es una diferencia de conjuntos en las dos direcciones, y equivocarla no da
 * error: o se deja al socio fuera de tiendas que creia llevar, o se reasigna
 * lo que ya estaba y se pisa un `is_primary` que decide a quien ve el cliente
 * como interlocutor.
 */
export function missingAssignments(
  rows: AssignmentRow[],
  aUserId: string,
  bUserId: string,
): AssignmentRow[] {
  const orgsOf = (userId: string) =>
    new Set(
      rows
        .filter((row) => row.consultant_user_id === userId)
        .map((row) => row.organization_id),
    );

  const aOrgs = orgsOf(aUserId);
  const bOrgs = orgsOf(bUserId);

  return [
    ...[...aOrgs]
      .filter((orgId) => !bOrgs.has(orgId))
      .map((orgId) => ({ organization_id: orgId, consultant_user_id: bUserId })),
    ...[...bOrgs]
      .filter((orgId) => !aOrgs.has(orgId))
      .map((orgId) => ({ organization_id: orgId, consultant_user_id: aUserId })),
  ];
}

/** Cada uno pasa a llevar las tiendas del otro. */
async function sharePortfolios(
  supabase: SupabaseClient,
  aUserId: string,
  bUserId: string,
  actorUserId: string,
): Promise<number> {
  const { data } = await supabase
    .from("consultant_assignments")
    .select("organization_id, consultant_user_id")
    .in("consultant_user_id", [aUserId, bUserId])
    .eq("is_active", true);

  const missing = missingAssignments(
    (data ?? []) as AssignmentRow[],
    aUserId,
    bUserId,
  );

  if (missing.length === 0) return 0;

  await supabase.from("consultant_assignments").upsert(
    missing.map((row) => ({
      ...row,
      is_primary: false,
      is_active: true,
      assigned_by: actorUserId,
    })),
    { onConflict: "organization_id,consultant_user_id" },
  );

  return missing.length;
}

export async function listConsultantPartners(
  env: ApiEnv,
  context: AuthContext,
) {
  const gate = requireConsultant(context);
  if (gate.ok === false) return gate;

  const supabase = createServiceClient(env);
  const partnerIds = await getPartnerIds(supabase, context.user.id);

  if (partnerIds.length === 0) {
    return { ok: true as const, data: { partners: [] } };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .in("id", partnerIds);

  const { data: assignments } = await supabase
    .from("consultant_assignments")
    .select("consultant_user_id, organization_id")
    .in("consultant_user_id", partnerIds)
    .eq("is_active", true);

  const clientsByPartner = new Map<string, number>();
  for (const row of assignments ?? []) {
    const key = row.consultant_user_id as string;
    clientsByPartner.set(key, (clientsByPartner.get(key) ?? 0) + 1);
  }

  return {
    ok: true as const,
    data: {
      partners: (profiles ?? []).map((profile) => ({
        user_id: profile.id as string,
        full_name: profile.full_name as string | null,
        is_active: Boolean(profile.is_active),
        client_count: clientsByPartner.get(profile.id as string) ?? 0,
      })),
    },
  };
}

/**
 * Empareja a dos consultores por correo y reparte las carteras.
 *
 * Por correo y no eligiendo de una lista: enseñar el desplegable de todos los
 * consultores de la plataforma seria un directorio de usuarios de otros
 * negocios. Aqui hay que saber a quien se busca.
 */
export async function addConsultantPartner(
  env: ApiEnv,
  context: AuthContext,
  body: { email?: unknown },
) {
  const gate = requireConsultant(context);
  if (gate.ok === false) return gate;

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_email",
      message: "Ese correo no tiene un formato válido. Revísalo.",
    };
  }

  const supabase = createServiceClient(env);
  const partnerId = await findUserIdByEmail(supabase, email);

  if (!partnerId) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "consultant_not_found",
      message:
        "No hay ninguna cuenta con ese correo. Comprueba que está bien escrito; si lo está, pide a la dirección de EcomScaling que le den de alta como consultor y vuelve a intentarlo.",
    };
  }

  if (partnerId === context.user.id) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "cannot_pair_self",
      message:
        "Ese es tu propio correo. Aquí se añade a otra persona con la que compartes cartera.",
    };
  }

  const { data: partnerProfile } = await supabase
    .from("profiles")
    .select("id, full_name, platform_role, is_active")
    .eq("id", partnerId)
    .maybeSingle();

  // Emparejarse reparte tiendas: el socio tiene que ser consultor, no un
  // cliente ni un usuario cualquiera con cuenta.
  if (
    !partnerProfile ||
    !["consultant", "platform_admin"].includes(
      partnerProfile.platform_role as string,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "not_a_consultant",
      message:
        "Esa cuenta existe, pero no es de consultor: puede ser la de un cliente. Si va a llevar tiendas contigo, pide a la dirección de EcomScaling que le cambien el rol a consultor.",
    };
  }
  if (!partnerProfile.is_active) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "consultant_inactive",
      message:
        "Esa cuenta de consultor está desactivada y no puede llevar tiendas. Pide a la dirección de EcomScaling que la reactiven.",
    };
  }

  // Las dos direcciones en la misma escritura: una pareja a medias haria que
  // el reparto funcionara en un sentido y en el otro no.
  const { error: insertError } = await supabase
    .from("consultant_partners")
    .upsert(
      [
        {
          consultant_user_id: context.user.id,
          partner_user_id: partnerId,
          created_by: context.user.id,
        },
        {
          consultant_user_id: partnerId,
          partner_user_id: context.user.id,
          created_by: context.user.id,
        },
      ],
      { onConflict: "consultant_user_id,partner_user_id" },
    );

  if (insertError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "partner_create_failed",
      detail: insertError.message,
    };
  }

  const shared = await sharePortfolios(
    supabase,
    context.user.id,
    partnerId,
    context.user.id,
  );

  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "consultant.add_partner",
    entityType: "consultant_partner",
    entityId: partnerId,
    newData: { email, shared_assignments: shared },
  });

  return {
    ok: true as const,
    data: {
      partner: {
        user_id: partnerId,
        full_name: partnerProfile.full_name as string | null,
      },
      shared_assignments: shared,
    },
  };
}

/**
 * Deshace la pareja. **No** retira asignaciones existentes: dejar de compartir
 * cartera a futuro es una cosa, y quitarle de golpe el acceso a las tiendas que
 * lleva semanas trabajando es otra. Eso se hace tienda a tienda, a conciencia.
 */
export async function removeConsultantPartner(
  env: ApiEnv,
  context: AuthContext,
  partnerUserId: string,
) {
  const gate = requireConsultant(context);
  if (gate.ok === false) return gate;

  const supabase = createServiceClient(env);

  const { error } = await supabase
    .from("consultant_partners")
    .delete()
    .or(
      `and(consultant_user_id.eq.${context.user.id},partner_user_id.eq.${partnerUserId}),and(consultant_user_id.eq.${partnerUserId},partner_user_id.eq.${context.user.id})`,
    );

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "partner_delete_failed",
      detail: error.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "consultant.remove_partner",
    entityType: "consultant_partner",
    entityId: partnerUserId,
    newData: { assignments_kept: true },
  });

  return { ok: true as const, data: { removed: partnerUserId } };
}
