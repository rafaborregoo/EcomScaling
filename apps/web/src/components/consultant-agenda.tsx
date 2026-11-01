"use client";

import { ButtonGroup } from "@/components/ui/button-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import {
  addDays,
  addMonths,
  dayKey,
  mondayStart,
  monthStart,
  startOfDay,
} from "@/lib/calendar-dates";
import {
  Button,
  EmptyState,
  ErrorBlock,
  IconChevronLeft,
  IconChevronRight,
  Link,
  LoadingBlock,
  Select,
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui";

type AgendaTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string;
  organization_id: string;
  organization_name: string;
  source: string;
  is_visible_to_client: boolean;
};
type AgendaPlanningItem = {
  id: string;
  title: string;
  channel: string;
  item_type: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  organization_id: string;
  organization_name: string;
};
type AgendaMilestone = {
  id: string;
  name: string;
  target_date: string;
  status: string;
  organization_id: string;
  organization_name: string;
  phase_name: string | null;
};
type AgendaResponse = {
  from: string;
  to: string;
  scope: string;
  tasks: AgendaTask[];
  planning_items: AgendaPlanningItem[];
  milestones: AgendaMilestone[];
};

type ClientOption = { organization_id: string; display_name: string };

type View = "day" | "week" | "month";

type Entry = {
  id: string;
  kind: "task" | "planning" | "milestone";
  day: string;
  time: string | null;
  sortAt: number;
  title: string;
  orgId: string;
  orgName: string;
  tone: "danger" | "warn" | "accent" | "muted";
  href: string;
};

const VIEW_LABEL: Record<View, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

const LS = {
  view: "ecomscaling.agenda.view",
  scope: "ecomscaling.agenda.scope",
  milestones: "ecomscaling.agenda.showMilestones",
};

function readLs(key: string): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLs(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* modo privado / storage bloqueado: la preferencia no persiste, sin más. */
  }
}

