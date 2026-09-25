"use client";

/**
 * F3/D02 — el contexto que declara el cliente.
 *
 * El diagnostico mira los datos; lo que los datos no dicen lo cuenta el
 * negocio: que cambio (una promocion, un cambio de precios, una agencia nueva)
 * y como se ve a si mismo (canal principal, mercado, modelo). Lo primero entra
 * en la lectura de cada senal como cambio interno declarado; lo segundo se
 * contrasta con lo observado, y si no cuadra se dice, sin decidir quien tiene
 * razon (guardrail 28).
 */

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  Badge,
  Button,
  Card,
  ErrorBlock,
  Field,
  Input,
  Select,
  Table,
  Textarea,
  toast,
  type TableColumnDef,
} from "@/components/ui";

type Fact = {
  id: string;
  dimension: string;
  value: string;
  source: "declared" | "observed";
  origin: string | null;
  effective_from: string;
};

type ChangeEvent = {
  id: string;
  event_type: string;
  description: string;
  occurred_at: string;
  ended_at: string | null;
  source: string;
};

const DIMENSIONS: { value: string; label: string; placeholder: string }[] = [
  {
    value: "main_channel",
    label: "Canal principal de ventas",
    placeholder: "Meta Ads, orgánico, email…",
  },
  {
    value: "business_model",
    label: "Modelo de negocio",
    placeholder: "Marca propia, dropshipping, suscripción…",
  },
  {
    value: "main_market",
    label: "Mercado principal",
    placeholder: "España, UE, LATAM…",
  },
  {
    value: "price_positioning",
    label: "Posicionamiento de precio",
    placeholder: "Premium, medio, low cost…",
  },
  {
    value: "seasonality",
    label: "Estacionalidad",
    placeholder: "Pico en noviembre-diciembre…",
  },
  {
    value: "growth_goal",
    label: "Objetivo de crecimiento",
    placeholder: "Rentabilidad antes que volumen…",
  },
];

// Los tipos que un cliente reconoce. El catalogo completo vive en
// CHANGE_EVENT_TYPES (@e-nora/contracts); aqui solo los que se declaran.
const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "promotion", label: "Promoción o descuento" },
  { value: "sale_event", label: "Rebajas o evento de ventas" },
  { value: "price_change", label: "Cambio de precios" },
  { value: "free_shipping", label: "Envío gratis" },
  { value: "launch", label: "Lanzamiento de producto" },
  { value: "campaign_change", label: "Cambio de campañas" },
  { value: "budget_change", label: "Cambio de presupuesto publicitario" },
  { value: "agency_change", label: "Cambio de agencia" },
  { value: "email_flow_change", label: "Cambio en emails automáticos" },
  { value: "theme_change", label: "Cambio en la web" },
  { value: "checkout_change", label: "Cambio en el checkout" },
  { value: "shipping_change", label: "Cambio en envíos" },
  { value: "inventory_event", label: "Rotura de stock" },
  { value: "market_launch", label: "Nuevo mercado" },
  { value: "external_event", label: "Algo externo (noticia, clima…)" },
];

const dimensionLabel = (value: string) =>
  DIMENSIONS.find((d) => d.value === value)?.label ?? value;
const eventLabel = (value: string) =>
  EVENT_TYPES.find((e) => e.value === value)?.label ?? value;
const day = (iso: string) => new Date(iso).toLocaleDateString("es-ES");

function FactsCard({
  organizationId,
  facts,
  onSaved,
}: {
  organizationId: string;
  facts: Fact[];
  onSaved: () => void;
}) {
  const [dimension, setDimension] = useState(DIMENSIONS[0]!.value);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/context/facts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dimension, value: value.trim() }),
        },
      );
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      setValue("");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const rows = DIMENSIONS.map((d) => {
    const declared = facts.find(
      (f) => f.dimension === d.value && f.source === "declared",
    );
    const observed = facts.find(
      (f) => f.dimension === d.value && f.source === "observed",
    );
    return { id: d.value, dimension: d.value, declared, observed };
  });

  const columns: TableColumnDef<(typeof rows)[number]>[] = [
    {
      key: "dimension",
      label: "Qué",
      render: (row) => dimensionLabel(row.dimension),
    },
    {
      key: "declared",
      label: "Lo que declaras",
      render: (row) => row.declared?.value ?? "—",
    },
    {
      key: "observed",
      label: "Lo que muestran los datos",
      render: (row) => {
        if (!row.observed) return <span className="text-muted">—</span>;
        const differs =
          row.declared &&
          row.declared.value.trim().toLowerCase() !==
            row.observed.value.trim().toLowerCase();
        return (
          <span className="flex items-center gap-2">
            {row.observed.value}
            {differs ? <Badge tone="warn">No cuadra</Badge> : null}
          </span>
        );
      },
    },
  ];

  const selected = DIMENSIONS.find((d) => d.value === dimension)!;

  return (
    <Card title="Cómo es tu negocio">
      <Table
        ariaLabel="Contexto del negocio"
        columns={columns}
        rows={rows}
        emptyLabel="—"
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-[16rem_1fr_auto] sm:items-end">
        <Field label="Qué">
          <Select
            aria-label="Qué declaras"
            value={dimension}
            onChange={setDimension}
            options={DIMENSIONS.map((d) => ({
              value: d.value,
              label: d.label,
            }))}
            disabled={saving}
          />
        </Field>
        <Field label="Valor">
          <Input
            aria-label="Valor"
            placeholder={selected.placeholder}
            maxLength={200}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={saving}
          />
        </Field>
        <Button onClick={() => void save()} disabled={saving || !value.trim()}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </Card>
  );
}

