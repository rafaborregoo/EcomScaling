"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  ErrorBlock,
  IconChevronDown,
  Input,
  LoadingBlock,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from "@/components/ui";
import { CaminoDrawing } from "./camino-map";
import { caminoFailureMessage, progressStage, type RunProgress } from "./camino-create-panel";
import {
  decisionLabels,
  DEFAULT_REPLAN_SCOPES,
  describeChange,
  KIND_LABEL,
  needsAttention,
  periodLabel,
  REPLAN_BRIEF_LIMIT,
  REPLAN_SCOPE_OPTIONS,
  replanDates,
  replanRequestSummary,
  undecided,
  validMonths,
  type ReplanChange,
  type ReplanChangeKind,
  type ReplanDecision,
} from "./camino-replan-model";
import s from "./camino-replan.module.css";

type Restriction = { metric_key: string; label: string; target_value: number; unit: string; period: string | null };
type ReplanContext = {
  plan: { id: string; name: string; version: number; status: string; horizon_months: number | null; currency_code: string | null };
  effective_start: string;
  counts: { phases: number; milestones: number; tasks: number; completed: number; open: number; manual: number };
  goal: { label: string; target: number | null; unit: string } | null;
  restrictions: Restriction[];
  costs_partial: boolean | null;
  draft: { output_id: string; generated_at: string; horizon_months: number | null; scopes: string[]; stale: boolean } | null;
};
type Counts = {
  current: { phases: number; milestones: number; tasks: number; completed: number; open: number };
  final: { phases: number; milestones: number; open_tasks: number; inherited_completed: number };
  changes: Record<ReplanChangeKind, number>;
};
type Preview = {
  plan: ReplanContext["plan"];
  proposal: { output_id: string; plan_name: string; diagnosis: string; generated_at: string; horizon_months: number | null; confidence: string; warnings: string[]; goal: { label: string; unit: string; rationale: string; assumptions: string[] } | null; scopes: string[] };
  changes: ReplanChange[];
  blockers: Array<{ code: string; message: string; change_id?: string }>;
  warnings: string[];
  route: Array<{ period: string; current: number | null; proposed: number | null; final: number | null; actual: number | null }>;
  counts: Counts;
  retire_count: number;
};
type Applied = { new_version_id: string; version: number; status: string; summary: { moved: number; created: number; retired: number }; warnings: string[] };

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
const STEPS = ["Solicitar cambios", "Revisar diferencias", "Confirmar nueva versión"];
const CHANGE_PAGE = 30;

