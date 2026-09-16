import type { SupabaseClient } from "@supabase/supabase-js";
import { createStripeClient, stripeErrorDetail } from "./stripe-client.js";

/**
 * El descuento del cliente vinculado a una consultora (§2.1, §30 del modelo).
 *
 * **El descuento no se guarda: se deriva de la vinculacion.** §30 lo pide asi y
 * tiene razon -- un `descuento = 10` en una columna es un numero que hay que
 * acordarse de bajar el dia que la vinculacion termine, y el dia que se olvide
 * hay un cliente pagando de menos para siempre sin que nadie lo vea.
 *
 * En Stripe eso se puede cumplir de verdad porque el descuento es un CUPON
 * aplicado a la suscripcion, no un precio distinto:
 *
 *   - al comprar, si hay vinculacion viva, la sesion de checkout lleva el cupon;
 *   - al romperse la vinculacion, se quita el descuento de la suscripcion y la
 *     tarifa vuelve sola a la estandar, sin mover a nadie de plan.
 *
 * Con Whop habria hecho falta un plan duplicado ("Starter vinculado") porque
 * sus promo codes son cupones reutilizables y §9 exige un solo uso. Aqui el
 * cliente nunca teclea un codigo: lo aplica el servidor.
 */

/** El cupon vive en Stripe y lo crea `scripts/stripe-catalogo.mjs`. */
export const CUPON_VINCULADO = "vinculado-10";

/**
 * La consultora a la que esta vinculada una organizacion cliente, o null.
 *
 * La fuente de verdad es `consultant_assignments`: la misma fila que decide
 * quien ve esa tienda decide si hay descuento. Una tabla aparte de
 * vinculaciones (§31) seria una segunda verdad que se separa de la primera en
 * cuanto alguien reasigne un cliente por el otro camino.
 */
export async function consultoraVinculada(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("consultant_assignments")
    .select("consulting_organization_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .not("consulting_organization_id", "is", null)
    .limit(1)
    .maybeSingle();

  return (data?.consulting_organization_id as string | undefined) ?? null;
}

/**
 * Los parametros de descuento de una sesion de checkout.
 *
 * Se devuelve un objeto para mezclar, no un booleano, porque `discounts` y
 * `allow_promotion_codes` son incompatibles en Stripe: tener el sitio donde se
 * decide en una sola funcion evita que alguien anada el segundo mas adelante y
 * se encuentre un 400 sin saber de donde sale.
 */
export function descuentosDeCheckout(input: { vinculada: boolean }) {
  return input.vinculada ? { discounts: [{ coupon: CUPON_VINCULADO }] } : {};
}

/**
 * Quita el descuento de una suscripcion viva de Stripe.
 *
 * Se llama al romper la vinculacion. Si falla NO se aborta la desvinculacion:
 * dejar al cliente atado a un consultor porque Stripe no responde es peor que
 * cobrarle un 10% de menos un mes mas. El fallo se devuelve para registrarlo.
 */
export async function quitarDescuentoDeStripe(
  env: {
    STRIPE_SECRET_KEY?: string | undefined;
    STRIPE_API_VERSION?: string | undefined;
  },
  subscriptionId: string,
  stripeClient?: {
    subscriptions: {
      update(id: string, params: { discounts: [] }): Promise<unknown>;
    };
  },
): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (!env.STRIPE_SECRET_KEY) {
    return { ok: false, detail: "stripe_not_configured" };
  }

  try {
    const stripe = stripeClient ?? createStripeClient(env);
    await stripe.subscriptions.update(subscriptionId, {
      discounts: [],
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: stripeErrorDetail(error),
    };
  }
}
