"use client";

import { useCachedQuery } from "@/lib/use-cached-query";
import type { Tone } from "@/components/ui";

/**
 * Lo que Marketing lee de Klaviyo en una sola llamada
 * (GET /v1/organizations/:id/marketing/klaviyo). Todos los importes son EUR
 * atribuidos por Klaviyo (ADR-0021): nunca se suman con Meta ni con Shopify.
 */

export type KStats = {
  revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  opens_unique: number;
  clicks_unique: number;
  unsubscribes: number;
};

export type KAudience = { id: string; name: string; kind: "list" | "segment" | "unknown"; size: number | null };

export type KCampaign = {
  id: string;
  external_id: string;
  name: string;
  status: string | null;
  send_time: string | null;
  channel: string;
  subject: string | null;
  preview_text: string | null;
  from_email: string | null;
  from_label: string | null;
  template_id: string | null;
  audiences: { included: KAudience[]; excluded: KAudience[] };
  stats: KStats | null;
};

export type KFlowNode = {
  id: string;
  kind: "email" | "sms" | "push" | "delay" | "split" | "update" | "webhook" | "end" | "other";
  label: string;
  subject?: string | null;
  template_id?: string | null;
  next?: string | null;
  yes?: string | null;
  no?: string | null;
};

export type KFlowGraph = {
  version: 1;
  entry: string | null;
  triggers: Array<{ type: string; label: string }>;
  nodes: KFlowNode[];
  truncated: boolean;
};

export type KFlowMessage = {
  action_id: string | null;
  message_id: string;
  template_id: string | null;
  name: string | null;
  subject: string | null;
  stats: KStats | null;
};

export type KFlow = {
  id: string;
  external_id: string;
  name: string;
  status: string | null;
  trigger_type: string | null;
  updated_at: string | null;
  graph: KFlowGraph | null;
  messages: KFlowMessage[];
  stats: KStats | null;
};

export type KSeriesPoint = { date: string; count: number };

export type KWorkspace = {
  connected: boolean;
  period: { days: number; start: string; end: string };
  store_sales: number;
  account?: {
    name: string | null;
    currency: string;
    timezone: string | null;
    default_from_email: string | null;
    default_from_label: string | null;
  };
  connection?: { status: string | null; last_sync_at: string | null; can_schedule: boolean };
  totals?: KStats;
  totals_flow?: KStats;
  totals_campaign?: KStats;
  previous?: KStats;
  daily?: Array<{ day: string; flow: number; campaign: number }>;
  campaigns?: KCampaign[];
  flows?: KFlow[];
  audiences?: {
    lists: Array<{ id: string; name: string; size: number | null; synced_at: string | null; double_opt_in: boolean; series: KSeriesPoint[]; used_in: number }>;
    segments: Array<{ id: string; name: string; size: number | null; synced_at: string | null; series: KSeriesPoint[]; used_in: number }>;
    forms: Array<{ id: string; name: string; status: string | null; stats: Record<string, number> | null; synced_at: string | null }>;
  };
  templates?: Array<{ id: string; name: string; editor_type: string | null; updated_at: string | null; has_html: boolean; used_in: string[] }>;
};

export function klaviyoWorkspaceKey(organizationId: string, days: number, connectionId: string | null) {
  const store = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  return `/v1/organizations/${organizationId}/marketing/klaviyo?days=${days}${store}`;
}

export function useKlaviyoWorkspace(organizationId: string, days: number, connectionId: string | null) {
  return useCachedQuery<KWorkspace>(organizationId ? klaviyoWorkspaceKey(organizationId, days, connectionId) : null);
}

/** Proporción segura (0 si no hay base). */
export function ratio(part: number | undefined, whole: number | undefined) {
  return whole && whole > 0 ? (part ?? 0) / whole : 0;
}

export function pct(value: number, digits = 1) {
  return `${(value * 100).toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}

export function int(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("es-ES");
}

/** Estado de una campaña de Klaviyo en palabras y color. */
export function klaviyoCampaignStatus(status: string | null): { key: "draft" | "scheduled" | "sending" | "sent" | "cancelled"; label: string; tone: Tone } {
  const value = (status ?? "").toLowerCase();
  if (value.includes("cancel")) return { key: "cancelled", label: "Cancelada", tone: "danger" };
  if (value.includes("scheduled") || value.includes("preparing to schedule")) return { key: "scheduled", label: "Programada en Klaviyo", tone: "success" };
  if (value.includes("sending") || value.includes("queued") || value.includes("adding") || value.includes("preparing")) return { key: "sending", label: "Enviándose", tone: "brand" };
  if (value.includes("sent")) return { key: "sent", label: "Enviada", tone: "neutral" };
  return { key: "draft", label: "Borrador en Klaviyo", tone: "neutral" };
}

export function flowStatus(status: string | null): { key: "live" | "draft" | "manual"; label: string; tone: Tone } {
  const value = (status ?? "").toLowerCase();
  if (value === "live") return { key: "live", label: "Activo", tone: "success" };
  if (value === "manual") return { key: "manual", label: "Manual", tone: "neutral" };
  return { key: "draft", label: "Borrador", tone: "warn" };
}

/**
 * Tipo de flow por nombre o disparador, para saber cuáles clave faltan o están
 * parados. ponytail: heurística por palabras (es/en); si un cliente nombra
 * raro sus flows, sale como "otro" y no se avisa. Mejorar con el disparador
 * métrico real (Started Checkout, Placed Order) cuando lo expongamos.
 */
export const KEY_FLOWS = [
  { key: "welcome", label: "Bienvenida", words: ["bienvenid", "welcome"], why: "El primer email después de apuntarse es el que más se abre." },
  { key: "cart", label: "Carrito abandonado", words: ["carrito", "checkout", "cart"], why: "Recupera pedidos que ya estaban casi hechos." },
  { key: "browse", label: "Navegación abandonada", words: ["navegaci", "browse", "producto visto", "viewed"], why: "Vuelve a traer a quien miró un producto y se fue." },
  { key: "post", label: "Post-compra", words: ["post", "después de comprar", "thank", "gracias"], why: "Prepara la segunda compra y pide reseñas." },
  { key: "winback", label: "Recuperación de clientes", words: ["recupera", "winback", "win-back", "win back", "te echamos"], why: "Reactiva a quien lleva meses sin comprar." },
] as const;

export function flowKind(flow: Pick<KFlow, "name">) {
  const name = flow.name.toLowerCase();
  return KEY_FLOWS.find((kind) => kind.words.some((word) => name.includes(word)))?.key ?? null;
}
