"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { Metric } from "@/components/ui";

/**
 * "Los datos mas importantes" de un modulo, en un solo sitio y con un solo
 * uso doble:
 *
 *   1. Se pintan como tira de KPIs arriba del modulo, para que el consultor
 *      no tenga que reconstruir el estado del cliente leyendo tres tarjetas.
 *   2. Se publican al Consultor IA (A09) como "vista actual": el agente sabe
 *      en que modulo esta el consultor, sobre que tienda, con que periodo y
 *      que cifras tiene delante. Sin esto, "por que ha bajado esto?" no tiene
 *      antecedente y hay que repetir a mano lo que la pantalla ya dice.
 *
 * Un solo componente para las dos cosas a proposito: si la tira y el contexto
 * del agente se declararan por separado acabarian divergiendo, y el agente
 * razonaria sobre cifras que el consultor no esta viendo.
 */
export type ModuleMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warn" | "danger";
};

export type ModuleSummaryData = {
  /** Periodo al que se refieren las cifras ("ultimos 30 dias", "Q3 2026"...). */
  period?: string;
  metrics: ModuleMetric[];
  /** Contexto que no es una cifra (estado del plan, avisos abiertos...). */
  notes?: string;
};

type Publish = (summary: ModuleSummaryData | null) => void;

const ModuleSummaryContext = createContext<Publish>(() => {});

export function ModuleSummaryProvider({
  publish,
  children,
}: {
  publish: Publish;
  children: ReactNode;
}) {
  return (
    <ModuleSummaryContext.Provider value={publish}>
      {children}
    </ModuleSummaryContext.Provider>
  );
}

/**
 * Publica el resumen sin pintarlo, para modulos que ya muestran sus cifras
 * con su propio layout y solo necesitan que el Consultor IA las vea.
 */
export function useModuleSummary(summary: ModuleSummaryData | null) {
  const publish = useContext(ModuleSummaryContext);
  // Las metricas se reconstruyen en cada render (son objetos literales), asi
  // que la dependencia es su contenido serializado, no su identidad.
  const serialized = useMemo(
    () => (summary ? JSON.stringify(summary) : null),
    [summary],
  );

  useEffect(() => {
    publish(serialized ? (JSON.parse(serialized) as ModuleSummaryData) : null);
    return () => publish(null);
  }, [publish, serialized]);
}

/**
 * Tira de KPIs del modulo. Pinta y publica en la misma llamada.
 * `metrics` vacio -> no pinta nada (un modulo cargando no debe reservar un
 * bloque de tarjetas vacias que luego salta).
 */
export function ModuleSummary({
  period,
  metrics,
  notes,
}: ModuleSummaryData) {
  const summary = useMemo(
    () => ({ period, metrics, notes }),
    [period, metrics, notes],
  );
  useModuleSummary(metrics.length > 0 ? summary : null);

  if (metrics.length === 0) return null;

  return (
    <section aria-label="Resumen del módulo" className="space-y-2">
      {period ? <p className="text-sm text-muted">{period}</p> : null}
      {/* auto-fit en vez de un número fijo de columnas: cada módulo publica
          las cifras que le importan (4, 5, 6...) y la tira nunca deja un
          hueco suelto al final de la fila. */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
        {metrics.map((metric) => (
          <Metric
            card
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            tone={metric.tone}
          />
        ))}
      </div>
      {notes ? <p className="text-sm text-muted">{notes}</p> : null}
    </section>
  );
}
