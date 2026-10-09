"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { getViewAs } from "@/lib/view-as";
import { channelStyle } from "@/components/marketing-channel";
import { DiscussModal } from "@/components/discuss-modal";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { StatusStrip } from "@/components/trabajo-ui";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  Dialog,
  EmptyState,
  ErrorBlock,
  Field,
  Heading,
  Input,
  List,
  LoadingBlock,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { agendaSignal, sortAgenda } from "../agenda-signal";
import { groupByLocalDay, localDayKey } from "../calendar-days";

type CalendarItem = {
  id: string;
  calendar_id: string;
  title: string;
  description?: string | null;
  channel: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  store_id: string | null;
  task_id?: string | null;
  milestone_id?: string | null;
  blocked_reason?: string | null;
  marketing_draft_id?: string | null;
  outcome_verdict?: "worked" | "did_not_work" | "mixed" | null;
  outcome_reason?: string | null;
  outcome_decided_at?: string | null;
  metadata?: { client_suggestion?: { pending?: boolean } } | null;
};

/** Acción propuesta por el cliente que su consultor aún no ha aceptado. */
const isPendingSuggestion = (item: CalendarItem) =>
  Boolean(item.metadata?.client_suggestion?.pending);
type Planning = {
  calendars?: Array<{ id: string; name: string; year: number }>;
  items?: CalendarItem[];
  milestones?: Array<{
    id: string;
    name: string;
    status: string;
    target_date: string | null;
  }>;
};
/** Vistas de rejilla (una celda por día) y vistas de lista (por mes). */
type View = "week" | "month" | "quarter" | "half" | "year";
const GRID_VIEWS: View[] = ["week", "month"];

const CHANNELS = ["Email", "Meta", "Instagram", "Contenido", "Shopify", "Otro"];
const STATUSES = [
  { value: "planned", label: "Planificada" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
];

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};
const addMonths = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + amount);
  return result;
};
const monthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);
const monthEnd = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);
const mondayStart = (date: Date) => {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
};
const MONTHS_IN_VIEW: Record<View, number> = {
  week: 0,
  month: 1,
  quarter: 3,
  half: 6,
  year: 12,
};

/**
 * Alta y edición de una acción.
 *
 * Antes solo existía la edición: el calendario no sabía crear nada, así que la
 * única forma de que apareciera una acción era que la trajera el plan de A05.
 * Un calendario en el que no se puede apuntar algo no es un calendario.
 */
