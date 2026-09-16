import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createLogger } from "@ecomscaling/observability";
import { recordAuditLog } from "./audit-log.js";
import type { AuthContext } from "./auth-context.js";
import { assignPartnersToOrganization } from "./consultant-partners.js";
import { resolveInvite } from "./consultant.js";

const logger = createLogger("registro");

/**
 * Alta por cuenta propia: alguien se registra sin que nadie le invite.
 *
 * La cuenta la crea Supabase Auth desde el navegador (`/registro`). Lo que no
 * puede hacer el navegador es crear la organizacion: las escrituras van con la
 * service key y con la comprobacion de rol a mano (ADR-0006 pto 7).
 *
 * Por que hace falta la organizacion y no basta la cuenta: el plan de un
 * cliente **cuelga de su organizacion, nunca de su usuario**. Una suscripcion a
 * nombre de una persona es lo que la convierte en consultora (ADR-0023), asi
 * que atarle ahi el plan de cliente le daria una cartera que no es suya.
 *
 * Es idempotente y solo actua sobre quien no tiene ninguna organizacion: sin
 * eso seria un endpoint autenticado para crear organizaciones a discrecion.
 *
 * §16 del plan de organizacion consultora: si trae un codigo de invitacion
 * suelto, la organizacion que se crea aqui queda vinculada a la consultora
 * que lo genero -- en la MISMA llamada, no en un paso aparte. Es lo que hace
 * que el descuento del cliente vinculado (vinculacion.ts) exista ya en el
 * primer cobro: para cuando este usuario llegue a /planes, la vinculacion ya
 * esta hecha.
 */

type RegistroEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  INVITE_CODE_SECRET?: string;
};

