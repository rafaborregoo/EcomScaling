"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import {
  AiEvidence,
  Alert,
  Button,
  ButtonLink,
  CheckIcon,
  Checkbox,
  Sparkline,
  ClockIcon,
  CloseIcon,
  DownloadIcon,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  Sheet,
  Field,
  Input,
  Link,
  Markdown,
  PlusIcon,
  RetryIcon,
  SearchIcon,
  Select,
  SparklesIcon,
} from "@/components/ui";
import styles from "./copilot-panel.module.css";
import {
  copilotToolLabel,
  expandCopilotCommand,
  matchingCopilotCommands,
} from "@/lib/copilot-tools";

// El modelo a veces escapa los saltos de linea dentro del JSON y llegan como
// "\n" literal; se normalizan antes de pintar el markdown.
const answerText = (text: string) => text.replace(/\\n/g, "\n");
import type { ModuleSummaryData } from "@/components/module-summary";
import type { CopilotAsk } from "@/components/copilot-ask";
import type { CopilotEvidenceReference } from "@e-nora/contracts";
import { CopilotModelMenu, CopilotSaldo, type CopilotBalance } from "@/components/copilot-saldo";
import {
  resolveCopilotUiAction,
  type CopilotUiAction,
  type ResolvedCopilotUiAction,
} from "@/lib/insights-registry";

type ChatSource = { kind: string; reference: string; period: string | null };
type ChatReportArtifact = {
  report_id: string;
  template_id: string;
  template_version: string;
  file_name: string;
  period_start: string;
  period_end: string;
  currency_code: string;
};
const REPORT_TEMPLATE_LABELS: Record<string, string> = {
  shopify_comercial: "Ventas y producto",
  shopify_rentabilidad: "Rentabilidad y costes",
  shopify_clientes: "Clientes y recompra",
  meta_publicidad: "Publicidad de Meta",
  klaviyo_email: "Email y automatizaciones",
  adquisicion_multicanal: "Adquisición y atribución",
  resumen_multicanal: "Resumen ejecutivo",
};

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.15 1.6 5.96L.05 24l6.28-1.65a11.9 11.9 0 0 0 5.74 1.47h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.49-8.41ZM12.08 21.8a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.73.98 1-3.64-.23-.37a9.84 9.84 0 0 1-1.52-5.25c0-5.45 4.43-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.9 6.99c0 5.45-4.44 9.86-9.9 9.86Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.23-.65.08-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.48.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.08-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={`size-4 ${down ? "-scale-y-100" : ""}`}
    >
      <path d="M5 7.5V14H3V7.5zM5 7.5 8 2c1.2 0 2 .8 2 2v2.5h3.2c.9 0 1.5.8 1.3 1.7l-1.1 4.6c-.2.7-.8 1.2-1.5 1.2H5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}

/** Lo que viaja con la pregunta, junto al cursor; quitable si es opcional. */
function ContextChip({
  label,
  value,
  focus = false,
  onRemove,
}: {
  label: string;
  value: string;
  focus?: boolean;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-md border py-0.5 pl-2 text-xs ${
        onRemove ? "pr-0.5" : "pr-2"
      } ${focus ? "border-accent/30 bg-accent-soft text-accent" : "border-separator bg-surface text-muted"}`}
    >
      {label}
      <span className={`truncate font-medium ${focus ? "" : "text-foreground"}`}>{value}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${label.toLocaleLowerCase()}`}
          className="flex size-5 items-center justify-center rounded hover:bg-separator hover:text-foreground"
        >
          <CloseIcon aria-hidden className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
type ChatUsage = {
  input_tokens?: number;
  output_tokens?: number;
  model_calls?: number;
  tool_calls?: number;
  estimated_cost_usd?: number;
  latency_ms?: number;
};
type CopilotTurnPayload = {
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
    key_figures?: KeyFigure[];
    ui_actions?: CopilotUiAction[];
    proposed_writes?: ChatMessage["proposedWrites"];
  };
  proposal_guidance?: ChatProposalGuidance | null;
  saldo?: CopilotBalance;
  can_upgrade?: boolean;
  model?: { id: string; label: string; effective_model?: string; degraded: boolean };
  usage?: ChatUsage;
  report_artifacts?: ChatReportArtifact[];
};

type CopilotWireEvent =
  | { type: "stage"; stage: "context" | "model" | "tools" | "validation" }
  | { type: "answer_delta"; delta: string }
  | { type: "answer_reset" }
  | ({ type: "tool" } & ToolTrace)
  | { type: "heartbeat" }
  | { type: "done"; data: CopilotTurnPayload }
  | { type: "error"; error: { error?: string; status?: string; statusCode?: number; message?: string; detail?: string } };

async function readCopilotStream(
  response: Response,
  onEvent: (event: CopilotWireEvent) => void,
): Promise<CopilotTurnPayload> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("El navegador no puede leer la respuesta en directo.");
  const decoder = new TextDecoder();
  let pending = "";
  let result: CopilotTurnPayload | null = null;
  const acceptLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as CopilotWireEvent;
    onEvent(event);
    if (event.type === "done") result = event.data;
    if (event.type === "error") {
      throw new Error(JSON.stringify(event.error));
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let newline = pending.indexOf("\n");
      while (newline >= 0) {
        acceptLine(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        newline = pending.indexOf("\n");
      }
      if (done) break;
    }
    acceptLine(pending);
  } finally {
    reader.releaseLock();
  }
  if (!result) throw new Error("La respuesta se interrumpió antes de terminar.");
  return result;
}
type ToolTrace = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  latency_ms?: number;
};
type KeyFigure = {
  label: string;
  value: string;
  change: string | null;
  direction: "up" | "down" | "flat" | null;
  good_direction?: "up" | "down" | null;
  series?: number[] | null;
  period: string | null;
  source: string;
};
type ChatProposalEvidence = {
  label: string;
  value: string;
  period: string | null;
  source: string;
};
type ChatProposalGuidance = {
  reviewer: "assigned_consultant" | "client" | "unverified";
  reviewer_name: string | null;
  destination: "tasks";
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
  keyFigures?: KeyFigure[];
  /** Herramientas usadas en el turno; solo existe en turnos vistos en directo. */
  tools?: ToolTrace[];
  elapsedMs?: number;
  /** El usuario detuvo la respuesta antes de que terminara. */
  stopped?: boolean;
  uiActions?: ResolvedCopilotUiAction[];
  reportArtifacts?: ChatReportArtifact[];
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
    effort_estimate?: "low" | "medium" | "high" | "unknown";
    financial_cost_estimate?: { amount: number; currency: string; basis: string } | null;
  }>;
  proposalGuidance?: ChatProposalGuidance | null;
};
type HistoryCursor = { created_at: string; id: string };
type ChatHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  copilot_output?: CopilotTurnPayload["output"];
  output_id?: string | null;
  approval_required?: boolean;
  approval_status?: "pending_approval" | "approved" | "rejected";
  proposed_writes?: ChatMessage["proposedWrites"];
  proposal_guidance?: ChatProposalGuidance | null;
  ui_actions?: CopilotUiAction[];
  tasks_created?: number;
  feedback_rating?: "helpful" | "not_helpful";
  usage?: ChatUsage;
  report_artifacts?: ChatReportArtifact[];
};

function mapChatHistoryMessage(message: ChatHistoryMessage): ChatMessage {
  return {
    role: message.role,
    content: message.content,
    sources: message.copilot_output?.sources ?? [],
    confidence: message.copilot_output?.confidence,
    warnings: message.copilot_output?.warnings ?? [],
    summary: message.copilot_output?.summary,
    findings: message.copilot_output?.findings,
    recommendation: message.copilot_output?.recommendation,
    next_action: message.copilot_output?.next_action,
    keyFigures: message.copilot_output?.key_figures ?? [],
    uiActions: resolveUiActions(message.ui_actions ?? message.copilot_output?.ui_actions),
    messageId: message.id,
    outputId: message.output_id,
    approvalRequired: message.approval_required,
    approvalStatus: message.approval_status,
    proposedWrites: message.proposed_writes,
    proposalGuidance: message.proposal_guidance,
    tasksCreated: message.tasks_created,
    feedback: message.feedback_rating,
    usage: message.usage,
    reportArtifacts: message.report_artifacts ?? [],
  };
}
type RetryTurn = {
  question: string;
  id: string;
  reference?: CopilotEvidenceReference;
  /** Cuándo se lanzó. Un turno no dura más que RECOVERY_TTL_MS. */
  createdAt?: number;
  /** Only a terminal server failure permits a fresh attempt; network loss must recover by the original ID. */
  confirmedFailed?: boolean;
};
// Pasado este tiempo el turno ya terminó o murió en el servidor: ofrecer
// recuperarlo solo deja un aviso colgado que nadie sabe cerrar.
const RECOVERY_TTL_MS = 5 * 60_000;

/** ¿La conversación cargada ya contiene la respuesta a esta pregunta? */
function turnAlreadyAnswered(messages: ChatMessage[], question: string) {
  return messages.some(
    (message, index) =>
      message.role === "user" &&
      message.content === question &&
      messages[index + 1]?.role === "assistant",
  );
}
type ChatError = { message: string; status: "warning" | "danger"; code?: string };
type CopilotEscalation = {
  id: string;
  reason: string;
  risk: string;
  blocking_questions: string[];
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  owner_user_id: string | null;
  created_at: string;
};
type CopilotEscalationOwner = { id: string; name: string; platform_role: string };
type Conversation = { id: string; title: string; updated_at: string };

