"use client";

/**
 * FASE 3 / D04 — declarar contra que se juzga una metrica, en pantalla.
 *
 * POR QUE EXISTE. `D04` y `D10` estaban implementados y los dos contestaban
 * `unknown` en todo por el mismo motivo: no habia donde decir "el CAC maximo de
 * esta tienda son 32 EUR". El guardrail 11 prohibe el umbral universal y el 13
 * depender de benchmarks externos, asi que la vara **la pone el tenant** -- y la
 * tabla llevaba desde el 2026-09-15 esperando a que alguien pudiera escribir en
 * ella.
 *
 * VA JUSTO ENCIMA DE LA SALUD, a proposito: quien lee "no hay guardrail
 * declarado para adquisicion" lo declara aqui mismo. Un hueco que te dice que
 * falta algo y no te deja arreglarlo es una queja, no una herramienta.
 *
 * NO SE BORRA, SE RETIRA. Cambiar la vara explica por que una capacidad paso de
 * `bad` a `healthy` sin que el negocio se moviera; borrarla dejaria ese salto
 * sin explicacion en el historico.
 */

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Select,
} from "@/components/ui";

import {
  judges,
  REFERENCE_TYPES,
  referenceSentence,
  referenceTypeLabel,
  validateDraft,
  type HealthReferenceView,
} from "./health-references-view-model";

const CAPACIDADES: { value: string; label: string }[] = [
  { value: "acquisition", label: "Adquisición" },
  { value: "conversion", label: "Conversión" },
  { value: "retention", label: "Retención" },
  { value: "unit_economics", label: "Economía unitaria" },
  { value: "inventory", label: "Inventario" },
  { value: "operations", label: "Operativa" },
  { value: "offer", label: "Oferta" },
  { value: "product", label: "Producto" },
  { value: "creative", label: "Creatividades" },
  { value: "market", label: "Mercado" },
  { value: "finance", label: "Finanzas" },
  { value: "data", label: "Datos" },
  { value: "technology", label: "Tecnología" },
  { value: "team", label: "Equipo" },
  { value: "strategy", label: "Estrategia" },
];

const DIRECCIONES = [
  { value: "max", label: "como máximo (techo)" },
  { value: "min", label: "como mínimo (suelo)" },
  { value: "range", label: "dentro de un rango" },
];

const BORRADOR_VACIO = {
  organization_id: "",
  capability: "",
  metric: "",
  reference_type: "economic_guardrail",
  value: "",
  unit: "",
  direction: "max",
  source: "",
};

