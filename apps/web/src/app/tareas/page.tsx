"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useMarketingDrafts } from "@/hooks/use-marketing-drafts";
import { latestMarketingAssetByTask, marketingAssetHref, marketingAssetStatusLabel, marketingDraftAsCaminoAsset, type CaminoMarketingAsset } from "@/lib/camino-marketing-assets";
import { usePaginatedUrl } from "@/hooks/use-paginated-url";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  ProposedTasksList,
  useProposedTasks,
} from "@/components/ai-proposed-tasks";
import { ModuleSummary } from "@/components/module-summary";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { assigneeLabel } from "./assignee-label";
import s from "./tareas.module.css";
import { daysSince, isWithinLastDays, oldest } from "@/lib/elapsed";
import { displayValue } from "@/lib/display-labels";
import { DiscussModal } from "@/components/discuss-modal";
import { HeroBlock, heroPrimary, WorkPageHeader } from "@/components/trabajo-ui";
import {
  LoadingBlock,
  Checkbox,
  EmptyState,
  Badge,
  Button,
  Card,
  CollapsibleSection,
  ErrorBlock,
  Field,
  Input,
  Dialog,
  List,
  Pagination,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

const TASKS_PAGE_SIZE = 20;

type TaskComment = {
  id: string;
  body: string;
  is_internal: boolean;
  author_user_id: string;
  created_at: string;
};

type Task = {
  id: string;
  alert_id: string | null;
  source: string;
  status: string;
  priority: string;
  categories: string[];
  title: string;
  description: string | null;
  due_at: string | null;
  // Quién se encarga. Lo escribe el reparto de Configuración -> Accesos (o el
  // creador, en las tareas a mano). La lista de cartera del consultor todavía
  // no los trae, de ahí que sean opcionales.
  assigned_to?: string | null;
  assignee_name?: string | null;
  is_visible_to_client: boolean;
  created_at: string;
  updated_at: string;
  outcome_metric_name?: string | null;
  outcome_before_value?: number | null;
  outcome_after_value?: number | null;
  outcome_unit?: string | null;
  outcome_summary?: string | null;
  outcome_measured_at?: string | null;
  outcome_recorded_at?: string | null;
  task_comments: TaskComment[];
  // Tienda a la que va etiquetada (las internas del consultor la llevan).
  store?: { id: string; name: string | null } | null;
  // Fase/hito de Mi Camino al que cuelga esta tarea (misma tabla `tasks`).
  milestone: { id: string; name: string; phase_name: string | null } | null;
};

type TaskOutcomeInput = {
  metric_name: string;
  before_value?: number | null;
  after_value?: number | null;
  unit?: string;
  summary?: string;
  measured_at: string;
};

function taskCanGenerateMarketing(task: Task) {
  const context = `${task.title} ${task.categories.join(" ")}`
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /mail(?:ing)?|email|e-mail|correo|newsletter|klaviyo|lista de espera|acceso anticipado|campana/.test(context);
}

/** Cáscara única del detalle de tarea (vista de cartera y vista de cliente). */
function TaskDetailDialog({
  task,
  eyebrow,
  onClose,
  onDiscuss,
  children,
}: {
  task: Task;
  eyebrow?: string;
  onClose: () => void;
  onDiscuss?: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      eyebrow={eyebrow}
      title={task.title}
      cancelLabel="Cerrar"
      primary={onDiscuss ? { label: "Escribir sobre esto", onClick: onDiscuss } : undefined}
    >
      {children}
    </Dialog>
  );
}

function TaskOutcomeDialog({
  taskTitle,
  mode,
  isPending,
  onClose,
  onConfirm,
  onCompleteWithoutMetric,
}: {
  taskTitle: string;
  mode: "complete" | "record";
  isPending: boolean;
  onClose: () => void;
  onConfirm: (outcome: TaskOutcomeInput) => void;
  onCompleteWithoutMetric: () => void;
}) {
  const [metricName, setMetricName] = useState("");
  const [beforeValue, setBeforeValue] = useState("");
  const [afterValue, setAfterValue] = useState("");
  const [unit, setUnit] = useState("");
  const [summary, setSummary] = useState("");
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const today = new Date();
  const maxMeasuredAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const metric = metricName.trim();
    const observed = afterValue.trim();
    const note = summary.trim();
    if (!metric || (!observed && !note)) return;
    onConfirm({
      metric_name: metric,
      ...(beforeValue.trim() ? { before_value: Number(beforeValue) } : {}),
      ...(observed ? { after_value: Number(observed) } : {}),
      ...(unit.trim() ? { unit: unit.trim() } : {}),
      ...(note ? { summary: note } : {}),
      measured_at: measuredAt,
    });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={mode === "record" ? "Registrar medición posterior" : "¿Qué resultado observaste?"}
      isBusy={isPending}
      formId="task-outcome-form"
      start={
        mode === "complete" ? (
          <Button variant="ghost" disabled={isPending} onClick={onCompleteWithoutMetric}>
            Completar sin métrica
          </Button>
        ) : undefined
      }
      primary={{
        label: mode === "record" ? "Guardar medición" : "Guardar y completar",
        busyLabel: "Guardando…",
        disabled: !metricName.trim() || (!afterValue.trim() && !summary.trim()),
      }}
    >
      <p className="text-muted">
        {mode === "record"
          ? `Añade o actualiza el resultado medido de «${taskTitle}».`
          : `Vas a completar «${taskTitle}». Si ya mediste su resultado, guárdalo para que los próximos planes aprendan.`}
      </p>
      <form id="task-outcome-form" className="space-y-4" onSubmit={submit}>
        <Field label="Métrica observada">
          <Input value={metricName} onChange={(event) => setMetricName(event.target.value)} maxLength={120} placeholder="Ej. conversión, margen, tiempo de preparación" />
        </Field>
        <div className="grid grid-cols-[1fr_1fr_5rem] gap-3">
          <Field label="Antes">
            <Input type="number" step="any" value={beforeValue} onChange={(event) => setBeforeValue(event.target.value)} placeholder="Opcional" />
          </Field>
          <Field label="Después">
            <Input type="number" step="any" value={afterValue} onChange={(event) => setAfterValue(event.target.value)} placeholder="Opcional" />
          </Field>
          <Field label="Unidad">
            <Input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={40} placeholder="%, €…" />
          </Field>
        </div>
        <Field label="Fecha de medición">
          <Input type="date" max={maxMeasuredAt} value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} />
        </Field>
        <Field label="Contexto del resultado (opcional)">
          <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={1000} placeholder="Ventana comparada, fuente o limitaciones de la medición…" />
        </Field>
      </form>
    </Dialog>
  );
}

type Alert = {
  id: string;
  status: string;
  severity: string;
  title: string;
  message: string;
  metric_value: number | null;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
};

type OperationsResponse = {
  organization_id: string;
  tasks: Task[];
  alerts: Alert[];
};

