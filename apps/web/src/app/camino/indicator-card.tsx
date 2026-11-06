"use client";
import { SparklesIcon, TargetIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  Badge,
  Button,
  ButtonLink,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  IconChevronDown,
  Input,
  Progress,
  Select,
} from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import { ActionMenu } from "./camino-consultant";
import { INDICATOR_STATE, accumulates, indicatorGap, indicatorState, type IndicatorObjective, type IndicatorState } from "./camino-desk-model";
import { MeasurementDetails, type MeasurementInfo } from "./measurement-details";
import i from "./camino-indicators.module.css";

export type IndicatorCardObjective = Omit<IndicatorObjective, "measurement"> & {
  id: string;
  label: string;
  milestone_id: string | null;
  measurement?: MeasurementInfo;
};

type ObjectiveHistory = {
  changes: Array<{ id: string; action: string; previous_value: number | null; new_value: number | null; reason: string | null; actor_role: string; created_at: string }>;
  months: Array<{ month: string; value: number | null; in_progress: boolean }>;
};

type Panel = "actual" | "target" | "history" | "link" | null;

const ACTOR: Record<string, string> = { consultant: "Consultor", client: "Cliente" };
const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
const monthName = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric", timeZone: "UTC" });

/** Distancia al objetivo en su unidad: los porcentajes, en puntos porcentuales. */
function gapText(objective: IndicatorCardObjective, format: (value: number) => string) {
  const gap = indicatorGap(objective);
  if (gap === null || gap === 0) return null;
  const sign = gap > 0 ? "+" : "−";
  if (objective.unit === "pct") return `${sign}${Math.abs(gap).toLocaleString("es-ES", { maximumFractionDigits: Math.abs(gap) < 0.1 ? 2 : 1 })} pp respecto al objetivo`;
  return `${sign}${format(Math.abs(gap))} respecto al objetivo`;
}

