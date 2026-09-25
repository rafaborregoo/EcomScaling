import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createLogger } from "@e-nora/observability";
import type { AuthContext } from "./auth-context.js";
import {
  createStripeClient,
  stripeErrorDetail,
  stripeErrorStatus,
} from "./stripe-client.js";

const logger = createLogger("referidos");

/**
 * Programa de consultores: el codigo de referido publico (`/r/<code>`).
 *
 * No confundir con la invitacion (`invite-codes.ts`): aquella es de un solo
 * uso porque da acceso a la tienda. Esta se reparte en abierto y por eso solo
 * da un descuento de bienvenida y la atribucion al consultor; si el cliente lo
 * consiente, ademas un lead. Nunca una asignacion.
 */

/**
 * Version del texto de la casilla de contacto de /registro. Si cambia el texto,
 * cambia esto: el consentimiento vale para lo que se leyo, no para lo de hoy.
 */
export const CONSENT_TEXT_VERSION = "2026-09-23";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_API_VERSION?: string | undefined;
};

function createServiceClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

export function normalizarCodigo(valor: string | null | undefined): string {
  return (valor ?? "").trim().toLowerCase();
}

export function codigoValido(code: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,31}$/.test(code);
}

/** El cupon de Stripe se deriva de la configuracion del codigo. */
export function cuponDeReferido(input: {
  discount_percent: number;
  discount_months: number;
}): string {
  return `referido-${input.discount_percent}-${input.discount_months}m`;
}

function esConsultor(context: AuthContext) {
  const role = context.profile.platform_role;
  return role === "consultant" || role === "platform_admin";
}

const noConsultor = {
  ok: false as const,
  statusCode: 403,
  error: "consultant_access_required",
};

/** Lo que ve cualquiera que abre el enlace: sin sesion, solo lo publicitario. */
export async function getPublicReferralCode(env: Env, rawCode: string) {
  const code = normalizarCodigo(rawCode);
  if (!codigoValido(code)) {
    return { ok: false as const, statusCode: 404, error: "referral_code_not_found" };
  }
  const { data } = await createServiceClient(env)
    .from("referral_codes")
    .select("code, discount_percent, discount_months, profiles(full_name)")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) {
    return { ok: false as const, statusCode: 404, error: "referral_code_not_found" };
  }
  const profile = data.profiles as unknown as { full_name?: string | null } | null;
  return {
    ok: true as const,
    data: {
      code: data.code as string,
      consultant_name: profile?.full_name ?? null,
      discount_percent: data.discount_percent as number,
      discount_months: data.discount_months as number,
    },
  };
}

/** Panel del consultor: su codigo, sus cifras y sus leads. */
export async function getMyReferralProgram(env: Env, context: AuthContext) {
  if (!esConsultor(context)) return noConsultor;
  const supabase = createServiceClient(env);
  const consultant = context.user.id;

  const [codeResult, summaryResult, referralsResult] = await Promise.all([
    supabase
      .from("referral_codes")
      .select("code, discount_percent, discount_months, is_active")
      .eq("consultant_user_id", consultant)
      .maybeSingle(),
    supabase.rpc("consultant_referral_summary", { p_consultant_user_id: consultant }),
    supabase.rpc("consultant_referrals", { p_consultant_user_id: consultant }),
  ]);
  const error = codeResult.error ?? summaryResult.error ?? referralsResult.error;
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "referral_program_load_failed",
      detail: error.message,
    };
  }
  return {
    ok: true as const,
    data: {
      code: codeResult.data,
      summary: (summaryResult.data as unknown[] | null)?.[0] ?? null,
      referrals: referralsResult.data ?? [],
    },
  };
}

/** El consultor elige su codigo una vez. Cambiarlo romperia enlaces ya repartidos. */
export async function createMyReferralCode(
  env: Env,
  context: AuthContext,
  body: { code?: string },
) {
  if (!esConsultor(context)) return noConsultor;
  const code = normalizarCodigo(body.code);
  if (!codigoValido(code)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "referral_code_invalid",
      message: "De 3 a 32 caracteres: letras minúsculas, números y guiones.",
    };
  }
  const { data, error } = await createServiceClient(env)
    .from("referral_codes")
    .insert({ consultant_user_id: context.user.id, code })
    .select("code, discount_percent, discount_months, is_active")
    .single();
  if (error) {
    // 23505: o el codigo ya es de otro, o este consultor ya tiene uno.
    return error.code === "23505"
      ? {
          ok: false as const,
          statusCode: 409,
          error: "referral_code_taken",
          message: "Ese código ya existe.",
        }
      : {
          ok: false as const,
          statusCode: 500,
          error: "referral_code_create_failed",
          detail: error.message,
        };
  }
  return { ok: true as const, data };
}

/**
 * Atribuye una organizacion recien creada al codigo con el que se registro.
 * Nunca tumba el alta: un codigo mal escrito deja al cliente sin descuento,
 * no sin cuenta.
 */
export async function attachReferral(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    code: string;
    contactConsent: boolean;
    contactName: string | null;
    contactEmail: string | null;
  },
): Promise<boolean> {
  const code = normalizarCodigo(input.code);
  if (!codigoValido(code)) return false;

  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select("id, consultant_user_id")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  // Referirse a uno mismo es sacarse un descuento: fuera.
  if (!referralCode || referralCode.consultant_user_id === input.userId) {
    logger.info("referral_code_ignored", { organization_id: input.organizationId });
    return false;
  }

  const consent = input.contactConsent
    ? {
        contact_consent_at: new Date().toISOString(),
        consent_text_version: CONSENT_TEXT_VERSION,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
      }
    : {};
  const { error } = await supabase.from("referrals").insert({
    referral_code_id: referralCode.id,
    organization_id: input.organizationId,
    user_id: input.userId,
    ...consent,
  });
  if (error) {
    logger.error("referral_attach_failed", {
      organization_id: input.organizationId,
      detail: error.message,
    });
    return false;
  }
  return true;
}