const STATUS_LABELS: Record<string, string> = {
  proposed: "Propuesta",
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  ignored: "Ignorada",
  cancelled: "Cancelada",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const CATEGORY_LABELS: Record<string, string> = {
  shopify: "Shopify",
  meta: "Meta Ads",
  klaviyo: "Klaviyo",
  general: "General",
};

const SEVERITY_TONE: Record<string, "neutral" | "warn" | "danger"> = {
  info: "neutral",
  low: "neutral",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "Informativa",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

// DB-07: SLA de overdue formalizado -- una tarea esta vencida si su
// due_at ya paso y sigue abierta (pending/in_progress); el mismo criterio
// que calcula "overdue_tasks" para el health score del panel de consultor
// (consultant.ts), aplicado aqui por primera vez a la vista del cliente que
// gestiona la tarea (antes due_at se guardaba y viajaba en la respuesta de
// la API pero nunca se mostraba).
function isTaskOverdue(task: Task) {
  return (
    Boolean(task.due_at) &&
    ["pending", "in_progress"].includes(task.status) &&
    Date.parse(task.due_at as string) < Date.now()
  );
}

// De dónde sale la tarea, cuando no es a mano: se ve en la fila como chip.
const SOURCE_LABELS: Record<string, string> = {
  alert: "Desde alerta",
  ai_consultant: "IA",
  strategic_plan: "Mi Camino",
  campaign: "Agenda",
};

// "Fase · Hito" de Mi Camino al que pertenece la tarea, para la meta de la fila.
function milestoneLabel(task: Task) {
  if (!task.milestone) return null;
  return task.milestone.phase_name
    ? `${task.milestone.phase_name} · ${task.milestone.name}`
    : task.milestone.name;
}

function formatDueDate(dueAt: string) {
  return new Date(dueAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Dias de calendario hasta `value` (0 = hoy, negativo = ya paso). Se compara a
// medianoche local: contando horas, una tarea que vence hoy a las 23:00 salia
// como "en 1 d" a mediodia.
function daysUntilDate(value: string) {
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// El vencimiento sale de la meta y pasa a columna propia en la fila. Al
// escanear un backlog la pregunta es "que va tarde", no "que fecha exacta
// tiene": relativo mientras la fecha significa algo, absoluto cuando ya no
// ("en 47 d" no se lee, "12 nov 2026" si).
const DUE_TONE = {
  danger: "text-danger font-medium",
  warn: "text-warning font-medium",
  muted: "text-muted",
} as const;

function dueSignal(task: Task): {
  text: string;
  tone: keyof typeof DUE_TONE;
} {
  if (!task.due_at) return { text: "Sin fecha", tone: "muted" };
  const open = ["pending", "in_progress"].includes(task.status);
  const days = daysUntilDate(task.due_at);
  // Cerrada: la fecha ya no urge, solo documenta.
  if (!open) return { text: formatDueDate(task.due_at), tone: "muted" };
  if (days < 0) return { text: `Vencida ${-days} d`, tone: "danger" };
  if (days === 0) return { text: "Vence hoy", tone: "warn" };
  if (days <= 7)
    return { text: `En ${days} d`, tone: days <= 2 ? "warn" : "muted" };
  return { text: formatDueDate(task.due_at), tone: "muted" };
}

function TaskDetail({
  task,
  showVisibility,
  viewerUserId,
  commentDraft,
  onCommentChange,
  canMarkInternal,
  isInternalDraft,
  onInternalChange,
  onSubmitComment,
  onStatusChange,
  onGenerateMarketing,
  isGeneratingMarketing,
  linkedMarketingAsset,
  onOpenMarketingAsset,
}: {
  task: Task;
  showVisibility: boolean;
  viewerUserId?: string;
  commentDraft: string;
  onCommentChange: (value: string) => void;
  canMarkInternal: boolean;
  isInternalDraft: boolean;
  onInternalChange: (value: boolean) => void;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  /** Sin ella (un consultor mirando la tarea de un cliente asignado): la
   * tarea se puede proponer y comentar, pero no resolver -- eso es del
   * cliente. El backend ya lo exige (updateTaskStatus); esto evita ademas
   * enseñar un boton que devolveria 403 al pulsarlo. */
  onStatusChange?: (status: string) => void;
  onGenerateMarketing?: () => void;
  isGeneratingMarketing?: boolean;
  linkedMarketingAsset?: CaminoMarketingAsset | null;
  onOpenMarketingAsset?: (asset: CaminoMarketingAsset) => void;
}) {
  const meta = [
    task.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" · "),
    PRIORITY_LABELS[task.priority] ?? task.priority,
    STATUS_LABELS[task.status] ?? task.status,
    task.due_at ? `vence ${formatDueDate(task.due_at)}` : null,
    isTaskOverdue(task) ? "vencida" : null,
    viewerUserId
      ? assigneeLabel(task.assigned_to, task.assignee_name, viewerUserId)
      : null,
    showVisibility && !task.is_visible_to_client ? "interna" : null,
    task.store?.name ? `tienda ${task.store.name}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{task.title}</p>
          <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {onGenerateMarketing ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={isGeneratingMarketing}
              onClick={onGenerateMarketing}
            >
              {isGeneratingMarketing ? "Agente trabajando…" : "Activar agente de email"}
            </Button>
          ) : null}
          {linkedMarketingAsset && onOpenMarketingAsset ? (
            <Button variant="secondary" size="sm" onClick={() => onOpenMarketingAsset(linkedMarketingAsset)}>
              Abrir borrador · {marketingAssetStatusLabel(linkedMarketingAsset)}
            </Button>
          ) : null}
          {onStatusChange && task.status === "proposed" ? (
            <>
              <Button size="sm" onClick={() => onStatusChange("pending")}>
                Aceptar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onStatusChange("ignored")}>
                Rechazar
              </Button>
            </>
          ) : null}
          {onStatusChange && task.status === "pending" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange("in_progress")}
            >
              Empezar
            </Button>
          ) : null}
          {onStatusChange &&
          ["pending", "in_progress"].includes(task.status) ? (
            <>
              <Button size="sm" onClick={() => onStatusChange("completed")}>
                Completar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStatusChange("ignored")}
              >
                Ignorar
              </Button>
            </>
          ) : null}
          {onStatusChange && task.status === "completed" ? (
            <Button variant="ghost" size="sm" onClick={() => onStatusChange("record_outcome")}>
              {task.outcome_metric_name ? "Actualizar medición" : "Registrar resultado"}
            </Button>
          ) : null}
        </div>
      </div>

      {task.description ? (
        <p className="text-[13px] leading-relaxed text-foreground">
          {task.description}
        </p>
      ) : null}

      {task.outcome_metric_name && task.outcome_measured_at ? (
        <section className="rounded-md border border-edge bg-surface-subtle p-3" aria-label="Resultado medido de la tarea">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Resultado observado · no demuestra causalidad</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {task.outcome_metric_name}: {task.outcome_before_value == null ? "—" : task.outcome_before_value.toLocaleString("es-ES")} → {task.outcome_after_value == null ? "—" : task.outcome_after_value.toLocaleString("es-ES")} {task.outcome_unit ?? ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">Medido el {new Date(`${task.outcome_measured_at}T12:00:00`).toLocaleDateString("es-ES")}</p>
          {task.outcome_summary ? <p className="mt-2 text-sm text-muted">{task.outcome_summary}</p> : null}
        </section>
      ) : null}

      <div className="border-t border-separator pt-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Comentarios
          {task.task_comments.length > 0
            ? ` (${task.task_comments.length})`
            : ""}
        </p>

        {task.task_comments.length > 0 ? (
          <ul className="mt-2 space-y-3">
            {task.task_comments.map((comment) => (
              <li key={comment.id}>
                <p className="text-[13px] leading-relaxed text-foreground">
                  {comment.body}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {comment.is_internal ? "interno · " : ""}
                  {new Date(comment.created_at).toLocaleString("es-ES")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-muted">
            Sin comentarios todavía.
          </p>
        )}

        <form className="mt-3 space-y-2" onSubmit={onSubmitComment}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="min-w-0 flex-1"
              aria-label={`Comentario para la tarea ${task.title}`}
              value={commentDraft}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Añadir comentario..."
            />
            <Button
              variant="secondary"
              type="submit"
              className="w-full sm:w-auto"
            >
              Comentar
            </Button>
          </div>
          {canMarkInternal ? (
            <Checkbox checked={isInternalDraft} onChange={onInternalChange}>
              Comentario interno (el cliente no lo verá)
            </Checkbox>
          ) : null}
        </form>
      </div>
    </div>
  );
}

// Alta manual (FE-03: el modulo de tareas no tenia forma de anadir un
// pendiente ad-hoc -- solo llegaban desde reglas de alertas, IA, llamadas o
// Mi Camino). El checkbox de visibilidad solo aparece para consultor/admin;
// una tarea que crea el propio cliente siempre es visible para si mismo.
function NewTaskForm({
  canMarkInternal,
  isSubmitting,
  milestones,
  onCancel,
  onSubmit,
}: {
  canMarkInternal: boolean;
  isSubmitting: boolean;
  milestones: { value: string; label: string }[];
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    priority: string;
    category: string;
    dueAt: string;
    isVisibleToClient: boolean;
    milestoneId: string;
    connectionId: string;
  }) => Promise<boolean>;
}) {
  // Una tarea interna se etiqueta con una tienda del cliente (por defecto, la activa del selector).
  const { connectionId: activeConnectionId, stores = [] } = useActiveConnection();
  const [storeConnectionId, setStoreConnectionId] = useState(activeConnectionId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [dueAt, setDueAt] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [milestoneId, setMilestoneId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const created = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      dueAt,
      isVisibleToClient: !isInternal,
      milestoneId,
      connectionId: isInternal ? storeConnectionId : "",
    });
    if (created) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("general");
      setDueAt("");
      setIsInternal(false);
      setMilestoneId("");
    }
  }

  return (
    <Card>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Input
          aria-label="Titulo de la tarea"
          placeholder="Titulo de la tarea"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Textarea
          aria-label="Descripcion de la tarea"
          placeholder="Descripcion (opcional)"
          className="h-20"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Prioridad"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: "Baja" },
              { value: "medium", label: "Media" },
              { value: "high", label: "Alta" },
              { value: "urgent", label: "Urgente" },
            ]}
          />
          <Select
            aria-label="Modulo"
            value={category}
            onChange={setCategory}
            options={[
              { value: "shopify", label: "Shopify" },
              { value: "meta", label: "Meta Ads" },
              { value: "klaviyo", label: "Klaviyo" },
              { value: "general", label: "General" },
            ]}
          />
          <Input
            type="date"
            aria-label="Fecha limite"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="w-40"
          />
          <div className={s.chips} role="group" aria-label="Atajos de fecha">
            {[
              ["Hoy", 0],
              ["Mañana", 1],
              ["En 1 semana", 7],
            ].map(([label, days]) => {
              const d = new Date();
              d.setDate(d.getDate() + Number(days));
              const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              return (
                <button
                  key={label}
                  type="button"
                  className={s.chip}
                  aria-pressed={dueAt === value}
                  onClick={() => setDueAt(value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {milestones.length > 0 ? (
          <Select
            aria-label="Fase o hito de Mi Camino"
            value={milestoneId}
            onChange={setMilestoneId}
            options={[{ value: "", label: "Sin fase ni hito" }, ...milestones]}
          />
        ) : null}
        {canMarkInternal ? (
          <Checkbox checked={isInternal} onChange={setIsInternal}>
            Tarea interna (el cliente no la verá)
          </Checkbox>
        ) : null}
        {canMarkInternal && isInternal && stores.length > 0 ? (
          <Select
            aria-label="Tienda de la tarea"
            value={storeConnectionId}
            onChange={setStoreConnectionId}
            options={[
              { value: "", label: "Sin tienda" },
              ...stores.map((store) => ({ value: store.connectionId, label: store.label })),
            ]}
          />
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? "Creando..." : "Crear tarea"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Escala tipografica del modulo (una sola en toda la app):
//  - Titulo de fila:        text-sm font-medium text-foreground
//  - Cuerpo / descripcion:  text-[13px] text-muted leading-relaxed
//  - Meta (fecha, modulo):  text-xs text-muted   (sin font-mono: era ruido)
// La jerarquia la da el contraste tamano+peso+color, no poner todo a
// `text-sm text-muted` (que es como estaba: "se lee todo igual").

type TabDef = { value: string; label: string; count?: number };

function TabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-separator [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(tab.value)}
            className={[
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors pointer-coarse:py-3",
              active
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="ml-1.5 text-xs text-muted">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Fila compacta de tarea: lo justo para escanear (titulo + una senal de
// prioridad/vencimiento + meta en una linea). El detalle completo
// (descripcion, comentarios, mas acciones) vive en el modal, no bajo cada
// fila -- antes cada fila traia su propio formulario de comentario y todos
// los badges, y 20 de esas era el "descontrol".
function TaskRow({
  task,
  showVisibility,
  viewerUserId,
  clientName,
  isPending,
  onStatusChange,
  onOpenDetail,
  linkedMarketingAsset,
}: {
  task: Task;
  showVisibility: boolean;
  viewerUserId?: string;
  clientName?: string;
  isPending: boolean;
  /** Sin ella: proponer y comentar, no resolver (ver TaskDetail). */
  onStatusChange?: (status: string) => void;
  onOpenDetail: () => void;
  linkedMarketingAsset?: CaminoMarketingAsset | null;
}) {
  const due = dueSignal(task);
  // La prioridad ya no la tapa el vencimiento: antes el badge "Vencida"
  // SUSTITUIA al de prioridad, asi que una urgente vencida se leia igual que
  // una baja vencida. Ahora el retraso vive en la columna de fecha y el badge
  // clasifica solo por prioridad.
  const priorityBadge =
    task.priority === "urgent"
      ? ({ tone: "danger", label: PRIORITY_LABELS.urgent } as const)
      : task.priority === "high"
        ? ({ tone: "warn", label: PRIORITY_LABELS.high } as const)
        : null;

  const meta = [
    task.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" · "),
    STATUS_LABELS[task.status] ?? task.status,
    task.source === "alert" ? "desde alerta" : null,
    milestoneLabel(task),
    task.task_comments.length > 0
      ? `${task.task_comments.length} coment.`
      : null,
    viewerUserId
      ? assigneeLabel(task.assigned_to, task.assignee_name, viewerUserId)
      : null,
    showVisibility && !task.is_visible_to_client ? "interna" : null,
    task.store?.name ? `tienda ${task.store.name}` : null,
  ].filter(Boolean);

  return (
    <div
      className={`${s.row} task-lift-card flex flex-wrap items-start gap-x-4 gap-y-2 py-3`}
      data-focus-id={task.id}
      data-priority={task.priority}
      data-overdue={isTaskOverdue(task) ? "" : undefined}
      data-done={
        ["pending", "in_progress"].includes(task.status) ? undefined : ""
      }
    >
      <div className="min-w-[15rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {priorityBadge ? (
            <Badge tone={priorityBadge.tone}>{priorityBadge.label}</Badge>
          ) : null}
          {/* Sin `truncate`: un titulo cortado obliga a abrir el detalle solo
              para saber de que va la tarea. */}
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          {task.milestone ? (
            <Badge tone="brand">Hito · {milestoneLabel(task)}</Badge>
          ) : null}
          {linkedMarketingAsset ? (
            <Badge tone={linkedMarketingAsset.status === "rejected" ? "danger" : linkedMarketingAsset.status === "approved" ? "success" : "neutral"}>
              Marketing · {marketingAssetStatusLabel(linkedMarketingAsset)}
            </Badge>
          ) : null}
          {SOURCE_LABELS[task.source] && task.source !== "strategic_plan" ? (
            <Badge tone="neutral">{SOURCE_LABELS[task.source]}</Badge>
          ) : null}
        </div>
        {/* El cliente va en la meta con peso propio, no en un badge gris que
            competia con los que si clasifican la tarea. */}
        <p className="mt-0.5 text-xs text-muted">
          {clientName ? (
            <>
              <span className="font-medium text-foreground">{clientName}</span>
              {" · "}
            </>
          ) : null}
          {meta.join(" · ")}
        </p>
      </div>
      {/* Columna fija de vencimiento: alineada en todas las filas, "que va
          tarde" se lee en vertical sin entrar en cada meta. */}
      <span
        className={[
          // El ancho fijo solo tiene sentido cuando las filas se alinean.
          // En movil la columna cae a la segunda linea y 112px alineados a
          // la derecha dejaban un hueco suelto: ahi va a ancho natural.
          "shrink-0 pt-0.5 text-xs tabular-nums sm:w-28 sm:text-right",
          DUE_TONE[due.tone],
        ].join(" ")}
      >
        {due.text}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {onStatusChange && task.status === "proposed" ? (
          <>
            <Button size="sm" disabled={isPending} onClick={() => onStatusChange("pending")}>
              {isPending ? "..." : "Aceptar"}
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => onStatusChange("ignored")}>
              Rechazar
            </Button>
          </>
        ) : null}
        {onStatusChange && task.status === "pending" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => onStatusChange("in_progress")}
          >
            Empezar
          </Button>
        ) : null}
        {onStatusChange &&
        ["pending", "in_progress"].includes(task.status) ? (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onStatusChange("completed")}
          >
            {isPending ? "..." : "Completar"}
          </Button>
        ) : null}
        {onStatusChange && task.status === "completed" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => onStatusChange("record_outcome")}
          >
            Medir
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onOpenDetail}>
          Detalle
        </Button>
      </div>
    </div>
  );
}

// Filtros del modulo: eran el mismo bloque copiado en la vista de cartera y en
// la de tienda, y ya habian empezado a divergir (la de cartera dejaba el
// buscador visible en la pestana de alertas, donde no filtraba nada).
function TaskFilters({
  query,
  onQueryChange,
  clientOptions,
  client,
  onClientChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  actions,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  clientOptions?: { value: string; label: string }[];
  client?: string;
  onClientChange?: (value: string) => void;
  /** Estado y modulo solo aplican a tareas; en alertas no se pintan. */
  status?: string;
  onStatusChange?: (value: string) => void;
  category?: string;
  onCategoryChange?: (value: string) => void;
  actions?: ReactNode;
}) {
  // gap-2 = 0.5rem, asi que dos controles al 50% menos 0.25rem llenan la fila
  // justa: en movil los filtros caen de dos en dos, en vez de tres selects
  // sueltos de ~190px dejando 100px muertos a la derecha de cada uno.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="w-full sm:w-64"
        type="search"
        aria-label="Buscar"
        placeholder="Buscar por título o descripción..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {clientOptions && onClientChange ? (
        <Select
          className="w-[calc(50%-0.25rem)] sm:w-48"
          aria-label="Filtrar por cliente"
          value={client ?? "all"}
          onChange={onClientChange}
          options={clientOptions}
        />
      ) : null}
      {onStatusChange && onCategoryChange ? (
        <>
          <div className={s.chips} role="group" aria-label="Filtrar por estado">
            {[
              ["open", "Abiertas"],
              ["in_progress", "En curso"],
              ["completed", "Completadas"],
              ["ignored", "Ignoradas"],
              ["all", "Todas"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={s.chip}
                aria-pressed={(status ?? "open") === value}
                onClick={() => onStatusChange(value!)}
              >
                {label}
              </button>
            ))}
          </div>
          <Select
            className="w-[calc(50%-0.25rem)] sm:w-40"
            aria-label="Filtrar por módulo"
            value={category ?? "all"}
            onChange={onCategoryChange}
            options={[
              { value: "all", label: "Todos los módulos" },
              { value: "shopify", label: "Shopify" },
              { value: "meta", label: "Meta Ads" },
              { value: "klaviyo", label: "Klaviyo" },
              { value: "general", label: "General" },
            ]}
          />
        </>
      ) : null}
      {actions ? <div className="ml-auto">{actions}</div> : null}
    </div>
  );
}

// Fila de alerta: misma estructura que estaba duplicada literalmente en las dos
// vistas. El nombre del cliente va en la meta con peso, no en un badge gris
// junto al de severidad (mismo criterio que en TaskRow).
function AlertRow({
  alert,
  clientName,
  isPending,
  onStatusChange,
  onCreateTask,
}: {
  alert: Alert;
  clientName?: string;
  isPending: boolean;
  onStatusChange: (status: string) => void;
  /** Convierte la alerta en una tarea con su título y su mensaje. */
  onCreateTask?: () => void;
}) {
  return (
    <List.Item data-focus-id={alert.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-[15rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={SEVERITY_TONE[alert.severity] ?? "neutral"}>
            {SEVERITY_LABELS[alert.severity] ?? alert.severity}
          </Badge>
          <p className="text-sm font-medium text-foreground">{alert.title}</p>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {alert.message}
        </p>
        <p className="mt-1 text-xs text-muted">
          {clientName ? (
            <>
              <span className="font-medium text-foreground">{clientName}</span>
              {" · "}
            </>
          ) : null}
          detectada{" "}
          {new Date(alert.first_detected_at).toLocaleDateString("es-ES")}
          {/* "ultima vez" solo cuando aporta: si coincide con la deteccion es
              ruido repetido en cada fila. */}
          {alert.last_detected_at !== alert.first_detected_at
            ? ` · última vez ${new Date(alert.last_detected_at).toLocaleDateString("es-ES")}`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {alert.status === "open" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => onStatusChange("acknowledged")}
          >
            Marcar vista
          </Button>
        ) : null}
        {onCreateTask ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={onCreateTask}
          >
            Crear tarea
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => onStatusChange("resolved")}
        >
          {isPending ? "..." : "Resolver"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => onStatusChange("dismissed")}
        >
          Descartar
        </Button>
      </div>
    </List.Item>
  );
}

// --- Estado "vista general" de /tareas (consultor sin cliente activo):
// tareas y alertas de toda la cartera, mismos filtros + filtro por cliente. ---

type PortfolioTask = Task & {
  organization_id: string;
  organization_name: string;
};
type PortfolioAlert = Alert & {
  organization_id: string;
  organization_name: string;
};
type ConsultantOperations = {
  organizations: Array<{ id: string; display_name: string }>;
  tasks: PortfolioTask[];
  alerts: PortfolioAlert[];
};

// Una card por tienda con como va de tareas: abiertas, vencidas, completadas.
// Es lo primero que se ve en vista general -- antes de bucear en la lista
// plana de tareas, saber que cliente lleva retraso.
type ClientSummary = {
  organization_id: string;
  organization_name: string;
  open: number;
  overdue: number;
  completed: number;
  /** Dias que lleva esperando la tarea abierta mas vieja de este cliente. */
  stalestOpenDays: number | null;
};

function buildClientSummaries(
  data: ConsultantOperations | null,
): ClientSummary[] {
  const tasksByOrg = new Map<string, PortfolioTask[]>();
  for (const task of data?.tasks ?? []) {
    const list = tasksByOrg.get(task.organization_id) ?? [];
    list.push(task);
    tasksByOrg.set(task.organization_id, list);
  }
  return (data?.organizations ?? [])
    .map((org) => {
      const tasks = tasksByOrg.get(org.id) ?? [];
      const open = tasks.filter((t) =>
        ["pending", "in_progress"].includes(t.status),
      );
      return {
        organization_id: org.id,
        organization_name: org.display_name,
        open: open.length,
        overdue: tasks.filter(isTaskOverdue).length,
        completed: tasks.filter((t) => t.status === "completed").length,
        stalestOpenDays: daysSince(oldest(open.map((t) => t.created_at))),
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open);
}

function ClientSummaryGrid({
  summaries,
  activeClientId,
  onSelectClient,
  proposedByOrg,
}: {
  summaries: ClientSummary[];
  activeClientId: string;
  onSelectClient: (organizationId: string) => void;
  /** Propuestas de la IA sin decidir, por organizacion. */
  proposedByOrg: Map<string, number>;
}) {
  if (summaries.length === 0) return null;
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
      {summaries.map((summary) => {
        const active = summary.organization_id === activeClientId;
        const proposed = proposedByOrg.get(summary.organization_id) ?? 0;
        return (
          <button
            key={summary.organization_id}
            type="button"
            // Es un filtro que se queda puesto, no una navegacion: sin
            // `aria-pressed` un lector de pantalla no distingue la tarjeta
            // activa de las demas (el borde solo lo dice en pantalla).
            aria-pressed={active}
            onClick={() =>
              onSelectClient(active ? "all" : summary.organization_id)
            }
            className={[
              "rounded-md border p-4 text-left transition-colors",
              active
                ? "border-accent bg-accent-soft"
                : "border-separator hover:border-foreground",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-sm font-medium text-foreground">
                {summary.organization_name}
              </p>
              {summary.overdue > 0 ? (
                <Badge tone="danger">
                  {summary.overdue} vencida{summary.overdue === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            {/* La cifra que importa (abiertas) con peso propio; el resto es
                contexto. Antes las tres iban al mismo tamano y color. */}
            <p className="mt-1.5 text-sm tabular-nums text-foreground">
              <span className="font-semibold">{summary.open}</span>{" "}
              <span className="text-muted">
                abierta{summary.open === 1 ? "" : "s"} · {summary.completed}{" "}
                completada{summary.completed === 1 ? "" : "s"}
              </span>
            </p>
            {/* Backlog vivo o cementerio: 8 tareas abiertas de hace tres dias
                y 8 de hace tres meses son dos clientes distintos. */}
            {summary.stalestOpenDays !== null &&
            summary.stalestOpenDays >= 14 ? (
              <p className="mt-0.5 text-xs text-warning">
                la más antigua lleva {summary.stalestOpenDays} d
              </p>
            ) : null}
            {proposed > 0 ? (
              <p className="mt-2">
                <Badge tone="brand">
                  {proposed} propuesta{proposed === 1 ? "" : "s"} de la IA
                </Badge>
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ConsultantOperationsView({
  isConsultant,
  bootstrap,
}: {
  isConsultant: boolean;
  bootstrap: BootstrapResponse;
}) {
  const operationsQuery = useCachedQuery<ConsultantOperations>(
    "/v1/consultant/operations",
  );
  // Esta vista mezcla la cartera de clientes con la tienda propia del
  // consultor (listConsultantOrganizations la incluye a proposito, ver
  // consultant.ts). Proponer/comentar vale para las dos; resolver
  // (completar/ignorar/cambiar estado) solo para lo suyo -- el backend ya lo
  // exige (updateTaskStatus), esto evita enseñar un boton que daria 403.
  const ownOrganizationIds = new Set(
    bootstrap.memberships
      .filter((membership) => membership.accessSource !== "consultant_assignment")
      .map((membership) => membership.organization_id),
  );
  const data = operationsQuery.data ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const error =
    actionError ??
    (operationsQuery.error
      ? "No se pudieron cargar las operaciones. Revisa la conexión e inténtalo de nuevo."
      : null);
  const isLoading = operationsQuery.isLoading;
  const [tab, setTab] = useState<"tasks" | "alerts">("tasks");
  const [statusFilter, setStatusFilter] = useState("open");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [completionTask, setCompletionTask] = useState<{ organizationId: string; taskId: string; title: string; mode: "complete" | "record" } | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [commentInternalDrafts, setCommentInternalDrafts] = useState<
    Record<string, boolean>
  >({});
  const {
    clients: proposedClients,
    reload: reloadProposed,
    pendingByOrg,
  } = useProposedTasks();

  const load = useCallback(() => {
    setActionError(null);
    operationsQuery.reload();
  }, [operationsQuery.reload]);

  async function changeTaskStatus(
    organizationId: string,
    taskId: string,
    status: string,
    outcome?: TaskOutcomeInput | null,
  ) {
    if ((status === "completed" && outcome === undefined) || status === "record_outcome") {
      const task = data?.tasks.find((item) => item.id === taskId && item.organization_id === organizationId);
      setDetailTaskId(null);
      setCompletionTask({ organizationId, taskId, title: task?.title ?? "Tarea", mode: status === "record_outcome" || task?.status === "completed" ? "record" : "complete" });
      return;
    }
    setPendingTaskId(taskId);
    setActionError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${taskId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, ...(outcome ? { outcome } : {}) }),
        },
      );
      if (!response.ok) {
        setActionError(await readApiError(response));
        return;
      }
      toast.success(status === "completed" && outcome
        ? "Tarea completada y resultado medido guardado."
        : `Tarea marcada como «${STATUS_LABELS[status] ?? status}».`);
      if (status === "completed") setCompletionTask(null);
      void load();
    } catch {
      setActionError("No se pudo actualizar la tarea por un error de red.");
    } finally {
      setPendingTaskId(null);
    }
  }

  async function submitComment(
    event: FormEvent<HTMLFormElement>,
    organizationId: string,
    taskId: string,
  ) {
    event.preventDefault();
    const body = commentDrafts[taskId]?.trim();
    if (!body) return;
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body,
            isInternal: Boolean(commentInternalDrafts[taskId]),
          }),
        },
      );
      if (!response.ok) {
        setActionError(await readApiError(response));
        return;
      }
      setCommentDrafts((drafts) => ({ ...drafts, [taskId]: "" }));
      setCommentInternalDrafts((drafts) => ({ ...drafts, [taskId]: false }));
      toast.success("Comentario añadido.");
      void load();
    } catch {
      setActionError("No se pudo añadir el comentario por un error de red.");
    }
  }

  async function changeAlertStatus(
    organizationId: string,
    alertId: string,
    status: string,
  ) {
    setPendingAlertId(alertId);
    setActionError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/alerts/${alertId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        setActionError(await readApiError(response));
        return;
      }
      toast.success("Estado de la alerta actualizado.");
      void load();
    } catch {
      setActionError("No se pudo actualizar la alerta por un error de red.");
    } finally {
      setPendingAlertId(null);
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTasks = (data?.tasks ?? []).filter((task) => {
    if (clientFilter !== "all" && task.organization_id !== clientFilter)
      return false;
    if (categoryFilter !== "all" && !task.categories.includes(categoryFilter))
      return false;
    if (
      statusFilter === "open" &&
      !["proposed", "pending", "in_progress"].includes(task.status)
    )
      return false;
    if (
      statusFilter !== "open" &&
      statusFilter !== "all" &&
      task.status !== statusFilter
    )
      return false;
    if (
      normalizedQuery &&
      !task.title.toLowerCase().includes(normalizedQuery) &&
      !(task.description ?? "").toLowerCase().includes(normalizedQuery)
    )
      return false;
    return true;
  });

  const sortedTasks = filteredTasks.slice().sort((a, b) => {
    const overdueDelta = Number(isTaskOverdue(b)) - Number(isTaskOverdue(a));
    if (overdueDelta !== 0) return overdueDelta;
    const priorityDelta =
      (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    if (a.due_at && b.due_at)
      return Date.parse(a.due_at) - Date.parse(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  const tasksPage = usePaginatedUrl(sortedTasks, TASKS_PAGE_SIZE);

  const activeAlerts = (data?.alerts ?? []).filter((alert) => {
    if (!["open", "acknowledged"].includes(alert.status)) return false;
    if (clientFilter !== "all" && alert.organization_id !== clientFilter)
      return false;
    // El buscador esta encima de las dos pestanas: si no filtrara alertas,
    // escribir en el con la pestana de alertas abierta no haria nada.
    if (
      normalizedQuery &&
      !alert.title.toLowerCase().includes(normalizedQuery) &&
      !alert.message.toLowerCase().includes(normalizedQuery)
    )
      return false;
    return true;
  });

  const detailTask = detailTaskId
    ? (filteredTasks.find((task) => task.id === detailTaskId) ?? null)
    : null;

  const clientOptions = [
    { value: "all", label: "Todos los clientes" },
    ...(data?.organizations ?? []).map((organization) => ({
      value: organization.id,
      label: organization.display_name,
    })),
  ];

  const clientSummaries = buildClientSummaries(data);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando tareas de la cartera..." />
      </div>
    );
  }

  // Estado de la cartera entera, no del filtro: el consultor abre esta
  // pantalla para decidir a quien llama hoy. Las mismas cifras viajan al
  // Consultor IA como "vista actual" (ModuleSummary publica lo que pinta).
  const allTasks = data?.tasks ?? [];
  const portfolioOpen = allTasks.filter((task) =>
    ["pending", "in_progress"].includes(task.status),
  );
  const portfolioOverdue = allTasks.filter(isTaskOverdue).length;
  const clientsBehind = clientSummaries.filter(
    (summary) => summary.overdue > 0,
  ).length;
  const criticalAlerts = (data?.alerts ?? []).filter(
    (alert) =>
      ["open", "acknowledged"].includes(alert.status) &&
      ["critical", "high"].includes(alert.severity),
  ).length;
  const proposedTotal = [...pendingByOrg.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const stalestOpenDays =
    daysSince(oldest(portfolioOpen.map((task) => task.created_at))) ?? 0;

  return (
    <div className="portal-page space-y-5">
      <WorkPageHeader title="Tareas">Revisa lo pendiente, decide qué hacer primero y sigue el avance de tu tienda.</WorkPageHeader>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <p className="text-sm text-muted">
        Tareas y alertas de toda la cartera ({clientSummaries.length}{" "}
        {clientSummaries.length === 1 ? "cliente" : "clientes"}).
      </p>

      <ModuleSummary
        metrics={[
          {
            label: "Clientes con retraso",
            value: clientsBehind.toLocaleString("es-ES"),
            tone: clientsBehind > 0 ? "danger" : "success",
            hint: `de ${clientSummaries.length}`,
          },
          {
            label: "Tareas abiertas",
            value: portfolioOpen.length.toLocaleString("es-ES"),
          },
          {
            label: "Vencidas",
            value: portfolioOverdue.toLocaleString("es-ES"),
            tone: portfolioOverdue > 0 ? "danger" : "success",
          },
          {
            label: "Alertas activas",
            value: (data?.alerts ?? [])
              .filter((alert) =>
                ["open", "acknowledged"].includes(alert.status),
              )
              .length.toLocaleString("es-ES"),
            tone: criticalAlerts > 0 ? "danger" : "default",
            hint:
              criticalAlerts > 0
                ? `${criticalAlerts} de severidad alta o crítica`
                : undefined,
          },
          {
            label: "Más antigua abierta",
            value: portfolioOpen.length ? `${stalestOpenDays} d` : "—",
            tone: stalestOpenDays >= 30 ? "warn" : "default",
          },
          {
            label: "Propuestas de la IA",
            value: proposedTotal.toLocaleString("es-ES"),
            tone: proposedTotal > 0 ? "warn" : "default",
            hint: proposedTotal > 0 ? "Esperando decisión" : undefined,
          },
        ]}
      />

      <ClientSummaryGrid
        summaries={clientSummaries}
        activeClientId={clientFilter}
        onSelectClient={setClientFilter}
        proposedByOrg={pendingByOrg}
      />

      <TabBar
        tabs={[
          { value: "tasks", label: "Tareas", count: filteredTasks.length },
          { value: "alerts", label: "Alertas", count: activeAlerts.length },
        ]}
        value={tab}
        onChange={(value) => setTab(value as "tasks" | "alerts")}
      />

      <TaskFilters
        query={searchQuery}
        onQueryChange={setSearchQuery}
        clientOptions={clientOptions}
        client={clientFilter}
        onClientChange={setClientFilter}
        {...(tab === "tasks"
          ? {
              status: statusFilter,
              onStatusChange: setStatusFilter,
              category: categoryFilter,
              onCategoryChange: setCategoryFilter,
            }
          : {})}
      />

      {tab === "tasks" ? (
        <Card>
          {sortedTasks.length === 0 && pendingByOrg.size === 0 ? (
            <EmptyState
              title="Sin tareas para este filtro"
              hint="Prueba otro filtro o abre un cliente para crear una."
            />
          ) : (
            <>
              <List>
                {/* Propuestas de la IA en la misma lista, arriba y con badge
                    "IA": el consultor decide sin cambiar de pantalla. */}
                <ProposedTasksList
                  clients={proposedClients}
                  activeClientId={clientFilter}
                  onApproved={() => {
                    void reloadProposed();
                    void load();
                  }}
                />
                {/* Paginada como la vista de tienda: la cartera entera podia
                    pintar cientos de filas de golpe. */}
                {tasksPage.pageItems.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showVisibility={isConsultant}
                    clientName={task.organization_name}
                    isPending={pendingTaskId === task.id}
                    onStatusChange={
                      ownOrganizationIds.has(task.organization_id)
                        ? (status) =>
                            void changeTaskStatus(
                              task.organization_id,
                              task.id,
                              status,
                            )
                        : undefined
                    }
                    onOpenDetail={() => setDetailTaskId(task.id)}
                  />
                ))}
              </List>
              <Pagination
                className="mt-3"
                page={tasksPage.page}
                pageCount={tasksPage.pageCount}
                onChange={tasksPage.setPage}
              />
            </>
          )}
        </Card>
      ) : (
        <Card>
          {activeAlerts.length === 0 ? (
            <EmptyState
              title="Sin alertas activas en la cartera"
              hint="Las alertas se generan al evaluar las reglas de cada cliente."
            />
          ) : (
            <List>
              {activeAlerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  clientName={alert.organization_name}
                  isPending={pendingAlertId === alert.id}
                  onStatusChange={(status) =>
                    void changeAlertStatus(
                      alert.organization_id,
                      alert.id,
                      status,
                    )
                  }
                />
              ))}
            </List>
          )}
        </Card>
      )}

      {completionTask ? (
        <TaskOutcomeDialog
          taskTitle={completionTask.title}
          mode={completionTask.mode}
          isPending={pendingTaskId === completionTask.taskId}
          onClose={() => setCompletionTask(null)}
          onConfirm={(outcome) => void changeTaskStatus(completionTask.organizationId, completionTask.taskId, "completed", outcome)}
          onCompleteWithoutMetric={() => void changeTaskStatus(completionTask.organizationId, completionTask.taskId, "completed", null)}
        />
      ) : null}

      {detailTask ? (
        <TaskDetailDialog
          task={detailTask}
          eyebrow={detailTask.organization_name}
          onClose={() => setDetailTaskId(null)}
        >
                  <TaskDetail
                    task={detailTask}
                    showVisibility={isConsultant}
                    canMarkInternal={isConsultant}
                    isInternalDraft={Boolean(
                      commentInternalDrafts[detailTask.id],
                    )}
                    onInternalChange={(value) =>
                      setCommentInternalDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    commentDraft={commentDrafts[detailTask.id] ?? ""}
                    onCommentChange={(value) =>
                      setCommentDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    onSubmitComment={(event) =>
                      submitComment(
                        event,
                        detailTask.organization_id,
                        detailTask.id,
                      )
                    }
                    onStatusChange={
                      ownOrganizationIds.has(detailTask.organization_id)
                        ? (status) =>
                            void changeTaskStatus(
                              detailTask.organization_id,
                              detailTask.id,
                              status,
                            )
                        : undefined
                    }
                  />
        </TaskDetailDialog>
      ) : null}
    </div>
  );
}

function OperationsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const activeMembership =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    ) ??
    bootstrap.memberships[0] ??
    null;
  const organization = activeMembership?.organization ?? null;
  // El consultor propone tareas para un cliente asignado y las comenta, pero
  // no las resuelve por el (completar/ignorar/cambiar estado): eso es lo que
  // decide el cliente. El backend ya lo exige (updateTaskStatus); esto evita
  // enseñar un boton que devolveria 403.
  const canResolveTasks = activeMembership?.accessSource !== "consultant_assignment";
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const canViewMarketingDrafts =
    isConsultant || ["owner", "manager"].includes(activeMembership?.role ?? "");
  const marketingDraftsQuery = useMarketingDrafts(organization?.id ?? "", canViewMarketingDrafts);
  const marketingAssets: CaminoMarketingAsset[] = [];
  for (const draft of marketingDraftsQuery.drafts) {
    const asset = marketingDraftAsCaminoAsset(draft, connectionId);
    if (asset) marketingAssets.push(asset);
  }
  const marketingAssetByTask = latestMarketingAssetByTask(marketingAssets);
  // Un cliente sin consultor se apoya en los agentes: son su única fuente de
  // trabajo propuesto. Con consultor, es el consultor quien decide qué entra.
  const { isAutonomous } = useAssignedConsultant(
    isConsultant ? null : (organization?.id ?? null),
  );

  const operationsQuery = useCachedQuery<OperationsResponse>(
    organization ? `/v1/organizations/${organization.id}/operations` : null,
  );
  const payload = operationsQuery.data ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const error =
    actionError ??
    (operationsQuery.error
      ? "No se pudieron cargar las operaciones. Revisa la conexión e inténtalo de nuevo."
      : null);
  const setError = setActionError;
  const isLoading = organization !== null && operationsQuery.isLoading;
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  // FE-03: sin buscador, encontrar una tarea concreta entre muchas exigia
  // escanear la lista/tarjetas a ojo -- filtro por titulo o descripcion.
  const [searchQuery, setSearchQuery] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [commentInternalDrafts, setCommentInternalDrafts] = useState<
    Record<string, boolean>
  >({});
  const [tab, setTab] = useState<"tasks" | "alerts">("tasks");
  const [discussTask, setDiscussTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  // Enlaces desde una notificacion: ?task= abre esa tarea y ?alert= deja a la
  // vista solo esa alerta. Sin esto se aterrizaba en la lista entera.
  const searchParams = useSearchParams();
  const linkedTaskId = searchParams.get("task");
  const linkedAlertId = searchParams.get("alert");
  const focusIds = new Set((searchParams.get("focus") ?? "").split(",").filter(Boolean));
  const [focusAlertId, setFocusAlertId] = useState<string | null>(null);
  useEffect(() => {
    if (linkedTaskId) {
      setTab("tasks");
      setDetailTaskId(linkedTaskId);
    }
  }, [linkedTaskId]);
  useEffect(() => {
    if (linkedAlertId) {
      setTab("alerts");
      setFocusAlertId(linkedAlertId);
    }
  }, [linkedAlertId]);
  const [completionTask, setCompletionTask] = useState<{ taskId: string; title: string; mode: "complete" | "record" } | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  // Fases/hitos del plan para asociar la tarea nueva; se carga solo al abrir el
  // formulario (no todo el mundo tiene plan y no hace falta en cada carga).
  const [milestoneOptions, setMilestoneOptions] = useState<
    { value: string; label: string }[]
  >([]);
  // Fila con una accion en vuelo: desactiva sus botones y muestra "..." para
  // que se vea que la accion se registro (antes no habia ninguna senal hasta
  // que recargaba la lista entera).
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [generatingMarketingTaskId, setGeneratingMarketingTaskId] = useState<string | null>(null);
  const { clients: proposedClients, reload: reloadProposed } = useProposedTasks(
    { enabled: isConsultant },
  );
  // Si hay propuestas, la lista no esta vacia aunque el backlog si lo este.
  const hasProposals = (proposedClients ?? []).some(
    (client) =>
      client.organization_id === organization?.id &&
      client.tasks.some((task) => task.pending_approval),
  );

  const loadOperations = useCallback(() => {
    setActionError(null);
    operationsQuery.reload();
  }, [operationsQuery.reload]);

  async function generateMarketingForTask(task: Task) {
    if (!taskCanGenerateMarketing(task) || !canViewMarketingDrafts) return;
    if (!organization || !connectionId) {
      toast.info("Selecciona la tienda de esta tarea antes de generar el borrador.");
      return;
    }
    const existingAsset = marketingAssetByTask.get(task.id);
    if (existingAsset) {
      window.location.assign(marketingAssetHref(existingAsset.id));
      return;
    }
    setGeneratingMarketingTaskId(task.id);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/marketing/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_type: "campaign",
            channel: "email_klaviyo",
            store_id: connectionId,
            camino_task_id: task.id,
            idempotency_key: `${task.id}:99`,
            brief: `Prepara un borrador de email para esta tarea de Mi Camino: "${task.title}". Usa la descripcion y el hito verificados como contexto. Si faltan oferta, descuento, audiencia o condiciones, no los inventes: indica que debe confirmar el equipo. Deja el contenido en borrador para revision humana; no lo envies ni lo programes.`,
          }),
        },
        180_000,
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const body = (await response.json()) as { draft?: { id?: string } };
      if (!body.draft?.id) {
        toast.danger("El agente respondiÃ³ sin devolver un borrador de Marketing.");
        return;
      }
      window.location.assign(marketingAssetHref(body.draft.id));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo activar el agente de email.");
    } finally {
      setGeneratingMarketingTaskId(null);
    }
  }

  const milestonePlanQuery = useCachedQuery<{
    plan?: {
      strategic_plan_phases?: Array<{
        name: string;
        position: number;
        strategic_plan_milestones?: Array<{
          id: string;
          name: string;
          position: number;
        }>;
      }>;
    };
  }>(
    isCreatingTask && organization
      ? `/v1/organizations/${organization.id}/strategic-plan`
      : null,
  );

  useEffect(() => {
    const phases = milestonePlanQuery.data?.plan?.strategic_plan_phases ?? [];
    setMilestoneOptions(
      phases
        .slice()
        .sort((a, b) => a.position - b.position)
        .flatMap((phase) =>
          (phase.strategic_plan_milestones ?? [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((milestone) => ({
              value: milestone.id,
              label: `${phase.name} · ${milestone.name}`,
            })),
        ),
    );
  }, [milestonePlanQuery.data]);

  async function evaluateRules() {
    if (!organization) {
      return;
    }

    setIsEvaluating(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/operations/run-rules`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      void loadOperations();
    } catch {
      setError(
        "No se pudieron evaluar las reglas por un error de red. Reintenta.",
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  async function changeTaskStatus(taskId: string, status: string, outcome?: TaskOutcomeInput | null) {
    if (!organization) {
      return;
    }
    if ((status === "completed" && outcome === undefined) || status === "record_outcome") {
      const task = payload?.tasks.find((item) => item.id === taskId);
      setDetailTaskId(null);
      setCompletionTask({ taskId, title: task?.title ?? "Tarea", mode: status === "record_outcome" || task?.status === "completed" ? "record" : "complete" });
      return;
    }

    setError(null);
    setPendingTaskId(taskId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/tasks/${taskId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, ...(outcome ? { outcome } : {}) }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      toast.success(status === "completed" && outcome
        ? "Tarea completada y resultado medido guardado."
        : `Tarea marcada como «${STATUS_LABELS[status] ?? status}».`);
      if (status === "completed") setCompletionTask(null);
      void loadOperations();
    } catch {
      setError(
        "No se pudo actualizar la tarea por un error de red. Reintenta.",
      );
    } finally {
      setPendingTaskId(null);
    }
  }

  async function submitComment(
    event: FormEvent<HTMLFormElement>,
    taskId: string,
  ) {
    event.preventDefault();

    if (!organization) {
      return;
    }

    const body = commentDrafts[taskId]?.trim();

    if (!body) {
      return;
    }

    const isInternal = Boolean(commentInternalDrafts[taskId]);

    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, isInternal }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setCommentDrafts((drafts) => ({ ...drafts, [taskId]: "" }));
      setCommentInternalDrafts((drafts) => ({ ...drafts, [taskId]: false }));
      toast.success("Comentario añadido.");
      void loadOperations();
    } catch {
      setError(
        "No se pudo añadir el comentario por un error de red. Reintenta.",
      );
    }
  }

  async function createTaskManual(input: {
    title: string;
    description: string;
    priority: string;
    category: string;
    dueAt: string;
    isVisibleToClient: boolean;
    milestoneId: string;
    connectionId?: string;
  }) {
    if (!organization) {
      return false;
    }

    setIsSubmittingTask(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: input.title,
            description: input.description || null,
            priority: input.priority,
            category: input.category,
            dueAt: input.dueAt || null,
            isVisibleToClient: input.isVisibleToClient,
            milestoneId: input.milestoneId || null,
            connectionId: input.connectionId || null,
          }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return false;
      }

      toast.success("Tarea creada.");
      void loadOperations();
      return true;
    } catch {
      setError("No se pudo crear la tarea por un error de red. Reintenta.");
      return false;
    } finally {
      setIsSubmittingTask(false);
    }
  }

  async function changeAlertStatus(alertId: string, status: string) {
    if (!organization) {
      return;
    }

    setError(null);
    setPendingAlertId(alertId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/alerts/${alertId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      toast.success("Estado de la alerta actualizado.");
      void loadOperations();
    } catch {
      setError(
        "No se pudo actualizar la alerta por un error de red. Reintenta.",
      );
    } finally {
      setPendingAlertId(null);
    }
  }

  const activeAlerts = (payload?.alerts ?? []).filter((alert) =>
    ["open", "acknowledged"].includes(alert.status),
  );
  const resolvedAlerts = (payload?.alerts ?? []).filter(
    (alert) => !["open", "acknowledged"].includes(alert.status),
  );

  const normalizedTaskQuery = searchQuery.trim().toLowerCase();

  // Lo que el cliente ha quitado de en medio: aparte de la lista, con acción rápida para recuperarlo.
  const discardedTasks = (payload?.tasks ?? [])
    .filter((task) => ["ignored", "cancelled"].includes(task.status))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

  const filteredTasks = (payload?.tasks ?? []).filter((task) => {
    if (categoryFilter !== "all" && !task.categories.includes(categoryFilter)) {
      return false;
    }
    if (
      statusFilter === "open" &&
      !["proposed", "pending", "in_progress"].includes(task.status)
    ) {
      return false;
    }
    if (
      statusFilter !== "open" &&
      statusFilter !== "all" &&
      task.status !== statusFilter
    ) {
      return false;
    }
    if (
      normalizedTaskQuery &&
      !task.title.toLowerCase().includes(normalizedTaskQuery) &&
      !(task.description ?? "").toLowerCase().includes(normalizedTaskQuery)
    ) {
      return false;
    }
    return true;
  });

  // Antes el orden era el que devolviera la API (created_at desc) sin
  // importar prioridad ni vencimiento -- una tarea urgente podia quedar
  // enterrada en la pagina 3. Vencidas primero, luego por prioridad, luego la
  // que vence antes; a igualdad, la mas reciente arriba (orden original).
  // Antes que todo, las que señala un aviso (?focus=): si no, podían quedar en
  // otra página y el resaltado no las encontraba.
  const sortedTasks = filteredTasks.slice().sort((a, b) => {
    const focusDelta = Number(focusIds.has(b.id)) - Number(focusIds.has(a.id));
    if (focusDelta !== 0) return focusDelta;
    const overdueDelta = Number(isTaskOverdue(b)) - Number(isTaskOverdue(a));
    if (overdueDelta !== 0) return overdueDelta;

    const priorityDelta =
      (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
    if (priorityDelta !== 0) return priorityDelta;

    if (a.due_at && b.due_at) {
      return Date.parse(a.due_at) - Date.parse(b.due_at);
    }
    if (a.due_at) return -1;
    if (b.due_at) return 1;

    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  const tasksPage = usePaginatedUrl(sortedTasks, TASKS_PAGE_SIZE);
  // Lo primero de la lista ya ordenada (vencidas > prioridad > fecha), solo abiertas.
  const nextTask =
    sortedTasks.find((task) => ["pending", "in_progress"].includes(task.status)) ??
    null;

  // Busca en todas, no solo en las filtradas: una tarea enlazada desde una
  // notificacion puede estar ya completada o descartada.
  const detailTask = detailTaskId
    ? ((payload?.tasks ?? []).find((task) => task.id === detailTaskId) ?? null)
    : null;
  const shownAlerts = focusAlertId
    ? (payload?.alerts ?? []).filter((alert) => alert.id === focusAlertId)
    : activeAlerts;

  // Estado real del backlog de este cliente. Antes había que contar a ojo
  // entre pestañas y filtros para responder "¿voy tarde con este cliente?".
  const allTasks = payload?.tasks ?? [];
  const openTasks = allTasks.filter((task) =>
    ["pending", "in_progress"].includes(task.status),
  );
  const overdueTasks = allTasks.filter(isTaskOverdue);
  const criticalAlerts = activeAlerts.filter((alert) =>
    ["critical", "high"].includes(alert.severity),
  );
  // Cuánto lleva esperando lo más viejo que sigue abierto: la señal de si el
  // backlog está vivo o es un cementerio.
  const oldestOpenDays =
    daysSince(oldest(openTasks.map((task) => task.created_at))) ?? 0;
  const completedLast30 = allTasks.filter(
    (task) =>
      task.status === "completed" && isWithinLastDays(task.updated_at, 30),
  ).length;

  return (
    <div className="portal-page space-y-5">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <WorkPageHeader title="Tareas">Revisa lo pendiente, decide qué hacer primero y sigue el avance de tu tienda.</WorkPageHeader>
      {nextTask ? (
        <HeroBlock
          label={isTaskOverdue(nextTask) ? "Lo siguiente · va tarde" : "Lo siguiente"}
          title={nextTask.title}
          actions={
            <>
              {canResolveTasks ? (
                <button
                  type="button"
                  className={heroPrimary}
                  disabled={pendingTaskId === nextTask.id}
                  onClick={() => void changeTaskStatus(nextTask.id, "completed")}
                >
                  Completar
                </button>
              ) : null}
              <button type="button" onClick={() => setDetailTaskId(nextTask.id)}>
                Detalle
              </button>
              <button type="button" onClick={() => setDiscussTask(nextTask)}>
                Escribir sobre esto
              </button>
            </>
          }
        >
          {[dueSignal(nextTask).text, milestoneLabel(nextTask) ? `Hito · ${milestoneLabel(nextTask)}` : null]
            .filter(Boolean)
            .join(" · ")}
        </HeroBlock>
      ) : payload && openTasks.length === 0 && !hasProposals ? (
        <HeroBlock
          label="Al día"
          title="No tienes tareas abiertas"
          actions={
            <button
              type="button"
              className={heroPrimary}
              onClick={() => {
                setTab("tasks");
                setIsCreatingTask(true);
              }}
            >
              Nueva tarea
            </button>
          }
        >
          {completedLast30 > 0
            ? `${completedLast30} cerrada${completedLast30 === 1 ? "" : "s"} en los últimos 30 días.`
            : "Cuando haya algo que hacer, aparecerá aquí lo siguiente."}
        </HeroBlock>
      ) : null}

      {payload ? (
        <ModuleSummary
          metrics={[
            {
              label: "Tareas abiertas",
              value: openTasks.length.toLocaleString("es-ES"),
            },
            {
              label: "Vencidas",
              value: overdueTasks.length.toLocaleString("es-ES"),
              tone: overdueTasks.length > 0 ? "danger" : "success",
            },
            {
              label: "Alertas activas",
              value: activeAlerts.length.toLocaleString("es-ES"),
              tone: criticalAlerts.length > 0 ? "danger" : "default",
              hint:
                criticalAlerts.length > 0
                  ? `${criticalAlerts.length} de severidad alta o crítica`
                  : undefined,
            },
            {
              label: "Más antigua abierta",
              value: openTasks.length ? `${oldestOpenDays} d` : "—",
              tone: oldestOpenDays >= 30 ? "warn" : "default",
            },
            {
              label: "Cerradas · 30 días",
              value: completedLast30.toLocaleString("es-ES"),
              hint: "Ritmo de ejecución",
            },
          ]}
          notes={
            hasProposals
              ? "Hay propuestas de la IA pendientes de aprobar en este cliente."
              : undefined
          }
        />
      ) : null}

      {/* Un cliente sin consultor no tenía quien le llenara esta página: el
          consultor no está, y las propuestas de la IA estaban gateadas a
          `enabled: isConsultant`. Se quedaba con una lista vacía que rellenar a
          mano. El agente ya se ejecuta dos veces al día para su organización;
          aquí es donde sus propuestas se convierten en tareas. */}
      {!isConsultant && isAutonomous && organization ? (
        <AiDiagnosticSection
          organizationId={organization.id}
          title="Qué hacer esta semana"
          getPath="/ai/task-planner"
          runPath="/ai/task-planner-run"
          loadingLabel="Buscando el siguiente paso para tu tienda…"
          tasksLabelSingular="acción"
          variant="tasks"
          days={30}
        />
      ) : null}

      <TabBar
        tabs={[
          { value: "tasks", label: "Tareas", count: filteredTasks.length },
          { value: "alerts", label: "Alertas", count: activeAlerts.length },
        ]}
        value={tab}
        onChange={(value) => setTab(value as "tasks" | "alerts")}
      />

      {isLoading ? (
        <LoadingBlock label="Cargando tareas y alertas..." />
      ) : tab === "tasks" ? (
        <div className="space-y-4">
          <TaskFilters
            query={searchQuery}
            onQueryChange={setSearchQuery}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            category={categoryFilter}
            onCategoryChange={setCategoryFilter}
            actions={
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreatingTask((value) => !value)}
              >
                {isCreatingTask ? "Cerrar" : "Nueva tarea"}
              </Button>
            }
          />

          {isCreatingTask ? (
            <NewTaskForm
              canMarkInternal={isConsultant}
              isSubmitting={isSubmittingTask}
              milestones={milestoneOptions}
              onCancel={() => setIsCreatingTask(false)}
              onSubmit={async (payload) => {
                const created = await createTaskManual(payload);
                if (created) setIsCreatingTask(false);
                return created;
              }}
            />
          ) : null}

          <Card>
            {filteredTasks.length === 0 && !hasProposals ? (
              <EmptyState
                title="Sin tareas para este filtro"
                hint="Prueba otro filtro, o crea una con «Nueva tarea»."
              />
            ) : (
              <>
                <List>
                  {/* Las propuestas de la IA van en la MISMA lista que el
                      backlog, arriba y marcadas con un badge "IA": es trabajo
                      esperando decision, y el consultor lo lee sin cambiar de
                      sitio. Solo consultor: el cliente no aprueba salidas IA. */}
                  {isConsultant && organization ? (
                    <ProposedTasksList
                      clients={proposedClients}
                      activeClientId={organization.id}
                      onApproved={() => {
                        void reloadProposed();
                        void loadOperations();
                      }}
                    />
                  ) : null}
                  {tasksPage.pageItems.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      showVisibility={isConsultant}
                      viewerUserId={bootstrap.profile.id}
                      isPending={pendingTaskId === task.id}
                      onStatusChange={
                        canResolveTasks
                          ? (status) => void changeTaskStatus(task.id, status)
                          : undefined
                      }
                      onOpenDetail={() => setDetailTaskId(task.id)}
                      linkedMarketingAsset={marketingAssetByTask.get(task.id) ?? null}
                    />
                  ))}
                </List>
                <Pagination
                  className="mt-3"
                  page={tasksPage.page}
                  pageCount={tasksPage.pageCount}
                  onChange={tasksPage.setPage}
                />
              </>
            )}
          </Card>

          {isConsultant && discardedTasks.length > 0 ? (
            <CollapsibleSection title={`Descartadas y archivadas por el cliente · ${discardedTasks.length}`}>
              <List>
                {discardedTasks.map((task) => (
                  <List.Item key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {STATUS_LABELS[task.status] ?? task.status} · {new Date(task.updated_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingTaskId === task.id}
                      onClick={() => void changeTaskStatus(task.id, "pending")}
                    >
                      {pendingTaskId === task.id ? "..." : "Recuperar"}
                    </Button>
                  </List.Item>
                ))}
              </List>
            </CollapsibleSection>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {activeAlerts.length} activa{activeAlerts.length === 1 ? "" : "s"}
              {resolvedAlerts.length > 0
                ? ` · ${resolvedAlerts.length} resuelta${
                    resolvedAlerts.length === 1 ? "" : "s"
                  }`
                : ""}
            </p>
            <Button
              type="button"
              onClick={() => void evaluateRules()}
              disabled={isEvaluating}
            >
              {isEvaluating ? "Evaluando..." : "Evaluar reglas ahora"}
            </Button>
          </div>

          {focusAlertId ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                La alerta de tu notificación
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFocusAlertId(null)}
              >
                Ver todas las alertas
              </Button>
            </div>
          ) : null}

          <Card>
            {shownAlerts.length === 0 ? (
              focusAlertId ? (
                <EmptyState
                  title="Esta alerta ya no está disponible"
                  hint="Puede que se haya resuelto y archivado. Revisa el resto de alertas."
                />
              ) : (
                <EmptyState
                  title="Sin alertas activas"
                  hint="Pulsa «Evaluar reglas ahora» para comprobar los datos actuales."
                />
              )
            ) : (
              <List>
                {shownAlerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    isPending={pendingAlertId === alert.id}
                    onStatusChange={(status) =>
                      void changeAlertStatus(alert.id, status)
                    }
                    onCreateTask={() =>
                      void createTaskManual({
                        title: alert.title,
                        description: alert.message,
                        priority: ["critical", "high"].includes(alert.severity) ? "high" : "medium",
                        category: "general",
                        dueAt: "",
                        isVisibleToClient: true,
                        milestoneId: "",
                      })
                    }
                  />
                ))}
              </List>
            )}
          </Card>

          {resolvedAlerts.length > 0 ? (
            <CollapsibleSection title={`Resueltas recientes · ${resolvedAlerts.length}`}>
              <List>
                {resolvedAlerts.slice(0, 20).map((alert) => (
                  <List.Item key={alert.id} className="py-2.5">
                    <p className="text-sm text-foreground">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {displayValue(alert.status)}
                      {alert.resolved_at
                        ? ` · ${new Date(alert.resolved_at).toLocaleDateString("es-ES")}`
                        : ""}
                    </p>
                  </List.Item>
                ))}
              </List>
            </CollapsibleSection>
          ) : null}
        </div>
      )}

      <DiscussModal
        organizationId={organization?.id ?? null}
        title={discussTask?.title ?? null}
        draft={
          discussTask
            ? `Hola, te escribo sobre la tarea «${discussTask.title}»${discussTask.due_at ? ` (${dueSignal(discussTask).text.toLowerCase()})` : ""}. `
            : ""
        }
        viewerIsClient={!isConsultant}
        onClose={() => setDiscussTask(null)}
      />

      {completionTask ? (
        <TaskOutcomeDialog
          taskTitle={completionTask.title}
          mode={completionTask.mode}
          isPending={pendingTaskId === completionTask.taskId}
          onClose={() => setCompletionTask(null)}
          onConfirm={(outcome) => void changeTaskStatus(completionTask.taskId, "completed", outcome)}
          onCompleteWithoutMetric={() => void changeTaskStatus(completionTask.taskId, "completed", null)}
        />
      ) : null}

      {detailTask ? (
        <TaskDetailDialog
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onDiscuss={() => {
            setDetailTaskId(null);
            setDiscussTask(detailTask);
          }}
        >
                  <TaskDetail
                    task={detailTask}
                    showVisibility={isConsultant}
                    viewerUserId={bootstrap.profile.id}
                    canMarkInternal={isConsultant}
                    isInternalDraft={Boolean(
                      commentInternalDrafts[detailTask.id],
                    )}
                    onInternalChange={(value) =>
                      setCommentInternalDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    commentDraft={commentDrafts[detailTask.id] ?? ""}
                    onCommentChange={(value) =>
                      setCommentDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    onSubmitComment={(event) =>
                      submitComment(event, detailTask.id)
                    }
                    onStatusChange={
                      canResolveTasks
                        ? (status) => void changeTaskStatus(detailTask.id, status)
                        : undefined
                    }
                    linkedMarketingAsset={marketingAssetByTask.get(detailTask.id) ?? null}
                    onOpenMarketingAsset={(asset) => window.location.assign(marketingAssetHref(asset.id))}
                    onGenerateMarketing={
                      (isConsultant || ["owner", "manager"].includes(activeMembership?.role ?? "")) &&
                      taskCanGenerateMarketing(detailTask) &&
                      !marketingAssetByTask.has(detailTask.id)
                        ? () => void generateMarketingForTask(detailTask)
                        : undefined
                    }
                    isGeneratingMarketing={generatingMarketingTaskId === detailTask.id}
                  />
        </TaskDetailDialog>
      ) : null}
    </div>
  );
}

function TasksRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  // Consultor sin cliente activo -> tareas/alertas de toda la cartera. Si
  // solo tiene una tienda no hay cartera que ver: va directo a su dashboard
  // (OperationsContent ya cae al unico membership cuando organizationId es "").
  if (isConsultant && !organizationId && bootstrap.memberships.length > 1) {
    return (
      <ConsultantOperationsView isConsultant={isConsultant} bootstrap={bootstrap} />
    );
  }

  return <OperationsContent bootstrap={bootstrap} />;
}

export default function TasksPage() {
  return (
    <PortalShell title="Tareas y alertas">
      {(bootstrap) => <TasksRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
