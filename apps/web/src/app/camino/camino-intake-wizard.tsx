"use client";
import { DatePicker } from "@/components/ui";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Button, Checkbox, Input, LoadingBlock, Textarea } from "@/components/ui";
import { upcomingCalendarIdeas } from "./camino-calendar";
import s from "./camino-intake-wizard.module.css";

export type CaminoIntake = {
  version: 1;
  priority: string[];
  desiredOutcome: string;
  market: string;
  brandCategory: string;
  constraints: string;
  previousLearning: string;
  diagnosticAnswers: Record<string, string>;
  importantDates: Array<{
    name: string;
    date: string;
    repeatsAnnually: boolean;
    confirmed: boolean;
    note: string;
  }>;
};

const INITIAL: CaminoIntake = {
  version: 1,
  priority: [],
  desiredOutcome: "",
  market: "",
  brandCategory: "",
  constraints: "",
  previousLearning: "",
  diagnosticAnswers: {},
  importantDates: [],
};

const PRIORITIES = [
  ["customer", "Mejorar la experiencia de cliente"],
  ["conversion", "Convertir mejor las visitas en ventas"],
  ["retention", "Fidelizar y conseguir más recompras"],
  ["offer", "Mejorar producto, catálogo o propuesta de valor"],
  ["operations", "Resolver problemas de stock u operaciones"],
  ["acquisition", "Llegar a nuevos clientes o mercados"],
  ["seasonal", "Preparar una campaña, temporada o lanzamiento"],
  ["stability", "Consolidar la tienda antes de crecer"],
  ["profitability", "Crecer con rentabilidad y metas económicas por etapas"],
  ["help_me_prioritize", "No lo tengo claro; ayúdame a priorizar"],
] as const;

function connectionQuery(connectionId?: string | null) {
  return connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
}

type IntakeAssessment = {
  signals: Array<{ key: string; label: string; status: "available" | "empty" | "unavailable" }>;
  follow_up_questions: Array<{ key: string; prompt: string; placeholder: string; required: boolean }>;
};

const SIGNAL_STATUS = {
  available: "Consultado",
  empty: "Sin datos recientes",
  unavailable: "No disponible ahora",
} as const;

