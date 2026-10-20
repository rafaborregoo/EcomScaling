"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NOTIFICATION_CATEGORIES,
  notificationTypeInfo,
  notificationTypeKeysIn,
  type NotificationCategory,
} from "@e-nora/contracts";
import { PortalShell } from "@/components/portal-shell";
import { WorkPageHeader } from "@/components/trabajo-ui";
import { notificationHref, type Notification } from "@/components/notifications-bell";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import {
  ArchiveIcon,
  Button,
  Card,
  CheckAllIcon,
  cn,
  EmptyState,
  ErrorBlock,
  Link,
  LoadingBlock,
  Select,
  toast,
} from "@/components/ui";

/**
 * Historial de avisos (ADR-0028): todo lo que te ha llegado, no solo los 50
 * últimos de la campana. Filtra por estado, tienda (consultor) y clase de
 * aviso; cada uno explica qué es y lleva a lo que ha cambiado.
 */

type Status = "active" | "unread" | "archived" | "all";

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "active", label: "Recibidas" },
  { value: "unread", label: "Sin leer" },
  { value: "archived", label: "Archivadas" },
  { value: "all", label: "Todas" },
];

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  alert_critical: "Alertas críticas",
  alert: "Otras alertas",
  task_assigned: "Tareas, IA y Mi Camino",
  message: "Mensajes",
  campaign_review: "Campañas",
  integration: "Integraciones",
  client: "Clientes y permisos",
  other: "Otros",
};

function dayLabel(iso: string) {
  const day = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today).setHours(0, 0, 0, 0) - new Date(day).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return day.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

