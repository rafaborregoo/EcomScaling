import { formatMoney } from "@/lib/money";
import { fmtNum } from "../dashboard/client-pulse-model";
import type { CampaignBudget, MetaAdSetRow, MetaCampaignListRow } from "./campaign-types";

export const PERIODS = [7, 30, 90, 365] as const;
export type Period = (typeof PERIODS)[number];

export type Tone = "good" | "warn" | "bad" | "acc" | undefined;

const STATE: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Activa", tone: "good" },
  PAUSED: { label: "En pausa", tone: undefined },
  ARCHIVED: { label: "Archivada", tone: undefined },
  DELETED: { label: "Eliminada", tone: undefined },
  PENDING_REVIEW: { label: "En revisión", tone: "warn" },
  DISAPPROVED: { label: "Rechazada", tone: "bad" },
  IN_PROCESS: { label: "En proceso", tone: "warn" },
};

export function campaignState(status: string | null) {
  return status ? STATE[status] ?? { label: status, tone: undefined } : { label: "Sin estado", tone: undefined };
}

export function money(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  return currency ? formatMoney(value, currency) : `${fmtNum(value, 2)} (moneda no informada)`;
}

export function roasText(value: number | null) {
  if (value == null) return "—";
  // 2 decimales, pero sin ceros de relleno: "2×", "3,2×", "1,45×".
  const text = fmtNum(value, 2).replace(/(,\d*?)0+$/, "$1").replace(/,$/, "");
  return `${text}×`;
}

export function budgetText(budget: CampaignBudget, currency: string | null) {
  if (!budget) return "Sin presupuesto informado";
  return `${money(budget.amount, currency)} ${budget.kind === "daily" ? "al día" : "de por vida"}`;
}

/** Aviso mas importante de una campaña para la esquina de su tarjeta. */
export function campaignAlert(row: MetaCampaignListRow, breakevenRoas: number | null): { text: string; tone: Tone } | null {
  if (row.rejected_ad_count > 0) return { text: row.rejected_ad_count === 1 ? "1 anuncio rechazado" : `${row.rejected_ad_count} anuncios rechazados`, tone: "bad" };
  if (row.learning_limited_ad_set_count > 0) return { text: "Aprendizaje limitado", tone: "warn" };
  if (row.effective_status === "ACTIVE" && breakevenRoas != null && row.roas != null && row.roas < breakevenRoas) return { text: "Bajo el equilibrio", tone: "bad" };
  if (row.learning_ad_set_count > 0) return { text: "Aprendiendo", tone: "acc" };
  return null;
}

const LEARNING_LABEL: Record<string, string> = {
  LEARNING: "Aprendiendo",
  LEARNING_LIMITED: "Limitado",
};

export function learningLabel(status: string | null) {
  if (!status) return "Sin aprendizaje activo";
  return LEARNING_LABEL[status] ?? status;
}

export function adSetAlert(row: MetaAdSetRow): { text: string; tone: Tone } | null {
  if (row.learning_stage_status === "LEARNING_LIMITED") return { text: "Limitado", tone: "warn" };
  if (row.learning_stage_status === "LEARNING") return { text: "Aprendiendo", tone: "acc" };
  return null;
}

export function campaignHref(id: string, organizationId: string, connectionId: string) {
  const params = new URLSearchParams({ organizationId });
  if (connectionId) params.set("connectionId", connectionId);
  return `/meta/campanas/${id}?${params.toString()}`;
}
