"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { MessageThread } from "@/components/consultant-messages";
import { Avatar, AvatarFallback, AvatarImage, avatarInitials, buttonVariants, CloseIcon, MessageIcon, NotificationBadge } from "@/components/ui";

// Ventanita para hablar con el consultor desde cualquier pantalla del cliente.
// Es el mismo hilo que /mensajes (MessageThread): no es modal, así que se
// puede seguir trabajando con ella abierta. Abierta o cerrada sobrevive al
// cambiar de pantalla (sessionStorage), porque cada página monta su shell.
// Estilos: `.consultant-chat-float*` en globals.css.

const OPEN_KEY = "enora.consultant-chat-open";

export function ConsultantChatFloat({
  organizationId,
  consultantName,
  consultantAvatarUrl,
  unread,
  onActivity,
}: {
  organizationId: string;
  consultantName: string | null;
  consultantAvatarUrl: string | null;
  unread: number;
  onActivity: () => void;
}) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const name = consultantName ?? "Tu consultor";

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage solo existe en el cliente
      if (sessionStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch {
      /* sin almacenamiento: empieza cerrada */
    }
  }, []);

  function toggle(next: boolean) {
    setOpen(next);
    try {
      if (next) sessionStorage.setItem(OPEN_KEY, "1");
      else sessionStorage.removeItem(OPEN_KEY);
    } catch {
      /* no pasa nada: solo se pierde recordarla */
    }
    if (next) requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("textarea")?.focus());
    else launcherRef.current?.focus();
  }

  const avatar = (
    <Avatar size="sm">
      <AvatarImage src={consultantAvatarUrl ?? undefined} alt="" />
      <AvatarFallback>{avatarInitials(name)}</AvatarFallback>
    </Avatar>
  );

  return (
    <>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="consultant-chat-float-title"
          className="consultant-chat-float"
          onKeyDown={(event) => {
            if (event.key === "Escape") toggle(false);
          }}
        >
          <header className="consultant-chat-float__header">
            {avatar}
            <div className="min-w-0 flex-1">
              <p id="consultant-chat-float-title" className="truncate font-medium">{name}</p>
              <p className="text-sm text-muted">Tu consultor</p>
            </div>
            <Link href="/mensajes" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Abrir en Chats" title="Abrir en Chats">
              <ExternalLink aria-hidden />
            </Link>
            <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Cerrar el chat" title="Cerrar" onClick={() => toggle(false)}>
              <CloseIcon aria-hidden />
            </button>
          </header>
          <MessageThread
            organizationId={organizationId}
            viewerIsClient
            unreadCount={unread}
            onActivity={onActivity}
            placeholder={`Escribe a ${name}…`}
            className="min-h-0 flex-1 px-3 pb-3"
          />
        </div>
      ) : null}
      <button
        ref={launcherRef}
        type="button"
        className="consultant-chat-float__launcher"
        aria-expanded={open}
        aria-label={unread > 0 ? `Chat con ${name}: ${unread} sin leer` : `Chat con ${name}`}
        onClick={() => toggle(!open)}
      >
        <NotificationBadge count={unread}>
          {consultantAvatarUrl ? avatar : <MessageIcon aria-hidden className="size-6" />}
        </NotificationBadge>
      </button>
    </>
  );
}
