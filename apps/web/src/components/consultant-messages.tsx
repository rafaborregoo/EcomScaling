"use client";


import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { RefreshCw, X } from "lucide-react";
import {
  EmptyState,
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
  Avatar,
  avatarInitials,
  AvatarImage,
  AvatarFallback,
  Badge,
  Bubble,
  BubbleContent,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  EYEBROW,
  ErrorBlock,
  LoadingBlock,
  Message,
  MessageContent,
  MessageFooter,
  Marker,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport,
  useMessageScroller,
  MarkerContent,
  Spinner,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { FileTypeIcon, fileMeta, isImageFile } from "@/lib/file-meta";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import s from "./message-thread.module.css";

type MessageAttachment = {
  storage_path: string;
  filename: string;
  content_type: string;
  byte_size: number;
  signed_url: string | null;
};
type ThreadMessage = {
  id: string;
  author_user_id: string | null;
  author_kind: "consultant" | "client" | "platform" | "system";
  author_name: string | null;
  body: string;
  attachments: MessageAttachment[];
  created_at: string;
};
type Thread = {
  organization_id: string;
  organization_name: string;
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
type PendingAttachment = Omit<MessageAttachment, "signed_url">;
/** Archivo que se está subiendo al redactor, o cuya subida falló. */
type Upload = { key: string; file: File; state: "uploading" | "error"; reason: string };
/** Mensaje propio que aún no ha vuelto del servidor (o que falló). */
type Outgoing = {
  key: string;
  body: string;
  attachments: PendingAttachment[];
  state: "sending" | "failed";
  at: string;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const POLL_MS = 30_000;
const GROUP_MS = 5 * 60_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

/** «Hoy», «Ayer» o «jueves 1 de octubre». */
function dayLabel(iso: string, now: number): string {
  const day = new Date(iso).setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(now).setHours(0, 0, 0, 0) - day) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Adjunto de un mensaje ya enviado: la imagen se ve; el resto, con su icono. Toda la tarjeta lo abre. */
function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  const image = isImageFile(attachment.filename, attachment.content_type) && attachment.signed_url;
  return (
    <Attachment
      size="sm"
      orientation={image ? "vertical" : "horizontal"}
      className={image ? "mt-1 w-56 max-w-full" : "mt-1 w-64 max-w-full"}
    >
      <AttachmentMedia variant={image ? "image" : "icon"}>
        {image ? <img src={attachment.signed_url!} alt={attachment.filename} /> : <FileTypeIcon filename={attachment.filename} contentType={attachment.content_type} />}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{attachment.filename}</AttachmentTitle>
        <AttachmentDescription>{fileMeta(attachment.filename, attachment.byte_size, attachment.content_type)}</AttachmentDescription>
      </AttachmentContent>
      {attachment.signed_url ? (
        <AttachmentTrigger
          render={<a href={attachment.signed_url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${attachment.filename}`} />}
        />
      ) : null}
    </Attachment>
  );
}

/** Hilo completo de una organización: lista + redactor con adjuntos. */
/** El scroll lo lleva MessageScroller (sigue lo nuevo solo si ya estabas al final); al enviar tú, se baja siempre. */
function ScrollOnSend({ sent }: { sent: number }) {
  const { scrollToEnd } = useMessageScroller();
  useEffect(() => {
    if (sent) scrollToEnd();
  }, [sent, scrollToEnd]);
  return null;
}

export function MessageThread({
  organizationId,
  className,
  viewerIsClient = false,
  initialDraft,
  unreadCount = 0,
  quickReplies,
  placeholder = "Escribe un mensaje…",
  onActivity,
  onLoaded,
}: {
  organizationId: string;
  className?: string;
  viewerIsClient?: boolean;
  /** Mensaje ya escrito al abrir (p. ej. desde un hito de Mi Camino). */
  initialDraft?: string;
  /** Mensajes sin leer al abrir: marcan dónde empieza lo nuevo. */
  unreadCount?: number;
  quickReplies?: string[];
  placeholder?: string;
  /** Tras enviar o marcar como leído: la lista de chats refresca sus cifras. */
  onActivity?: () => void;
  /** Cada vez que llegan los mensajes del servidor. */
  onLoaded?: (info: { counterpartReadAt: string | null; messages: number }) => void;
}) {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [counterpartReadAt, setCounterpartReadAt] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(initialDraft ?? "");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const uploading = uploads.filter((upload) => upload.state === "uploading").length;
  const [dragging, setDragging] = useState(false);
  const [now] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  // Dónde empieza lo nuevo se fija con lo que había sin leer al abrir, y no
  // se mueve cuando el hilo se marca como leído.
  const [newFromId, setNewFromId] = useState<string | null | undefined>(undefined);
  const lastMarked = useRef("");
  const base = `/v1/organizations/${organizationId}/consultant-messages`;

  // Marcar como leído es un acto aparte de cargar: solo cuando el hilo se ve.
  const markRead = useCallback(
    async (list: ThreadMessage[]) => {
      if (document.visibilityState !== "visible") return;
      const incoming = list.filter(
        (message) =>
          message.author_kind !== "system" &&
          (viewerIsClient
            ? message.author_kind !== "client"
            : message.author_kind === "client"),
      );
      const latest = incoming.at(-1)?.created_at ?? "";
      if (!latest || latest === lastMarked.current) return;
      lastMarked.current = latest;
      try {
        await apiFetch(`${base}/read`, { method: "POST" });
        onActivity?.();
      } catch {
        lastMarked.current = "";
      }
    },
    [base, onActivity, viewerIsClient],
  );

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${base}?mark_read=0`);
      if (!res.ok) {
        setError("No se pudo cargar el chat.");
        return;
      }
      const payload = (await res.json()) as {
        messages: ThreadMessage[];
        counterpart_read_at?: string | null;
      };
      const list = payload.messages ?? [];
      const incoming = list.filter(
        (message) =>
          message.author_kind !== "system" &&
          (viewerIsClient
            ? message.author_kind !== "client"
            : message.author_kind === "client"),
      );
      setNewFromId((current) =>
        current !== undefined
          ? current
          : unreadCount > 0
            ? (incoming.at(-unreadCount)?.id ?? null)
            : null,
      );
      setMessages(list);
      setCounterpartReadAt(payload.counterpart_read_at ?? null);
      setError(null);
      onLoaded?.({
        counterpartReadAt: payload.counterpart_read_at ?? null,
        messages: list.length,
      });
      void markRead(list);
    } catch {
      setError("No se pudo cargar el chat por un error de red.");
    }
  }, [base, markRead, onLoaded, unreadCount, viewerIsClient]);

  useEffect(() => {
    setMessages(null);
    setNewFromId(undefined);
    lastMarked.current = "";
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de hilo
  }, [organizationId]);

  // Cada archivo se ve en el redactor mientras sube; si falla se queda con
  // el motivo y se puede reintentar o quitar.
  async function uploadOne(upload: Upload) {
    const fail = (reason: string) =>
      setUploads((list) => list.map((entry) => (entry.key === upload.key ? { ...entry, state: "error", reason } : entry)));
    setUploads((list) => list.map((entry) => (entry.key === upload.key ? { ...entry, state: "uploading" } : entry)));
    const { file } = upload;
    if (file.size > MAX_FILE_BYTES) return fail("Supera los 15 MB");
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await apiFetch(`${base}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name || "captura.png",
          content_type: file.type,
          content_base64: dataUrl,
        }),
      });
      if (!res.ok) return fail("No se ha podido subir. Reinténtalo.");
      const payload = (await res.json()) as { attachment: PendingAttachment };
      setPending((list) => [...list, payload.attachment]);
      setUploads((list) => list.filter((entry) => entry.key !== upload.key));
    } catch {
      fail("No se ha podido subir. Reinténtalo.");
    }
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    const added = files.map((file): Upload => ({ key: crypto.randomUUID(), file, state: "uploading", reason: "" }));
    setUploads((list) => [...list, ...added]);
    for (const upload of added) await uploadOne(upload);
  }

  async function onPickFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await uploadFiles(files);
  }

  async function deliver(item: Outgoing) {
    setOutbox((list) =>
      list.map((entry) =>
        entry.key === item.key ? { ...entry, state: "sending" } : entry,
      ),
    );
    try {
      const res = await apiFetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: item.body, attachments: item.attachments }),
      });
      if (!res.ok) throw new Error("send_failed");
      await load();
      setOutbox((list) => list.filter((entry) => entry.key !== item.key));
      onActivity?.();
    } catch {
      setOutbox((list) =>
        list.map((entry) =>
          entry.key === item.key ? { ...entry, state: "failed" } : entry,
        ),
      );
    }
  }

  function send() {
    if (uploading > 0) return;
    if (!body.trim() && pending.length === 0) return;
    const item: Outgoing = {
      key: crypto.randomUUID(),
      body: body.trim(),
      attachments: pending,
      state: "sending",
      at: new Date().toISOString(),
    };
    // El mensaje aparece al momento; si falla se queda marcado y se reintenta.
    setOutbox((list) => [...list, item]);
    setBody("");
    setPending([]);
    setError(null);
    void deliver(item);
  }

  // Lo propio: el cliente escribe como "client", el resto como consultor.
  const isMine = (kind: ThreadMessage["author_kind"]) =>
    viewerIsClient ? kind === "client" : kind === "consultant" || kind === "platform";
  const lastMineId = [...(messages ?? [])].reverse().find((m) => isMine(m.author_kind))?.id;

  let lastDay = "";
  let previous: ThreadMessage | null = null;
  const rows = (messages ?? []).map((message) => {
    const day = dayLabel(message.created_at, now);
    const header = day !== lastDay ? <Marker key={`d-${message.id}`} variant="separator" className={s.day}><MarkerContent>{day}</MarkerContent></Marker> : null;
    lastDay = day;
    if (message.author_kind === "system") {
      previous = null;
      return (
        <div key={message.id}>
          {header}
          <Marker className={s.system}><MarkerContent>{message.body}</MarkerContent></Marker>
        </div>
      );
    }
    const mine = isMine(message.author_kind);
    const grouped =
      previous !== null &&
      !header &&
      previous.author_kind === message.author_kind &&
      Date.parse(message.created_at) - Date.parse(previous.created_at) < GROUP_MS;
    previous = message;
    const seen =
      message.id === lastMineId &&
      counterpartReadAt !== null &&
      Date.parse(counterpartReadAt) >= Date.parse(message.created_at);
    return (
      <div key={message.id} style={{ display: "contents" }}>
        {header}
        {newFromId === message.id ? <Marker variant="separator" className={s.fresh} data-scroll-anchor><MarkerContent>Nuevo</MarkerContent></Marker> : null}
        <Message align={mine ? "end" : "start"} className={s.msg} data-mine={mine || undefined} data-grouped={grouped || undefined}>
          <MessageContent>
            <Bubble variant={mine ? "default" : "muted"}>
              <BubbleContent className={s.bubble}>
                {message.body ? <span>{message.body}</span> : null}
                {message.attachments.map((attachment) => (
                  <AttachmentView key={attachment.storage_path} attachment={attachment} />
                ))}
              </BubbleContent>
            </Bubble>
            {!grouped || message.id === lastMineId ? (
              <MessageFooter>
                {mine ? null : (
                  <>
                    <span>{message.author_name ?? (viewerIsClient ? "Consultor" : "Cliente")}</span>·
                  </>
                )}
                <span>{clock(message.created_at)}</span>
                {message.id === lastMineId ? (
                  <>
                    ·<span className={seen ? s.seen : undefined}>{seen ? "Visto" : "Enviado"}</span>
                  </>
                ) : null}
              </MessageFooter>
            ) : null}
          </MessageContent>
        </Message>
      </div>
    );
  });

  return (
    <div
      className={`${s.root} ${className ?? "h-[55svh] min-h-72 lg:h-[28rem]"}`}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        if (dragDepth.current++ === 0) setDragging(true);
      }}
      onDragLeave={() => {
        if (--dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void uploadFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {dragging ? <div className={s.drop}>Suelta para adjuntar</div> : null}
      <MessageScroller className={s.scroll}>
        <ScrollOnSend sent={outbox.length} />
        <MessageScrollerViewport>
          <MessageScrollerContent className={s.log}>
            {error ? <ErrorBlock>{error}</ErrorBlock> : null}
            {!messages ? (
              <LoadingBlock label="Cargando chat..." />
            ) : messages.length === 0 && outbox.length === 0 ? (
              <EmptyState size="sm" title="Todavía no hay mensajes en este chat" />
            ) : (
              rows
            )}
            {outbox.map((item) => (
              <Message key={item.key} align="end" className={s.msg} data-mine data-failed={item.state === "failed" || undefined}>
                <MessageContent>
                  <Bubble>
                    <BubbleContent className={s.bubble}>
                      {item.body ? <span>{item.body}</span> : null}
                      {item.attachments.map((attachment) => {
                        return (
                          <Attachment
                            key={attachment.storage_path}
                            size="xs"
                            state={item.state === "failed" ? "error" : "uploading"}
                            className="mt-1 w-56 max-w-full"
                          >
                            <AttachmentMedia><FileTypeIcon filename={attachment.filename} contentType={attachment.content_type} /></AttachmentMedia>
                            <AttachmentContent>
                              <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                            </AttachmentContent>
                          </Attachment>
                        );
                      })}
                    </BubbleContent>
                  </Bubble>
                  <MessageFooter>
                    <span>{clock(item.at)}</span>·
                    {item.state === "failed" ? (
                      <span className={s.failed}>
                        No se envió ·{" "}
                        <button type="button" onClick={() => void deliver(item)}>
                          Reintentar
                        </button>
                      </span>
                    ) : (
                      <span>Enviando…</span>
                    )}
                  </MessageFooter>
                </MessageContent>
              </Message>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>

      <div className={s.compose}>
        {quickReplies?.length ? (
          <div className={s.quick} role="group" aria-label="Respuestas rápidas">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => setBody((current) => (current ? `${current} ${reply}` : reply))}
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}
        {pending.length > 0 || uploads.length > 0 ? (
          <AttachmentGroup role="group" aria-label="Archivos adjuntos">
            {pending.map((attachment, index) => {
              return (
                <Attachment key={attachment.storage_path} size="sm" className="w-56">
                  <AttachmentMedia><FileTypeIcon filename={attachment.filename} contentType={attachment.content_type} /></AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                    <AttachmentDescription>{fileMeta(attachment.filename, attachment.byte_size, attachment.content_type)}</AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label={`Quitar ${attachment.filename}`}
                      onClick={() => setPending((list) => list.filter((_, i) => i !== index))}
                    >
                      <X aria-hidden />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              );
            })}
            {uploads.map((upload) => {
              const name = upload.file.name || "captura.png";
              return (
                <Attachment key={upload.key} size="sm" state={upload.state} className="w-56">
                  <AttachmentMedia>
                    {upload.state === "uploading" ? <Spinner size="sm" aria-hidden /> : <FileTypeIcon filename={name} contentType={upload.file.type} />}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{name}</AttachmentTitle>
                    <AttachmentDescription>{upload.state === "uploading" ? "Subiendo…" : upload.reason}</AttachmentDescription>
                  </AttachmentContent>
                  {upload.state === "error" ? (
                    <AttachmentActions>
                      {upload.file.size <= MAX_FILE_BYTES ? (
                        <AttachmentAction aria-label={`Reintentar ${name}`} onClick={() => void uploadOne(upload)}>
                          <RefreshCw aria-hidden />
                        </AttachmentAction>
                      ) : null}
                      <AttachmentAction
                        aria-label={`Quitar ${name}`}
                        onClick={() => setUploads((list) => list.filter((entry) => entry.key !== upload.key))}
                      >
                        <X aria-hidden />
                      </AttachmentAction>
                    </AttachmentActions>
                  ) : null}
                </Attachment>
              );
            })}
          </AttachmentGroup>
        ) : null}
        <Textarea
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
          aria-label="Mensaje"
          onKeyDown={(event) => {
            // Enter envía; Shift+Enter (o Alt) mete salto de línea.
            if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
              event.preventDefault();
              send();
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length === 0) return;
            event.preventDefault();
            void uploadFiles(files);
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => void onPickFiles(event.target.files)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={s.hint}>
            <span>Enter envía · Mayús + Enter, nueva línea</span>
            <span>Arrastra o pega archivos</span>
          </span>
          <div role="group" aria-label="Acciones del mensaje" className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
              Adjuntar
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={send}
              disabled={uploading > 0 || (!body.trim() && pending.length === 0)}
            >
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** El hilo dentro de un Drawer: llena el lateral; abajo (móvil), alto fijo. */
export const DRAWER_THREAD =
  "mx-4 mb-4 min-h-0 flex-1 sm:mx-6 group-data-[swipe-axis=y]/drawer-popup:h-[70dvh] group-data-[swipe-axis=y]/drawer-popup:flex-none";

function MessageThreadDrawer({
  organizationId,
  title,
  subtitle,
  open,
  onOpenChange,
}: {
  organizationId: string;
  title: string;
  subtitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isDesktop = useIsDesktop();
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection={isDesktop ? "right" : "down"}
      showSwipeHandle={!isDesktop}
    >
      <DrawerContent className="sm:max-w-[40rem]">
        <DrawerHeader>
          {subtitle ? <span className={EYEBROW}>{subtitle}</span> : null}
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        {open ? <MessageThread organizationId={organizationId} className={DRAWER_THREAD} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

/** Card compacta de vista general: un hilo por cliente, abre el cajón. */
export function MessageThreadsCard() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Thread | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/v1/consultant/message-threads");
      if (!res.ok) {
        setError("No se pudieron cargar los chats.");
        return;
      }
      const payload = (await res.json()) as { threads: Thread[] };
      setThreads(payload.threads ?? []);
      setError(null);
    } catch {
      setError("No se pudieron cargar los chats por un error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chats</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorBlock>{error}</ErrorBlock>
        ) : !threads ? (
          <LoadingBlock label="Cargando conversaciones..." />
        ) : threads.length === 0 ? (
          <p className="py-4 text-sm text-muted">
            No tienes clientes asignados todavía.
          </p>
        ) : (
          <ul className="divide-y divide-separator">
            {threads.map((thread) => (
              <li key={thread.organization_id}>
                <button
                  type="button"
                  onClick={() => setActive(thread)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface"
                >
                  <Avatar>
                    <AvatarImage src={thread.counterpart_avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-accent text-white">{avatarInitials(thread.counterpart_name ?? thread.organization_name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {thread.counterpart_name ?? thread.organization_name}
                      </span>
                      {thread.unread_count > 0 ? (
                        <Badge tone="brand">{thread.unread_count}</Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {thread.counterpart_name
                        ? `${thread.organization_name} · `
                        : ""}
                      {thread.last_message
                        ? thread.last_message.body ||
                          (thread.last_message.has_attachments ? "Adjunto" : "")
                        : "Sin mensajes"}
                    </span>
                  </span>
                  {thread.last_message ? (
                    <span className="shrink-0 text-[0.65rem] text-muted">
                      {formatWhen(thread.last_message.created_at)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {active ? (
          <MessageThreadDrawer
            organizationId={active.organization_id}
            title={active.counterpart_name ?? active.organization_name}
            subtitle={active.counterpart_name ? active.organization_name : null}
            open={active !== null}
            onOpenChange={(open) => {
              if (!open) {
                setActive(null);
                void load();
              }
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
