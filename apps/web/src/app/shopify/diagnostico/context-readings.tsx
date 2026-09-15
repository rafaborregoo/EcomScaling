"use client";

/**
 * FASE 3 / D02 — la lectura contextual, en pantalla.
 *
 * Contesta la pregunta que va justo despues de "¿me puedo fiar del dato?" (que
 * es `D01`, en `/integraciones`): **¿que significa este movimiento?**
 *
 * Y la contesta en dos piezas que van juntas a proposito:
 *
 *   1. si la comparacion aguanta -- porque una comparacion invalida y una
 *      valida se parecen mucho en una tabla;
 *   2. si lo que cambio fue el rendimiento o el peso de los segmentos.
 *
 * Solo consultor. Una lectura contextual es razonamiento a medio hacer: dice
 * contra que se compara, no que pasa. Ensenarsela al cliente seria darle una
 * conclusion que todavia no existe.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

import {
  comparabilityLabel,
  interpretationLabel,
  performanceMoved,
  weightShift,
  type ContextReading,
  type MixSegmentView,
} from "./context-readings-view-model";

const DIMENSION_LABEL: Record<string, string> = {
  channel: "Por canal",
  customer_type: "Por tipo de cliente",
};

function MixTable({ mix }: { mix: MixSegmentView[] }) {
  const dimensiones = [...new Set(mix.map((m) => m.dimension))];

  return (
    <div className="mt-4 space-y-4">
      {dimensiones.map((dimension) => (
        <div key={dimension}>
          <p className="text-muted text-xs uppercase tracking-wide">
            {DIMENSION_LABEL[dimension] ?? dimension}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse text-sm">
              <thead>
                <tr className="text-muted text-left text-xs">
                  <th className="py-1 pr-3 font-normal">Segmento</th>
                  <th className="py-1 pr-3 font-normal">Peso</th>
                  <th className="py-1 font-normal">Rendimiento</th>
                </tr>
              </thead>
              <tbody>
                {mix
                  .filter((m) => m.dimension === dimension)
                  .map((segmento) => (
                    <tr key={segmento.segment} className="border-t border-default-200">
                      <td className="py-2 pr-3">{segmento.segment}</td>
                      <td className="py-2 pr-3 font-mono tabular-nums">
                        {weightShift(segmento)}
                      </td>
                      <td className="py-2">
                        {segmento.performance_before == null ? (
                          <span className="text-muted">sin medir</span>
                        ) : performanceMoved(segmento) ? (
                          <span className="font-mono tabular-nums">
                            {segmento.performance_before.toFixed(1)} →{" "}
                            {(segmento.performance_after ?? 0).toFixed(1)}
                          </span>
                        ) : (
                          // Decirlo explicitamente es la mitad del valor de la
                          // tabla: "igual" es lo que descarta el deterioro.
                          <span className="text-muted">igual</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadingRow({ reading }: { reading: ContextReading }) {
  const interpretacion = interpretationLabel(reading.aggregate_interpretation);
  const comparabilidad = comparabilityLabel(reading.comparability);

  return (
    <li className="border-t border-default-200 py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{reading.target_metric ?? "métrica"}</span>
        {reading.organization_name ? (
          <span className="text-muted text-sm">{reading.organization_name}</span>
        ) : null}
        <Badge tone={interpretacion.tone}>{interpretacion.label}</Badge>
        <Badge tone={comparabilidad.tone}>{comparabilidad.label}</Badge>
      </div>

      <p className="mt-2 max-w-prose text-sm leading-6">{interpretacion.detail}</p>

      {reading.comparability_reasons.length > 0 ? (
        <ul className="text-muted mt-2 space-y-1 text-sm">
          {reading.comparability_reasons.map((motivo) => (
            <li key={motivo}>· {motivo}</li>
          ))}
        </ul>
      ) : null}

      {reading.mix.length > 0 ? <MixTable mix={reading.mix} /> : null}

      {reading.missing_context.length > 0 ? (
        <p className="text-muted mt-3 text-xs">
          No se pudo mirar: {reading.missing_context.join("; ")}.
        </p>
      ) : null}
    </li>
  );
}

export function ContextReadingsPanel() {
  const [readings, setReadings] = useState<ContextReading[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/context-readings")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as { readings: ContextReading[] };
        setReadings(payload.readings);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el contexto por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !readings) {
    return <LoadingBlock label="Cargando lecturas de contexto..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!readings) return null;

  return (
    <Card
      title="Qué significa el movimiento"
      description="Contra qué se compara cada señal, si la comparación aguanta y si lo que cambió fue el rendimiento o el peso de los segmentos."
    >
      {readings.length === 0 ? (
        <EmptyState
          title="Sin lecturas de contexto"
          hint="Aparecen cuando el motor de señales detecta un movimiento y el de contexto lo descompone."
        />
      ) : (
        <ul>
          {readings.map((reading) => (
            <ReadingRow key={reading.id} reading={reading} />
          ))}
        </ul>
      )}
    </Card>
  );
}
