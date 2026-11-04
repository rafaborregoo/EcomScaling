/**
 * Catálogo de avisos: la única lista de qué tipos existen, en qué categoría de
 * preferencias caen y qué significan. La usan la API (categoría, email, push),
 * la campana (la etiqueta de cada aviso) y Configuración › Notificaciones (qué
 * incluye cada interruptor). Ver docs/AUDITORIA_NOTIFICACIONES.md.
 *
 * Un tipo nuevo se añade AQUÍ y en `private.notification_category` (SQL): el
 * test de este fichero comprueba que la última migración que la define los
 * nombra todos. Sin eso cae en «Otros», que no manda email.
 */

export const NOTIFICATION_CATEGORIES = [
  "alert_critical",
  "alert",
  "task_assigned",
  "message",
  "campaign_review",
  "integration",
  "client",
  "other",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationTypeInfo = {
  category: NotificationCategory;
  /** Etiqueta corta en la campana: qué clase de aviso es. */
  label: string;
  /** Qué significa y por qué te llega. */
  explanation: string;
  /** A quién le puede llegar. */
  audience: "cliente" | "consultor" | "ambos";
};

export const NOTIFICATION_TYPES = {
  alert_critical: {
    category: "alert_critical",
    label: "Alerta crítica",
    explanation: "Algo serio en los datos de la tienda: ventas que se hunden, stock agotado de lo que más se vende. Al consultor solo le llegan estas.",
    audience: "ambos",
  },
  alert: {
    category: "alert",
    label: "Alerta",
    explanation: "Una regla ha detectado un cambio en los datos de la tienda que conviene mirar.",
    audience: "cliente",
  },
  task_assigned: {
    category: "task_assigned",
    label: "Tarea",
    explanation: "Te han dejado o propuesto una tarea, o han aceptado o rechazado una que propusiste tú.",
    audience: "ambos",
  },
  task_comment: {
    category: "task_assigned",
    label: "Comentario",
    explanation: "Alguien ha escrito en una tarea de la tienda. Varios comentarios seguidos se juntan en un aviso.",
    audience: "ambos",
  },
  task_completed: {
    category: "task_assigned",
    label: "Tarea completada",
    explanation: "El cliente ha cerrado una tarea. Si midió el resultado, va en el aviso.",
    audience: "consultor",
  },
  daily_today: {
    category: "task_assigned",
    label: "Para hoy",
    explanation: "Resumen de las 8:00, uno por tienda: lo que vence hoy y lo que va tarde.",
    audience: "ambos",
  },
  ai_pending: {
    category: "task_assigned",
    label: "Propuestas de la IA",
    explanation: "La IA ha preparado tareas nuevas que esperan tu decisión. Como mucho uno al día por tienda.",
    audience: "ambos",
  },
  camino_objective: {
    category: "task_assigned",
    label: "Mi Camino",
    explanation: "Alguien ha cambiado un objetivo o la meta, o la IA propone ajustes por ese cambio.",
    audience: "ambos",
  },
  meeting_booked: {
    category: "task_assigned",
    label: "Reunión",
    explanation: "Se ha reservado una reunión contigo, o tu consultor te ha citado.",
    audience: "ambos",
  },
  meeting_rescheduled: {
    category: "task_assigned",
    label: "Reunión movida",
    explanation: "Una reunión ha cambiado de día u hora.",
    audience: "ambos",
  },
  meeting_cancelled: {
    category: "task_assigned",
    label: "Reunión cancelada",
    explanation: "Una reunión se ha cancelado.",
    audience: "ambos",
  },
  message: {
    category: "message",
    label: "Mensaje",
    explanation: "Te han escrito por Mensajes. Uno por conversación hasta que lo leas.",
    audience: "ambos",
  },
  campaign_review: {
    category: "campaign_review",
    label: "Campaña",
    explanation: "Movimiento en una campaña: creada, editada, con notas, con cambios pedidos, revisada o programada.",
    audience: "ambos",
  },
  integration_error: {
    category: "integration",
    label: "Integración",
    explanation: "Shopify, Meta Ads, Klaviyo o Instagram ha perdido el permiso: hay que reconectarla para que vuelvan los datos.",
    audience: "ambos",
  },
  integration_expiring: {
    category: "integration",
    label: "Permiso por caducar",
    explanation: "El permiso de Meta Ads caduca pronto y Meta no lo renueva solo.",
    audience: "ambos",
  },
  client_linked: {
    category: "client",
    label: "Nuevo cliente",
    explanation: "Un cliente se ha dado de alta con tu código y ya está en tu cartera.",
    audience: "consultor",
  },
  client_settings: {
    category: "client",
    label: "Tus permisos",
    explanation: "El propietario de la cuenta ha cambiado lo que puedes hacer en ella. Los ves en Configuración › Tus permisos.",
    audience: "consultor",
  },
  client_decided_ai_output: {
    category: "client",
    label: "Decisión sobre la IA",
    explanation: "El cliente ha aprobado o descartado tareas que propuso la IA. Abre la propuesta con el detalle y su motivo.",
    audience: "consultor",
  },
  access_request: {
    category: "client",
    label: "Solicitud de acceso",
    explanation: "Alguien ha pedido acceso a E-NORA o un consultor ha declarado un cliente. Solo le llega a la dirección.",
    audience: "consultor",
  },
} as const satisfies Record<string, NotificationTypeInfo>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

const OTHER: NotificationTypeInfo = {
  category: "other",
  label: "Aviso",
  explanation: "Aviso de la plataforma.",
  audience: "ambos",
};

export function notificationTypeInfo(type: string): NotificationTypeInfo {
  return (NOTIFICATION_TYPES as Record<string, NotificationTypeInfo>)[type] ?? OTHER;
}

/** Mismo mapeo que `private.notification_category` en SQL. */
export function notificationCategory(type: string): NotificationCategory {
  return notificationTypeInfo(type).category;
}

/** Tipos de una categoría, para explicar qué incluye cada interruptor. */
export function notificationTypesIn(category: NotificationCategory): NotificationTypeInfo[] {
  return Object.values(NOTIFICATION_TYPES as Record<string, NotificationTypeInfo>).filter(
    (info) => info.category === category,
  );
}

/** Claves de los tipos de una categoría (para filtrar el historial). */
export function notificationTypeKeysIn(category: NotificationCategory): NotificationType[] {
  return (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter(
    (type) => NOTIFICATION_TYPES[type].category === category,
  );
}
