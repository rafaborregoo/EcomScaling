import { fmtCurrency, fmtNum } from "../dashboard/client-pulse-model";
import type { KlaviyoEmailAlert, KlaviyoEmailListRow } from "./email-types";

export const PERIODS = [30, 90, 180, 365] as const;
export type Period = (typeof PERIODS)[number];

export function money(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  // Sin céntimos a partir de 100: "7.714 US$" se lee de un vistazo, "7714,30 US$" no.
  const decimals = Math.abs(value) >= 100 ? 0 : 2;
  return currency ? fmtCurrency(value, currency, decimals) : `${fmtNum(value, decimals)} (moneda no informada)`;
}

export function pct(value: number | null, digits = 1) {
  return value == null ? "—" : `${fmtNum(value * 100, digits)} %`;
}

export function kindLabel(kind: "campaign" | "flow") {
  return kind === "flow" ? "Flujo" : "Campaña";
}

export function alertTone(alert: KlaviyoEmailAlert): "warn" | "bad" | undefined {
  if (!alert) return undefined;
  return alert.kind === "low_open" ? "warn" : "bad";
}

export function emailHref(id: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/klaviyo/emails/${id}?${params.toString()}`;
}

export function sentLabel(row: Pick<KlaviyoEmailListRow, "kind" | "send_time" | "trigger_type"> & { recipients?: number }) {
  if (row.kind === "flow") return row.trigger_type ? `Se dispara: ${row.trigger_type}` : "Flujo activo";
  if (row.send_time) return `Enviada el ${new Date(row.send_time).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;
  return row.recipients ? "Enviada" : "Sin enviar";
}

export function periodLabel(days: Period) {
  return days === 365 ? "1 año" : days === 180 ? "6 meses" : `${days} días`;
}

/** Ruta legible de un enlace: sin dominio ni parámetros de seguimiento. */
export function linkLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.hostname : parsed.pathname;
  } catch {
    return url;
  }
}
