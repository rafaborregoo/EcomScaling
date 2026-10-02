import { formatMoney } from "@/lib/money";
import { fmtNum } from "../dashboard/client-pulse-model";
import type { KlaviyoEmailAlert, KlaviyoEmailListRow } from "./email-types";

export const PERIODS = [30, 90, 180, 365] as const;
export type Period = (typeof PERIODS)[number];

export function money(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  return currency ? formatMoney(value, currency) : `${fmtNum(value, 2)} (moneda no informada)`;
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

export function sentLabel(row: Pick<KlaviyoEmailListRow, "kind" | "send_time" | "trigger_type">) {
  if (row.kind === "flow") return row.trigger_type ? `Se dispara: ${row.trigger_type}` : "Flujo activo";
  return row.send_time ? new Date(row.send_time).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "Sin enviar";
}
