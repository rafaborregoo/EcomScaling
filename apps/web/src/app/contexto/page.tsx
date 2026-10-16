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

import { useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
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
  Dialog,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { HeroBlock, StatusStrip, heroPrimary } from "@/components/trabajo-ui";
import s from "./contexto.module.css";

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

const DIMENSIONS: {
  value: string;
  label: string;
  placeholder: string;
  suggestions: string[];
}[] = [
  {
    value: "main_channel",
    label: "Canal principal de ventas",
    placeholder: "Meta Ads, orgánico, email…",
    suggestions: ["Meta Ads", "Orgánico", "Email", "Google Ads"],
  },
  {
    value: "business_model",
    label: "Modelo de negocio",
    placeholder: "Marca propia, dropshipping, suscripción…",
    suggestions: ["Marca propia", "Dropshipping", "Suscripción", "Reventa"],
  },
  {
    value: "main_market",
    label: "Mercado principal",
    placeholder: "España, UE, LATAM…",
    suggestions: ["España", "UE", "LATAM", "Global"],
  },
  {
    value: "price_positioning",
    label: "Posicionamiento de precio",
    placeholder: "Premium, medio, low cost…",
    suggestions: ["Premium", "Medio", "Low cost"],
  },
  {
    value: "seasonality",
    label: "Estacionalidad",
    placeholder: "Pico en noviembre-diciembre…",
    suggestions: ["Pico en Navidad", "Verano", "Sin estacionalidad"],
  },
  {
    value: "growth_goal",
    label: "Objetivo de crecimiento",
    placeholder: "Rentabilidad antes que volumen…",
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

type Filter = "all" | "declared" | "detected";
const FILTERS: [Filter, string][] = [
  ["all", "Todos"],
  ["declared", "Declarados"],
  ["detected", "Detectados"],
];

const eventLabel = (value: string) =>
  EVENT_TYPES.find((e) => e.value === value)?.label ?? value;
const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const differs = (declared?: Fact, observed?: Fact) =>
  Boolean(
    declared &&
      observed &&
      declared.value.trim().toLowerCase() !==
        observed.value.trim().toLowerCase(),
  );

/** Un rasgo: lo declarado frente a lo que muestran los datos, editable en sitio. */
function FactCard({
  organizationId,
  dimension,
  declared,
  observed,
  isStaff,
  onSaved,
}: {
  organizationId: string;
  dimension: (typeof DIMENSIONS)[number];
  declared?: Fact;
  observed?: Fact;
  isStaff: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const off = differs(declared, observed);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/context/facts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dimension: dimension.value,
            value: value.trim(),
          }),
        },
      );
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const state = off ? "off" : declared ? "ok" : "empty";
  const pill = off
    ? "No cuadra"
    : declared
      ? observed
        ? "Cuadra"
        : "Declarado"
      : "Sin contar";

  return (
    <div className={s.trait} data-state={state}>
      <div className={s.traitHead}>
        <p className={s.traitName}>{dimension.label}</p>
        <span className={s.pill} data-state={state}>
          {pill}
        </span>
      </div>
      {editing ? (
        <div className="grid gap-2">
          <Input
            aria-label={dimension.label}
            placeholder={dimension.placeholder}
            maxLength={200}
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") setEditing(false);
            }}
            disabled={saving}
          />
          <div className={s.chips}>
            {dimension.suggestions.map((option) => (
              <button
                key={option}
                type="button"
                className={s.chip}
                aria-pressed={value === option}
                onClick={() => setValue(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void save()}
              disabled={saving || !value.trim()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <dl className={s.pair}>
            <div>
              <dt>{isStaff ? "Declarado" : "Lo que dices"}</dt>
              <dd data-empty={declared ? undefined : ""}>
                {declared?.value ?? "Sin contar"}
              </dd>
            </div>
            <div>
              <dt>Los datos</dt>
              <dd data-empty={observed ? undefined : ""}>
                {observed?.value ?? "Aún sin señal"}
              </dd>
            </div>
          </dl>
          {off ? (
            <p className={s.mismatch}>
              {isStaff
                ? "Lo declarado y lo observado difieren: conviene preguntarlo, no corregirlo."
                : "Tus datos cuentan otra cosa. Si ha cambiado algo, cuéntalo y lo tendremos en cuenta."}
            </p>
          ) : null}
          <div>
            <Button
              size="sm"
              variant={declared ? "ghost" : "primary"}
              onClick={() => {
                setValue(declared?.value ?? "");
                setEditing(true);
              }}
            >
              {declared ? "Editar" : "Contarlo"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function NewEventModal({
  organizationId,
  open,
  onOpenChange,
  onSaved,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [eventType, setEventType] = useState(EVENT_TYPES[0]!.value);
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
      setFrom("");
      setTo("");
      toast.success("Cambio añadido");
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title="Contar un cambio"
      isBusy={saving}
      isDirty={Boolean(description.trim())}
      primary={{
        label: "Añadir cambio",
        busyLabel: "Guardando…",
        disabled: !from || description.trim().length < 3,
        onClick: () => void save(),
      }}
    >
      <Field label="Tipo">
        <Select
          aria-label="Tipo de cambio"
          value={eventType}
          onChange={setEventType}
          options={EVENT_TYPES}
          disabled={saving}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Desde">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={saving} />
        </Field>
        <Field label="Hasta (opcional)">
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} disabled={saving} />
        </Field>
      </div>
      <Field label="Qué pasó">
        <Textarea
          placeholder="Ej.: 20 % en toda la tienda por el aniversario"
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
        />
      </Field>
    </Dialog>
  );
}

function ContextContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { data, error, reload } = useCachedQuery<{
    facts: Fact[];
    events: ChangeEvent[];
  }>(organizationId ? `/v1/organizations/${organizationId}/context` : null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  if (!organizationId) return null;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!data)
    return <AsyncState status="loading" loadingLabel="Cargando contexto..." />;

  const isStaff = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

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
  const offCount = traits.filter((t) => differs(t.declared, t.observed)).length;
  const monthAgo = now - 30 * 86_400_000;
  const events = data.events
    .slice()
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));

  const declaredCount = traits.filter((t) => t.declared).length;
  const pct = Math.round((declaredCount / traits.length) * 100);
  const shown = events.filter(
    (e) => filter === "all" || (e.source === "declared") === (filter === "declared"),
  );
  const months: { key: string; label: string; items: ChangeEvent[] }[] = [];
  for (const event of shown) {
    const date = new Date(event.occurred_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    let group = months.find((m) => m.key === key);
    if (!group) {
      group = {
        key,
        label: date.toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        }),
        items: [],
      };
      months.push(group);
    }
    group.items.push(event);
  }
  const isLive = (e: ChangeEvent) =>
    Date.parse(e.occurred_at) <= now &&
    (e.ended_at ? Date.parse(e.ended_at) >= now : false);

  return (
    <div className={`portal-page space-y-6 ${s.page}`}>
      <HeroBlock
        label={isStaff ? "Contexto del negocio" : "Mi negocio"}
        title={
          declaredCount === traits.length
            ? "Tu negocio está contado: cada señal se lee con este contexto"
            : "Lo que los datos no dicen, lo cuentas tú"
        }
        actions={
          <button
            type="button"
            className={heroPrimary}
            onClick={() => setAdding(true)}
          >
            Contar un cambio
          </button>
        }
      >
        <div className={s.progress}>
          <div
            className={s.bar}
            role="progressbar"
            aria-label="Rasgos declarados"
            aria-valuemin={0}
            aria-valuemax={traits.length}
            aria-valuenow={declaredCount}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <span className={s.progressTxt}>
            {declaredCount} de {traits.length} rasgos declarados
            {offCount ? ` · ${offCount} no cuadra con los datos` : ""}
          </span>
        </div>
      </HeroBlock>

      <StatusStrip
        items={[
          {
            value: `${declaredCount} / ${traits.length}`,
            label: "Rasgos declarados",
          },
          {
            value: offCount,
            label: "No cuadran con los datos",
            tone: offCount ? "warn" : undefined,
          },
          {
            value: events.filter((e) => Date.parse(e.occurred_at) >= monthAgo)
              .length,
            label: "Cambios en 30 días",
          },
          {
            value: events[0] ? shortDay(events[0].occurred_at) : "—",
            label: "Último cambio",
            text: true,
          },
        ]}
      />

      <Card title={isStaff ? "Cómo es el negocio" : "Cómo es tu negocio"}>
        <div className={s.traits}>
          {traits.map((trait) => (
            <FactCard
              key={trait.dimension.value}
              organizationId={organizationId}
              dimension={trait.dimension}
              declared={trait.declared}
              observed={trait.observed}
              isStaff={isStaff}
              onSaved={reload}
            />
          ))}
        </div>
      </Card>

      <Card
        title="Qué ha cambiado"
        actions={
          <div className={s.filters} role="group" aria-label="Filtrar cambios">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={s.chip}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {shown.length === 0 ? (
          <div className={s.empty}>
            <p>
              {events.length === 0
                ? isStaff
                  ? "El cliente aún no ha contado ningún cambio."
                  : "Una promoción, un cambio de precios, una agencia nueva… lo que pasó fuera de los datos explica muchas subidas y bajadas."
                : "Ningún cambio con este filtro."}
            </p>
            {events.length === 0 && !isStaff ? (
              <Button onClick={() => setAdding(true)}>Contar el primero</Button>
            ) : null}
          </div>
        ) : (
          months.map((month) => (
            <div key={month.key}>
              <p className={s.month}>{month.label}</p>
              <ol className={s.timeline}>
                {month.items.map((event) => (
                  <li
                    key={event.id}
                    className={s.event}
                    data-source={event.source}
                    data-live={isLive(event) ? "" : undefined}
                  >
                    <span className={s.date}>
                      {event.ended_at
                        ? `${shortDay(event.occurred_at)} – ${shortDay(event.ended_at)}`
                        : shortDay(event.occurred_at)}
                    </span>
                    <div className="min-w-0">
                      <div className={s.evTitle}>
                        {eventLabel(event.event_type)}
                        <Badge
                          tone={
                            event.source === "declared" ? "neutral" : "brand"
                          }
                        >
                          {event.source === "declared"
                            ? "Declarado"
                            : "Detectado"}
                        </Badge>
                        {isLive(event) ? (
                          <span className={s.live}>En curso</span>
                        ) : null}
                      </div>
                      <p className={s.evText}>{event.description}</p>
                    </div>
                    {event.source !== "declared" ? (
                      <span />
                    ) : confirmId === event.id ? (
                      <span className={s.confirm}>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmId(null)}
                        >
                          No
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmId(event.id)}
                      >
                        Borrar
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </Card>

      <NewEventModal
        organizationId={organizationId}
        open={adding}
        onOpenChange={setAdding}
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
