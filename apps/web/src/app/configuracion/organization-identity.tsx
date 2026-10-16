"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Button,
  Card,
  Combobox,
  Input,
  Select,
  SettingRow,
  toast,
  type ComboboxOption,
} from "@/components/ui";

/**
 * Identidad de la organización, editable.
 *
 * Era una lista de solo lectura: nombre, zona horaria y moneda solo se podían
 * tocar desde /admin/clientes, así que corregir la moneda de un cliente que no
 * factura en euros pasaba por Rafa. `updateOrganization` ya existía; lo que
 * faltaba era dejar entrar al consultor asignado (el `status` sigue siendo de
 * plataforma, porque incluye suspender y cancelar).
 */

/**
 * La lista IANA la trae el propio navegador: `Intl.supportedValuesOf` está en
 * todos los navegadores actuales y evita empaquetar una tabla de zonas que
 * caduca cada vez que un país cambia su horario de verano.
 */
function timezoneOptions(current: string): ComboboxOption[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    // Navegador sin soporte: al menos la que ya tiene, para no vaciar el campo.
    zones = [];
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones.map((zone) => ({ value: zone, label: zone }));
}

// Las que factura la cartera. Si aparece otra, se ve igual porque el valor
// guardado se añade a la lista.
const CURRENCIES = ["EUR", "USD", "GBP", "MXN", "COP", "ARS", "CLP", "BRL"];

export function OrganizationIdentity({
  organization,
  planLabel,
  canManage,
}: {
  organization: {
    id: string;
    display_name: string;
    timezone: string;
    currency_code: string;
  };
  planLabel: string;
  canManage: boolean;
}) {
  const [displayName, setDisplayName] = useState(organization.display_name);
  const [timezone, setTimezone] = useState(organization.timezone);
  const [currency, setCurrency] = useState(organization.currency_code);
  const [saving, setSaving] = useState(false);

  const dirty =
    displayName !== organization.display_name ||
    timezone !== organization.timezone ||
    currency !== organization.currency_code;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) {
      toast.danger("El nombre no puede quedar vacío.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organization.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName.trim(),
            timezone,
            currency_code: currency,
          }),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Organización actualizada", {
        description: "Recarga para verlo en toda la aplicación.",
      });
    } catch {
      toast.danger("No se pudo guardar por un error de red.");
    } finally {
      setSaving(false);
    }
  }

  const currencyOptions = (
    CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]
  ).map((code) => ({ value: code, label: code }));

  return (
    <Card
      title="Organización activa"
      description="Cómo se llama este cliente y en qué moneda y huso opera."
    >
      <form onSubmit={save}>
        <SettingRow label="Nombre" hint="Cómo aparece en informes y correos." htmlFor="org-name">
          <Input
            id="org-name"
            className="max-w-md"
            value={displayName}
            disabled={!canManage}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </SettingRow>
        <SettingRow label="Zona horaria" hint="La de las llamadas y la agenda. Las cifras diarias se cuentan en hora UTC.">
          <Combobox
            className="w-64"
            label="Zona horaria"
            value={timezone}
            options={timezoneOptions(organization.timezone)}
            onChange={setTimezone}
            placeholder="Busca una zona"
          />
        </SettingRow>
        <SettingRow label="Moneda" hint="La de la tienda. Las cifras no se convierten entre monedas.">
          <Select
            className="w-32"
            aria-label="Moneda"
            value={currency}
            onChange={setCurrency}
            options={currencyOptions}
            disabled={!canManage}
          />
        </SettingRow>
        <SettingRow label="Plan">
          <span className="text-sm">{planLabel}</span>
        </SettingRow>
        {canManage && dirty ? (
          <div className="border-t border-separator pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
