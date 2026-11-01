"use client";

import { GlobeIcon } from "lucide-react";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "./combobox";
import { useFieldControl } from "./field";

// Selector único de zona horaria: la lista IANA completa del navegador
// (`Intl.supportedValuesOf`, no caduca con los cambios de horario), agrupada
// por continente y con el desfase actual delante, como «(GMT+1) Madrid».

type Zone = { value: string; label: string; region: string };
type ZoneGroup = { value: string; items: Zone[] };

const REGIONS: Record<string, string> = {
  Europe: "Europa",
  America: "América",
  Africa: "África",
  Asia: "Asia",
  Australia: "Oceanía",
  Pacific: "Pacífico",
  Atlantic: "Atlántico",
  Indian: "Índico",
  Antarctica: "Antártida",
  Arctic: "Ártico",
};
const ORDER = [...Object.values(REGIONS), "Otras"];
// Las ciudades con nombre propio en español; el resto, como las escribe IANA.
const CITY_ES: Record<string, string> = {
  "Atlantic/Canary": "Canarias",
  "Europe/Lisbon": "Lisboa",
  "Europe/London": "Londres",
  "Europe/Paris": "París",
  "Europe/Berlin": "Berlín",
  "Europe/Rome": "Roma",
  "Europe/Amsterdam": "Ámsterdam",
  "Europe/Brussels": "Bruselas",
  "Europe/Zurich": "Zúrich",
  "Europe/Vienna": "Viena",
  "Europe/Athens": "Atenas",
  "Europe/Warsaw": "Varsovia",
  "Europe/Moscow": "Moscú",
  "America/Mexico_City": "Ciudad de México",
  "America/Bogota": "Bogotá",
  "America/Sao_Paulo": "São Paulo",
  "America/New_York": "Nueva York",
  "America/Los_Angeles": "Los Ángeles",
  "America/Havana": "La Habana",
  "America/Panama": "Panamá",
  "America/Asuncion": "Asunción",
  "Asia/Tokyo": "Tokio",
  "Asia/Shanghai": "Shanghái",
  "Asia/Singapore": "Singapur",
  "Asia/Dubai": "Dubái",
  "Asia/Seoul": "Seúl",
  "Australia/Sydney": "Sídney",
};

function offsetOf(zone: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((item) => item.type === "timeZoneName");
    return part?.value === "GMT" ? "GMT+0" : (part?.value ?? "");
  } catch {
    return "";
  }
}

function toZone(value: string): Zone {
  const [head, ...rest] = value.split("/");
  const city = CITY_ES[value] ?? (rest.length ? rest[rest.length - 1].replaceAll("_", " ") : value);
  // America/Argentina/Buenos_Aires -> «Buenos Aires (Argentina)».
  const country = rest.length > 1 ? ` (${rest[0].replaceAll("_", " ")})` : "";
  const offset = offsetOf(value);
  return { value, label: `${offset ? `(${offset}) ` : ""}${city}${country}`, region: REGIONS[head] ?? "Otras" };
}

let cache: Zone[] | null = null;
function allZones(): Zone[] {
  if (!cache) {
    let names: string[] = [];
    try {
      names = Intl.supportedValuesOf("timeZone");
    } catch {
      names = [];
    }
    cache = names.map(toZone);
  }
  return cache;
}

function groupsFor(current: string): ZoneGroup[] {
  const zones = allZones();
  const list = current && !zones.some((zone) => zone.value === current) ? [toZone(current), ...zones] : zones;
  return ORDER.map((region) => ({ value: region, items: list.filter((zone) => zone.region === region) })).filter((group) => group.items.length);
}

export function TimezoneCombobox({
  value,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabelProp,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  // En un Field lo nombra su etiqueta; suelto, «Zona horaria».
  const { inField } = useFieldControl();
  const ariaLabel = ariaLabelProp ?? (inField ? undefined : "Zona horaria");
  const groups = groupsFor(value);
  const selected = groups.flatMap((group) => group.items).find((zone) => zone.value === value) ?? null;
  return (
    <div className={className}>
      <Combobox<Zone> items={groups} value={selected} onValueChange={(zone) => zone && onChange(zone.value)} disabled={disabled} autoHighlight>
        <ComboboxInput placeholder="Busca una ciudad" aria-label={ariaLabel}>
          <GlobeIcon aria-hidden />
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxEmpty>No hay ninguna zona con ese nombre.</ComboboxEmpty>
          <ComboboxList<ZoneGroup>>
            {(group) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection<Zone>>
                  {(zone) => (
                    <ComboboxItem key={zone.value} value={zone}>
                      {zone.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
                <ComboboxSeparator />
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
