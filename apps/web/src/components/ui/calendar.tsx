"use client";

import type { ChangeEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayPickerProps, type DropdownProps } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { buttonVariants } from "./button";
import { cn } from "./cn";
import { Select } from "./select";

// Calendario con la API de shadcn sobre react-day-picker v9, sin su hoja de
// estilos: el aspecto va en `.ui-calendar` (globals.css). Morado para lo
// elegido, gris para hoy y el hover; las flechas son Button y los selectores
// de mes y año, nuestro Select.

export type CalendarProps = DayPickerProps;

function CalendarDropdown({ options = [], value, onChange, className, "aria-label": ariaLabel }: DropdownProps) {
  const isMonth = className?.includes("months_dropdown");
  return (
    <Select
      aria-label={ariaLabel}
      className={isMonth ? "w-[8.5rem]" : "w-[5.75rem]"}
      value={value === undefined ? "" : String(value)}
      options={options
        .filter((option) => !option.disabled)
        .map((option) => ({ value: String(option.value), label: option.label }))}
      onChange={(next) => onChange?.({ target: { value: next } } as ChangeEvent<HTMLSelectElement>)}
    />
  );
}

export function Calendar({ className, classNames, components, formatters, locale, showOutsideDays = true, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames();
  const navButton = buttonVariants({ variant: "ghost", size: "icon-sm" });

  return (
    <DayPicker
      data-slot="calendar"
      locale={locale ?? es}
      showOutsideDays={showOutsideDays}
      className={cn("ui-calendar", className)}
      classNames={{
        button_previous: cn(defaults.button_previous, navButton),
        button_next: cn(defaults.button_next, navButton),
        ...classNames,
      }}
      formatters={{
        formatMonthDropdown: (date) => {
          const month = date.toLocaleDateString("es-ES", { month: "long" });
          return month.charAt(0).toUpperCase() + month.slice(1);
        },
        ...formatters,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === "left"
            ? <ChevronLeft aria-hidden="true" className={chevronClassName} />
            : <ChevronRight aria-hidden="true" className={chevronClassName} />,
        Dropdown: CalendarDropdown,
        ...components,
      }}
      {...props}
    />
  );
}
