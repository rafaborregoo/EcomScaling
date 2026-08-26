"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { Badge, BellIcon, Button, ErrorBlock, LoadingBlock, NotificationBadge, Popover, toast } from "@/components/ui";

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

/** Bell de notificaciones en el shell (DB-01, gap real cerrado 2026-07-29):
 * `notifications` ya insertaba filas reales (alertas nuevas notificadas a
 * owner/manager, ver operations.ts) pero ninguna vista las mostraba nunca --
 * `notification_status` nunca pasaba de `unread`. Cliente, consultor y admin
 * comparten este componente; solo cambia lo que cada uno recibe (RLS ya
 * filtra por `user_id`). */
export function NotificationsBell({ token }: { token: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch("/v1/notifications");
      if (!response.ok) {
        setLoadError("No se pudieron cargar las notificaciones.");
        return;
      }
      const payload = (await response.json()) as { notifications: Notification[]; unread_count: number };
      setNotifications(payload.notifications);
      setUnreadCount(payload.unread_count);
    } catch {
      setLoadError("No se pudieron cargar las notificaciones.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cuenta de no leidas al montar (para el badge), sin abrir el panel.
  useEffect(() => {
    void load();
  }, [load, token]);

  async function markStatus(notificationId: string, status: "read" | "archived") {
    try {
    const response = await apiFetch(`/v1/notifications/${notificationId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toast.danger("No se pudo actualizar la notificación.");
      return;
    }
    const wasUnread = notifications.some(
      (item) => item.id === notificationId && item.status === "unread",
    );
    if (status === "archived") {
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
    } else {
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, status } : item)),
      );
    }
    if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      toast.danger("No se pudo actualizar la notificación.");
    }
  }

  async function markAllRead() {
    try {
    const response = await apiFetch("/v1/notifications/read-all", { method: "POST" });
    if (!response.ok) {
      toast.danger("No se pudieron marcar todas como leídas.");
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, status: "read" })));
    setUnreadCount(0);
    toast.success("Notificaciones marcadas como leídas.");
    } catch {
      toast.danger("No se pudieron marcar todas como leídas.");
    }
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <NotificationBadge count={unreadCount > 0 ? unreadCount : undefined}>
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            onClick={() => void load()}
          >
            <BellIcon aria-hidden="true" />
          </Button>
        </NotificationBadge>
      </Popover.Trigger>

      <Popover.Content placement="bottom end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <Popover.Dialog aria-label="Notificaciones" className="max-h-[min(32rem,calc(100vh-6rem))] overflow-y-auto p-0">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-medium">Notificaciones</p>
            {unreadCount > 0 ? (
              <Button variant="secondary" size="sm" type="button" onClick={() => void markAllRead()}>
                Marcar todas leídas
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <LoadingBlock label="Cargando notificaciones..." />
          ) : loadError ? (
            <div className="p-3">
              <ErrorBlock>{loadError}</ErrorBlock>
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">Sin notificaciones.</p>
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((notification) => (
                <li key={notification.id} className={["px-3 py-2.5", notification.status === "unread" ? "bg-brand-tint/40" : ""].join(" ")}>
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={safeActionUrl(notification.action_url)}
                      className="min-w-0 flex-1"
                      onClick={() => {
                        if (notification.status === "unread") {
                          void markStatus(notification.id, "read");
                        }
                        setIsOpen(false);
                      }}
                    >
                      <p className="text-sm font-medium">{notification.title}</p>
                      {notification.message ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{notification.message}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-[0.65rem] text-muted">{formatRelativeTime(notification.created_at)}</p>
                    </a>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {notification.status === "unread" ? <Badge tone="brand">Nueva</Badge> : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => void markStatus(notification.id, "archived")}
                      >
                        Archivar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
