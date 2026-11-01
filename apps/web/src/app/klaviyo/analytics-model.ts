// Tipos y lógica pura de la pantalla /klaviyo. Sin React: lo que decide un
// color o una agrupación vive aquí para poder probarlo.

export type Tone = "good" | "warn" | "bad" | "";

export type Totals = {
  revenue: number;
  campaign_revenue: number;
  flow_revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  open_rate: number | null;
  click_rate: number | null;
  ctor: number | null;
  revenue_per_recipient: number | null;
  unsub_rate: number | null;
  bounce_rate: number | null;
  spam_rate: number | null;
};

export type Entity = {
  id: string;
  name: string;
  subject: string | null;
  trigger_type: string | null;
  revenue: number;
  recipients: number;
  open_rate: number | null;
  click_rate: number | null;
};

export type SubjectTrait = {
  trait: string;
  label: string;
  with_emails: number;
  without_emails: number;
  with_open_rate: number | null;
  without_open_rate: number | null;
  better: "con" | "sin" | null;
};

export type LinkClicks = {
  url: string;
  clicks: number;
  personas: number;
  mensajes: number;
};

export type EmailReport = {
  /** Moneda de la cuenta de Klaviyo; los importes vienen en ella, no en la de la tienda. */
  currency_code?: string | null;
  connected: boolean;
  totals: Totals;
  previous: Totals | null;
  trend: Array<{ month: string; campaign_revenue: number; flow_revenue: number }>;
  campaigns: Entity[];
  flows: Entity[];
  subject_traits?: SubjectTrait[] | null;
  top_links?: LinkClicks[] | null;
};

export type InventoryEmail = {
  source: "flow" | "campaign";
  parent_id: string;
  parent_name: string;
  parent_status: string | null;
  trigger_type: string | null;
  position_in_parent: number;
  message_id: string;
  subject: string | null;
  preview_text: string | null;
  body_chars: number | null;
  adds_utm: boolean;
};

export type Health = {
  emails_total: number;
  emails_sin_asunto: number;
  emails_sin_cuerpo: number;
  emails_sin_utm: number;
  emails_sin_seguimiento_clics: number;
  flujos_activos: number;
  listas: number;
  segmentos: number;
  metrica_conversion: string | null;
  ultimo_sync: string | null;
  recursos_no_traidos: string | null;
};

export type Insights = {
  connected: boolean;
  health: Health | null;
  emails: InventoryEmail[];
  unavailable: string[];
};

/** Apertura de un envío frente a la media del periodo, en puntos porcentuales. */
export function openTone(open: number | null, average: number | null): Tone {
  if (open == null || average == null) return "";
  const pp = (open - average) * 100;
  return pp >= 1 ? "good" : pp <= -3 ? "bad" : pp <= -1 ? "warn" : "";
}

export function clickTone(click: number | null, average: number | null): Tone {
  if (click == null || average == null) return "";
  const pp = (click - average) * 100;
  return pp >= 0.3 ? "good" : pp <= -0.8 ? "bad" : pp <= -0.3 ? "warn" : "";
}

// Tasas "malas" (cuanto más bajo mejor). Umbrales de referencia DTC: a partir de
// `warn` se vigila, a partir de `bad` los proveedores empiezan a mandar a spam.
export const DELIVERY_RATES = [
  { key: "unsub_rate", label: "Tasa de baja", warn: 0.003, bad: 0.005, digits: 2 },
  { key: "bounce_rate", label: "Tasa de rebote", warn: 0.02, bad: 0.04, digits: 1 },
  { key: "spam_rate", label: "Quejas de spam", warn: 0.0008, bad: 0.001, digits: 2 },
] as const;

export function rateState(value: number, warn: number, bad: number): Exclude<Tone, ""> {
  return value >= bad ? "bad" : value >= warn ? "warn" : "good";
}

/**
 * Zonas de la barra de una tasa: verde hasta `warn`, ámbar hasta `bad`, rojo
 * después. La escala llega a 1,6 × `bad` para que un valor fuera del límite
 * siga cabiendo; `marker` es la posición del valor, topada para no salirse.
 */
export function rateZones(value: number, warn: number, bad: number) {
  const max = bad * 1.6;
  const good = (warn / max) * 100;
  const amber = ((bad - warn) / max) * 100;
  return { good, amber, red: 100 - good - amber, marker: Math.min(value / max, 0.99) * 100 };
}

export type InventoryGroup = {
  key: string;
  source: "flow" | "campaign";
  name: string;
  status: string | null;
  trigger: string | null;
  emails: InventoryEmail[];
  sinUtm: number;
  sinCuerpo: number;
};

/** Un grupo por flujo y uno solo para todas las campañas, con sus problemas ya contados. */
export function groupInventory(emails: InventoryEmail[]): InventoryGroup[] {
  const groups = new Map<string, InventoryGroup>();
  for (const email of emails) {
    const key = email.source === "campaign" ? "campaigns" : `flow:${email.parent_id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        source: email.source,
        name: email.source === "campaign" ? "Campañas" : email.parent_name,
        status: email.source === "campaign" ? null : email.parent_status,
        trigger: email.source === "campaign" ? null : email.trigger_type,
        emails: [],
        sinUtm: 0,
        sinCuerpo: 0,
      };
      groups.set(key, group);
    }
    group.emails.push(email);
    if (!email.adds_utm) group.sinUtm += 1;
    if (!email.body_chars) group.sinCuerpo += 1;
  }
  for (const group of groups.values()) {
    group.emails.sort((a, b) => a.position_in_parent - b.position_in_parent);
  }
  // Flujos primero, campañas al final.
  return [...groups.values()].sort((a, b) => Number(a.source === "campaign") - Number(b.source === "campaign"));
}

/** Dominio + ruta, sin la query de UTMs: el enlace entero no cabe en una fila. */
export function linkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}
