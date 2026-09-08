"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import {
  ArchiveIcon,
  BellIcon,
  Button,
  CheckAllIcon,
  cn,
  ErrorBlock,
  LoadingBlock,
  Link,
  List,
  Modal,
  Popover,
  RetryIcon,
  toast,
} from "@/components/ui";

type Notification = {
  id: string;
  organization_id: string | null;
  type: string;
  title: string;
  message: string | null;
  action_url: string | null;
  status: string;
  created_at: string;
};

function safeActionUrl(actionUrl: string | null): string {
  if (!actionUrl) return "#";
  return /^(https?:|\/)/i.test(actionUrl) ? actionUrl : "#";
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

// El panel de notificaciones se muestra como Popover anclado a la campana en
// desktop y como Drawer inferior (hoja) en movil -- la misma lista, el
// contenedor cambia con el ancho. Ambos son primitivos de HeroUI.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/** Bell de notificaciones en el shell (DB-01, gap real cerrado 2026-07-29):
 * `notifications` ya insertaba filas reales (alertas nuevas notificadas a
 * owner/manager, ver operations.ts) pero ninguna vista las mostraba nunca --
 * `notification_status` nunca pasaba de `unread`. Cliente, consultor y admin
 * comparten este componente; solo cambia lo que cada uno recibe (RLS ya
 * filtra por `user_id`). */
export function NotificationsBell({ token }: { token: string }) {
  const isDesktop = useIsDesktop();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // La primera carga es al montar el shell (para el badge). Cuando el usuario
  // abre el panel la lista ya viene cargada; solo se refresca en segundo plano
  // sin mostrar el bloque "Cargando..." -- ese spinner solo aparece la primera
  // vez, nunca al abrir.
  const [hasLoaded, setHasLoaded] = useState(false);

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
      aria-label={`Notificaciones${
        unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""
      }`}
      className={cn(
        "relative inline-flex size-9 items-center justify-center bg-transparent transition-colors",
        unreadCount > 0 ? "text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      <BellIcon aria-hidden="true" className="size-[1.2rem]" />
      {unreadCount > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[0.65rem] font-semibold leading-none text-white"
          aria-hidden="true"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold tracking-[-0.01em]">Notificaciones</p>
        {unreadCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.7rem] font-semibold leading-5 text-white">
            {unreadCount}
          </span>
        ) : null}
      </div>
      {unreadCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="min-w-0 gap-1.5 px-2 text-xs text-muted hover:text-foreground"
          onClick={() => void markAllRead()}
        >
          <CheckAllIcon aria-hidden="true" className="size-3.5" />
          Marcar todas
        </Button>
      ) : null}
    </div>
  );

  const body = isLoading && notifications.length === 0 ? (
    <LoadingBlock label="Cargando notificaciones..." />
  ) : loadError ? (
    <div className="p-3">
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
    </div>
  ) : notifications.length === 0 ? (
    <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
      <BellIcon aria-hidden="true" className="size-5 text-muted" />
      <p className="text-sm text-muted">Sin notificaciones.</p>
    </div>
  ) : (
    <List as="ul">
      {notifications.map((notification) => {
        const isUnread = notification.status === "unread";
        return (
          <List.Item
            as="li"
            key={notification.id}
            className={cn(
              "group flex gap-3 px-4 py-3 transition-colors",
              isUnread
                ? "border-l-2 border-accent bg-accent-soft/30"
                : "border-l-2 border-transparent hover:bg-black/[0.02]",
            )}
          >
            <div className="min-w-0 flex-1">
              <Link
                href={safeActionUrl(notification.action_url)}
                className="block max-w-full text-sm font-medium text-foreground no-underline hover:underline"
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
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                  {notification.message}
                </p>
              ) : null}
              <div className="mt-1.5 flex items-center gap-2 text-[0.7rem] text-muted">
                {isUnread ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                ) : null}
                <span>{formatRelativeTime(notification.created_at)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label="Archivar notificación"
              title="Archivar"
              className="size-8 min-w-0 shrink-0 justify-center p-0 text-muted opacity-60 transition hover:bg-black/5 hover:text-foreground hover:opacity-100"
              onClick={() => void markStatus(notification.id, "archived")}
            >
              <ArchiveIcon aria-hidden="true" className="size-4" />
            </Button>
          </List.Item>
        );
      })}
    </List>
  );

  if (isDesktop) {
    return (
      <Popover isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Popover.Trigger>{renderBell()}</Popover.Trigger>
        <Popover.Content
          placement="bottom end"
          className="w-[24rem] overflow-hidden rounded-xl p-0 shadow-lg"
        >
          <Popover.Dialog
            aria-label="Notificaciones"
            className="flex max-h-[min(34rem,calc(100vh-6rem))] flex-col p-0"
          >
            {header}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {body}
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    );
  }

  // Movil: hoja inferior. El Modal de HeroUI ya se ancla abajo en pantallas
  // pequeñas (data-placement="auto" -> mt-auto), asi que hace de bottom sheet
  // sin un primitivo aparte.
  return (
    <>
      {renderBell(() => handleOpenChange(true))}
      <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog
              aria-label="Notificaciones"
              className="w-full max-w-none overflow-hidden p-0"
            >
              {header}
              <div className="max-h-[70vh] overflow-y-auto">{body}</div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
