import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./auth-context.js";

/**
 * Capacidad de cartera: cuantos clientes puede llevar una consultora.
 *
 * §11, §12 y §15 del modelo de planes. Hasta ahora no habia tope: un consultor
 * daba de alta los clientes que quisiera y la factura se enteraba despues.
 */

export type Capacidad = {
  contracted: number;
  occupied: number;
  available: number;
};

export function describeCapacidad(input: {
  contracted: number;
  occupied: number;
}): Capacidad {
  return {
    contracted: input.contracted,
    occupied: input.occupied,
    available: Math.max(0, input.contracted - input.occupied),
  };
}

export type CapacidadDenegada = {
  ok: false;
  statusCode: number;
  error: string;
  message: string;
};

/**
 * El mensaje que ve el consultor cuando se queda sin plazas.
 *
 * Dice el numero y que hacer, porque "no se pudo crear el cliente" obliga a
 * escribir a soporte para enterarse de algo que el servidor ya sabia.
 */
export function sinPlazasDisponibles(capacidad: Capacidad): CapacidadDenegada {
  return {
    ok: false,
    statusCode: 409,
    error: "portfolio_capacity_reached",
    message:
      capacidad.contracted === 0
        ? "Tu plan no incluye plazas de cartera. Amplíalo para dar de alta clientes."
        : `Has ocupado las ${capacidad.contracted} plazas de tu plan (${capacidad.occupied} entre clientes activos y códigos pendientes). Amplía el plan o libera una plaza.`,
  };
}

/** La consultora de quien pide, o null si no pertenece a ninguna. */
export function consultingOrganizationIdOf(
  context: AuthContext,
): string | null {
  return (
    context.memberships.find(
      (membership) => membership.accessSource === "consulting_organization",
    )?.organization_id ?? null
  );
}

/**
 * Plazas contratadas y ocupadas de una consultora.
 *
 * ponytail: la comprobacion corre en Node y la creacion va despues en llamadas
 * aparte, asi que dos altas simultaneas de la misma consultora pueden pasar las
 * dos y vender una plaza de mas. Con una consultora y altas manuales, sobra.
 * La salida cuando deje de sobrar es mover el alta entera a una funcion SQL que
 * cuente e inserte en la misma transaccion -- la firma de aqui no cambia.
 */
export async function loadCapacidad(
  supabase: SupabaseClient,
  consultingOrganizationId: string,
): Promise<Capacidad> {
  const [{ data: subscription }, { data: occupied }] = await Promise.all([
    supabase
      .from("service_subscriptions")
      .select("contracted_client_slots")
      .eq("organization_id", consultingOrganizationId)
      .in("status", ["trial", "active"])
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("plazas_de_cartera_ocupadas", {
      consulting_organization_id: consultingOrganizationId,
    }),
  ]);

  return describeCapacidad({
    contracted: Number(subscription?.contracted_client_slots ?? 0),
    occupied: Number(occupied ?? 0),
  });
}

/**
 * Deja pasar el alta de un cliente, o la deniega con el motivo.
 *
 * El platform_admin no gasta plazas: no lleva cartera propia, da de alta en
 * nombre de otros. Un consultor sin consultora tampoco puede dar de alta --
 * ese estado no deberia existir (`private.is_consultant` lo exige para ser
 * consultor), y si aparece es un dato roto, no un permiso.
 */
export async function assertCapacidadDeCartera(
  supabase: SupabaseClient,
  context: AuthContext,
): Promise<CapacidadDenegada | null> {
  if (context.profile.platform_role === "platform_admin") return null;

  const consultingOrganizationId = consultingOrganizationIdOf(context);
  if (!consultingOrganizationId) {
    return {
      ok: false,
      statusCode: 409,
      error: "consulting_organization_missing",
      message:
        "Tu cuenta no está asociada a ninguna consultora. Avisa a soporte.",
    };
  }

  const capacidad = await loadCapacidad(supabase, consultingOrganizationId);
  if (capacidad.available <= 0) return sinPlazasDisponibles(capacidad);

  return null;
}