function NotificationsHistory({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const isConsultant = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);
  const storeNames = useMemo(
    () =>
      Object.fromEntries(
        bootstrap.memberships.map((membership) => [
          membership.organization_id,
          membership.organization?.display_name ?? "Tienda",
        ]),
      ) as Record<string, string>,
    [bootstrap.memberships],
  );
  const [status, setStatus] = useState<Status>("active");
  const [store, setStore] = useState("");
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [items, setItems] = useState<Notification[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before: string | null) => {
      const params = new URLSearchParams({ limit: "50" });
      if (status !== "active") params.set("status", status);
      if (store) params.set("organizationId", store);
      if (category) params.set("types", notificationTypeKeysIn(category).join(","));
      if (before) params.set("before", before);
      const response = await apiFetch(`/v1/notifications?${params.toString()}`);
      if (!response.ok) throw new Error("No se pudo cargar el historial.");
      return (await response.json()) as { notifications: Notification[]; next_before: string | null };
    },
    [status, store, category],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    load(null)
      .then((page) => {
        if (cancelled) return;
        setItems(page.notifications);
        setNextBefore(page.next_before);
        setError(null);
      })
      .catch((reason: unknown) => !cancelled && setError(reason instanceof Error ? reason.message : "Error"))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function loadMore() {
    if (!nextBefore) return;
    setIsLoadingMore(true);
    try {
      const page = await load(nextBefore);
      setItems((current) => [...current, ...page.notifications]);
      setNextBefore(page.next_before);
    } catch {
      toast.danger("No se pudieron cargar más avisos.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function setItemStatus(id: string, next: "read" | "archived") {
    const response = await apiFetch(`/v1/notifications/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (!response?.ok) {
      toast.danger("No se pudo actualizar el aviso.");
      return;
    }
    setItems((current) =>
      current
        .map((item) => (item.id === id ? { ...item, status: next } : item))
        // Si el filtro ya no lo incluye, sale de la lista.
        .filter((item) => item.id !== id || status === "all" || (status === "archived") === (next === "archived")),
    );
  }

  async function markAllRead() {
    const response = await apiFetch("/v1/notifications/read-all", { method: "POST" }).catch(() => null);
    if (!response?.ok) {
      toast.danger("No se pudieron marcar como leídas.");
      return;
    }
    setItems((current) => (status === "unread" ? [] : current.map((item) => (item.status === "unread" ? { ...item, status: "read" } : item))));
    toast.success("Todo marcado como leído.");
  }

  const groups = useMemo(() => {
    const byDay = new Map<string, Notification[]>();
    for (const item of items) {
      const key = new Date(item.created_at).toDateString();
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    }
    return [...byDay.values()];
  }, [items]);

  const storeOptions = [
    { value: "", label: "Todas las tiendas" },
    ...bootstrap.memberships.map((membership) => ({
      value: membership.organization_id,
      label: membership.organization?.display_name ?? "Tienda",
    })),
  ];
  const categoryOptions = [
    { value: "", label: "Todos los avisos" },
    ...NOTIFICATION_CATEGORIES.filter((value) => value !== "other" && (isConsultant || value !== "client")).map((value) => ({
      value,
      label: CATEGORY_LABEL[value],
    })),
  ];

  return (
    <div className="portal-page space-y-5">
      <WorkPageHeader title="Notificaciones">
        Todo lo que te ha llegado. Cada aviso dice qué es y te lleva a lo que ha cambiado.
      </WorkPageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Estado">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={status === option.value ? "primary" : "ghost"}
              aria-pressed={status === option.value}
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {isConsultant && bootstrap.memberships.length > 1 ? (
          <Select aria-label="Tienda" value={store} onChange={setStore} options={storeOptions} className="w-56" />
        ) : null}
        <Select
          aria-label="Clase de aviso"
          value={category}
          onChange={(value) => setCategory(value as NotificationCategory | "")}
          options={categoryOptions}
          className="w-56"
        />
        <Button size="sm" variant="secondary" className="ml-auto gap-1.5" onClick={() => void markAllRead()}>
          <CheckAllIcon aria-hidden="true" className="size-3.5" />
          Marcar todo como leído
        </Button>
      </div>

      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : isLoading ? (
        <LoadingBlock label="Cargando el historial…" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No hay avisos con este filtro" hint="Prueba con «Todas» o quita el filtro de tienda." />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group[0]!.created_at} aria-label={dayLabel(group[0]!.created_at)} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted first-letter:uppercase">
                {dayLabel(group[0]!.created_at)}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.map((item) => {
                  const info = notificationTypeInfo(item.type);
                  const unread = item.status === "unread";
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "flex gap-3 rounded-xl border bg-white px-4 py-3",
                        unread ? "border-black/15" : "border-black/[0.08]",
                      )}
                    >
                      <span
                        className={cn("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-foreground" : "bg-transparent")}
                        aria-label={unread ? "Sin leer" : undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted">
                          {info.label}
                          {isConsultant && item.organization_id && storeNames[item.organization_id]
                            ? ` · ${storeNames[item.organization_id]}`
                            : ""}
                          {` · ${clock(item.created_at)}`}
                        </p>
                        <Link
                          href={notificationHref(item)}
                          className={cn(
                            "mt-0.5 block text-sm text-foreground no-underline hover:underline",
                            unread ? "font-semibold" : "font-normal",
                          )}
                          onClick={() => unread && void setItemStatus(item.id, "read")}
                        >
                          {item.title}
                        </Link>
                        {item.message ? (
                          <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.message}</p>
                        ) : null}
                        <p className="mt-1.5 text-xs text-muted">{info.explanation}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {item.status === "archived" ? (
                          <Button size="sm" variant="ghost" onClick={() => void setItemStatus(item.id, "read")}>
                            Recuperar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Archivar aviso"
                            title="Archivar"
                            className="size-8 min-w-0 justify-center p-0 text-muted"
                            onClick={() => void setItemStatus(item.id, "archived")}
                          >
                            <ArchiveIcon aria-hidden="true" className="size-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {nextBefore ? (
            <div className="flex justify-center">
              <Button variant="secondary" disabled={isLoadingMore} onClick={() => void loadMore()}>
                {isLoadingMore ? "Cargando…" : "Cargar más"}
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted">No hay más avisos.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NotificacionesPage() {
  return (
    <PortalShell title="Notificaciones">
      {(bootstrap) => <NotificationsHistory bootstrap={bootstrap} />}
    </PortalShell>
  );
}
