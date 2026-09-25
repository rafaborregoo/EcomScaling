"use client";

/**
 * F8 — ¿movió el negocio? Por cada intervención cerrada, el consultor dice qué
 * métrica debía mover y hacia dónde; el motor compara las 4 semanas previas al
 * arranque con las siguientes. Es lo que F9 necesita para aprender algo.
 */

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Button, Card, ErrorBlock, LoadingBlock, Select, toast, type Tone } from "@/components/ui";

type Effect = {
  store_id: string | null;
  metric: string;
  expected_direction: "up" | "down";
  started_at: string;
  baseline_value: number | null;
  observed_value: number | null;
  change_relative: number | null;
  observed_direction: "up" | "down" | "flat" | null;
  material: boolean;
  sample_sufficient: boolean;
  pre_days: number;
  post_days: number;
  maturity: "EARLY" | "INTERIM" | "MATURE" | null;
  measured_at: string | null;
};

type Intervention = {
  intervention_id: string;
  closed_at: string;
  closure_state: string;
  operational_outcome: string;
  expected_state: string | null;
  effect: Effect | null;
};

type Payload = { interventions: Intervention[]; stores: { id: string; name: string }[] };

const METRICS = [
  { value: "net_sales", label: "Ventas netas" },
  { value: "orders_count", label: "Pedidos" },
  { value: "average_order_value", label: "Ticket medio" },
  { value: "sessions", label: "Sesiones" },
  { value: "conversion_rate", label: "Conversión" },
];
const DIRECTIONS = [
  { value: "up", label: "Subir" },
  { value: "down", label: "Bajar" },
];
const MATURITY_ES = { EARLY: "Temprano", INTERIM: "Parcial", MATURE: "Maduro" } as const;

const day = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

function verdict(effect: Effect): { tone: Tone; label: string } {
  if (!effect.measured_at || effect.observed_direction == null) return { tone: "neutral", label: "Sin medir todavía" };
  if (!effect.sample_sufficient) return { tone: "neutral", label: "Muestra insuficiente" };
  if (!effect.material) return { tone: "neutral", label: "Sin efecto material" };
  return effect.observed_direction === effect.expected_direction
    ? { tone: "success", label: "Se movió como se esperaba" }
    : { tone: "danger", label: "Se movió en contra" };
}

function EffectRow({
  intervention,
  stores,
  organizationId,
  onSaved,
}: {
  intervention: Intervention;
  stores: Payload["stores"];
  organizationId: string;
  onSaved: () => void;
}) {
  const effect = intervention.effect;
  const [metric, setMetric] = useState(effect?.metric ?? "");
  const [direction, setDirection] = useState<string>(effect?.expected_direction ?? "up");
  const [storeId, setStoreId] = useState(effect?.store_id ?? (stores.length === 1 ? stores[0]!.id : ""));
  const [saving, setSaving] = useState(false);
  const dirty =
    metric !== (effect?.metric ?? "") ||
    direction !== (effect?.expected_direction ?? "up") ||
    (storeId || null) !== (effect?.store_id ?? (stores.length === 1 ? stores[0]!.id : null));

  async function save() {
    setSaving(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/intervention-effects/${encodeURIComponent(intervention.intervention_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: organizationId,
            metric,
            expected_direction: direction,
            store_id: storeId || null,
          }),
        },
      );
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      toast.success("Métrica objetivo guardada y medida.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const v = effect ? verdict(effect) : null;
  const change = effect?.change_relative;

  return (
    <li className="space-y-3 border-t border-separator py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{intervention.expected_state ?? intervention.intervention_id}</p>
          <p className="text-xs text-muted">
            Cerrada el {day(intervention.closed_at)} · {intervention.operational_outcome}
          </p>
        </div>
        {v ? <Badge tone={v.tone}>{v.label}</Badge> : <Badge tone="warn">Falta métrica objetivo</Badge>}
      </div>

      {effect?.measured_at && change != null ? (
        <p className="text-sm">
          {METRICS.find((m) => m.value === effect.metric)?.label}:{" "}
          <span className="font-medium">
            {change > 0 ? "+" : ""}
            {(change * 100).toFixed(1)} %
          </span>{" "}
          <span className="text-muted">
            ({effect.pre_days} días antes contra {effect.post_days} después
            {effect.maturity ? ` · ${MATURITY_ES[effect.maturity]}` : ""})
          </span>
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Select aria-label="Métrica objetivo" placeholder="Métrica objetivo" value={metric} onChange={setMetric} options={METRICS} disabled={saving} />
        <Select aria-label="Dirección esperada" value={direction} onChange={setDirection} options={DIRECTIONS} disabled={saving} />
        {stores.length > 1 ? (
          <Select
            aria-label="Tienda"
            value={storeId}
            onChange={setStoreId}
            options={[{ value: "", label: "Todas las tiendas" }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
            disabled={saving}
          />
        ) : (
          <span />
        )}
        <Button size="sm" onClick={() => void save()} disabled={saving || !metric || !dirty}>
          {saving ? "Guardando..." : effect ? "Cambiar" : "Guardar"}
        </Button>
      </div>
    </li>
  );
}

export function InterventionEffectsPanel({ organizationId }: { organizationId?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!organizationId) return;
    apiFetch(`/v1/consultant/intervention-effects?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<Payload>;
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el efecto de negocio."));
  }, [organizationId]);

  useEffect(load, [load]);

  if (!organizationId) return null;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!data) return <LoadingBlock label="Cargando efecto de negocio..." />;

  const pending = data.interventions.filter((i) => !i.effect).length;

  return (
    <Card
      id="insight-intervention-effects"
      title="¿Movió el negocio?"
      description="Qué métrica debía mover cada intervención cerrada. Se comparan las 4 semanas anteriores al arranque con las siguientes: sin grupo de control, así que no separa la intervención de la temporada."
      actions={pending ? <Badge tone="warn">{pending} sin métrica objetivo</Badge> : undefined}
    >
      {data.interventions.length ? (
        <ul>
          {data.interventions.map((intervention) => (
            <EffectRow
              key={intervention.intervention_id}
              intervention={intervention}
              stores={data.stores}
              organizationId={organizationId}
              onSaved={load}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Todavía no hay intervenciones cerradas en esta tienda.</p>
      )}
    </Card>
  );
}