function ItemEditor({
  item,
  day,
  calendarId,
  organizationId,
  storeId,
  milestones,
  open,
  onOpenChange,
  onSaved,
  onArchive,
  canRecordVerdict,
  readOnly,
  onDiscuss,
}: {
  /** `null` = alta nueva. */
  item: CalendarItem | null;
  /** Día preseleccionado al crear desde una celda. */
  day: string | null;
  calendarId: string | null;
  organizationId: string;
  storeId: string | null;
  milestones: NonNullable<Planning["milestones"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  onArchive: (item: CalendarItem) => Promise<void>;
  canRecordVerdict: boolean;
  /** Cliente: ve la acción y escribe sobre ella; la agenda la lleva su consultor. */
  readOnly: boolean;
  onDiscuss: (item: CalendarItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("Email");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("planned");
  const [milestoneId, setMilestoneId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState("worked");
  const [verdictReason, setVerdictReason] = useState("");
  const [savingVerdict, setSavingVerdict] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setChannel(item?.channel ?? "Email");
    setDate(item ? localDayKey(new Date(item.starts_at)) : (day ?? ""));
    setStatus(item?.status ?? "planned");
    setMilestoneId(item?.milestone_id ?? "");
    setVerdict(item?.outcome_verdict ?? "worked");
    setVerdictReason(item?.outcome_reason ?? "");
    setError(null);
    setConfirmingArchive(false);
  }, [item, day, open]);

  // El aprendizaje se guarda junto con el resto de la acción («Guardar
  // cambios»): un diálogo, una sola forma de guardar.
  async function persistVerdict(): Promise<boolean> {
    if (!item || !organizationId) return false;
    setSavingVerdict(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/campaign-planning/items/${item.id}/verdict`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, reason: verdictReason.trim() }),
      });
      if (!response.ok) { setError(await readApiError(response)); return false; }
      return true;
    } catch {
      setError("No se pudo guardar el veredicto. Reintenta.");
      return false;
    } finally { setSavingVerdict(false); }
  }

  const verdictChanged = Boolean(
    canRecordVerdict &&
      item &&
      ["published", "completed"].includes(status) &&
      verdictReason.trim().length >= 8 &&
      (verdict !== (item.outcome_verdict ?? "worked") ||
        verdictReason.trim() !== (item.outcome_reason ?? "")),
  );

  async function acceptSuggestion() {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptSuggestion: true }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Propuesta aceptada");
      onOpenChange(false);
      await onSaved();
    } catch {
      setError("No se pudo aceptar la propuesta. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!title.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      // Mediodía local: una acción es de un día, no de un instante, y a las
      // 00:00 cualquier desfase de huso la manda al día anterior.
      const startsAt = new Date(`${date}T12:00:00`).toISOString();
      const response = item
        ? await apiFetch(
            `/v1/organizations/${organizationId}/campaign-planning/items/${item.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: title.trim(),
                channel,
                startsAt,
                status,
              }),
            },
          )
        : await apiFetch(
            `/v1/organizations/${organizationId}/campaign-planning/items`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                calendarId,
                title: title.trim(),
                channel,
                startsAt,
                status,
                storeId,
                milestoneId: milestoneId || null,
                createTask: Boolean(milestoneId),
              }),
            },
          );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      if (verdictChanged && !(await persistVerdict())) return;
      toast.success(
        item ? "Acción actualizada" : "Acción añadida al calendario",
      );
      onOpenChange(false);
      await onSaved();
    } catch {
      setError("No se pudo guardar por un error de red. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) {
    if (!item) return null;
    const signal = agendaSignal(item);
    const milestone = milestones.find((m) => m.id === item.milestone_id);
    return (
      <Dialog
        isOpen={open}
        onOpenChange={onOpenChange}
        eyebrow={item.channel}
        title={item.title}
        cancelLabel="Cerrar"
        primary={{ label: "Escribir sobre esto", onClick: () => onDiscuss(item) }}
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone={signal.tone}>
            {item.status === "completed" ? "Completada" : signal.label}
          </Badge>
          {isPendingSuggestion(item) ? <Badge tone="warn">Propuesta pendiente</Badge> : null}
        </div>
        <dl className="divide-y divide-line border-y border-line">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">Día</dt>
            <dd className="font-medium text-ink">
              {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date(item.starts_at))}
            </dd>
          </div>
          {milestone ? (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted">Hito</dt>
              <dd className="font-medium text-ink">{milestone.name}</dd>
            </div>
          ) : null}
          {item.blocked_reason ? (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted">Bloqueo</dt>
              <dd className="font-medium text-ink">{item.blocked_reason}</dd>
            </div>
          ) : null}
        </dl>
        {item.description ? <p className="text-muted">{item.description}</p> : null}
      </Dialog>
    );
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title={item ? "Editar acción" : "Nueva acción"}
      isBusy={saving || savingVerdict}
      isDirty={
        item
          ? title.trim() !== item.title ||
            channel !== item.channel ||
            date !== localDayKey(new Date(item.starts_at)) ||
            status !== item.status ||
            verdictChanged
          : Boolean(title.trim())
      }
      formId="calendar-item-form"
      // Archivar vive donde está la acción y se confirma en el propio pie, sin
      // abrir un segundo modal encima.
      start={
        item ? (
          confirmingArchive ? (
            <span className="text-[13px] font-medium text-ink">
              ¿Archivar esta acción? El histórico se conserva.
            </span>
          ) : (
            <Button variant="ghost" className="text-danger" disabled={saving} onClick={() => setConfirmingArchive(true)}>
              Archivar
            </Button>
          )
        ) : undefined
      }
      footer={
        confirmingArchive && item ? (
          <>
            <Button variant="ghost" onClick={() => setConfirmingArchive(false)}>
              Volver
            </Button>
            <Button variant="danger" onClick={() => void onArchive(item)}>
              Archivar
            </Button>
          </>
        ) : undefined
      }
      primary={{
        label: item ? "Guardar cambios" : "Añadir",
        busyLabel: "Guardando…",
        disabled: !title.trim() || !date,
      }}
    >
      <form
        id="calendar-item-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {item && isPendingSuggestion(item) ? (
          <Banner tone="warn">
            <span className="block">
              <strong>Propuesta del cliente.</strong>
              {item.description ? ` ${item.description}` : ""}
            </span>
            <span className="mt-2 block">
              <Button size="sm" onClick={acceptSuggestion} disabled={saving}>
                Aceptar propuesta
              </Button>
            </span>
          </Banner>
        ) : null}
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Canal">
            <Select
              aria-label="Canal de la acción"
              value={channel}
              onChange={setChannel}
              options={CHANNELS.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field label="Día">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
        {/* El estado solo tiene sentido sobre algo que ya existe: una
            acción nueva nace planificada. */}
        {item ? (
          <Field label="Estado">
            <Select aria-label="Estado de la acción" value={status} onChange={setStatus} options={STATUSES} />
          </Field>
        ) : null}
        {!item && milestones.length > 0 ? (
          <Field label="Hito de Mi Camino (opcional)">
            <Select
              aria-label="Hito de Mi Camino"
              value={milestoneId}
              onChange={setMilestoneId}
              options={[
                { value: "", label: "Sin vincular" },
                ...milestones.map((milestone) => ({
                  value: milestone.id,
                  label: `${milestone.name}${milestone.target_date ? ` · ${milestone.target_date}` : ""}`,
                })),
              ]}
            />
            {milestoneId ? (
              <p className="mt-1 text-xs text-muted">Se creará también una tarea enlazada a este hito.</p>
            ) : null}
          </Field>
        ) : null}
        {item?.milestone_id ? (
          <Badge tone="brand">
            Hito · {milestones.find((m) => m.id === item.milestone_id)?.name ?? "Mi Camino"}
          </Badge>
        ) : null}
        {item?.marketing_draft_id ? (
          <ButtonLink
            variant="secondary"
            href={`/marketing?draft=${encodeURIComponent(item.marketing_draft_id)}${storeId ? `&connectionId=${encodeURIComponent(storeId)}` : ""}`}
          >
            Abrir pieza creada
          </ButtonLink>
        ) : item?.channel && ["Email", "Meta", "Instagram"].includes(item.channel) ? (
          <ButtonLink
            variant="secondary"
            href={`/marketing?section=crear&campaignId=${encodeURIComponent(item.id)}${storeId ? `&connectionId=${encodeURIComponent(storeId)}` : ""}`}
          >
            {item.channel === "Email"
              ? "Preparar mailing con este brief"
              : item.channel === "Meta"
                ? "Preparar creativo Meta con este brief"
                : "Preparar publicación de Instagram con este brief"}
          </ButtonLink>
        ) : null}
        {canRecordVerdict && item && ["published", "completed"].includes(status) ? (
          <div className="space-y-4 border-t border-line pt-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Aprendizaje tras la ejecución</h3>
              <p className="mt-1 text-xs text-muted">Veredicto del consultor. No se deduce automáticamente de las métricas.</p>
            </div>
            <Field label="¿Cómo funcionó?">
              <Select
                value={verdict}
                onChange={setVerdict}
                options={[
                  { value: "worked", label: "Funcionó" },
                  { value: "did_not_work", label: "No funcionó" },
                  { value: "mixed", label: "Resultado mixto" },
                ]}
              />
            </Field>
            <Field label="Motivo y contexto (mínimo 8 caracteres)">
              <Textarea maxLength={2000} value={verdictReason} onChange={(event) => setVerdictReason(event.target.value)} />
            </Field>
            {item.outcome_decided_at ? (
              <p className="text-xs text-muted">Última revisión: {new Date(item.outcome_decided_at).toLocaleDateString("es-ES")}</p>
            ) : null}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}

/**
 * «Sugerir una acción»: el cliente con consultor no edita la agenda, pero puede
 * proponer. Entra marcada como propuesta hasta que el consultor la acepta.
 */
function SuggestModal({
  open,
  onOpenChange,
  calendarId,
  organizationId,
  storeId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  organizationId: string;
  storeId: string | null;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("Email");
  const [date, setDate] = useState("");
  const [why, setWhy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!title.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarId,
            title: title.trim(),
            description: why.trim() || null,
            channel,
            startsAt: new Date(`${date}T12:00:00`).toISOString(),
            storeId,
            clientSuggestion: true,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Propuesta enviada a tu consultor");
      setTitle("");
      setWhy("");
      setDate("");
      onOpenChange(false);
      await onSaved();
    } catch {
      setError("No se pudo enviar por un error de red. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title="Sugerir una acción"
      isBusy={saving}
      isDirty={Boolean(title.trim() || why.trim())}
      formId="calendar-suggest-form"
      primary={{
        label: "Enviar a mi consultor",
        busyLabel: "Enviando…",
        disabled: !title.trim() || !date,
      }}
    >
      <form
        id="calendar-suggest-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <Field label="Qué propones">
          <Input placeholder="Sorteo en Instagram por el aniversario" value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Canal">
            <Select aria-label="Canal" value={channel} onChange={setChannel} options={CHANNELS.map((value) => ({ value, label: value }))} />
          </Field>
          <Field label="Cuándo">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Por qué (opcional)">
          <Textarea maxLength={300} value={why} onChange={(event) => setWhy(event.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}

/** Chip de una acción dentro de una celda o de una lista. */
function ItemChip({
  item,
  onSelect,
}: {
  item: CalendarItem;
  onSelect: () => void;
}) {
  const style = channelStyle(item.channel);
  const signal = agendaSignal(item);
  const done = item.status === "completed";
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${item.title} · ${signal.label}`}
      className={`flex w-full items-center gap-1 px-2 py-1 text-left text-xs transition-colors hover:opacity-80 ${style.soft} ${
        done ? "line-through opacity-60" : ""
      }`}
    >
      <span aria-hidden className={`h-3 w-1 shrink-0 ${style.fill}`} />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {isPendingSuggestion(item) ? (
        <span className="shrink-0 text-[10px] font-semibold">Propuesta</span>
      ) : null}
      {item.milestone_id ? (
        <span className="shrink-0 text-[10px] font-medium">Camino</span>
      ) : null}
      {signal.state === "blocked" || signal.state === "overdue" ? (
        <span aria-label={signal.label} className="shrink-0 text-danger">
          ●
        </span>
      ) : null}
    </button>
  );
}

function CalendarContent({ isConsultant }: { isConsultant: boolean }) {
  const searchParams = useSearchParams();
  const focusDate = searchParams.get("date");
  const { organizationId } = useActiveOrganization();
  // Con consultor asignado la agenda la lleva él (la API lo exige); un cliente
  // sin consultor sigue llevando la suya.
  const { isAutonomous } = useAssignedConsultant(
    isConsultant ? null : organizationId || null,
  );
  const canEdit = isConsultant || isAutonomous;
  const { connectionId } = useActiveConnection();
  const [planning, setPlanning] = useState<Planning>({
    calendars: [],
    items: [],
    milestones: [],
  });
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discuss, setDiscuss] = useState<CalendarItem | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (!focusDate || !/^\d{4}-\d{2}-\d{2}$/.test(focusDate)) return;
    const date = new Date(`${focusDate}T12:00:00`);
    if (!Number.isNaN(date.getTime())) setCursor(startOfDay(date));
  }, [focusDate]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const scope = connectionId
        ? `?storeId=${encodeURIComponent(connectionId)}`
        : "";
      const [response, resourcesResponse] = await Promise.all([
        apiFetch(
          `/v1/organizations/${organizationId}/campaign-planning${scope}`,
        ),
        apiFetch(
          `/v1/organizations/${organizationId}/campaign-planning/resources`,
        ),
      ]);
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const calendar = (await response.json()) as Planning;
      const resources = resourcesResponse.ok
        ? ((await resourcesResponse.json()) as {
            milestones?: Planning["milestones"];
          })
        : {};
      setPlanning({
        ...calendar,
        milestones: resources.milestones ?? [],
      });
    } catch {
      setError("No se pudo cargar el calendario. Reintenta.");
    } finally {
      setLoading(false);
    }
  }, [connectionId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCalendar() {
    if (!organizationId) return;
    setCreating(true);
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/campaign-planning/calendars`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Calendario ${new Date().getFullYear()}`,
          year: new Date().getFullYear(),
          storeId: connectionId || null,
        }),
      },
    );
    setCreating(false);
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    await load();
  }

  async function archiveItem(item: CalendarItem) {
    if (!organizationId) return;
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/campaign-planning/items/${item.id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      toast.danger(await readApiError(response));
      return;
    }
    toast.success("Acción archivada");
    setSelected(null);
    setEditorOpen(false);
    await load();
  }

  // Una sola pasada por la lista, en hora local (ver calendar-days.ts).
  const itemsByDay = useMemo(
    () => groupByLocalDay(planning.items ?? []),
    [planning.items],
  );

  const gridDays = useMemo(() => {
    if (!GRID_VIEWS.includes(view)) return [];
    const start =
      view === "week" ? mondayStart(cursor) : mondayStart(monthStart(cursor));
    const total = view === "week" ? 7 : 42;
    return Array.from({ length: total }, (_, index) => addDays(start, index));
  }, [cursor, view]);

  /**
   * Vistas largas: antes pintaban una celda por día — 90, 180 o 365 casillas,
   * casi todas vacías, en una rejilla de tres columnas. Aquí se agrupa por mes
   * y solo salen los días que tienen algo.
   */
  const months = useMemo(() => {
    const count = MONTHS_IN_VIEW[view];
    if (GRID_VIEWS.includes(view) || count === 0) return [];
    const first =
      view === "year"
        ? new Date(cursor.getFullYear(), 0, 1)
        : monthStart(cursor);
    return Array.from({ length: count }, (_, index) => {
      const month = addMonths(first, index);
      const from = monthStart(month);
      const to = monthEnd(month);
      const items = sortAgenda(
        (planning.items ?? []).filter((item) => {
          const at = new Date(item.starts_at);
          return at >= from && at <= new Date(to.getTime() + 86_399_000);
        }),
      );
      return { month, items };
    });
  }, [cursor, view, planning.items]);

  const label =
    view === "year"
      ? String(cursor.getFullYear())
      : new Intl.DateTimeFormat("es-ES", {
          month: "long",
          year: "numeric",
        }).format(cursor);

  function move(amount: number) {
    if (view === "week") setCursor(addDays(cursor, amount * 7));
    else if (view === "year")
      setCursor(new Date(cursor.getFullYear() + amount, 0, 1));
    else setCursor(addMonths(cursor, amount * MONTHS_IN_VIEW[view]));
  }

  function openNew(day: string | null) {
    if (!canEdit) return;
    setSelected(null);
    setCreatingOn(day);
    setEditorOpen(true);
  }
  function openEdit(item: CalendarItem) {
    setSelected(item);
    setCreatingOn(null);
    setEditorOpen(true);
  }

  if (!organizationId)
    return (
      <Banner tone="warn">
        Selecciona una tienda en la barra superior para abrir la agenda.
      </Banner>
    );
  if (loading) return <LoadingBlock label="Cargando calendario…" />;

  const calendars = planning.calendars ?? [];
  const calendarId = calendars[0]?.id ?? null;
  const todayKey = localDayKey(new Date());
  const pending = sortAgenda(planning.items ?? []);
  const signals = pending.map((item) => agendaSignal(item).state);
  const count = (state: string) => signals.filter((st) => st === state).length;
  const weekStrip = [
    { value: signals.filter((st) => st === "today" || st === "soon").length, label: "Próximos 7 días" },
    { value: count("overdue"), label: "Vencidas", tone: count("overdue") ? ("bad" as const) : undefined },
    { value: count("blocked"), label: "Paradas", tone: count("blocked") ? ("warn" as const) : undefined },
    { value: pending.filter((item) => item.milestone_id).length, label: "Ligadas a Mi Camino" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Agenda</Heading>
          <p className="mt-1 text-sm text-muted">Todas las acciones fechadas de la tienda, incluidas las campañas de marketing.</p>
        </div>
        <ButtonLink
          variant="secondary"
          href={`/marketing?section=campanas${connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : ""}`}
        >
          Ver campañas de marketing
        </ButtonLink>
        {calendars.length ? (
          canEdit ? (
            <Button onClick={() => openNew(null)}>Nueva acción</Button>
          ) : (
            <Button onClick={() => setSuggesting(true)}>Sugerir una acción</Button>
          )
        ) : null}
      </div>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {calendars.length ? <StatusStrip items={weekStrip} /> : null}

      {!calendars.length ? (
        canEdit ? (
          <EmptyState
            title="Esta tienda aún no tiene agenda"
            action={
              <Button onClick={createCalendar} disabled={creating}>
                {creating ? "Creando…" : "Crear la agenda"}
              </Button>
            }
          />
        ) : (
          <EmptyState title="Tu consultor aún no ha preparado la agenda" />
        )
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => move(-1)}>
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCursor(startOfDay(new Date()))}
              >
                Hoy
              </Button>
              <Button size="sm" variant="secondary" onClick={() => move(1)}>
                Siguiente
              </Button>
              <span className="px-2 text-sm font-medium capitalize">
                {label}
              </span>
            </div>
            <Select
              className="w-40"
              aria-label="Horizonte del calendario"
              value={view}
              onChange={(value) => setView(value as View)}
              options={[
                { value: "week", label: "Semana" },
                { value: "month", label: "Mes" },
                { value: "quarter", label: "3 meses" },
                { value: "half", label: "6 meses" },
                { value: "year", label: "Año" },
              ]}
            />
          </div>

          {/* Siete columnas fijas: en movil la semana no cabe (celdas de ~42px)
              y aplanarla a una columna deja un mes de 42 filas. Scroll
              horizontal con ancho minimo: la forma de calendario se conserva. */}
          {GRID_VIEWS.includes(view) ? (
            <div className="mt-4 overflow-x-auto">
              <div className="grid min-w-[44rem] grid-cols-7 gap-px overflow-hidden border border-separator bg-separator sm:min-w-0">
                {gridDays.map((date) => {
                  const key = localDayKey(date);
                  const dayItems = itemsByDay.get(key) ?? [];
                  const outsideMonth =
                    view === "month" && date.getMonth() !== cursor.getMonth();
                  return (
                    <div
                      key={key}
                      className={`min-h-24 bg-white p-2 ${outsideMonth ? "opacity-45" : ""} ${
                        key === todayKey ? "ring-1 ring-inset ring-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          {new Intl.DateTimeFormat("es-ES", {
                            weekday: "short",
                            day: "numeric",
                          }).format(date)}
                        </span>
                        {/* Añadir en el día que se está mirando, sin volver a
                          teclear la fecha en el formulario. */}
                        {canEdit ? (
                        <button
                          type="button"
                          aria-label={`Añadir acción el ${key}`}
                          className="px-1 text-muted hover:text-accent"
                          onClick={() => openNew(key)}
                        >
                          +
                        </button>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayItems.map((item) => (
                          <ItemChip
                            key={item.id}
                            item={item}
                            onSelect={() => openEdit(item)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {months.map(({ month, items }) => (
                <div key={month.toISOString()}>
                  <h3 className="text-sm font-semibold capitalize text-foreground">
                    {new Intl.DateTimeFormat("es-ES", {
                      month: "long",
                      year: "numeric",
                    }).format(month)}
                  </h3>
                  {items.length === 0 ? (
                    <p className="mt-1 text-xs text-muted">Sin acciones.</p>
                  ) : (
                    <List as="ul">
                      {items.map((item) => {
                        const signal = agendaSignal(item);
                        const style = channelStyle(item.channel);
                        return (
                          <List.Item
                            as="li"
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 py-2"
                          >
                            <span
                              aria-hidden
                              className={`h-6 w-1 shrink-0 ${style.fill}`}
                            />
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent"
                            >
                              {item.title}
                            </button>
                            <span className="shrink-0 text-xs text-muted">
                              {new Intl.DateTimeFormat("es-ES", {
                                day: "numeric",
                                month: "short",
                              }).format(new Date(item.starts_at))}
                            </span>
                            <Badge tone={signal.tone}>{signal.label}</Badge>
                            {item.milestone_id ? (
                              <Badge tone="brand">Mi Camino</Badge>
                            ) : null}
                          </List.Item>
                        );
                      })}
                    </List>
                  )}
                </div>
              ))}
            </div>
          )}

          {(planning.items?.length ?? 0) === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="El calendario está vacío"
                hint={
                  canEdit
                    ? "Añade una acción, o pide un plan de campañas en Marketing y llévalo aquí."
                    : undefined
                }
              />
            </div>
          ) : null}
        </Card>
      )}

      <ItemEditor
                item={selected}
        day={creatingOn}
        calendarId={calendarId}
        organizationId={organizationId}
                storeId={connectionId || null}
        milestones={planning.milestones ?? []}
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setSelected(null);
            setCreatingOn(null);
          }
        }}
        onSaved={load}
        onArchive={archiveItem}
        canRecordVerdict={isConsultant}
        readOnly={!canEdit}
        onDiscuss={(item) => {
          setEditorOpen(false);
          setDiscuss(item);
        }}
      />
      {calendarId && !canEdit ? (
        <SuggestModal
          open={suggesting}
          onOpenChange={setSuggesting}
          calendarId={calendarId}
          organizationId={organizationId}
          storeId={connectionId || null}
          onSaved={load}
        />
      ) : null}
      <DiscussModal
        organizationId={organizationId}
        title={discuss?.title ?? null}
        draft={
          discuss
            ? `Hola, te escribo sobre la acción «${discuss.title}» del ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(new Date(discuss.starts_at))}. `
            : ""
        }
        viewerIsClient={!isConsultant}
        onClose={() => setDiscuss(null)}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <PortalShell title="Agenda">
      {(bootstrap) => <CalendarContent isConsultant={!getViewAs() && ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role)} />}
    </PortalShell>
  );
}
