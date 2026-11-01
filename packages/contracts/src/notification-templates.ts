import type { NotificationType } from "./notification-catalog.js";

/**
 * Plantillas de los avisos (ADR-0028): el texto, el destino y la agrupación de
 * cada tipo viven aquí, no en el servicio que lo emite. El servicio solo
 * aporta los datos (nombres, títulos, ids) y `notify()` renderiza.
 *
 * Reglas de copy: título = quién + qué, con nombres; texto = el detalle o lo
 * que hay que hacer. Funciones puras: se prueban sin red.
 */

// --- Ayudas de texto -----------------------------------------------------------

/** «A», «B» y 3 más. */
export function listTitles(titles: string[], max = 3): string {
  const clean = titles.map((title) => title.trim()).filter(Boolean);
  const shown = clean.slice(0, max).map((title) => `«${title}»`);
  const rest = clean.length - shown.length;
  if (shown.length === 0) return "";
  if (rest > 0) return `${shown.join(", ")} y ${rest} más`;
  if (shown.length === 1) return shown[0]!;
  return `${shown.slice(0, -1).join(", ")} y ${shown[shown.length - 1]}`;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Une las líneas de dos textos sin repetir (avisos agrupados). */
export function mergeLines(previous: string | null, next: string | null): string | null {
  const lines = [...(previous ?? "").split("\n"), ...(next ?? "").split("\n")]
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = [...new Set(lines)];
  return unique.length ? unique.join("\n").slice(0, 2000) : null;
}

const quote = (text: string, max = 220) => `«${text.length > max ? `${text.slice(0, max)}…` : text}»`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const PROVIDER_LABEL: Record<string, string> = {
  shopify: "Shopify",
  meta_ads: "Meta Ads",
  meta: "Meta Ads",
  klaviyo: "Klaviyo",
  instagram: "Instagram",
};

/** «Meta Ads», nunca «meta_ads»: el nombre del proveedor tal como lo conoce quien lee. */
export function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? "la integración";
}

function tasksUrl(organizationId: string | null, params: string) {
  const query = [organizationId ? `organizationId=${organizationId}` : null, params || null].filter(Boolean).join("&");
  return `/tareas${query ? `?${query}` : ""}`;
}

// --- Datos de cada tipo ---------------------------------------------------------

export type CampaignEvent =
  | "scheduled"
  | "client_scheduled"
  | "client_created"
  | "client_edited"
  | "client_note"
  | "client_resolved"
  | "consultant_note"
  | "changes_requested"
  | "reviewed";

/** `when` ya viene formateado (día y hora) por quien emite: la plantilla no conoce husos. */
export type MeetingNoticeData = { meetingId: string; who: string; title: string; when: string; reason?: string | null };

export type NotificationData = {
  alert_critical: { alertId: string; title: string; message: string | null; store: string | null };
  alert: { alertId: string; title: string; message: string | null; store: string | null };
  task_assigned:
    | { kind: "proposed"; who: string; taskId: string; taskTitle: string }
    | { kind: "decided"; store: string; accepted: boolean; taskId: string; taskTitle: string; reason: string | null }
    | { kind: "from_ai"; who: string; byClient: boolean; taskIds: string[]; titles: string[] };
  task_comment: { who: string; taskId: string; taskTitle: string; text: string };
  task_completed: { store: string; taskId: string; taskTitle: string; outcome: string | null };
  daily_today: { store: string | null; tasks: Array<{ id: string; title: string; late: boolean }> };
  ai_pending: { store: string; forClient: boolean; titles: string[] };
  camino_objective:
    | { kind: "changed"; changeId: string | null; who: string; action: "created" | "updated" | "removed"; scope: "objective" | "plan_goal"; detail: string; reason: string | null }
    | { kind: "review"; proposals: number };
  meeting_booked: MeetingNoticeData;
  meeting_rescheduled: MeetingNoticeData;
  meeting_cancelled: MeetingNoticeData;
  message: { who: string; text: string | null };
  campaign_review: { event: CampaignEvent; itemId: string; campaignTitle: string; store: string | null; consultant: string | null; detail: string | null };
  integration_error: { connectionId: string; provider: string; accountName: string | null };
  integration_expiring: { connectionId: string; provider: string; accountName: string | null; expiresAt: string };
  client_linked: { store: string };
  client_settings: { store: string; changes: Array<{ key: string; label: string; granted: boolean }> };
  client_decided_ai_output: { outputId: string; store: string; approved: boolean; titles: string[]; reason: string | null };
};

export type RenderedNotification = {
  title: string;
  message: string | null;
  url: string;
  entityType: string | null;
  entityId: string | null;
};