const messageKey = (message: ChatMessage, index: number) => message.messageId ?? `local-${index}`;

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const segundos = (ms: number) =>
  `${(ms / 1000).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

const CONFIDENCE = {
  high: { label: "Confianza alta", className: "bg-success/10 text-success" },
  medium: { label: "Confianza media", className: "bg-surface text-muted" },
  low: { label: "Confianza baja", className: "bg-warn-tint text-warning" },
} as const;

const IMPACT = {
  high: { label: "Alto", className: "bg-danger/10 text-danger" },
  medium: { label: "Medio", className: "bg-warn-tint text-warning" },
  low: { label: "Bajo", className: "bg-surface text-muted" },
} as const;

// Bueno o malo solo si sabemos hacia dónde conviene moverse: un coste que
// baja en verde, unas ventas que bajan en rojo. Sin ese dato, neutro.
function figureVerdict(figure: KeyFigure): "good" | "bad" | "neutral" {
  if (!figure.good_direction || (figure.direction !== "up" && figure.direction !== "down")) return "neutral";
  return figure.direction === figure.good_direction ? "good" : "bad";
}

/**
 * Las tareas aprobadas vuelan hasta Tareas en el menú (o hasta la cabecera
 * del panel si el menú no está a la vista): que se vea adónde han ido.
 */
function flyToTasks(sources: DOMRect[], fallback: Element | null) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target =
    [...document.querySelectorAll('a[href="/tareas"]')].find((link) => {
      const rect = link.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    }) ?? fallback;
  if (!target) return;
  const end = target.getBoundingClientRect();
  const to = { x: end.left + end.width / 2, y: end.top + end.height / 2 };
  sources.forEach((start, index) => {
    const dot = document.createElement("div");
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "10px",
      height: "10px",
      borderRadius: "3px",
      background: "var(--accent)",
      zIndex: "100",
      pointerEvents: "none",
    });
    document.body.append(dot);
    const from = { x: start.left + 8, y: start.top + start.height / 2 };
    dot.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(1)`, opacity: 1 },
        {
          transform: `translate(${(from.x + to.x) / 2}px, ${Math.min(from.y, to.y) - 80}px) scale(1.4)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${to.x}px, ${to.y}px) scale(0.4)`, opacity: 0 },
      ],
      { duration: 700, delay: index * 90, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
    ).onfinish = () => dot.remove();
  });
}

const PRIORITY_LABEL = { low: "Prioridad baja", medium: "Prioridad media", high: "Prioridad alta", urgent: "Urgente" } as const;
const EFFORT_LABEL = { low: "Esfuerzo bajo", medium: "Esfuerzo medio", high: "Esfuerzo alto", unknown: "Esfuerzo por estimar" } as const;
const SOURCE_LABEL: Record<string, string> = { shopify: "Shopify", klaviyo: "Klaviyo", meta: "Meta", instagram: "Instagram", interno: "E-NORA" };

// Agrupa el historial como lo recuerda una persona, no por fecha exacta.
function historyGroup(iso: string) {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  const today = new Date().toDateString() === new Date(iso).toDateString();
  if (today) return "Hoy";
  if (days < 7) return "Esta semana";
  return "Antes";
}

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
 * backend lo sanea; una tienda explícita reduce el alcance de las tools y,
 * si no se puede resolver, el turno falla cerrado.
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
  conversation_scope_unknown: {
    message:
      "Este hilo es anterior al aislamiento por tienda. Inicia una conversación nueva para mantener los datos separados.",
    status: "warning",
  },
  conversation_scope_mismatch: {
    message:
      "Este hilo pertenece a otro alcance. Inicia una conversación nueva para la tienda actual.",
    status: "warning",
  },
  organization_access_denied: {
    message: "No tienes acceso a esta organización.",
    status: "danger",
  },
  store_scope_invalid: {
    message: "No se pudo validar la tienda seleccionada. Vuelve a elegirla e inténtalo de nuevo.",
    status: "warning",
  },
  store_scope_unresolved: {
    message: "La tienda seleccionada ya no está disponible. Elige una tienda válida antes de consultar.",
    status: "warning",
  },
  store_scope_resolution_failed: {
    message: "No se pudo comprobar el alcance de la tienda. No se consultaron datos; inténtalo de nuevo.",
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
      "¿Qué campaña muestra el mejor resultado medido y qué métrica lo respalda?",
      "¿Qué producto ofrece una oportunidad de campaña según ventas, margen y stock disponibles?",
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
      "¿Qué productos explican la mayor caída de ventas en el periodo visible?",
      "¿Qué partida reduce más el margen según costes e importes comparables?",
    ],
  },
  {
    prefix: "/klaviyo",
    prompts: [
      "¿Qué email o flujo conviene revisar primero según sus métricas?",
      "¿Qué señales verificables hay sobre entregabilidad y medición?",
    ],
  },
  {
    prefix: "/meta",
    prompts: [
      "¿Qué anuncio tiene evidencia suficiente para probar una pausa o un aumento gradual?",
      "¿Qué cambió antes y después de una modificación en la misma entidad?",
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
      "¿Qué cambió en las ventas durante el periodo visible y qué dato respalda la conclusión?",
      "¿Qué única prioridad iniciarías esta semana según las métricas y tareas disponibles?",
    ],
  },
];

