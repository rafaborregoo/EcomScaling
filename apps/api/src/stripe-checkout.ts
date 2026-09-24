import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type Stripe from "stripe";
import type { LoadedApiEnv } from "@ecomscaling/config";
import type { AuthContext } from "./auth-context.js";
import {
  createStripeClient,
  stripeErrorDetail,
  stripeErrorStatus,
} from "./stripe-client.js";
import { cuponReferidoDeOrganizacion } from "./referidos.js";
import { consultoraVinculada, descuentosDeCheckout } from "./vinculacion.js";
import {
  STRIPE_CUSTOMER_TAX_ID_METADATA_KEY,
  STRIPE_ORGANIZATION_METADATA_KEY,
  STRIPE_USER_METADATA_KEY,
} from "./stripe.js";

/**
 * Codificador conservado para probar la representacion HTTP de parametros
 * anidados. Las llamadas reales pasan por el SDK oficial de Stripe.
 */
export function stripeForm(
  value: unknown,
  prefix = "",
  target = new URLSearchParams(),
): URLSearchParams {
  if (value === null || value === undefined) return target;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      stripeForm(item, `${prefix}[${index}]`, target),
    );
    return target;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      stripeForm(item, prefix ? `${prefix}[${key}]` : key, target);
    }
    return target;
  }

  target.append(prefix, String(value));
  return target;
}

/**
 * Abre una sesion de Checkout de Stripe para quien la pide.
 *
 * Lo que hace util a este endpoint frente a pegar un Payment Link en un correo
 * es la metadata: la compra vuelve por el webhook con el id de la cuenta que la
 * inicio, asi que se atribuye sola. Sin pasar por aqui la atribucion depende de
 * que el correo de Stripe coincida con el de la plataforma, y no tiene por que.
 *
 * La metadata se pone en `subscription_data`, NO en la sesion: la de la sesion
 * solo viaja en `checkout.session.completed`, mientras que la de la suscripcion
 * viene en todos los `customer.subscription.*`, que son los que mueven el
 * acceso. Ponerla solo en la sesion significa que la primera compra se atribuye
 * y la primera renovacion ya no.
 *
 * El `price_id` lo pone quien llama porque el catalogo vive en el dashboard de
 * Stripe (ver `stripe.ts`). No se valida contra una lista nuestra: si no
 * existe, Stripe responde 400 y se propaga tal cual.
 */
export async function createStripeCheckout(
  env: LoadedApiEnv,
  context: AuthContext,
  body: {
    price_id?: string;
    organization_id?: string;
    success_url?: string;
    cancel_url?: string;
    customer_tax_id?: string;
  },
) {
  if (!env.STRIPE_SECRET_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "stripe_not_configured",
      message: "Los pagos todavia no estan configurados en este entorno.",
    };
  }

  const priceId = body.price_id?.trim();
  if (!priceId) {
    return { ok: false as const, statusCode: 400, error: "price_id_required" };
  }

  const organizationId = body.organization_id?.trim() || null;
  const customerTaxId = body.customer_tax_id?.trim().toUpperCase() || null;
  if (customerTaxId && !/^[A-Z0-9-]{5,40}$/.test(customerTaxId)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "customer_tax_id_invalid",
    };
  }
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
  const subjectMetadata = organizationId
    ? { [STRIPE_ORGANIZATION_METADATA_KEY]: organizationId }
    : { [STRIPE_USER_METADATA_KEY]: context.user.id };
  const metadata = customerTaxId
    ? {
        ...subjectMetadata,
        [STRIPE_CUSTOMER_TAX_ID_METADATA_KEY]: customerTaxId,
      }
    : subjectMetadata;

  // El 10% del cliente vinculado (§2.1) NO se guarda en ningun sitio: se
  // deriva de que exista una asignacion viva a una consultora, aqui y ahora.
  // Si manana deja de estar vinculado, el checkout siguiente ya no lo lleva.
  const service = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as never },
    },
  );
  const vinculada = organizationId
    ? Boolean(await consultoraVinculada(service, organizationId))
    : false;
  // Descuento de bienvenida del codigo de referido. Tiene duracion propia en
  // Stripe (`repeating`), asi que caduca solo sin que nadie lo retire.
  const cuponReferido =
    organizationId && !vinculada
      ? await cuponReferidoDeOrganizacion(service, organizationId)
      : null;

  const origin = (env.WEB_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "");
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    // Etiqueta el flujo en el dashboard de Stripe para poder comparar
    // conversiones entre flujos de checkout. El sufijo aleatorio es lo que
    // Stripe pide para distinguir despliegues del mismo flujo.
    integration_identifier: "ecomscaling-planes-kqmdwzrx",
    // OJO: nada de `payment_method_types`. Fijarlo apaga los metodos de pago
    // dinamicos y deja fuera todo lo que no sea tarjeta -- que en Europa es
    // justo donde esta la conversion.
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: body.success_url ?? `${origin}/planes?estado=listo`,
    cancel_url: body.cancel_url ?? `${origin}/planes`,
    // Rastro extra por si hay que reconciliar a mano desde el dashboard.
    client_reference_id: context.user.id,
    ...(context.user.email ? { customer_email: context.user.email } : {}),
    // VERI*FACTU necesita el NIF del comprador. Se recoge en el propio
    // checkout: pedirlo despues por email es como se acaba emitiendo una
    // factura sin el.
    tax_id_collection: { enabled: true },
    metadata,
    subscription_data: { metadata },
    ...descuentosDeCheckout({ vinculada, cuponReferido }),
  };

  try {
    const session =
      await createStripeClient(env).checkout.sessions.create(params);
    if (!session.url) {
      return {
        ok: false as const,
        statusCode: 502,
        error: "stripe_checkout_failed",
        detail: "Stripe no devolvio una URL de Checkout.",
      };
    }

    return {
      ok: true as const,
      data: { checkout_id: session.id, purchase_url: session.url },
    };
  } catch (error) {
    const status = stripeErrorStatus(error);
    return {
      ok: false as const,
      statusCode: status === 404 ? 404 : 502,
      error: "stripe_checkout_failed",
      detail: `${status ? `HTTP ${status}: ` : ""}${stripeErrorDetail(error)}`,
    };
  }
}
