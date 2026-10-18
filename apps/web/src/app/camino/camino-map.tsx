"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { displayValue } from "@/lib/display-labels";
import { ButtonLink, toast } from "@/components/ui";
import { clientNextStep, splitCriterion } from "./next-step";
import { MonthlyRoute } from "./monthly-route";
import { GrowthCycle } from "./growth-cycle";
import { cadenceLabel, trackLabel } from "./task-tracks";
import { formatEffort, metaOwnerLabel, taskWantsEmailDraft, type PlanTaskMeta } from "./plan-task-meta";
import s from "./camino-map.module.css";
import { latestMarketingAssetByTask, marketingAssetHref, marketingAssetStatusLabel, type CaminoMarketingAsset } from "@/lib/camino-marketing-assets";

/**
 * Mi Camino como mapa, para el cliente.
 *
 * El árbol es la herramienta del consultor para construir el plan; el cliente
 * entra a saber dónde está y qué le toca. Cada fase es un tramo del mapa, cada
 * hito una parada y cada fase acaba en su meta. Solo pinta lo que ya trae el
 * plan: nada del mapa se inventa.
 *
 * El estilo "Aventura" cambia solo el fondo (estética retro genérica, sin
 * elementos de marca de terceros); los datos y el contraste son los mismos.
 */

type MapTask = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  source: string;
  description?: string | null;
  priority?: string | null;
  categories?: string[];
  created_by_origin?: "consultant" | "client" | null;
  plan_meta?: PlanTaskMeta | null;
};

type MapMilestone = {
  id: string;
  name: string;
  description: string | null;
  success_criteria?: string | null;
  rationale?: string | null;
  position: number;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  milestone_task_links: Array<{ tasks: MapTask | null }>;
};

type MapPhase = {
  id: string;
  name: string;
  position: number;
  status: string;
  strategic_plan_milestones: MapMilestone[];
};

type MapGoal = {
  metric_label: string;
  baseline: number | null;
  target: number | null;
  target_date?: string;
  unit?: MapUnit;
  currency_code?: string | null;
  monthly_targets?: Array<{ month: number; target_value: number | null; rationale: string }>;
};

type MapUnit = "money" | "pct" | "count" | "ratio" | "number";

type MapObjective = {
  id: string;
  milestone_id: string | null;
  label: string;
  unit: MapUnit;
  direction: "up" | "down";
  source: string;
  target_value: number;
  actual_value: number | null;
  progress_pct: number | null;
  status: string;
};

type MapReview = {
  id: string;
  period_start: string;
  period_end: string;
  output: {
    executive_summary: string;
    goal_progress: {
      status?: string;
      explanation: string;
      observed_value: number | null;
      expected_value?: number | null;
      baseline_value?: number | null;
      target_value?: number | null;
    };
    progress?: Array<{ item: string; status: string; evidence: string }>;
    risks?: Array<{ severity: string; detail: string; evidence: string }>;
    learnings?: Array<{ title: string; learning: string; evidence: string; applies_to: string; confidence: string }>;
    next_actions: Array<{ title: string; rationale: string; owner: string; due_in_days: number }>;
    change_proposals: Array<{ description: string; reason: string }>;
    warnings?: string[];
  } | null;
};

type NodeState = "done" | "current" | "pending" | "locked";
type Stop = { milestone: MapMilestone; phase: MapPhase; code: string; state: NodeState };

const DAY_MS = 86_400_000;
const CLOSED = ["completed", "skipped"];
const OPEN_TASK = ["pending", "in_progress"];
const H = 360;
const YS = [250, 156, 236, 140, 218, 124];
const STYLE_KEY = "camino-map-style";

const sortByPosition = <T extends { position: number }>(items: T[]) => items.slice().sort((a, b) => a.position - b.position);

