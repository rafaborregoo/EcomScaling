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
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  // `bare`: trigger sin caja (sin borde ni fondo), inline sobre el mismo
  // fondo, estilo selector de proyecto de Supabase. Para la barra superior,
  // no para formularios. El look se define en globals.css (.select-bare).
  bare?: boolean;
  "aria-label"?: string;
}) {
  const renderItem = (option: SelectOption) => (
    <ListBox.Item
      key={option.value}
      id={option.value}
      textValue={option.label}
      // Sin tick: el seleccionado se distingue por color de fondo/texto.
      className="data-[selected=true]:bg-[var(--color-brand-tint)] data-[selected=true]:font-medium data-[selected=true]:text-[var(--color-brand)]"
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
      aria-label={ariaLabel}
      value={(value || null) as Key | null}
      onChange={(key) => onChange(key ? String(key) : "")}
    >
      <HeroSelect.Trigger>
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
