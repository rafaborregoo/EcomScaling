"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import {
  AiEvidence,
  Alert,
  Badge,
  Button,
  Card,
  CloseIcon,
  Drawer,
  Field,
  Input,
  Link,
  PlusIcon,
  Select,
  SparklesIcon,
} from "@/components/ui";
import type { ModuleSummaryData } from "@/components/module-summary";
import type { CopilotAsk } from "@/components/copilot-ask";
import { CopilotSaldo, type CopilotBalance } from "@/components/copilot-saldo";
import {
  resolveCopilotUiAction,
  type CopilotUiAction,
  type ResolvedCopilotUiAction,
} from "@/lib/insights-registry";

type ChatSource = { kind: string; reference: string; period: string | null };
type ChatUsage = {
  input_tokens?: number;
  output_tokens?: number;
  model_calls?: number;
  tool_calls?: number;
  estimated_cost_usd?: number;
  latency_ms?: number;
};
type ChatProposalEvidence = {
  label: string;
  value: string;
  period: string | null;
  source: string;
};
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  confidence?: "low" | "medium" | "high";
  warnings?: string[];
  summary?: string;
  findings?: Array<{
    title: string;
    detail: string;
    impact?: "low" | "medium" | "high";
  }>;
  recommendation?: string;
  next_action?: string;
  uiActions?: ResolvedCopilotUiAction[];
  messageId?: string | null;
  outputId?: string | null;
  approvalRequired?: boolean;
  approvalStatus?: "pending_approval" | "approved" | "rejected";
  tasksCreated?: number;
  feedback?: "helpful" | "not_helpful";
  usage?: ChatUsage;
  proposedWrites?: Array<{
    kind: "task" | "note";
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    rationale: string;
    evidence: ChatProposalEvidence[];
  }>;
};
type ChatError = { message: string; status: "warning" | "danger" };
type Conversation = { id: string; title: string; updated_at: string };

function resolveUiActions(actions: unknown): ResolvedCopilotUiAction[] {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((action) => resolveCopilotUiAction(action))
    .filter((action): action is ResolvedCopilotUiAction => action !== null);
}

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
  ai_runtime_not_configured: {
    message:
      "El asistente de IA no está disponible ahora mismo. Vuelve a intentarlo más tarde.",
    status: "warning",
  },
  organization_daily_budget_exceeded: {
    message:
      "Esta organización alcanzó su límite diario de uso de IA. El Consultor IA se reactiva al empezar el día siguiente.",
    status: "warning",
  },
  organization_daily_budget_unavailable: {
    message:
      "No se pudo comprobar el presupuesto diario de IA. El Consultor IA queda pausado temporalmente para proteger la cuenta.",
    status: "warning",
  },
  conversation_not_found: {
    message:
      "No se encontró esta conversación. Cierra el panel y ábrelo de nuevo para empezar una nueva.",
    status: "danger",
  },
  organization_access_denied: {
    message: "No tienes acceso a esta organización.",
    status: "danger",
  },
};
const CHAT_TURN_STATUS_MESSAGES: Record<string, ChatError> = {
  budget_exceeded: {
    message:
      "Esta pregunta superó el presupuesto máximo por turno. Prueba con una pregunta más concreta.",
    status: "warning",
  },
  rejected_output: {
    message:
      "La respuesta generada no pasó los controles de calidad. Intenta reformular la pregunta.",
    status: "danger",
  },
};

