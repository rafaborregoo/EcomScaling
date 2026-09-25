"use client";

/**
 * FASE 3 / D03 — de que es capaz el negocio, en pantalla.
 *
 * Es la pregunta que va **antes** que las otras tres del diagnostico. `D01`
 * dice si el dato aguanta, `D02` que significa un movimiento y `D06` que patron
 * forman juntos; esto dice de que es capaz el negocio que produjo todo eso.
 *
 * LO QUE LA HACE UTIL ES LA SEGUNDA MITAD. La lista de capacidades observadas
 * esta bien; la lista de **lo que el dato no puede ver, con su numero**, es la
 * que convierte "no conozco a este cliente" en una agenda de primera llamada.
 * Por eso no va en un pie en gris: va en su propio bloque, y los huecos que se
 * cierran conectando algo van antes que los que hay que preguntar.
 *
 * Solo consultor. "Tu retencion es a ratos" dicho sin acompanamiento es un
 * juicio, no una ayuda.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
  Select,
  toast,
} from "@/components/ui";

import {
  capabilityLabel,
  changeLabel,
  formatMeasure,
  gapLabel,
  levelLabel,
  missingDimensions,
  REQUIRED_LEVEL_OPTIONS,
  sortUnobserved,
  type CapabilityView,
  type MaturityDeclarationView,
  type MaturityProfileView,
} from "./maturity-view-model";

/**
 * Lo que el dato no puede ver lo dice el consultor: si la medida cambia
 * decisiones y quien responde de la capacidad. Solo eso levanta el techo de
 * "definida" a "medida", y solo si el dato ya demuestra la medicion.
 */
function DeclarationForm({
  organizationId,
  capability,
  declaration,
  onSaved,
}: {
  organizationId: string;
  capability: string;
  declaration: MaturityDeclarationView | undefined;
  onSaved: () => void;
}) {
  const [influences, setInfluences] = useState(declaration?.influences_decisions ?? false);
  const [ownership, setOwnership] = useState(declaration?.has_ownership ?? false);
  const [ownerRole, setOwnerRole] = useState(declaration?.owner_role ?? "");
  const [requiredLevel, setRequiredLevel] = useState(declaration?.required_level ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await apiFetch("/v1/consultant/maturity/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organizationId,
          capability,
          influences_decisions: influences,
          has_ownership: ownership,
          owner_role: ownership && ownerRole.trim() ? ownerRole.trim() : null,
          required_level: requiredLevel || null,
        }),
      });
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      toast.success("Declaración guardada.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Select
        aria-label="Qué necesita este negocio"
        className="w-60"
        placeholder="Qué necesita este negocio"
        value={requiredLevel}
        onChange={setRequiredLevel}
        options={REQUIRED_LEVEL_OPTIONS}
        disabled={saving}
      />
      <Checkbox checked={influences} onChange={setInfluences} disabled={saving}>
        La medida cambia decisiones
      </Checkbox>
      <Checkbox checked={ownership} onChange={setOwnership} disabled={saving}>
        Tiene responsable
      </Checkbox>
      {ownership ? (
        <Input
          aria-label="Rol del responsable"
          className="w-48"
          placeholder="Rol del responsable"
          maxLength={60}
          value={ownerRole}
          onChange={(event) => setOwnerRole(event.target.value)}
          disabled={saving}
        />
      ) : null}
      <Button size="sm" variant="secondary" onClick={() => void save()} disabled={saving}>
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

function CapabilityRow({
  capability,
  organizationId,
  declaration,
  onSaved,
}: {
  capability: CapabilityView;
  organizationId: string;
  declaration: MaturityDeclarationView | undefined;
  onSaved: () => void;
}) {
  const nivel = levelLabel(capability.current_level);
  const brecha = gapLabel(capability);
  const faltan = missingDimensions(capability);

  return (
    <li className="border-t border-default-200 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{capabilityLabel(capability.capability)}</span>
        <Badge tone={nivel.tone}>{nivel.label}</Badge>
        <Badge tone={brecha.tone}>{brecha.label}</Badge>
      </div>

      {nivel.detail ? (
        <p className="mt-1 max-w-prose text-sm leading-6">{nivel.detail}</p>
      ) : null}

      {capability.evidence.map((e) => (
        <p key={e.description} className="text-muted mt-2 max-w-prose text-sm leading-6">
          {e.description}
        </p>
      ))}

      {faltan.length > 0 ? (
        <p className="text-muted mt-2 text-xs">Para el siguiente escalón: {faltan.join("; ")}.</p>
      ) : null}

      <DeclarationForm
        organizationId={organizationId}
        capability={capability.capability}
        declaration={declaration}
        onSaved={onSaved}
      />
    </li>
  );
}

function ProfileCard({
  profile,
  onSaved,
}: {
  profile: MaturityProfileView;
  onSaved: () => void;
}) {
  const cambio = changeLabel(profile.change_type);
  const huecos = sortUnobserved(profile.unobserved);

  return (
    <Card
      title={
        profile.organization_name
          ? `De qué es capaz ${profile.organization_name}`
          : "De qué es capaz el negocio"
      }
      description="Lo que el dato de la tienda demuestra, y lo que no puede ver. Ninguna de estas dos listas es una nota."
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone={cambio.tone}>{cambio.label}</Badge>
        {profile.change_summary ? (
          <span className="text-muted text-sm">{profile.change_summary}</span>
        ) : null}
      </div>

      {profile.complexity.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {profile.complexity.map((m) => (
            <div key={m.key}>
              <p className="text-muted text-xs uppercase tracking-wide">{m.label}</p>
              <p className="font-mono tabular-nums">{formatMeasure(m)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {profile.capabilities.length > 0 ? (
        <ul className="mt-5">
          {profile.capabilities.map((c) => (
            <CapabilityRow
              key={c.id}
              capability={c}
              organizationId={profile.organization_id}
              declaration={profile.declarations?.find(
                (d) => d.capability === c.capability,
              )}
              onSaved={onSaved}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Sin capacidades observadas"
          hint="El dato de esta tienda todavía no demuestra ninguna capacidad."
        />
      )}

      {huecos.length > 0 ? (
        // La mitad util de la pantalla. Un hueco con su numero es una pregunta
        // concreta para la llamada; sin el numero es un encogimiento de hombros.
        <div className="mt-6 border-t border-default-200 pt-4">
          <p className="font-medium">Lo que el dato no puede ver</p>
          <p className="text-muted mt-1 max-w-prose text-sm leading-6">
            No es que el negocio no lo tenga: es que desde aquí no se sabe. Lo de arriba se
            arregla conectando o rellenando algo; lo de abajo se pregunta.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {huecos.map((h) => (
              <li key={h.capability} className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{capabilityLabel(h.capability)}</span>
                <span className="text-muted">{h.reason}</span>
                {h.actionable ? <Badge tone="warn">Se puede cerrar</Badge> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

export function MaturityPanel() {
  const [profiles, setProfiles] = useState<MaturityProfileView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/maturity")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as { profiles: MaturityProfileView[] };
        setProfiles(payload.profiles);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la madurez por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (isLoading && !profiles) {
    return <LoadingBlock label="Leyendo de qué es capaz el negocio..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!profiles || profiles.length === 0) return null;

  return (
    <div className="space-y-6">
      {profiles.map((p) => (
        <ProfileCard
          key={p.id}
          profile={p}
          onSaved={() => setReloadKey((key) => key + 1)}
        />
      ))}
    </div>
  );
}
