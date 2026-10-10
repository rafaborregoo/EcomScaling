// Nombres legibles de planes y estados de suscripción. La UI enseñaba los
// códigos de la base ("trial · trial"); un código nuevo se muestra tal cual
// hasta que se le ponga nombre aquí.

const PLAN_NAMES: Record<string, string> = {
  trial: "Prueba gratuita",
  growth: "Crecimiento",
  consultant: "Consultor",
  consultant_legacy: "Consultor (tarifa anterior)",
  internal_test: "Prueba interna",
};

const STATUS_NAMES: Record<string, string> = {
  active: "activo",
  trial: "en prueba",
  trialing: "en prueba",
  paused: "pausado",
  cancelled: "cancelado",
  canceled: "cancelado",
  expired: "caducado",
  past_due: "pago pendiente",
  pending: "pendiente",
};

export function planName(code: string | null | undefined): string {
  if (!code) return "Sin plan";
  return PLAN_NAMES[code] ?? code;
}

/** «Crecimiento · activo». Sin estado repetido: un plan de prueba ya dice que es prueba. */
export function planLabel(code: string | null | undefined, status?: string | null): string {
  const name = planName(code);
  if (!code || !status) return name;
  const state = STATUS_NAMES[status] ?? status;
  if (code === "trial" && (status === "trial" || status === "trialing")) return name;
  return `${name} · ${state}`;
}
