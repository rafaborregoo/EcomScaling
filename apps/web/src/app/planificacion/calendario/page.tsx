"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { channelStyle } from "@/components/marketing-channel";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  Input,
  List,
  LoadingBlock,
  Modal,
  Select,
  toast,
} from "@/components/ui";
import { agendaSignal, sortAgenda } from "../agenda-signal";
import { groupByLocalDay, localDayKey } from "../calendar-days";

type CalendarItem = {
  id: string;
  calendar_id: string;
  title: string;
  channel: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  store_id: string | null;
  blocked_reason?: string | null;
  marketing_draft_id?: string | null;
};
type Planning = {
  calendars?: Array<{ id: string; name: string; year: number }>;
  items?: CalendarItem[];
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
  open,
  onOpenChange,
  onSaved,
  onArchive,
}: {
  /** `null` = alta nueva. */
  item: CalendarItem | null;
  /** Día preseleccionado al crear desde una celda. */
  day: string | null;
  calendarId: string | null;
  organizationId: string;
  storeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  onArchive: (item: CalendarItem) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("Email");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("planned");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setChannel(item?.channel ?? "Email");
    setDate(item ? localDayKey(new Date(item.starts_at)) : (day ?? ""));
    setStatus(item?.status ?? "planned");
    setError(null);
  }, [item, day, open]);

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
              }),
            },
          );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(item ? "Acción actualizada" : "Acción añadida al calendario");
      onOpenChange(false);
      await onSaved();
    } catch {
      setError("No se pudo guardar por un error de red. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog aria-label={item ? "Editar acción" : "Nueva acción"}>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {item ? "Editar acción" : "Nueva acción"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                <Field label="Título">
                  <Input
                    className="mt-1"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <Field label="Canal">
                  <Select
                    className="mt-1"
                    aria-label="Canal de la acción"
                    value={channel}
                    onChange={setChannel}
                    options={CHANNELS.map((value) => ({ value, label: value }))}
                  />
                </Field>
                <Field label="Día">
                  <Input
                    className="mt-1"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
                {/* El estado solo tiene sentido sobre algo que ya existe: una
                    acción nueva nace planificada. */}
                {item ? (
                  <Field label="Estado">
                    <Select
                      className="mt-1"
                      aria-label="Estado de la acción"
                      value={status}
                      onChange={setStatus}
                      options={STATUSES}
                    />
                  </Field>
                ) : null}
              </div>
            </Modal.Body>
            <Modal.Footer>
              {/* Archivar vive donde está la acción que se archiva. Suelto en
                  la página, el botón aparecía debajo del calendario sin que se
                  viera a qué se refería. */}
              {item ? (
                <ConfirmDialog
                  title="Archivar la acción"
                  description={`"${item.title}" sale del calendario. El histórico se conserva.`}
                  confirmLabel="Archivar"
                  onConfirm={() => onArchive(item)}
                  trigger={
                    <Button variant="ghost" disabled={saving}>
                      Archivar
                    </Button>
                  }
                />
              ) : null}
              <Button onClick={save} disabled={saving || !title.trim() || !date}>
                {saving ? "Guardando…" : item ? "Guardar cambios" : "Añadir"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
      {signal.state === "blocked" || signal.state === "overdue" ? (
        <span aria-label={signal.label} className="shrink-0 text-danger">
          ●
        </span>
      ) : null}
    </button>
  );
}

function CalendarContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const consultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const [planning, setPlanning] = useState<Planning>({
    calendars: [],
    items: [],
  });
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning${connectionId ? `?storeId=${encodeURIComponent(connectionId)}` : ""}`,
      );
      if (response.ok) setPlanning((await response.json()) as Planning);
      else setError(await readApiError(response));
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
    const first = view === "year" ? new Date(cursor.getFullYear(), 0, 1) : monthStart(cursor);
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
    setSelected(null);
    setCreatingOn(day);
    setEditorOpen(true);
  }
  function openEdit(item: CalendarItem) {
    setSelected(item);
    setCreatingOn(null);
    setEditorOpen(true);
  }

  if (!consultant)
    return (
      <Card
        title="Calendario del consultor"
        description="Esta agenda es una herramienta interna del consultor."
      >
        <ButtonLink href="/dashboard">Volver al dashboard</ButtonLink>
      </Card>
    );
  if (!organizationId)
    return (
      <Banner tone="warn">
        Selecciona un cliente para abrir su calendario.
      </Banner>
    );
  if (loading) return <LoadingBlock label="Cargando calendario…" />;

  const calendars = planning.calendars ?? [];
  const calendarId = calendars[0]?.id ?? null;
  const todayKey = localDayKey(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={EYEBROW}>Planificación / calendario</p>
          <Heading>Calendario operativo</Heading>
          <p className="mt-1 text-sm text-muted">
            Organiza acciones por día y cambia el horizonte según la
            conversación con el cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/planificacion" variant="secondary">
            Resumen
          </ButtonLink>
          <ButtonLink href="/planificacion/tracking" variant="secondary">
            Tracking
          </ButtonLink>
        </div>
      </div>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {!calendars.length ? (
        <Card
          title="Crea el primer calendario"
          description="Las acciones necesitan un calendario para poder organizarse."
        >
          <Button onClick={createCalendar} disabled={creating}>
            {creating ? "Creando…" : "Crear calendario"}
          </Button>
        </Card>
      ) : (
        <Card
          title={calendars[0].name}
          description={`${planning.items?.length ?? 0} acciones en el alcance seleccionado.`}
          actions={<Button onClick={() => openNew(null)}>Nueva acción</Button>}
        >
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
                      <button
                        type="button"
                        aria-label={`Añadir acción el ${key}`}
                        className="px-1 text-muted hover:text-accent"
                        onClick={() => openNew(key)}
                      >
                        +
                      </button>
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
                  <p className={`${EYEBROW} capitalize`}>
                    {new Intl.DateTimeFormat("es-ES", {
                      month: "long",
                      year: "numeric",
                    }).format(month)}
                  </p>
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
                hint="Añade una acción, o pide un plan de campañas en Marketing y llévalo aquí."
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
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <PortalShell title="Calendario">
      {(bootstrap) => <CalendarContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