// Preguntas de arranque por módulo: son las que un consultor hace de verdad
// al abrir esa pantalla, no ejemplos genéricos. La ruta más específica gana.
const VIEW_PROMPTS: Array<{ prefix: string; prompts: string[] }> = [
  {
    prefix: "/shopify/diagnostico",
    prompts: [
      "¿Qué decisión está bloqueada y qué evidencia falta para poder recomendar?",
      "¿Qué playbook de F5 podría aplicar y qué unknowns hay que validar primero?",
    ],
  },
  {
    prefix: "/planificacion",
    prompts: [
      "¿Qué debería entrar en el plan de las próximas 2 semanas y por qué?",
      "¿Qué acción del calendario tiene menos sentido con los datos de ahora?",
    ],
  },
  {
    prefix: "/marketing",
    prompts: [
      "¿Qué campaña de email tiene mejor retorno y cuál habría que rehacer?",
      "¿Sobre qué producto conviene construir la próxima campaña?",
    ],
  },
  {
    prefix: "/tareas",
    prompts: [
      "De las tareas abiertas, ¿cuál mueve más la aguja esta semana?",
      "¿Hay tareas abiertas que ya no tengan sentido con los datos actuales?",
    ],
  },
  {
    prefix: "/llamadas",
    prompts: [
      "¿Qué debería llevar preparado a la próxima llamada con este cliente?",
      "¿Qué se comprometió en las últimas llamadas y sigue sin hacerse?",
    ],
  },
  {
    prefix: "/camino",
    prompts: [
      "¿Qué bloquea el hito actual del plan?",
      "¿El siguiente hito es el correcto con los datos de ahora?",
    ],
  },
  {
    prefix: "/shopify",
    prompts: [
      "¿Qué productos concentran la caída de ventas?",
      "¿Dónde se está perdiendo margen en esta tienda?",
    ],
  },
  {
    prefix: "/meta",
    prompts: [
      "¿Qué creatividad hay que retirar y cuál escalar?",
      "¿Algún cambio reciente en la cuenta explica la caída?",
    ],
  },
  {
    prefix: "/integraciones",
    prompts: ["¿Qué datos me faltan para poder asesorar bien a este cliente?"],
  },
  {
    prefix: "/conocimiento",
    prompts: [
      "¿Qué dice la metodología sobre la fase en la que está este cliente?",
    ],
  },
  {
    prefix: "/dashboard",
    prompts: [
      "¿Qué ha pasado con las ventas en este periodo y por qué?",
      "Si solo pudiera hacer una cosa esta semana con este cliente, ¿cuál sería?",
    ],
  },
];

const DEFAULT_PROMPTS = [
  "¿Cómo va este cliente y qué es lo más urgente?",
  "¿Qué recomendarías hacer esta semana y con qué datos lo justificas?",
];

function promptsForView(view: CopilotView | undefined) {
  if (!view) return DEFAULT_PROMPTS;
  const match = VIEW_PROMPTS.filter((entry) =>
    view.route.startsWith(entry.prefix),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
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
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
    detail?: string;
    status?: string;
  } | null;
  if (
    body?.error === "chat_turn_failed" &&
    body.status &&
    CHAT_TURN_STATUS_MESSAGES[body.status]
  )
    return CHAT_TURN_STATUS_MESSAGES[body.status];
  if (body?.error && ERROR_MESSAGES[body.error])
    return ERROR_MESSAGES[body.error];
  return {
    message: [
      body?.error ?? `HTTP ${response.status}`,
      body?.message,
      body?.detail,
    ]
      .filter(Boolean)
      .join(" - "),
    status: "danger",
  };
}

