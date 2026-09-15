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
import { provisionConsultantAccount } from "./consultant.js";
import { sendInviteMail } from "./invite-mailer.js";

/** Portada de la app, para los correos que no llevan enlace de un solo uso. */
function appUrl(env: ApiEnv): string {
  return (env.WEB_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "");
}

export type PartnerProfileSnapshot = {
  platform_role: string;
  is_active: boolean;
} | null;

export type PartnerDecision =
  | { kind: "pair" }
  | { kind: "ask_promote" }
  | { kind: "promote" }
  | { kind: "refuse"; error: string };

/**
 * Qué hacer con la cuenta que hay detrás del correo. Aparte del acceso a datos
 * porque es la regla que decide si a alguien le cambia el rol, y esa no puede
 * quedar enterrada entre queries donde nadie la vuelva a mirar.
 *
 *  - ya es consultor (o admin)  -> emparejar y ya.
 *  - es un usuario normal       -> preguntar primero; solo con `promote` se toca.
 *  - desactivada                -> no, en ninguno de los dos casos.
 *  - un admin NUNCA se promociona por aqui: entra por "pair", no por "promote".
 */
export function decidePartnerPromotion(
  profile: PartnerProfileSnapshot,
  promote: boolean,
): PartnerDecision {
  if (!profile) return { kind: "refuse", error: "profile_missing" };

  if (["consultant", "platform_admin"].includes(profile.platform_role)) {
    return profile.is_active
      ? { kind: "pair" }
      : { kind: "refuse", error: "consultant_inactive" };
  }

  if (!promote) return { kind: "ask_promote" };
  if (!profile.is_active) return { kind: "refuse", error: "account_inactive" };
  return { kind: "promote" };
}

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
  body: { email?: unknown; promote?: unknown },
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
  let partnerId = await findUserIdByEmail(supabase, email);

  // Sin cuenta: se la creamos aqui mismo. Antes esto era un 404 que mandaba al
  // consultor a pedirle el alta a la dirección, y hasta que alguien respondia
  // no podia trabajar con su compañero. Traer a alguien de tu propia agencia no
  // es una decision de plataforma.
  //
  // Lo que NO se hace es promover una cuenta que ya existe (ver
  // `not_a_consultant` mas abajo): esa cuenta es de otra persona, puede ser la
  // de un cliente, y cambiarle el rol por escribir su correo si seria una
  // elevacion de privilegios.
  let invited: { delivery: "email" | "manual_link"; url: string } | null = null;
  if (!partnerId) {
    const created = await provisionConsultantAccount(
      env,
      { userId: context.user.id, name: context.profile.full_name },
      {
        email,
        fullName: null,
        intro:
          "Te han invitado a EcomScaling para llevar tiendas junto a tu compañero. Crea tu contraseña y completa tu perfil.",
      },
    );
    if (created.ok === false) return created;
    partnerId = created.data.user_id;
    invited = { delivery: created.data.delivery, url: created.data.invite_url };
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
  //
  // Una cuenta de cliente SI se puede convertir, pero nunca en silencio: el
  // fallo realista aqui es una errata en el correo, y una letra de mas no puede
  // cambiarle el rol a un desconocido. Primero se responde `not_a_consultant`
  // contando a quien pertenece y que arrastra; el consultor confirma y se
  // reenvia con `promote`. La persona se entera por correo en cualquier caso.
  const decision = decidePartnerPromotion(
    partnerProfile
      ? {
          platform_role: partnerProfile.platform_role as string,
          is_active: Boolean(partnerProfile.is_active),
        }
      : null,
    body.promote === true,
  );

  if (decision.kind === "refuse") {
    const MESSAGES: Record<string, string> = {
      profile_missing:
        "Esa cuenta existe en el sistema de acceso pero no tiene perfil. Avisa a la dirección de EcomScaling con el correo.",
      consultant_inactive:
        "Esa cuenta de consultor está desactivada y no puede llevar tiendas. Pide a la dirección de EcomScaling que la reactiven.",
      account_inactive:
        "Esa cuenta está desactivada. Pide a la dirección de EcomScaling que la reactiven antes de convertirla en consultor.",
    };
    return {
      ok: false as const,
      statusCode: decision.error === "profile_missing" ? 404 : 409,
      error: decision.error,
      message: MESSAGES[decision.error] ?? "No se puede emparejar esa cuenta.",
    };
  }

  let promoted = false;
  if (decision.kind !== "pair") {
    if (!partnerProfile) {
      return {
        ok: false as const,
        statusCode: 404,
        error: "profile_missing",
      };
    }

    // Cuantas tiendas se lleva consigo. Se cuenta antes de convertir para
    // poder decirselo al consultor en la confirmacion.
    const { count: storeCount } = await supabase
      .from("organization_members")
      .select("organization_id", { count: "exact", head: true })
      .eq("user_id", partnerId)
      .eq("is_active", true);
    const stores = storeCount ?? 0;

    if (decision.kind === "ask_promote") {
      return {
        ok: false as const,
        statusCode: 409,
        error: "not_a_consultant",
        message: `Esa cuenta no es de consultor: hoy entra como cliente${
          stores > 0
            ? ` y lleva ${stores} ${stores === 1 ? "tienda" : "tiendas"}`
            : ""
        }. Si es tu compañero, puedes convertirla en consultor${
          stores > 0 ? ": sus tiendas pasan a ser suyas en Mis Tiendas" : ""
        }.`,
        // La UI ofrece "Convertir en consultor" con estos datos; sin esto
        // tendria que adivinar que este 409 concreto tiene salida.
        can_promote: true,
        partner_preview: {
          full_name: (partnerProfile.full_name as string | null) ?? null,
          store_count: stores,
        },
      };
    }

    // Solo se sube de 'user' a 'consultant'. Un platform_admin ya entra por la
    // rama de arriba, y nada de lo que hay aqui debe poder tocar a un admin.
    const { error: promoteError } = await supabase
      .from("profiles")
      .update({ platform_role: "consultant" })
      .eq("id", partnerId)
      .eq("platform_role", "user");
    if (promoteError) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "promote_failed",
        detail: promoteError.message,
      };
    }
    promoted = true;

    // Las membresias no se tocan: son ellas las que dan acceso a sus tiendas, y
    // al pasar a consultor esas mismas filas se leen como "tiendas propias".
    // No se toca tampoco su suscripcion: cambiarle a alguien lo que paga sin
    // decirselo es peor que el cambio de rol.
    await recordAuditLog(supabase, {
      organizationId: null,
      actorUserId: context.user.id,
      action: "consultant.promote_to_consultant",
      entityType: "profile",
      entityId: partnerId,
      oldData: { platform_role: partnerProfile.platform_role },
      newData: { platform_role: "consultant", stores_carried: stores },
    });

    // Que se entere la persona, no solo la auditoria: es su cuenta.
    await sendInviteMail(env, {
      to: email,
      recipientName: (partnerProfile.full_name as string | null) ?? null,
      title: "Ahora eres consultor en EcomScaling",
      intro: `Tu cuenta ha pasado a ser de consultor${
        stores > 0
          ? `, y tus ${stores} ${stores === 1 ? "tienda" : "tiendas"} siguen siendo tuyas: las encuentras en Mis Tiendas`
          : ""
      }. Si crees que es un error, responde a este correo.`,
      actionLabel: "Entrar en EcomScaling",
      actionUrl: appUrl(env),
      senderName: context.profile.full_name,
    });

    partnerProfile.platform_role = "consultant";
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
    newData: {
      email,
      shared_assignments: shared,
      // Queda en auditoria si este consultor creo la cuenta o solo se emparejo
      // con una que ya existia: es la diferencia entre "trajo a alguien nuevo"
      // y "se junto con un compañero".
      created_account: invited !== null,
      ...(invited ? { delivery: invited.delivery } : {}),
    },
  });

  return {
    ok: true as const,
    data: {
      partner: {
        user_id: partnerId,
        // Puede ser null en una cuenta recien creada: el nombre lo pone la
        // persona al entrar, no lo inventamos aqui.
        full_name: (partnerProfile?.full_name as string | null) ?? null,
      },
      shared_assignments: shared,
      // La UI necesita distinguirlo: a una cuenta nueva hay que decirle al
      // consultor que su compañero tiene que abrir el correo, y darle el enlace
      // a mano si el SMTP no estaba disponible.
      invited_new_account: invited !== null,
      promoted_to_consultant: promoted,
      ...(invited && invited.delivery === "manual_link"
        ? { invite_url: invited.url }
        : {}),
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
