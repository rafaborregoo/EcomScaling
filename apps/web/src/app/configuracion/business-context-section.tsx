"use client";
import { DateRangePicker } from "@/components/ui";

/**
 * F3/D02 — el contexto que declara el cliente.
 *
 * El diagnostico mira los datos; lo que los datos no dicen lo cuenta el
 * negocio: como se ve a si mismo (canal principal, mercado, modelo) y que
 * cambio (una promocion, un cambio de precios, una agencia nueva). Lo primero
 * se contrasta con lo observado y, si no cuadra, se dice sin decidir quien
 * tiene razon (guardrail 28); lo segundo entra en la lectura de cada senal
 * como cambio interno declarado.
 */

import { useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorBlock,
  Field,
  Input,
  Select,
  SettingRow,
  Textarea,
  toast,
  Card,
  CardContent,
} from "@/components/ui";

type Fact = {
  id: string;
  dimension: string;
  value: string;
  source: "declared" | "observed";
};

type ChangeEvent = {
  id: string;
  event_type: string;
  description: string;
  occurred_at: string;
  ended_at: string | null;
  source: string;
};

const DIMENSIONS: {
  value: string;
  label: string;
  hint: string;
  suggestions: string[];
}[] = [
  {
    value: "main_channel",
    label: "Canal principal",
    hint: "De dónde viene la mayoría de las ventas.",
    suggestions: ["Meta Ads", "Orgánico", "Email", "Google Ads"],
  },
  {
    value: "business_model",
    label: "Modelo de negocio",
    hint: "Cómo ganas dinero.",
    suggestions: ["Marca propia", "Dropshipping", "Suscripción", "Reventa"],
  },
  {
    value: "main_market",
    label: "Mercado principal",
    hint: "Dónde vendes más.",
    suggestions: ["España", "UE", "LATAM", "Global"],
  },
  {
    value: "price_positioning",
    label: "Precio",
    hint: "Dónde te colocas frente a la competencia.",
    suggestions: ["Premium", "Medio", "Low cost"],
  },
  {
    value: "seasonality",
    label: "Estacionalidad",
    hint: "Cuándo se concentran las ventas.",
    suggestions: ["Pico en Navidad", "Verano", "Sin estacionalidad"],
  },
  {
    value: "growth_goal",
    label: "Objetivo",
    hint: "Qué priorizas ahora.",
    suggestions: [
      "Rentabilidad antes que volumen",
      "Crecer en volumen",
      "Más recompra",
    ],
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

const OTHER = "__other__";


const eventLabel = (value: string) =>
  EVENT_TYPES.find((e) => e.value === value)?.label ?? value;
const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const sameValue = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Un rasgo: selector con las opciones habituales, "Otro…" libre y lo que dicen los datos. */
function TraitRow({
  organizationId,
  dimension,
  declared,
  observed,
  onSaved,
}: {
  organizationId: string;
  dimension: (typeof DIMENSIONS)[number];
  declared?: Fact;
  observed?: Fact;
  onSaved: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = declared?.value ?? "";
  const isCustom =
    Boolean(current) &&
    !dimension.suggestions.some((option) => sameValue(option, current));
  const off = Boolean(
    declared && observed && !sameValue(declared.value, observed.value),
  );
  const options = [
    ...dimension.suggestions.map((option) => ({ value: option, label: option })),
    ...(isCustom ? [{ value: current, label: current }] : []),
    { value: OTHER, label: "Otro…" },
  ];

  async function save(raw: string) {
    const value = raw.trim();
    if (!value || sameValue(value, current)) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/context/facts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dimension: dimension.value, value }),
        },
      );
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      setCustom("");
      setOtherOpen(false);
      toast.success(`${dimension.label} guardado`);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingRow
      label={<span className="text-base font-semibold">{dimension.label}</span>}
      hint={
        <span className="text-sm">
          {dimension.hint}
          {observed ? (
            <>
              {" "}
              Los datos indican:{" "}
              <span className={off ? "font-medium text-warn-deep" : "font-medium"}>
                {observed.value}
              </span>
              {off ? " — no coincide con lo que cuentas." : "."}
            </>
          ) : null}
        </span>
      }
    >
      <div className="w-full max-w-xs">
        <Select
          aria-label={dimension.label}
          placeholder="Elegir…"
          value={otherOpen ? OTHER : current}
          options={options}
          disabled={saving}
          onChange={(value) => {
            if (value === OTHER) setOtherOpen(true);
            else {
              setOtherOpen(false);
              void save(value);
            }
          }}
        />
      </div>
      {otherOpen ? (
        <div className="w-full max-w-xs">
          <Input
            aria-label={`${dimension.label}: otro valor`}
            placeholder="Escríbelo y pulsa Enter"
            maxLength={200}
            value={custom}
            autoFocus
            disabled={saving}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save(custom);
            }}
            onBlur={() => void save(custom)}
          />
        </div>
      ) : null}
    </SettingRow>
  );
}