function createServiceClient(env: RegistroEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export function slugDeNegocio(nombre: string): string {
  return (
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "tienda"
  );
}

/**
 * Decide el nombre de la organizacion que se crea al registrarse.
 *
 * Nunca devuelve vacio: una organizacion sin nombre sale en blanco en el
 * selector de cliente y no hay forma de distinguirla de las demas.
 */
export function nombreDeOrganizacion(input: {
  businessName?: string | null | undefined;
  fullName?: string | null | undefined;
  email?: string | null | undefined;
}): string {
  const candidatos = [
    input.businessName?.trim(),
    input.fullName?.trim(),
    input.email?.split("@")[0]?.trim(),
  ];
  const elegido = candidatos.find((valor) => valor && valor.length > 0);
  return (elegido ?? "Mi tienda").slice(0, 200);
}

/** Crea la organizacion de quien acaba de registrarse. Idempotente. */
export async function ensureOwnOrganization(
  env: RegistroEnv,
  context: AuthContext,
  body: { business_name?: string | undefined; invite_code?: string | undefined },
) {
  const supabase = createServiceClient(env);

  // Si ya tiene organizacion propia se devuelve esa, no se crea otra: un
  // cliente invitado por su consultor, o alguien que recarga la pagina. Un
  // `invite_code` que llegue aqui se ignora a proposito: vincular una
  // organizacion que ya tiene dueño y quiza ya paga a OTRA consultora sin
  // que nadie lo pida no es "canjear un codigo", es secuestrar cartera.
  //
  // La comprobacion va contra la BASE DE DATOS y no contra
  // `context.memberships`: ese contexto lo cachea la API 30 s
  // (`AUTH_CONTEXT_TTL_MS`), y se resolvio ANTES de que existiera la
  // organizacion. Recargar /planes dentro de esa ventana veia "sin
  // membresias" otra vez y creaba una organizacion duplicada -- la segunda
  // ya sin codigo que canjear, porque el primero quedo consumido.
  const { data: propia } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(display_name)")
    .eq("user_id", context.user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (propia) {
    const organizacion = propia.organizations as unknown as {
      display_name?: string | null;
    } | null;
    return {
      ok: true as const,
      data: {
        organization_id: propia.organization_id as string,
        display_name: organizacion?.display_name ?? "Mi tienda",
        created: false,
        invite_linked: false,
      },
    };
  }
  const displayName = nombreDeOrganizacion({
    businessName: body.business_name ?? null,
    fullName: context.profile.full_name,
    email: context.user.email,
  });

  // El slug es unico en la tabla y dos negocios pueden llamarse igual. Se le
  // pega un sufijo corto en vez de fallar el alta por una colision de nombres.
  const slug = `${slugDeNegocio(displayName)}-${context.user.id.slice(0, 8)}`;

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({ display_name: displayName, slug, status: "active" })
    .select("id, display_name")
    .single();
  if (orgError || !organization) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_create_failed",
      detail: orgError?.message,
    };
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: context.user.id,
      role: "owner",
      is_active: true,
    });
  if (memberError) {
    // Una organizacion sin dueño no la ve nadie y no se puede borrar desde la
    // UI: se deshace el alta en vez de dejarla huerfana.
    await supabase.from("organizations").delete().eq("id", organization.id);
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_member_create_failed",
      detail: memberError.message,
    };
  }

  // A proposito NO se crea ninguna suscripcion: el plan lo elige la persona en
  // /planes y lo escribe el webhook de Stripe. Hasta entonces `assertStoreLimit`
  // devuelve `subscription_required` y no deja conectar ninguna tienda.
  await recordAuditLog(supabase, {
    organizationId: organization.id,
    actorUserId: context.user.id,
    action: "registro.create_own_organization",
    entityType: "organization",
    entityId: organization.id,
    newData: { display_name: organization.display_name, slug },
  });

  // §16: si trajo un codigo de invitacion suelto, esta es la organizacion que
  // vincula -- se intenta AHORA, en la misma llamada que la crea, para que la
  // vinculacion exista antes de que el usuario llegue a /planes y el checkout
  // decida si hay descuento (vinculacion.ts). No aborta el alta si falla: el
  // cliente ya tiene organizacion valida, y un codigo caducado o mal escrito
  // no puede tumbar un registro que por lo demas es correcto.
  const inviteCode = body.invite_code?.trim().toUpperCase();
  let inviteLinked = false;
  if (inviteCode) {
    const resolved = await resolveInvite(
      env,
      supabase,
      inviteCode,
      context.user.email ?? undefined,
    );
    if (resolved.ok) {
      const { data: linked, error: linkError } = await supabase.rpc(
        "link_client_invite",
        {
          p_invite_id: resolved.invite.id,
          p_organization_id: organization.id,
          p_user_id: context.user.id,
          p_consultant_user_id: resolved.invite.consultant_user_id,
        },
      );
      if (linkError) {
        logger.error("registro_invite_link_failed", {
          organization_id: organization.id,
          detail: linkError.message,
        });
      } else if (linked === true) {
        inviteLinked = true;
        await assignPartnersToOrganization(
          supabase,
          resolved.invite.consultant_user_id,
          organization.id,
        );
        await recordAuditLog(supabase, {
          organizationId: organization.id,
          actorUserId: context.user.id,
          action: "registro.linked_to_consultant",
          entityType: "consultant_assignment",
          entityId: organization.id,
          newData: { consultant_user_id: resolved.invite.consultant_user_id },
        });
      } else {
        // El codigo era valido al resolverlo pero otra peticion lo reclamo
        // primero (la fila ya no tenia status='pending'). No es un error del
        // cliente: simplemente esta organizacion se queda sin consultora.
        logger.info("registro_invite_already_claimed", {
          organization_id: organization.id,
        });
      }
    } else {
      logger.info("registro_invite_invalid", {
        organization_id: organization.id,
      });
    }
  }

  return {
    ok: true as const,
    data: {
      organization_id: organization.id,
      invite_linked: inviteLinked,
      display_name: organization.display_name,
      created: true,
    },
  };
}
