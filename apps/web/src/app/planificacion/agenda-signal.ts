/**
 * En qué estado está una acción del calendario, para poder mirarla y saberlo.
 *
 * "Próximas acciones" ordenaba por fecha y ya: una acción cuya fecha pasó hace
 * dos semanas salía la primera, con la misma pinta que una de mañana y la
 * misma etiqueta ("Planificada"). Lo urgente y lo tranquilo se veían igual, que
 * es la peor manera de fallar en una agenda.
 */
export type AgendaState = "blocked" | "overdue" | "today" | "soon" | "later";

export type AgendaSignal = {
  state: AgendaState;
  label: string;
  tone: "danger" | "warn" | "brand" | "neutral";
};

const DAY_MS = 86_400_000;

export function agendaSignal(
  item: { starts_at: string; status: string; blocked_reason?: string | null },
  nowMs: number = Date.now(),
): AgendaSignal {
  if (item.blocked_reason) {
    return { state: "blocked", label: "Parada", tone: "danger" };
  }
  const starts = Date.parse(item.starts_at);
  if (!Number.isFinite(starts)) {
    return { state: "later", label: "Sin fecha", tone: "neutral" };
  }
  // Días de calendario, no de reloj: una acción de ayer a las 23:00 está
  // vencida "1 día", no "hace unas horas".
  const startDay = Math.floor(starts / DAY_MS);
  const today = Math.floor(nowMs / DAY_MS);
  const days = startDay - today;

  if (days < 0) {
    const late = -days;
    return {
      state: "overdue",
      label: `Vencida ${late} ${late === 1 ? "día" : "días"}`,
      tone: "danger",
    };
  }
  if (days === 0) return { state: "today", label: "Hoy", tone: "warn" };
  if (days <= 7)
    return {
      state: "soon",
      label: `En ${days} ${days === 1 ? "día" : "días"}`,
      tone: "warn",
    };
  return { state: "later", label: `En ${days} días`, tone: "neutral" };
}

/** Primero lo que arde. Dentro de cada grupo, por fecha. */
const STATE_ORDER: Record<AgendaState, number> = {
  blocked: 0,
  overdue: 1,
  today: 2,
  soon: 3,
  later: 4,
};

export function sortAgenda<
  T extends { starts_at: string; status: string; blocked_reason?: string | null },
>(items: T[], nowMs: number = Date.now()): T[] {
  return [...items]
    .filter(
      (item) => item.status !== "completed" && item.status !== "cancelled",
    )
    .sort((a, b) => {
      const orderDiff =
        STATE_ORDER[agendaSignal(a, nowMs).state] -
        STATE_ORDER[agendaSignal(b, nowMs).state];
      return orderDiff || Date.parse(a.starts_at) - Date.parse(b.starts_at);
    });
}