function NewEventModal({
  organizationId,
  open,
  onOpenChange,
  onSaved,
  initialType,
}: {
  organizationId: string;
  initialType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [eventType, setEventType] = useState(initialType);
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
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
      setTo("");
      toast.success("Cambio añadido");
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} busy={saving} dirty={Boolean(description.trim())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir un cambio</DialogTitle>
        </DialogHeader>
        <Field label="Tipo">
          <Select
            aria-label="Tipo de cambio"
            value={eventType}
            onChange={setEventType}
            options={EVENT_TYPES}
            disabled={saving}
          />
        </Field>
        <Field label="Periodo (fecha final opcional)">
          <DateRangePicker
            value={{ from, to }}
            onChange={(range) => {
              setFrom(range.from ?? "");
              setTo(range.to ?? "");
            }}
            disabled={saving}
            aria-label="Elegir periodo del contexto comercial"
          />
        </Field>
        <Field label="Qué pasó">
          <Textarea
            placeholder="Ej.: 20 % en toda la tienda por el aniversario"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={saving}
          />
        </Field>
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button disabled={saving || !from || description.trim().length < 3} onClick={() => void save()}>{saving ? "Guardando…" : "Añadir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BusinessContextSection({
  organizationId,
  isConsultant,
}: {
  organizationId: string;
  isConsultant: boolean;
}) {
  const { data, error, reload } = useCachedQuery<{
    facts: Fact[];
    events: ChangeEvent[];
  }>(`/v1/organizations/${organizationId}/context`);
  const [adding, setAdding] = useState(false);
  const [draftType, setDraftType] = useState(EVENT_TYPES[0]!.value);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!data)
    return <AsyncState status="loading" loadingLabel="Cargando contexto..." />;

  const tell = (type = EVENT_TYPES[0]!.value) => {
    setDraftType(type);
    setAdding(true);
  };

  async function remove(id: string) {
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/context/events/${id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      toast.danger(`No se pudo borrar: ${await readApiError(response)}`);
      return;
    }
    reload();
  }

  const traits = DIMENSIONS.map((dimension) => ({
    dimension,
    declared: data.facts.find(
      (f) => f.dimension === dimension.value && f.source === "declared",
    ),
    observed: data.facts.find(
      (f) => f.dimension === dimension.value && f.source === "observed",
    ),
  }));
  const declaredCount = traits.filter((t) => t.declared).length;
  const events = data.events
    .slice()
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  const isLive = (e: ChangeEvent) =>
    Date.parse(e.occurred_at) <= now &&
    (e.ended_at ? Date.parse(e.ended_at) >= now : false);

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <CardContent>
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight">
                {isConsultant ? "Cómo es el negocio" : "Cómo es tu negocio"}
              </h2>
              <p className="mt-1.5 text-base text-muted">
                {isConsultant
                  ? "Los datos dicen qué pasó; el cliente sabe por qué. Lo declarado se contrasta con lo observado."
                  : "Los números dicen qué pasó; tú sabes por qué. Lo que cuentes aquí se tiene en cuenta al leer tus señales."}
              </p>
            </div>
            <Badge tone={declaredCount === traits.length ? "success" : "neutral"}>
              {declaredCount} de {traits.length}
            </Badge>
          </div>
          {traits.map((trait) => (
            <TraitRow
              key={trait.dimension.value}
              organizationId={organizationId}
              dimension={trait.dimension}
              declared={trait.declared}
              observed={trait.observed}
              onSaved={reload}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight">Qué ha cambiado</h2>
              <p className="mt-1.5 text-base text-muted">
                {isConsultant
                  ? "Cambios que el cliente ha declarado y los que detectamos."
                  : "Una promoción, un cambio de precios, una agencia nueva… explican muchas subidas y bajadas."}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <div className="w-full sm:w-64">
                <Select
                  aria-label="Añadir un cambio por tipo"
                  placeholder="¿Qué ha pasado?"
                  value=""
                  options={EVENT_TYPES}
                  onChange={(type) => type && tell(type)}
                />
              </div>
              <Button onClick={() => tell()}>Añadir cambio</Button>
            </div>
          </div>
          {events.length === 0 ? (
            <p className="border-t border-separator pt-4 text-base text-muted">
              {isConsultant
                ? "El cliente aún no ha contado ningún cambio."
                : "Aún no has contado ningún cambio."}
            </p>
          ) : (
            <ul>
              {events.map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-start gap-4 border-t border-separator py-4"
                >
                  <span className="pt-0.5 text-sm tabular-nums text-muted">
                    {event.ended_at
                      ? `${shortDay(event.occurred_at)} – ${shortDay(event.ended_at)}`
                      : shortDay(event.occurred_at)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
                      {eventLabel(event.event_type)}
                      {isLive(event) ? <Badge tone="success">En curso</Badge> : null}
                      {event.source !== "declared" ? (
                        <Badge tone="brand">Detectado</Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 break-words text-base text-muted">
                      {event.description}
                    </p>
                  </div>
                  {event.source !== "declared" ? (
                    <span />
                  ) : confirmId === event.id ? (
                    <span className="flex items-center gap-1 text-sm text-muted">
                      ¿Borrar?
                      <Button
                        size="sm"
                        onClick={() => {
                          setConfirmId(null);
                          void remove(event.id);
                        }}
                      >
                        Sí
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                        No
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(event.id)}>
                      Borrar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewEventModal
        key={draftType}
        initialType={draftType}
        organizationId={organizationId}
        open={adding}
        onOpenChange={setAdding}
        onSaved={reload}
      />
    </div>
  );
}
