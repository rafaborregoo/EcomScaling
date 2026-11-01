import { localCampaignDateTimeToUtc } from "./campaign-plan-window.js";

/**
 * Lógica pura de las reuniones: huecos libres y archivo .ics.
 *
 * Un hueco es libre si cae dentro de una franja del horario semanal del
 * consultor, respeta la antelación mínima y el máximo de días vista, y su rango
 * [inicio, fin + colchón) no toca nada de lo que ya ocupa su agenda (reservas de
 * TODOS sus clientes y bloqueos manuales). El último juez es la restricción
 * `meetings_no_overlap` de la base; esto solo decide qué se ofrece.
 */

export type AvailabilityRule = { weekday: number; start_time: string; end_time: string };
/** Lo que ya ocupa la agenda del consultor (reserva con su colchón, o bloqueo). */
export type BusyRange = { starts_at: string; ends_at: string };
export type SlotRules = {
  duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  max_per_day: number | null;
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
/** Tope de días por consulta: la pantalla pide un mes cada vez. */
export const MAX_SLOT_RANGE_DAYS = 62;

export function dateKeyInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function parseTime(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return { hour: Number(hour), minute: Number(minute) };
}

/** Lunes = 1 … domingo = 7, del día civil `YYYY-MM-DD`. */
function isoWeekday(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function addDaysKey(dateKey: string, days: number) {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export type ComputeSlotsInput = {
  /** Horario semanal en la zona del consultor. */
  rules: AvailabilityRule[];
  busy: BusyRange[];
  /** Inicios de las reuniones `scheduled` del consultor, para `max_per_day`. */
  scheduledStarts: string[];
  type: SlotRules;
  /** Zona del consultor: los días y las franjas se leen en ella. */
  timezone: string;
  stepMinutes: number;
  /** Rango de días civiles (zona del consultor), ambos incluidos. */
  fromDate: string;
  toDate: string;
  now?: Date;
};

/** Inicios (ISO UTC) de los huecos libres. */
export function computeSlots(input: ComputeSlotsInput): string[] {
  const now = (input.now ?? new Date()).getTime();
  const earliest = now + input.type.min_notice_hours * 60 * MINUTE_MS;
  const latest = now + input.type.max_days_ahead * DAY_MS;
  const durationMs = input.type.duration_minutes * MINUTE_MS;
  const occupiedMs = durationMs + input.type.buffer_minutes * MINUTE_MS;
  const stepMs = input.stepMinutes * MINUTE_MS;
  const busy = input.busy.map((range) => ({
    start: Date.parse(range.starts_at),
    end: Date.parse(range.ends_at),
  }));

  const perDay = new Map<string, number>();
  for (const start of input.scheduledStarts) {
    const key = dateKeyInZone(new Date(start), input.timezone);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const slots: string[] = [];
  const days = Math.min(
    MAX_SLOT_RANGE_DAYS,
    Math.round((Date.parse(`${input.toDate}T00:00:00.000Z`) - Date.parse(`${input.fromDate}T00:00:00.000Z`)) / DAY_MS) + 1,
  );
  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = addDaysKey(input.fromDate, offset);
    // El tope diario cuenta lo ya reservado; al confirmar se vuelve a comprobar.
    if (input.type.max_per_day !== null && (perDay.get(dateKey) ?? 0) >= input.type.max_per_day) continue;
    const todays = input.rules
      .filter((rule) => rule.weekday === isoWeekday(dateKey))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (const rule of todays) {
      const open = parseTime(rule.start_time);
      const close = parseTime(rule.end_time);
      const windowStart = localCampaignDateTimeToUtc(dateKey, input.timezone, open.hour, open.minute).getTime();
      const windowEnd = localCampaignDateTimeToUtc(dateKey, input.timezone, close.hour, close.minute).getTime();
      for (let start = windowStart; start + durationMs <= windowEnd; start += stepMs) {
        if (start < earliest || start > latest) continue;
        const end = start + occupiedMs;
        if (busy.some((range) => start < range.end && end > range.start)) continue;
        slots.push(new Date(start).toISOString());
      }
    }
  }
  return slots;
}

// --- .ics --------------------------------------------------------------------

function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Líneas de máximo 75 octetos; la continuación empieza con un espacio (RFC 5545). */
function fold(line: string) {
  const chunks: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut -= 1;
    chunks.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

export type IcsMeeting = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  location_url?: string | null;
  description?: string | null;
};

export function buildIcs(meeting: IcsMeeting, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//E-NORA//Reuniones//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@e-nora`,
    `DTSTAMP:${icsDate(now.toISOString())}`,
    `DTSTART:${icsDate(meeting.starts_at)}`,
    `DTEND:${icsDate(meeting.ends_at)}`,
    `SUMMARY:${icsText(meeting.title)}`,
    meeting.description ? `DESCRIPTION:${icsText(meeting.description)}` : "",
    meeting.location_url ? `LOCATION:${icsText(meeting.location_url)}` : "",
    meeting.location_url ? `URL:${meeting.location_url}` : "",
    `STATUS:${meeting.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

// --- Grabación de Fathom ↔ llamada programada --------------------------------

export type ScheduledCallCandidate = { id: string; scheduled_at: string; consultant_user_id: string | null };

/** Ventana en la que una grabación se considera de una llamada programada. */
export const RECORDING_MATCH_WINDOW_MINUTES = 120;

/**
 * La llamada programada a la que pertenece una grabación: la más cercana a la
 * hora de la grabación, dentro de la ventana, y del mismo consultor (o sin
 * consultor). Sin candidata devuelve null y el webhook crea una llamada nueva.
 */
export function pickScheduledCall(candidates: ScheduledCallCandidate[], recordedAt: string, consultantUserId: string | null) {
  const at = Date.parse(recordedAt);
  if (!Number.isFinite(at)) return null;
  let best: { id: string; distance: number } | null = null;
  for (const call of candidates) {
    if (call.consultant_user_id && consultantUserId && call.consultant_user_id !== consultantUserId) continue;
    const distance = Math.abs(Date.parse(call.scheduled_at) - at);
    if (!Number.isFinite(distance) || distance > RECORDING_MATCH_WINDOW_MINUTES * MINUTE_MS) continue;
    if (!best || distance < best.distance) best = { id: call.id, distance };
  }
  return best?.id ?? null;
}