export function CaminoIntakeWizard({
  organizationId,
  connectionId,
  horizonMonths,
  disabled,
  onGenerate,
}: {
  organizationId: string;
  connectionId?: string | null;
  horizonMonths: number;
  disabled: boolean;
  onGenerate: (context: CaminoIntake) => Promise<void>;
}) {
  const [context, setContext] = useState<CaminoIntake>(INITIAL);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noDates, setNoDates] = useState(true);
  const calendarIdeas = useMemo(() => upcomingCalendarIdeas(horizonMonths), [horizonMonths]);
  const [assessment, setAssessment] = useState<IntakeAssessment | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/ai/camino-context${connectionQuery(connectionId)}`,
        );
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as { context: CaminoIntake | null };
        if (!cancelled) {
          const savedPriority = Array.isArray(payload.context?.priority)
            ? payload.context.priority
            : typeof (payload.context as unknown as { priority?: unknown } | null)?.priority === "string"
              ? [(payload.context as unknown as { priority: string }).priority]
              : [];
          const saved = payload.context
            ? {
                ...INITIAL,
                ...payload.context,
                priority: savedPriority.slice(0, 3),
                importantDates: payload.context.importantDates.map((item) => ({
                  ...item,
                  confirmed: item.confirmed ?? !item.note.toLowerCase().includes("sugerida por el calendario"),
                })),
              }
            : INITIAL;
          setContext(saved);
          setNoDates(saved.importantDates.length === 0);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo cargar el contexto guardado.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, connectionId]);

  function update(patch: Partial<CaminoIntake>) {
    setContext((current) => ({ ...current, ...patch }));
  }

  function updateDate(index: number, patch: Partial<CaminoIntake["importantDates"][number]>) {
    update({ importantDates: context.importantDates.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  }

  function togglePriority(value: string) {
    if (context.priority.includes(value)) {
      update({ priority: context.priority.filter((item) => item !== value) });
    } else if (context.priority.length < 3) {
      update({ priority: [...context.priority, value] });
    }
  }

  function addDate() {
    setNoDates(false);
    update({ importantDates: [...context.importantDates, { name: "", date: "", repeatsAnnually: false, confirmed: true, note: "" }] });
  }

  function addCalendarIdea(idea: { name: string; date: string }) {
    if (context.importantDates.some((item) => item.name.toLowerCase() === idea.name.toLowerCase())) return;
    setNoDates(false);
    update({ importantDates: [...context.importantDates, {
      ...idea,
      repeatsAnnually: true,
      confirmed: false,
      note: "Fecha sugerida por el calendario; confirmar que aplica a esta tienda.",
    }] });
  }

  const hasAdditionalContext = Boolean(
    context.desiredOutcome.trim() || context.market.trim() || context.brandCategory.trim() || context.constraints.trim() ||
    context.previousLearning.trim() || Object.values(context.diagnosticAnswers).some((answer) => answer.trim()) ||
    context.importantDates.some((item) => item.name.trim() && item.date),
  );
  const hasRequiredFollowUps = !assessment || assessment.follow_up_questions
    .filter((item) => item.required)
    .every((item) => Boolean(context.diagnosticAnswers[item.key]?.trim()));

  async function submit() {
    if (context.priority.length === 0 || !hasAdditionalContext || !hasRequiredFollowUps || isSubmitting || disabled) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onGenerate({
        ...context,
        importantDates: context.importantDates.filter((item) => item.name.trim() && item.date).slice(0, 10),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo preparar el Camino. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function assessAndContinue() {
    if (context.priority.length === 0 || isAssessing || disabled) return;
    setIsAssessing(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/camino-context/assessment${connectionQuery(connectionId)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(context) },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      setAssessment((await response.json()) as IntakeAssessment);
      setStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo revisar la información disponible.");
    } finally {
      setIsAssessing(false);
    }
  }

  if (isLoading) return <LoadingBlock label="Recuperando el contexto de esta tienda..." />;

  return (
    <section className={s.root} aria-labelledby="camino-intake-title">
      <div className={s.top}>
        <div>
          <h3 id="camino-intake-title">Datos para el Camino</h3>
        </div>
          <span className={s.stepCount}>0{step + 1} <span>/ 03</span></span>
      </div>

      <div className={s.progress} aria-label={`Paso ${step + 1} de 3`}>
        {[0, 1, 2].map((item) => <span key={item} className={item <= step ? s.progressActive : ""} />)}
      </div>

      {error ? <p className={s.error} role="alert">{error}</p> : null}

      {step === 0 ? (
        <div className={s.step}>
          <h4>Prioridades</h4>
          <div className={s.selectionHint} aria-live="polite">Elige hasta 3 · la primera es la principal · {context.priority.length} seleccionadas</div>
          <div className={s.choices} role="group" aria-label="Áreas que quieres mejorar, hasta tres">
            {PRIORITIES.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={context.priority.includes(value)}
                className={`${s.choice} ${context.priority.includes(value) ? s.choiceSelected : ""}`}
                onClick={() => togglePriority(value)} disabled={disabled || (!context.priority.includes(value) && context.priority.length >= 3)}>
                <span className={s.selectionMark} aria-hidden="true">{context.priority.includes(value) ? "✓" : ""}</span>{label}
              </button>
            ))}
          </div>
          <label className={s.field}>
            <span>Resultado que buscas</span>
            <Textarea rows={3} maxLength={1600} value={context.desiredOutcome} disabled={disabled}
              onChange={(event) => update({ desiredOutcome: event.target.value })}
              placeholder="Ej. Más clientes que vuelven" />
          </label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className={s.step}>
          <h4>Mercado y fechas</h4>
          {assessment ? (
            <aside className={s.knownPanel}>
              <strong>Datos conectados</strong>
              <ul>
                {assessment.signals.map((signal) => (
                  <li key={signal.key}>
                    <span>{signal.label}</span>
                    <em className={signal.status === "unavailable" ? s.signalUnavailable : signal.status === "empty" ? s.signalEmpty : s.signalAvailable}>
                      {SIGNAL_STATUS[signal.status]}
                    </em>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
          <h4>Fechas importantes</h4>
          <div className={s.calendarIdeas}>
            <span>Fechas sugeridas</span>
            {calendarIdeas.map((idea) => {
              const alreadyAdded = context.importantDates.some((item) => item.name.toLowerCase() === idea.name.toLowerCase());
              return <button key={idea.name} type="button" className={s.idea} disabled={disabled || alreadyAdded}
                onClick={() => addCalendarIdea(idea)}>
                <span><strong>{idea.name}</strong><small>{new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${idea.date}T00:00:00Z`))}</small></span>
                <b>{alreadyAdded ? "Añadida" : "＋ Añadir"}</b>
              </button>;
            })}
          </div>
          <label className={s.field}>
            <span>País o mercado principal</span>
            <Input value={context.market} maxLength={160} disabled={disabled}
              onChange={(event) => update({ market: event.target.value })}
              placeholder="Por ejemplo: España; vendemos también en Francia" />
          </label>
          <label className={s.field}>
            <span>Marca y categorías de producto</span>
            <Input value={context.brandCategory} maxLength={300} disabled={disabled}
              onChange={(event) => update({ brandCategory: event.target.value })}
              placeholder="Por ejemplo: cosmética natural, moda femenina o accesorios infantiles" />
          </label>
          <div className={s.dateList}>
            {context.importantDates.map((item, index) => (
              <div className={s.dateRow} key={index}>
                <label className={s.field}><span>Evento o fecha</span><Input value={item.name} maxLength={120} disabled={disabled} onChange={(event) => updateDate(index, { name: event.target.value })} placeholder="Aniversario de la tienda" /></label>
                <label className={s.field}><span>Fecha</span><DatePicker value={item.date} disabled={disabled} onChange={(value) => updateDate(index, { date: value })} /></label>
                <label className={s.field}><span>Qué tener en cuenta <em>Opcional</em></span><Input value={item.note} maxLength={500} disabled={disabled} onChange={(event) => updateDate(index, { note: event.target.value })} placeholder="Preparar stock 6 semanas antes" /></label>
                <div className={s.dateFlags}>
                  <label className={s.repeat}><Checkbox checked={item.confirmed} disabled={disabled} onChange={(event) => updateDate(index, { confirmed: event.target.checked })} />Confirmado para esta tienda</label>
                  <label className={s.repeat}><Checkbox checked={item.repeatsAnnually} disabled={disabled} onChange={(event) => updateDate(index, { repeatsAnnually: event.target.checked })} />Se repite cada año</label>
                </div>
                <button className={s.removeDate} type="button" disabled={disabled} onClick={() => update({ importantDates: context.importantDates.filter((_, itemIndex) => itemIndex !== index) })}>Quitar fecha</button>
              </div>
            ))}
          </div>
          <div className={s.dateActions}>
            <Button type="button" variant="secondary" disabled={disabled || context.importantDates.length >= 10} onClick={addDate}>Añadir fecha importante</Button>
            <label className={s.repeat}><Checkbox checked={noDates} disabled={disabled} onChange={(event) => { setNoDates(event.target.checked); if (event.target.checked) update({ importantDates: [] }); }} />No hay fechas relevantes que añadir</label>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className={s.step}>
          <h4>Capacidad y aprendizajes</h4>
          <label className={s.field}>
            <span>Tiempo, equipo y presupuesto</span>
            <Textarea rows={3} maxLength={1600} value={context.constraints} disabled={disabled} onChange={(event) => update({ constraints: event.target.value })} placeholder="Por ejemplo: una persona lleva marketing; no podemos cambiar de proveedor hasta enero…" />
          </label>
          <label className={s.field}>
            <span>Qué habéis probado</span>
            <Textarea rows={3} maxLength={1600} value={context.previousLearning} disabled={disabled} onChange={(event) => update({ previousLearning: event.target.value })} placeholder="Campañas, cambios o proyectos anteriores que no aparecen en las métricas conectadas." />
          </label>
          {assessment?.follow_up_questions.length ? (
            <div className={s.followUps}>
              <div>
                <h4>Preguntas para afinar el plan</h4>
              </div>
              {assessment.follow_up_questions.map((item) => (
                <div className={s.field} key={item.key}>
                  <span>{item.prompt} <em>{item.required ? "Necesario para afinar la propuesta" : "Opcional"}</em></span>
                  <Textarea aria-label={item.prompt} aria-required={item.required} rows={2} maxLength={1200} value={context.diagnosticAnswers[item.key] ?? ""} disabled={disabled}
                    onChange={(event) => update({ diagnosticAnswers: { ...context.diagnosticAnswers, [item.key]: event.target.value } })}
                    placeholder={item.placeholder} />
                  <button className={s.unknownAnswer} type="button" disabled={disabled}
                    onClick={() => update({ diagnosticAnswers: { ...context.diagnosticAnswers, [item.key]: "No lo sé todavía." } })}>
                    No lo sé todavía
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <p className={s.memoryNote}>Estas respuestas se guardan en Conocimiento.</p>
        </div>
      ) : null}

      <div className={s.footer}>
        <span className={s.validationHint}>
          {context.priority.length === 0 ? "Elige una prioridad." : !hasRequiredFollowUps ? "Responde las preguntas clave o marca «No lo sé todavía»." : !hasAdditionalContext ? "Añade un dato más para el Camino." : ""}
        </span>
        <div className={s.footerActions}>
          {step > 0 ? <Button type="button" variant="secondary" disabled={disabled || isSubmitting} onClick={() => setStep((current) => current - 1)}>Atrás</Button> : null}
          {step < 2 ? (
            <Button type="button" disabled={disabled || (step === 0 && (context.priority.length === 0 || isAssessing))} onClick={() => step === 0 ? void assessAndContinue() : setStep((current) => current + 1)}>
              {step === 0 && isAssessing ? "Revisando datos de la tienda…" : "Continuar"}
            </Button>
          ) : (
            <Button type="button" disabled={disabled || isSubmitting || context.priority.length === 0 || !hasAdditionalContext || !hasRequiredFollowUps} onClick={() => void submit()}>
              {isSubmitting ? "Guardando contexto y analizando…" : "Guardar contexto y trazar el Camino"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
