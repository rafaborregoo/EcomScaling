"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/components/command-palette";
import { notificationTypeInfo } from "@e-nora/contracts";
import { useInsights } from "@/components/insights-context";
import { totalInsightCount, type InsightSpot } from "@/lib/insights-registry";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import {
  ScrollArea,
  EmptyState,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ArchiveIcon,
  BellIcon,
  Button,
  CheckAllIcon,
  cn,
  ErrorBlock,
  IconChevronRight,
  insightBadgeCount,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  LoadingBlock,
  Link,
  List,
  NotificationBadge,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RetryIcon,
  SparklesIcon,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from "@/components/ui";

export type Notification = {
  id: string;
  organization_id: string | null;
  type: string;
  title: string;
  message: string | null;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  created_at: string;
};

/** Enlace de la notificacion con su contexto: muchas filas guardan solo
 * "/tareas", y el consultor aterrizaba en la lista de toda la cartera sin
 * ver que habia pasado. Se le anade la tienda y, si la fila apunta a una
 * tarea o alerta concreta, su id para que /tareas la abra directamente. */
export function notificationHref(notification: Notification): string {
  const actionUrl = notification.action_url;
  if (!actionUrl) return "#";
  if (!actionUrl.startsWith("/")) {
    return /^https?:/i.test(actionUrl) ? actionUrl : "#";
  }
  const url = new URL(actionUrl, "http://local");
  if (url.pathname === "/tareas" && notification.entity_id) {
    if (notification.entity_type === "task" && !url.searchParams.has("task")) {
      url.searchParams.set("task", notification.entity_id);
    } else if (notification.entity_type === "alert" && !url.searchParams.has("alert")) {
      url.searchParams.set("alert", notification.entity_id);
    }
  }
  // El destino resalta lo que ha cambiado (components/focus-target.tsx).
  if (notification.entity_id && !url.searchParams.has("focus")) {
    url.searchParams.set("focus", notification.entity_id);
  }
  const href = `${url.pathname}${url.search}${url.hash}`;
  return notification.organization_id
    ? withPortalRouteContext(href, notification.organization_id)
    : href;
}

function formatRelativeTime(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "ahora";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}

const COUNT_CHIP =
  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-semibold leading-5";

/** Agrupa por tienda: primero las que tienen no leidas; dentro, el orden de
 * la API (de la mas reciente a la mas antigua). */
function groupByStore(
  notifications: Notification[],
  storeNames: Record<string, string>,
) {
  const groups = new Map<
    string,
    { id: string; name: string; items: Notification[]; unread: number }
  >();
  for (const notification of notifications) {
    const id = notification.organization_id ?? "general";
    const group = groups.get(id) ?? {
      id,
      name: notification.organization_id
        ? (storeNames[notification.organization_id] ?? "Otra tienda")
        : "General",
      items: [],
      unread: 0,
    };
    group.items.push(notification);
    if (notification.status === "unread") group.unread += 1;
    groups.set(id, group);
  }
  return [...groups.values()].sort(
    (a, b) => Number(b.unread > 0) - Number(a.unread > 0),
  );
}

// El panel de notificaciones se muestra como Popover anclado a la campana en
// desktop y como hoja inferior en movil -- la misma lista, el contenedor
// cambia con el ancho. Ambos son primitivos de HeroUI.

/** Bell de notificaciones en el shell (DB-01, gap real cerrado 2026-07-29):
 * `notifications` ya insertaba filas reales (alertas nuevas notificadas a
 * owner/manager, ver operations.ts) pero ninguna vista las mostraba nunca --
 * `notification_status` nunca pasaba de `unread`. Cliente, consultor y admin
 * comparten este componente; solo cambia lo que cada uno recibe (RLS ya
 * filtra por `user_id`). */
export function NotificationsBell({
  token,
  storeNames,
}: {
  token: string;
  /** Solo para el consultor: nombre por organization_id. Si llega, la lista
   * se agrupa por tienda en desplegables. */
  storeNames?: Record<string, string>;
}) {
  const isDesktop = useIsDesktop();
  const { spots } = useInsights();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "notifications" | "ai">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // La primera carga es al montar el shell (para el badge). Cuando el usuario
  // abre el panel la lista ya viene cargada; solo se refresca en segundo plano
  // sin mostrar el bloque "Cargando..." -- ese spinner solo aparece la primera
  // vez, nunca al abrir.
  const [hasLoaded, setHasLoaded] = useState(false);
  const aiCount = totalInsightCount(spots);
  const activityCount = unreadCount + aiCount;

  const load = useCallback(async () => {
    if (!hasLoaded) setIsLoading(true);
    try {
      const response = await apiFetch("/v1/notifications");
      if (!response.ok) {
        if (!hasLoaded) {
          setLoadError("No se pudieron cargar las notificaciones.");
        }
        return;
      }
      const payload = (await response.json()) as {
        notifications: Notification[];
        unread_count: number;
      };
      setNotifications(payload.notifications);
      setUnreadCount(payload.unread_count);
      setLoadError(null);
      setHasLoaded(true);
    } catch {
      if (!hasLoaded) {
        setLoadError("No se pudieron cargar las notificaciones.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasLoaded]);

  // Cuenta de no leidas al montar (para el badge), sin abrir el panel.
  // Depende solo del token, NO de `load`: `load` cambia de identidad al
  // fijar `hasLoaded`, asi que tenerlo en las deps disparaba una segunda
  // peticion identica justo despues de cada carga con exito.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // La paleta ⌘K marca todo como leído por su cuenta: se recarga la cuenta.
  useEffect(() => {
    const reload = () => void load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, reload);
  }, [load]);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open) void load();
  }

  async function markStatus(
    notificationId: string,
    status: "read" | "archived",
  ) {
    try {
      const response = await apiFetch(
        `/v1/notifications/${notificationId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        toast.danger("No se pudo actualizar la notificación.");
        return;
      }
      const wasUnread = notifications.some(
        (item) => item.id === notificationId && item.status === "unread",
      );
      if (status === "archived") {
        setNotifications((current) =>
          current.filter((item) => item.id !== notificationId),
        );
      } else {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, status } : item,
          ),
        );
      }
      if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      toast.danger("No se pudo actualizar la notificación.");
    }
  }

  async function markAllRead() {
    try {
      const response = await apiFetch("/v1/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) {
        toast.danger("No se pudieron marcar todas como leídas.");
        return;
      }
      setNotifications((current) =>
        current.map((item) => ({ ...item, status: "read" })),
      );
      setUnreadCount(0);
      toast.success("Notificaciones marcadas como leídas.");
    } catch {
      toast.danger("No se pudieron marcar todas como leídas.");
    }
  }

  const renderBell = (onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Centro de actividad${
        activityCount > 0
          ? ` (${activityCount} elementos)`
          : ""
      }`}
      className={cn(
        "group relative inline-flex size-9 items-center justify-center rounded-full bg-transparent transition-colors hover:bg-[#f0efed] pointer-coarse:size-11",
        unreadCount > 0 || spots.length > 0
          ? "text-[#3d3b3a]"
          : "text-muted hover:text-foreground",
      )}
    >
      <NotificationBadge count={activityCount}>
        <BellIcon aria-hidden="true" className="size-[1.2rem] transition-transform group-hover:-rotate-6" />
      </NotificationBadge>
      {spots.length > 0 ? (
        <span className="absolute bottom-1 right-1 grid size-3 place-items-center rounded-full bg-[#3d3b3a] text-white ring-2 ring-white" aria-hidden="true">
          <SparklesIcon className="size-2" />
        </span>
      ) : null}
    </button>
  );

  const header = (
    <div className="border-b border-separator bg-white px-5 py-5 text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#3d3b3a] text-white">
            <SparklesIcon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold tracking-[-0.02em]">Centro de actividad</p>
            <p className="mt-1 text-xs text-muted">Avisos de tu cuenta y señales de IA</p>
          </div>
        </div>
        {unreadCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="min-w-0 gap-1.5 px-2 text-xs text-muted hover:bg-[#f0efed] hover:text-foreground"
            onClick={() => void markAllRead()}
          >
            <CheckAllIcon aria-hidden="true" className="size-3.5" />
            Marcar leídas
          </Button>
        ) : null}
      </div>
      <div className="mt-4 flex gap-4 text-[0.7rem] font-medium text-muted">
        <span>{unreadCount} {unreadCount === 1 ? "aviso sin leer" : "avisos sin leer"}</span>
        <span className="size-1 self-center rounded-full bg-[#aaa6a2]" aria-hidden="true" />
        <span>{aiCount} {aiCount === 1 ? "señal de IA" : "señales de IA"}</span>
      </div>
    </div>
  );

  const filterBar = (
    <div className="border-b border-separator bg-white px-4 py-2.5">
      <ToggleGroup aria-label="Filtrar actividad" value={filter} onValueChange={setFilter}>
        {([
          ["all", "Todo", notifications.length + aiCount],
          ["notifications", "Avisos", notifications.length],
          ["ai", "IA", aiCount],
        ] as const).map(([value, label, count]) => (
          <ToggleGroupItem key={value} value={value}>
            {value === "ai" ? <SparklesIcon aria-hidden="true" className="size-3.5" /> : null}
            {label}
            <span className="text-xs text-muted tabular-nums">{count}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );

  const body =
    isLoading && notifications.length === 0 ? (
      <LoadingBlock label="Cargando notificaciones..." />
    ) : loadError ? (
      <div className="space-y-4 p-4">
        <ErrorBlock>{loadError}</ErrorBlock>
        <Button
          className="mt-3 gap-1.5"
          variant="secondary"
          size="sm"
          onClick={() => void load()}
        >
          <RetryIcon aria-hidden="true" className="size-3.5" />
          Reintentar
        </Button>
        {(filter === "all" || filter === "ai") && spots.length > 0 ? (
          <section aria-labelledby="activity-ai-heading">
            <h3 id="activity-ai-heading" className="mb-2 flex items-center gap-1.5 px-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#3d3b3a]">
              <SparklesIcon aria-hidden="true" className="size-3.5" />
              Lecturas de IA
            </h3>
            {renderInsights(spots)}
          </section>
        ) : null}
      </div>
    ) : notifications.length === 0 && spots.length === 0 ? (
      <EmptyState size="sm" className="py-10" icon={<BellIcon aria-hidden="true" />} title="Sin actividad por ahora" />
    ) : (
      <div className="space-y-5 p-4">
        {(filter === "all" || filter === "notifications") && notifications.length > 0 ? (
          <section aria-labelledby="activity-notifications-heading">
            {filter === "all" ? <h3 id="activity-notifications-heading" className="mb-2 px-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">Avisos recientes</h3> : null}
            {storeNames ? (
      <Accordion className="px-1">
        {groupByStore(notifications, storeNames).map((group) => (
          <AccordionItem key={group.id} value={group.id}>
            <AccordionTrigger className="py-3">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {group.name}
                </span>
                <span
                  className={cn(
                    COUNT_CHIP,
                    group.unread > 0
                      ? "bg-foreground text-white"
                      : "bg-black/[0.06] text-muted",
                  )}
                >
                  {group.unread > 0 ? group.unread : group.items.length}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">{renderList(group.items)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
            ) : renderList(notifications)}
          </section>
        ) : null}
        {(filter === "all" || filter === "ai") && spots.length > 0 ? (
          <section aria-labelledby="activity-ai-heading">
            {filter === "all" ? <h3 id="activity-ai-heading" className="mb-2 flex items-center gap-1.5 px-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#3d3b3a]"><SparklesIcon aria-hidden="true" className="size-3.5" />Lecturas de IA</h3> : null}
            {renderInsights(spots)}
          </section>
        ) : null}
        {filter === "notifications" && notifications.length === 0 ? <EmptyActivity label="No hay avisos" /> : null}
        {filter === "ai" && spots.length === 0 ? <EmptyActivity label="No hay señales de IA ahora mismo" /> : null}
      </div>
    );

  function EmptyActivity({ label }: { label: string }) {
    return <EmptyState size="sm" className="py-10" icon={<SparklesIcon aria-hidden="true" />} title={label} />;
  }

  function renderInsights(items: InsightSpot[]) {
    return (
      <List as="ul" className="w-full overflow-hidden rounded-xl border border-separator bg-white">
        {items.map((spot) => {
          const spotCount = insightBadgeCount(spot.insights);
          return (
            <List.Item as="li" key={spot.id} className="w-full border-b border-separator last:border-b-0">
              <Item size="sm" className="group hover-sweep min-h-16 flex-nowrap rounded-none [--hover-sweep-color:#f0efed]" render={<Link href={spot.href} onClick={() => setIsOpen(false)} />}>
                <ItemMedia variant="icon" className="size-9"><SparklesIcon aria-hidden="true" /></ItemMedia>
                <ItemContent>
                  <ItemTitle className="block truncate font-semibold">{spot.label}</ItemTitle>
                  <ItemDescription className="truncate">{spot.location}</ItemDescription>
                </ItemContent>
                <ItemActions className="flex-nowrap">
                  {spotCount > 0 ? <span className="rounded-full bg-[#f0efed] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#3d3b3a]">{spotCount}</span> : null}
                  <IconChevronRight aria-hidden="true" className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </ItemActions>
              </Item>
            </List.Item>
          );
        })}
      </List>
    );
  }

  // Tarjetas blancas con borde fino y esquinas redondeadas; la no leida se
  // marca con el punto y el titulo en negrita, sin fondo de color.
  function renderList(items: Notification[]) {
    return (
      <List as="ul" className="flex w-full flex-col gap-2">
        {items.map((notification) => {
          const isUnread = notification.status === "unread";
          return (
            <Item
              key={notification.id}
              variant={isUnread ? "muted" : "outline"}
              size="sm"
              render={<li />}
              className={cn(
                "group hover-sweep flex-nowrap items-start rounded-xl [--hover-sweep-color:#f0efed] hover:border-[#aaa6a2]",
                isUnread && "border-[#c9c6c3]",
              )}
            >
              {isUnread ? (
                <span
                  className="mt-[0.45rem] size-2 shrink-0 rounded-full bg-foreground"
                  aria-label="Sin leer"
                />
              ) : (
                <span className="size-2 shrink-0" aria-hidden="true" />
              )}
              <ItemContent>
                {/* Qué clase de aviso es, con su explicación al pasar el ratón
                  (catálogo en packages/contracts/notification-catalog.ts). */}
                <p
                  className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted"
                  title={notificationTypeInfo(notification.type).explanation}
                >
                  {notificationTypeInfo(notification.type).label}
                </p>
                <Link
                  href={notificationHref(notification)}
                  className={cn(
                    "block max-w-full text-sm text-foreground no-underline hover:underline",
                    isUnread ? "font-semibold" : "font-normal",
                  )}
                  onClick={() => {
                    if (isUnread) void markStatus(notification.id, "read");
                    setIsOpen(false);
                  }}
                >
                  <span className="line-clamp-2 leading-5">
                    {notification.title}
                  </span>
                </Link>
                {notification.message ? (
                  <ItemDescription className="line-clamp-2">
                    {notification.message}
                  </ItemDescription>
                ) : null}
                <ItemDescription className="mt-1">
                  {formatRelativeTime(notification.created_at)}
                </ItemDescription>
              </ItemContent>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-label="Archivar notificación"
                title="Archivar"
                className="size-8 min-w-0 shrink-0 justify-center p-0 text-muted opacity-60 transition hover:bg-black/5 hover:text-foreground hover:opacity-100 pointer-coarse:size-11"
                onClick={() => void markStatus(notification.id, "archived")}
              >
                <ArchiveIcon aria-hidden="true" className="size-4" />
              </Button>
            </Item>
          );
        })}
      </List>
    );
  }

  // La campana enseña lo último; el historial completo, con filtros, en su página.
  const historyLink = (
    <div className="border-t border-separator bg-white px-4 py-2.5 text-center">
      <Link
        href="/notificaciones"
        className="text-xs font-semibold text-foreground no-underline hover:underline"
        onClick={() => setIsOpen(false)}
      >
        Ver todo el historial
      </Link>
    </div>
  );

  if (isDesktop) {
    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger render={renderBell()} />
        <PopoverContent side="bottom" align="end" className="w-[26rem] gap-0 overflow-hidden p-0" aria-label="Centro de actividad">
          <div className="flex max-h-[min(34rem,calc(100vh_/_var(--ui-zoom)_-_6rem))] flex-col">
            {header}
            {filterBar}
            <ScrollArea className="min-h-0 flex-1 overscroll-contain">
              {body}
            </ScrollArea>
            {historyLink}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Movil: cajón inferior con asa; la misma lista que el popover.
  return (
    <>
      {renderBell(() => handleOpenChange(true))}
      <Drawer open={isOpen} onOpenChange={handleOpenChange} swipeDirection="down" showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Centro de actividad</DrawerTitle>
            <DrawerDescription>
              {unreadCount} avisos · {aiCount} de IA
              {unreadCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="ml-auto min-w-0 gap-1.5 px-2 text-xs"
                  onClick={() => void markAllRead()}
                >
                  <CheckAllIcon aria-hidden="true" className="size-3.5" />
                  Marcar todas
                </Button>
              ) : null}
            </DrawerDescription>
          </DrawerHeader>
          {filterBar}
          <ScrollArea className="min-h-0 flex-1 overscroll-contain">{body}</ScrollArea>
          <div className="pb-[env(safe-area-inset-bottom)]">{historyLink}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