function Steps({ current }: { current: number }) {
  return (
    <ol className={s.steps} aria-label="Pasos de la replanificación">
      {STEPS.map((step, index) => (
        <li key={step} aria-current={index === current ? "step" : undefined} className={index === current ? s.stepOn : undefined}>
          <span aria-hidden>{index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function amountFormat(currency: string | null) {
  return (value: number) => {
    try {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency ?? "EUR", maximumFractionDigits: 0, useGrouping: "always" }).format(value);
    } catch {
      return `${value} ${currency ?? ""}`.trim();
    }
  };
}

function restrictionValue(item: Restriction, money: (value: number) => string) {
  if (item.unit === "money") return money(item.target_value);
  const number = new Intl.NumberFormat("es-ES", { useGrouping: "always" }).format(item.target_value);
  return item.unit === "pct" ? `${number} %` : number;
}

export function CaminoReplan({
  organizationId,
  connectionId,
  planId,
  variant,
  onApplied,
  reviewDraft = false,
}: {
  /** Viene del aviso de Mi Camino: abre directamente la propuesta. */
  reviewDraft?: boolean;
  organizationId: string;
  connectionId?: string | null;
  planId: string;
  variant: "client" | "consultant";
  onApplied: () => void;
}) {
  const base = `/v1/organizations/${organizationId}/strategic-plan/${planId}/replan`;
  const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
  const [context, setContext] = useState<ReplanContext | null>(null);
  const [step, setStep] = useState(0);
  const [scopes, setScopes] = useState<string[]>(DEFAULT_REPLAN_SCOPES);
  const [months, setMonths] = useState(6);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runSince, setRunSince] = useState<number | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ReplanDecision>>({});
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<Applied | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  const loadContext = useCallback(async () => {
    const response = await apiFetch(base);
    if (!response.ok) throw new Error(await readApiError(response));
    const data = (await response.json()) as ReplanContext;
    setContext(data);
    return data;
  }, [base]);

  const review = useCallback(
    async (outputId: string, chosen: Record<string, ReplanDecision>) => {
      const response = await apiFetch(`${base}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output_id: outputId, decisions: chosen }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = (await response.json()) as Preview;
      setPreview(data);
      return data;
    },
    [base],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await loadContext();
        if (cancelled) return;
        setMonths(data.draft?.horizon_months ?? data.plan.horizon_months ?? 6);
        if (data.draft?.scopes.length) setScopes(data.draft.scopes);
        if (reviewDraft && data.draft && !data.draft.stale) {
          await review(data.draft.output_id, {});
          if (!cancelled) setStep(1);
        }
        const running = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/progress${query}`).catch(() => null);
        const state = running?.ok ? ((await running.json()) as RunProgress) : null;
        if (!cancelled && state?.state === "running" && state.started_at) {
          setProgress(state);
          setRunSince(state.started_at);
        }
        setError(null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo preparar la replanificación.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadContext, organizationId, query, review, reviewDraft]);

  useEffect(() => {
    if (runSince === null) return;
    let cancelled = false;
    const params = new URLSearchParams({ since: String(runSince) });
    if (connectionId) params.set("connectionId", connectionId);
    const poll = async () => {
      try {
        const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/progress?${params.toString()}`);
        if (cancelled || !response.ok) return;
        const next = (await response.json()) as RunProgress;
        if (cancelled) return;
        setProgress(next);
        if (next.state === "done") {
          setRunSince(null);
          const data = await loadContext();
          if (!data.draft || data.draft.stale) {
            setError("La propuesta se generó, pero el Camino cambió entretanto. Vuelve a generarla.");
            return;
          }
          setDecisions({});
          await review(data.draft.output_id, {});
          setStep(1);
        } else if (next.state === "failed") {
          setRunSince(null);
          setError(caminoFailureMessage(next.failure));
        } else if (next.state === "idle" && Date.now() - runSince > 30_000) {
          setRunSince(null);
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
  }, [runSince, organizationId, connectionId, loadContext, review]);

  const dates = useMemo(() => (context && validMonths(months) ? replanDates(context.effective_start, months) : null), [context, months]);
  const money = useMemo(() => amountFormat(context?.plan.currency_code ?? null), [context]);
  const canGenerate = scopes.length > 0 && validMonths(months) && brief.length <= REPLAN_BRIEF_LIMIT && runSince === null && !busy;

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/run${query ? `${query}&async=1` : "?async=1"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon_months: months, ...(brief.trim() ? { brief: brief.trim() } : {}), replan: { plan_id: planId, scopes } }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const started = (await response.json()) as { started_at: number };
      setProgress(null);
      setRunSince(started.started_at);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar la propuesta. Reintenta.");
    } finally {
      setBusy(false);
    }
  }

  async function openDraft(outputId: string) {
    setBusy(true);
    setError(null);
    try {
      setDecisions({});
      await review(outputId, {});
      setStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir la propuesta.");
    } finally {
      setBusy(false);
    }
  }

  async function toConfirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await review(preview.proposal.output_id, decisions);
      setStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo revisar la propuesta.");
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (!preview) return;
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/camino-proposal/${preview.proposal.output_id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setPreview(null);
      setStep(0);
      await loadContext();
      toast.success("Propuesta descartada. Tu Camino sigue igual.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descartar la propuesta.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`${base}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output_id: preview.proposal.output_id, decisions }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        await review(preview.proposal.output_id, decisions).catch(() => null);
        return;
      }
      setApplied((await response.json()) as Applied);
      setStep(3);
      onApplied();
    } catch {
      setError("No se pudo aplicar. Tu Camino sigue igual: comprueba la conexión y reintenta.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Preparando la replanificación..." />;
  if (!context) return <ErrorBlock>{error ?? "No se pudo preparar la replanificación."}</ErrorBlock>;

  const header = (
    <header className={s.head}>
      <h2>{step === 3 ? "Tu Camino se ha actualizado" : "Replanificar mi Camino"}</h2>
      {step === 3 ? null : <p>Ajusta tu estrategia con IA sin perder el trabajo realizado.</p>}
      <span className={s.muted}>
        {context.plan.name} · Versión {applied?.version ?? context.plan.version}
      </span>
    </header>
  );

  if (runSince !== null) {
    return (
      <div className={s.flow}>
        {header}
        <Steps current={0} />
        <CaminoDrawing variant={variant} stage={progressStage(progress)} />
        <p className={s.muted}>Tu Camino sigue activo mientras tanto: esto solo prepara un borrador.</p>
      </div>
    );
  }

  if (step === 3 && applied) {
    return (
      <div className={s.flow}>
        {header}
        <Alert>
          <AlertTitle>Versión {applied.version} {applied.status === "active" ? "activa" : "en borrador"}</AlertTitle>
          <AlertDescription>
            {applied.summary.moved} tareas conservadas, {applied.summary.created} nuevas y {applied.summary.retired} retiradas. La versión anterior queda en el historial.
          </AlertDescription>
        </Alert>
        {applied.warnings.length ? (
          <ul className={s.plainList}>
            {applied.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ) : null}
        <div className={s.actions}>
          <ButtonLink href="/camino">Ver la Hoja de ruta</ButtonLink>
          <Button type="button" variant="secondary" onClick={() => setShowChanges(true)}>Resumen de cambios</Button>
          <ButtonLink href="/camino?vista=estructura" variant="secondary">Historial de versiones</ButtonLink>
        </div>
        {showChanges ? <PlanVersionDrawer organizationId={organizationId} planId={applied.new_version_id} onClose={() => setShowChanges(false)} /> : null}
      </div>
    );
  }

  if (step === 2 && preview) {
    const final = preview.counts.final;
    const pick = (kind: ReplanChangeKind) => preview.changes.filter((change) => change.kind === kind && change.decision === "accept").length;
    const goals = preview.changes.filter((change) => (change.entity === "goal" || change.entity === "month") && change.decision === "accept");
    const resolved = preview.changes.filter((change) => change.kind === "conflict").length;
    const facts: Array<[string, string]> = [
      ["Camino", preview.plan.name],
      ["Versión", `${preview.plan.version} → ${preview.plan.version + 1}`],
      ["Duración", preview.proposal.horizon_months ? `${preview.proposal.horizon_months} meses` : "Sin definir"],
      ["Objetivos modificados", goals.length ? goals.map((change) => change.label).join(" · ") : "Ninguno"],
      ["Tareas abiertas en la nueva versión", String(final.open_tasks)],
      ["Tareas añadidas", String(pick("added"))],
      ["Tareas y hitos reprogramados", String(pick("rescheduled"))],
      ["Tareas retiradas", `${preview.retire_count} (quedan descartadas y se pueden recuperar)`],
      ["Tareas completadas heredadas", `${final.inherited_completed} (se quedan en su versión)`],
      ["Conflictos revisados", String(resolved)],
      ["Restricciones económicas", context.restrictions.length ? context.restrictions.map((item) => `${item.label}: ${restrictionValue(item, money)}`).join(" · ") : "No hay definidas"],
    ];
    return (
      <div className={s.flow}>
        {header}
        <Steps current={2} />
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {preview.blockers.length ? (
          <ErrorBlock>
            <strong>No se puede confirmar todavía</strong>
            <ul className={s.plainList}>
              {preview.blockers.map((blocker) => <li key={`${blocker.code}-${blocker.change_id ?? blocker.message}`}>{blocker.message}</li>)}
            </ul>
          </ErrorBlock>
        ) : null}
        <section className={s.block} aria-labelledby="replan-confirm">
          <h3 id="replan-confirm">Lo que va a pasar</h3>
          <dl className={s.facts}>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className={s.muted}>
            {preview.plan.status === "active" ? "La nueva versión se activa al confirmar." : "El borrador se sustituye y sigue pendiente de activar."} La versión {preview.plan.version} se conserva en el historial.
          </p>
        </section>
        <RouteBlock route={preview.route} money={money} showFinal />
        <div className={s.actions}>
          <Button type="button" onClick={() => void apply()} disabled={busy || preview.blockers.length > 0}>
            {busy ? "Aplicando..." : "Confirmar nueva versión"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep(1)}>Volver a revisar</Button>
          {preview.blockers.some((blocker) => ["plan_changed", "proposal_expired", "invalid_reference", "currency_mismatch"].includes(blocker.code)) ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep(0)}>Generar otra propuesta</Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === 1 && preview) {
    const pending = undecided(preview.changes, decisions);
    return (
      <div className={s.flow}>
        {header}
        <Steps current={1} />
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <section className={s.block} aria-labelledby="replan-proposal">
          <div className={s.titleRow}>
            <h3 id="replan-proposal">{preview.proposal.plan_name}</h3>
            <Badge>Propuesta · no aplicada</Badge>
          </div>
          <p className={s.muted}>
            Generada el {shortDate(preview.proposal.generated_at)} desde la versión {preview.plan.version}. Tu Camino no cambia hasta que confirmes.
          </p>
          <Collapsible className={s.details}>
            <CollapsibleTrigger>Por qué propone esto<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
            <CollapsibleContent>
              <p>{preview.proposal.diagnosis}</p>
              {preview.proposal.goal?.rationale ? <p>{preview.proposal.goal.rationale}</p> : null}
              {preview.proposal.goal?.assumptions.length ? (
                <>
                  <b>Supuestos</b>
                  <ul className={s.plainList}>{preview.proposal.goal.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
                </>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        </section>
        {preview.blockers.filter((blocker) => blocker.code !== "decision_required").length ? (
          <ErrorBlock>
            <ul className={s.plainList}>
              {preview.blockers.filter((blocker) => blocker.code !== "decision_required").map((blocker) => <li key={blocker.code + blocker.message}>{blocker.message}</li>)}
            </ul>
          </ErrorBlock>
        ) : null}
        {[...preview.warnings, ...preview.proposal.warnings].length ? (
          <Collapsible className={s.details}>
            <CollapsibleTrigger>Advertencias ({preview.warnings.length + preview.proposal.warnings.length})<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
            <CollapsibleContent>
              <ul className={s.plainList}>{[...preview.warnings, ...preview.proposal.warnings].map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
        <section className={s.block} aria-labelledby="replan-compare">
          <h3 id="replan-compare">Antes y después</h3>
          <dl className={s.compare}>
            <div><dt>Fases</dt><dd>{preview.counts.current.phases} → {preview.counts.final.phases}</dd></div>
            <div><dt>Hitos</dt><dd>{preview.counts.current.milestones} → {preview.counts.final.milestones}</dd></div>
            <div><dt>Tareas abiertas</dt><dd>{preview.counts.current.open} → {preview.counts.final.open_tasks}</dd></div>
            <div><dt>Completadas</dt><dd>{preview.counts.current.completed} conservadas</dd></div>
          </dl>
        </section>
        <RouteBlock route={preview.route} money={money} />
        <ChangeList changes={preview.changes} decisions={decisions} money={money} onDecide={(id, value) => setDecisions((current) => ({ ...current, [id]: value }))} />
        <div className={s.actions}>
          <Button type="button" onClick={() => void toConfirm()} disabled={busy || pending.length > 0}>
            {busy ? "Revisando..." : pending.length ? `Faltan ${pending.length} ${pending.length === 1 ? "decisión" : "decisiones"}` : "Continuar a la confirmación"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep(0)}>Volver a la solicitud</Button>
          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="ghost" disabled={busy}>Descartar propuesta</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Descartar esta propuesta?</AlertDialogTitle>
                <AlertDialogDescription>Tu Camino sigue exactamente igual.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Seguir revisando</AlertDialogCancel>
                <AlertDialogAction onClick={() => discard()}>Descartar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  const nearLimit = brief.length > REPLAN_BRIEF_LIMIT * 0.9;
  return (
    <div className={s.flow}>
      {header}
      <Steps current={0} />
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {context.draft && !context.draft.stale ? (
        <Alert>
          <AlertTitle>Tienes una propuesta sin revisar</AlertTitle>
          <AlertDescription>Generada el {shortDate(context.draft.generated_at)}.</AlertDescription>
          <div className={s.actions}>
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void openDraft(context.draft!.output_id)}>Revisar propuesta</Button>
          </div>
        </Alert>
      ) : null}

      <section className={s.block} aria-labelledby="replan-scopes">
        <h3 id="replan-scopes">¿Qué quieres cambiar?</h3>
        <div className={s.scopes}>
          {REPLAN_SCOPE_OPTIONS.map((option) => (
            <Checkbox
              key={option.key}
              className={s.scope}
              checked={scopes.includes(option.key)}
              onCheckedChange={(checked) => setScopes((current) => (checked ? [...current, option.key] : current.filter((item) => item !== option.key)))}
            >
              <b>{option.title}</b>
              <span>{option.hint}</span>
            </Checkbox>
          ))}
        </div>
        {!scopes.length ? <p className={s.fieldError} role="alert">Elige al menos un ámbito.</p> : null}
      </section>

      <section className={s.block} aria-labelledby="replan-duration">
        <h3 id="replan-duration">Duración de la planificación</h3>
        <div className={s.duration}>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            className={s.range}
            aria-labelledby="replan-duration"
            value={validMonths(months) ? months : 1}
            onChange={(event) => setMonths(Number(event.target.value))}
          />
          <label className={s.months}>
            <Input type="number" min={1} max={12} step={1} value={Number.isNaN(months) ? "" : months} aria-label="Meses de duración" aria-invalid={!validMonths(months)} onChange={(event) => setMonths(Number.parseInt(event.target.value, 10))} />
            <span>{months === 1 ? "mes" : "meses"}</span>
          </label>
        </div>
        {dates ? (
          <dl className={s.compare}>
            <div><dt>Inicio</dt><dd>{shortDate(dates.start)}</dd></div>
            <div><dt>Último día</dt><dd>{shortDate(dates.lastDay)}</dd></div>
          </dl>
        ) : (
          <p className={s.fieldError} role="alert">La duración debe ser un número entero entre 1 y 12 meses.</p>
        )}
        {dates?.partial ? <p className={s.muted}>El primer y el último mes son parciales. Cada meta sigue en su mes natural.</p> : null}
      </section>

      <section className={s.block}>
        <label className={s.briefLabel} htmlFor="replan-brief">¿Hay algo más que debamos tener en cuenta?</label>
        <Textarea
          id="replan-brief"
          value={brief}
          maxLength={REPLAN_BRIEF_LIMIT}
          rows={3}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Ejemplo: priorizar los productos más rentables y reducir campañas que consumen demasiado presupuesto"
        />
        {nearLimit ? <p className={s.muted} aria-live="polite">{brief.length} de {REPLAN_BRIEF_LIMIT} caracteres</p> : null}
      </section>

      <section className={s.block} aria-labelledby="replan-protected">
        <h3 id="replan-protected">Lo que se protege</h3>
        <ul className={s.plainList}>
          <li><b>Las tareas completadas.</b> {context.counts.completed} tareas, sus evidencias y registros no se alteran ni se borran.</li>
          <li><b>Tus cambios manuales.</b> {context.counts.manual ? `${context.counts.manual} decisiones manuales no se tocan sin tu aprobación.` : "La IA no sobrescribirá lo que cambies a mano."}</li>
        </ul>
      </section>

      <section className={s.block} aria-labelledby="replan-economics">
        <h3 id="replan-economics">Condiciones económicas vigentes</h3>
        {context.goal?.target != null || context.restrictions.length ? (
          <dl className={s.facts}>
            {context.goal?.target != null ? (
              <div>
                <dt>Meta de {context.goal.label}</dt>
                <dd>{context.goal.unit === "money" ? money(context.goal.target) : context.goal.target}</dd>
              </div>
            ) : null}
            {context.restrictions.map((item) => (
              <div key={item.metric_key}>
                <dt>{item.label}</dt>
                <dd>{restrictionValue(item, money)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={s.muted}>Este Camino no tiene restricciones económicas definidas.</p>
        )}
        {context.costs_partial ? <p className={s.muted}>Faltan costes: el margen actual es parcial.</p> : null}
      </section>

      <section className={s.block} aria-live="polite">
        <p>{replanRequestSummary(scopes, validMonths(months) ? months : 0)}</p>
        <div className={s.actions}>
          <Button type="button" disabled={!canGenerate} onClick={() => void generate()}>
            {busy ? "Preparando..." : "Generar propuesta con IA"}
          </Button>
        </div>
      </section>
    </div>
  );
}

/** Metas por mes natural: lo vigente, lo propuesto y lo real, sin confundirlos. */
function RouteBlock({ route, money, showFinal = false }: { route: Preview["route"]; money: (value: number) => string; showFinal?: boolean }) {
  if (!route.length) return null;
  const value = (amount: number | null) => (amount === null ? "Sin dato" : money(amount));
  return (
    <section className={s.block} aria-labelledby="replan-route">
      <h3 id="replan-route">Ruta económica por mes</h3>
      <ul className={s.route}>
        {route.map((month) => {
          const changed = month.current !== null && month.proposed !== month.current;
          return (
            <li key={month.period}>
              <b>{periodLabel(month.period)}</b>
              <dl>
                <div><dt>Meta vigente</dt><dd>{value(month.current)}</dd></div>
                <div><dt>{showFinal ? "Meta final" : "Propuesta"}</dt><dd className={changed ? s.changed : undefined}>{value(showFinal ? month.final : month.proposed)}</dd></div>
                <div><dt>Resultado real</dt><dd>{value(month.actual)}</dd></div>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ChangeList({
  changes,
  decisions,
  money,
  onDecide,
}: {
  changes: ReplanChange[];
  decisions: Record<string, ReplanDecision>;
  money: (value: number) => string;
  onDecide: (id: string, value: ReplanDecision) => void;
}) {
  const attention = changes.filter(needsAttention);
  const kinds = (["added", "modified", "rescheduled", "moved", "retired", "kept"] as ReplanChangeKind[]).filter((kind) => changes.some((change) => change.kind === kind));
  const [filter, setFilter] = useState<string>(attention.length ? "attention" : (kinds[0] ?? "kept"));
  const [shown, setShown] = useState(CHANGE_PAGE);
  const rows = filter === "attention" ? attention : changes.filter((change) => change.kind === filter);
  return (
    <section className={s.block} aria-labelledby="replan-changes">
      <h3 id="replan-changes">Qué cambia</h3>
      <ToggleGroup
        aria-label="Filtrar cambios"
        spacing={2}
        size="sm"
        value={filter}
        onValueChange={(value) => {
          setFilter(String(value));
          setShown(CHANGE_PAGE);
        }}
      >
        {attention.length ? <ToggleGroupItem value="attention">Por revisar ({attention.length})</ToggleGroupItem> : null}
        {kinds.map((kind) => (
          <ToggleGroupItem key={kind} value={kind}>{KIND_LABEL[kind]} ({changes.filter((change) => change.kind === kind).length})</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ul className={s.changes}>
        {rows.slice(0, shown).map((change) => {
          const decision = decisions[change.id] ?? change.decision;
          const labels = decisionLabels(change);
          const lines = describeChange(change, money);
          const decidable = !change.locked && change.kind !== "kept";
          return (
            <li key={change.id} className={change.must_decide && !decisions[change.id] ? s.changeOpen : undefined}>
              <div className={s.changeHead}>
                <Badge>{KIND_LABEL[change.kind]}</Badge>
                <b>{change.label}</b>
              </div>
              {lines.map((line) => <p key={line} className={s.muted}>{line}</p>)}
              {change.reason ? <p className={s.reason}>{change.reason}</p> : null}
              {change.out_of_scope ? <p className={s.muted}>No lo pediste: se conserva salvo que lo aceptes.</p> : null}
              {change.locked ? <p className={s.muted}>No se puede aplicar.</p> : null}
              {decidable ? (
                <ToggleGroup aria-label={`Decisión sobre ${change.label}`} size="sm" value={change.must_decide && !decisions[change.id] ? "" : decision} onValueChange={(value) => onDecide(change.id, value as ReplanDecision)}>
                  <ToggleGroupItem value="accept">{labels.accept}</ToggleGroupItem>
                  <ToggleGroupItem value="keep">{labels.keep}</ToggleGroupItem>
                </ToggleGroup>
              ) : null}
            </li>
          );
        })}
      </ul>
      {rows.length > shown ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setShown((count) => count + CHANGE_PAGE)}>
          Ver más ({rows.length - shown})
        </Button>
      ) : null}
    </section>
  );
}

type VersionTask = { id: string; title: string; status: string; due_at: string | null };
type PlanVersion = {
  name: string;
  version: number;
  status: string;
  created_at: string;
  goal: { label: string; target: number | null; unit: string } | null;
  currency_code: string | null;
  replan_summary: {
    from_version?: number;
    changes?: Array<{ id: string; kind: ReplanChangeKind; label: string; reason: string | null; decision: ReplanDecision }>;
  } | null;
  phases: Array<{ name: string; milestones: Array<{ id: string; name: string; status: string; target_date: string | null; tasks: VersionTask[] }> }>;
};

const TASK_STATUS: Record<string, string> = { completed: "Hecha", ignored: "Descartada", cancelled: "Cancelada", pending: "Pendiente", in_progress: "En curso" };
const MILESTONE_STATUS: Record<string, string> = { completed: "Completado", skipped: "Omitido", pending: "Pendiente", in_progress: "En curso", locked: "Bloqueado" };
const VERSION_STATUS: Record<string, string> = { archived: "Archivada", active: "Activa", draft: "Borrador", completed: "Completada" };

/** Una versión del Camino para consultar: sin acciones, solo lo que fue y por qué cambió. */
export function PlanVersionDrawer({ organizationId, planId, onClose }: { organizationId: string; planId: string; onClose: () => void }) {
  const [version, setVersion] = useState<PlanVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/${planId}/version`);
        if (!response.ok) throw new Error(await readApiError(response));
        const data = (await response.json()) as PlanVersion;
        if (!cancelled) setVersion(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo abrir esta versión.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, planId]);

  const changes = (version?.replan_summary?.changes ?? []).filter((change) => change.decision === "accept");
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="sm:max-w-[40rem]">
        <DrawerHeader>
          <DrawerTitle>{version ? `Versión ${version.version} · ${version.name}` : "Versión del Camino"}</DrawerTitle>
        </DrawerHeader>
        <div className={s.version}>
          {error ? <ErrorBlock>{error}</ErrorBlock> : !version ? <LoadingBlock label="Abriendo la versión..." /> : (
            <>
              <p className={s.muted}>
                {VERSION_STATUS[version.status] ?? version.status} · creada el {shortDate(version.created_at)}
                {version.goal?.target != null ? ` · Meta de ${version.goal.label}: ${version.goal.unit === "money" ? amountFormat(version.currency_code)(version.goal.target) : version.goal.target}` : ""}
              </p>
              {version.replan_summary ? (
                <section className={s.block} aria-labelledby="version-changes">
                  <h3 id="version-changes">Qué cambió respecto a la versión {version.replan_summary.from_version}</h3>
                  {changes.length ? (
                    <ul className={s.changes}>
                      {changes.map((change) => (
                        <li key={change.id}>
                          <div className={s.changeHead}><Badge>{KIND_LABEL[change.kind]}</Badge><b>{change.label}</b></div>
                          {change.reason ? <p className={s.reason}>{change.reason}</p> : null}
                        </li>
                      ))}
                    </ul>
                  ) : <p className={s.muted}>No se aceptó ningún cambio de contenido.</p>}
                </section>
              ) : null}
              {version.phases.map((phase) => (
                <section className={s.block} key={phase.name}>
                  <h3>{phase.name}</h3>
                  {phase.milestones.map((milestone) => (
                    <div key={milestone.id} className={s.versionMilestone}>
                      <b>{milestone.name}</b>
                      <span className={s.muted}>{MILESTONE_STATUS[milestone.status] ?? milestone.status}{milestone.target_date ? ` · ${shortDate(milestone.target_date)}` : ""}</span>
                      {milestone.tasks.length ? (
                        <ul className={s.plainList}>
                          {milestone.tasks.map((task) => <li key={task.id}>{task.title} · {TASK_STATUS[task.status] ?? task.status}</li>)}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </section>
              ))}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
