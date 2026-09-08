"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { AiEvidence, Alert, Badge, Button, Card, Drawer, Field, Input, Select } from "@/components/ui";
import type { ModuleSummaryData } from "@/components/module-summary";

type ChatSource = { kind: string; reference: string; period: string | null };
type ChatMessage = { role: "user" | "assistant"; content: string; sources?: ChatSource[]; warnings?: string[] };
type ChatError = { message: string; status: "warning" | "danger" };

/**
 * Lo que el consultor tiene delante cuando pregunta. Viaja al agente A09 como
 * `view_context` para que resuelva preguntas cortas ("¿por qué ha bajado
 * esto?") sin obligar a repetir el contexto que la pantalla ya muestra. El
 * backend lo sanea y nunca lo usa para ampliar el alcance de datos.
 */
export type CopilotView = {
  route: string;
  title: string;
  storeId?: string;
  storeLabel?: string;
  summary?: ModuleSummaryData | null;
};

const ERROR_MESSAGES: Record<string, ChatError> = {
  ai_runtime_not_configured: { message: "El asistente de IA no está disponible ahora mismo. Vuelve a intentarlo más tarde.", status: "warning" },
  organization_daily_budget_exceeded: { message: "Esta organización alcanzó su límite diario de uso de IA. El Consultor IA se reactiva al empezar el día siguiente.", status: "warning" },
  organization_daily_budget_unavailable: { message: "No se pudo comprobar el presupuesto diario de IA. El Consultor IA queda pausado temporalmente para proteger la cuenta.", status: "warning" },
  conversation_not_found: { message: "No se encontró esta conversación. Cierra el panel y ábrelo de nuevo para empezar una nueva.", status: "danger" },
  organization_access_denied: { message: "No tienes acceso a esta organización.", status: "danger" },
};
const CHAT_TURN_STATUS_MESSAGES: Record<string, ChatError> = {
  budget_exceeded: { message: "Esta pregunta superó el presupuesto máximo por turno. Prueba con una pregunta más concreta.", status: "warning" },
  rejected_output: { message: "La respuesta generada no pasó los controles de calidad. Intenta reformular la pregunta.", status: "danger" },
};

// Preguntas de arranque por módulo: son las que un consultor hace de verdad
// al abrir esa pantalla, no ejemplos genéricos. La ruta más específica gana.
const VIEW_PROMPTS: Array<{ prefix: string; prompts: string[] }> = [
  { prefix: "/planificacion", prompts: ["¿Qué debería entrar en el plan de las próximas 2 semanas y por qué?", "¿Qué acción del calendario tiene menos sentido con los datos de ahora?"] },
  { prefix: "/marketing", prompts: ["¿Qué campaña de email tiene mejor retorno y cuál habría que rehacer?", "¿Sobre qué producto conviene construir la próxima campaña?"] },
  { prefix: "/tareas", prompts: ["De las tareas abiertas, ¿cuál mueve más la aguja esta semana?", "¿Hay tareas abiertas que ya no tengan sentido con los datos actuales?"] },
  { prefix: "/llamadas", prompts: ["¿Qué debería llevar preparado a la próxima llamada con este cliente?", "¿Qué se comprometió en las últimas llamadas y sigue sin hacerse?"] },
  { prefix: "/camino", prompts: ["¿Qué bloquea el hito actual del plan?", "¿El siguiente hito es el correcto con los datos de ahora?"] },
  { prefix: "/shopify", prompts: ["¿Qué productos concentran la caída de ventas?", "¿Dónde se está perdiendo margen en esta tienda?"] },
  { prefix: "/meta", prompts: ["¿Qué creatividad hay que retirar y cuál escalar?", "¿Algún cambio reciente en la cuenta explica la caída?"] },
  { prefix: "/integraciones", prompts: ["¿Qué datos me faltan para poder asesorar bien a este cliente?"] },
  { prefix: "/conocimiento", prompts: ["¿Qué dice la metodología sobre la fase en la que está este cliente?"] },
  { prefix: "/dashboard", prompts: ["¿Qué ha pasado con las ventas en este periodo y por qué?", "Si solo pudiera hacer una cosa esta semana con este cliente, ¿cuál sería?"] },
];

const DEFAULT_PROMPTS = [
  "¿Cómo va este cliente y qué es lo más urgente?",
  "¿Qué recomendarías hacer esta semana y con qué datos lo justificas?",
];