const chipClass = (active: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-10 ${
    active ? "border-accent/30 bg-accent/10 text-accent" : "border-separator bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
  }`;

const toneClass: Record<Entry["tone"], string> = {
  danger: "border border-danger/30 bg-danger/5",
  warn: "border border-warn/30 bg-warn/5",
  accent: "border border-accent/30 bg-accent/5",
  muted: "border border-separator bg-surface",
};

function windowFor(view: View, cursor: Date): { from: Date; to: Date } {
  if (view === "day") {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1) };
  }
  if (view === "week") {
    const from = mondayStart(cursor);
    return { from, to: addDays(from, 7) };
  }
  const from = mondayStart(monthStart(cursor));
  return { from, to: addDays(from, 42) };
}

function taskTone(task: AgendaTask, now: number): Entry["tone"] {
  const overdue =
    ["pending", "in_progress"].includes(task.status) &&
    Date.parse(task.due_at) < now;
  if (overdue) return "danger";
  if (["urgent", "high"].includes(task.priority)) return "warn";
  return "muted";
}

function buildEntries(
  data: AgendaResponse,
  showMilestones: boolean,
): Map<string, Entry[]> {
  const now = Date.now();
  const entries: Entry[] = [];

  for (const task of data.tasks) {
    const at = new Date(task.due_at);
    // Un plazo guardado a medianoche UTC es una fecha sin hora: no se pinta una hora inventada.
    const dateOnly = at.getUTCHours() === 0 && at.getUTCMinutes() === 0;
    entries.push({
      id: `task:${task.id}`,
      kind: "task",
      day: dayKey(at),
      time: dateOnly
        ? null
        : at.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      sortAt: at.getTime(),
      title: task.title,
      orgId: task.organization_id,
      orgName: task.organization_name,
      tone: taskTone(task, now),
      href: "/tareas",
    });
  }

  for (const item of data.planning_items) {
    const at = new Date(item.starts_at);
    entries.push({
      id: `planning:${item.id}`,
      kind: "planning",
      day: dayKey(at),
      time: at.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      sortAt: at.getTime(),
      title: `${item.channel} · ${item.title}`,
      orgId: item.organization_id,
      orgName: item.organization_name,
      tone: "accent",
      href: "/planificacion/calendario",
    });
  }

  if (showMilestones) {
    for (const milestone of data.milestones) {
      // target_date es DATE (sin hora): tratar como día completo.
      const at = new Date(`${milestone.target_date}T00:00:00`);
      entries.push({
        id: `milestone:${milestone.id}`,
        kind: "milestone",
        day: dayKey(at),
        time: null,
        sortAt: at.getTime(),
        title: milestone.phase_name
          ? `Hito · ${milestone.name} (${milestone.phase_name})`
          : `Hito · ${milestone.name}`,
        orgId: milestone.organization_id,
        orgName: milestone.organization_name,
        tone: "muted",
        href: "/camino",
      });
    }
  }

  entries.sort((a, b) => a.sortAt - b.sortAt);
  const byDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
  }
  return byDay;
}

function EntryRow({
  entry,
  showOrg,
  onSelectClient,
}: {
  entry: Entry;
  showOrg: boolean;
  onSelectClient?: (organizationId: string) => void;
}) {
  return (
    <Link
      href={entry.href}
      onClick={() => onSelectClient?.(entry.orgId)}
      className={`block min-h-11 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${toneClass[entry.tone]}`}
    >
      <span className="flex items-baseline gap-1">
        {entry.time ? (
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {entry.time}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 break-words">{entry.title}</span>
      </span>
      {showOrg ? (
        <span className="mt-0.5 block truncate text-xs text-muted">
          {entry.orgName}
        </span>
      ) : null}
    </Link>
  );
}

export function ConsultantAgenda({
  embedded = false,
  clients,
  onSelectClient,
  fixedScope,
}: {
  embedded?: boolean;
  clients?: ClientOption[];
  onSelectClient?: (organizationId: string) => void;
  // Alcance fijo (dashboard de un cliente concreto): oculta el selector.
  fixedScope?: string;
}) {
  const [view, setView] = useState<View>(
    () => (readLs(LS.view) as View | null) ?? "week",
  );
  const [scopeState, setScope] = useState<string>(
    () => readLs(LS.scope) ?? "all",
  );
  const scope = fixedScope ?? scopeState;
  const [showMilestones, setShowMilestones] = useState<boolean>(
    () => readLs(LS.milestones) !== "0",
  );
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [fetchedClients, setFetchedClients] = useState<ClientOption[]>([]);
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientOptions = clients ?? fetchedClients;

  useEffect(() => {
    writeLs(LS.view, view);
  }, [view]);
  useEffect(() => {
    writeLs(LS.scope, scopeState);
  }, [scopeState]);
  useEffect(() => {
    writeLs(LS.milestones, showMilestones ? "1" : "0");
  }, [showMilestones]);

  // Lista de clientes para el selector de alcance (solo si no llega por props
  // y hay selector que rellenar).
  useEffect(() => {
    if (clients || fixedScope) return;
    let cancelled = false;
    apiFetch("/v1/consultant/organizations")
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const payload = (await res.json()) as {
          organizations?: Array<{ id: string; display_name: string }>;
        };
        setFetchedClients(
          (payload.organizations ?? []).map((org) => ({
            organization_id: org.id,
            display_name: org.display_name,
          })),
        );
      })
      .catch(() => {
        /* el selector se queda con consultor / todas las tiendas */
      });
    return () => {
      cancelled = true;
    };
  }, [clients, fixedScope]);

  const { from, to } = useMemo(() => windowFor(view, cursor), [view, cursor]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const qs = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(
      to.toISOString(),
    )}&scope=${encodeURIComponent(scope)}`;
    apiFetch(`/v1/consultant/agenda?${qs}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("No se pudo cargar la agenda.");
          setData(null);
          return;
        }
        setData((await res.json()) as AgendaResponse);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar la agenda por un error de red.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, scope]);

  const byDay = useMemo(
    () =>
      data ? buildEntries(data, showMilestones) : new Map<string, Entry[]>(),
    [data, showMilestones],
  );
  const showOrg = scope === "all" || scope === "own";

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let date = from; date < to; date = addDays(date, 1)) {
      result.push(new Date(date));
    }
    return result;
  }, [from, to]);

  function move(amount: number) {
    setCursor((current) =>
      view === "day"
        ? addDays(current, amount)
        : view === "week"
          ? addDays(current, amount * 7)
          : addMonths(current, amount),
    );
  }

  const rangeLabelRaw =
    view === "month"
      ? new Intl.DateTimeFormat("es-ES", {
          month: "long",
          year: "numeric",
        }).format(cursor)
      : `${from.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        })} – ${addDays(to, -1).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        })}`;

  const rangeLabel = rangeLabelRaw.charAt(0).toUpperCase() + rangeLabelRaw.slice(1);

  const totalEntries = [...byDay.values()].reduce(
    (sum, list) => sum + list.length,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardAction><div className="flex flex-wrap items-center gap-3">
          <ToggleGroup aria-label="Vista de la agenda" value={view} onValueChange={setView}>
            {(["day", "week", "month"] as View[]).map((option) => (
              <ToggleGroupItem key={option} value={option}>
                {VIEW_LABEL[option]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="text-separator" aria-hidden>
            |
          </span>
          <button
            type="button"
            className={chipClass(showMilestones)}
            aria-pressed={showMilestones}
            onClick={() => setShowMilestones((value) => !value)}
          >
            Hitos de Mi Camino
          </button>
        </div></CardAction>
      </CardHeader>
      <CardContent>
        {/* Alcance (oculto cuando la agenda ya está fijada a una tienda) */}
        {fixedScope ? null : (
          <div className="mb-3">
            <Select
              bare
              aria-label="Alcance de la agenda"
              value={scope}
              onChange={(value) => setScope(value || "all")}
              options={[
                { value: "own", label: "Mi calendario" },
                { value: "all", label: "Todas las tiendas" },
                ...clientOptions.map((client) => ({
                  value: client.organization_id,
                  label: client.display_name,
                  section: "Clientes",
                })),
              ]}
            />
          </div>
        )}

        {/* Navegación */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-separator pb-3">
          <ButtonGroup aria-label="Navegacion de la agenda">
            <Button size="sm" variant="outline" onClick={() => move(-1)}>
              <IconChevronLeft aria-hidden className="sm:hidden" />
              <span className="sr-only sm:not-sr-only">Anterior</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCursor(startOfDay(new Date()))}
            >
              Hoy
            </Button>
            <Button size="sm" variant="outline" onClick={() => move(1)}>
              <IconChevronRight aria-hidden className="sm:hidden" />
              <span className="sr-only sm:not-sr-only">Siguiente</span>
            </Button>
          </ButtonGroup>
          <span className="text-sm font-medium">{rangeLabel}</span>
        </div>

        {error ? (
          <ErrorBlock>{error}</ErrorBlock>
        ) : isLoading && !data ? (
          <LoadingBlock label="Cargando agenda..." />
        ) : totalEntries === 0 ? (
          <EmptyState size="sm" title={`Nada agendado en ${view === "month" ? "este mes" : "este rango"}`} />
        ) : view === "day" ? (
          <div className="space-y-1">
            {(byDay.get(dayKey(from)) ?? []).map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                showOrg={showOrg}
                onSelectClient={onSelectClient}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Móvil y tablet estrecha (<768px): una rejilla de 7 columnas es
                ilegible. Se lista solo lo que tiene algo, agrupado por día. */}
            <div className="space-y-3 md:hidden">
              {days
                .map((date) => ({ date, entries: byDay.get(dayKey(date)) ?? [] }))
                .filter(({ entries }) => entries.length > 0)
                .map(({ date, entries }) => (
                  <div key={dayKey(date)}>
                    <p
                      className={`mb-1 text-xs font-medium ${
                      dayKey(date) === dayKey(startOfDay(new Date()))
                        ? "text-accent"
                        : "text-muted"
                    }`}
                    >
                      {date.toLocaleDateString("es-ES", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <div className="space-y-1">
                      {entries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          showOrg={showOrg}
                          onSelectClient={onSelectClient}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Desde 768px: rejilla de calendario. */}
            <div
              className={`hidden gap-px overflow-hidden rounded-md border border-separator bg-separator md:grid ${
              view === "week"
                ? "md:grid-cols-4 lg:grid-cols-7"
                : "md:grid-cols-7"
            }`}
            >
              {days.map((date) => {
                const key = dayKey(date);
                const dayEntries = byDay.get(key) ?? [];
                const isToday = key === dayKey(startOfDay(new Date()));
                const dimmed =
                  view === "month" && date.getMonth() !== cursor.getMonth();
                return (
                  <div
                    key={key}
                    className={`min-h-24 bg-surface p-2 ${dimmed ? "opacity-40" : ""}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`text-[0.7rem] font-medium ${
                        isToday ? "text-accent" : "text-muted"
                      }`}
                      >
                        {date.toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                        })}
                      </span>
                      {dayEntries.length > 0 ? (
                        <span className="text-xs text-muted">
                          {dayEntries.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      {dayEntries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          showOrg={showOrg && !embedded}
                          onSelectClient={onSelectClient}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