export function CopilotPanel({
  organizationId,
  organizations = [],
  view,
  ask: pending,
  onClose,
}: {
  /** Cliente activo del portal. Vacío en vista general del consultor. */
  organizationId: string;
  /** Cartera, para poder elegir cliente sin salir de la vista general. */
  organizations?: Array<{ id: string; name: string }>;
  view?: CopilotView;
  /** Pregunta con la que se abrió el panel desde un módulo (ver copilot-ask.tsx). */
  ask?: CopilotAsk | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [decisionIndex, setDecisionIndex] = useState<number | null>(null);
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  // Cliente elegido dentro del panel cuando el portal está en vista general.
  // No cambia el cliente activo del portal: se pregunta sin salir de donde
  // estás. Con cliente activo manda ese y este estado no se usa.
  const [pickedOrganizationId, setPickedOrganizationId] = useState("");
  // Saldo de tokens del mes. Se lee UNA vez al abrir el panel; a partir de ahi
  // viaja en la respuesta de cada mensaje, que es justo cuando cambia. Pedirlo
  // aparte despues de cada turno seria un viaje al servidor para enterarse de
  // algo que el turno ya sabia.
  const [balance, setBalance] = useState<CopilotBalance | null>(null);
  const [model, setModel] = useState("sonnet");
  const [degraded, setDegraded] = useState(false);
  const [activityStage, setActivityStage] = useState(0);
  // El rail y el drawer son la misma conversación. Decidir la presentación en
  // cliente evita duplicar el chat (y sus llamadas de saldo) solo para aplicar
  // una media query. Antes de hidratar usamos drawer: es la opción segura para
  // SSR y para cualquier viewport estrecho.
  const [isDesktop, setIsDesktop] = useState(false);
  const targetOrganizationId = organizationId || pickedOrganizationId;
  const targetOrganizationName = organizations.find(
    (organization) => organization.id === targetOrganizationId,
  )?.name;
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => promptsForView(view), [view]);
  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLocaleLowerCase().includes(query),
    );
  }, [conversations, historyQuery]);
  // Qué respuesta se está guardando en el hilo del artefacto, y cuáles ya
  // están guardadas (para no dejar dos veces el mismo análisis).
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<number[]>([]);
  // La pregunta enganchada se lanza una vez por nonce: sin esto, cualquier
  // re-render del portal la volvería a enviar y se pagaría el turno otra vez.
  const askedKeyRef = useRef<number | null>(null);

  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setConversations([]);
    setHistoryQuery("");
    setError(null);
    setSavedIndexes([]);
    setDegraded(false);
  }, [targetOrganizationId]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  async function loadConversation(id: string) {
    if (!targetOrganizationId || isSending) return;
    setIsLoadingConversation(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${targetOrganizationId}/consultant-chat/conversations/${id}`,
      );
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const payload = (await response.json()) as {
        conversation_id: string;
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          output_id?: string | null;
          approval_required?: boolean;
          approval_status?: "pending_approval" | "approved" | "rejected";
          proposed_writes?: ChatMessage["proposedWrites"];
          ui_actions?: CopilotUiAction[];
          tasks_created?: number;
          feedback_rating?: "helpful" | "not_helpful";
          usage?: ChatUsage;
        }>;
      };
      setConversationId(payload.conversation_id);
      setMessages(
        payload.messages.map((message) => ({
          role: message.role,
          content: message.content,
          messageId: message.id,
          outputId: message.output_id,
          approvalRequired: message.approval_required,
          approvalStatus: message.approval_status,
          proposedWrites: message.proposed_writes,
          uiActions: resolveUiActions(message.ui_actions),
          tasksCreated: message.tasks_created,
          feedback: message.feedback_rating,
          usage: message.usage,
        })),
      );
    } catch {
      setError({
        message: "No se pudo recuperar esta conversación. Inténtalo de nuevo.",
        status: "danger",
      });
    } finally {
      setIsLoadingConversation(false);
    }
  }

  useEffect(() => {
    if (!targetOrganizationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch(
          `/v1/organizations/${targetOrganizationId}/consultant-chat/conversations`,
        );
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as {
          conversations?: Conversation[];
        };
        if (cancelled) return;
        const recent = payload.conversations ?? [];
        setConversations(recent);
        if (recent[0]) void loadConversation(recent[0].id);
      } catch {
        // El historial complementa el chat: si falla, aún se puede empezar uno.
      }
    })();
    return () => {
      cancelled = true;
    };
    // loadConversation cierra sobre el turno: cargar solo al cambiar cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrganizationId]);

  useEffect(() => {
    if (!targetOrganizationId) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch(
          `/v1/organizations/${targetOrganizationId}/copilot/saldo`,
        );
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as CopilotBalance;
        if (cancelled) return;
        setBalance(payload);
        // El modelo por defecto es el primero que el plan ofrezca: Sonnet.
        setModel(payload.models?.[0]?.id ?? "sonnet");
      } catch {
        // El saldo es informativo: si no se puede leer, el copiloto funciona
        // igual y simplemente no se pinta la barra. Un error aqui no puede
        // impedir preguntar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetOrganizationId]);
  useEffect(() => {
    if (!isSending) {
      setActivityStage(0);
      return;
    }
    setActivityStage(0);
    const timer = window.setInterval(() => {
      setActivityStage((current) => Math.min(current + 1, 3));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isSending]);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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
      const response = await apiFetch(
        `/v1/organizations/${targetOrganizationId}/consultant-chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            conversation_id: conversationId ?? undefined,
            view_context: toViewContext(view),
            model,
          }),
        },
      );
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const payload = (await response.json()) as {
        conversation_id: string;
        message_id?: string | null;
        output_id?: string | null;
        approval_required?: boolean;
        output: {
          answer: string;
          sources?: ChatSource[];
          confidence?: "low" | "medium" | "high";
          warnings?: string[];
          summary?: string;
          findings?: ChatMessage["findings"];
          recommendation?: string;
          next_action?: string;
          ui_actions?: CopilotUiAction[];
          proposed_writes?: ChatMessage["proposedWrites"];
        };
        saldo?: CopilotBalance;
        model?: { id: string; label: string; degraded: boolean };
        usage?: ChatUsage;
      };
      setConversationId(payload.conversation_id);
      setConversations((previous) => {
        const current = previous.find(
          (conversation) => conversation.id === payload.conversation_id,
        );
        const next = {
          id: payload.conversation_id,
          title: current?.title ?? question.slice(0, 80),
          updated_at: new Date().toISOString(),
        };
        return [next, ...previous.filter((item) => item.id !== next.id)].slice(
          0,
          20,
        );
      });
      if (payload.saldo) {
        // Se conservan los modelos del plan: el turno devuelve el saldo, no el
        // catalogo, y perderlos vaciaria el selector tras la primera pregunta.
        setBalance((prev) => ({
          ...payload.saldo!,
          models: prev?.models ?? [],
        }));
      }
      setDegraded(Boolean(payload.model?.degraded));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload.output.answer,
          sources: payload.output.sources ?? [],
          confidence: payload.output.confidence,
          warnings: payload.output.warnings ?? [],
          summary: payload.output.summary,
          findings: payload.output.findings,
          recommendation: payload.output.recommendation,
          next_action: payload.output.next_action,
          uiActions: resolveUiActions(payload.output.ui_actions),
          messageId: payload.message_id,
          outputId: payload.output_id,
          approvalRequired: payload.approval_required,
          approvalStatus: payload.approval_required
            ? "pending_approval"
            : undefined,
          proposedWrites: payload.output.proposed_writes,
          usage: payload.usage,
        },
      ]);
    } catch {
      setError({
        message:
          "No se pudo completar la consulta. Revisa la conexión e inténtalo de nuevo.",
        status: "danger",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function decideProposal(
    index: number,
    outputId: string,
    decision: "approved" | "rejected",
  ) {
    setDecisionIndex(index);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${targetOrganizationId}/ai/outputs/${outputId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reason:
              decision === "approved"
                ? "Aprobada desde el Consultor IA"
                : "Rechazada desde el Consultor IA",
          }),
        },
      );
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const decisionPayload = (await response.json()) as {
        status?: string;
        tasks_created?: number;
      };
      setMessages((previous) =>
        previous.map((message, messageIndex) =>
          messageIndex === index
            ? {
                ...message,
                approvalStatus: decision,
                tasksCreated: decisionPayload.tasks_created ?? 0,
              }
            : message,
        ),
      );
    } catch {
      setError({
        message: "No se pudo registrar la decisión sobre la propuesta.",
        status: "danger",
      });
    } finally {
      setDecisionIndex(null);
    }
  }

  async function sendFeedback(
    index: number,
    messageId: string,
    rating: "helpful" | "not_helpful",
  ) {
    setFeedbackIndex(index);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${targetOrganizationId}/consultant-chat/messages/${messageId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        },
      );
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setMessages((previous) =>
        previous.map((message, messageIndex) =>
          messageIndex === index ? { ...message, feedback: rating } : message,
        ),
      );
    } catch {
      setError({
        message: "No se pudo guardar el feedback de esta respuesta.",
        status: "danger",
      });
    } finally {
      setFeedbackIndex(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input.trim());
  }

  // El módulo abrió el panel con una pregunta ya escrita: se envía sola. Si
  // hubiera que pulsar "enviar", el botón "Analizar con el Consultor IA" sería
  // un botón que solo rellena un input.
  useEffect(() => {
    if (!pending || !targetOrganizationId) return;
    if (askedKeyRef.current === pending.key) return;
    askedKeyRef.current = pending.key;
    void ask(pending.question);
    // `ask` se redefine en cada render (cierra sobre el estado del chat); la
    // guarda de arriba es lo que hace que esto corra una vez por pregunta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, targetOrganizationId]);

  async function saveAnswer(index: number, text: string) {
    if (!pending?.saveAnswer) return;
    setSavingIndex(index);
    try {
      await pending.saveAnswer(text);
      setSavedIndexes((prev) => [...prev, index]);
    } catch {
      setError({
        message: "No se pudo dejar el análisis en el hilo. Reinténtalo.",
        status: "danger",
      });
    } finally {
      setSavingIndex(null);
    }
  }

  const panel = (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-white">
      <header className="shrink-0 border-b border-separator px-4 py-2">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#294597]">
            Consultor IA
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setConversationId(null);
                setMessages([]);
                setError(null);
              }}
              aria-label="Nueva conversación"
              title="Nueva conversación"
              className="flex size-9 items-center justify-center rounded hover:bg-surface"
            >
              <PlusIcon aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Consultor IA"
              className="flex size-9 items-center justify-center rounded hover:bg-surface"
            >
              <CloseIcon aria-hidden />
            </button>
          </div>
        </div>
        {/* Qué está viendo el agente: si el consultor no sabe que la
                  pantalla viaja con la pregunta, no la usa. */}
        {view ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {targetOrganizationName ? (
              <Badge tone="brand">{targetOrganizationName}</Badge>
            ) : null}
            <Badge tone="neutral">{view.title}</Badge>
            {view.storeLabel ? (
              <Badge tone="neutral">{view.storeLabel}</Badge>
            ) : null}
            {view.summary?.period ? (
              <Badge tone="neutral">{view.summary.period}</Badge>
            ) : null}
            {pending?.focusLabel ? (
              <Badge tone="brand">{pending.focusLabel}</Badge>
            ) : null}
          </div>
        ) : null}
        {targetOrganizationId && conversations.length > 0 ? (
          <div className="mt-3 space-y-2">
            <Input
              aria-label="Buscar conversaciones"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Buscar en tus conversaciones"
              className="w-full"
            />
            {filteredConversations.length > 0 ? (
              <Select
                bare
                aria-label="Conversación reciente"
                className="max-w-full"
                value={conversationId ?? ""}
                onChange={(id) => void loadConversation(id)}
                options={filteredConversations.map((conversation) => ({
                  value: conversation.id,
                  label: conversation.title || "Conversación sin título",
                }))}
              />
            ) : (
              <p className="px-1 text-xs text-muted">
                No hay conversaciones que coincidan.
              </p>
            )}
          </div>
        ) : null}
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
        <div
          ref={scrollRef}
          className="min-w-0 space-y-4 [overflow-wrap:anywhere]"
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
                El Consultor IA analiza un cliente cada vez. Elige sobre cuál
                quieres preguntar.
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
                Analiza los datos reales de este cliente y la metodología de
                Conocimiento. Responde con cifras citadas y la siguiente acción;
                no escribe nada en la cuenta.
              </p>
              <div className="flex w-full min-w-0 flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="secondary"
                    size="sm"
                    className="h-auto w-full min-w-0 justify-start whitespace-normal break-words px-4 py-2.5 text-left leading-5"
                    onClick={() => void ask(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) =>
              message.role === "assistant" ? (
                <Card key={index} kicker="Consultor IA">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      tone={
                        message.confidence === "high"
                          ? "success"
                          : message.confidence === "low"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {message.confidence === "high"
                        ? "Confianza alta"
                        : message.confidence === "low"
                          ? "Confianza baja"
                          : "Confianza media"}
                    </Badge>
                    <span className="text-xs text-muted">
                      Respuesta del Consultor
                    </span>
                  </div>
                  {message.summary ? (
                    <p className="mb-3 text-sm font-medium leading-5">
                      {message.summary}
                    </p>
                  ) : null}
                  {message.findings?.length ? (
                    <div className="mb-3 space-y-2">
                      {message.findings.map((finding) => (
                        <div
                          key={`${finding.title}:${finding.detail}`}
                          className="border-l-2 border-accent pl-3"
                        >
                          <p className="text-xs font-semibold text-foreground">
                            {finding.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-muted">
                            {finding.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {message.content}
                  </p>
                  {message.recommendation ? (
                    <div className="mt-3 border-t border-separator pt-3">
                      <p className="text-xs font-semibold text-foreground">
                        Recomendación
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {message.recommendation}
                      </p>
                    </div>
                  ) : null}
                  {message.next_action ? (
                    <div className="mt-3 border-l-2 border-accent pl-3">
                      <p className="text-xs font-semibold text-foreground">
                        Siguiente acción
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {message.next_action}
                      </p>
                    </div>
                  ) : null}
                  {message.uiActions?.length ? (
                    <div className="mt-4 border-t border-separator pt-3">
                      <p className="text-xs font-semibold text-foreground">
                        Revisar en el diagnóstico
                      </p>
                      <div className="mt-2 space-y-2">
                        {message.uiActions.map((action) => (
                          <div
                            key={`${action.insight_slug}:${action.label}`}
                            className="flex items-center justify-between gap-3 rounded-md border border-separator bg-surface px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground">
                                {action.target_label}
                              </p>
                              <p className="mt-0.5 text-xs leading-5 text-muted">
                                {action.reason}
                              </p>
                            </div>
                            <Link
                              href={action.href}
                              onClick={onClose}
                              className="shrink-0 rounded-md border border-accent px-2.5 py-1.5 text-xs font-medium text-accent no-underline hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2"
                              aria-label={`${action.label}: ${action.target_label}`}
                            >
                              {action.label}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {message.approvalRequired &&
                  message.proposedWrites?.length ? (
                    <div className="mt-4 border border-warning/40 bg-warn-tint p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          Propuesta sin aplicar
                        </p>
                        <Badge
                          tone={
                            message.approvalStatus === "approved"
                              ? "success"
                              : message.approvalStatus === "rejected"
                                ? "danger"
                                : "warn"
                          }
                        >
                          {message.approvalStatus === "approved"
                            ? "Aprobada"
                            : message.approvalStatus === "rejected"
                              ? "Rechazada"
                              : "Pendiente"}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-2">
                        {message.proposedWrites.map((proposal) => (
                          <div key={`${proposal.kind}:${proposal.title}`}>
                            <p className="text-xs font-medium">
                              {proposal.title}
                            </p>
                            <p className="text-xs leading-5 text-muted">
                              {proposal.description}
                            </p>
                            {proposal.rationale ? (
                              <p className="mt-1 text-xs leading-5 text-muted">
                                <span className="font-medium text-foreground">
                                  Motivo:
                                </span>{" "}
                                {proposal.rationale}
                              </p>
                            ) : null}
                            {proposal.evidence.length > 0 ? (
                              <div className="mt-2 space-y-1 border-l border-separator pl-2">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted">
                                  Evidencia
                                </p>
                                {proposal.evidence.map((evidence) => (
                                  <p
                                    key={`${evidence.label}:${evidence.value}:${evidence.period ?? ""}`}
                                    className="text-[0.7rem] leading-4 text-muted"
                                  >
                                    <span className="font-medium text-foreground">
                                      {evidence.label}: {evidence.value}
                                    </span>{" "}
                                    ({evidence.source}
                                    {evidence.period
                                      ? ` · ${evidence.period}`
                                      : ""}
                                    )
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {message.approvalStatus === "pending_approval" &&
                      message.outputId ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={decisionIndex !== null}
                            onClick={() =>
                              void decideProposal(
                                index,
                                message.outputId!,
                                "approved",
                              )
                            }
                          >
                            {decisionIndex === index
                              ? "Guardando..."
                              : "Aprobar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={decisionIndex !== null}
                            onClick={() =>
                              void decideProposal(
                                index,
                                message.outputId!,
                                "rejected",
                              )
                            }
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : null}
                      {message.approvalStatus === "approved" ? (
                        <p className="mt-3 text-xs text-muted" role="status">
                          Resultado: {message.tasksCreated ?? 0} tarea
                          {(message.tasksCreated ?? 0) === 1
                            ? " creada"
                            : "s creadas"}
                          .
                        </p>
                      ) : null}
                      {message.approvalStatus === "rejected" ? (
                        <p className="mt-3 text-xs text-muted" role="status">
                          Resultado: propuesta rechazada; no se creó ninguna
                          tarea.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <AiEvidence
                    sources={message.sources ?? []}
                    warnings={message.warnings ?? []}
                  />
                  {message.messageId ? (
                    <div className="mt-3 flex items-center gap-2 border-t border-separator pt-2 text-xs text-muted">
                      <span>¿Te ha servido?</span>
                      <Button
                        size="sm"
                        variant={
                          message.feedback === "helpful"
                            ? "primary"
                            : "secondary"
                        }
                        aria-pressed={message.feedback === "helpful"}
                        disabled={feedbackIndex !== null}
                        onClick={() =>
                          void sendFeedback(
                            index,
                            message.messageId!,
                            "helpful",
                          )
                        }
                      >
                        Sí
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          message.feedback === "not_helpful"
                            ? "primary"
                            : "secondary"
                        }
                        aria-pressed={message.feedback === "not_helpful"}
                        disabled={feedbackIndex !== null}
                        onClick={() =>
                          void sendFeedback(
                            index,
                            message.messageId!,
                            "not_helpful",
                          )
                        }
                      >
                        No
                      </Button>
                    </div>
                  ) : null}
                  {message.usage ? (
                    <details className="mt-3 border-t border-separator pt-2 text-xs text-muted">
                      <summary className="cursor-pointer select-none font-medium text-foreground">
                        Actividad del turno
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <span>Tools: {message.usage.tool_calls ?? 0}</span>
                        <span>Modelo: {message.usage.model_calls ?? 1}</span>
                        <span>
                          Tiempo:{" "}
                          {message.usage.latency_ms
                            ? `${(message.usage.latency_ms / 1000).toFixed(1)} s`
                            : "—"}
                        </span>
                        <span>
                          Coste:{" "}
                          {message.usage.estimated_cost_usd != null
                            ? `$${message.usage.estimated_cost_usd.toFixed(4)}`
                            : "—"}
                        </span>
                      </div>
                    </details>
                  ) : null}
                  {/* El análisis se queda en la conversación de la pieza,
                          firmado como IA, para que lo vea también el otro lado
                          en vez de morir al cerrar el panel. */}
                  {pending?.saveAnswer ? (
                    savedIndexes.includes(index) ? (
                      <p className="mt-3 text-xs text-muted">
                        Guardado en el hilo de la pieza.
                      </p>
                    ) : (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="secondary"
                        disabled={savingIndex !== null}
                        onClick={() => void saveAnswer(index, message.content)}
                      >
                        {savingIndex === index
                          ? "Guardando…"
                          : "Dejar en el hilo de la pieza"}
                      </Button>
                    )
                  ) : null}
                </Card>
              ) : (
                <Card key={index} kicker="Tú" className="bg-surface">
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {message.content}
                  </p>
                </Card>
              ),
            )
          )}
          {isLoadingConversation ? (
            <p
              className="flex items-center gap-2 text-sm text-muted"
              role="status"
            >
              <SparklesIcon aria-hidden className="size-4 text-accent" />
              Recuperando conversacion...
            </p>
          ) : null}
          {isSending ? (
            <div
              className="rounded border border-accent/20 bg-surface px-3 py-2.5"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <SparklesIcon aria-hidden className="size-4 text-accent" />
                El Consultor IA esta trabajando
              </div>
              <ol className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-4">
                {["Contexto", "Herramientas", "Validacion", "Respuesta"].map(
                  (stage, index) => (
                    <li
                      key={stage}
                      className={
                        index <= activityStage
                          ? "font-medium text-foreground"
                          : "opacity-60"
                      }
                    >
                      <span className="mr-1 inline-flex size-4 items-center justify-center rounded-full border border-current text-[0.65rem]">
                        {index + 1}
                      </span>
                      {stage}
                    </li>
                  ),
                )}
              </ol>
            </div>
          ) : null}{" "}
          {error ? (
            <Alert status={error.status} role="alert">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{error.message}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </div>
      </div>
      <footer className="shrink-0 border-t border-separator px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 border-b border-separator pb-2.5">
          <CopilotSaldo
            balance={balance}
            model={model}
            onModelChange={setModel}
            degraded={degraded}
          />
        </div>
        <form className="flex w-full items-stretch gap-2" onSubmit={submit}>
          <Input
            className="min-h-12 min-w-0 flex-1"
            aria-label="Pregunta para el Consultor IA"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              targetOrganizationId
                ? "Ej: ¿por qué han bajado los pedidos?"
                : "Elige un cliente para empezar"
            }
            disabled={isSending || !targetOrganizationId}
          />
          <Button
            type="submit"
            className="shrink-0 px-4"
            disabled={isSending || !input.trim() || !targetOrganizationId}
          >
            Enviar
          </Button>
        </form>
      </footer>
    </div>
  );

  if (isDesktop) {
    return (
      <aside
        id="copilot-panel"
        aria-label="Consultor IA"
        className="sticky top-0 hidden h-dvh min-h-0 border-l border-separator bg-white lg:block"
      >
        {panel}
      </aside>
    );
  }

  return (
    <Drawer isOpen onOpenChange={(open) => !open && onClose()}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right" className="w-full max-w-md">
          <Drawer.Dialog id="copilot-panel">{panel}</Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