function TaskTrail({ tasks }: { tasks: Array<Pick<MapTask, "id" | "title" | "status" | "due_at" | "description" | "priority">> }) {
  if (!tasks.length) return null;
  return (
    <ol className={s.taskTrail} aria-label="Recorrido de tareas del hito">
      {tasks.map((task, index) => {
        const done = task.status === "completed";
        const active = task.status === "in_progress";
        return (
          <li key={task.id} className={`${s.taskTrailItem} ${done ? s.taskTrailDone : active ? s.taskTrailActive : ""}`}>
            <span className={s.taskTrailNode} aria-label={done ? "Completada" : active ? "En curso" : "Pendiente"}>
              {done ? "✓" : index + 1}
            </span>
            <div className={s.taskTrailCopy}>
              <strong>{task.title}</strong>
              {task.description ? <span>{task.description}</span> : null}
              <small>
                {done ? "Completada" : active ? "En curso" : "Pendiente"}
                {task.due_at ? ` · ${shortDate(task.due_at)}` : ""}
                {task.priority ? ` · Prioridad ${task.priority}` : ""}
              </small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function shortDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function daysUntil(date: string, today: Date) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00`) - start) / DAY_MS);
}

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function stopsOf(points: Layout["points"], phase: MapPhase) {
  return points.flatMap((point) => (point.kind === "stop" && point.stop.phase.id === phase.id ? [point.stop] : []));
}

function esc(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// ---------------------------------------------------------------------------
// Dibujo del mapa (SVG como cadena: son decenas de formas estáticas)
// ---------------------------------------------------------------------------

// Cliente: petróleo + azafrán. Consultor: grafito + mandarina, como su mesa.
export type MapVariant = "client" | "consultant";
export type DiscussTopic = { code: string; name: string; targetDate: string | null; doneTasks: number; totalTasks: number; late: boolean };
const WORK_MAP_PALETTE = { goodPill: "#efeeec", acc: "#3d3b3a", dk: "#3d3b3a", onAcc: "#ffffff", ink: "#3d3b3a", good: "#2f7d5b", p1: "#efeeec", p2: "#f8f7f5", l1: "#3d3b3a", l2: "#e2dfdc", mu: "#6b6662", lock: "#ebe8e5", lockIcon: "#6b6662" };
const PALETTES = { client: WORK_MAP_PALETTE, consultant: WORK_MAP_PALETTE };
// ponytail: paleta de módulo que fija renderSvg antes de dibujar (render síncrono).
let P = PALETTES.client;

function pill(x: number, y: number, text: string, tone: "dark" | "good" | "accent" = "dark", strong = false) {
  const w = Math.round(text.length * (strong ? 6.9 : 6.4) + 20);
  const bg = tone === "good" ? P.goodPill : tone === "accent" ? P.acc : P.dk;
  const fg = tone === "good" ? P.ink : P.onAcc;
  return `<g aria-hidden="true"><rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="22" rx="11" fill="${bg}" fill-opacity="${tone === "dark" ? 0.88 : 1}"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="font:${strong ? 600 : 500} 11.5px var(--font-plex-sans),system-ui,sans-serif;fill:${fg}">${esc(text)}</text></g>`;
}

function goalMarker(x: number, y: number, done: boolean, final: boolean) {
  const fill = done ? P.good : final ? P.acc : P.dk;
  const ink = final && !done ? P.onAcc : "#ffffff";
  const icon = done
    ? `<path d="M${x - 8} ${y} l5 5 l11 -11" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<line x1="${x - 5}" y1="${y + 9}" x2="${x - 5}" y2="${y - 9}" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="M${x - 5} ${y - 9} L${x + 8} ${y - 5} L${x - 5} ${y - 1} Z" fill="${ink}"/>`;
  return `<g aria-hidden="true"><rect x="${x - 21}" y="${y - 21}" width="42" height="42" rx="10" fill="${fill}" stroke="${P.ink}" stroke-opacity="${done || final ? 0 : 0.5}" stroke-width="2" transform="rotate(45 ${x} ${y})"/>${icon}</g>`;
}

function castle(x: number, y: number, done: boolean, final: boolean) {
  const flag = done ? "#2f9e44" : final ? P.acc : "#e03131";
  const merlons = [-24, -12, 0, 12].map((cx) => `<rect x="${cx}" y="-37" width="8" height="8" fill="#c2703d" stroke="#7a3e0c"/>`).join("");
  return `<g transform="translate(${x} ${y + 6})" aria-hidden="true"><line x1="0" y1="-54" x2="0" y2="-30" stroke="#343a40" stroke-width="2"/><path d="M0 -54 L18 -48 L0 -42 Z" fill="${flag}"/><rect x="-24" y="-30" width="48" height="36" fill="#c2703d" stroke="#7a3e0c"/>${merlons}<path d="M-7 6 V-6 A7 7 0 0 1 7 -6 V6 Z" fill="${done ? "#2f9e44" : "#212529"}"/></g>`;
}

function scene(x0: number, width: number, index: number, locked: boolean) {
  const top = 62;
  const bottom = H - 18;
  const gy = bottom - 34;
  const X = (v: number) => x0 + v;
  const cloud = (cx: number, cy: number, k = 1) =>
    `<g transform="translate(${X(cx)} ${cy}) scale(${k})"><ellipse cx="0" cy="0" rx="26" ry="11" fill="#fff"/><ellipse cx="-14" cy="-6" rx="13" ry="10" fill="#fff"/><ellipse cx="10" cy="-9" rx="16" ry="12" fill="#fff"/></g>`;
  const hill = (cx: number, r: number, c: string) => `<ellipse cx="${X(cx)}" cy="${gy}" rx="${r}" ry="${r * 0.75}" fill="${c}"/>`;
  const bush = (cx: number) => `<ellipse cx="${X(cx)}" cy="${gy - 2}" rx="18" ry="11" fill="#2f9e44"/><ellipse cx="${X(cx + 14)}" cy="${gy - 4}" rx="14" ry="12" fill="#37b24d"/>`;
  let bricks = "";
  for (let bx = 10; bx < width - 10; bx += 24) {
    bricks += `<rect x="${X(bx)}" y="${gy}" width="23" height="15" fill="#b5651d" stroke="#7a3e0c"/><rect x="${X(bx - 12)}" y="${gy + 16}" width="23" height="15" fill="#b5651d" stroke="#7a3e0c"/>`;
  }
  return `<g opacity="${locked ? 0.55 : 1}" clip-path="url(#camino-clip-${index})"><rect x="${X(10)}" y="${top}" width="${width - 20}" height="${bottom - top}" fill="url(#camino-sky)"/>${cloud(width * 0.18, 104)}${cloud(width * 0.58, 88, 0.8)}${cloud(width * 0.84, 118, 1.1)}${hill(width * 0.24, 90, "#51cf66")}${hill(width * 0.7, 120, "#40c057")}${hill(width * 0.48, 60, "#69db7c")}${bush(40)}${bush(width * 0.42)}${bush(width - 60)}${bricks}</g>`;
}

type Layout = {
  width: number;
  phases: Array<{ phase: MapPhase; x0: number; width: number; index: number }>;
  points: Array<{ kind: "stop"; stop: Stop; x: number; y: number } | { kind: "goal"; phase: MapPhase; index: number; x: number; y: number }>;
};

function buildLayout(phases: MapPhase[], stops: Stop[]): Layout {
  let x0 = 0;
  const out: Layout = { width: 0, phases: [], points: [] };
  phases.forEach((phase, index) => {
    const own = stops.filter((stop) => stop.phase.id === phase.id);
    // El ancho también sigue al nombre de la fase para no cortarlo con «…».
    const width = Math.max(380, 190 + own.length * 120, Math.ceil(phase.name.length * 8.8) + 70);
    const span = width - 190;
    own.forEach((stop, i) => {
      out.points.push({ kind: "stop", stop, x: x0 + 80 + (own.length > 1 ? (i * span) / (own.length - 1) : span / 2), y: YS[i % YS.length] });
    });
    out.points.push({ kind: "goal", phase, index, x: x0 + width - 70, y: YS[own.length % YS.length] });
    out.phases.push({ phase, x0, width, index });
    x0 += width;
  });
  out.width = x0;
  return out;
}

function renderSvg(layout: Layout, selectedId: string | null, adventure: boolean, finalLabel: string | null, totalPhases: number, variant: MapVariant = "client", draft = false) {
  P = PALETTES[variant];
  const { width, phases, points } = layout;
  const phaseLocked = (phase: MapPhase) => !draft && !["active", "completed"].includes(phase.status);
  const phaseDone = (phase: MapPhase) => phase.status === "completed";
  let svg = `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="presentation"><defs><linearGradient id="camino-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c94fc"/><stop offset="1" stop-color="#a5d8ff"/></linearGradient>${phases
    .map((p) => `<clipPath id="camino-clip-${p.index}"><rect x="${p.x0 + 10}" y="62" width="${p.width - 20}" height="${H - 80}" rx="28"/></clipPath>`)
    .join("")}</defs>`;

  phases.forEach(({ phase, x0, width: pw, index }) => {
    const active = phase.status === "active";
    svg += adventure
      ? scene(x0, pw, index, phaseLocked(phase))
      : `<rect x="${x0 + 10}" y="62" width="${pw - 20}" height="${H - 80}" rx="28" fill="${active ? P.p1 : P.p2}" stroke="${active ? P.l1 : P.l2}" opacity="${phaseLocked(phase) ? 0.6 : 1}"/>`;
    // Fase, hitos y tareas en la línea de arriba: fuera de la tarjeta, sin pisar su borde.
    const phaseStops = stopsOf(points, phase);
    const phaseTaskCount = phaseStops.reduce((sum, stop) => sum + stop.milestone.milestone_task_links.filter((link) => link.tasks).length, 0);
    const phaseMetadata = `Fase ${index + 1} · ${count(phaseStops.length, "hito", "hitos")} · ${count(phaseTaskCount, "tarea", "tareas")}`;
    svg += `<text x="${x0 + 30}" y="32" style="font:600 11px var(--font-plex-sans),system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;fill:${P.mu}">${phaseMetadata}</text><text x="${x0 + 30}" y="53" style="font:600 15px var(--font-plex-sans),system-ui,sans-serif;fill:${P.ink}"><title>${esc(phase.name)}</title>${esc(phase.name)}</text>`;
  });

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const doneSeg = a.kind === "stop" ? a.stop.state === "done" : phaseDone(a.phase);
    const locked = b.kind === "stop" ? b.stop.state === "locked" : phaseLocked(b.phase);
    const dx = (b.x - a.x) / 2;
    svg += `<path d="M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}" fill="none" stroke="${doneSeg ? P.acc : adventure ? "#fff4d6" : P.ink}" stroke-opacity="${doneSeg ? 1 : locked ? (adventure ? 0.6 : 0.3) : adventure ? 0.95 : 0.6}" stroke-width="${doneSeg ? 4 : 2.5}" stroke-dasharray="${doneSeg ? "0" : "2 8"}" stroke-linecap="round"/>`;
  }

  phases.forEach(({ phase, x0, width: pw, index }) => {
    if (phaseLocked(phase) && index > 0) svg += pill(x0 + pw / 2, 92, `Se abre al completar la fase ${index}`);
  });

  points.forEach((p) => {
    if (p.kind === "goal") {
      const final = p.index === totalPhases - 1;
      const done = phaseDone(p.phase);
      svg += adventure ? castle(p.x, p.y, done, final) : goalMarker(p.x, p.y, done, final);
      const label = final && finalLabel ? `Meta · ${finalLabel}` : done ? "Fase completada" : "Fin de fase";
      svg += pill(p.x, p.y + 42, label, done ? "good" : final ? "accent" : "dark", true);
      return;
    }
    const { stop } = p;
    const selected = stop.milestone.id === selectedId;
    const tasks = stop.milestone.milestone_task_links.map((link) => link.tasks).filter(Boolean) as MapTask[];
    const doneTasks = tasks.filter((task) => task.status === "completed").length;
    const fill = { done: P.good, current: P.acc, pending: P.ink, locked: P.lock }[stop.state];
    const stateLabel = { done: "Completado", current: "En curso", pending: "Siguiente", locked: "Bloqueado" }[stop.state];
    svg += `<g class="${s.node}" tabindex="0" role="button" data-milestone="${stop.milestone.id}" aria-pressed="${selected}" aria-label="Hito ${stop.code}: ${esc(stop.milestone.name)}. ${stateLabel}">`;
    if (stop.state === "current") svg += `<circle class="${s.pulse}" cx="${p.x}" cy="${p.y}" r="22" fill="none" stroke="${P.acc}" stroke-width="3"/>`;
    svg += `<circle class="${s.ring}" cx="${p.x}" cy="${p.y}" r="${selected ? 28 : 25}" fill="none" stroke="${selected ? P.ink : "transparent"}" stroke-width="2"/><circle class="${s.disc}" cx="${p.x}" cy="${p.y}" r="20" fill="${fill}" stroke="${P.dk}" stroke-opacity=".35" stroke-width="2"/>`;
    if (stop.state === "done") {
      svg += `<path d="M${p.x - 7} ${p.y} l4.5 4.5 l10 -10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (stop.state === "locked") {
      svg += `<g transform="translate(${p.x} ${p.y})" fill="none" stroke="${P.lockIcon}" stroke-width="2"><rect x="-6.5" y="-1.5" width="13" height="9" rx="2" fill="${P.lockIcon}" stroke="none"/><path d="M-4 -1.5 V-5 A4 4 0 0 1 4 -5 V-1.5"/></g>`;
    } else {
      svg += `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle" style="font:600 12px var(--font-plex-sans),system-ui,sans-serif;fill:${P.onAcc};pointer-events:none">${stop.code}</text>`;
    }
    svg += pill(p.x, p.y + 38, stop.state === "locked" || tasks.length === 0 ? `Hito ${stop.code}` : `${doneTasks}/${tasks.length} tareas`);
    svg += `</g>`;
    if (stop.state === "current") svg += pill(p.x, p.y - 40, variant === "consultant" ? "El cliente está aquí" : "Estás aquí", "accent", true);
  });

  return `${svg}</svg>`;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CaminoMap({
  planStatus,
  goal,
  phases: rawPhases,
  objectives,
  formatObjective,
  review,
  canResolveTasks,
  sourceLabels,
  formatGoal,
  onToggleTask,
  renderChangeDecision,
  onApproveLearning,
  variant = "client",
  renderMilestoneExtra,
  onDiscuss,
  onGenerateMarketingTask,
  generatingTaskId,
  marketingAssets = [],
  startsOn,
}: {
  /** Inicio del Camino (yyyy-mm-dd): ancla las ventanas mensuales de la ruta económica. */
  startsOn?: string | null;
  variant?: MapVariant;
  /** Acciones del consultor dentro de la ficha del hito (editar, tareas, notas...). */
  renderMilestoneExtra?: (milestoneId: string) => ReactNode;
  /** Abre la conversación con un mensaje ya preparado sobre el hito. */
  onDiscuss?: (topic: DiscussTopic) => void;
  onGenerateMarketingTask?: (task: MapTask) => void;
  generatingTaskId?: string | null;
  marketingAssets?: CaminoMarketingAsset[];
  planStatus: string;
  goal: MapGoal | null | undefined;
  phases: MapPhase[];
  objectives: MapObjective[];
  formatObjective: (value: number, unit: MapUnit) => string;
  review: MapReview | null;
  canResolveTasks: boolean;
  sourceLabels: Record<string, string>;
  formatGoal: (value: number) => string;
  onToggleTask: (task: MapTask) => void;
  renderChangeDecision?: (index: number) => ReactNode;
  onApproveLearning?: (reviewId: string, learningIndex: number) => Promise<void>;
}) {
  const [today] = useState(() => new Date());
  // Solo se monta en el navegador (el plan llega tras la carga), así que leer
  // la preferencia aquí no descuadra la hidratación.
  const [adventure, setAdventure] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(STYLE_KEY) === "aventura";
    } catch {
      return false;
    }
  });
  const mapRef = useRef<HTMLDivElement>(null);

  const phases = useMemo(() => sortByPosition(rawPhases), [rawPhases]);
  const planTasks = useMemo(
    () => phases.flatMap((phase) => phase.strategic_plan_milestones.flatMap((milestone) => milestone.milestone_task_links.flatMap((link) => (link.tasks ? [link.tasks] : [])))),
    [phases],
  );
  const marketingAssetsByTask = useMemo(
    () => latestMarketingAssetByTask(marketingAssets),
    [marketingAssets],
  );
  const stops = useMemo<Stop[]>(() => {
    const active = phases.find((phase) => phase.status === "active") ?? null;
    const activeOrdered = active ? sortByPosition(active.strategic_plan_milestones) : [];
    const focusId = (activeOrdered.find((m) => m.status === "in_progress") ?? activeOrdered.find((m) => !CLOSED.includes(m.status)))?.id ?? null;
    return phases.flatMap((phase, pi) =>
      sortByPosition(phase.strategic_plan_milestones).map((milestone, mi) => {
        // Un borrador no ha arrancado: sus hitos estan previstos, no bloqueados.
        const state: NodeState = planStatus === "draft"
          ? "pending"
          : CLOSED.includes(milestone.status) || phase.status === "completed"
          ? "done"
          : milestone.id === focusId
            ? "current"
            : phase.status === "active"
              ? "pending"
              : "locked";
        return { milestone, phase, code: `${pi + 1}.${mi + 1}`, state };
      }),
    );
  }, [phases, planStatus]);

  const focus = stops.find((stop) => stop.state === "current") ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = stops.find((stop) => stop.milestone.id === selectedId) ?? focus ?? stops[0] ?? null;

  const layout = useMemo(() => buildLayout(phases, stops), [phases, stops]);
  const finalLabel = goal?.target != null ? formatGoal(goal.target) : null;
  const svg = useMemo(
    () => renderSvg(layout, selected?.milestone.id ?? null, adventure, finalLabel, phases.length, variant, planStatus === "draft"),
    [layout, selected, adventure, finalLabel, phases.length, variant, planStatus],
  );

  // Al entrar, el mapa se abre en la fase en curso, no en la primera.
  const activeX = layout.phases.find((p) => p.phase.status === "active")?.x0 ?? 0;
  useEffect(() => {
    if (mapRef.current) mapRef.current.scrollLeft = Math.max(0, activeX - 10);
  }, [activeX]);

  function chooseStyle(next: boolean) {
    setAdventure(next);
    try {
      localStorage.setItem(STYLE_KEY, next ? "aventura" : "formal");
    } catch {
      /* preferencia solo de esta sesión */
    }
  }

  function pickFromEvent(target: EventTarget | null) {
    const node = (target as Element | null)?.closest?.("[data-milestone]");
    if (node) setSelectedId(node.getAttribute("data-milestone"));
  }

  // --- marcador ---
  const step = clientNextStep(planStatus, phases, today.toISOString().slice(0, 10));
  const allTasks = stops.flatMap((stop) => stop.milestone.milestone_task_links.map((link) => link.tasks).filter(Boolean) as MapTask[]);
  const doneTasks = allTasks.filter((task) => task.status === "completed").length;
  const donePhases = phases.filter((phase) => phase.status === "completed").length;
  const focusDays = focus?.milestone.target_date ? daysUntil(focus.milestone.target_date, today) : null;

  const progress = review?.output?.goal_progress;
  const observed = progress?.observed_value ?? null;
  const baseline = goal?.baseline ?? progress?.baseline_value ?? null;
  const target = goal?.target ?? progress?.target_value ?? null;
  const expected = progress?.expected_value ?? null;
  const ratio = (value: number | null) =>
    value !== null && baseline !== null && target !== null && target !== baseline
      ? Math.max(0, Math.min(1, (value - baseline) / (target - baseline)))
      : null;

  return (
    <div className={`${s.root} ${variant === "consultant" ? s.consultant : ""}`}>
      <section className={s.hero} aria-label="Mapa de tu camino">
        <div className={s.hud}>
          <div>
            <span className={s.k}>{variant === "consultant" ? "El cliente está en" : "Estás en"}</span>
            <span className={s.v}>{focus ? `Hito ${focus.code} · ${focus.milestone.name}` : step.headline}</span>
            <span className={s.s}>
              {focus
                ? `Fase «${focus.phase.name}»${focusDays === null ? "" : focusDays < 0 ? ` · va ${-focusDays} ${focusDays === -1 ? "día" : "días"} tarde` : ` · quedan ${focusDays} ${focusDays === 1 ? "día" : "días"}`}`
                : step.detail}
            </span>
          </div>
          <div>
            <span className={s.k}>Meta del camino</span>
            {target !== null ? (
              <>
                <span className={s.v}>
                  {observed !== null ? formatGoal(observed) : "—"} <small>/ {formatGoal(target)}</small>
                </span>
                {ratio(observed) !== null ? (
                  <div className={s.goalbar} title="La marca blanca es donde deberías estar hoy">
                    <i style={{ width: `${ratio(observed)! * 100}%` }} />
                    {ratio(expected) !== null ? <b style={{ left: `${ratio(expected)! * 100}%` }} /> : null}
                  </div>
                ) : null}
                <span className={s.s}>
                  {observed !== null ? goal?.metric_label : "Se mide con la primera revisión periódica"}
                  {goal?.target_date ? ` · ${shortDate(goal.target_date)}` : ""}
                </span>
              </>
            ) : (
              <>
                <span className={s.v}>Sin cifra</span>
                <span className={s.s}>El camino no tiene una meta cuantificada</span>
              </>
            )}
          </div>
          <div>
            <span className={s.k}>Tareas hechas</span>
            <span className={s.v}>
              {doneTasks} <small>/ {allTasks.length}</small>
            </span>
            <span className={s.s}>En todo el camino</span>
          </div>
          <div>
            <span className={s.k}>Fases completadas</span>
            <span className={s.v}>
              {donePhases} <small>/ {phases.length}</small>
            </span>
            <span className={s.s}>{phases.find((phase) => phase.status === "active")?.name ?? "Ninguna en curso"}</span>
          </div>
        </div>

        <div
          ref={mapRef}
          className={s.map}
          role="region"
          tabIndex={0}
          aria-label={`Mapa del camino: ${phases.length} fases y ${stops.length} hitos. Desplázalo con las flechas para verlo entero.`}
          onClick={(event) => pickFromEvent(event.target)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              if ((event.target as Element).closest?.("[data-milestone]")) {
                event.preventDefault();
                pickFromEvent(event.target);
              }
            }
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <div className={s.bar}>
          {layout.phases.map(({ phase, x0, index }) => {
            const pal = PALETTES[variant];
            const state = planStatus === "draft" ? [pal.mu, "prevista"] : phase.status === "completed" ? [pal.good, "completada"] : phase.status === "active" ? [pal.acc, "en curso"] : [pal.mu, "bloqueada"];
            return (
              <button
                key={phase.id}
                type="button"
                className={s.phaseBtn}
                onClick={() => {
                  mapRef.current?.scrollTo({ left: Math.max(0, x0 - 10), behavior: "smooth" });
                  const first = stops.find((stop) => stop.phase.id === phase.id && stop.state !== "done") ?? stops.find((stop) => stop.phase.id === phase.id);
                  if (first) setSelectedId(first.milestone.id);
                }}
              >
                <i style={{ background: state[0] }} />
                Fase {index + 1} · {phase.name} {planStatus === "draft" ? null : <small>{state[1]}</small>}
              </button>
            );
          })}
          <span className={s.mapHint}>Selecciona un hito para ver su recorrido de tareas</span>
          <div className={s.styleSeg} role="group" aria-label="Estilo del mapa">
            <button type="button" aria-pressed={!adventure} onClick={() => chooseStyle(false)}>
              Formal
            </button>
            <button type="button" aria-pressed={adventure} onClick={() => chooseStyle(true)}>
              Aventura
            </button>
          </div>
        </div>
      </section>

      {selected ? (
        <MilestonePanel
          stop={selected}
          objectives={objectives.filter((objective) => objective.milestone_id === selected.milestone.id)}
          formatObjective={formatObjective}
          today={today}
          canResolveTasks={canResolveTasks}
          sourceLabels={sourceLabels}
          onToggleTask={onToggleTask}
          variant={variant}
          extra={renderMilestoneExtra?.(selected.milestone.id)}
          onDiscuss={onDiscuss}
          onGenerateMarketingTask={onGenerateMarketingTask}
          generatingTaskId={generatingTaskId}
          marketingAssetsByTask={marketingAssetsByTask}
          draft={planStatus === "draft"}
        />
      ) : null}

      {review?.output ? (
        <WeeklyReview review={review} formatGoal={formatGoal} renderChangeDecision={renderChangeDecision} onApproveLearning={onApproveLearning} baseline={baseline} target={target} />
      ) : null}
      {planTasks.some((task) => task.plan_meta?.track) ? (
        <div className={`${s.level} ${s.levelFull}`}>
          <div className={s.panel}>
            <GrowthCycle tasks={planTasks} />
          </div>
        </div>
      ) : null}
      {goal?.monthly_targets?.length ? (
        <div className={`${s.level} ${s.levelFull}`}>
          <div className={s.panel}>
            <MonthlyRoute
              headingLevel={2}
              targets={goal.monthly_targets}
              baseline={goal.baseline}
              format={formatGoal}
              startDate={startsOn ?? today.toISOString().slice(0, 10)}
              milestones={stops.map((stop) => ({ name: stop.milestone.name, date: stop.milestone.target_date }))}
              goalTarget={goal.target}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MilestonePanel({ stop, objectives, formatObjective, today, canResolveTasks, sourceLabels, onToggleTask, variant, extra, onDiscuss, onGenerateMarketingTask, generatingTaskId, marketingAssetsByTask, draft }: {
  draft: boolean;
  onDiscuss?: (topic: DiscussTopic) => void;
  onGenerateMarketingTask?: (task: MapTask) => void;
  generatingTaskId?: string | null;
  marketingAssetsByTask: Map<string, CaminoMarketingAsset>;
  stop: Stop;
  variant: MapVariant;
  extra?: ReactNode;
  objectives: MapObjective[];
  formatObjective: (value: number, unit: MapUnit) => string;
  today: Date;
  canResolveTasks: boolean;
  sourceLabels: Record<string, string>;
  onToggleTask: (task: MapTask) => void;
}) {
  const { milestone, phase, code, state } = stop;
  const { text, criterion: descriptionCriterion } = splitCriterion(milestone.description);
  // La columna manda; el texto pegado a la descripcion es para los caminos creados antes.
  const criterion = milestone.success_criteria?.trim() || descriptionCriterion;
  const tasks = milestone.milestone_task_links.map((link) => link.tasks).filter(Boolean) as MapTask[];
  const done = tasks.filter((task) => task.status === "completed").length;
  const linkedAssets = tasks.flatMap((task) => {
    const asset = marketingAssetsByTask.get(task.id);
    return asset ? [asset] : [];
  });
  const days = milestone.target_date ? daysUntil(milestone.target_date, today) : null;
  const chip =
    draft
      ? ["", milestone.target_date ? `Previsto para el ${shortDate(milestone.target_date)}` : "Previsto"]
      : state === "done"
      ? [s.chipGood, milestone.completed_at ? `Completado el ${shortDate(milestone.completed_at)}` : "Completado"]
      : state === "locked"
        ? ["", milestone.target_date ? `Bloqueado · previsto para el ${shortDate(milestone.target_date)}` : "Bloqueado"]
        : days !== null && days < 0
          ? [s.chipBad, `Va tarde · vencía el ${shortDate(milestone.target_date!)}`]
          : [state === "current" ? s.chipAcc : "", milestone.target_date ? `${state === "current" ? "En curso" : "Siguiente"} · vence el ${shortDate(milestone.target_date)}` : state === "current" ? "En curso" : "Siguiente"];
  const canTick = canResolveTasks && !draft && (state === "current" || state === "pending");

  return (
    <section className={`${s.panel} ${s.sheet}`} aria-labelledby={`camino-hito-title-${milestone.id}`}>
      {/* Anuncia solo el cambio de hito; con aria-live en toda la ficha el lector leía cientos de palabras. */}
      <p className="sr-only" role="status">
        Hito {code} seleccionado: {milestone.name}
      </p>
      <div className={s.lvTop}>
        <span className={s.lvCode}>
          Hito {code} · Fase {code.split(".")[0]} «{phase.name}»
        </span>
        <span className={`${s.chip} ${chip[0]}`}>{chip[1]}</span>
      </div>
      <h2 id={`camino-hito-title-${milestone.id}`} className={s.lvTitle}>{milestone.name}</h2>
      {text ? <p className={s.lvDesc}>{text}</p> : null}
      <div className={s.sheetGrid}>
        <div className={s.col}>
          {milestone.rationale?.trim() ? (
            <div className={s.criterion}>
              <span className={s.lbl}>Por qué ahora</span>
              <p>{milestone.rationale}</p>
            </div>
          ) : null}
          {criterion || objectives.length ? (
            <div className={s.criterion}>
              <span className={s.lbl}>Cómo sabremos que está hecho</span>
              {criterion ? <p>{criterion}</p> : null}
              {objectives.map((objective) => {
                const reached = objective.status === "cumplido";
                return (
                  <div key={objective.id} className={s.meter}>
                    <div className={s.meterTop}>
                      <span className={`${s.meterBig} ${s.num}`}>
                        {objective.actual_value !== null ? formatObjective(objective.actual_value, objective.unit) : "—"}{" "}
                        <small>
                          meta {objective.direction === "down" ? "≤" : "≥"} {formatObjective(objective.target_value, objective.unit)}
                        </small>
                      </span>
                      <span className={`${s.chip} ${reached ? s.chipGood : s.chipAcc}`}>
                        {objective.progress_pct === null ? "Sin datos aún" : reached ? "Meta alcanzada" : `${Math.round(objective.progress_pct)} % de la meta`}
                      </span>
                    </div>
                    {objective.progress_pct !== null ? (
                      <div className={s.meterTrack} role="img" aria-label={`${objective.label}: ${Math.round(objective.progress_pct)} % de la meta`}>
                        <i className={reached ? s.meterDone : ""} style={{ width: `${Math.min(100, objective.progress_pct)}%` }} />
                      </div>
                    ) : null}
                    <span className={s.sub}>
                      {objective.label} · {objective.source === "manual" ? "valor manual" : `${objective.source === "meta" ? "Meta Ads" : "Shopify"} · últimos 30 días`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className={s.col}>
          <div className={s.sech}>
            <h3>Tareas</h3>
            <span className={`${s.sub} ${s.num}`}>
              {done} de {tasks.length} hechas
            </span>
          </div>
          {linkedAssets.length ? (
            <p className={s.sub}>
              Marketing vinculado: {linkedAssets.length} · {linkedAssets.map(marketingAssetStatusLabel).join(", ")}
            </p>
          ) : null}
          {tasks.length ? (
            <ul className={s.tasks}>
              {tasks.map((task) => {
                const isDone = task.status === "completed";
                const late = !isDone && OPEN_TASK.includes(task.status) && task.due_at !== null && Date.parse(task.due_at) < today.getTime();
                const marketingAsset = marketingAssetsByTask.get(task.id) ?? null;
                return (
                  <li key={task.id} className={`${s.task} ${isDone ? s.taskDone : ""}`}>
                    <input
                      type="checkbox"
                      id={`camino-task-${task.id}`}
                      checked={isDone}
                      disabled={!canTick || !["pending", "in_progress", "completed"].includes(task.status)}
                      onChange={() => onToggleTask(task)}
                    />
                    <label htmlFor={`camino-task-${task.id}`}>
                      <span className={s.taskT}>{task.title}</span>
                      <span className={s.taskM}>
                        {/* En el Camino todas las tareas son «Mi Camino»; el origen solo se dice si es otro. */}
                        {task.source !== "strategic_plan" ? <span>{sourceLabels[task.source] ?? displayValue(task.source)}</span> : null}
                        {metaOwnerLabel(task.plan_meta, variant === "client") ? (
                          <span>{metaOwnerLabel(task.plan_meta, variant === "client")}</span>
                        ) : task.created_by_origin ? (
                          <span>{task.created_by_origin === "consultant" ? "Consultor" : variant === "consultant" ? "Cliente" : "Tú"}</span>
                        ) : null}
                        {trackLabel(task.plan_meta?.track) ? <span>{[trackLabel(task.plan_meta?.track), cadenceLabel(task.plan_meta?.cadence)].filter(Boolean).join(" · ")}</span> : null}
                        {formatEffort(task.plan_meta?.effort_hours) ? <span>{formatEffort(task.plan_meta?.effort_hours)}</span> : null}
                        {task.priority === "urgent" || task.priority === "high" ? <span className={task.priority === "urgent" ? s.late : s.prio}>{task.priority === "urgent" ? "Urgente" : "Prioridad alta"}</span> : null}
                      </span>
                    </label>
                    <span className={`${s.due} ${late ? s.late : ""}`}>{task.due_at ? shortDate(task.due_at) : ""}</span>
                    {task.description?.trim() || task.plan_meta?.definition_of_done || task.plan_meta?.rationale || task.plan_meta?.evidence?.length ? (
                      <details className={s.how}>
                        <summary>Cómo hacerlo</summary>
                        {task.description?.trim() ? <p>{task.description}</p> : null}
                        {task.plan_meta?.definition_of_done ? <p><b>Se da por hecha cuando:</b> {task.plan_meta.definition_of_done}</p> : null}
                        {task.plan_meta?.rationale ? <p><b>Por qué:</b> {task.plan_meta.rationale}</p> : null}
                        {task.plan_meta?.evidence?.length ? (
                          <span className={s.evidence}>
                            {task.plan_meta.evidence.map((item, index) => (
                              <span key={index} className={s.evidenceChip}>
                                {item.label}: {item.value}{item.period ? ` · ${item.period}` : ""}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </details>
                    ) : null}
                    {marketingAsset ? (
                      <>
                        <span className={s.taskAssetStatus}>Marketing · {marketingAssetStatusLabel(marketingAsset)}</span>
                        <a className={s.taskAction} href={marketingAssetHref(marketingAsset.id)}>Abrir borrador</a>
                      </>
                    ) : onGenerateMarketingTask && taskWantsEmailDraft(task) ? (
                      <button
                        type="button"
                        className={s.taskAction}
                        disabled={generatingTaskId === task.id}
                        onClick={() => onGenerateMarketingTask(task)}
                        aria-label={`Crear borrador de email para: ${task.title}`}
                      >
                        {generatingTaskId === task.id ? "Preparando borrador…" : "Crear borrador de email"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={s.empty}>Sin tareas.</p>
          )}
        </div>
      </div>
      <div className={s.discussion}>
        <strong>{variant === "consultant" ? "Hablar de este hito con el cliente" : "¿Lo revisas con tu consultor?"}</strong>
        {onDiscuss ? (
          <button
            type="button"
            className={s.btn}
            onClick={() => onDiscuss({ code, name: milestone.name, targetDate: milestone.target_date, doneTasks: done, totalTasks: tasks.length, late: days !== null && days < 0 && state !== "done" })}
          >
            Escribir sobre este hito
          </button>
        ) : (
          <a className={s.btn} href="/mensajes">Abrir Comunicación</a>
        )}
      </div>
      {extra}
    </section>
  );
}

function WeeklyReview({ review, formatGoal, renderChangeDecision, onApproveLearning, baseline, target }: {
  review: MapReview;
  formatGoal: (value: number) => string;
  renderChangeDecision?: (index: number) => ReactNode;
  onApproveLearning?: (reviewId: string, learningIndex: number) => Promise<void>;
  baseline: number | null;
  target: number | null;
}) {
  const [approvedLearningIndexes, setApprovedLearningIndexes] = useState<Set<number>>(() => new Set());
  const [approvingLearningIndex, setApprovingLearningIndex] = useState<number | null>(null);
  const output = review.output!;
  const observed = output.goal_progress.observed_value;
  return (
    <section className={s.level} aria-label="Esta semana en tu camino">
      <div className={s.panel}>
        <span className={s.lbl}>
          Revisión de la IA · {shortDate(review.period_start)} – {shortDate(review.period_end)}
        </span>
        <h2 className={s.lvTitle}>Esta semana en tu camino</h2>
        <p className={s.summary}>
          <span className={s.ia}>A19</span>
          {output.executive_summary}
        </p>
        {observed !== null && target !== null ? (
          <div className={s.pace}>
            <div>
              <b>{baseline !== null ? formatGoal(baseline) : "—"}</b>
              <span>Punto de partida</span>
            </div>
            <div>
              <b>{formatGoal(observed)}</b>
              <span>Medido ahora</span>
            </div>
            <div>
              <b>{formatGoal(target)}</b>
              <span>Meta</span>
            </div>
          </div>
        ) : null}
        {output.progress?.length ? (
          <div className={s.reviewSignals}>
            <div className={s.sech}>
              <h3>Señales de avance</h3>
              <span className={s.sub}>Lo observado esta semana</span>
            </div>
            <ul className={s.signalList}>
              {output.progress.map((item, index) => (
                <li key={`${review.id}-progress-${index}`}>
                  <strong>{item.item}</strong>
                  <span>{displayValue(item.status)} · {item.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {output.risks?.length ? (
          <div className={s.risks}>
            <div className={s.sech}>
              <h3>Ayudas y obstáculos</h3>
              <span className={s.sub}>Detectados en esta revisión</span>
            </div>
            <ul className={s.signalList}>
              {output.risks.map((risk, index) => (
                <li key={`${review.id}-risk-${index}`}>
                  <strong>
                    <span className={`${s.riskDot} ${risk.severity === "high" ? s.riskHigh : risk.severity === "medium" ? s.riskMedium : ""}`} aria-hidden="true" />
                    {risk.detail}
                  </strong>
                  <span>{risk.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {output.learnings?.length ? (
          <div className={s.reviewSignals}>
            <div className={s.sech}>
              <h3>Aprendizajes de esta revisión</h3>
              <span className={s.sub}>Guardados en el historial fechado del Camino; confirma el alcance antes de reutilizarlos</span>
            </div>
            <ul className={s.signalList}>
              {output.learnings.map((learning, index) => (
                <li key={`${review.id}-learning-${index}`}>
                  <strong>{learning.title}</strong>
                  <span>{learning.learning}</span>
                  <span>Aplica a: {learning.applies_to} · Confianza {displayValue(learning.confidence)}</span>
                  <span>Evidencia: {learning.evidence}</span>
                  {onApproveLearning ? (
                    <button
                      type="button"
                      className={s.taskAction}
                      disabled={approvingLearningIndex !== null || approvedLearningIndexes.has(index)}
                      onClick={async () => {
                        setApprovingLearningIndex(index);
                        try {
                          await onApproveLearning(review.id, index);
                          setApprovedLearningIndexes((current) => new Set(current).add(index));
                          toast.success("Aprendizaje guardado en el Conocimiento de esta tienda.");
                        } catch (error) {
                          toast.danger(error instanceof Error ? error.message : "No se pudo guardar el aprendizaje.");
                        } finally {
                          setApprovingLearningIndex(null);
                        }
                      }}
                    >
                      {approvedLearningIndexes.has(index) ? "Guardado en Conocimiento" : approvingLearningIndex === index ? "Guardando…" : "Guardar en Conocimiento"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {output.warnings?.length ? (
          <p className={s.reviewWarnings}>Límites de esta revisión: {output.warnings.join(" · ")}</p>
        ) : null}
        {output.change_proposals.length ? (
          <div className={s.change}>
            <span className={s.lbl}>Propuesta de cambio en el camino</span>
            {output.change_proposals.map((change, index) => (
              <div key={index}>
                <p>
                  <strong>{change.description}</strong>
                </p>
                <p>{change.reason}</p>
                {renderChangeDecision?.(index)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className={s.panel}>
        <div className={s.sech}>
          <h3>Lo siguiente</h3>
          <span className={s.sub}>Según esta revisión</span>
        </div>
        {output.next_actions.length ? (
          <ul className={s.next}>
            {output.next_actions.map((action, index) => (
              <li key={index}>
                <strong>{action.title}</strong>
                <span className={s.chip}>
                  {displayValue(action.owner)} · {action.due_in_days} {action.due_in_days === 1 ? "día" : "días"}
                </span>
                <p>{action.rationale}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>La revisión no propone acciones nuevas esta semana.</p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Borrador: el camino dibujado mientras se crea (IA, plantilla o a mano)
// ---------------------------------------------------------------------------

export type DraftPhase = {
  name: string;
  note?: string | null;
  milestones: Array<{
    name: string;
    date?: string | null;
    detail?: string | null;
    criterion?: string | null;
    tasks?: Array<{ title: string; description?: string | null; date?: string | null; priority?: string | null }>;
  }>;
};

/**
 * El mismo mapa que verá el cliente, pintado con lo que hay en el borrador.
 * Todo va como "siguiente" (nada está hecho todavía) y el último tramo acaba
 * en la meta si la hay. Pulsar un hito enseña su ficha debajo.
 */
export function CaminoDraftMap({ phases: draft, finalLabel, variant = "client" }: { phases: DraftPhase[]; finalLabel?: string | null; variant?: MapVariant }) {
  const [adventure, setAdventure] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(STYLE_KEY) === "aventura";
    } catch {
      return false;
    }
  });
  const phases = useMemo<MapPhase[]>(
    () =>
      draft
        .filter((phase) => phase.name.trim())
        .map((phase, pi) => ({
          id: `draft-${pi}`,
          name: phase.name.trim(),
          position: pi,
          status: "active",
          strategic_plan_milestones: phase.milestones
            .filter((milestone) => milestone.name.trim())
            .map((milestone, mi) => ({
              id: `draft-${pi}-${mi}`,
              name: milestone.name.trim(),
              description: milestone.detail ?? null,
              position: mi,
              status: "pending",
              target_date: milestone.date ?? null,
              completed_at: null,
              milestone_task_links: (milestone.tasks ?? []).map((task, ti) => ({
                tasks: {
                  id: `draft-${pi}-${mi}-${ti}`,
                  title: task.title,
                  status: "pending",
                  due_at: task.date ?? null,
                  source: "strategic_plan",
                  description: task.description ?? null,
                  priority: task.priority ?? null,
                },
              })),
            })),
        })),
    [draft],
  );
  const stops = useMemo<Stop[]>(
    () =>
      phases.flatMap((phase, pi) =>
        phase.strategic_plan_milestones.map((milestone, mi) => ({ milestone, phase, code: `${pi + 1}.${mi + 1}`, state: "pending" as const })),
      ),
    [phases],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = stops.find((stop) => stop.milestone.id === selectedId) ?? null;
  const layout = useMemo(() => buildLayout(phases, stops), [phases, stops]);
  const svg = useMemo(
    () => renderSvg(layout, selected?.milestone.id ?? null, adventure, finalLabel ?? null, phases.length, variant),
    [layout, selected, adventure, finalLabel, phases.length, variant],
  );

  if (!phases.length) {
    return (
      <div className={s.root}>
        <div className={`${s.hero} ${s.draftEmpty}`}>
          <p>Ponle nombre a la primera fase y el mapa empieza a dibujarse aquí.</p>
        </div>
      </div>
    );
  }

  const draftFor = (stop: Stop) => draft.filter((phase) => phase.name.trim())[Number(stop.code.split(".")[0]) - 1]?.milestones.filter((m) => m.name.trim())[Number(stop.code.split(".")[1]) - 1];
  const selectedDraft = selected ? draftFor(selected) : null;
  const draftTaskCount = draft.reduce(
    (count, phase) => count + phase.milestones.reduce((sum, milestone) => sum + (milestone.tasks?.length ?? 0), 0),
    0,
  );

  return (
    <div className={`${s.root} ${variant === "consultant" ? s.consultant : ""}`}>
      <section className={s.hero} aria-label="Vista previa del camino">
        <div
          className={s.map}
          aria-label={`Vista previa: ${phases.length} fases, ${stops.length} hitos y ${draftTaskCount} tareas. Pulsa un hito para ver su ficha.`}
          onClick={(event) => {
            const node = (event.target as Element | null)?.closest?.("[data-milestone]");
            if (node) setSelectedId(node.getAttribute("data-milestone"));
          }}
          onKeyDown={(event) => {
            const node = (event.target as Element).closest?.("[data-milestone]");
            if (node && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              setSelectedId(node.getAttribute("data-milestone"));
            }
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className={s.bar}>
          <span className={s.draftCount}>
            {phases.length} {phases.length === 1 ? "fase" : "fases"} · {stops.length} {stops.length === 1 ? "hito" : "hitos"} · {draftTaskCount} tareas
          </span>
          <span className={s.mapHint}>Selecciona un hito para ver sus tareas</span>
          <div className={s.styleSeg} role="group" aria-label="Estilo del mapa">
            <button type="button" aria-pressed={!adventure} onClick={() => setAdventure(false)}>
              Formal
            </button>
            <button type="button" aria-pressed={adventure} onClick={() => setAdventure(true)}>
              Aventura
            </button>
          </div>
        </div>
      </section>
      {selected ? (
        <div className={s.panel}>
          <div className={s.lvTop}>
            <span className={s.lvCode}>
              Hito {selected.code} · Fase «{selected.phase.name}»
            </span>
            {selected.milestone.target_date ? <span className={s.chip}>Para el {shortDate(selected.milestone.target_date)}</span> : null}
          </div>
          <h3 className={s.draftTitle}>{selected.milestone.name}</h3>
          {selectedDraft?.detail ? <p className={s.lvDesc}>{selectedDraft.detail}</p> : null}
          {selectedDraft?.criterion ? (
            <div className={s.criterion}>
              <span className={s.lbl}>Cómo sabremos que está hecho</span>
              <p>{selectedDraft.criterion}</p>
            </div>
          ) : null}
          {selectedDraft?.tasks?.length ? (
            <section className={s.draftTaskSection} aria-label={`Tareas del hito ${selected.milestone.name}`}>
              <div className={s.draftTaskHeader}>
                <h4>Recorrido de tareas</h4>
                <span>{selectedDraft.tasks.length} {selectedDraft.tasks.length === 1 ? "tarea" : "tareas"}</span>
              </div>
              <TaskTrail tasks={selected.milestone.milestone_task_links.map((link) => link.tasks).filter((task): task is MapTask => task !== null)} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const DRAWING_STEPS = [
  "Leyendo las ventas de los últimos meses",
  "Mirando margen, descuentos y devoluciones",
  "Revisando stock y productos que más venden",
  "Comparando la adquisición de pago",
  "Trazando fases e hitos con fecha",
];

/** Mientras la IA piensa: el camino se va dibujando parada a parada. */
export function CaminoDrawing({ variant = "client", stage }: { variant?: MapVariant; stage?: string } = {}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((current) => Math.min(current + 1, DRAWING_STEPS.length - 1)), 3200);
    return () => window.clearInterval(id);
  }, []);
  const nodes = [
    [70, 110], [170, 60], [270, 112], [370, 64], [470, 108], [570, 58], [670, 104],
  ];
  const path = nodes.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <div className={`${s.root} ${variant === "consultant" ? s.consultant : ""}`}>
      <section className={`${s.hero} ${s.drawing}`} aria-live="polite" aria-label="La IA está trazando el camino">
        <svg viewBox="0 0 740 160" role="presentation" className={s.drawingSvg}>
          <path d={path} className={s.drawingPath} fill="none" stroke={PALETTES[variant].acc} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
          {nodes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="13" className={s.drawingNode} style={{ animationDelay: `${i * 0.45}s` }} />
          ))}
          <rect x="700" y="84" width="26" height="26" rx="6" transform="rotate(45 713 97)" className={s.drawingNode} style={{ animationDelay: "3.2s" }} fill={PALETTES[variant].acc} />
        </svg>
        <div className={s.drawingText}>
          <span className={s.drawingStep}>{stage ?? DRAWING_STEPS[step]}…</span>
          <span>Puede tardar un par de minutos. Nada se crea hasta que lo apruebes.</span>
        </div>
      </section>
    </div>
  );
}