type Template<T extends NotificationType> = {
  render: (data: NotificationData[T], organizationId: string | null) => RenderedNotification;
  /** Si existe, un aviso SIN LEER del mismo tipo y entidad se reescribe con esto. */
  merge?: (previous: { title: string; message: string | null }, next: RenderedNotification, data: NotificationData[T]) => {
    title: string;
    message: string | null;
  };
};

// --- Plantillas ---------------------------------------------------------------

function renderAlert(data: NotificationData["alert"], organizationId: string | null): RenderedNotification {
  return {
    // Al consultor (lleva varias tiendas) el nombre delante: el email y el
    // push no van agrupados por tienda como la campana.
    title: data.store ? `${data.store}: ${data.title}` : data.title,
    message: data.message,
    url: tasksUrl(organizationId, `alert=${data.alertId}`),
    entityType: "alert",
    entityId: data.alertId,
  };
}

function campaignCopy(data: NotificationData["campaign_review"]) {
  const who = data.store ?? "Tu cliente";
  const consultant = data.consultant?.trim() || "Tu consultor";
  const title = data.campaignTitle.slice(0, 120);
  const copy: Record<CampaignEvent, { title: string; message: string }> = {
    client_created: { title: `${who} ha creado «${title}»`, message: "Revísala y deja tus notas o correcciones, a mano o con IA." },
    client_edited: { title: `${who} ha editado «${title}»`, message: "La campaña vuelve a estar pendiente de tu revisión." },
    client_note: { title: `${who} ha escrito en «${title}»`, message: "Tiene un mensaje nuevo en el hilo de la campaña." },
    client_resolved: { title: `${who} ha marcado una corrección como hecha en «${title}»`, message: "Compruébala en la campaña." },
    consultant_note: { title: `${consultant} ha escrito en «${title}»`, message: "Tienes un mensaje nuevo en el hilo de la campaña." },
    changes_requested: { title: `${consultant} te pide cambios en «${title}»`, message: "Revisa sus notas, aplica los cambios y devuélvesela a revisar." },
    reviewed: { title: `${consultant} ha revisado «${title}»`, message: "La campaña está revisada." },
    scheduled: { title: `${consultant} ha programado «${title}»`, message: data.detail ?? "Puedes cancelarla desde Campañas hasta la hora de envío." },
    client_scheduled: { title: `${who} ha programado «${title}»`, message: data.detail ?? "Ya está programada en su cuenta de Klaviyo." },
  };
  return copy[data.event];
}

