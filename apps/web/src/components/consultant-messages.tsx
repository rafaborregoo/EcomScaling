"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DownloadIcon,
  ErrorBlock,
  LoadingBlock,
  Modal,
  Textarea,
} from "@/components/ui";
import s from "./message-thread.module.css";

type Attachment = {
  storage_path: string;
  filename: string;
  content_type: string;
  byte_size: number;
  signed_url: string | null;
};
type Message = {
  id: string;
  author_user_id: string | null;
  author_kind: "consultant" | "client" | "platform" | "system";
  author_name: string | null;
  body: string;
  attachments: Attachment[];
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
type PendingAttachment = Omit<Attachment, "signed_url">;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function AttachmentView({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.content_type.startsWith("image/");
  if (isImage && attachment.signed_url) {
    return (
      <a
        href={attachment.signed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block"
      >
        <img
          src={attachment.signed_url}
          alt={attachment.filename}
          className="max-h-64 rounded-md border border-separator object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.signed_url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-2 rounded-md border border-separator bg-white px-2 py-1 text-xs text-ink hover:border-foreground"
    >
      <DownloadIcon aria-hidden className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
      <span className="shrink-0 text-muted">
        {formatBytes(attachment.byte_size)}
      </span>
    </a>
  );
}

/** Hilo completo de una organización: lista + redactor con adjuntos. */
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
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [counterpartReadAt, setCounterpartReadAt] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(initialDraft ?? "");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [now] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  // Dónde empieza lo nuevo se fija con lo que había sin leer al abrir, y no
  // se mueve cuando el hilo se marca como leído.
  const [newFromId, setNewFromId] = useState<string | null | undefined>(undefined);
  const lastMarked = useRef("");
  const base = `/v1/organizations/${organizationId}/consultant-messages`;

  // Marcar como leído es un acto aparte de cargar: solo cuando el hilo se ve.
  const markRead = useCallback(
    async (list: Message[]) => {
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
        messages: Message[];
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, outbox]);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading((count) => count + files.length);
    for (const file of files) {
      try {
        if (file.size > MAX_FILE_BYTES) {
          setError(`"${file.name}" supera los 15 MB.`);
          continue;
        }
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
        if (!res.ok) {
          setError(`No se pudo subir "${file.name}".`);
          continue;
        }
        const payload = (await res.json()) as { attachment: PendingAttachment };
        setPending((list) => [...list, payload.attachment]);
      } catch {
        setError(`No se pudo subir "${file.name}".`);
      } finally {
        setUploading((count) => Math.max(0, count - 1));
      }
    }
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
  const isMine = (kind: Message["author_kind"]) =>
    viewerIsClient ? kind === "client" : kind === "consultant" || kind === "platform";
  const lastMineId = [...(messages ?? [])].reverse().find((m) => isMine(m.author_kind))?.id;

  let lastDay = "";
  let previous: Message | null = null;
  const rows = (messages ?? []).map((message) => {
    const day = dayLabel(message.created_at, now);
    const header = day !== lastDay ? <div key={`d-${message.id}`} className={s.day}>{day}</div> : null;
    lastDay = day;
    if (message.author_kind === "system") {
      previous = null;
      return (
        <div key={message.id}>
          {header}
          <p className={s.system}>{message.body}</p>
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
        {newFromId === message.id ? <div className={s.fresh}>Nuevo</div> : null}
        <div className={s.msg} data-mine={mine || undefined} data-grouped={grouped || undefined}>
          <div className={s.bubble}>
            {message.body ? <span>{message.body}</span> : null}
            {message.attachments.map((attachment) => (
              <AttachmentView key={attachment.storage_path} attachment={attachment} />
            ))}
          </div>
          {!grouped || message.id === lastMineId ? (
            <div className={s.meta}>
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
            </div>
          ) : null}
        </div>
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
      <div ref={scrollRef} className={s.scroll} aria-live="polite">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {!messages ? (
          <LoadingBlock label="Cargando chat..." />
        ) : messages.length === 0 && outbox.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Todavía no hay mensajes en este chat.
          </p>
        ) : (
          rows
        )}
        {outbox.map((item) => (
          <div key={item.key} className={s.msg} data-mine data-failed={item.state === "failed" || undefined}>
            <div className={s.bubble}>
              {item.body ? <span>{item.body}</span> : null}
              {item.attachments.map((attachment) => (
                <span key={attachment.storage_path} className="mt-1 block text-xs opacity-80">
                  {attachment.filename}
                </span>
              ))}
            </div>
            <div className={s.meta}>
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
            </div>
          </div>
        ))}
      </div>

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
        {pending.length > 0 || uploading > 0 ? (
          <div className={s.chips}>
            {pending.map((attachment, index) => (
              <span key={attachment.storage_path} className={s.chip}>
                <span>{attachment.filename}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${attachment.filename}`}
                  onClick={() => setPending((list) => list.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </span>
            ))}
            {uploading > 0 ? (
              <span className="text-xs text-muted">Subiendo {uploading}…</span>
            ) : null}
          </div>
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
          <span className="flex items-center gap-2">
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
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageThreadModal({
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
  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog aria-label={`Chat con ${title}`}>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              {subtitle ? (
                <p className="text-xs text-muted">{subtitle}</p>
              ) : null}
            </Modal.Header>
            <Modal.Body>
              {open ? <MessageThread organizationId={organizationId} /> : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Card compacta de vista general: un hilo por cliente, abre el modal. */
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
    <Card title="Chats">
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
                <Avatar
                  name={thread.counterpart_name ?? thread.organization_name}
                  src={thread.counterpart_avatar_url ?? undefined}
                  size="sm"
                  color="accent"
                />
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
        <MessageThreadModal
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
    </Card>
  );
}