/** El cupon de bienvenida de una organizacion referida, o null. */
export async function cuponReferidoDeOrganizacion(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("referrals")
    .select("referral_codes(discount_percent, discount_months, is_active)")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const code = data?.referral_codes as unknown as {
    discount_percent: number;
    discount_months: number;
    is_active: boolean;
  } | null;
  return code?.is_active && code.discount_percent > 0 ? cuponDeReferido(code) : null;
}

/** El cliente retira el consentimiento: se borran los datos de contacto. */
export async function revokeReferralConsent(env: Env, context: AuthContext) {
  const organizationIds = context.memberships.map((m) => m.organization_id);
  if (organizationIds.length === 0) return { ok: true as const, data: { revoked: 0 } };
  const { data, error } = await createServiceClient(env)
    .from("referrals")
    .update({
      contact_consent_revoked_at: new Date().toISOString(),
      contact_name: null,
      contact_email: null,
    })
    .in("organization_id", organizationIds)
    .eq("user_id", context.user.id)
    .not("contact_consent_at", "is", null)
    .is("contact_consent_revoked_at", null)
    .select("id");
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "referral_consent_revoke_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: { revoked: data?.length ?? 0 } };
}

// ---------------------------------------------------------------------------
// platform_admin: gestion del programa desde /admin/programa-consultores.

const noAdmin = {
  ok: false as const,
  statusCode: 403,
  error: "platform_admin_required",
};

/** Todos los consultores con su codigo (o sin el) y sus cifras. */
export async function listReferralProgramAdmin(env: Env, context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") return noAdmin;
  const { data, error } = await createServiceClient(env).rpc(
    "admin_referral_program",
  );
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "referral_program_load_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: { consultants: data ?? [] } };
}

/** Referidos de un consultor, con contacto solo si hay consentimiento vivo. */
export async function listConsultantReferralsAdmin(
  env: Env,
  context: AuthContext,
  consultantUserId: string,
) {
  if (context.profile.platform_role !== "platform_admin") return noAdmin;
  const { data, error } = await createServiceClient(env).rpc(
    "consultant_referrals",
    { p_consultant_user_id: consultantUserId },
  );
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "referral_program_load_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: { referrals: data ?? [] } };
}

/**
 * Crea o edita el codigo de un consultor. El descuento solo cambia para los
 * checkouts nuevos: una suscripcion ya creada conserva el cupon que llevaba.
 */
export async function upsertReferralCodeAdmin(
  env: Env,
  context: AuthContext,
  consultantUserId: string,
  body: {
    code?: string;
    discount_percent?: number;
    discount_months?: number;
    is_active?: boolean;
  },
) {
  if (context.profile.platform_role !== "platform_admin") return noAdmin;
  const supabase = createServiceClient(env);

  const { data: existing } = await supabase
    .from("referral_codes")
    .select("id, code, discount_percent, discount_months")
    .eq("consultant_user_id", consultantUserId)
    .maybeSingle();

  const patch: Record<string, unknown> = {};
  if (body.code !== undefined) {
    const code = normalizarCodigo(body.code);
    if (!codigoValido(code)) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "referral_code_invalid",
        message: "De 3 a 32 caracteres: letras minúsculas, números y guiones.",
      };
    }
    patch.code = code;
  }
  if (body.discount_percent !== undefined) patch.discount_percent = body.discount_percent;
  if (body.discount_months !== undefined) patch.discount_months = body.discount_months;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  if (!existing && !patch.code) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "referral_code_required",
      message: "Indica el código para crearlo.",
    };
  }

  // Un cupon que no existe en Stripe rompe el checkout del cliente referido
  // con un 400 que nadie relaciona con este cambio: se comprueba al guardar.
  const discount = {
    discount_percent: (patch.discount_percent ?? existing?.discount_percent ?? 10) as number,
    discount_months: (patch.discount_months ?? existing?.discount_months ?? 3) as number,
  };
  if (discount.discount_percent > 0 && env.STRIPE_SECRET_KEY) {
    const coupon = cuponDeReferido(discount);
    try {
      await createStripeClient(env).coupons.retrieve(coupon);
    } catch (error) {
      return stripeErrorStatus(error) === 404
        ? {
            ok: false as const,
            statusCode: 400,
            error: "stripe_coupon_missing",
            message: `Crea antes en Stripe el cupón con ID "${coupon}" (${discount.discount_percent}% durante ${discount.discount_months} meses).`,
          }
        : {
            ok: false as const,
            statusCode: 502,
            error: "stripe_coupon_check_failed",
            detail: stripeErrorDetail(error),
          };
    }
  }

  const query = existing
    ? supabase
        .from("referral_codes")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : supabase
        .from("referral_codes")
        .insert({ ...patch, consultant_user_id: consultantUserId });
  const { data, error } = await query
    .select("code, discount_percent, discount_months, is_active")
    .single();
  if (error) {
    return error.code === "23505"
      ? {
          ok: false as const,
          statusCode: 409,
          error: "referral_code_taken",
          message: "Ese código ya es de otro consultor.",
        }
      : {
          ok: false as const,
          statusCode: 500,
          error: "referral_code_save_failed",
          detail: error.message,
        };
  }
  logger.info("referral_code_saved_by_admin", {
    consultant_user_id: consultantUserId,
    ...patch,
  });
  return { ok: true as const, data };
}
