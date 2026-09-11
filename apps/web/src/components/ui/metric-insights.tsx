"use client";

import { useState } from "react";
import { Popover } from "@heroui/react";
import { Badge, type Tone } from "./badge";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { SparklesIcon } from "./icons";
import { EYEBROW } from "./typography";
import { cn } from "./cn";
import {
  composeTask,
  insightBadgeCount,
  type MetricInsight,
} from "./metric-insights-task";

const SEVERITY_TONE: Record<MetricInsight["severity"], Tone> = {
  info: "neutral",
  low: "neutral",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

const SEVERITY_LABEL: Record<MetricInsight["severity"], string> = {
  info: "informativo",
  low: "bajo",
  medium: "medio",
  high: "alto",
  critical: "crítico",
};

const BADGE_TONE = {
  neutral: "bg-default text-default-foreground",
  warn: "bg-warning text-warning-foreground",
  danger: "bg-danger text-danger-foreground",
} as const;

function worstTone(insights: MetricInsight[]): keyof typeof BADGE_TONE {
  if (insights.some((i) => i.severity === "high" || i.severity === "critical")) {
    return "danger";
  }
  if (insights.some((i) => i.severity === "medium")) return "warn";
  return "neutral";
}

export function MetricInsights({
  metricLabel,
  insights,
  onCreateTask,
}: {
  metricLabel: string;
  insights: MetricInsight[];
  /** Sin esto el panel es solo de lectura y no dibuja el boton. */
  onCreateTask?: (task: { title: string; description: string }) => void;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    insights.filter((insight) => insight.needsTask).map((insight) => insight.id),
  );
  const [preview, setPreview] = useState<{
    title: string;
    description: string;
  } | null>(null);

  if (insights.length === 0) return null;

  const count = insightBadgeCount(insights);
  const tone = worstTone(insights);
  const chosen = insights.filter((insight) => selected.includes(insight.id));

  return (
    <Popover>
      {/* <button> nativo, no el Button del catalogo: aqui hace falta un area
          de pulsacion minima pegada al texto de la etiqueta, y el Button
          arrastra min-w-20 y alturas de boton de formulario. */}
      <Popover.Trigger>
        <button
          type="button"
          aria-label={`Análisis de la IA sobre ${metricLabel}: ${insights.length}`}
          className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-transparent text-accent transition-colors hover:bg-accent-soft"
        >
          <SparklesIcon aria-hidden className="size-3.5" />
          {count > 0 ? (
            <span
              aria-hidden
              className={cn(
                "absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full text-[9px] font-semibold leading-none tabular-nums",
                BADGE_TONE[tone],
              )}
            >
              {count}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Content placement="bottom end" className="max-w-[22rem]">
        <Popover.Dialog
          aria-label={`Análisis de la IA sobre ${metricLabel}`}
          className="max-h-[26rem] overflow-y-auto p-4"
        >
          <p className={EYEBROW}>{metricLabel} · lo que ve la IA</p>

          {preview ? (
            // Vista previa de la tarea, no la tarea creada: hasta que esto se
            // conecte, es la unica forma de ver si el texto compuesto sirve.
            <div className="mt-3">
              <p className="text-sm font-medium text-foreground">
                {preview.title}
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-muted">
                {preview.description}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setPreview(null)}
              >
                Volver
              </Button>
            </div>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-separator">
                {insights.map((insight) => (
                  <li key={insight.id} className="py-3 first:pt-0">
                    <div className="flex items-start gap-2">
                      {onCreateTask ? (
                        <Checkbox
                          checked={selected.includes(insight.id)}
                          onChange={(checked) =>
                            setSelected((prev) =>
                              checked
                                ? [...prev, insight.id]
                                : prev.filter((id) => id !== insight.id),
                            )
                          }
                          className="mt-0.5"
                        >
                          <span className="sr-only">
                            Incluir en la tarea: {insight.title}
                          </span>
                        </Checkbox>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {insight.title}
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">
                          {insight.evidence}
                        </p>
                        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-foreground">
                          {insight.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <div className="mt-2">
                          <Badge tone={SEVERITY_TONE[insight.severity]}>
                            {SEVERITY_LABEL[insight.severity]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {onCreateTask ? (
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  disabled={chosen.length === 0}
                  onClick={() => {
                    const task = composeTask(metricLabel, chosen);
                    onCreateTask(task);
                    setPreview(task);
                  }}
                >
                  {chosen.length > 1
                    ? `Crear una tarea con los ${chosen.length}`
                    : "Crear tarea"}
                </Button>
              ) : null}
            </>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