const DEFAULT_PROMPTS = [
  "¿Qué señal de negocio merece atención primero y qué dato la respalda?",
  "¿Qué prioridad propones para esta semana y qué evidencia disponible la justifica?",
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
    return { ...CHAT_TURN_STATUS_MESSAGES[body.status]!, code: body.error };
  if (body?.error && ERROR_MESSAGES[body.error])
    return { ...ERROR_MESSAGES[body.error]!, code: body.error };
  return {
    ...(body?.error ? { code: body.error } : {}),
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
  canManageEscalations = false,
  view,
  ask: pending,
  onClose,
}: {
  /** Cliente activo del portal. Vacío en vista general del consultor. */
  organizationId: string;
  /** Cartera, para poder elegir cliente sin salir de la vista general. */
  organizations?: Array<{ id: string; name: string }>;
  canManageEscalations?: boolean;
  view?: CopilotView;
  /** Pregunta con la que se abrió el panel desde un módulo (ver copilot-ask.tsx). */
  ask?: CopilotAsk | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [conversationHistoryCursor, setConversationHistoryCursor] = useState<HistoryCursor | null>(null);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [messageHistoryCursor, setMessageHistoryCursor] = useState<HistoryCursor | null>(null);
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
  const [effectiveModel, setEffectiveModel] = useState<string | null>(null);
  const [retryTurn, setRetryTurn] = useState<RetryTurn | null>(null);
  const [activityStage, setActivityStage] = useState(0);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  // Traza en directo del turno en curso: qué herramienta corre y cuánto tardó.
  const [liveTools, setLiveTools] = useState<ToolTrace[]>([]);
  const liveToolsRef = useRef<ToolTrace[]>([]);
  const turnStartedAtRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEscalationInboxOpen, setIsEscalationInboxOpen] = useState(false);
  const [escalations, setEscalations] = useState<CopilotEscalation[]>([]);
  const [escalationOwners, setEscalationOwners] = useState<CopilotEscalationOwner[]>([]);
  const [isLoadingEscalations, setIsLoadingEscalations] = useState(false);
  const [updatingEscalationId, setUpdatingEscalationId] = useState<string | null>(null);
  // Las cifras de la pantalla viajan con la pregunta salvo que el consultor
  // las quite: a veces quiere preguntar sin que el periodo visible condicione.
  const [sendScreenFigures, setSendScreenFigures] = useState(true);
  // Propuestas desmarcadas por mensaje: se aprueban las demás.
  // Claves por mensaje (ver messageKey): cargar mensajes anteriores desplaza
  // los índices y no puede mover una casilla de una propuesta a otra.
  const [skippedProposals, setSkippedProposals] = useState<Record<string, number[]>>({});
  const [openTrace, setOpenTrace] = useState<string[]>([]);
  const [openSources, setOpenSources] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  // El rail y el drawer son la misma conversación. Decidir la presentación en
  // cliente evita duplicar el chat (y sus llamadas de saldo) solo para aplicar
  // una media query. Antes de hidratar usamos drawer: es la opción segura para
  // SSR y para cualquier viewport estrecho.
  const [isDesktop, setIsDesktop] = useState(false);
  const targetOrganizationId = organizationId || pickedOrganizationId;
  const targetStoreId = view?.storeId ?? null;
  const targetOrganizationName = organizations.find(
    (organization) => organization.id === targetOrganizationId,
  )?.name;
  const scrollRef = useRef<HTMLDivElement>(null);
  const scopeGenerationRef = useRef(0);
  const conversationLoadRef = useRef(0);
  const activeTurnRef = useRef(0);
  const turnAbortRef = useRef<AbortController | null>(null);
  const draftScopeRef = useRef("");
  const skipDraftWriteRef = useRef(true);
  const wasNearBottomRef = useRef(true);
  const historyQueryRef = useRef("");
  const draftKey = `copilot-draft:${targetOrganizationId || "none"}:${targetStoreId || "org"}`;
  const turnRecoveryKey = `copilot-turn:${targetOrganizationId || "none"}:${targetStoreId || "org"}`;
  const clearRecovery = () => {
    window.sessionStorage.removeItem(turnRecoveryKey);
    setRetryTurn(null);
  };
  const readRecoveredQuestion = () => {
    try {
      const stored = window.sessionStorage.getItem(turnRecoveryKey);
      return stored ? ((JSON.parse(stored) as Partial<RetryTurn>).question ?? null) : null;
    } catch {
      return null;
    }
  };
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
  const [emailReportId, setEmailReportId] = useState<string | null>(null);
  const [reportEmail, setReportEmail] = useState("");
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);
  const [reportShareStatus, setReportShareStatus] = useState<Record<string, string>>({});
  // La pregunta enganchada se lanza una vez por nonce: sin esto, cualquier
  // re-render del portal la volvería a enviar y se pagaría el turno otra vez.
  const askedKeyRef = useRef<number | null>(null);
  // Si ya se ha preguntado en este alcance, la conversación reciente que se
  // carga al abrir no puede pisar la nueva: mostraba la pregunta vieja encima
  // de la respuesta nueva.
  const askedInScopeRef = useRef(false);

  useEffect(() => {
    const savedDraft = window.sessionStorage.getItem(draftKey) ?? "";
    let recoveredTurn: RetryTurn | null = null;
    try {
      const stored = window.sessionStorage.getItem(turnRecoveryKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<RetryTurn>;
        const fresh =
          typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt < RECOVERY_TTL_MS;
        if (!fresh) {
          window.sessionStorage.removeItem(turnRecoveryKey);
        } else if (typeof parsed.id === "string" && typeof parsed.question === "string") {
          recoveredTurn = {
            createdAt: parsed.createdAt,
            id: parsed.id,
            question: parsed.question,
            ...(parsed.confirmedFailed === true ? { confirmedFailed: true } : {}),
            ...(parsed.reference ? { reference: parsed.reference } : {}),
          };
        }
      }
    } catch {
      window.sessionStorage.removeItem(turnRecoveryKey);
    }
    skipDraftWriteRef.current = true;
    setInput(savedDraft);
    setRetryTurn(recoveredTurn);
    draftScopeRef.current = draftKey;
  }, [draftKey, turnRecoveryKey]);

  useEffect(() => {
    if (skipDraftWriteRef.current) {
      skipDraftWriteRef.current = false;
      return;
    }
    if (draftScopeRef.current === draftKey) {
      if (input) window.sessionStorage.setItem(draftKey, input);
      else window.sessionStorage.removeItem(draftKey);
    }
  }, [draftKey, input]);

  useEffect(() => {
    scopeGenerationRef.current += 1;
    conversationLoadRef.current += 1;
    activeTurnRef.current += 1;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    askedInScopeRef.current = false;
    setMessages([]);
    setConversationId(null);
    setHasOlderMessages(false);
    setMessageHistoryCursor(null);
    setIsLoadingOlderMessages(false);
    setIsSending(false);
    setStreamingAnswer("");
    setConversations([]);
    setHasMoreConversations(false);
    setConversationHistoryCursor(null);
    setIsLoadingMoreConversations(false);
    setHistoryQuery("");
    setError(null);
    setSavedIndexes([]);
    setDegraded(false);
    setEffectiveModel(null);
    setEscalations([]);
    setEscalationOwners([]);
    setIsEscalationInboxOpen(false);
  }, [targetOrganizationId, targetStoreId]);

  useEffect(() => {
    if (!targetOrganizationId || !canManageEscalations) return;
    let active = true;
    setIsLoadingEscalations(true);
    void apiFetch(
      `/v1/organizations/${targetOrganizationId}/consultant-chat/escalations`,
    )
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { escalations?: CopilotEscalation[] };
        if (active) setEscalations((payload.escalations ?? []).filter((item) => ["open", "acknowledged"].includes(item.status)));
      })
      .catch(() => {
        // La bandeja es secundaria al chat; un fallo temporal no bloquea A09.
      })
      .finally(() => {
        if (active) setIsLoadingEscalations(false);
      });
    return () => {
      active = false;
    };
  }, [targetOrganizationId, canManageEscalations]);

  useEffect(() => {
    if (!targetOrganizationId || !canManageEscalations) return;
    let active = true;
    void apiFetch(`/v1/organizations/${targetOrganizationId}/consultant-chat/escalations/owners`)
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { owners?: CopilotEscalationOwner[] };
        if (active) setEscalationOwners(payload.owners ?? []);
      })
      .catch(() => {
        if (active) setEscalationOwners([]);
      });
    return () => {
      active = false;
    };
  }, [targetOrganizationId, canManageEscalations]);

  async function updateEscalation(
    escalation: CopilotEscalation,
    status: "open" | "acknowledged" | "resolved" | "dismissed",
    ownerUserId?: string | null,
  ) {
    setUpdatingEscalationId(escalation.id);
    try {
      const response = await apiFetch(
        `/v1/organizations/${targetOrganizationId}/consultant-chat/escalations/${escalation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(ownerUserId !== undefined ? { owner_user_id: ownerUserId } : {}),
            ...(status === "resolved" ? { resolution: "Resuelto desde el Consultor IA." } : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setEscalations((current) =>
        status === "resolved"
            ? current.filter((item) => item.id !== escalation.id)
          : current.map((item) => item.id === escalation.id
            ? { ...item, status, ...(ownerUserId !== undefined ? { owner_user_id: ownerUserId } : {}) }
            : item),
      );
    } catch {
      setError({ message: "No se pudo actualizar el escalado. Vuelve a cargarlo e inténtalo otra vez.", status: "danger" });
    } finally {
      setUpdatingEscalationId(null);
    }
  }

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => () => turnAbortRef.current?.abort(), []);

  async function loadConversation(id: string, auto = false, cursor?: HistoryCursor) {
    const appendOlder = Boolean(cursor);
    if (!targetOrganizationId || isSending || isLoadingOlderMessages || (auto && askedInScopeRef.current)) return;
    const loadId = ++conversationLoadRef.current;
    const scopeGeneration = scopeGenerationRef.current;
    const requestedOrganizationId = targetOrganizationId;
    const requestedStoreId = targetStoreId;
    const scrollContainer = scrollRef.current;
    const previousScrollHeight = appendOlder ? scrollContainer?.scrollHeight ?? 0 : 0;
    if (appendOlder) setIsLoadingOlderMessages(true);
    else setIsLoadingConversation(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (requestedStoreId) params.set("connection_id", requestedStoreId);
      if (cursor) {
        params.set("before_created_at", cursor.created_at);
        params.set("before_id", cursor.id);
      }
      const query = params.size ? `?${params.toString()}` : "";
      const response = await apiFetch(
        `/v1/organizations/${requestedOrganizationId}/consultant-chat/conversations/${id}${query}`,
      );
      if (scopeGeneration !== scopeGenerationRef.current || loadId !== conversationLoadRef.current) return;
      if (auto && askedInScopeRef.current) return;
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const payload = (await response.json()) as {
        conversation_id: string;
        messages: ChatHistoryMessage[];
        has_more?: boolean;
        next_cursor?: HistoryCursor | null;
      };
      if (scopeGeneration !== scopeGenerationRef.current || loadId !== conversationLoadRef.current) return;
      setConversationId(payload.conversation_id);
      const loadedMessages = payload.messages.map(mapChatHistoryMessage);
      const pendingTurn = readRecoveredQuestion();
      if (pendingTurn && turnAlreadyAnswered(loadedMessages, pendingTurn)) clearRecovery();
      setMessages((previous) => cursor ? [...loadedMessages, ...previous] : loadedMessages);
      setHasOlderMessages(payload.has_more === true);
      setMessageHistoryCursor(payload.next_cursor ?? null);
      if (cursor && scrollContainer) {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop += scrollContainer.scrollHeight - previousScrollHeight;
        });
      }
    } catch {
      if (scopeGeneration === scopeGenerationRef.current && loadId === conversationLoadRef.current) {
        setError({
          message: "No se pudo recuperar esta conversación. Inténtalo de nuevo.",
          status: "danger",
        });
      }
    } finally {
      if (scopeGeneration === scopeGenerationRef.current && loadId === conversationLoadRef.current) {
        if (appendOlder) setIsLoadingOlderMessages(false);
        else setIsLoadingConversation(false);
      }
    }
  }

  useEffect(() => {
    if (!targetOrganizationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams();
        if (view?.storeId) params.set("connection_id", view.storeId);
        const query = params.size ? `?${params.toString()}` : "";
        const response = await apiFetch(
          `/v1/organizations/${targetOrganizationId}/consultant-chat/conversations${query}`,
        );
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as {
          conversations?: Conversation[];
          has_more?: boolean;
          next_cursor?: HistoryCursor | null;
        };
        if (cancelled) return;
        const recent = payload.conversations ?? [];
        setConversations(recent);
        setHasMoreConversations(payload.has_more === true);
        setConversationHistoryCursor(payload.next_cursor ?? null);
        if (recent[0]) void loadConversation(recent[0].id, true);
      } catch {
        // El historial complementa el chat: si falla, aún se puede empezar uno.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Las conversaciones también se aíslan por tienda; recargarlas al cambiar cliente o tienda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrganizationId, targetStoreId]);

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
    const query = historyQuery.trim();
    const previousQuery = historyQueryRef.current;
    historyQueryRef.current = query;
    if (!targetOrganizationId || (!query && !previousQuery)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (targetStoreId) params.set("connection_id", targetStoreId);
      if (query) params.set("search", query);
      const queryString = params.size ? `?${params.toString()}` : "";
      void apiFetch(`/v1/organizations/${targetOrganizationId}/consultant-chat/conversations${queryString}`)
        .then(async (response) => {
          if (!response.ok || cancelled) return;
          const payload = await response.json() as {
            conversations?: Conversation[];
            has_more?: boolean;
            next_cursor?: HistoryCursor | null;
          };
          if (!cancelled) {
            setConversations(payload.conversations ?? []);
            setHasMoreConversations(payload.has_more === true);
            setConversationHistoryCursor(payload.next_cursor ?? null);
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [historyQuery, targetOrganizationId, targetStoreId]);

  async function loadMoreConversations() {
    if (!targetOrganizationId || !conversationHistoryCursor || isLoadingMoreConversations) return;
    const requestedOrganizationId = targetOrganizationId;
    const requestedStoreId = targetStoreId;
    const requestedQuery = historyQuery.trim();
    const params = new URLSearchParams();
    if (requestedStoreId) params.set("connection_id", requestedStoreId);
    if (requestedQuery) params.set("search", requestedQuery);
    params.set("before_created_at", conversationHistoryCursor.created_at);
    params.set("before_id", conversationHistoryCursor.id);
    setIsLoadingMoreConversations(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${requestedOrganizationId}/consultant-chat/conversations?${params.toString()}`,
      );
      if (
        !response.ok ||
        requestedOrganizationId !== targetOrganizationId ||
        requestedStoreId !== targetStoreId ||
        requestedQuery !== historyQuery.trim()
      ) return;
      const payload = await response.json() as {
        conversations?: Conversation[];
        has_more?: boolean;
        next_cursor?: HistoryCursor | null;
      };
      setConversations((previous) => {
        const known = new Set(previous.map((conversation) => conversation.id));
        return [...previous, ...(payload.conversations ?? []).filter((conversation) => !known.has(conversation.id))];
      });
      setHasMoreConversations(payload.has_more === true);
      setConversationHistoryCursor(payload.next_cursor ?? null);
    } catch {
      // Se puede reintentar desde el control de historial.
    } finally {
      setIsLoadingMoreConversations(false);
    }
  }

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const container = scrollRef.current;
    if (!container || !wasNearBottomRef.current) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages, streamingAnswer]);

  async function ask(
    question: string,
    reference?: CopilotEvidenceReference,
    existingTurnId?: string,
  ) {
    if (!question || isSending || !targetOrganizationId) return;
    const scopeGeneration = scopeGenerationRef.current;
    const turnGeneration = ++activeTurnRef.current;
    const requestedOrganizationId = targetOrganizationId;
    const requestedStoreId = targetStoreId;
    const requestedConversationId = conversationId;
    // A recovery lookup keeps its ID; a retry after a confirmed failure calls
    // ask without one so the API can execute a fresh, idempotent attempt.
    const clientTurnId = existingTurnId ?? crypto.randomUUID();
    const controller = new AbortController();
    turnAbortRef.current?.abort();
    turnAbortRef.current = controller;
    const isCurrentTurn = () =>
      scopeGeneration === scopeGenerationRef.current &&
      turnGeneration === activeTurnRef.current;
    conversationLoadRef.current += 1;
    const retryRecord = {
      question,
      id: clientTurnId,
      createdAt: Date.now(),
      ...(reference ? { reference } : {}),
    };
    window.sessionStorage.setItem(turnRecoveryKey, JSON.stringify(retryRecord));
    setRetryTurn(retryRecord);
    askedInScopeRef.current = true;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setIsSending(true);
    setActivityStage(0);
    setStreamingAnswer("");
    liveToolsRef.current = [];
    setLiveTools([]);
    turnStartedAtRef.current = Date.now();
    setElapsed(0);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${requestedOrganizationId}/consultant-chat/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            conversation_id: requestedConversationId ?? undefined,
            view_context: toViewContext(
              view && !sendScreenFigures ? { ...view, summary: null } : view,
            ),
            evidence_reference: reference,
            model,
            client_turn_id: clientTurnId,
          }),
          signal: controller.signal,
        },
      );
      if (!isCurrentTurn()) return;
      if (!response.ok) {
        const failure = await readError(response);
        setError(failure);
        if (response.status >= 500 || response.status === 409) {
          const recoverable = { ...retryRecord, confirmedFailed: failure.code === "chat_turn_failed" };
          setRetryTurn(recoverable);
          window.sessionStorage.setItem(turnRecoveryKey, JSON.stringify(recoverable));
        } else {
          // Un 4xx es una respuesta definitiva (saldo, permisos, alcance):
          // reintentar el mismo turno daría el mismo error.
          clearRecovery();
        }
        return;
      }
      const payload = await readCopilotStream(response, (event) => {
        if (!isCurrentTurn()) return;
        if (event.type === "stage") {
          const stage = event.stage === "context" ? 0 : event.stage === "validation" ? 2 : 1;
          setActivityStage((current) => Math.max(current, stage));
        } else if (event.type === "answer_delta") {
          setActivityStage(3);
          setStreamingAnswer((current) => current + event.delta);
        } else if (event.type === "answer_reset") {
          setStreamingAnswer("");
        } else if (event.type === "tool") {
          const trace: ToolTrace = {
            id: event.id,
            name: event.name,
            status: event.status,
            ...(event.latency_ms === undefined ? {} : { latency_ms: event.latency_ms }),
          };
          const known = liveToolsRef.current.some((tool) => tool.id === trace.id);
          liveToolsRef.current = known
            ? liveToolsRef.current.map((tool) => (tool.id === trace.id ? trace : tool))
            : [...liveToolsRef.current, trace];
          setLiveTools(liveToolsRef.current);
        }
      });
      if (!isCurrentTurn()) return;
      setRetryTurn(null);
      window.sessionStorage.removeItem(turnRecoveryKey);
      setStreamingAnswer("");
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
          can_upgrade: payload.can_upgrade ?? prev?.can_upgrade ?? false,
          models: prev?.models ?? [],
        }));
      }
      setDegraded(Boolean(payload.model?.degraded));
      setEffectiveModel(payload.model?.effective_model ?? null);
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
          keyFigures: payload.output.key_figures ?? [],
          tools: liveToolsRef.current,
          elapsedMs: Date.now() - turnStartedAtRef.current,
          uiActions: resolveUiActions(payload.output.ui_actions),
          messageId: payload.message_id,
          outputId: payload.output_id,
          approvalRequired: payload.approval_required,
          approvalStatus: payload.approval_required
            ? "pending_approval"
            : undefined,
          proposedWrites: payload.output.proposed_writes,
          proposalGuidance: payload.proposal_guidance,
          usage: payload.usage,
          reportArtifacts: payload.report_artifacts ?? [],
        },
      ]);
    } catch (cause) {
      if (!isCurrentTurn()) return;
      setRetryTurn(retryRecord);
      setStreamingAnswer("");
      if (cause instanceof Error) {
        try {
          const body = JSON.parse(cause.message) as { error?: string; status?: string; message?: string; detail?: string; statusCode?: number };
          if (body.error === "chat_turn_failed") {
            const failedTurn = { ...retryRecord, confirmedFailed: true };
            setRetryTurn(failedTurn);
            window.sessionStorage.setItem(turnRecoveryKey, JSON.stringify(failedTurn));
          }
          setError(await readError(new Response(JSON.stringify(body), { status: body.statusCode ?? 502 })));
        } catch {
          setError({ message: cause.message, status: "danger" });
        }
      } else {
        setError({ message: "No se pudo completar la consulta.", status: "danger" });
      }
    } finally {
      if (isCurrentTurn()) {
        setIsSending(false);
        turnAbortRef.current = null;
      }
    }
  }

  async function getReportDownloadUrl(report: ChatReportArtifact): Promise<string> {
    const response = await apiFetch(
      `/v1/organizations/${targetOrganizationId}/copilot-reports/${report.report_id}/link?file_name=${encodeURIComponent(report.file_name)}`,
    );
    if (!response.ok) throw new Error("No se pudo preparar el enlace del PDF.");
    const payload = (await response.json()) as { download_url?: string };
    if (!payload.download_url) throw new Error("El informe ya no está disponible.");
    return payload.download_url;
  }

  async function openReport(report: ChatReportArtifact) {
    const tab = window.open("about:blank", "_blank");
    try {
      const url = await getReportDownloadUrl(report);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (cause) {
      tab?.close();
      setReportShareStatus((current) => ({
        ...current,
        [report.report_id]: cause instanceof Error ? cause.message : "No se pudo abrir el PDF.",
      }));
    }
  }

  async function shareReportWhatsApp(report: ChatReportArtifact) {
    const fallbackTab = window.open("about:blank", "_blank");
    setReportShareStatus((current) => ({ ...current, [report.report_id]: "Preparando PDF…" }));
    try {
      const url = await getReportDownloadUrl(report);
      const shareText = `Informe E-NORA (${report.period_start} — ${report.period_end})`;
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const file = new File([await response.blob()], report.file_name, { type: "application/pdf" });
            if (navigator.canShare({ files: [file] })) {
              fallbackTab?.close();
              await navigator.share({ files: [file], title: "Informe E-NORA", text: shareText });
              setReportShareStatus((current) => ({ ...current, [report.report_id]: "PDF compartido." }));
              return;
            }
          }
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
          // Si el navegador no puede descargar el archivo por CORS, se comparte
          // el enlace temporal de descarga como alternativa.
        }
      }
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}: ${url}`)}`;
      if (fallbackTab) fallbackTab.location.href = whatsappUrl;
      else {
        await navigator.clipboard.writeText(url);
        setReportShareStatus((current) => ({ ...current, [report.report_id]: "Enlace copiado. Pégalo en WhatsApp para compartir el PDF." }));
        return;
      }
      setReportShareStatus((current) => ({ ...current, [report.report_id]: "WhatsApp abrirá el enlace temporal de descarga." }));
    } catch (cause) {
      fallbackTab?.close();
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setReportShareStatus((current) => ({ ...current, [report.report_id]: "Compartir cancelado." }));
        return;
      }
      setReportShareStatus((current) => ({
        ...current,
        [report.report_id]: cause instanceof Error ? cause.message : "No se pudo compartir el PDF.",
      }));
    }
  }

  async function sendReportEmail(event: FormEvent<HTMLFormElement>, report: ChatReportArtifact) {
    event.preventDefault();
    setSendingReportId(report.report_id);
    setReportShareStatus((current) => ({ ...current, [report.report_id]: "Enviando correo…" }));
    try {
      const response = await apiFetch(
        `/v1/organizations/${targetOrganizationId}/copilot-reports/${report.report_id}/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: reportEmail, file_name: report.file_name }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const message = payload.error === "email_not_configured"
          ? "El envío de correo no está configurado en este entorno."
          : payload.error === "invalid_email"
            ? "Escribe una dirección de correo válida."
            : "No se pudo enviar el informe por correo.";
        throw new Error(message);
      }
      setReportShareStatus((current) => ({ ...current, [report.report_id]: `PDF enviado a ${reportEmail.trim()}.` }));
      setEmailReportId(null);
      setReportEmail("");
    } catch (cause) {
      setReportShareStatus((current) => ({
        ...current,
        [report.report_id]: cause instanceof Error ? cause.message : "No se pudo enviar el informe por correo.",
      }));
    } finally {
      setSendingReportId(null);
    }
  }

  /**
   * Corta el turno en curso. El servidor aborta al cerrarse la conexión, así
   * que dejan de gastarse tokens. El turno se da por cerrado: no queda como
   * "pendiente de recuperar", porque detenerlo fue una decisión.
   */
  function stopTurn() {
    if (!isSending) return;
    activeTurnRef.current += 1;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    clearRecovery();
    setIsSending(false);
    const partial = streamingAnswer;
    setStreamingAnswer("");
    setMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: partial,
        stopped: true,
        tools: liveToolsRef.current,
        elapsedMs: Date.now() - turnStartedAtRef.current,
      },
    ]);
  }

  async function decideProposal(
    index: number,
    outputId: string,
    decision: "approved" | "rejected",
    skipped: number[] = [],
  ): Promise<boolean> {
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
            // Las desmarcadas no se crean; el backend las descarta una a una.
            ...(decision === "approved" && skipped.length > 0
              ? { edits: skipped.map((skipIndex) => ({ index: skipIndex, skip: true })) }
              : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(await readError(response));
        return false;
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
      return true;
    } catch {
      setError({
        message: "No se pudo registrar la decisión sobre la propuesta.",
        status: "danger",
      });
      return false;
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
    if (isSending) {
      stopTurn();
      return;
    }
    void ask(expandCopilotCommand(input));
  }

  // Reloj del turno en curso, para la traza.
  useEffect(() => {
    if (!isSending) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - turnStartedAtRef.current), 200);
    return () => window.clearInterval(timer);
  }, [isSending]);

  // El cuadro de texto crece con lo escrito hasta 160 px.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function copyAnswer(text: string) {
    try {
      await navigator.clipboard.writeText(answerText(text));
      setNotice("Respuesta copiada");
    } catch {
      setNotice("No se pudo copiar. Selecciona el texto a mano.");
    }
  }

  // El módulo abrió el panel con una pregunta ya escrita: se envía sola. Si
  // hubiera que pulsar "enviar", el botón "Analizar con el Consultor IA" sería
  // un botón que solo rellena un input.
  useEffect(() => {
    if (!pending || !targetOrganizationId) return;
    if (askedKeyRef.current === pending.key) return;
    askedKeyRef.current = pending.key;
    void ask(pending.question, pending.reference as CopilotEvidenceReference | undefined);
    // Si el efecto se desmonta (StrictMode en desarrollo lo monta dos veces y
    // el reinicio de alcance aborta el turno), la pregunta se vuelve a mandar:
    // sin esto el panel se abría con "pregunta sin respuesta" y no preguntaba.
    return () => {
      askedKeyRef.current = null;
    };
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

  const commandMatches = matchingCopilotCommands(input);
  const models = balance?.models ?? [];
  const historyGroups = ["Hoy", "Esta semana", "Antes"]
    .map((label) => ({
      label,
      items: filteredConversations.filter(
        (conversation) => historyGroup(conversation.updated_at) === label,
      ),
    }))
    .filter((group) => group.items.length > 0);
  const liveStageLabel = liveTools.some((tool) => tool.status === "running")
    ? "Consultando datos…"
    : ["Leyendo el contexto…", "Pensando…", "Validando cifras…", "Escribiendo…"][activityStage];
  const iconButton =
    "flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  const renderTrace = (tools: ToolTrace[]) => (
    <ol className="grid gap-0.5">
      {tools.map((tool) => (
        <li
          key={tool.id}
          className={`grid grid-cols-[1rem_minmax(0,1fr)_auto] items-start gap-2 py-1 text-xs ${styles.rise}`}
        >
          <span className="mt-0.5 flex size-4 items-center justify-center" aria-hidden>
            {tool.status === "running" ? (
              <span className={styles.spin} />
            ) : tool.status === "error" ? (
              <CloseIcon className="size-3.5 text-danger" />
            ) : (
              <CheckIcon className="size-3.5 text-success" />
            )}
          </span>
          <span className="min-w-0">
            <code className="rounded bg-accent-soft px-1.5 py-px font-mono text-[0.7rem] text-accent">
              {tool.name}
            </code>
            <span className="mt-0.5 block text-muted">
              {copilotToolLabel(tool.name)}
              {tool.status === "error" ? " · falló; la respuesta sigue sin ella" : ""}
            </span>
          </span>
          <span className="pt-0.5 font-mono text-[0.68rem] text-muted tabular-nums">
            {tool.latency_ms === undefined ? "" : `${tool.latency_ms} ms`}
          </span>
        </li>
      ))}
    </ol>
  );

  const renderAssistant = (message: ChatMessage, index: number) => {
    const key = messageKey(message, index);
    const confidence = message.confidence ? CONFIDENCE[message.confidence] : null;
    const toolCount = message.tools?.length ?? message.usage?.tool_calls ?? 0;
    const elapsedMs = message.elapsedMs ?? message.usage?.latency_ms;
    const traceOpen = openTrace.includes(key);
    const sourcesOpen = openSources.includes(key);
    const next = message.next_action ?? message.recommendation;
    const showRecommendation =
      message.recommendation && message.next_action && message.recommendation !== message.next_action;
    const proposals = message.approvalRequired ? message.proposedWrites ?? [] : [];
    const skipped = skippedProposals[key] ?? [];
    const selected = proposals.length - skipped.length;
    const isPending = message.approvalStatus === "pending_approval" && Boolean(message.outputId);
    const previousQuestion = messages
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.role === "user")?.content;

    return (
      <article key={key} className={`grid min-w-0 gap-3.5 ${styles.rise}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-muted">A09</span>
          {message.stopped ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-tint px-2.5 py-0.5 font-medium text-warning">
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              Detenida
            </span>
          ) : confidence ? (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${confidence.className}`}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {confidence.label}
            </span>
          ) : null}
          {toolCount > 0 || elapsedMs ? (
            <button
              type="button"
              disabled={!message.tools?.length}
              aria-expanded={traceOpen}
              onClick={() => setOpenTrace((previous) => toggle(previous, key))}
              className="rounded-full border border-separator px-2.5 py-0.5 text-muted tabular-nums enabled:hover:border-accent/40 enabled:hover:text-foreground"
            >
              {toolCount} {toolCount === 1 ? "herramienta" : "herramientas"}
              {elapsedMs ? ` · ${segundos(elapsedMs)}` : ""}
            </button>
          ) : null}
        </div>

        {traceOpen && message.tools?.length ? (
          <div className={`rounded-lg border border-separator p-3 ${styles.rise}`}>
            <p className="mb-1 text-xs font-medium text-foreground">Cómo he llegado a la respuesta</p>
            {renderTrace(message.tools)}
          </div>
        ) : null}

        {message.summary && !message.stopped ? (
          <h3 className="text-base font-semibold leading-snug tracking-[-0.01em] text-foreground [text-wrap:balance]">
            {message.summary}
          </h3>
        ) : null}
        {message.content ? (
          <div className="min-w-0 text-sm leading-relaxed">
            <Markdown>{answerText(message.content)}</Markdown>
          </div>
        ) : null}
        {message.stopped ? (
          <p className="text-xs text-muted">Detuviste la respuesta. No se gastaron más tokens en ella.</p>
        ) : null}
        {message.warnings?.length ? (
          <p className="rounded-md bg-warn-tint px-3 py-2 text-xs leading-5 text-warning">
            {message.warnings.join(" · ")}
          </p>
        ) : null}

        {message.keyFigures?.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {message.keyFigures.map((figure, figureIndex) => {
              const verdict = figureVerdict(figure);
              return (
              <div
                key={`${figure.label}:${figure.value}`}
                className={`min-w-0 rounded-lg border border-separator bg-white p-2.5 transition hover:-translate-y-px hover:border-accent/40 ${styles.rise}`}
                style={{ animationDelay: `${figureIndex * 70}ms` }}
              >
                <p className="truncate text-[0.7rem] text-muted" title={figure.label}>{figure.label}</p>
                <p className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {figure.value}
                </p>
                {figure.change ? (
                  <p
                    className={`text-xs font-medium tabular-nums ${
                      verdict === "good" ? "text-success" : verdict === "bad" ? "text-danger" : "text-muted"
                    }`}
                  >
                    {figure.direction === "up" ? "↑ " : figure.direction === "down" ? "↓ " : ""}
                    {figure.change}
                  </p>
                ) : null}
                {figure.series && figure.series.length > 1 ? (
                  <div className="mt-1" aria-hidden>
                    <Sparkline
                      data={figure.series.slice(-31)}
                      height={26}
                      tone={verdict === "good" ? "success" : verdict === "bad" ? "danger" : "brand"}
                    />
                  </div>
                ) : null}
                <p className="mt-1 truncate text-[0.65rem] text-muted">
                  {SOURCE_LABEL[figure.source] ?? figure.source}
                  {figure.period ? ` · ${figure.period}` : ""}
                </p>
              </div>
              );
            })}
          </div>
        ) : null}

        {message.findings?.length ? (
          <section aria-label="Hallazgos">
            <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-muted">Hallazgos</p>
            <ul className="border-t border-separator">
              {message.findings.map((finding) => (
                <li
                  key={`${finding.title}:${finding.detail}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 border-b border-separator py-2.5"
                >
                  {finding.impact ? (
                    <span className={`mt-0.5 h-fit rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${IMPACT[finding.impact].className}`}>
                      {IMPACT[finding.impact].label}
                    </span>
                  ) : (
                    <span aria-hidden className="mt-2 size-1.5 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[0.85rem] font-semibold text-foreground">{finding.title}</p>
                    <p className="mt-0.5 text-[0.8rem] leading-5 text-muted">{finding.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {next || message.uiActions?.length ? (
          <section className="grid gap-2.5 rounded-lg border border-accent/30 bg-accent-soft p-3.5" aria-label="Siguiente acción">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-accent">Siguiente acción</p>
            {showRecommendation ? (
              <p className="text-[0.8rem] leading-5 text-muted">{message.recommendation}</p>
            ) : null}
            {next ? <p className="text-sm leading-6 text-foreground">{next}</p> : null}
            {message.uiActions?.length ? (
              <div className="flex flex-wrap gap-2">
                {message.uiActions.map((action, actionIndex) => (
                  <ButtonLink
                    key={`${action.insight_slug}:${action.label}`}
                    href={action.href}
                    size="sm"
                    variant={actionIndex === 0 ? "primary" : "secondary"}
                    onClick={onClose}
                    aria-label={`${action.label}: ${action.target_label}. ${action.reason}`}
                  >
                    {action.label}: {action.target_label}
                  </ButtonLink>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {message.reportArtifacts?.map((report) => (
          <section
            key={report.report_id}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-separator bg-white p-3"
            aria-label="Informe PDF generado"
          >
            <div
              aria-hidden
              className="flex h-14 w-11 items-end justify-center rounded-md border border-accent/30 bg-accent-soft pb-1.5 font-mono text-[0.55rem] font-semibold text-accent"
            >
              PDF
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {REPORT_TEMPLATE_LABELS[report.template_id] ?? "Informe PDF"}
              </p>
              <p className="text-xs text-muted">
                {report.period_start} — {report.period_end} ·{" "}
                <Link href="/informes" onClick={onClose} className="text-accent">
                  también en Informes
                </Link>
              </p>
            </div>
            <div className="col-span-2 flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => void openReport(report)}>
                <DownloadIcon aria-hidden className="size-3.5" />
                Descargar
              </Button>
              <Button size="sm" variant="secondary" aria-label="Compartir informe por WhatsApp" onClick={() => void shareReportWhatsApp(report)}>
                <WhatsAppIcon />
                <span>WhatsApp</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Enviar informe por email"
                aria-expanded={emailReportId === report.report_id}
                onClick={() => {
                  setEmailReportId((current) => (current === report.report_id ? null : report.report_id));
                  setReportShareStatus((current) => ({ ...current, [report.report_id]: "" }));
                }}
              >
                <MailIcon />
                <span>Email</span>
              </Button>
            </div>
            {emailReportId === report.report_id ? (
              <form
                className="col-span-2 flex flex-col gap-2 sm:flex-row"
                aria-label="Enviar PDF por correo"
                onSubmit={(event) => void sendReportEmail(event, report)}
              >
                <Input
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  aria-label="Dirección de correo del destinatario"
                  placeholder="nombre@empresa.com"
                  value={reportEmail}
                  onChange={(event) => setReportEmail(event.target.value)}
                />
                <Button type="submit" size="sm" disabled={sendingReportId !== null || !reportEmail.trim()}>
                  {sendingReportId === report.report_id ? "Enviando…" : "Enviar PDF"}
                </Button>
              </form>
            ) : null}
            {reportShareStatus[report.report_id] ? (
              <p className="col-span-2 text-xs text-muted" role="status" aria-live="polite">
                {reportShareStatus[report.report_id]}
              </p>
            ) : null}
          </section>
        ))}

        {proposals.length ? (
          <section className="overflow-hidden rounded-lg border border-separator bg-white" aria-label="Propuesta de tareas">
            <div className="flex items-center gap-2 border-b border-separator px-3.5 py-3">
              <SparklesIcon aria-hidden className="size-4 text-accent" />
              <p className="text-sm font-semibold text-foreground">
                Propongo {proposals.length} {proposals.length === 1 ? "tarea" : "tareas"}
              </p>
              <span
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  message.approvalStatus === "approved"
                    ? "bg-success/10 text-success"
                    : message.approvalStatus === "rejected"
                      ? "bg-surface text-muted"
                      : "bg-warn-tint text-warning"
                }`}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {message.approvalStatus === "approved"
                  ? "Aprobada"
                  : message.approvalStatus === "rejected"
                    ? "Descartada"
                    : "Pendiente"}
              </span>
            </div>
            {proposals.map((proposal, proposalIndex) => (
              <div
                key={`${proposal.kind}:${proposal.title}`}
                data-proposal-row={`${key}:${proposalIndex}`}
                className={`border-b border-separator px-3.5 py-3 ${
                  !isPending && (message.approvalStatus !== "approved" || skipped.includes(proposalIndex)) ? "opacity-60" : ""
                }`}
              >
                {isPending ? (
                  <Checkbox
                    checked={!skipped.includes(proposalIndex)}
                    onChange={() =>
                      setSkippedProposals((previous) => ({
                        ...previous,
                        [key]: toggle(previous[key] ?? [], proposalIndex),
                      }))
                    }
                  >
                    <span className="text-sm font-semibold text-foreground">{proposal.title}</span>
                  </Checkbox>
                ) : (
                  <p className="text-sm font-semibold text-foreground">{proposal.title}</p>
                )}
                <p className="mt-1 text-[0.8rem] leading-5 text-muted">{proposal.description}</p>
                {proposal.rationale ? (
                  <p className="mt-1 text-xs leading-5 text-muted">
                    <span className="font-medium text-foreground">Motivo:</span> {proposal.rationale}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[0.68rem] text-muted">
                  <span className="rounded border border-separator bg-surface px-1.5 py-0.5">
                    {PRIORITY_LABEL[proposal.priority]}
                  </span>
                  <span className="rounded border border-separator bg-surface px-1.5 py-0.5">
                    {EFFORT_LABEL[proposal.effort_estimate ?? "unknown"]}
                  </span>
                  {proposal.financial_cost_estimate && /^[A-Z]{3}$/.test(proposal.financial_cost_estimate.currency) ? (
                    <span className="rounded border border-separator bg-surface px-1.5 py-0.5" title={proposal.financial_cost_estimate.basis}>
                      Coste externo:{" "}
                      {new Intl.NumberFormat("es-ES", {
                        style: "currency",
                        currency: proposal.financial_cost_estimate.currency,
                      }).format(proposal.financial_cost_estimate.amount)}
                    </span>
                  ) : null}
                  {proposal.evidence.map((evidence) => (
                    <span
                      key={`${evidence.label}:${evidence.value}:${evidence.period ?? ""}`}
                      className="rounded border border-separator bg-surface px-1.5 py-0.5 font-mono text-[0.65rem]"
                      title={`${SOURCE_LABEL[evidence.source] ?? evidence.source}${evidence.period ? ` · ${evidence.period}` : ""}`}
                    >
                      {evidence.label}: {evidence.value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
              {isPending ? (
                <>
                  <span className="mr-auto text-xs text-muted">
                    {message.proposalGuidance?.reviewer === "assigned_consultant"
                      ? `Revisa ${message.proposalGuidance.reviewer_name ?? "el consultor asignado"}`
                      : message.proposalGuidance?.reviewer === "client"
                        ? "Decides tú"
                        : message.proposalGuidance?.reviewer === "unverified"
                          ? "Revisor sin confirmar: comprueba la asignación"
                          : "Nada se crea hasta que lo apruebes"}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={decisionIndex !== null}
                    onClick={() => void decideProposal(index, message.outputId!, "rejected")}
                  >
                    Descartar
                  </Button>
                  <Button
                    size="sm"
                    disabled={decisionIndex !== null || selected === 0}
                    onClick={() => {
                      // Se mide antes de decidir: al aprobar, la fila cambia de aspecto.
                      const rows = proposals
                        .map((_, rowIndex) => rowIndex)
                        .filter((rowIndex) => !skipped.includes(rowIndex))
                        .map((rowIndex) =>
                          document
                            .querySelector(`[data-proposal-row="${CSS.escape(`${key}:${rowIndex}`)}"]`)
                            ?.getBoundingClientRect(),
                        )
                        .filter((rect): rect is DOMRect => Boolean(rect));
                      void decideProposal(index, message.outputId!, "approved", skipped).then((approved) => {
                        if (approved) flyToTasks(rows, historyButtonRef.current);
                      });
                    }}
                  >
                    <CheckIcon aria-hidden className="size-3.5" />
                    {decisionIndex === index
                      ? "Creando…"
                      : `Crear ${selected} ${selected === 1 ? "tarea" : "tareas"}`}
                  </Button>
                </>
              ) : message.approvalStatus === "approved" ? (
                <>
                  <p className={`mr-auto flex items-center gap-1.5 text-sm font-medium text-success ${styles.rise}`} role="status">
                    <CheckIcon aria-hidden className="size-4" />
                    {message.tasksCreated ?? 0} {(message.tasksCreated ?? 0) === 1 ? "tarea creada" : "tareas creadas"} en Tareas
                  </p>
                  <ButtonLink href="/tareas" size="sm" variant="secondary" onClick={onClose}>
                    Abrir Tareas
                  </ButtonLink>
                </>
              ) : message.approvalStatus === "rejected" ? (
                <p className="text-xs text-muted" role="status">
                  Propuesta descartada. No se creó ninguna tarea.
                </p>
              ) : (
                <ButtonLink href="/tareas" size="sm" variant="ghost" onClick={onClose}>
                  Ver el estado en Tareas
                </ButtonLink>
              )}
            </div>
          </section>
        ) : null}

        {!message.stopped ? (
          <div className="flex flex-wrap items-center gap-0.5 text-muted">
            {message.messageId ? (
              <>
                <button
                  type="button"
                  className={`${iconButton} size-8 aria-pressed:bg-accent-soft aria-pressed:text-accent`}
                  aria-label="Me ha servido"
                  title="Me ha servido"
                  aria-pressed={message.feedback === "helpful"}
                  disabled={feedbackIndex !== null}
                  onClick={() => void sendFeedback(index, message.messageId!, "helpful")}
                >
                  <ThumbIcon />
                </button>
                <button
                  type="button"
                  className={`${iconButton} size-8 aria-pressed:bg-accent-soft aria-pressed:text-accent`}
                  aria-label="No me ha servido"
                  title="No me ha servido"
                  aria-pressed={message.feedback === "not_helpful"}
                  disabled={feedbackIndex !== null}
                  onClick={() => void sendFeedback(index, message.messageId!, "not_helpful")}
                >
                  <ThumbIcon down />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={`${iconButton} size-8`}
              aria-label="Copiar respuesta"
              title="Copiar respuesta"
              onClick={() => void copyAnswer(message.content)}
            >
              <CopyIcon />
            </button>
            {previousQuestion ? (
              <button
                type="button"
                className={`${iconButton} size-8`}
                aria-label="Volver a preguntar"
                title="Volver a preguntar"
                disabled={isSending}
                onClick={() => void ask(previousQuestion)}
              >
                <RetryIcon aria-hidden className="size-4" />
              </button>
            ) : null}
            {/* El análisis se queda en la conversación de la pieza, firmado
                como IA, para que lo vea también el otro lado. */}
            {pending?.saveAnswer ? (
              savedIndexes.includes(index) ? (
                <span className="px-2 text-xs">{pending.savedLabel ?? "Guardado en el hilo de la pieza."}</span>
              ) : (
                <button
                  type="button"
                  className="rounded-md px-2 py-1.5 text-xs font-medium hover:bg-surface hover:text-foreground disabled:opacity-40"
                  disabled={savingIndex !== null}
                  onClick={() => void saveAnswer(index, message.content)}
                >
                  {savingIndex === index ? "Guardando…" : (pending.saveLabel ?? "Dejar en el hilo")}
                </button>
              )
            ) : null}
            {message.sources?.length ? (
              <button
                type="button"
                className="ml-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:text-foreground"
                aria-expanded={sourcesOpen}
                onClick={() => setOpenSources((previous) => toggle(previous, key))}
              >
                {message.sources.length} {message.sources.length === 1 ? "fuente" : "fuentes"}
                <IconChevronDown aria-hidden className={`size-3 transition-transform ${sourcesOpen ? "rotate-180" : ""}`} />
              </button>
            ) : null}
          </div>
        ) : null}
        {sourcesOpen ? <AiEvidence sources={message.sources ?? []} warnings={[]} /> : null}
      </article>
    );
  };

  const panel = (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-separator py-2 pl-4 pr-2">
        <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <SparklesIcon className="size-3.5" />
        </span>
        <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em] text-foreground">Consultor IA</h2>
        {targetOrganizationName ? (
          organizationId ? (
            <span className="ml-1 max-w-[9rem] truncate rounded-full border border-separator px-2.5 py-0.5 text-xs font-medium text-muted">
              {targetOrganizationName}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPickedOrganizationId("")}
              disabled={isSending}
              title="Cambiar de cliente"
              className="ml-1 flex max-w-[9rem] items-center gap-1 rounded-full border border-separator py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-muted hover:border-accent/40 hover:text-foreground"
            >
              <span className="truncate">{targetOrganizationName}</span>
              <CloseIcon aria-hidden className="size-3" />
            </button>
          )
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {canManageEscalations ? (
            <button
              type="button"
              className="mr-1 flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
              aria-expanded={isEscalationInboxOpen}
              onClick={() => setIsEscalationInboxOpen((open) => !open)}
              title="Escalados humanos"
            >
              Escalados
              {escalations.length > 0 ? (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
                  {escalations.length}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            ref={historyButtonRef}
            type="button"
            className={iconButton}
            aria-label="Historial de conversaciones"
            title="Historial"
            aria-expanded={isHistoryOpen}
            disabled={!targetOrganizationId}
            onClick={() => setIsHistoryOpen(true)}
          >
            <ClockIcon aria-hidden className="size-[1.05rem]" />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => {
              conversationLoadRef.current += 1;
              setConversationId(null);
              setMessages([]);
              setError(null);
              clearRecovery();
              textareaRef.current?.focus();
            }}
            disabled={isSending}
            aria-label="Nueva conversación"
            title="Nueva conversación"
          >
            <PlusIcon aria-hidden />
          </button>
          <button type="button" className={iconButton} onClick={onClose} aria-label="Cerrar Consultor IA" title="Cerrar">
            <CloseIcon aria-hidden />
          </button>
        </div>
      </header>

      {isEscalationInboxOpen && canManageEscalations ? (
        <section aria-label="Bandeja de escalados" className="max-h-[38vh] shrink-0 overflow-y-auto border-b border-separator bg-surface/50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Escalados pendientes</h3>
            <button
              type="button"
              className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
              disabled={isLoadingEscalations}
              onClick={() => {
                if (!targetOrganizationId) return;
                setIsLoadingEscalations(true);
                void apiFetch(`/v1/organizations/${targetOrganizationId}/consultant-chat/escalations`)
                  .then(async (response) => {
                    if (!response.ok) throw new Error("No se pudo actualizar la bandeja.");
                    const payload = (await response.json()) as { escalations?: CopilotEscalation[] };
                    setEscalations((payload.escalations ?? []).filter((item) => ["open", "acknowledged"].includes(item.status)));
                  })
                  .catch(() => setError({ message: "No se pudo actualizar la bandeja de escalados.", status: "warning" }))
                  .finally(() => setIsLoadingEscalations(false));
              }}
            >
              {isLoadingEscalations ? "Cargando…" : "Actualizar"}
            </button>
          </div>
          {isLoadingEscalations && escalations.length === 0 ? (
            <p className="py-3 text-xs text-muted">Cargando escalados…</p>
          ) : escalations.length === 0 ? (
            <p className="py-3 text-xs text-muted">No hay escalados abiertos para este cliente.</p>
          ) : (
            <ul className="grid gap-2">
              {escalations.map((escalation) => (
                <li key={escalation.id} className="rounded-lg border border-separator bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[0.68rem] font-semibold text-danger">
                      Riesgo {escalation.risk}
                    </span>
                    <span className="text-[0.68rem] text-muted">
                      {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(escalation.created_at))}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-foreground">{escalation.reason}</p>
                  {escalation.blocking_questions.length > 0 ? (
                    <ul className="mt-2 grid gap-1 pl-4 text-xs text-muted [list-style:disc]">
                      {escalation.blocking_questions.map((question, index) => <li key={index}>{question}</li>)}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <select
                      aria-label="Responsable del escalado"
                      value={escalation.owner_user_id ?? ""}
                      disabled={updatingEscalationId === escalation.id || escalationOwners.length === 0}
                      onChange={(event) => void updateEscalation(escalation, escalation.status, event.target.value || null)}
                      className="h-8 max-w-44 rounded-md border border-separator bg-white px-2 text-xs text-foreground disabled:opacity-50"
                    >
                      <option value="">Sin responsable</option>
                      {escalationOwners.map((owner) => (
                        <option key={owner.id} value={owner.id}>{owner.name}</option>
                      ))}
                    </select>
                    {escalation.status === "open" ? (
                      <Button size="sm" variant="secondary" disabled={updatingEscalationId === escalation.id} onClick={() => void updateEscalation(escalation, "acknowledged")}>
                        Reconocer
                      </Button>
                    ) : null}
                    <Button size="sm" disabled={updatingEscalationId === escalation.id} onClick={() => void updateEscalation(escalation, "resolved")}>
                      {updatingEscalationId === escalation.id ? "Guardando…" : "Resolver"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const node = event.currentTarget;
          wasNearBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
        }}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-2 pt-5"
      >
        <div
          className="flex min-w-0 flex-col gap-5 [overflow-wrap:anywhere]"
          role="log"
          aria-label="Conversación con el Consultor IA"
          aria-live="polite"
          aria-relevant="additions text"
          aria-busy={isSending}
        >
          {hasOlderMessages && conversationId && messageHistoryCursor ? (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="secondary"
                disabled={isLoadingOlderMessages || isSending}
                onClick={() => void loadConversation(conversationId, false, messageHistoryCursor)}
              >
                {isLoadingOlderMessages ? "Cargando mensajes…" : "Cargar mensajes anteriores"}
              </Button>
            </div>
          ) : null}
          {!targetOrganizationId ? (
            // Vista general: A09 razona sobre UN cliente. Se elige aquí en vez
            // de mandar al consultor a cambiar el cliente activo del portal.
            <div className={`grid gap-4 pt-2 ${styles.rise}`}>
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">¿Sobre qué cliente preguntas?</h3>
              <p className="text-sm text-muted">Analizo un cliente cada vez, con sus datos reales.</p>
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
          ) : messages.length === 0 && !isLoadingConversation ? (
            <div className={`grid gap-4 pt-2 ${styles.rise}`}>
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground [text-wrap:balance]">
                ¿Qué quieres saber{targetOrganizationName ? ` de ${targetOrganizationName}` : ""}?
              </h3>
              {view ? (
                <p className="text-[0.8rem] text-muted">
                  Estoy viendo <span className="font-medium text-foreground">{view.title}</span>
                  {view.storeLabel ? `, ${view.storeLabel}` : ""}
                  {view.summary?.period ? `, ${view.summary.period}` : ""}.
                </p>
              ) : null}
              <div className="grid gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="group grid grid-cols-[minmax(0,1fr)_1rem] items-center gap-3 rounded-lg border border-separator bg-white p-3 text-left text-[0.85rem] leading-5 text-foreground transition hover:translate-x-0.5 hover:border-accent/40"
                  >
                    <span>{suggestion}</span>
                    <IconChevronRight aria-hidden className="size-4 text-muted group-hover:text-accent" />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>Atajos:</span>
                {["/informe", "/comparar", "/embudo", "/margen", "/campañas"].map((command) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => {
                      setInput(`${command} `);
                      textareaRef.current?.focus();
                    }}
                    className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[0.7rem] text-accent hover:underline"
                  >
                    {command}
                  </button>
                ))}
              </div>
              <p className="flex items-start gap-2 rounded-md bg-surface px-3 py-2.5 text-xs leading-5 text-muted">
                <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                Leo datos reales y la metodología de Conocimiento. No cambio nada en la cuenta: lo que proponga queda
                pendiente hasta que lo apruebes.
              </p>
            </div>
          ) : (
            messages.map((message, index) =>
              message.role === "assistant" ? (
                renderAssistant(message, index)
              ) : (
                <div
                  key={`user-${index}`}
                  className={`ml-auto max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-separator bg-surface px-3.5 py-2.5 text-sm leading-6 text-foreground ${styles.rise}`}
                >
                  {message.content}
                </div>
              ),
            )
          )}
          {isLoadingConversation ? (
            <p className="flex items-center gap-2 text-sm text-muted" role="status">
              <span className={styles.spin} aria-hidden />
              Recuperando conversación…
            </p>
          ) : null}
          {isSending ? (
            <div className={`grid gap-3 ${styles.rise}`}>
              <div className="rounded-lg border border-separator bg-white p-3" role="status" aria-live="polite">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className={styles.spin} aria-hidden />
                  {liveStageLabel}
                  <span className="ml-auto font-mono text-xs text-muted tabular-nums">{segundos(elapsed)}</span>
                </div>
                {liveTools.length ? <div className="mt-2">{renderTrace(liveTools)}</div> : null}
              </div>
              {streamingAnswer ? (
                <div className="min-w-0 text-sm leading-relaxed" aria-live="off">
                  <Markdown>{answerText(streamingAnswer)}</Markdown>
                  <span aria-hidden className={styles.caret} />
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <Alert status={error.status} role="alert">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{error.message}</Alert.Description>
                {retryTurn ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => void ask(retryTurn.question, retryTurn.reference, retryTurn.confirmedFailed ? undefined : retryTurn.id)}
                    disabled={isSending}
                  >
                    Reintentar
                  </Button>
                ) : null}
              </Alert.Content>
            </Alert>
          ) : retryTurn && !isSending ? (
            <Alert status="warning" role="status">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{retryTurn.confirmedFailed ? "La consulta anterior falló. Puedes volver a intentarlo." : "Hay una pregunta sin respuesta confirmada."}</Alert.Description>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => void ask(retryTurn.question, retryTurn.reference, retryTurn.confirmedFailed ? undefined : retryTurn.id)}
                >
                  {retryTurn.confirmedFailed ? "Reintentar" : "Recuperar respuesta"}
                </Button>
              </Alert.Content>
            </Alert>
          ) : null}
        </div>
      </div>

      <footer className="relative shrink-0 border-t border-separator px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {commandMatches.length ? (
          <div
            className={`absolute inset-x-3 bottom-full z-20 mb-1 rounded-xl border border-separator bg-white p-1.5 shadow-lg ${styles.rise}`}
            role="listbox"
            aria-label="Comandos"
          >
            <p className="px-2 pb-1 pt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-muted">Comandos</p>
            {commandMatches.map((command, commandIndex) => (
              <button
                key={command.command}
                type="button"
                role="option"
                aria-selected={commandIndex === 0}
                onClick={() => {
                  setInput(`${command.command} `);
                  textareaRef.current?.focus();
                }}
                className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)] gap-2.5 rounded-lg px-2 py-2 text-left text-[0.8rem] hover:bg-accent-soft aria-selected:bg-accent-soft"
              >
                <code className="font-mono text-xs text-accent">{command.command}</code>
                <span className="text-muted">{command.hint}</span>
              </button>
            ))}
          </div>
        ) : null}

        {view && targetOrganizationId ? (
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Contexto que viaja con la pregunta">
            <ContextChip label="Pantalla" value={view.title} />
            {view.storeLabel ? <ContextChip label="Tienda" value={view.storeLabel} /> : null}
            {view.summary?.period || view.summary?.metrics?.length ? (
              sendScreenFigures ? (
                <ContextChip
                  label="Cifras"
                  value={view.summary?.period ?? "de la pantalla"}
                  onRemove={() => setSendScreenFigures(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setSendScreenFigures(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-separator px-2 py-0.5 text-xs text-muted hover:text-foreground"
                >
                  <PlusIcon aria-hidden className="size-3" />
                  Cifras de la pantalla
                </button>
              )
            ) : null}
            {pending?.focusLabel ? <ContextChip label="Foco" value={pending.focusLabel} focus /> : null}
          </div>
        ) : null}

        <form
          className={`relative rounded-xl border border-separator bg-white transition-[border-color,box-shadow] focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_var(--accent-soft)] ${isSending ? styles.busy : ""}`}
          onSubmit={submit}
        >
          <textarea
            ref={textareaRef}
            className={`${styles.composerInput} block max-h-40 min-h-12 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed`}
            aria-label="Pregunta para el Consultor IA"
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (isSending) return;
              const firstCommand = commandMatches[0];
              if (firstCommand && input.trim() !== firstCommand.command) {
                setInput(`${firstCommand.command} `);
                return;
              }
              event.currentTarget.form?.requestSubmit();
            }}
            placeholder={
              targetOrganizationId
                ? `Pregunta sobre ${targetOrganizationName ?? "este cliente"}… escribe / para atajos`
                : "Elige un cliente para empezar"
            }
            disabled={!targetOrganizationId}
          />
          <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
            <button
              type="button"
              className={`${iconButton} size-8 font-mono text-sm`}
              aria-label="Atajos"
              title="Atajos (/)"
              disabled={!targetOrganizationId}
              onClick={() => {
                setInput("/");
                textareaRef.current?.focus();
              }}
            >
              /
            </button>
            <CopilotModelMenu models={models} model={model} onModelChange={setModel} remaining={balance?.remaining} />
            <div className="ml-auto flex items-center">
              <CopilotSaldo balance={balance} degraded={degraded} />
            </div>
            <button
              type="submit"
              aria-label={isSending ? "Detener respuesta" : "Enviar"}
              title={isSending ? "Detener" : "Enviar (Enter)"}
              disabled={!isSending && (!input.trim() || !targetOrganizationId)}
              className={`flex size-9 items-center justify-center rounded-lg transition ${
                isSending
                  ? "bg-foreground text-background"
                  : "bg-accent text-accent-foreground enabled:hover:-translate-y-px disabled:opacity-35"
              }`}
            >
              {isSending ? (
                <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" />
                </svg>
              ) : (
                <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                  <path d="M10 16V4M5 9l5-5 5 5" />
                </svg>
              )}
            </button>
          </div>
        </form>
        <div className="flex justify-between gap-x-3 px-1 pt-1.5 text-[0.68rem] text-muted">
          <span className="shrink-0">Enter envía · Shift+Enter, nueva línea</span>
          <span className="min-w-0 truncate" title={effectiveModel ? `Última respuesta: ${effectiveModel}` : undefined}>
            Solo lectura: nada cambia sin tu aprobación
          </span>
        </div>
      </footer>

      {/* Historial: un cajón dentro del panel, no un select fijo en la cabecera. */}
      <div
        className={`absolute inset-0 z-30 flex flex-col bg-white ${styles.drawer} ${isHistoryOpen ? styles.drawerOpen : ""}`}
        inert={!isHistoryOpen}
        aria-label="Historial de conversaciones"
        role="dialog"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-separator py-2 pl-2 pr-4">
          <button type="button" className={iconButton} aria-label="Volver a la conversación" onClick={() => setIsHistoryOpen(false)}>
            <IconChevronLeft aria-hidden />
          </button>
          <h2 className="text-[0.95rem] font-semibold text-foreground">Conversaciones</h2>
          {view?.storeLabel ? (
            <span className="ml-auto truncate text-xs text-muted">{view.storeLabel}</span>
          ) : null}
        </div>
        <div className="relative mx-4 my-3">
          <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="Buscar conversaciones"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Buscar en tus conversaciones"
            className="w-full pl-9"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {historyGroups.length === 0 ? (
            <p className="px-2 text-sm text-muted">
              {historyQuery.trim() ? "No hay conversaciones que coincidan." : "Aún no hay conversaciones en esta tienda."}
            </p>
          ) : (
            historyGroups.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-muted">
                  {group.label}
                </p>
                {group.items.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    aria-current={conversation.id === conversationId ? "true" : undefined}
                    onClick={() => {
                      setIsHistoryOpen(false);
                      if (conversation.id !== conversationId) void loadConversation(conversation.id);
                    }}
                    className="grid w-full gap-0.5 rounded-md px-2 py-2 text-left hover:bg-surface aria-[current=true]:bg-accent-soft"
                  >
                    <span
                      className={`truncate text-sm font-medium ${conversation.id === conversationId ? "text-accent" : "text-foreground"}`}
                    >
                      {conversation.title || "Conversación sin título"}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(conversation.updated_at).toLocaleString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
          {hasMoreConversations && conversationHistoryCursor ? (
            <Button
              size="sm"
              variant="secondary"
              className="mx-2 mt-3 w-[calc(100%-1rem)]"
              disabled={isLoadingMoreConversations}
              onClick={() => void loadMoreConversations()}
            >
              {isLoadingMoreConversations ? "Cargando…" : "Ver más conversaciones"}
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className={`pointer-events-none absolute bottom-36 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-3.5 py-2 text-xs text-background ${styles.rise}`}
        >
          {notice}
        </div>
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <aside
        id="copilot-panel"
        aria-label="Consultor IA"
        className="sticky top-14 hidden h-[calc(100dvh/var(--ui-zoom)_-_3.5rem)] min-h-0 border-l border-separator bg-white lg:block"
      >
        {panel}
      </aside>
    );
  }

  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} size="sm" bare ariaLabel="Consultor IA" title="Consultor IA">
      <div id="copilot-panel" className="flex h-full min-h-0 flex-col">
        {panel}
      </div>
    </Sheet>
  );
}
