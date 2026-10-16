"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch } from "@/lib/bootstrap";
import { MessageThread } from "@/components/consultant-messages";
import { WorkPageHeader } from "@/components/trabajo-ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
} from "@/components/ui";
import { chatFilter, isWaiting, waitLabel, type ChatFilter } from "./chat-state";
import s from "./mensajes.module.css";

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

const FILTERS: Array<[ChatFilter, string]> = [
  ["wait", "Te esperan"],
  ["unread", "Sin leer"],
  ["quiet", "En silencio"],
  ["all", "Todos"],
];

const QUICK_CONSULTANT = [
  "Lo miro y te digo hoy.",
  "¿Lo vemos en la llamada?",
  "Hecho ✔",
  "Te lo dejo en Contenido para revisar.",
];
const QUICK_CLIENT = ["Ok, gracias.", "¿Lo vemos en la llamada?", "Te mando los datos."];

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

/** Hora si es de hoy, «ayer», día de la semana o fecha. */
function listWhen(iso: string, now: number): string {
  const days = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return clock(iso);
  if (days === 1) return "ayer";
  if (days < 7) return new Date(iso).toLocaleDateString("es-ES", { weekday: "short" });
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
}

function MensajesContent({ isClient }: { isClient: boolean }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChatFilter | null>(null);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counterpartReadAt, setCounterpartReadAt] = useState<string | null>(null);
  // `Date.now()` no es puro: se fija una vez por visita.
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/v1/consultant/message-threads");
      if (!res.ok) {
        setError("No se pudieron cargar los chats.");
        return;
      }
      const payload = (await res.json()) as { threads: Thread[] };
      const list = payload.threads ?? [];
      setThreads(list);
      setError(null);
      // Con una sola conversación se abre sola. Con varias no: abrir el
      // primero la marcaba como leída sin que nadie la hubiera visto.
      if (list.length === 1) setActiveId((current) => current ?? list[0]?.organization_id ?? null);
    } catch {
      setError("No se pudieron cargar los chats.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = threads?.find((thread) => thread.organization_id === activeId) ?? null;

  // Piezas de marketing que esperan al cliente en la tienda abierta.
  const draftsQuery = useCachedQuery<{ drafts?: MarketingDraft[] }>(
    active ? `/v1/organizations/${active.organization_id}/marketing/drafts` : null,
  );
  const toReview = (draftsQuery.data?.drafts ?? []).filter(
    (draft) => draft.status === "pending_approval",
  );

  const all = threads ?? [];
  const waiting = all.filter((thread) => isWaiting(thread.last_message?.author_kind, isClient));
  const unreadTotal = all.reduce((total, thread) => total + thread.unread_count, 0);
  const quiet = all.filter((thread) => chatFilter(thread, "quiet", isClient, now));

  const showList = !isClient || all.length > 1;
  // Lo primero que ve el consultor es quién le espera; si nadie, todos.
  const effective: ChatFilter = filter ?? (waiting.length > 0 ? "wait" : "all");
  const needle = query.trim().toLowerCase();
  const visible = all
    .filter((thread) => chatFilter(thread, effective, isClient, now))
    .filter(
      (thread) =>
        !needle ||
        `${thread.counterpart_name ?? ""} ${thread.organization_name} ${thread.last_message?.body ?? ""}`
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) =>
      effective === "wait"
        ? Date.parse(a.last_message?.created_at ?? "") - Date.parse(b.last_message?.created_at ?? "")
        : 0,
    );

  // Chats es la conversación con el consultor humano. El hilo del cliente se
  // siembra desde su membresía tenga consultor o no, así que sin esto le
  // ofrecíamos escribir a una conversación que no lee nadie, rotulada además
  // con el nombre de su propia tienda.
  const moduleDisabled =
    isClient && threads !== null && threads.every((thread) => thread.counterpart_user_id === null);
  const orphanThread = isClient && active !== null && active.counterpart_user_id === null;

  if (moduleDisabled) {
    return (
      <div className="portal-page">
        <WorkPageHeader title="Chats">Tu conversación con el consultor y el seguimiento de tu tienda.</WorkPageHeader>
        <EmptyState
          title="Chats está desactivado"
          hint="Este módulo es tu conversación con tu consultor, y todavía no tienes uno asignado. Se activa solo en cuanto te asignen uno. Mientras tanto, el Consultor IA responde sobre tu tienda desde el botón de abajo a la derecha."
        />
      </div>
    );
  }

  const title = (thread: Thread) =>
    isClient ? (thread.counterpart_name ?? "Tu consultor") : thread.organization_name;
  const subtitle = (thread: Thread) => thread.counterpart_name ?? "";

  return (
    <div className={`portal-page ${s.root}`}>
      <WorkPageHeader title="Chats">{isClient ? "Habla con tu consultor y retoma lo que está pendiente." : "Prioriza las conversaciones y da seguimiento a cada cliente."}</WorkPageHeader>
      {/* Cifras de cartera que filtran la lista. Al cliente, que tiene una
          conversación, no le dicen nada: «te esperan» leído desde su asiento
          contaría sus propios mensajes al revés. */}
      {!isClient && threads && threads.length > 0 ? (
        <section className={s.pulse} aria-label="Resumen">
          <button type="button" aria-pressed={effective === "wait"} data-tone={waiting.length ? "act" : undefined} onClick={() => setFilter("wait")}>
            <b>{waiting.length}</b>
            <span>
              Te esperan
              {waiting.length
                ? ` · la más antigua hace ${ago(
                    waiting
                      .map((thread) => thread.last_message?.created_at ?? "")
                      .sort()[0] ?? "",
                    now,
                  )}`
                : ""}
            </span>
          </button>
          <button type="button" aria-pressed={effective === "unread"} onClick={() => setFilter("unread")}>
            <b>{unreadTotal.toLocaleString("es-ES")}</b>
            <span>Mensajes sin leer</span>
          </button>
          <button type="button" aria-pressed={effective === "quiet"} data-tone={quiet.length ? "warn" : undefined} onClick={() => setFilter("quiet")}>
            <b>{quiet.length}</b>
            <span>En silencio 14 días o más</span>
          </button>
          <button type="button" aria-pressed={effective === "all"} onClick={() => setFilter("all")}>
            <b>{all.length}</b>
            <span>Clientes</span>
          </button>
        </section>
      ) : null}

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {!threads && !error ? <LoadingBlock label="Cargando..." /> : null}

      {threads && threads.length === 0 ? (
        <EmptyState
          title="Todavía no hay chats"
          hint="Cuando se te asigne un cliente, vuestra conversación aparecerá aquí."
        />
      ) : null}

      {threads && threads.length > 0 ? (
        <section
          className={s.inbox}
          data-client={isClient || undefined}
          data-nolist={showList ? undefined : ""}
          data-open={mobileOpen && active ? "" : undefined}
          aria-label="Conversaciones"
        >
          {showList ? (
            <div className={`${s.col} ${s.list}`}>
              <div className={s.lhead}>
                <input
                  className={s.search}
                  type="search"
                  placeholder="Buscar cliente o mensaje"
                  aria-label="Buscar cliente o mensaje"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {!isClient ? (
                  <div className={s.chips} role="group" aria-label="Filtro">
                    {FILTERS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={s.chip}
                        aria-pressed={effective === value}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                        <small>
                          {value === "wait"
                            ? waiting.length
                            : value === "unread"
                              ? all.filter((thread) => thread.unread_count > 0).length
                              : value === "quiet"
                                ? quiet.length
                                : all.length}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={s.rows}>
                {visible.length === 0 ? (
                  <p className={s.none}>
                    {effective === "wait" && !needle
                      ? "Nadie te espera. Todo contestado."
                      : "Nada con ese filtro."}
                  </p>
                ) : null}
                {visible.map((thread) => {
                  const last = thread.last_message;
                  const waits = !isClient && isWaiting(last?.author_kind, false);
                  const late = waits && last && now - Date.parse(last.created_at) > 86_400_000;
                  const silent = last ? Math.floor((now - Date.parse(last.created_at)) / 86_400_000) : 0;
                  const mine = last
                    ? isClient
                      ? last.author_kind === "client"
                      : last.author_kind !== "client"
                    : false;
                  return (
                    <button
                      key={thread.organization_id}
                      type="button"
                      className={s.row}
                      aria-current={thread.organization_id === activeId}
                      data-wait={waits || undefined}
                      data-unread={thread.unread_count > 0 || undefined}
                      onClick={() => {
                        setActiveId(thread.organization_id);
                        setMobileOpen(true);
                        setCounterpartReadAt(null);
                      }}
                    >
                      <span className={s.avatar}>
                        <Avatar
                          name={thread.counterpart_name ?? thread.organization_name}
                          src={thread.counterpart_avatar_url ?? undefined}
                          size="md"
                          color="accent"
                        />
                      </span>
                      <span className={s.name}>{title(thread)}</span>
                      <span className={s.when}>{last ? listWhen(last.created_at, now) : ""}</span>
                      <span className={s.store}>
                        {isClient ? thread.organization_name : (thread.counterpart_name ?? "")}
                      </span>
                      <span className={s.snip}>
                        {last
                          ? `${mine ? "Tú: " : ""}${last.body || (last.has_attachments ? "Adjunto" : "")}`
                          : "Sin mensajes"}
                      </span>
                      <span className={s.tags}>
                        {thread.unread_count > 0 ? (
                          <Badge tone="brand">{thread.unread_count}</Badge>
                        ) : null}
                        {waits && last ? (
                          <span className={s.tag} data-late={late || undefined}>
                            {waitLabel(last.created_at, now)}
                          </span>
                        ) : !isClient && last && silent >= 14 ? (
                          <span className={s.tag} data-quiet="">
                            {silent} d en silencio
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={`${s.col} ${s.chat}`}>
            {active ? (
              <>
                <div className={s.chead}>
                  {showList ? (
                    <span className={s.back}>
                      <Button variant="ghost" size="sm" aria-label="Volver a la lista" onClick={() => setMobileOpen(false)}>
                        ←
                      </Button>
                    </span>
                  ) : null}
                  <Avatar
                    name={active.counterpart_name ?? active.organization_name}
                    src={active.counterpart_avatar_url ?? undefined}
                    size="md"
                    color="accent"
                  />
                  <div className="min-w-0">
                    <b>{orphanThread ? "Sin consultor asignado" : title(active)}</b>
                    <span>{isClient ? (orphanThread ? active.organization_name : `Tu consultor · ${active.organization_name}`) : subtitle(active)}</span>
                  </div>
                </div>
                {/* El módulo se apaga solo si NINGUNA tienda tiene consultor. Con
                    dos tiendas y consultor en una, esta conversación concreta
                    sigue sin nadie al otro lado y hay que decirlo aquí. */}
                {orphanThread ? (
                  <p className={s.notice}>
                    Esta tienda todavía no tiene consultor asignado. Lo que escribas se guarda y lo verá quien se le asigne.
                  </p>
                ) : null}
                <MessageThread
                  key={active.organization_id}
                  organizationId={active.organization_id}
                  className="min-h-0 flex-1"
                  viewerIsClient={isClient}
                  unreadCount={active.unread_count}
                  quickReplies={isClient ? QUICK_CLIENT : QUICK_CONSULTANT}
                  placeholder={isClient ? "Escribe a tu consultor…" : `Escribe a ${(active.counterpart_name ?? active.organization_name).split(" ")[0]}…`}
                  onActivity={() => void load()}
                  onLoaded={({ counterpartReadAt: readAt }) => setCounterpartReadAt(readAt)}
                />
              </>
            ) : (
              <p className={s.pick}>Elige un chat de la lista.</p>
            )}
          </div>

          {active ? (
            <aside className={s.ctx} aria-label="Contexto">
              <div className={s.who}>
                <Avatar
                  name={active.counterpart_name ?? active.organization_name}
                  src={active.counterpart_avatar_url ?? undefined}
                  size="md"
                  color="accent"
                />
                <div className="min-w-0">
                  <b>{isClient ? (active.counterpart_name ?? "Tu consultor") : active.organization_name}</b>
                  <br />
                  <span>{isClient ? "Consultor" : (active.counterpart_name ?? "Sin contacto")}</span>
                </div>
              </div>

              <div className={s.block}>
                <h3>{isClient ? "Lo que tienes que revisar" : "Lo que espera al cliente"}</h3>
                {toReview.length === 0 ? (
                  <p className={s.note}>Ninguna pieza pendiente de revisión.</p>
                ) : (
                  toReview.slice(0, 5).map((draft) => (
                    <Link key={draft.id} className={s.item} href="/marketing?section=contenido">
                      <i aria-hidden />
                      <span>{draft.template_name || draft.subject}</span>
                      <small>para revisar</small>
                    </Link>
                  ))
                )}
              </div>

              {!isClient ? (
                <div className={s.block}>
                  <h3>Seguimiento</h3>
                  <dl className={s.kv}>
                    <dt>Último mensaje</dt>
                    <dd>{active.last_message ? `hace ${ago(active.last_message.created_at, now)}` : "—"}</dd>
                    <dt>Lo ha leído</dt>
                    <dd>{counterpartReadAt ? `hace ${ago(counterpartReadAt, now)}` : "—"}</dd>
                  </dl>
                </div>
              ) : null}

              <div className={s.block}>
                <h3>Ir a</h3>
                <div className={s.links}>
                  <Link className={s.chip} href="/marketing?section=contenido">Contenido</Link>
                  <Link className={s.chip} href="/llamadas">Llamadas</Link>
                  {!isClient ? <Link className={s.chip} href="/agenda">Agenda</Link> : null}
                </div>
              </div>
            </aside>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default function MensajesPage() {
  return (
    <PortalShell title="Chats">
      {(bootstrap) => (
        <MensajesContent
          isClient={!["platform_admin", "consultant"].includes(bootstrap.profile.platform_role)}
        />
      )}
    </PortalShell>
  );
}
