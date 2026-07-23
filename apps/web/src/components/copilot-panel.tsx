"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatSource = { kind: string; reference: string; period: string | null };

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - ");
}

// AI-05 (A09): copiloto del consultor embebido, accesible desde cualquier
// pagina del portal (FE-08 Bloque B). Chat de solo lectura: nunca escribe en
// el dominio, asi que no hay nada que aprobar (criterio "ver vs escribir").
export function CopilotPanel({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<ChatSource[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Nueva conversacion al cambiar de cliente activo.
  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setLastSources([]);
    setError(null);
  }, [organizationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const input = panel.querySelector<HTMLInputElement>("input");
    input?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener("keydown", handleKeyDown);
    return () => panel.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();

    if (!question || isSending) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsSending(true);
    setError(null);

    const response = await apiFetch(`/v1/organizations/${organizationId}/consultant-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, conversation_id: conversationId ?? undefined }),
    });

    if (!response.ok) {
      setError(await readError(response));
      setIsSending(false);
      return;
    }

    const payload = (await response.json()) as {
      conversation_id: string;
      output: { answer: string; sources: ChatSource[]; warnings: string[] };
    };

    setConversationId(payload.conversation_id);
    setMessages((prev) => [...prev, { role: "assistant", content: payload.output.answer }]);
    setLastSources(payload.output.sources ?? []);
    setIsSending(false);
  }

  return (
    <div
      id="copilot-panel"
      ref={panelRef}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line bg-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-panel-title"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">Copiloto</p>
          <p id="copilot-panel-title" className="font-display text-xl">Pregunta sobre este negocio</p>
        </div>
        <button
          className="text-sm text-muted transition hover:text-black"
          type="button"
          onClick={onClose}
          aria-label="Cerrar copiloto"
        >
          Cerrar
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite" aria-busy={isSending}>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            Pregunta lo que quieras sobre las métricas o la metodología de este cliente. Responde solo con datos
            reales del sistema y cita las fuentes.
          </p>
        ) : (
          messages.map((message, index) => (
            <div key={index}>
              <p className="font-mono text-[0.6rem] uppercase tracking-wide text-muted">
                {message.role === "user" ? "Tú" : "Copiloto"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </div>
          ))
        )}
        {isSending ? <p className="text-sm text-muted">Pensando...</p> : null}
        {error ? <p className="text-sm text-brand" role="alert">{error}</p> : null}
        {!isSending && lastSources.length > 0 ? (
          <div className="border-t border-line pt-2">
            <p className="font-mono text-[0.6rem] uppercase tracking-wide text-muted">Fuentes</p>
            <ul className="mt-1 space-y-0.5">
              {lastSources.map((source, index) => (
                <li key={index} className="text-xs text-muted">
                  {source.reference}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <form className="flex items-center gap-2 border-t border-line px-5 py-3" onSubmit={submit}>
        <input
          aria-label="Pregunta para el copiloto"
          className="w-full rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-2 text-sm outline-none transition-colors focus:border-ink"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ej: ¿cuánto hemos vendido esta semana?"
          disabled={isSending}
        />
        <button
          className="bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={isSending || !input.trim()}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
