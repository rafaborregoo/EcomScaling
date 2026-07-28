"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Drawer } from "@heroui/react";
import { apiFetch } from "@/lib/bootstrap";
import { Badge, Button, Card, Input, Table } from "@/components/ui";

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

  // Foco inicial, atrapado de foco y cierre con Escape ya los da el Drawer
  // (React Aria Modal) -- antes se manejaban a mano aqui.

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
    <Drawer isOpen onOpenChange={(open) => !open && onClose()}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right" className="w-full max-w-md">
          <Drawer.Dialog id="copilot-panel">
            <Drawer.Header>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">Copiloto</p>
              <Drawer.Heading>Pregunta sobre este negocio</Drawer.Heading>
              <Drawer.CloseTrigger aria-label="Cerrar copiloto" />
            </Drawer.Header>

            <Drawer.Body>
              <div ref={scrollRef} className="space-y-4" aria-live="polite" aria-busy={isSending}>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted">
                    Pregunta lo que quieras sobre las métricas o la metodología de este cliente. Responde solo con
                    datos reales del sistema y cita las fuentes.
                  </p>
                ) : (
                  messages.map((message, index) =>
                    message.role === "assistant" ? (
                      <Card key={index} kicker="Copiloto">
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      </Card>
                    ) : (
                      <div key={index}>
                        <p className="font-mono text-[0.6rem] uppercase tracking-wide text-muted">Tú</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      </div>
                    ),
                  )
                )}
                {isSending ? <p className="text-sm text-muted">Pensando...</p> : null}
                {error ? <p className="text-sm text-brand" role="alert">{error}</p> : null}
                {!isSending && lastSources.length > 0 ? (
                  <div className="border-t border-line pt-2">
                    <p className="font-mono text-[0.6rem] uppercase tracking-wide text-muted">Fuentes</p>
                    <Table
                      className="mt-1"
                      ariaLabel="Fuentes de la respuesta del copiloto"
                      columns={[
                        { key: "kind", label: "Tipo", render: (row) => <Badge tone="neutral">{row.kind}</Badge> },
                        { key: "reference", label: "Referencia" },
                        { key: "period", label: "Periodo", render: (row) => row.period ?? "—" },
                      ]}
                      rows={lastSources.map((source, index) => ({ id: String(index), ...source }))}
                    />
                  </div>
                ) : null}
              </div>
            </Drawer.Body>

            <Drawer.Footer>
              <form className="flex w-full items-center gap-2" onSubmit={submit}>
                <Input
                  className="w-full"
                  aria-label="Pregunta para el copiloto"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ej: ¿cuánto hemos vendido esta semana?"
                  disabled={isSending}
                />
                <Button type="submit" disabled={isSending || !input.trim()}>
                  Enviar
                </Button>
              </form>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