function History({ organizationId, objective, format }: { organizationId: string; objective: IndicatorCardObjective; format: (value: number) => string }) {
  const history = useCachedQuery<ObjectiveHistory>(`/v1/organizations/${organizationId}/objectives/${objective.id}/history`);
  if (history.error) return <p className={i.reason}>No se pudo cargar el histórico.</p>;
  if (!history.data) return <p className={i.reason}>Cargando el histórico…</p>;
  const { months, changes } = history.data;
  return (
    <div className={i.history}>
      {months.length ? (
        <>
          <b>Medido por mes</b>
          <ul>
            {months.map((row) => (
              <li key={row.month}>
                <span>
                  {monthName.format(new Date(`${row.month}-01T00:00:00Z`))}
                  {row.in_progress ? " (en curso)" : ""}
                </span>
                <span>{row.value !== null ? format(row.value) : "Sin datos fiables"}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <b>Cambios del objetivo</b>
      {changes.length ? (
        <ul>
          {changes.map((change) => (
            <li key={change.id}>
              <span>
                {dayMonth.format(new Date(change.created_at)).replace(".", "")} · {ACTOR[change.actor_role] ?? "Persona"}
                {change.reason ? ` · ${change.reason}` : ""}
              </span>
              <span>
                {change.previous_value !== null ? `${format(change.previous_value)} → ` : ""}
                {change.new_value !== null ? format(change.new_value) : "Quitado"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={i.reason}>Este objetivo no se ha cambiado desde que se creó.</p>
      )}
    </div>
  );
}

export function IndicatorCard({
  objective,
  format,
  rate,
  milestoneLabel,
  milestones,
  organizationId,
  canManage,
  isRemoving,
  isSaving,
  onRemove,
  onSetActual,
  onSetTarget,
  onLink,
  onAsk,
}: {
  objective: IndicatorCardObjective;
  format: (value: number) => string;
  /** Tipo con el que se muestra un importe: lo tecleado se guarda en la moneda original. */
  rate: number;
  milestoneLabel: string | null;
  milestones: Array<{ id: string; label: string }>;
  organizationId: string;
  canManage: boolean;
  isRemoving: boolean;
  isSaving: boolean;
  onRemove: () => void;
  onSetActual: (value: number) => void;
  onSetTarget: (value: number) => void;
  onLink: (milestoneId: string | null) => void;
  onAsk: (question: string, focusLabel: string) => void;
}) {
  const [now] = useState(() => new Date());
  const [panel, setPanel] = useState<Panel>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const state = indicatorState(objective, now);
  const info = INDICATOR_STATE[state];
  const isManual = objective.source === "manual";
  const period = objective.measurement?.period_label?.split(" · ")[0];
  const showBar = accumulates(objective) && objective.progress_pct !== null;
  const sourceName = isManual ? "Manual" : objective.source === "meta" ? "Meta Ads" : "Shopify";
  const gap = gapText(objective, format);
  const scale = objective.unit === "money" ? rate : 1;
  const targetShown = Math.round(objective.target_value * scale * 100) / 100;

  const menu = [
    ...(canManage ? [{ id: "target", label: "Editar objetivo" }] : []),
    ...(canManage && isManual ? [{ id: "actual", label: objective.actual_value !== null ? "Editar valor actual" : "Añadir valor actual" }] : []),
    { id: "history", label: "Ver histórico" },
    ...(canManage ? [{ id: "link", label: objective.milestone_id ? "Cambiar hito vinculado" : "Vincular a un hito" }] : []),
    ...(canManage ? [{ id: "remove", label: isRemoving ? "Quitando…" : "Quitar del seguimiento", danger: true }] : []),
  ];

  function openPanel(id: string) {
    if (id === "remove") return setRemoveOpen(true);
    if (id === "target") setDraft(String(targetShown));
    if (id === "actual") setDraft(objective.actual_value !== null ? String(objective.actual_value) : "");
    if (id === "link") setDraft(objective.milestone_id ?? "");
    setPanel(id as Panel);
  }

  function saveNumber(event: FormEvent, save: (value: number) => void) {
    event.preventDefault();
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0) return;
    save(value);
    setPanel(null);
  }

  return (
    <article className={i.card}>
      <header className={i.head}>
        <h3>{objective.label}</h3>
        <ActionMenu label={`Más acciones de ${objective.label}`} items={menu} onAction={openPanel} />
      </header>
      <p className={i.value}>{objective.actual_value !== null ? format(objective.actual_value) : "—"}</p>
      <p className={i.target}>
        Objetivo: {objective.direction === "down" ? "≤ " : ""}
        {format(objective.target_value)}
      </p>
      {showBar ? <Progress value={Math.min(100, objective.progress_pct!)} aria-label={`Progreso de ${objective.label}`} /> : null}
      <div className={i.verdict}>
        <Badge tone={info.tone}>{info.label}</Badge>
        {showBar ? <span>{Math.round(objective.progress_pct!)} % alcanzado</span> : <span>{gap}</span>}
      </div>
      {state === "no_data" ? (
        <p className={i.reason}>
          {isManual ? "Falta introducir el valor actual." : (objective.measurement?.unavailable_reason ?? "Todavía no hay una medición válida.")}
          {objective.source === "meta" ? (
            <ButtonLink href="/integraciones" variant="link" size="sm">
              Revisar Meta
            </ButtonLink>
          ) : null}
        </p>
      ) : null}
      {state === "below" || state === "at_risk" ? (
        <Button
          variant="ghost"
          size="sm"
          className={i.ask}
          onClick={() =>
            onAsk(
              `${objective.label} está en ${format(objective.actual_value!)} frente a un objetivo de ${format(objective.target_value)} (${period ?? "periodo actual"}). ¿Qué lo explica? Separa lo que los datos confirman de las hipótesis y dime qué comprobar primero.`,
              objective.label,
            )
          }
        >
          <SparklesIcon aria-hidden />
          Explicar con IA
        </Button>
      ) : null}
      {panel === "actual" || panel === "target" ? (
        <form className={i.actualForm} onSubmit={(event) => saveNumber(event, panel === "actual" ? onSetActual : onSetTarget)}>
          <Field label={panel === "actual" ? "Valor actual" : "Objetivo"}>
            <Input type="number" step="0.01" min="0" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} required />
          </Field>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
            Cancelar
          </Button>
        </form>
      ) : null}
      {panel === "link" ? (
        <form
          className={i.actualForm}
          onSubmit={(event) => {
            event.preventDefault();
            onLink(draft || null);
            setPanel(null);
          }}
        >
          <Field label="Hito" hint="Al cerrar ese hito se comprobará este objetivo.">
            <Select value={draft} onChange={setDraft} options={[{ value: "", label: "Todo el plan, sin hito" }, ...milestones.map((milestone) => ({ value: milestone.id, label: milestone.label }))]} />
          </Field>
          <Button type="submit" size="sm" disabled={isSaving}>
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
            Cancelar
          </Button>
        </form>
      ) : null}
      {panel === "history" ? (
        <>
          <History organizationId={organizationId} objective={objective} format={format} />
          <Button size="sm" variant="ghost" className={i.ask} onClick={() => setPanel(null)}>
            Cerrar histórico
          </Button>
        </>
      ) : null}
      <p className={i.period}>{[period, milestoneLabel].filter(Boolean).join(" · ")}</p>
      <Collapsible className={i.more}>
        <CollapsibleTrigger>
          Detalles de medición
          <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <MeasurementDetails measurement={objective.measurement} source={sourceName} />
        </CollapsibleContent>
      </Collapsible>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger/10 text-danger">
              <TargetIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Quitar «{objective.label}» del seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>Deja de medirse en el Camino y en el panel. Sus mediciones y cambios anteriores se conservan. Se avisa a la otra parte y la IA revisa el Camino con el cambio.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onRemove}>
              Quitar del seguimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

const SUMMARY_ORDER: IndicatorState[] = ["at_risk", "below", "on_track", "reached", "stale", "no_data"];

/** Cuántos van bien y cuántos no, antes de entrar en cada tarjeta. */
export function IndicatorSummary({ objectives }: { objectives: IndicatorCardObjective[] }) {
  const [now] = useState(() => new Date());
  const states = objectives.map((objective) => indicatorState(objective, now));
  return (
    <p className={i.summary}>
      {SUMMARY_ORDER.filter((state) => states.includes(state)).map((state) => (
        <span key={state}>
          {states.filter((item) => item === state).length} {INDICATOR_STATE[state].label.toLowerCase()}
        </span>
      ))}
    </p>
  );
}
