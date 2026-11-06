"use client";
import { DatePicker, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown, ToggleGroup, ToggleGroupItem } from "@/components/ui";

import { buttonVariants } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { A01_CAMINO_BRIEF_KEY, parseA01BriefHandoff } from "@/lib/a01-call-handoff";
import { EvidenceChips } from "@/components/ai-proposed-tasks";
import { FileTextIcon, XIcon } from "lucide-react";
import { AiEvidence, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, Button, ButtonLink, ErrorBlock, Input, LoadingBlock, SearchableSelect, Select, Tabs, Textarea, toast } from "@/components/ui";
import { CaminoDraftMap, CaminoDrawing, type DraftPhase } from "./camino-map";
import { CaminoIntakeWizard, type CaminoIntake } from "./camino-intake-wizard";
import { calendarHorizonDays, calendarMonthsTouched } from "./camino-calendar";
import { MonthlyRoute } from "./monthly-route";
import { summarizeCaminoOperations } from "./camino-operating-summary";
import { countByTrack } from "./task-tracks";
import s from "./camino-create-panel.module.css";

/**
 * Crear un camino (cliente o consultor para su cliente). Tres formas de
 * empezar y las tres acaban igual: el mapa que verá el cliente, dibujado en
 * directo mientras se crea. El camino nace en borrador; activarlo es otro gesto.
 */

export type CaminoCreateMode = "ia" | "import" | "manual";

type CatalogEntry = { key: string; label: string; unit: "money" | "pct" | "count" | "ratio" | "number"; source?: "shopify" | "meta" | "manual" };

// Las métricas del catálogo, agrupadas por la fuente que las mide.
const METRIC_SOURCE_LABEL: Record<string, string> = { shopify: "Shopify", meta: "Meta Ads", klaviyo: "Klaviyo", manual: "Manual" };
export function metricOptions(catalog: Array<{ key: string; label: string; source?: string }>) {
  return catalog.map((entry) => ({
    value: entry.key,
    label: entry.label,
    section: entry.source ? (METRIC_SOURCE_LABEL[entry.source] ?? entry.source) : undefined,
  }));
}


export const CAMINO_CURRENCIES = ["EUR", "USD", "GBP", "MXN", "COP", "ARS", "CLP", "PEN", "CHF"] as const;

const MODES: Array<{ key: CaminoCreateMode; label: string }> = [
  { key: "ia", label: "Crear con IA" },
  { key: "manual", label: "Crear a mano" },
  { key: "import", label: "Usar plantilla" },
];

function formatAmount(value: number, unit: string, currency: string) {
  if (unit === "money") {
    try {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${value} ${currency}`;
    }
  }
  if (unit === "pct") return `${value} %`;
  if (unit === "ratio") return `${value}×`;
  return new Intl.NumberFormat("es-ES").format(value);
}

function isoInDays(days: number, from = Date.now()) {
  return new Date(from + days * 86_400_000).toISOString().slice(0, 10);
}

function displayOffsetDate(days: number, from = Date.now()) {
  const date = new Date(`${isoInDays(days, from)}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date);
}

function displayFullDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}

const TASK_PRIORITY_LABELS = { low: "baja", medium: "media", high: "alta", urgent: "urgente" } as const;

