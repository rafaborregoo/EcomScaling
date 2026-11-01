"use client";


/**
 * FASE 3 / D10 — a partir de que cuota el dano es grave, en esta tienda.
 *
 * Va justo encima de "Cuanto dano hay": quien lee una severidad y no esta de
 * acuerdo con el corte lo cambia aqui mismo. Los de por defecto valen para
 * toda la cartera; los propios solo para esta tienda. Solo consultor.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Button, ErrorBlock, Field, Input, LoadingBlock, toast, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type Thresholds = { low: number; moderate: number; high: number; critical: number };
type Payload = { defaults: Thresholds; organization: (Thresholds & { declared_at: string }) | null; source: string };

const FIELDS: { key: keyof Thresholds; label: string }[] = [
  { key: "low", label: "Bajo desde" },
  { key: "moderate", label: "Moderado desde" },
  { key: "high", label: "Alto desde" },
  { key: "critical", label: "Crítico desde" },
];

const toPct = (v: number) => String(Number((v * 100).toFixed(2)));

export function SeverityThresholdsPanel({ organizationId }: { organizationId?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Record<keyof Thresholds, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load(payload: Payload) {
    const vigentes = payload.organization ?? payload.defaults;
    setData(payload);
    setDraft({
      low: toPct(vigentes.low),
      moderate: toPct(vigentes.moderate),
      high: toPct(vigentes.high),
      critical: toPct(vigentes.critical),
    });
  }

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    apiFetch(`/v1/consultant/severity-thresholds?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<Payload>;
      })
      .then((payload) => {
        if (!cancelled) load(payload);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los umbrales.");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  async function save(reset: boolean) {
    if (!organizationId || !draft) return;
    setSaving(true);
    try {
      const thresholds = reset
        ? null
        : Object.fromEntries(FIELDS.map(({ key }) => [key, Number(draft[key].replace(",", ".")) / 100]));
      const response = await apiFetch("/v1/consultant/severity-thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: organizationId, thresholds }),
      });
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      load((await response.json()) as Payload);
      toast.success(reset ? "Vuelve a los umbrales por defecto." : "Umbrales guardados. La severidad se recalcula ahora.");
    } finally {
      setSaving(false);
    }
  }

  if (!organizationId) return null;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!data || !draft) return <LoadingBlock label="Cargando umbrales de gravedad..." />;

  return (
    <Card id="insight-severity-thresholds">
      <CardHeader>
        <CardTitle>Cuándo es grave</CardTitle>
        <CardDescription>Qué parte de la base (ventas o pedidos del periodo) tiene que moverse para que el daño cuente como bajo, moderado, alto o crítico.</CardDescription>
        <CardAction><Badge tone={data.organization ? "brand" : "neutral"}>{data.organization ? "Propios de esta tienda" : "Por defecto"}</Badge></CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FIELDS.map(({ key, label }) => (
            <Field key={key} label={`${label} (%)`}>
              <Input
                inputMode="decimal"
                value={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                disabled={saving}
              />
            </Field>
          ))}
        </div>
        <div role="group" aria-label="Acciones de umbrales" className="flex flex-wrap items-center gap-2 mt-4">
          <Button size="sm" onClick={() => void save(false)} disabled={saving}>
            {saving ? "Guardando..." : "Guardar para esta tienda"}
          </Button>
          {data.organization ? (
            <Button size="sm" variant="ghost" onClick={() => void save(true)} disabled={saving}>
              Volver a los de por defecto
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
