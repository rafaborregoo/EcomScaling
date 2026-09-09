"use client";

import type { Key } from "@heroui/react";
import { Header, Select as HeroSelect, ListBox } from "@heroui/react";
import { cn } from "./cn";

// `section`: agrupa opciones bajo un encabezado en el popover. Si ninguna opcion
// lo trae, la lista se renderiza plana (comportamiento por defecto).
export type SelectOption = { value: string; label: string; section?: string };

export function Select({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className,
  required,
  disabled,
  bare,
  invalid,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  // El campo que quedo mal: marca el trigger como invalido para el lector de
  // pantalla. El texto del error se enlaza con `aria-describedby`.
  invalid?: boolean;
  // `bare`: trigger sin caja (sin borde ni fondo), inline sobre el mismo
  // fondo, estilo selector de proyecto de Supabase. Para la barra superior,
  // no para formularios. El look se define en globals.css (.select-bare).
  bare?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const renderItem = (option: SelectOption) => (
    <ListBox.Item
      key={option.value}
      id={option.value}
      textValue={option.label}
      // Sin tick: el seleccionado se distingue por color de fondo/texto.
      className="data-[selected=true]:bg-accent-soft data-[selected=true]:font-medium data-[selected=true]:text-accent"
    >
      {option.label}
    </ListBox.Item>
  );

  // Preserva el orden de aparicion de cada seccion; las opciones sin `section`
  // se listan sueltas antes de los grupos.
  const sectionNames = [
    ...new Set(
      options.map((option) => option.section).filter((name): name is string => Boolean(name)),
    ),
  ];
  const looseOptions = options.filter((option) => !option.section);

  return (
    <HeroSelect
      className={cn(bare && "select-bare", className)}
      placeholder={placeholder}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={invalid}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      value={(value || null) as Key | null}
      onChange={(key) => onChange(key ? String(key) : "")}
    >
      {/* Mismo minimo tactil de 44px que Button: el trigger de HeroUI ronda
          los 36px, que con el dedo se falla. */}
      <HeroSelect.Trigger className="pointer-coarse:min-h-11">
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox>
          {looseOptions.map(renderItem)}
          {sectionNames.map((name) => (
            <ListBox.Section key={name}>
              <Header className="px-2 py-1 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted">
                {name}
              </Header>
              {options.filter((option) => option.section === name).map(renderItem)}
            </ListBox.Section>
          ))}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
