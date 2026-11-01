import type { Tone } from "@/components/ui";

export type Meeting = {
  id: string;
  organization_id: string;
  organization_name?: string | null;
  consultant_user_id: string;
  meeting_type_id: string | null;
  title: string;
  kind: "video" | "phone" | "in_person";
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location_url: string | null;
  client_note: string | null;
  /** Solo lo ve el consultor (la API lo quita al cliente). */
  consultant_note?: string | null;
  cancel_reason: string | null;
  call_id: string | null;
  /** Estado de su llamada: transcripción y resumen del agente (al cliente solo si está publicado). */
  call: { id: string; status: string; has_transcript: boolean; summary: "none" | "draft" | "published" } | null;
};

export type MeetingType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours?: number;
  max_days_ahead?: number;
  max_per_day?: number | null;
  kind: Meeting["kind"];
  location_url: string | null;
  is_active?: boolean;
};

export const KIND_LABEL: Record<Meeting["kind"], string> = {
  video: "Videollamada",
  phone: "Llamada",
  in_person: "Presencial",
};

export const STATUS_LABEL: Record<Meeting["status"], { label: string; tone: Tone }> = {
  scheduled: { label: "Pendiente", tone: "brand" },
  completed: { label: "Celebrada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  no_show: { label: "No asistió", tone: "warn" },
};

export const WEEKDAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const fmtDay = (iso: string | Date, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  new Intl.DateTimeFormat("es-ES", options).format(typeof iso === "string" ? new Date(iso) : iso);

export function groupByDay<T extends { starts_at: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(new Date(item.starts_at));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

/** Pendiente y todavía no ha terminado: la que se puede mover, cancelar o a la que unirse. */
export const isUpcoming = (meeting: Meeting) => meeting.status === "scheduled" && new Date(meeting.ends_at).getTime() >= Date.now();

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