export const NOTIFICATION_TEMPLATES: { [T in NotificationType]: Template<T> } = {
  alert_critical: { render: renderAlert },
  alert: { render: renderAlert },

  task_assigned: {
    render: (data, organizationId) => {
      if (data.kind === "proposed") {
        return {
          title: `${data.who} te propone una tarea: «${data.taskTitle}»`,
          message: "Acéptala y pasa a tu lista, o recházala si no te encaja.",
          url: tasksUrl(organizationId, `task=${data.taskId}`),
          entityType: "task",
          entityId: data.taskId,
        };
      }
      if (data.kind === "decided") {
        return {
          title: `${data.store} ha ${data.accepted ? "aceptado" : "rechazado"} «${data.taskTitle}»`,
          message: data.accepted
            ? "Ya está en su lista de tareas."
            : data.reason
              ? `Motivo: ${data.reason}`
              : "No ha dejado motivo. Está en Tareas, en «Descartadas y archivadas por el cliente».",
          url: tasksUrl(organizationId, `task=${data.taskId}`),
          entityType: "task",
          entityId: data.taskId,
        };
      }
      const count = plural(data.taskIds.length || data.titles.length, "tarea nueva", "tareas nuevas");
      return {
        title: data.byClient ? `${data.who} ha añadido ${count} de la IA` : `${data.who} te ha dejado ${count}`,
        message: `${listTitles(data.titles)}. Cada una explica qué hacer y cómo saber que está hecha.`,
        url:
          data.taskIds.length === 1
            ? tasksUrl(organizationId, `task=${data.taskIds[0]}`)
            : tasksUrl(organizationId, `focus=${data.taskIds.slice(0, 20).join(",")}`),
        entityType: "task",
        entityId: data.taskIds[0] ?? null,
      };
    },
  },

  task_comment: {
    render: (data, organizationId) => ({
      title: `${data.who} ha comentado en «${data.taskTitle}»`,
      message: quote(data.text),
      url: tasksUrl(organizationId, `task=${data.taskId}`),
      entityType: "task",
      entityId: data.taskId,
    }),
    // Varios comentarios seguidos en la misma tarea: un aviso con el último.
    merge: (_previous, next, data) => ({ title: `Comentarios nuevos en «${data.taskTitle}»`, message: next.message }),
  },

  task_completed: {
    render: (data, organizationId) => ({
      title: `${data.store} ha completado «${data.taskTitle}»`,
      message: data.outcome ? `Resultado: ${data.outcome}` : "Sin resultado medido todavía.",
      url: tasksUrl(organizationId, `task=${data.taskId}`),
      entityType: "task",
      entityId: data.taskId,
    }),
  },

  daily_today: {
    render: (data, organizationId) => {
      const late = data.tasks.filter((task) => task.late);
      const today = data.tasks.length - late.length;
      const parts = [
        today > 0 ? plural(today, "vence hoy", "vencen hoy") : null,
        late.length > 0 ? plural(late.length, "va tarde", "van tarde") : null,
      ].filter(Boolean);
      // Las que van tarde primero: son las que más urgen.
      const ordered = [...late, ...data.tasks.filter((task) => !task.late)];
      return {
        title: `Para hoy${data.store ? ` en ${data.store}` : ""}: ${plural(data.tasks.length, "tarea", "tareas")}`,
        message: capitalize(`${parts.join(" y ")}. ${listTitles(ordered.map((task) => task.title))}.`),
        url: tasksUrl(organizationId, `focus=${ordered.slice(0, 20).map((task) => task.id).join(",")}`),
        entityType: "organization",
        entityId: organizationId,
      };
    },
  },

  ai_pending: {
    render: (data, organizationId) => ({
      title: data.forClient
        ? `La IA te propone ${plural(data.titles.length, "tarea", "tareas")}`
        : `La IA propone ${plural(data.titles.length, "tarea", "tareas")} para ${data.store}`,
      message: `${listTitles(data.titles)}. Cada una explica por qué y con qué datos. Esperan tu decisión.`,
      // Sin consultor decide el cliente desde su Inicio; el consultor, en Tareas.
      url: data.forClient ? `/dashboard?organizationId=${organizationId}` : tasksUrl(organizationId, ""),
      entityType: "organization",
      entityId: organizationId,
    }),
  },

  camino_objective: {
    render: (data, organizationId) => {
      if (data.kind === "review") {
        return {
          title:
            data.proposals > 0
              ? `La IA propone ${plural(data.proposals, "ajuste", "ajustes")} en Mi Camino por el nuevo objetivo`
              : "La IA ha revisado Mi Camino tras el cambio de objetivo",
          message:
            data.proposals > 0
              ? "Cada ajuste explica por qué. Nada cambia hasta que alguien lo acepte."
              : "Con los objetivos nuevos no ve necesario cambiar hitos ni tareas por ahora.",
          url: `/camino?organizationId=${organizationId}&vista=seguimiento`,
          entityType: "strategic_plan",
          entityId: null,
        };
      }
      const verb = data.action === "created" ? "añadido" : data.action === "removed" ? "quitado" : "cambiado";
      const what = data.scope === "plan_goal" ? "la meta de Mi Camino" : "un objetivo de Mi Camino";
      return {
        title: `${data.who} ha ${verb} ${what}`,
        message: `${data.detail}.${data.reason ? ` Motivo: ${data.reason.slice(0, 300)}.` : ""} La IA revisará el Camino y propondrá ajustes; nada cambia hasta que alguien los acepte.`,
        url: `/camino?organizationId=${organizationId}&vista=objetivos`,
        entityType: "camino_objective_change",
        entityId: data.changeId,
      };
    },
  },

  message: {
    render: (data, organizationId) => ({
      title: `${data.who} te ha escrito`,
      message: data.text ? data.text.slice(0, 280) : "Te ha enviado un archivo.",
      url: `/mensajes?chat=${organizationId}`,
      entityType: "consultant_conversation",
      entityId: organizationId,
    }),
    // Uno por conversación hasta que lo leas, con el último mensaje.
    merge: (_previous, next) => ({ title: next.title, message: next.message }),
  },

  meeting_booked: {
    render: (data, organizationId) => ({
      title: `${data.who} ha reservado «${data.title.slice(0, 100)}»`,
      message: data.when,
      url: `/reuniones?organizationId=${organizationId}&meeting=${data.meetingId}`,
      entityType: "meeting",
      entityId: data.meetingId,
    }),
  },

  meeting_rescheduled: {
    render: (data, organizationId) => ({
      title: `${data.who} ha movido «${data.title.slice(0, 100)}»`,
      message: `Nueva hora: ${data.when}`,
      url: `/reuniones?organizationId=${organizationId}&meeting=${data.meetingId}`,
      entityType: "meeting",
      entityId: data.meetingId,
    }),
  },

  meeting_cancelled: {
    render: (data, organizationId) => ({
      title: `${data.who} ha cancelado «${data.title.slice(0, 100)}»`,
      message: data.reason ? `${data.when}. ${data.reason}` : data.when,
      url: `/reuniones?organizationId=${organizationId}&meeting=${data.meetingId}`,
      entityType: "meeting",
      entityId: data.meetingId,
    }),
  },

  campaign_review: {
    render: (data, organizationId) => ({
      ...campaignCopy(data),
      url: `/marketing?section=campanas&organizationId=${organizationId}&campaign=${data.itemId}`,
      entityType: "campaign_calendar_item",
      entityId: data.itemId,
    }),
  },

  integration_error: {
    render: (data, organizationId) => {
      const provider = providerLabel(data.provider);
      return {
        title: capitalize(`${provider} se ha desconectado`),
        message: `${data.accountName ? `${data.accountName}. ` : ""}Perdió el permiso y sus datos están parados. Reconéctala y vuelven solos, sin perder el histórico.`,
        url: `/integraciones?organizationId=${organizationId}`,
        entityType: "integration_connection",
        entityId: data.connectionId,
      };
    },
    // Si se cae otra vez antes de leerlo, no se repite el aviso.
    merge: (_previous, next) => ({ title: next.title, message: next.message }),
  },

  integration_expiring: {
    render: (data, organizationId) => {
      const provider = providerLabel(data.provider);
      const date = new Date(data.expiresAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
      return {
        title: `El permiso de ${provider} caduca el ${date}`,
        message: `${data.accountName ? `${data.accountName}. ` : ""}${provider} no lo renueva solo: reconéctala antes de esa fecha para que no se paren los datos.`,
        url: `/integraciones?organizationId=${organizationId}`,
        entityType: "integration_connection",
        entityId: data.connectionId,
      };
    },
  },

  client_linked: {
    render: (data, organizationId) => ({
      title: `Nuevo cliente: ${data.store}`,
      message: "Se ha dado de alta con tu código y ya está en tu cartera. El primer paso es que conecte su tienda.",
      url: `/consultor?organizationId=${organizationId}`,
      entityType: "organization",
      entityId: organizationId,
    }),
  },

  client_settings: {
    render: (data, organizationId) => {
      const lines = data.changes.map((change) =>
        change.granted ? `Ahora puedes ${change.label}.` : `Ya no puedes ${change.label}.`,
      );
      const single = data.changes.length === 1 ? data.changes[0]! : null;
      return {
        title: single
          ? `${data.store} te ha ${single.granted ? "dado" : "quitado"} permiso para ${single.label}`
          : `${data.store} ha cambiado tus permisos`,
        message: lines.join("\n"),
        url: `/configuracion?organizationId=${organizationId}&section=consultor&focus=perm-${data.changes[0]?.key ?? ""}`,
        entityType: "organization",
        entityId: organizationId,
      };
    },
    // Varios cambios seguidos: un aviso con el estado neto de cada permiso.
    merge: (previous, next, data) => {
      const kept = (previous.message ?? "")
        .split("\n")
        .filter((line) => line.trim() && !data.changes.some((change) => line.includes(change.label)));
      return { title: `${data.store} ha cambiado tus permisos`, message: mergeLines(kept.join("\n"), next.message) };
    },
  },

  client_decided_ai_output: {
    render: (data, organizationId) => {
      const titles = listTitles(data.titles);
      const why = data.reason?.trim()
        ? `Motivo: ${data.reason.trim()}`
        : data.approved
          ? "Ya están en su lista de tareas."
          : "No ha dejado motivo.";
      return {
        title: `${data.store} ha ${data.approved ? "aprobado" : "descartado"} ${plural(Math.max(1, data.titles.length), "propuesta", "propuestas")} de la IA`,
        message: (titles ? `${titles}. ${why}` : why).slice(0, 1000),
        url: `/propuestas/${data.outputId}?organizationId=${organizationId}`,
        entityType: "agent_output",
        entityId: data.outputId,
      };
    },
  },
};

export function renderNotification<T extends NotificationType>(
  type: T,
  data: NotificationData[T],
  organizationId: string | null,
): RenderedNotification {
  return (NOTIFICATION_TEMPLATES[type] as Template<T>).render(data, organizationId);
}

export function mergeNotification<T extends NotificationType>(
  type: T,
  data: NotificationData[T],
  previous: { title: string; message: string | null },
  next: RenderedNotification,
) {
  const merge = (NOTIFICATION_TEMPLATES[type] as Template<T>).merge;
  return merge ? merge(previous, next, data) : null;
}

export function notificationGroups(type: NotificationType): boolean {
  return Boolean(NOTIFICATION_TEMPLATES[type].merge);
}
