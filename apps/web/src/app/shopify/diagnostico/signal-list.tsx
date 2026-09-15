"use client";

/**
 * FASE 3 / D05 — las senales, en pantalla.
 *
 * Es la segunda pregunta de la cadena. `D03`, encima, contesta "¿de que es
 * capaz este negocio?". Esto: **¿que ha cambiado?**. Y justo debajo, `D06`
 * contesta "¿que patron forman juntas?".
 *
 * Lo que NO contesta esta escrito en la propia tarjeta, no solo aqui: por que
 * ha cambiado. El guardrail 50 lo fija con un ejemplo que no admite
 * interpretacion -- D05 puede decir "el CTR se deteriora", no puede decir
 * "fatiga de creatividad confirmada".
 *
 * Solo consultor, y aqui el motivo es el mas fuerte de la fase: el guardrail 2
 * dice que no toda senal es un problema. Esta lista delante del cliente es una
 * alarma permanente el primer martes que el trafico baje.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

import {
  baselineNote,
  headline,
  magnitudeCaveat,
  magnitudeText,
  patternNote,
  persistenceLabel,
  relevanceLabel,
  sortSignals,
  splitBySuppression,
  weaknesses,
  windowLabel,
  type SignalView,
} from "./signal-list-view-model";

function SignalRow({ signal }: { signal: SignalView }) {
  const relevancia = relevanceLabel(signal);
  const patron = patternNote(signal);
  const magnitud = magnitudeText(signal);
  const aviso = magnitudeCaveat(signal);
  const debilidades = weaknesses(signal);
  const baseline = baselineNote(signal);

  return (
    <li className="border-t border-default-200 py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{headline(signal)}</span>
        {magnitud ? (
          <span className="font-mono tabular-nums">{magnitud}</span>
        ) : null}
        {signal.organization_name ? (
          <span className="text-muted text-sm">{signal.organization_name}</span>
        ) : null}
        <Badge tone={relevancia.tone}>{relevancia.label}</Badge>
        <Badge tone={patron.tone}>{patron.label}</Badge>
      </div>

      <p className="text-muted mt-1 text-sm">
        {windowLabel(signal)} · {persistenceLabel(signal)}
        {baseline ? ` · ${baseline}` : ""}
      </p>

      <p className="mt-2 max-w-prose text-sm leading-6">{signal.description}</p>

      {aviso ? (
        // Guardrail 8. Va con el mismo peso que la cifra, no en un tooltip: si
        // la magnitud se lee sola, el motor grita mas cuanto menos importa.
        <p className="text-muted mt-2 max-w-prose text-sm leading-6">{aviso}</p>
      ) : null}

      {debilidades.length > 0 ? (
        <ul className="text-muted mt-2 space-y-1 text-sm">
          {debilidades.map((razon) => (
            <li key={razon}>· {razon}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SignalListPanel() {
  const [signals, setSignals] = useState<SignalView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/signals")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as { signals: SignalView[] };
        setSignals(payload.signals);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las señales por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !signals) {
    return <LoadingBlock label="Cargando las señales..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!signals) return null;

  const ordenadas = sortSignals(signals);
  const { visibles, apartadas } = splitBySuppression(ordenadas);

  return (
    <Card
      title="Qué ha cambiado"
      description="Las desviaciones detectadas: cuánto, desde cuándo y contra qué se comparan. Ninguna dice por qué. Están por fecha, no por tamaño: el tamaño de una desviación no es el orden en que hay que mirarlas."
    >
      {visibles.length === 0 && apartadas.length === 0 ? (
        <EmptyState
          title="Sin señales"
          hint="Aparecen cuando una métrica se sale de su rango esperado. Que no haya ninguna significa que nada se ha salido en la ventana medida, no que todo vaya bien."
        />
      ) : (
        <ul>
          {visibles.map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))}
        </ul>
      )}

      {apartadas.length > 0 ? (
        // Se apartan, no se esconden: cuando alguien declare un patron de
        // supresion, el consultor tiene que poder comprobar si estuvo bien.
        <div className="mt-6 border-t border-default-200 pt-4">
          <p className="text-muted text-xs uppercase tracking-wide">
            Apartadas por un patrón declarado
          </p>
          <ul className="mt-2">
            {apartadas.map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
