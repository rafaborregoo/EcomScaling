/**
 * Quien paga, decidido en el mismo formulario que da de alta.
 *
 * Hasta ahora el alta desde /admin no preguntaba: al consultor se le concedia
 * SIEMPRE un plan activo sin limite de tiendas, y al cliente un trial. Ninguna
 * de las dos cosas se veia en pantalla ni se podia cambiar, asi que no habia
 * forma de decir "a este le doy el plan yo" ni "a este que lo pague".
 *
 * Logica pura, sin "use client" ni imports de React/UI, a proposito: es lo
 * que hace falta para probarla con node:test sin arrastrar @heroui/react (sus
 * exports por subpath no los resuelve tsx fuera de un bundler).
 */

export type ConcesionDePlanValue = {
  conceder: boolean;
  planCode: string;
  storeLimit: string;
  sinLimite: boolean;
  memberLimit: string;
  sinLimiteUsuarios: boolean;
  /** Plazas de cartera: cuántos clientes puede llevar. Solo cuenta en una consultora (`cartera`). */
  clientSlots: string;
  endsAt: string;
};

/**
 * `conceder` arranca en lo que ya hacia cada alta antes de existir este
 * bloque: el consultor nacia con plan concedido y el cliente en trial. Abrir
 * la puerta no es motivo para mover el valor por defecto de nadie.
 */
export function concesionInicial(
  planCode: string,
  conceder: boolean,
): ConcesionDePlanValue {
  return {
    conceder,
    planCode,
    storeLimit: "1",
    sinLimite: false,
    memberLimit: "1",
    sinLimiteUsuarios: true,
    clientSlots: "2",
    endsAt: "",
  };
}

/** Para editar un plan que ya existe (la ficha de un consultor o cliente ya
 *  dado de alta), en vez de decidirlo de cero. */
export function concesionDesde(plan: {
  plan_code: string;
  store_limit: number | null;
  member_limit?: number | null;
  contracted_client_slots?: number | null;
  ends_at: string | null;
}): ConcesionDePlanValue {
  return {
    conceder: true,
    planCode: plan.plan_code,
    storeLimit: plan.store_limit === null ? "1" : String(plan.store_limit),
    sinLimite: plan.store_limit === null,
    memberLimit: plan.member_limit == null ? "1" : String(plan.member_limit),
    sinLimiteUsuarios: plan.member_limit == null,
    clientSlots: String(plan.contracted_client_slots ?? 0),
    // El input type="date" quiere YYYY-MM-DD, no el ISO completo.
    endsAt: plan.ends_at ? plan.ends_at.slice(0, 10) : "",
  };
}

/**
 * Lo que va en el cuerpo de la peticion. `null` = no se concede nada.
 *
 * `cartera`: el sujeto es una consultora. Entonces las plazas van siempre:
 * conceder crea una fila nueva, y sin ellas nacería con 0 clientes aunque la
 * anterior tuviera varios.
 */
export function grantPlanBody(valor: ConcesionDePlanValue, cartera = false) {
  if (!valor.conceder) return null;
  return {
    plan_code: valor.planCode.trim(),
    // Explicito a proposito, igual que en el backend: `null` es "sin limite",
    // no "no me he acordado".
    store_limit: valor.sinLimite ? null : Number.parseInt(valor.storeLimit, 10),
    member_limit: valor.sinLimiteUsuarios
      ? null
      : Number.parseInt(valor.memberLimit, 10),
    ...(cartera ? { client_slots: Number.parseInt(valor.clientSlots, 10) } : {}),
    ...(valor.endsAt ? { ends_at: new Date(valor.endsAt).toISOString() } : {}),
  };
}

export function concesionValida(valor: ConcesionDePlanValue, cartera = false) {
  if (!valor.conceder) return true;
  return (
    valor.planCode.trim() !== "" &&
    (valor.sinLimite || /^[1-9]\d*$/.test(valor.storeLimit)) &&
    (valor.sinLimiteUsuarios || /^[1-9]\d*$/.test(valor.memberLimit)) &&
    (!cartera || /^\d+$/.test(valor.clientSlots))
  );
}
