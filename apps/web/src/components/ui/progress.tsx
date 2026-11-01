"use client";

import { createContext, useContext, useId, useLayoutEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

// Barra de progreso con la API de shadcn: Progress (value, max) con
// ProgressLabel y ProgressValue opcionales; la pista y el relleno los pone
// Progress sola (ProgressTrack > ProgressIndicator, exportados por si hacen
// falta a mano). Es el progreso hacia un final conocido: hitos hechos, ajustes
// listos, plazas ocupadas, importación. Una barra que compara cifras entre sí
// (ventas por producto) es una gráfica, no esto. Morado de marca sobre una
// pista morada muy clara. Estilos: `.ui-progress` en globals.css.

type ProgressContextValue = { value: number; max: number; labelId: string; setHasLabel: (has: boolean) => void };

const ProgressContext = createContext<ProgressContextValue | null>(null);

function useProgress(name: string) {
  const context = useContext(ProgressContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <Progress>`);
  return context;
}

export function Progress({
  value,
  max = 100,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { value: number; max?: number }) {
  const labelId = useId();
  const [hasLabel, setHasLabel] = useState(false);
  const clamped = Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <ProgressContext.Provider value={{ value: clamped, max, labelId, setHasLabel }}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-labelledby={hasLabel && !props["aria-label"] ? labelId : undefined}
        data-slot="progress"
        data-complete={clamped >= max || undefined}
        className={cn("ui-progress", className)}
        {...props}
      >
        {children}
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </div>
    </ProgressContext.Provider>
  );
}

export function ProgressTrack({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="progress-track" className={cn("ui-progress__track", className)} {...props} />;
}

export function ProgressIndicator({ className, style, ...props }: ComponentProps<"div">) {
  const { value, max } = useProgress("ProgressIndicator");
  return <div data-slot="progress-indicator" className={cn("ui-progress__indicator", className)} style={{ width: `${max ? (value / max) * 100 : 0}%`, ...style }} {...props} />;
}

export function ProgressLabel({ className, id, ...props }: ComponentProps<"span">) {
  const { labelId, setHasLabel } = useProgress("ProgressLabel");
  useLayoutEffect(() => {
    setHasLabel(true);
    return () => setHasLabel(false);
  }, [setHasLabel]);
  return <span data-slot="progress-label" id={id ?? labelId} className={cn("ui-progress__label", className)} {...props} />;
}

/** Sin hijos, el porcentaje redondeado; con una función, lo que devuelva (p. ej. «3 de 8»). */
export function ProgressValue({
  className,
  children,
  ...props
}: Omit<ComponentProps<"span">, "children"> & { children?: ReactNode | ((formatted: string, value: number) => ReactNode) }) {
  const { value, max } = useProgress("ProgressValue");
  const formatted = `${Math.round(max ? (value / max) * 100 : 0)} %`;
  return (
    <span data-slot="progress-value" aria-hidden className={cn("ui-progress__value", className)} {...props}>
      {typeof children === "function" ? children(formatted, value) : (children ?? formatted)}
    </span>
  );
}