function EventsCard({
  organizationId,
  events,
  onSaved,
}: {
  organizationId: string;
  events: ChangeEvent[];
  onSaved: () => void;
}) {
  const [eventType, setEventType] = useState(EVENT_TYPES[0]!.value);
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/context/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: eventType,
            description: description.trim(),
            occurred_at: new Date(`${from}T00:00:00`).toISOString(),
            ended_at: to ? new Date(`${to}T23:59:59`).toISOString() : null,
          }),
        },
      );
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      setDescription("");
      setFrom("");
      setTo("");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/context/events/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      toast.danger(`No se pudo borrar: ${await readApiError(response)}`);
      return;
    }
    onSaved();
  }

  const columns: TableColumnDef<ChangeEvent>[] = [
    {
      key: "occurred_at",
      label: "Cuándo",
      render: (row) =>
        row.ended_at
          ? `${day(row.occurred_at)} – ${day(row.ended_at)}`
          : day(row.occurred_at),
    },
    {
      key: "event_type",
      label: "Tipo",
      render: (row) => eventLabel(row.event_type),
    },
    { key: "description", label: "Qué pasó", render: (row) => row.description },
    {
      key: "actions",
      label: "",
      render: (row) =>
        row.source === "declared" ? (
          <Button size="sm" variant="ghost" onClick={() => void remove(row.id)}>
            Borrar
          </Button>
        ) : null,
    },
  ];

  return (
    <Card title="Qué ha cambiado en tu tienda">
      <Table
        ariaLabel="Cambios declarados"
        columns={columns}
        rows={events}
        emptyLabel="Todavía no has contado ningún cambio."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <Select
            aria-label="Tipo de cambio"
            value={eventType}
            onChange={setEventType}
            options={EVENT_TYPES}
            disabled={saving}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <Input
              type="date"
              aria-label="Desde"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={saving}
            />
          </Field>
          <Field label="Hasta">
            <Input
              type="date"
              aria-label="Hasta"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              disabled={saving}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Qué pasó">
            <Textarea
              aria-label="Qué pasó"
              placeholder="Ej.: 20 % en toda la tienda por el aniversario"
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving}
            />
          </Field>
        </div>
      </div>
      <div className="mt-3">
        <Button
          onClick={() => void save()}
          disabled={saving || !from || description.trim().length < 3}
        >
          {saving ? "Guardando..." : "Añadir cambio"}
        </Button>
      </div>
    </Card>
  );
}

function ContextContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const [data, setData] = useState<{
    facts: Fact[];
    events: ChangeEvent[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    let alive = true;
    setError(null);
    void apiFetch(`/v1/organizations/${organizationId}/context`)
      .then(async (response) => {
        if (!alive) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        setData(await response.json());
      })
      .catch(() => alive && setError("No se pudo cargar el contexto."));
    return () => {
      alive = false;
    };
  }, [organizationId, reloadKey]);

  if (!organizationId) return null;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!data)
    return <AsyncState status="loading" loadingLabel="Cargando contexto..." />;

  const reload = () => setReloadKey((key) => key + 1);
  const isStaff = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  return (
    <div className="portal-page space-y-6">
      {isStaff ? null : (
        <p className="text-muted max-w-prose text-sm">
          Tu consultor y el diagnóstico leen esto junto a tus datos.
        </p>
      )}
      <FactsCard
        organizationId={organizationId}
        facts={data.facts}
        onSaved={reload}
      />
      <EventsCard
        organizationId={organizationId}
        events={data.events}
        onSaved={reload}
      />
    </div>
  );
}

export default function ContextPage() {
  return (
    <PortalShell title="Contexto del negocio">
      {(bootstrap) => <ContextContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