function promptsForView(view: CopilotView | undefined) {
  if (!view) return DEFAULT_PROMPTS;
  const match = VIEW_PROMPTS.filter((entry) => view.route.startsWith(entry.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return match?.prompts ?? DEFAULT_PROMPTS;
}

function toViewContext(view: CopilotView | undefined) {
  if (!view) return undefined;
  return {
    route: view.route,
    title: view.title,
    store_id: view.storeId,
    store_label: view.storeLabel,
    period: view.summary?.period,
    metrics: view.summary?.metrics?.map((metric) => ({
      label: metric.label,
      value: metric.value,
      hint: metric.hint,
    })),
    notes: view.summary?.notes,
  };
}

async function readError(response: Response): Promise<ChatError> {
  const body = (await response.json().catch(() => null)) as { error?: string; message?: string; detail?: string; status?: string } | null;
  if (body?.error === "chat_turn_failed" && body.status && CHAT_TURN_STATUS_MESSAGES[body.status]) return CHAT_TURN_STATUS_MESSAGES[body.status];
  if (body?.error && ERROR_MESSAGES[body.error]) return ERROR_MESSAGES[body.error];
  return { message: [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - "), status: "danger" };
}

export function CopilotPanel({
  organizationId,
  organizations = [],
  view,
  onClose,
}: {
  /** Cliente activo del portal. Vacío en vista general del consultor. */
  organizationId: string;
  /** Cartera, para poder elegir cliente sin salir de la vista general. */
  organizations?: Array<{ id: string; name: string }>;
  view?: CopilotView;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  // Cliente elegido dentro del panel cuando el portal está en vista general.
  // No cambia el cliente activo del portal: se pregunta sin salir de donde
  // estás. Con cliente activo manda ese y este estado no se usa.
  const [pickedOrganizationId, setPickedOrganizationId] = useState("");
  const targetOrganizationId = organizationId || pickedOrganizationId;
  const targetOrganizationName = organizations.find(
    (organization) => organization.id === targetOrganizationId,
  )?.name;
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => promptsForView(view), [view]);

  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, [targetOrganizationId]);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages]);

  async function ask(question: string) {
    if (!question || isSending || !targetOrganizationId) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsSending(true);
    setError(null);
    try {
    const response = await apiFetch(`/v1/organizations/${targetOrganizationId}/consultant-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, conversation_id: conversationId ?? undefined, view_context: toViewContext(view) }),
    });
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    const payload = (await response.json()) as { conversation_id: string; output: { answer: string; sources?: ChatSource[]; warnings?: string[] } };
    setConversationId(payload.conversation_id);
    setMessages((prev) => [...prev, { role: "assistant", content: payload.output.answer, sources: payload.output.sources ?? [], warnings: payload.output.warnings ?? [] }]);
    } catch {
      setError({ message: "No se pudo completar la consulta. Revisa la conexión e inténtalo de nuevo.", status: "danger" });
    } finally {
      setIsSending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input.trim());
  }

  return (
    <Drawer isOpen onOpenChange={(open) => !open && onClose()}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right" className="w-full max-w-md">
          <Drawer.Dialog id="copilot-panel">
            <Drawer.Header>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent">Consultor IA</p>
              <Drawer.Heading>Pregunta sobre este negocio</Drawer.Heading>
              <Drawer.CloseTrigger aria-label="Cerrar Consultor IA" />
              {/* Qué está viendo el agente: si el consultor no sabe que la
                  pantalla viaja con la pregunta, no la usa. */}
              {view ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {targetOrganizationName ? <Badge tone="brand">{targetOrganizationName}</Badge> : null}
                  <Badge tone="neutral">{view.title}</Badge>
                  {view.storeLabel ? <Badge tone="neutral">{view.storeLabel}</Badge> : null}
                  {view.summary?.period ? <Badge tone="neutral">{view.summary.period}</Badge> : null}
                </div>
              ) : null}
            </Drawer.Header>
            <Drawer.Body>
              <div
                ref={scrollRef}
                className="space-y-4"
                role="log"
                aria-label="Conversación con el Consultor IA"
                aria-live="polite"
                aria-relevant="additions text"
                aria-busy={isSending}
              >
                {!targetOrganizationId ? (
                  // Vista general: A09 razona sobre UN cliente. Se elige aquí
                  // en vez de mandar al consultor a cambiar el cliente activo
                  // del portal y perder la pantalla en la que estaba.
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      El Consultor IA analiza un cliente cada vez. Elige sobre cuál quieres preguntar.
                    </p>
                    <Field label="Cliente">
                      <Select
                        aria-label="Cliente sobre el que preguntar"
                        className="mt-2"
                        value={pickedOrganizationId}
                        onChange={setPickedOrganizationId}
                        options={[
                          { value: "", label: "Elige un cliente" },
                          ...organizations.map((organization) => ({
                            value: organization.id,
                            label: organization.name,
                          })),
                        ]}
                      />
                    </Field>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      Analiza los datos reales de este cliente y la metodología de Conocimiento. Responde con cifras citadas y la siguiente acción; no escribe nada en la cuenta.
                    </p>
                    <div className="flex flex-col items-start gap-2">
                      {suggestions.map((suggestion) => (
                        <Button key={suggestion} variant="secondary" size="sm" className="text-left" onClick={() => void ask(suggestion)}>
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => message.role === "assistant" ? (
                    <Card key={index} kicker="Consultor IA">
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      <AiEvidence sources={message.sources ?? []} warnings={message.warnings ?? []} />
                    </Card>
                  ) : (
                    <Card key={index} kicker="Tú" className="bg-surface">
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    </Card>
                  ))
                )}
                {isSending ? <p className="text-sm text-muted">Analizando...</p> : null}
                {error ? <Alert status={error.status} role="alert"><Alert.Indicator /><Alert.Content><Alert.Description>{error.message}</Alert.Description></Alert.Content></Alert> : null}
              </div>
            </Drawer.Body>
            <Drawer.Footer className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <form className="flex w-full items-center gap-2" onSubmit={submit}>
                <Input className="w-full" aria-label="Pregunta para el Consultor IA" value={input} onChange={(event) => setInput(event.target.value)} placeholder={targetOrganizationId ? "Ej: ¿por qué han bajado los pedidos?" : "Elige un cliente para empezar"} disabled={isSending || !targetOrganizationId} />
                <Button type="submit" disabled={isSending || !input.trim() || !targetOrganizationId}>Enviar</Button>
              </form>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
