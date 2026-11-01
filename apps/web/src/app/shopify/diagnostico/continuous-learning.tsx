"use client";

/**
 * F9 — aprendizaje continuo. Cuatro secciones con su ancla (para InsightsMenu
 * y el Copiloto) y, en cada bloque, su decision, su motivo y lo que falta.
 * Solo consultor. Nada de esto promociona conocimiento ni cambia autonomia.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import {
  continuousLearningTone,
  continuousLearningViewModel,
  type ContinuousLearningRun,
  type LearningBlockView,
} from "./continuous-learning-view-model";

function BlockRow({ item }: { item: LearningBlockView }) {
  return (
    <li className="border-t border-default-200 py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {item.block}
          {item.title ? ` · ${item.title}` : ""}
        </span>
        <Badge tone={continuousLearningTone(item.status)}>{item.decision}</Badge>
      </div>
      <p className="mt-1 max-w-prose text-sm leading-6">{item.why}</p>
      {item.failedChecks.length ? (
        <ul className="text-muted mt-1 space-y-0.5 text-xs">
          {item.failedChecks.map((c) => (
            <li key={c.id}>{c.detail}</li>
          ))}
        </ul>
      ) : null}
      {item.next.length ? <p className="text-muted mt-1 text-xs">Falta: {item.next.join(" · ")}</p> : null}
    </li>
  );
}

export function ContinuousLearningPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<ContinuousLearningRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setRuns([]);
      setError(null);
      return;
    }
    let cancelled = false;
    apiFetch(`/v1/consultant/continuous-learning?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: ContinuousLearningRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar F9.");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando aprendizaje continuo..." />;
  const model = continuousLearningViewModel(runs);

  return (
    <Card id="insight-continuous-learning">
      <CardHeader>
        <CardTitle>Aprendizaje continuo</CardTitle>
        <CardDescription>Qué se puede aprender de lo ejecutado, con qué evidencia y qué falta. Propone; no promociona conocimiento ni cambia la autonomía.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-muted text-xs">Evaluados</p>
            <p className="text-lg font-semibold">{model.evaluated}/40</p>
          </div>
          <div>
            <p className="text-muted text-xs">Listos</p>
            <p className="text-lg font-semibold">{model.ready}</p>
          </div>
          <div>
            <p className="text-muted text-xs">Esperan evidencia</p>
            <p className="text-lg font-semibold">{model.waiting}</p>
          </div>
          <div>
            <p className="text-muted text-xs">Revisión / bloqueados</p>
            <p className="text-lg font-semibold">
              {model.review} / {model.blocked}
            </p>
          </div>
        </div>
        {model.sections.map((section) => (
          <section key={section.id} id={section.anchor} className="mt-6">
            <p className="text-xs uppercase tracking-wide">{section.title}</p>
            <ul className="mt-2">
              {section.items.map((item) => (
                <BlockRow key={item.block} item={item} />
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