export function CaminoCreatePanel({
  variant,
  title,
  organizationId,
  connectionId,
  defaultCurrency,
  catalog,
  onCreated,
}: {
  variant: "client" | "consultant";
  title: string;
  organizationId: string;
  connectionId?: string | null;
  defaultCurrency: string;
  catalog: CatalogEntry[];
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<CaminoCreateMode>(variant === "client" ? "ia" : "manual");
  const [currency, setCurrency] = useState(
    (CAMINO_CURRENCIES as readonly string[]).includes(defaultCurrency) ? defaultCurrency : "EUR",
  );

  return (
    <section className={`${s.root} ${variant === "consultant" ? s.consultant : ""}`} aria-labelledby="camino-create-title">
      <div className={s.head}>
        <div className={s.headText}>
          <h2 id="camino-create-title" className={s.title}>
            {title}
          </h2>
        </div>
        <label className={s.currency}>
          <span>Moneda del camino</span>
          <Select value={currency} onChange={setCurrency} aria-label="Moneda del camino" options={CAMINO_CURRENCIES.map((code) => ({ value: code, label: code }))} />
        </label>
        <ToggleGroup aria-label="Cómo crear el camino" className="col-span-full" value={mode} onValueChange={setMode}>
          {MODES.map((item) => (
            <ToggleGroupItem key={item.key} value={item.key}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className={s.body}>
        {mode === "ia" ? (
          <IaCreator organizationId={organizationId} connectionId={connectionId} currency={currency} onCreated={onCreated} variant={variant} />
        ) : mode === "import" ? (
          <ImportCreator organizationId={organizationId} connectionId={connectionId} currency={currency} onCreated={onCreated} variant={variant} />
        ) : (
          <ManualCreator organizationId={organizationId} connectionId={connectionId} currency={currency} catalog={catalog} onCreated={onCreated} variant={variant} />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// IA (agente A19)
// ---------------------------------------------------------------------------

type ProposalContent = {
  plan_name: string;
  horizon_months?: number;
  diagnosis: string;
  goal?: {
    metric_label: string;
    unit: "money" | "pct" | "count" | "ratio";
    currency_code: string | null;
    baseline: number | null;
    target: number | null;
    target_offset_days: number;
    rationale: string;
    assumptions: string[];
    monthly_targets?: Array<{ month: number; target_value: number | null; seasonal_baseline?: number | null; rationale: string }>;
    decision_gates?: Array<{ decision: string; proceed_when: string; hold_when: string; evidence_needed: string }>;
  };
  phases: Array<{
    name: string;
    description: string;
    rationale: string;
    evidence: Array<{ label: string; value: string; period: string | null; source: string }>;
    milestones: Array<{
      name: string;
      description: string;
      target_offset_days: number;
      success_metric: string;
      tasks?: Array<{ title: string; description: string; target_offset_days: number; priority: "low" | "medium" | "high" | "urgent"; owner?: "client" | "consultant" | "shared"; effort_hours?: number | null; track?: string; cadence?: string }>;
    }>;
  }>;
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

type ContextSource = { key: string; label: string; status: "ok" | "empty" | "unavailable" | "not_provided"; critical: boolean };
type Proposal = {
  output_id: string;
  status: string;
  generated_at?: string;
  expired?: boolean;
  horizon_months: number | null;
  content: ProposalContent | null;
  context_sources?: ContextSource[] | null;
};

export type RunProgress = {
  state: "idle" | "running" | "failed" | "done";
  started_at: number | null;
  steps: Array<{ step_type: string; summary?: string | null }>;
  tool_calls: number;
  failure: { error: string; message: string | null } | null;
  run_status?: string | null;
  model?: string | null;
  provider?: string | null;
};

export function caminoFailureMessage(failure: RunProgress["failure"]): string {
  const detail = failure?.message ?? failure?.error ?? "No se pudo generar el Camino. Vuelve a intentarlo.";
  if (failure?.error === "agent_output_schema_mismatch" || detail.includes("agent_output_schema_mismatch")) {
    return "La IA devolvió un Camino incompleto. Vuelve a trazarlo.";
  }
  if (detail.includes("provider_out_of_credit")) {
    return "La IA no está disponible ahora mismo: el proveedor no tiene crédito. Tu Camino no ha cambiado.";
  }
  return detail;
}

/** Qué está haciendo la IA ahora, según los pasos reales que ha registrado el servidor. */
export function progressStage(progress: RunProgress | null): string | undefined {
  if (!progress || progress.state !== "running") return undefined;
  const types = progress.steps.map((step) => step.step_type);
  if (types.includes("event_coverage") && !types.includes("task_detailing")) return "Añadiendo la preparación de las fechas clave que faltaban";
  const detailed = types.filter((type) => type === "task_detailing").length;
  if (detailed > 0) return `Estrategia lista. Redactando la guía paso a paso de cada hito · ${detailed} hechos`;
  if (types.includes("model_call")) return "Validando el camino que ha diseñado";
  if (types.includes("context_build")) {
    return progress.tool_calls > 0
      ? `Diseñando fases e hitos · ${progress.tool_calls} consultas hechas`
      : "Datos leídos. Diseñando fases e hitos";
  }
  return "Leyendo los datos de la tienda";
}

const SOURCE_STATUS_LABEL = { unavailable: "No disponible", not_provided: "Sin aportar", empty: "Sin datos", ok: "" };

/** Qué datos recibió la IA al diseñar el camino. Lo que falta se dice, no se esconde. */
function ContextUsed({ sources }: { sources: ContextSource[] }) {
  const used = sources.filter((source) => source.status === "ok");
  const others = sources.filter((source) => source.status !== "ok");
  const missingCritical = others.filter((source) => source.critical);
  return (
    <section className={s.contextBlock} aria-labelledby="camino-context-used">
      <div className={s.contextHeading}>
        <h4 id="camino-context-used">
          Datos usados ({used.length} de {sources.length})
        </h4>
      </div>
      <ul className={s.sources}>
        {used.map((source) => (
          <li key={source.key} className={s.source}>
            ✓ {source.label}
          </li>
        ))}
        {others.map((source) => (
          <li key={source.key} className={`${s.source} ${source.critical ? s.sourceMissing : s.sourceMuted}`}>
            {SOURCE_STATUS_LABEL[source.status]} · {source.label}
          </li>
        ))}
      </ul>
      {missingCritical.length ? (
        <p className={s.hintLine}>
          Faltan datos clave ({missingCritical.map((source) => source.label.toLowerCase()).join(", ")}): el camino se apoya en
          suposiciones en esa parte. Revisa la conexión de la tienda y traza otro cuando estén.
        </p>
      ) : null}
    </section>
  );
}

const CONFIDENCE = { low: "Confianza baja", medium: "Confianza media", high: "Confianza alta" };

function IaCreator({ organizationId, connectionId, currency, onCreated, variant }: {
  variant: "client" | "consultant";
  organizationId: string;
  connectionId?: string | null;
  currency: string;
  onCreated: () => void;
}) {
  const searchParams = useSearchParams();
  const fromCall = searchParams.get("fromCall") === "1";
  const [horizon, setHorizon] = useState(3);
  const [brief, setBrief] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [goalTarget, setGoalTarget] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showIntake, setShowIntake] = useState(true);
  const [diagnosisExpanded, setDiagnosisExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentActive, setAgentActive] = useState<boolean | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  // epoch ms del arranque del run en segundo plano; mientras exista se consulta el progreso.
  const [runSince, setRunSince] = useState<number | null>(null);
  const [tab, setTab] = useState("ruta");
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [openedAt] = useState(() => Date.now());
  const handoffDone = useRef(false);
  const horizonEdited = useRef(false);

  useEffect(() => {
    horizonEdited.current = false;
  }, [organizationId, connectionId]);

  useEffect(() => {
    if (!fromCall || handoffDone.current) return;
    handoffDone.current = true;
    const staged = parseA01BriefHandoff(window.sessionStorage.getItem(A01_CAMINO_BRIEF_KEY), organizationId);
    window.sessionStorage.removeItem(A01_CAMINO_BRIEF_KEY);
    if (staged) setBrief(staged);
  }, [fromCall, organizationId]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (connectionId) query.set("connectionId", connectionId);
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal?${query.toString()}`);
      if (!response.ok) {
        setError(await readApiError(response));
        return false;
      }
      const payload = (await response.json()) as { proposal: Proposal | null; agent_active?: boolean | null };
      setAgentActive(payload.agent_active ?? null);
      // Si se cerró la pestaña con un camino en marcha, se retoma el seguimiento.
      const progressQuery = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
      const progressResponse = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/progress${progressQuery}`).catch(() => null);
      let currentProgress: RunProgress | null = null;
      if (progressResponse?.ok) {
        currentProgress = (await progressResponse.json()) as RunProgress;
        if (currentProgress.state === "running" && currentProgress.started_at) {
          setProgress(currentProgress);
          setIsGenerating(true);
          setRunSince(currentProgress.started_at);
        } else if (currentProgress.state === "failed") {
          setProgress(currentProgress);
          setError(caminoFailureMessage(currentProgress.failure));
        }
      }
      // El rechazo vive en servidor: una propuesta rechazada ya no llega aquí.
      const visibleProposal = payload.proposal;
      setProposal(visibleProposal);
      if (!horizonEdited.current && visibleProposal?.horizon_months) setHorizon(visibleProposal.horizon_months);
      setShowIntake(!visibleProposal?.content);
      const target = visibleProposal?.content?.goal?.target;
      setGoalTarget(target == null ? "" : String(target));
      if (currentProgress?.state !== "failed") setError(null);
      return true;
    } catch {
      setError("No se pudo cargar la propuesta de camino. Reintenta.");
      return false;
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [organizationId, connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fullBrief = brief.trim();

  async function generate(intake: CaminoIntake) {
    setIsGenerating(true);
    setError(null);
    try {
      const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
      const contextResponse = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-context${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intake),
      });
      if (!contextResponse.ok) throw new Error(await readApiError(contextResponse));
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/run${query ? `${query}&async=1` : "?async=1"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon_months: horizon, ...(fullBrief ? { brief: fullBrief } : {}) }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const started = (await response.json()) as { started_at: number };
      // El resto lo lleva el efecto de seguimiento: la petición ya no queda abierta minutos.
      setProgress(null);
      setRunSince(started.started_at);
    } catch (cause) {
      setIsGenerating(false);
      const message = cause instanceof Error ? cause.message : "No se pudo generar el camino. Reintenta.";
      throw new Error(message);
    }
  }

  useEffect(() => {
    if (runSince === null) return;
    let cancelled = false;
    const query = new URLSearchParams({ since: String(runSince) });
    if (connectionId) query.set("connectionId", connectionId);
    const poll = async () => {
      try {
        const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/progress?${query.toString()}`);
        if (cancelled || !response.ok) return;
        const next = (await response.json()) as RunProgress;
        if (cancelled) return;
        setProgress(next);
        if (next.state === "done") {
          setRunSince(null);
          if (await load()) setShowIntake(false);
          else setError("El camino se generó, pero no se pudo cargar la propuesta. Reintenta la carga.");
          setIsGenerating(false);
        } else if (next.state === "failed") {
          setRunSince(null);
          setIsGenerating(false);
          setShowIntake(true);
          setError(caminoFailureMessage(next.failure));
        } else if (next.state === "idle" && Date.now() - runSince > 30_000) {
          // Ni el servidor ni la base de datos conocen ese run: no se queda girando para siempre.
          setRunSince(null);
          setIsGenerating(false);
          setError("No se encontró la generación en curso. Vuelve a intentarlo.");
        }
      } catch {
        // Un fallo de red puntual no corta el seguimiento: se reintenta en el siguiente ciclo.
      }
    };
    const id = window.setInterval(() => void poll(), 2500);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [runSince, organizationId, connectionId, load]);

  async function accept() {
    if (!proposal) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/from-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output_id: proposal.output_id,
          horizon_months: horizon,
          currency_code: currency,
          ...(proposal.content?.goal ? { goal_target: goalTarget.trim() ? Number(goalTarget) : null } : {}),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Camino creado como borrador. Revísalo y actívalo.");
      onCreated();
    } catch {
      setError("No se pudo crear el camino. Reintenta.");
    } finally {
      setIsCreating(false);
    }
  }

  async function reject() {
    if (!proposal) return;
    setIsRejecting(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/${proposal.output_id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setProposal(null);
      setGoalTarget("");
      setRejecting(false);
      setRejectReason("");
      setShowIntake(true);
      toast.success("Camino rechazado. No se ha creado ningún borrador.");
    } catch {
      setError("No se pudo rechazar el camino. Reintenta.");
    } finally {
      setIsRejecting(false);
    }
  }

  const content = proposal?.content ?? null;
  const proposalHorizonMonths = proposal?.horizon_months ?? content?.horizon_months ?? null;
  const proposalNeedsRegeneration = content !== null && proposalHorizonMonths !== null && horizon !== proposalHorizonMonths;
  // Mismo criterio que el backend al aceptar con otro plazo: las fechas son de
  // calendario y no se reescalan; un plazo mas corto deja fuera los hitos que
  // ya no caben.
  // Las fechas de una propuesta cuentan desde que se generó, no desde hoy.
  const anchor = proposal?.generated_at ? Date.parse(proposal.generated_at) : openedAt;
  const adjustedHorizonDays = calendarHorizonDays(horizon, new Date(anchor));
  const scaled = (days: number) => Math.min(adjustedHorizonDays, days);
  const phases = (content?.phases ?? [])
    .map((phase) => ({ ...phase, milestones: phase.milestones.filter((milestone) => milestone.target_offset_days <= adjustedHorizonDays) }))
    .filter((phase) => phase.milestones.length > 0);
  const hiddenMilestones = (content?.phases.reduce((sum, phase) => sum + phase.milestones.length, 0) ?? 0) - phases.reduce((sum, phase) => sum + phase.milestones.length, 0);
  const draft: DraftPhase[] = phases.map((phase) => ({
    name: phase.name,
    milestones: phase.milestones.map((milestone) => ({
      name: milestone.name,
      date: isoInDays(scaled(milestone.target_offset_days), anchor),
      detail: milestone.description,
      criterion: milestone.success_metric,
      tasks: milestone.tasks?.map((task) => ({
        title: task.title,
        description: task.description,
        date: isoInDays(scaled(task.target_offset_days), anchor),
        priority: TASK_PRIORITY_LABELS[task.priority],
      })),
    })),
  }));
  const goal = content?.goal;
  const operations = summarizeCaminoOperations(phases);
  const milestoneCount = phases.reduce((sum, phase) => sum + phase.milestones.length, 0);
  const taskCount = phases.reduce(
    (sum, phase) => sum + phase.milestones.reduce((phaseSum, milestone) => phaseSum + (milestone.tasks?.length ?? 0), 0),
    0,
  );
  const trackTotals = countByTrack(phases.flatMap((phase) => phase.milestones.flatMap((milestone) => milestone.tasks ?? [])));
  const goalNumber = goalTarget.trim() ? Number(goalTarget) : null;
  const checkpointMonths = calendarMonthsTouched(new Date(anchor), adjustedHorizonDays);
  const previewMonthlyTargets = goal?.monthly_targets
    ? Array.from({ length: checkpointMonths }, (_, index) => {
        const source = goal.monthly_targets?.[index];
        return source ?? { month: index + 1, target_value: null, seasonal_baseline: null, rationale: "Mes añadido al ampliar el plazo: replanifica para definir un objetivo propio." };
      })
    : [];
  const finalLabel = goal && goalNumber !== null && Number.isFinite(goalNumber) ? formatAmount(goalNumber, goal.unit, currency) : null;
  const dataCurrencyDiffers = goal?.unit === "money" && goal.currency_code && goal.currency_code !== currency;
  const proposalTabs = [
    ...(previewMonthlyTargets.length ? [{ value: "ruta", label: "Ruta mes a mes" }] : []),
    { value: "fases", label: "Fases y tareas" },
    { value: "porque", label: "Por qué y fuentes" },
  ];
  const activeTab = proposalTabs.some((item) => item.value === tab) ? tab : proposalTabs[0]!.value;

  return (
    <div className={s.flow}>
      {error ? (
        <ErrorBlock>
          <div>
            <strong>{error}</strong>
            {progress?.state === "failed" && content ? <p>La propuesta que ves abajo es anterior a este intento.</p> : null}
            {progress?.state === "failed" ? (
              <Collapsible style={{ marginTop: 8 }}>
                <CollapsibleTrigger>Diagnóstico de ejecución<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
                <CollapsibleContent>
                <div style={{ marginTop: 8 }}>
                  <div>Estado: {progress.run_status ?? progress.failure?.error ?? "fallido"}</div>
                  {progress.model ? <div>Modelo: {progress.model}</div> : null}
                  {progress.provider ? <div>Proveedor: {progress.provider}</div> : null}
                  {progress.steps.length ? (
                    <ul>
                      {progress.steps.slice(-8).map((step, index) => (
                        <li key={`${step.step_type}-${index}`}>{step.step_type}{step.summary ? `: ${step.summary}` : ""}</li>
                      ))}
                    </ul>
                  ) : <div>No hay pasos guardados para esta ejecución.</div>}
                  <div>Consultas a herramientas: {progress.tool_calls}</div>
                </div>
              </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        </ErrorBlock>
      ) : null}

      <div className={s.controls}>
        <div className={`${s.control} ${s.durationControl}`}>
          <div className={s.durationHeading}>
            <label className={s.durationTitle} htmlFor="camino-duration">Duración del Camino</label>
            <output className={s.durationValue} htmlFor="camino-duration" aria-live="polite">{horizon} {horizon === 1 ? "mes" : "meses"}</output>
          </div>
          <input
            id="camino-duration"
            type="range"
            min={1}
            max={12}
            step={1}
            value={horizon}
            className={s.range}
            disabled={isGenerating || isCreating}
            onChange={(event) => {
              const months = Number(event.target.value);
              horizonEdited.current = true;
              setHorizon(months);
              setError(null);
              setProgress(null);
              if (content && proposalHorizonMonths !== null && months !== proposalHorizonMonths) {
                setShowIntake(true);
              }
            }}
          />
          <span className={s.rangeScale}>
            <span>1 mes</span>
            <span>12 meses</span>
          </span>
          <span className={s.durationDates}>{displayFullDate(isoInDays(0, anchor))} — {displayFullDate(isoInDays(adjustedHorizonDays, anchor))}</span>
        </div>
        <div className={s.control}>
          <label className={s.controlLabel} htmlFor="camino-brief">Indicaciones para la IA (opcional)</label>
          <Textarea
            id="camino-brief"
            value={brief}
            maxLength={2000}
            rows={2}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="Ej. Lanzamos una colección en noviembre"
          />
        </div>
        {content && !proposalNeedsRegeneration ? (
          <Button type="button" variant="secondary" className={s.contextAction} disabled={isGenerating || isCreating} onClick={() => setShowIntake((open) => !open)}>
            {showIntake ? "Cerrar contexto" : "Trazar otro Camino"}
          </Button>
        ) : null}
      </div>

      {proposalNeedsRegeneration ? (
        <p className={s.hintLine}>El borrador actual es de {proposalHorizonMonths} meses. Traza uno nuevo para {horizon} meses.</p>
      ) : null}

      {agentActive === false ? (
        <ErrorBlock>
          La IA que traza caminos no está activada para este cliente, así que no se puede generar uno ahora. Puedes crearlo a mano o
          desde una plantilla, o pedir al consultor que active el agente de caminos.
        </ErrorBlock>
      ) : null}

      {showIntake && hasLoaded && agentActive !== false ? (
        <CaminoIntakeWizard
          organizationId={organizationId}
          connectionId={connectionId}
          horizonMonths={horizon}
          disabled={isGenerating || isCreating}
          onGenerate={generate}
        />
      ) : null}

      {isLoading ? (
        <LoadingBlock label="Buscando la última propuesta..." />
      ) : isGenerating ? (
        <CaminoDrawing variant={variant} stage={progressStage(progress)} />
      ) : !content || proposalNeedsRegeneration ? (
        null
      ) : (
        <>
          <div className={s.proposalHead}>
            <div>
              <span className={s.aiTag}>A19</span>
              <h3 className={s.proposalName}>{content.plan_name}</h3>
            </div>
            <span className={`${s.pill} ${content.confidence === "high" ? s.pillGood : content.confidence === "low" ? s.pillWarn : ""}`}>
              {CONFIDENCE[content.confidence]}
            </span>
          </div>
          <div className={s.proposalCounts} aria-label="Estructura de la propuesta">
            <span><b>{phases.length}</b> fases</span>
            <span><b>{milestoneCount}</b> hitos</span>
            <span><b>{taskCount}</b> tareas</span>
            {trackTotals.puesta_a_punto + trackTotals.temporada + trackTotals.crecimiento > 0 ? (
              <span>
                <b>{trackTotals.puesta_a_punto}</b> puesta a punto · <b>{trackTotals.temporada}</b> fechas clave · <b>{trackTotals.crecimiento}</b> de crecimiento
              </span>
            ) : null}
          </div>

          {goal ? (
            <div className={s.goal}>
              <div>
                <span className={s.controlLabel}>Objetivo propuesto</span>
                <p className={s.goalMetric}>{goal.metric_label}</p>
                <p className={s.goalLine}>
                  <span className={s.goalStep}>Ahora: {goal.baseline !== null ? formatAmount(goal.baseline, goal.unit, currency) : "sin punto de partida"}</span> <span aria-hidden="true">→</span>{" "}
                  <b>{finalLabel ? `Meta: ${finalLabel}` : "Meta por definir"}</b>
                </p>
              </div>
              <label className={s.goalInput}>
                <span>Meta al final del camino</span>
                <Input type="number" step="any" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} placeholder="Sin cifra" disabled={isCreating} />
              </label>
            </div>
          ) : null}
          {dataCurrencyDiffers ? (
            <p className={s.hintLine}>
              La tienda informa sus cifras en {goal?.currency_code}. Elegir {currency} cambia cómo se muestran, no convierte los importes.
            </p>
          ) : null}

          {operations.dueTaskCount > 0 ? (
            <section className={s.goal} aria-label="Trabajo de los primeros 14 días">
              <div>
                <strong>Primeros 14 días · {operations.dueTaskCount} tareas</strong>
                <p className={s.goalWhy}>{operations.estimatedHours} h estimadas{operations.withoutEstimate ? ` · ${operations.withoutEstimate} sin estimación` : ""}</p>
                <ol>
                  {operations.next.map((task, index) => (
                    <li key={`${task.title}-${index}`} className={s.goalWhy}>
                      <b>Día {task.target_offset_days}: {task.title}</b> · {task.owner === "client" ? "cliente" : task.owner === "consultant" ? "consultor" : "equipo compartido"} · {task.effort_hours != null ? `${task.effort_hours} h` : "esfuerzo por estimar"}
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : null}
          {goal?.decision_gates?.length ? (
            <Collapsible className={s.phaseDetails}>
              <CollapsibleTrigger>Decisiones antes de invertir o lanzar<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
              <CollapsibleContent>
              <div className={s.phaseCards}>
                {goal.decision_gates.map((gate, index) => (
                  <div className={s.phaseCard} key={`${gate.decision}-${index}`}>
                    <b>{gate.decision}</b>
                    <p>Avanzar si: {gate.proceed_when}</p>
                    <p>Pausar si: {gate.hold_when}</p>
                    <p>Comprobar: {gate.evidence_needed}</p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
            </Collapsible>
          ) : null}

          {hiddenMilestones > 0 ? (
            <p className={s.hintLine}>
              {hiddenMilestones} {hiddenMilestones === 1 ? "hito queda fuera" : "hitos quedan fuera"} del plazo elegido. Amplía la duración para incluirlos.
            </p>
          ) : null}
          {trackTotals.puesta_a_punto + trackTotals.temporada + trackTotals.crecimiento > 0 && trackTotals.crecimiento === 0 ? (
            <p className={s.hintLine}>
              Falta el ciclo de crecimiento semanal o mensual.
            </p>
          ) : null}
          <Tabs
            items={proposalTabs}
            value={activeTab}
            onChange={setTab}
            panels={{
              ruta: (
                <div className="space-y-4 pt-3">
          {goal && previewMonthlyTargets.length ? (
            <MonthlyRoute
              targets={previewMonthlyTargets}
              baseline={goal.baseline}
              baselineLabel="ritmo de los últimos 3 meses"
              format={(value) => formatAmount(value, goal.unit, currency)}
              startDate={isoInDays(0, anchor)}
              endDate={isoInDays(adjustedHorizonDays, anchor)}
              milestones={draft.flatMap((phase) => phase.milestones.map((milestone) => ({ name: milestone.name, date: milestone.date ?? null })))}
              goalTarget={goalNumber}
            />
          ) : null}
</div>
              ),
              fases: (
                <div className="space-y-4 pt-3">
          <CaminoDraftMap phases={draft} finalLabel={finalLabel} variant={variant} />

          <Collapsible className={s.phaseDetails}>
            <CollapsibleTrigger>Ver contexto y evidencias por fase<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
            <CollapsibleContent>
            <ol className={s.phaseCards}>
            {phases.map((phase, index) => (
              <li key={`${phase.name}-${index}`} className={s.phaseCard}>
                <span className={s.phaseNo}>Fase {index + 1}</span>
                <b>{phase.name}</b>
                {phase.rationale ? <p>{phase.rationale}</p> : null}
                {phase.milestones.length ? (
                  <div className={s.milestonePreviewList}>
                    {phase.milestones.map((milestone, milestoneIndex) => (
                      <section className={s.milestonePreview} key={`${milestone.name}-${milestoneIndex}`}>
                        <b>{milestone.name}</b>
                        <span className={s.milestonePreviewDate}>Hito · {displayOffsetDate(scaled(milestone.target_offset_days), anchor)}</span>
                        {milestone.success_metric ? <p>{milestone.success_metric}</p> : null}
                      </section>
                    ))}
                  </div>
                ) : null}
                <EvidenceChips evidence={phase.evidence} />
              </li>
            ))}
            </ol>
          </CollapsibleContent>
          </Collapsible>

</div>
              ),
              porque: (
                <div className="space-y-4 pt-3">
          <section className={s.contextBlock} aria-labelledby="camino-proposal-context">
            <div className={s.contextHeading}>
              <h4 id="camino-proposal-context">Por qué propone este camino</h4>
              <button
                type="button"
                className={s.contextToggle}
                aria-expanded={diagnosisExpanded}
                onClick={() => setDiagnosisExpanded((expanded) => !expanded)}
              >
                {diagnosisExpanded ? "Mostrar menos" : "Leer análisis completo"}
              </button>
            </div>
            <p className={`${s.diagnosis} ${diagnosisExpanded ? s.diagnosisExpanded : ""}`}>
              {content.diagnosis}
            </p>
          </section>

          {goal?.rationale ? (
            <Collapsible className={s.phaseDetails}>
              <CollapsibleTrigger>Por qué esta meta<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
              <CollapsibleContent>
              <p>{goal.rationale}</p>
            </CollapsibleContent>
            </Collapsible>
          ) : null}

          {proposal?.context_sources ? <ContextUsed sources={proposal.context_sources} /> : null}

          <Collapsible className={s.phaseDetails}>
            <CollapsibleTrigger>Ver {content.sources.length} fuentes y límites de la propuesta<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
            <CollapsibleContent>
            <AiEvidence sources={content.sources} warnings={content.warnings} />
          </CollapsibleContent>
          </Collapsible>

</div>
              ),
            }}
          />

          {proposal?.status === "published" ? (
            <p className={s.hintLine}>Esta propuesta ya se convirtió en un camino. Traza otra si quieres empezar de nuevo.</p>
          ) : proposal?.expired ? (
            <p className={s.hintLine}>Esta propuesta ha caducado: sus fechas y metas ya no valen. Traza otra con los datos de hoy.</p>
          ) : (
            <>
              <div className={s.actions}>
                <Button type="button" disabled={isCreating || isRejecting} onClick={() => void accept()}>
                  {isCreating ? "Creando..." : "Crear este camino"}
                </Button>
                <Button type="button" variant="secondary" disabled={isCreating || isRejecting} onClick={() => setRejecting((open) => !open)}>
                  Rechazar este camino
                </Button>
              </div>
              {rejecting ? (
                <div className={s.rejectBox}>
                  <Textarea
                    value={rejectReason}
                    maxLength={500}
                    rows={2}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="¿Qué no encaja? (opcional) La IA lo tendrá en cuenta en la próxima propuesta."
                  />
                  <div className={s.actions}>
                    <Button type="button" disabled={isRejecting} onClick={() => void reject()}>
                      {isRejecting ? "Rechazando..." : "Confirmar rechazo"}
                    </Button>
                    <Button type="button" variant="secondary" disabled={isRejecting} onClick={() => setRejecting(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plantilla .md
// ---------------------------------------------------------------------------

type ImportPreview = {
  ok: boolean;
  data?: {
    name: string;
    phases: Array<{ name: string; milestones: Array<{ name: string; targetDate?: string | null; description?: string | null; tasks: Array<{ title: string }> }> }>;
  };
  errors: Array<{ line: number; message: string }>;
  warnings: Array<{ line: number; message: string }>;
  counts: { phases: number; milestones: number; tasks: number };
  fileName?: string | null;
};

function ImportCreator({ organizationId, connectionId, currency, onCreated, variant }: {
  variant: "client" | "consultant";
  organizationId: string;
  connectionId?: string | null;
  currency: string;
  onCreated: () => void;
}) {
  const [markdown, setMarkdown] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  async function readFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".md")) {
      setError("Selecciona un archivo .md con la plantilla de Mi Camino.");
      return;
    }
    try {
      const text = await file.text();
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: text, fileName: file.name }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setMarkdown(text);
      setPreview((await response.json()) as ImportPreview);
    } catch {
      setError("No se pudo leer el archivo. Comprueba que sea un Markdown válido.");
    }
  }

  async function create() {
    if (!preview?.ok) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, fileName: preview.fileName, connectionId: connectionId || null, currencyCode: currency }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Camino importado como borrador.");
      onCreated();
    } catch {
      setError("No se pudo importar el camino. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  }

  const draft: DraftPhase[] = (preview?.data?.phases ?? []).map((phase) => ({
    name: phase.name,
    milestones: phase.milestones.map((milestone) => ({
      name: milestone.name,
      date: milestone.targetDate ?? null,
      detail: milestone.description ?? (milestone.tasks.length ? `${milestone.tasks.length} tareas: ${milestone.tasks.map((task) => task.title).join(" · ")}` : null),
    })),
  }));

  return (
    <div className={s.flow}>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <label
        className={`${s.drop} ${dragging ? s.dropOver : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".md,text/markdown,text/plain"
          className={s.srOnly}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
        <span className={s.dropIcon} aria-hidden="true">
          ⇪
        </span>
        <b>{preview ? "Suelta otra plantilla para cambiarla" : "Arrastra aquí tu plantilla .md"}</b>
        <span>o pulsa para elegirla</span>
      </label>
      {preview ? (
        <Attachment size="sm" state={preview.ok ? "done" : "error"}>
          <AttachmentMedia><FileTextIcon aria-hidden /></AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{preview.fileName ?? "plantilla.md"}</AttachmentTitle>
            <AttachmentDescription>
              {preview.ok
                ? `Markdown · ${preview.counts.phases} fases, ${preview.counts.milestones} hitos`
                : `Markdown · ${preview.errors.length === 1 ? "1 error" : `${preview.errors.length} errores`} que corregir`}
            </AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label={`Quitar ${preview.fileName ?? "la plantilla"}`} onClick={() => { setPreview(null); setMarkdown(""); }}>
              <XIcon aria-hidden />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ) : null}
      <p className={s.hintLine}>
        ¿No tienes plantilla?{" "}
        <ButtonLink href="/plantilla-mi-camino.md" download="plantilla-mi-camino.md" variant="ghost" size="sm">
          Descargar la plantilla
        </ButtonLink>
      </p>

      {preview && !preview.ok ? (
        <ErrorBlock>
          <ul className={s.issues}>
            {preview.errors.map((issue) => (
              <li key={`${issue.line}-${issue.message}`}>
                Línea {issue.line}: {issue.message}
              </li>
            ))}
          </ul>
        </ErrorBlock>
      ) : null}

      {preview?.ok && preview.data ? (
        <>
          <div className={s.proposalHead}>
            <h3 className={s.proposalName}>{preview.data.name}</h3>
            <span className={s.pill}>
              {preview.counts.phases} fases · {preview.counts.milestones} hitos · {preview.counts.tasks} tareas
            </span>
          </div>
          <CaminoDraftMap phases={draft} variant={variant} />
          {preview.warnings.length ? (
            <ul className={s.warnings}>
              {preview.warnings.map((warning) => (
                <li key={`${warning.line}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          ) : null}
          <div className={s.actions}>
            <Button type="button" disabled={saving} onClick={() => void create()}>
              {saving ? "Creando..." : "Crear este camino"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A mano: el mapa se dibuja mientras escribes
// ---------------------------------------------------------------------------

type ManualMilestone = { name: string; date: string; metricKey: string; target: string };
type ManualPhase = { name: string; milestones: ManualMilestone[] };

const emptyMilestone = (): ManualMilestone => ({ name: "", date: "", metricKey: "", target: "" });

function ManualCreator({ organizationId, connectionId, currency, catalog, onCreated, variant }: {
  variant: "client" | "consultant";
  organizationId: string;
  connectionId?: string | null;
  currency: string;
  catalog: CatalogEntry[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phases, setPhases] = useState<ManualPhase[]>([{ name: "", milestones: [emptyMilestone()] }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePhase = (pi: number, patch: Partial<ManualPhase>) =>
    setPhases((current) => current.map((phase, i) => (i === pi ? { ...phase, ...patch } : phase)));
  const updateMilestone = (pi: number, mi: number, patch: Partial<ManualMilestone>) =>
    setPhases((current) =>
      current.map((phase, i) =>
        i === pi ? { ...phase, milestones: phase.milestones.map((m, j) => (j === mi ? { ...m, ...patch } : m)) } : phase,
      ),
    );

  const unitOf = (key: string) => catalog.find((entry) => entry.key === key)?.unit;
  const unitHint = (key: string) => {
    const unit = unitOf(key);
    return unit === "money" ? currency : unit === "pct" ? "%" : unit === "ratio" ? "×" : "";
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          connectionId: connectionId || null,
          currencyCode: currency,
          phases: phases
            .filter((phase) => phase.name.trim())
            .map((phase) => ({
              name: phase.name.trim(),
              milestones: phase.milestones
                .filter((milestone) => milestone.name.trim())
                .map((milestone) => ({
                  name: milestone.name.trim(),
                  targetDate: milestone.date || null,
                  objective:
                    milestone.metricKey && milestone.target.trim() && Number.isFinite(Number(milestone.target))
                      ? { metricKey: milestone.metricKey, targetValue: Number(milestone.target) }
                      : null,
                })),
            })),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Camino creado como borrador.");
      onCreated();
    } catch {
      setError("No se pudo crear el camino. Reintenta.");
    } finally {
      setSaving(false);
    }
  }

  const draft: DraftPhase[] = phases.map((phase) => ({
    name: phase.name,
    milestones: phase.milestones.map((milestone) => {
      const entry = catalog.find((item) => item.key === milestone.metricKey);
      const target = Number(milestone.target);
      return {
        name: milestone.name,
        date: milestone.date || null,
        criterion: entry && milestone.target.trim() && Number.isFinite(target) ? `${entry.label}: ${formatAmount(target, entry.unit, currency)}` : null,
      };
    }),
  }));

  return (
    <form className={s.flow} onSubmit={submit}>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <label className={s.nameField}>
        <span className={s.controlLabel}>Nombre del camino</span>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="p. ej. Escalar a 50.000 € al mes" required />
      </label>

      <div className={s.builder}>
        <ol className={s.builderPhases}>
          {phases.map((phase, pi) => (
            <li key={pi} className={s.builderPhase}>
              <div className={s.builderPhaseHead}>
                <span className={s.phaseNo}>Fase {pi + 1}</span>
                <Input
                  aria-label={`Nombre de la fase ${pi + 1}`}
                  value={phase.name}
                  onChange={(event) => updatePhase(pi, { name: event.target.value })}
                  placeholder={pi === 0 ? "p. ej. Medir bien" : "Nombre de la fase"}
                />
                {phases.length > 1 ? (
                  <button type="button" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={`Quitar la fase ${pi + 1}`} onClick={() => setPhases((current) => current.filter((_, i) => i !== pi))}>
                    ×
                  </button>
                ) : null}
              </div>
              <ul className={s.builderMilestones}>
                {phase.milestones.map((milestone, mi) => (
                  <li key={mi} className={s.builderMilestone}>
                    <span className={s.stopDot} aria-hidden="true">
                      {pi + 1}.{mi + 1}
                    </span>
                    <div className={s.builderFields}>
                      <Input
                        aria-label={`Hito ${pi + 1}.${mi + 1}`}
                        value={milestone.name}
                        onChange={(event) => updateMilestone(pi, mi, { name: event.target.value })}
                        placeholder="Qué se consigue en este hito"
                      />
                      <div className={s.builderRow}>
                        <DatePicker
                          aria-label={`Fecha del hito ${pi + 1}.${mi + 1}`}
                          value={milestone.date}
                          onChange={(value) => updateMilestone(pi, mi, { date: value })}
                        />
                        <SearchableSelect
                          aria-label={`Métrica del hito ${pi + 1}.${mi + 1}`}
                          placeholder="Busca una métrica"
                          emptyText="No hay ninguna métrica con ese nombre."
                          value={milestone.metricKey}
                          onChange={(value) => updateMilestone(pi, mi, { metricKey: value })}
                          options={[{ value: "", label: "Sin métrica" }, ...metricOptions(catalog)]}
                        />
                        {milestone.metricKey ? (
                          <span className={s.targetField}>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              aria-label={`Meta del hito ${pi + 1}.${mi + 1}`}
                              value={milestone.target}
                              onChange={(event) => updateMilestone(pi, mi, { target: event.target.value })}
                              placeholder="Meta"
                            />
                            {unitHint(milestone.metricKey) ? <small>{unitHint(milestone.metricKey)}</small> : null}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {phase.milestones.length > 1 ? (
                      <button
                        type="button"
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        aria-label={`Quitar el hito ${pi + 1}.${mi + 1}`}
                        onClick={() => updatePhase(pi, { milestones: phase.milestones.filter((_, j) => j !== mi) })}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button type="button" className={buttonVariants({ variant: "link" })} onClick={() => updatePhase(pi, { milestones: [...phase.milestones, emptyMilestone()] })}>
                + Hito
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className={s.addPhase} onClick={() => setPhases((current) => [...current, { name: "", milestones: [emptyMilestone()] }])}>
          + Añadir fase
        </button>
      </div>

      <CaminoDraftMap phases={draft} variant={variant} />

      <div className={s.actions}>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Creando..." : "Crear el camino"}
        </Button>
        <span className={s.hintLine}>Las tareas se añaden después, dentro de cada hito.</span>
      </div>
    </form>
  );
}
