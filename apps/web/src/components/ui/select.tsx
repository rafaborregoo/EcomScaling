"use client";

import type { Key } from "@heroui/react";
import { Select as HeroSelect, ListBox } from "@heroui/react";

export type SelectOption = { value: string; label: string };

export function Select({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className,
  required,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <HeroSelect
      className={className}
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
          {options.map((option) => (
            <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
