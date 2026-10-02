import { formatMoney } from "@/lib/money";
import { fmtNum } from "../../dashboard/client-pulse-model";
import type { CatalogDiscount } from "../catalog-types";

export const PERIODS = [30, 90, 365] as const;
export type Period = (typeof PERIODS)[number];

export type PromoTone = "good" | "warn" | "bad" | "acc" | undefined;

const ENDING_DAYS = 7;
const NEAR_LIMIT = 0.8;
const DAY_MS = 24 * 60 * 60 * 1000;

export function discountState(status: string | null): { label: string; tone: PromoTone } {
  switch (status?.toUpperCase()) {
    case "ACTIVE": return { label: "Activa", tone: "good" };
    case "SCHEDULED": return { label: "Programada", tone: "warn" };
    case "EXPIRED": return { label: "Finalizada", tone: undefined };
    case "DISABLED": return { label: "Desactivada", tone: undefined };
    default: return { label: status || "Sin estado", tone: undefined };
  }
}

export function money(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  return currency ? formatMoney(value, currency) : `${fmtNum(value, 2)} (moneda no informada)`;
}

function isShipping(discount: CatalogDiscount) {
  return /ship/i.test(`${discount.discount_class ?? ""} ${discount.value_type ?? ""}`);
}

/** Beneficio en grande (cupon): lo que el cliente ve de un vistazo. */
export function benefitBig(discount: CatalogDiscount) {
  const type = discount.value_type?.toLowerCase() ?? "";
  if (discount.value != null && type.includes("percent")) return `−${fmtNum(discount.value, discount.value % 1 ? 1 : 0)} %`;
  if (discount.value != null && type.includes("fixed")) return `−${money(Math.abs(discount.value), discount.currency_code)}`;
  if (isShipping(discount)) return "Envío 0 €";
  if (/bxgy|buy/i.test(discount.discount_class ?? "")) return "Compra y llévate";
  if (/app/i.test(discount.discount_class ?? "") || discount.configuration_coverage === "app_managed") return "App";
  return "Descuento";
}

export function classLabel(discount: CatalogDiscount) {
  const raw = discount.discount_class ?? "";
  if (/percent/i.test(raw)) return "Porcentaje";
  if (/fixed/i.test(raw)) return "Importe fijo";
  if (/ship/i.test(raw)) return "Envío gratis";
  if (/bxgy|buy/i.test(raw)) return "Compra X y llévate Y";
  if (/app/i.test(raw)) return "Gestionada por una app";
  return raw || "Descuento";
}

export function daysFromNow(iso: string | null, now = Date.now()) {
  return iso ? Math.round((new Date(iso).getTime() - now) / DAY_MS) : null;
}

/** Avisos de una promocion; los mismos criterios que usa la API para el filtro. */
export function discountAlerts(discount: CatalogDiscount, now = Date.now()): Array<{ kind: "limit" | "ending" | "scheduled" | "app" | "idle"; text: string; tone: PromoTone }> {
  const out: Array<{ kind: "limit" | "ending" | "scheduled" | "app" | "idle"; text: string; tone: PromoTone }> = [];
  const active = discount.status?.toUpperCase() === "ACTIVE";
  if (active && discount.usage_limit && discount.usage_count / discount.usage_limit >= NEAR_LIMIT) {
    out.push({ kind: "limit", text: `${fmtNum((discount.usage_count / discount.usage_limit) * 100)} % del límite`, tone: "bad" });
  }
  const left = daysFromNow(discount.ends_at, now);
  if (active && left != null && left >= 0 && left <= ENDING_DAYS) {
    out.push({ kind: "ending", text: left <= 1 ? "Acaba hoy o mañana" : `Acaba en ${left} días`, tone: "warn" });
  }
  const until = daysFromNow(discount.starts_at, now);
  if (discount.status?.toUpperCase() === "SCHEDULED" && until != null) {
    out.push({ kind: "scheduled", text: until <= 0 ? "Empieza hoy" : `Empieza en ${until} días`, tone: "acc" });
  }
  if (active && discount.configuration_coverage === "app_managed") out.push({ kind: "app", text: "Regla no visible", tone: "warn" });
  if (active && discount.weekly_orders && discount.weekly_orders.slice(-4).every((value) => value === 0) && discount.metrics) {
    out.push({ kind: "idle", text: "Sin pedidos 4 sem.", tone: undefined });
  }
  return out;
}

export function usageText(discount: CatalogDiscount) {
  return `${fmtNum(discount.usage_count)}${discount.usage_limit == null ? "" : ` / ${fmtNum(discount.usage_limit)}`}`;
}

export function discountHref(id: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/shopify/promociones/${id}?${params.toString()}`;
}

export function shortDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : null;
}

export function validity(discount: CatalogDiscount) {
  if (discount.status?.toUpperCase() === "SCHEDULED" && discount.starts_at) return `desde ${shortDate(discount.starts_at)}`;
  return discount.ends_at ? `hasta ${shortDate(discount.ends_at)}` : "sin fecha de fin";
}
