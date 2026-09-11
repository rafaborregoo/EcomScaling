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

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const POLL_MS = 30_000;

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

function formatWhen(iso: string): string {
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
      className="mt-1 flex items-center gap-2 rounded-md border border-separator px-2 py-1.5 text-xs hover:border-foreground"
    >
      <DownloadIcon aria-hidden className="size-3.5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
      <span className="shrink-0 text-muted">
        {formatBytes(attachment.byte_size)}
      </span>
    </a>
  );
}

function MessageBubble({
  message,
  viewerIsClient,
}: {
  message: Message;
  viewerIsClient: boolean;
}) {
  if (message.author_kind === "system") {
    return (
      <p className="my-1 text-center text-xs text-muted">{message.body}</p>
    );
  }
  const mine = viewerIsClient
    ? message.author_kind === "client"
    : message.author_kind === "consultant" ||
      message.author_kind === "platform";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"}`}>
        {/* El mensaje del otro (para el cliente, el del consultor) manda: papel
            blanco, filo de marca y sombra, como una alerta. Los propios se
            apagan en gris para que la vista caiga en lo que hay que leer. */}
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            mine
              ? "border border-edge bg-surface text-muted"
              : "border border-accent/40 border-l-2 border-l-accent bg-background shadow-surface"
          }`}
        >
          {message.body ? (
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          ) : null}
          {message.attachments.map((attachment) => (
            <AttachmentView
              key={attachment.storage_path}
              attachment={attachment}
            />
          ))}
        </div>
        <p className="mt-0.5 text-[0.65rem] text-muted">
          {message.author_name ?? (mine ? "Tú" : "Cliente")} ·{" "}
          {formatWhen(message.created_at)}
        </p>
      </div>
    </div>
  );
}

/** Hilo completo de una organización: lista + redactor con adjuntos. */
export function MessageThread({
  organizationId,
  className,
  viewerIsClient = false,
}: {
  organizationId: string;
  className?: string;
  viewerIsClient?: boolean;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/v1/organizations/${organizationId}/consultant-messages`,
      );
      if (!res.ok) {
        setError("No se pudo cargar el chat.");
        return;
      }
      const payload = (await res.json()) as { messages: Message[] };
      setMessages(payload.messages ?? []);
      setError(null);
    } catch {
      setError("No se pudo cargar el chat por un error de red.");
    }
  }, [organizationId]);

  useEffect(() => {
    setMessages(null);
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function onPickFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading((count) => count + files.length);
    for (const file of files) {
      try {
        if (file.size > MAX_FILE_BYTES) {
          setError(`"${file.name}" supera los 15 MB.`);
          continue;
        }
        const dataUrl = await readAsDataUrl(file);
        const res = await apiFetch(
          `/v1/organizations/${organizationId}/consultant-messages/attachments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              content_type: file.type,
              content_base64: dataUrl,
            }),
          },
        );
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

  async function send() {
    if (sending || uploading > 0) return;
    if (!body.trim() && pending.length === 0) return;
    setSending(true);
    try {
      const res = await apiFetch(
        `/v1/organizations/${organizationId}/consultant-messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim(), attachments: pending }),
        },
      );
      if (!res.ok) {
        setError("No se pudo enviar el mensaje.");
        return;
      }
      setBody("");
      setPending([]);
      setError(null);
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`flex flex-col ${className ?? "h-[55svh] min-h-72 lg:h-[28rem]"}`}>
      <div
        ref={scrollRef}
        // Bandeja propia: blanca y enmarcada en el azul de marca, para que la
        // conversacion no se confunda con el resto de bloques de la pagina.
        className="flex-1 space-y-2 overflow-y-auto rounded-md border border-accent/30 bg-background p-3"
        aria-live="polite"
      >
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {!messages ? (
          <LoadingBlock label="Cargando chat..." />
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Todavía no hay mensajes en este chat.
          </p>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              viewerIsClient={viewerIsClient}
            />
          ))
        )}
      </div>

      <div className="mt-3 border-t border-separator pt-3">
        {pending.length > 0 || uploading > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((attachment, index) => (
              <span
                key={attachment.storage_path}
                className="flex items-center gap-1 rounded-md border border-separator px-2 py-1 text-xs"
              >
                <span className="max-w-40 truncate">{attachment.filename}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${attachment.filename}`}
                  className="text-muted hover:text-danger"
                  onClick={() =>
                    setPending((list) => list.filter((_, i) => i !== index))
                  }
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
        {/* Redactor apilado: la card de chats vive en una columna estrecha
            (35 % en escritorio, ancho completo en móvil) y el textarea no
            respira con los botones al lado. */}
        <div className="flex flex-col gap-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Escribe un mensaje…"
            onKeyDown={(event) => {
              // Enter envía; Shift+Enter (o Alt) mete salto de línea.
              if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => void onPickFiles(event.target.files)}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Adjuntar
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => void send()}
              disabled={
                sending ||
                uploading > 0 ||
                (!body.trim() && pending.length === 0)
              }
            >
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
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
                    {thread.counterpart_name ? `${thread.organization_name} · ` : ""}
                    {thread.last_message
                      ? thread.last_message.body ||
                        (thread.last_message.has_attachments ? "📎 Adjunto" : "")
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
