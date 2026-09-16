import type { LoadedApiEnv } from "@ecomscaling/config";
import type { AuthContext } from "./auth-context.js";
import {
  WHOP_ORGANIZATION_METADATA_KEY,
  WHOP_USER_METADATA_KEY,
} from "./whop.js";

const WHOP_API_BASE = "https://api.whop.com/api/v1";

/**
 * Abre un checkout de Whop para quien lo pide.
 *
 * Lo que hace util a este endpoint frente a pegar el enlace del plan en un
 * correo es la metadata: la compra vuelve por el webhook con el id de la cuenta
 * que la inicio, asi que se atribuye sola. Sin pasar por aqui la atribucion
 * depende de que el correo de Whop coincida con el de la plataforma, y no tiene
 * por que.
 *
 * El `plan_id` lo pone quien llama porque el catalogo vive en el dashboard de
 * Whop (ver `whop.ts`). No se valida contra una lista nuestra: si no existe,
 * Whop responde 404 y se propaga tal cual.
 */
export async function createWhopCheckout(
  env: LoadedApiEnv,
  context: AuthContext,
  body: { plan_id?: string; organization_id?: string; redirect_url?: string },
) {
  if (!env.WHOP_API_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "whop_not_configured",
      message: "Los pagos todavia no estan configurados en este entorno.",
    };
  }

  const planId = body.plan_id?.trim();
  if (!planId) {
    return { ok: false as const, statusCode: 400, error: "plan_id_required" };
  }

  const organizationId = body.organization_id?.trim() || null;
  if (
    organizationId &&
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  // Exactamente un sujeto, igual que el check de `service_subscriptions`: o la
  // paga una organizacion, o la paga una persona.
  const metadata = organizationId
    ? { [WHOP_ORGANIZATION_METADATA_KEY]: organizationId }
    : { [WHOP_USER_METADATA_KEY]: context.user.id };

  let response: Response;
  try {
    response = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.WHOP_API_KEY}`,
        "content-type": "application/json",
        ...(env.WHOP_API_VERSION_DATE
          ? { "api-version-date": env.WHOP_API_VERSION_DATE }
          : {}),
      },
      body: JSON.stringify({
        plan_id: planId,
        metadata,
        ...(body.redirect_url ? { redirect_url: body.redirect_url } : {}),
      }),
    });
  } catch (error) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "whop_unreachable",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    purchase_url?: string;
    message?: string;
    error?: string;
  } | null;

  if (!response.ok || !payload?.purchase_url) {
    return {
      ok: false as const,
      statusCode: response.status === 404 ? 404 : 502,
      error: "whop_checkout_failed",
      detail: payload?.message ?? payload?.error ?? `HTTP ${response.status}`,
    };
  }

  return {
    ok: true as const,
    data: {
      checkout_id: payload.id ?? null,
      purchase_url: payload.purchase_url,
    },
  };
}
