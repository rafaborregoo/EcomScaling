"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch } from "@/lib/bootstrap";
import { MessageThread } from "@/components/consultant-messages";
import { ModuleSummary } from "@/components/module-summary";
import { daysSince } from "@/lib/elapsed";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
} from "@/components/ui";

type Thread = {
  organization_id: string;
  organization_name: string;
  counterpart_user_id: string | null;
  counterpart_name: string | null;
  counterpart_avatar_url: string | null;
  last_message: {
    body: string;
    author_kind: string;
    has_attachments: boolean;
    created_at: string;
  } | null;
  unread_count: number;
};

function MensajesContent({ isClient }: { isClient: boolean }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/message-threads")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("No se pudieron cargar los chats.");
          return;
        }
        const payload = (await res.json()) as { threads: Thread[] };
        setThreads(payload.threads ?? []);
        setActiveId(
          (current) => current ?? payload.threads?.[0]?.organization_id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar los chats.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = threads?.find((t) => t.organization_id === activeId) ?? null;

  // El chat es donde se ve el seguimiento real: cuánto llevas sin hablar con
  // un cliente es una señal de consultoría, no un detalle de mensajería.
  const unread = (threads ?? []).reduce(
    (total, thread) => total + thread.unread_count,
    0,
  );
  const quietest = (threads ?? [])
    .filter((thread) => thread.last_message)
    .sort(
      (a, b) =>
        Date.parse(a.last_message?.created_at ?? "") -
        Date.parse(b.last_message?.created_at ?? ""),
    )[0];
  const quietDays = daysSince(quietest?.last_message?.created_at) ?? 0;

  const showList = (threads?.length ?? 0) > 1;

  // Chats es la conversación con el consultor humano. El hilo del cliente se
  // siembra desde su membresía tenga consultor o no, así que sin esto le
  // ofrecíamos escribir a una conversación que no lee nadie, rotulada además
  // con el nombre de su propia tienda.
  const moduleDisabled =
    isClient &&
    threads !== null &&
    threads.every((thread) => thread.counterpart_user_id === null);

  const orphanThread =
    isClient && active !== null && active.counterpart_user_id === null;

  if (moduleDisabled) {
    return (
      <div className="portal-page">
        <Card title="Chats">
          <EmptyState
            title="Chats está desactivado"
            hint="Este módulo es tu conversación con tu consultor, y todavía no tienes uno asignado. Se activa solo en cuanto te asignen uno. Mientras tanto, el Consultor IA responde sobre tu tienda desde el botón de abajo a la derecha."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="portal-page space-y-4">
      {/* Métricas de cartera: cuántas conversaciones llevas, cuál lleva más
          tiempo en silencio. Es la lectura del consultor sobre su seguimiento;
          al cliente, que tiene una conversación, no le dice nada -- y
          "esperando respuesta: el último mensaje es del cliente" leído desde
          su asiento cuenta sus propios mensajes al revés. */}
      {!isClient && threads && threads.length > 0 ? (
        <ModuleSummary
          metrics={[
            {
              label: "Conversaciones",
              value: threads.length.toLocaleString("es-ES"),
            },
            {
              label: "Sin leer",
              value: unread.toLocaleString("es-ES"),
              tone: unread > 0 ? "warn" : "success",
            },
            {
              label: "Esperando respuesta",
              value: threads
                .filter(
                  (thread) => thread.last_message?.author_kind === "client",
                )
                .length.toLocaleString("es-ES"),
              hint: "El último mensaje es del cliente",
            },
            {
              label: "Más tiempo en silencio",
              value: quietest ? `${quietDays} d` : "—",
              tone: quietDays >= 14 ? "warn" : "default",
              hint: quietest?.organization_name,
            },
          ]}
        />
      ) : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {!threads && !error ? <LoadingBlock label="Cargando..." /> : null}

      {threads && threads.length === 0 ? (
        <Card title="Chats">
          <EmptyState
            title="Todavía no hay chats"
            hint="Cuando se te asigne un cliente, vuestra conversación aparecerá aquí."
          />
        </Card>
      ) : null}

      {/* La lista solo cuando hay de dónde elegir: con una conversación es una
          columna fija con una fila dentro. */}
      {threads && threads.length > 0 ? (
      <div className={showList ? "grid gap-4 lg:grid-cols-[18rem_1fr]" : ""}>
        {showList ? (
          <Card title="Chats">
            <ul className="divide-y divide-separator">
              {threads.map((thread) => (
                <li key={thread.organization_id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(thread.organization_id)}
                    className={`flex w-full items-center gap-2 py-3 text-left transition-colors hover:bg-surface ${
                      thread.organization_id === activeId ? "bg-surface" : ""
                    }`}
                  >
                    <Avatar
                      name={thread.counterpart_name ?? thread.organization_name}
                      src={thread.counterpart_avatar_url ?? undefined}
                      size="sm"
                      color="accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {thread.counterpart_name ?? thread.organization_name}
                      </span>
                      {thread.counterpart_name ? (
                        <span className="block truncate text-xs text-muted">
                          {thread.organization_name}
                        </span>
                      ) : null}
                    </span>
                    {thread.unread_count > 0 ? (
                      <Badge tone="brand">{thread.unread_count}</Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card
          title={
            orphanThread
              ? "Sin consultor asignado"
              : active
                ? (active.counterpart_name ?? active.organization_name)
                : "Chat"
          }
          description={
            orphanThread
              ? active?.organization_name
              : active?.counterpart_name
                ? active.organization_name
                : undefined
          }
        >
          {/* El módulo se apaga solo si NINGUNA tienda tiene consultor. Con dos
              tiendas y consultor en una, esta conversación concreta sigue sin
              nadie al otro lado y hay que decirlo aquí. */}
          {orphanThread ? (
            <p className="mb-3 text-sm text-muted">
              Esta tienda todavía no tiene consultor asignado. Lo que escribas
              se guarda y lo verá quien se le asigne.
            </p>
          ) : null}
          {active ? (
            <MessageThread
              organizationId={active.organization_id}
              className="h-[32rem]"
              viewerIsClient={isClient}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted">
              Elige un chat.
            </p>
          )}
        </Card>
      </div>
      ) : null}
    </div>
  );
}

export default function MensajesPage() {
  return (
    <PortalShell title="Chats">
      {(bootstrap) => (
        <MensajesContent
          isClient={
            !["platform_admin", "consultant"].includes(
              bootstrap.profile.platform_role,
            )
          }
        />
      )}
    </PortalShell>
  );
}