export function HealthReferencesPanel() {
  const [references, setReferences] = useState<HealthReferenceView[] | null>(null);
  const [organizations, setOrganizations] = useState<{ id: string; display_name: string }[]>([]);
  const [draft, setDraft] = useState(BORRADOR_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const cargar = useCallback(async () => {
    const response = await apiFetch("/v1/consultant/health-references");
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    const payload = (await response.json()) as {
      references: HealthReferenceView[];
      organizations: { id: string; display_name: string }[];
    };
    setReferences(payload.references);
    setOrganizations(payload.organizations);
    setError(null);
  }, []);

  useEffect(() => {
    cargar()
      .catch(() => setError("No se pudieron cargar las referencias por un error de red."))
      .finally(() => setIsLoading(false));
  }, [cargar]);

  const problema = validateDraft(draft);

  async function declarar() {
    if (problema) return;
    setIsSaving(true);
    try {
      const response = await apiFetch("/v1/consultant/health-references", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organization_id: draft.organization_id,
          capability: draft.capability,
          metric: draft.metric.trim(),
          reference_type: draft.reference_type,
          value: Number(draft.value),
          unit: draft.unit.trim() || null,
          direction: draft.direction || null,
          source: draft.source.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setDraft({ ...BORRADOR_VACIO, organization_id: draft.organization_id });
      await cargar();
    } catch {
      setError("No se pudo guardar la referencia por un error de red.");
    } finally {
      setIsSaving(false);
    }
  }

  async function retirar(id: string) {
    setIsSaving(true);
    try {
      const response = await apiFetch(`/v1/consultant/health-references/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await cargar();
    } catch {
      setError("No se pudo retirar la referencia por un error de red.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !references) {
    return <LoadingBlock label="Cargando las referencias declaradas..." />;
  }

  const tipoElegido = REFERENCE_TYPES.find((t) => t.value === draft.reference_type);

  return (
    <Card
      title="Contra qué se juzga cada métrica"
      description="Sin esto, el diagnóstico no puede decir si una cifra está bien o mal: no hay umbral universal para un CAC ni para un CVR, y un número de fuera no vale para esta tienda. Lo que se declare aquí es lo que permite que una capacidad salga sana o enferma en vez de «no evaluable»."
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Tienda">
          <Select
            value={draft.organization_id}
            onChange={(organization_id) => setDraft({ ...draft, organization_id })}
            options={organizations.map((o) => ({ value: o.id, label: o.display_name }))}
            placeholder="Elige la tienda"
            aria-label="Tienda"
          />
        </Field>

        <Field label="Capacidad">
          <Select
            value={draft.capability}
            onChange={(capability) => setDraft({ ...draft, capability })}
            options={CAPACIDADES}
            placeholder="Elige la capacidad"
            aria-label="Capacidad"
          />
        </Field>

        <Field label="Métrica">
          <Input
            value={draft.metric}
            onChange={(e) => setDraft({ ...draft, metric: e.target.value })}
            placeholder="cac"
          />
        </Field>

        <Field label="Tipo de referencia">
          <Select
            value={draft.reference_type}
            onChange={(reference_type) => setDraft({ ...draft, reference_type })}
            options={REFERENCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            aria-label="Tipo de referencia"
          />
        </Field>

        <Field label="Dirección">
          <Select
            value={draft.direction}
            onChange={(direction) => setDraft({ ...draft, direction })}
            options={DIRECCIONES}
            aria-label="Dirección"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">
            <Input
              value={draft.value}
              onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              placeholder="32"
              inputMode="decimal"
            />
          </Field>
          <Field label="Unidad">
            <Input
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              placeholder="EUR"
            />
          </Field>
        </div>

        {draft.reference_type === "external_benchmark" ? (
          <Field label="De dónde sale">
            <Input
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              placeholder="Informe sectorial 2026"
            />
          </Field>
        ) : null}
      </div>

      {tipoElegido ? (
        // El helper text que la regla de UI sí permite: explica una restricción
        // y una consecuencia, no repite la etiqueta.
        <p className="text-muted mt-3 max-w-prose text-sm leading-6">{tipoElegido.hint}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void declarar()} disabled={Boolean(problema) || isSaving}>
          Declarar
        </Button>
        {/* El motivo por el que el botón está apagado, en vez de una pared. */}
        {problema ? <span className="text-muted text-sm">{problema}</span> : null}
      </div>

      <div className="mt-6 border-t border-default-200 pt-4">
        <p className="text-muted text-xs uppercase tracking-wide">Declaradas ahora mismo</p>

        {references && references.length > 0 ? (
          <ul className="mt-2">
            {references.map((referencia) => (
              <li
                key={referencia.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-default-200 py-3 first:border-t-0"
              >
                <span className="font-mono tabular-nums">{referenceSentence(referencia)}</span>
                <Badge tone={judges(referencia.reference_type) ? "brand" : "neutral"}>
                  {referenceTypeLabel(referencia.reference_type)}
                </Badge>
                <span className="text-muted text-sm">{referencia.capability}</span>
                {referencia.organization_name ? (
                  <span className="text-muted text-sm">{referencia.organization_name}</span>
                ) : null}
                {!judges(referencia.reference_type) ? (
                  <span className="text-muted text-xs">
                    sirve para comparar, no desbloquea el diagnóstico
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() => void retirar(referencia.id)}
                  disabled={isSaving}
                >
                  Retirar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2">
            <EmptyState
              title="Nada declarado todavía"
              hint="Mientras esto esté vacío, cada capacidad sale como «no evaluable» y el impacto se mide sin poder decir si es grave."
            />
          </div>
        )}
      </div>
    </Card>
  );
}
