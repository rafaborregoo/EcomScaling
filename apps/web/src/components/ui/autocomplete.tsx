"use client";

import type { ReactNode } from "react";
import type { Key } from "@heroui/react";
import { Autocomplete as HeroAutocomplete, Description, EmptyState, Label, ListBox, SearchField, useFilter } from "@heroui/react";

export type AutocompleteOption = { value: string; label: string; hint?: string };

export function Autocomplete({
  label,
  description,
  value,
  options,
  onChange,
  placeholder = "Buscar...",
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  value: string;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <HeroAutocomplete
      className={className}
      placeholder={placeholder}
      selectionMode="single"
      value={(value || null) as Key | null}
      onChange={(key) => onChange(key ? String(key) : "")}
    >
      <Label>{label}</Label>
      <HeroAutocomplete.Trigger>
        <HeroAutocomplete.Value />
        <HeroAutocomplete.ClearButton />
        <HeroAutocomplete.Indicator />
      </HeroAutocomplete.Trigger>
      <HeroAutocomplete.Popover>
        <HeroAutocomplete.Filter filter={contains}>
          <SearchField autoFocus name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={placeholder} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>Sin resultados</EmptyState>}>
            {options.map((option) => (
              <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                {option.label}
                {option.hint ? <span className="ml-2 text-xs text-muted">{option.hint}</span> : null}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </HeroAutocomplete.Filter>
      </HeroAutocomplete.Popover>
      {description ? <Description>{description}</Description> : null}
    </HeroAutocomplete>
  );
}
