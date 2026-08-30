"use client";

import type { ReactNode } from "react";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { cn } from "./cn";
import { EYEBROW } from "./typography";

export type ComboboxOption = { value: string; label: string; hint?: string };

// Migrado 2026-07-23 al ComboBox real de HeroUI (React Aria) -- reemplaza la
// implementacion propia de teclado/ARIA que tenia esta pieza. React Aria
// cubre el mismo contrato (listbox, flechas, Home/End, Escape, type-ahead)
// de forma mas robusta que la version hecha a mano.
export function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder = "Sin opciones",
  className,
}: {
  label: ReactNode;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <ComboBox
      className={className}
      selectedKey={value || null}
      onSelectionChange={(key) => onChange(key ? String(key) : "")}
      allowsEmptyCollection
    >
      <Label className={cn("block", EYEBROW)}>{label}</Label>
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox items={options} renderEmptyState={() => <span className="px-3 py-2 text-sm text-muted">Sin opciones</span>}>
          {(option) => (
            <ListBox.Item id={option.value} textValue={option.label}>
              {option.label}
              {option.hint ? <span className="ml-2 text-xs text-muted">{option.hint}</span> : null}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
