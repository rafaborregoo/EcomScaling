import type { CampaignBrief, CampaignWorkState } from "@e-nora/contracts";
import type { CampaignRow } from "../campaign-rows";

/** Utilidades de presentación de la pantalla de Campañas. Sin estado, sin red. */

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «lun 5 oct». Sin fecha, «sin fecha». */
export function dayLabel(value: string | null | undefined) {
  if (!value) return "sin fecha";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return `${WEEKDAY[date.getDay()]} ${date.getDate()} ${MONTH[date.getMonth()]}`;
}

/** «lun 5 oct 10:00». */
export function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dayLabel(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** «hace 2 días», «hoy». Para cuándo se creó o se pidió revisión. */
export function agoLabel(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) return "";
  const days = Math.floor((nowMs - Date.parse(value)) / 86_400_000);
  if (!Number.isFinite(days) || days <= 0) return "hoy";
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export function dayParts(value: string | null | undefined) {
  if (!value) return { day: "—", mon: "" };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return { day: String(date.getDate()), mon: MONTH[date.getMonth()] ?? "" };
}

export const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export type Tone = "good" | "warn" | "bad" | "acc" | "meta" | undefined;

/** Estado de la campaña con la voz del CONSULTOR: dice lo que hay que hacer con ella. */
export const CONSULTANT_STATE: Record<CampaignWorkState, { label: string; tone: Tone; dot: string; cta: string }> = {
  late: { label: "Va tarde", tone: "bad", dot: "late", cta: "Resolver" },
  plan: { label: "Plan IA · por revisar", tone: "acc", dot: "plan", cta: "Revisar el plan" },
  nopiece: { label: "Sin pieza", tone: "warn", dot: "work", cta: "Escribir la pieza" },
  review: { label: "Pieza en revisión", tone: "warn", dot: "work", cta: "Abrir la campaña" },
  ready: { label: "Lista para programar", tone: "good", dot: "go", cta: "Revisar y programar" },
  scheduled: { label: "Programada en Klaviyo", tone: "good", dot: "go", cta: "Ver el envío" },
  sending: { label: "Enviándose", tone: "good", dot: "go", cta: "Ver el envío" },
  active: { label: "Activa en Meta", tone: "meta", dot: "meta", cta: "Ver en Meta" },
  paused: { label: "En pausa en Meta", tone: undefined, dot: "done", cta: "Ver en Meta" },
  sent: { label: "Enviada", tone: undefined, dot: "done", cta: "Ver resultados" },
  draft: { label: "Borrador", tone: undefined, dot: "done", cta: "Abrir el borrador" },
  cancelled: { label: "Cancelada", tone: "bad", dot: "done", cta: "Abrir" },
};

/**
 * Estado con la voz del CLIENTE. No ve «Plan IA» ni «Sin pieza»: ve lo que le
 * toca (aprobar) y lo que está en marcha. Con consultor, lo suyo lo está
 * revisando el consultor; sin consultor, lo escribe su asistente y lo aprueba él.
 */
export function clientState(
  row: Pick<CampaignRow, "state" | "item">,
  hasConsultant: boolean,
  approvedNow = false,
): { label: string; tone: Tone } {
  const origin = row.item?.origin;
  const review = row.item?.review_status ?? null;
  const own = origin === "client";
  if (hasConsultant && own && row.state !== "sent" && row.state !== "scheduled") {
    if (review === "changes_requested") return { label: "Tu consultor pide cambios", tone: "warn" };
    if (review === "pending") return { label: "Tu consultor la está revisando", tone: "warn" };
  }
  switch (row.state) {
    case "late":
      return { label: hasConsultant ? "Retrasada · se recoloca" : "Retrasada", tone: "bad" };
    case "review":
      return approvedNow ? { label: "Aprobada", tone: "good" } : { label: hasConsultant ? "Espera tu visto bueno" : "Borrador listo para aprobar", tone: hasConsultant ? "warn" : "acc" };
    case "ready":
      return { label: hasConsultant ? "Aprobada" : "Aprobada por ti", tone: "good" };
    case "scheduled":
    case "sending":
      return { label: "Programada", tone: "good" };
    case "sent":
      return { label: "Enviada", tone: undefined };
    case "active":
      return { label: "Activa en Meta", tone: "meta" };
    case "paused":
      return { label: "En pausa en Meta", tone: undefined };
    case "plan":
    case "nopiece":
      return { label: hasConsultant ? "En preparación" : "Tu asistente la escribe", tone: undefined };
    default:
      return { label: "Borrador", tone: undefined };
  }
}

/** La campaña como la entienden las reglas de `@e-nora/contracts`. */
export function rowToBrief(row: CampaignRow): CampaignBrief {
  return {
    id: row.item?.id ?? row.key,
    title: row.name,
    channel: row.channel,
    starts_at: row.date ?? "",
    state: row.state,
    origin: row.item?.origin ?? "staff",
    review_status: row.item?.review_status ?? null,
    store_id: row.item?.store_id ?? null,
    store_label: null,
  };
}

export const isMetaChannel = (channel: string) => /meta|instagram/i.test(channel);

/** Texto plano de un HTML de email, para comparar versiones sin enseñar etiquetas. */
export function plainText(html: string, max = 600) {
  const text = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Cuántos enlaces con destino tiene el HTML del email (los que no son de baja ni «#»). */
export function emailLinks(html: string) {
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1] ?? "");
  return links.filter((href) => /^https?:\/\//i.test(href) && !/unsubscribe|{{|%7B%7B/i.test(href));
}
