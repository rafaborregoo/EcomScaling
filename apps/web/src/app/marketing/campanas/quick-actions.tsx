"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import type { CampaignRow } from "../campaign-rows";
import { createClientCampaign, send } from "./campaign-api";
import { cx } from "./campaign-format";
import { Btn, Chip, Section, css as s } from "./campanas-parts";

/**
 * Acciones rápidas de Campañas: campañas que se repiten, a un clic.
 *
 * `plan` crea la campaña en el calendario con su canal, audiencia, fecha y
 * brief ya puestos; `ia` la crea igual y abre Crear para que la IA escriba la
 * pieza. Si la usa el cliente, la campaña entra en revisión del consultor por
 * la ruta de siempre. El CRUD vive en `quick-actions-manager.tsx`.
 */

export type QuickAction = {
  id: string;
  visibility: "me" | "client" | "shared";
  name: string;
  icon: IconKey;
  kind: "plan" | "ia";
  channel: "email" | "meta";
  audience: string;
  when_kind: "dow" | "off";
  dow: number;
  offset_days: number;
  brief: string;
  position: number;
  mine: boolean;
};

export type QuickActionDraft = Omit<QuickAction, "id" | "position" | "mine"> & { id: string | null };

export const BAR_LIMIT = 8;
const DAY_MS = 86_400_000;
const DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const ICONS = [
  { key: "mail", label: "Email", path: "M3 6h18v12H3z M3 7l9 6 9-6" },
  { key: "repeat", label: "Segundo envío", path: "M4 12a8 8 0 0 1 14-5l2 2 M20 4v5h-5 M20 12a8 8 0 0 1-14 5l-2-2 M4 20v-5h5" },
  { key: "cart", label: "Carrito", path: "M3 4h2l2.4 11h10.2L20 8H6.2 M9 20h.01 M17 20h.01" },
  { key: "bell", label: "Aviso", path: "M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7 M10 20h4" },
  { key: "tag", label: "Oferta", path: "M3 12V4h8l10 10-8 8z M7.5 8.5h.01" },
  { key: "mega", label: "Anuncio", path: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z M15 9a4 4 0 0 1 0 6 M18 6.5a8 8 0 0 1 0 11" },
  { key: "spark", label: "IA", path: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" },
] as const;
export type IconKey = (typeof ICONS)[number]["key"];

export const VISIBILITY = [
  { key: "me", label: "Solo yo", text: "En todos mis clientes. Nadie más la ve.", scope: "Mía", tone: undefined },
  { key: "client", label: "Este cliente", text: "Yo y mi equipo, solo en este cliente.", scope: "Este cliente", tone: "good" },
  { key: "shared", label: "Compartida con el cliente", text: "El cliente la ve como un atajo para pedirme algo.", scope: "Compartida", tone: "acc" },
] as const;

export const iconPath = (key: string) => (ICONS.find((icon) => icon.key === key) ?? ICONS[0]).path;
export const scopeOf = (visibility: string) => VISIBILITY.find((entry) => entry.key === visibility) ?? VISIBILITY[0];
export const toneOf = (action: Pick<QuickAction, "kind" | "channel">) =>
  action.kind === "ia" ? s.ia : action.channel === "meta" ? s.meta : "";

export const whenLabel = (action: Pick<QuickAction, "when_kind" | "dow" | "offset_days">) =>
  action.when_kind === "dow"
    ? `${DOW[action.dow]} 10:00`
    : action.offset_days === 0
      ? "hoy"
      : action.offset_days === 1
        ? "mañana"
        : `en ${action.offset_days} días`;

export const describe = (action: Pick<QuickAction, "kind" | "channel" | "audience" | "when_kind" | "dow" | "offset_days">) =>
  action.kind === "ia"
    ? "Crea la campaña y abre Crear con el brief"
    : `${action.channel === "meta" ? "Meta Ads" : "Email"} · ${whenLabel(action)} · ${action.audience}`;

export const dowName = (dow: number) => DOW[dow] ?? "";

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Fecha de la campaña: hoy + N días, o el primer día de la semana pedido que aún no tenga una igual. */
export function nextDate(action: QuickAction, rows: CampaignRow[], now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (action.when_kind === "off") return new Date(today.getTime() + action.offset_days * DAY_MS);
  const taken = new Set(
    rows.filter((row) => row.name === action.name && row.date).map((row) => dayKey(new Date(row.date as string))),
  );
  for (let ahead = 1; ahead <= 120; ahead += 1) {
    const day = new Date(today.getTime() + ahead * DAY_MS);
    if (day.getDay() === action.dow && !taken.has(dayKey(day))) return day;
  }
  return new Date(today.getTime() + 7 * DAY_MS);
}

const listPath = (organizationId: string) => `/v1/organizations/${organizationId}/campaign-quick-actions`;

export function useQuickActions(organizationId: string | null) {
  const query = useCachedQuery<{ actions: QuickAction[] }>(organizationId ? listPath(organizationId) : null);
  return { ...query, actions: query.data?.actions ?? [] };
}

const refresh = (organizationId: string) => invalidateCachedQueries(listPath(organizationId));

const body = (draft: Omit<QuickActionDraft, "id">) => ({
  visibility: draft.visibility,
  name: draft.name,
  icon: draft.icon,
  kind: draft.kind,
  channel: draft.channel,
  audience: draft.audience,
  whenKind: draft.when_kind,
  dow: draft.dow,
  offsetDays: draft.offset_days,
  brief: draft.brief,
});

export async function saveQuickAction(organizationId: string, draft: QuickActionDraft) {
  const result = draft.id
    ? await send<QuickAction>(`${listPath(organizationId)}/${draft.id}`, "PATCH", body(draft))
    : await send<QuickAction>(listPath(organizationId), "POST", body(draft));
  refresh(organizationId);
  return result;
}

export async function removeQuickAction(organizationId: string, id: string) {
  const result = await send(`${listPath(organizationId)}/${id}`, "DELETE");
  refresh(organizationId);
  return result;
}

export async function reorderQuickActions(organizationId: string, ids: string[]) {
  const result = await send(`${listPath(organizationId)}/order`, "PUT", { ids });
  refresh(organizationId);
  return result;
}

/**
 * Crea la campaña de una acción. `ia` además abre Crear con la pieza por
 * escribir. Devuelve el id para que quien llama decida qué hacer después.
 */
async function runQuickAction(
  organizationId: string,
  action: QuickAction,
  rows: CampaignRow[],
  storeId: string | null,
) {
  const date = nextDate(action, rows);
  const description = [`Para: ${action.audience}`, action.brief || null].filter(Boolean).join("\n\n");
  const startsAt = new Date(`${dayKey(date)}T10:00:00`).toISOString();
  return createClientCampaign(organizationId, {
    title: action.name,
    channel: action.channel === "meta" ? "Meta" : "Email",
    startsAt,
    description,
    storeId,
  });
}

export function QuickActionsBar({
  organizationId,
  rows,
  storeId,
  mode,
  hasConsultant = true,
  onOpenManager,
  onChanged,
  onWriteWithAi,
}: {
  organizationId: string;
  rows: CampaignRow[];
  storeId: string | null;
  /** consultant: las suyas + gestionar; client: solo las compartidas. */
  mode: "consultant" | "client";
  hasConsultant?: boolean;
  onOpenManager?: () => void;
  onChanged: () => void;
  onWriteWithAi: (itemId: string) => void;
}) {
  const { actions, isLoading, error } = useQuickActions(organizationId);
  const [busy, setBusy] = useState<string | null>(null);
  const staff = mode === "consultant";
  const shown = actions.slice(0, BAR_LIMIT);

  if (!staff && !isLoading && !error && shown.length === 0) return null;

  async function run(action: QuickAction) {
    setBusy(action.id);
    const result = await runQuickAction(organizationId, action, rows, storeId);
    setBusy(null);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    onChanged();
    if (action.kind === "ia" && action.channel === "email") onWriteWithAi(result.data.id);
    else
      toast.success(
        staff
          ? `«${action.name}» ya está en el calendario.`
          : hasConsultant
            ? `Encargo enviado: «${action.name}» ya está en tu calendario y tu consultor lo revisará.`
            : `«${action.name}» ya está en tu calendario.`,
      );
  }

  return (
    <Section
      id="acciones-rapidas"
      title={staff ? "Acciones rápidas" : hasConsultant ? "Pídele algo a tu consultor" : "Atajos para tu asistente"}
      lead={
        staff
          ? "Lo que repites cada semana, a un clic. Cada una crea la campaña en el calendario con su canal, audiencia, fecha y brief ya puestos."
          : "Atajos preparados para lo que más se repite. Al pulsar uno, la campaña aparece en tu calendario."
      }
      action={
        staff && onOpenManager ? (
          <Btn variant="ghost" onClick={onOpenManager}>
            Gestionar
          </Btn>
        ) : undefined
      }
    >
      <div className={s.qa}>
        {shown.map((action) => {
          const scope = scopeOf(action.visibility);
          return (
            <button
              key={action.id}
              type="button"
              className={s.qaTile}
              disabled={busy !== null}
              onClick={() => void run(action)}
            >
              <span className={cx(s.qaIc, toneOf(action))}>
                <Icon path={iconPath(action.icon)} />
              </span>
              <span className={s.qaT}>{action.name}</span>
              <span className={s.qaD}>{describe(action)}</span>
              <span className={s.qaF}>
                {staff ? <Chip tone={scope.tone}>{scope.scope}</Chip> : <span />}
                <span>{busy === action.id ? "Creando…" : action.kind === "ia" ? "Con IA" : "Un clic"}</span>
              </span>
            </button>
          );
        })}
        {staff && onOpenManager ? (
          <button type="button" className={cx(s.qaTile, s.add)} onClick={onOpenManager}>
            <span className={s.qaIc}>
              <Icon path="M12 5v14 M5 12h14" />
            </span>
            <span className={s.qaT}>Nueva acción rápida</span>
            <span className={s.qaD}>Guarda una campaña que repites para crearla de un clic.</span>
          </button>
        ) : null}
      </div>
    </Section>
  );
}

export function Icon({ path, size }: { path: string; size?: number }) {
  return (
    <svg className={s.ic} viewBox="0 0 24 24" style={size ? { width: size, height: size } : undefined} aria-hidden>
      <path d={path} />
    </svg>
  );
}
