import { Fragment, type ReactNode } from "react";
import { EYEBROW, Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";

// Una sola forma de pintar lo que dice la IA, venga del agente que venga, con
// lo que devuelve el propio agente: conclusión, hallazgos con sus cifras como
// datos y "Qué hacer" como lista. El contrato común de salida de los agentes
// (packages/ai, agentOutputJsonSchema) le describe esta misma estructura al
// modelo: si cambia una, cambia la otra. Aquí no se cuelan cifras de la base de
// datos: lo que se ve es el mensaje de la IA, formateado.

export type AiFigureData = {
  label: string;
  metric_key?: string | null;
  value: string;
  previous?: string | null;
  change_pct?: number | null;
  /** "bad" pinta la variación en rojo; el resto, en gris. */
  tone?: "bad" | null;
};
export type AiFindingData = {
  title: string;
  severity?: string | null;
  evidence?: string | null;
  figures?: Array<Omit<AiFigureData, "tone">> | null;
};
export type AiStepData = {
  action: string;
  owner?: "cliente" | "consultor" | string | null;
  priority?: string | null;
  expected_impact?: string | null;
};

const BAD = new Set(["critical", "high", "urgent", "business_threat", "error"]);
const WATCH = new Set(["medium", "moderate", "warning"]);
const severityColor = (severity?: string | null) =>
  severity && BAD.has(severity) ? "var(--danger)" : severity && WATCH.has(severity) ? "var(--warning)" : "var(--color-muted, #8a8a8a)";

// Salidas anteriores al contrato con `figures` traen las cifras dentro del
// texto: se resaltan las que llevan unidad o separadores para leerlas de un
// vistazo. Las fechas ("14 sep", "2026") se quedan como texto.
const NUMBER = /(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)\s?(?:%|€|\$|×|EUR\b|USD\b|pp\b)|\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+/g;
export function emphasizeNumbers(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMBER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(<b className="font-semibold tabular-nums">{match[0]}</b>);
    last = index + match[0].length;
  }
  if (!parts.length) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

/** Etiqueta del agente (A29, IA…) delante de la conclusión. */
export function AiTag({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 inline-grid h-[17px] place-items-center rounded px-1.5 align-[2px] text-[9.5px] font-semibold uppercase leading-none tracking-[0.06em] bg-accent text-accent-foreground">
      {children}
    </span>
  );
}

export function AiFigure({ label, value, previous, change_pct, tone }: AiFigureData) {
  return (
    <Card size="sm" className="min-w-0"><CardContent>
      <p className="truncate text-xs text-muted" title={label}>{label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-semibold tabular-nums text-foreground">{value}</span>
        {change_pct != null ? (
          <span className="text-xs font-medium tabular-nums" style={{ color: tone === "bad" ? "var(--danger)" : undefined }}>
            {change_pct >= 0 ? "▲" : "▼"} {Math.abs(change_pct).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %
          </span>
        ) : null}
      </p>
      {previous ? <p className="text-xs tabular-nums text-muted">antes {previous}</p> : null}
    </CardContent></Card>
  );
}

export function AiInsight({
  tag,
  summary,
  detail,
  figures = [],
  findings = [],
  steps = [],
  audience,
  warnings = [],
  footer,
}: {
  tag?: string;
  summary?: string | null;
  /** Una línea de contexto bajo la conclusión (p. ej. la prueba de un hallazgo). */
  detail?: string | null;
  /** Cifras que trae el propio mensaje de la IA (p. ej. un hallazgo suelto). Nunca de la base de datos. */
  figures?: AiFigureData[];
  findings?: AiFindingData[];
  steps?: AiStepData[];
  /** Cada rol ve solo sus pasos. Sin rol, se muestran todos con su dueño. */
  audience?: "cliente" | "consultor";
  warnings?: string[];
  footer?: ReactNode;
}) {
  const shownSteps = audience ? steps.filter((step) => (step.owner === "consultor") === (audience === "consultor")) : steps;
  const mixedOwners = !audience && new Set(steps.map((step) => step.owner)).size > 1;
  const findingsList = findings.length ? (
    <ul className="grid gap-3">
      {findings.map((finding, index) => (
        <li key={`${finding.title}-${index}`} className="grid gap-1.5">
          <p className="flex gap-2">
            <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full" style={{ background: severityColor(finding.severity) }} />
            <span className="min-w-0 font-medium">{emphasizeNumbers(finding.title)}</span>
          </p>
          {finding.figures?.length ? (
            <div className="ml-3.5 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
              {finding.figures.map((figure, figureIndex) => (
                <AiFigure
                  key={`${figure.label}-${figureIndex}`}
                  {...figure}
                  tone={BAD.has(finding.severity ?? "") && figure.change_pct != null ? "bad" : null}
                />
              ))}
            </div>
          ) : null}
          {finding.evidence ? <p className="ml-3.5 text-[13px] text-muted">{emphasizeNumbers(finding.evidence)}</p> : null}
        </li>
      ))}
    </ul>
  ) : null;
  const stepsBlock = shownSteps.length ? (
    <div>
      <p className={EYEBROW}>Qué hacer</p>
      <ol className="mt-1.5 grid gap-2">
        {shownSteps.map((step, index) => (
          <li key={`${step.action}-${index}`} className="flex gap-2.5">
            <span aria-hidden className="mt-px inline-grid size-5 shrink-0 place-items-center rounded-full border border-separator text-[11px] font-semibold tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="min-w-0">
              {mixedOwners ? <span className="font-medium">{step.owner === "consultor" ? "Consultor: " : "Cliente: "}</span> : null}
              {emphasizeNumbers(step.action)}
              {step.priority === "urgent" || step.priority === "high" ? (
                <span className="ml-1.5 text-xs font-medium" style={{ color: step.priority === "urgent" ? "var(--danger)" : undefined }}>
                  {step.priority === "urgent" ? "· Urgente" : "· Prioridad alta"}
                </span>
              ) : null}
              {step.expected_impact ? <span className="block text-[13px] text-muted">{step.expected_impact}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  ) : null;
  const warningsBlock = warnings.length ? (
    <Collapsible className="text-[13px] text-muted">
      <CollapsibleTrigger>Límites de los datos<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
      <CollapsibleContent>
      <ul className="mt-1 grid list-disc gap-1 pl-5">
        {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
      </ul>
    </CollapsibleContent>
    </Collapsible>
  ) : null;
  // Con sitio, lo que ha visto la IA a la izquierda y qué hacer a la derecha.
  // Container query y no viewport: el mismo bloque vive en popovers estrechos
  // y en paneles a todo el ancho.
  const side = shownSteps.length > 0 && (findings.length > 0 || Boolean(summary));
  return (
    <div className="@container">
      <div className={`grid gap-x-10 gap-y-4 text-sm leading-relaxed text-foreground ${side ? "@3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : ""}`}>
        <div className="grid content-start gap-3">
          {summary ? (
            <p className="text-[15px] leading-normal">
              {tag ? <AiTag>{tag}</AiTag> : null}
              {emphasizeNumbers(summary)}
            </p>
          ) : null}
          {figures.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
              {figures.map((figure, index) => <AiFigure key={`${figure.label}-${index}`} {...figure} />)}
            </div>
          ) : null}
          {detail ? <p className="text-[13px] text-muted">{emphasizeNumbers(detail)}</p> : null}
          {findingsList}
          {warningsBlock}
          {footer ? <p className="text-xs text-muted">{footer}</p> : null}
        </div>
        {side ? <div className="grid content-start gap-3">{stepsBlock}</div> : stepsBlock}
      </div>
    </div>
  );
}
