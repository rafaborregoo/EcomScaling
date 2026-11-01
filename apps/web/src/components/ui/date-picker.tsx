"use client";

import { useState, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { Popover as HeroPopover } from "@heroui/react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { cn } from "./cn";
import { NoField, useFieldControl } from "./field";
import { Input } from "./input";

function parseDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toDateString(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date?: Date) {
  return date?.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  id,
  placeholder = "Seleccionar fecha",
  "aria-label": ariaLabel,
}: {
  value?: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const field = useFieldControl({ id });
  const selected = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);

  return (
    <HeroPopover isOpen={open} onOpenChange={setOpen}>
      <HeroPopover.Trigger>
        <Button
          variant="outline"
          disabled={disabled}
          id={field.props.id}
          aria-label={ariaLabel}
          aria-describedby={field.props["aria-describedby"]}
          aria-invalid={field.props["aria-invalid"]}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn("w-full justify-start text-left font-normal", !selected && "text-muted", className)}
        >
          <CalendarDays aria-hidden="true" className="text-muted" />
          <span className="truncate">{formatDate(selected) ?? placeholder}</span>
        </Button>
      </HeroPopover.Trigger>
      <HeroPopover.Content placement="bottom start" className="z-50 w-fit p-0">
        <HeroPopover.Dialog aria-label={ariaLabel ?? "Elegir fecha"} className="p-3">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onChange(toDateString(date));
              setOpen(false);
            }}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            captionLayout="dropdown"
            startMonth={minDate ?? new Date(new Date().getFullYear() - 100, 0)}
            endMonth={maxDate ?? new Date(new Date().getFullYear() + 20, 11)}
          />
        </HeroPopover.Dialog>
      </HeroPopover.Content>
    </HeroPopover>
  );
}

export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  placeholder = "Seleccionar periodo",
  "aria-label": ariaLabelProp,
}: {
  value: { from?: string; to?: string };
  onChange: (value: { from?: string; to?: string }) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const field = useFieldControl();
  // En un Field lo nombra su etiqueta; suelto, este texto.
  const ariaLabel = ariaLabelProp ?? (field.inField ? undefined : "Elegir periodo");
  const from = parseDate(value.from);
  const to = parseDate(value.to);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);
  const label = from && to ? `${formatDate(from)} – ${formatDate(to)}` : from ? `${formatDate(from)} – Elige el final` : placeholder;

  return (
    <HeroPopover isOpen={open} onOpenChange={setOpen}>
      <HeroPopover.Trigger>
        <Button
          variant="outline"
          disabled={disabled}
          id={field.props.id}
          aria-label={ariaLabel}
          aria-describedby={field.props["aria-describedby"]}
          aria-invalid={field.props["aria-invalid"]}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn("w-full justify-start text-left font-normal", !from && "text-muted", className)}
        >
          <CalendarDays aria-hidden="true" className="text-muted" />
          <span className="truncate">{label}</span>
        </Button>
      </HeroPopover.Trigger>
      <HeroPopover.Content placement="bottom start" className="z-50 w-fit p-0">
        <HeroPopover.Dialog aria-label={ariaLabel ?? "Elegir periodo"} className="max-w-[calc(100vw-1rem)] overflow-x-auto p-3">
          <Calendar
            mode="range"
            selected={{ from, to }}
            onSelect={(range) => {
              onChange({ from: toDateString(range?.from) || undefined, to: toDateString(range?.to) || undefined });
              if (range?.from && range.to) setOpen(false);
            }}
            numberOfMonths={2}
            defaultMonth={from ?? minDate}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            captionLayout="dropdown"
            startMonth={minDate ?? new Date(new Date().getFullYear() - 100, 0)}
            endMonth={maxDate ?? new Date(new Date().getFullYear() + 20, 11)}
          />
        </HeroPopover.Dialog>
      </HeroPopover.Content>
    </HeroPopover>
  );
}

// Hora suelta (HH:mm). Sin el reloj nativo del navegador, que no sigue la
// paleta: se escribe o se mueve con las flechas, como en shadcn.
export function TimeInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <Input type="time" className={cn("ui-time-input", className)} {...props} />;
}

// Sustituto de <input type="datetime-local">: mismo valor "yyyy-MM-ddTHH:mm"
// en hora local, con el día en el calendario y la hora al lado. Con `name`
// viaja en un input oculto para los formularios que leen FormData.
export function DateTimePicker({
  value,
  defaultValue,
  onChange,
  name,
  min,
  max,
  disabled,
  className,
  id,
  "aria-label": ariaLabelProp,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  // En un Field la etiqueta nombra el grupo y apunta al botón del día; la hora
  // no se queda con el id del campo.
  const field = useFieldControl({ id });
  const ariaLabel = ariaLabelProp ?? "Fecha y hora";
  // Hora elegida antes que el día: se guarda hasta que haya fecha.
  const [pendingTime, setPendingTime] = useState("09:00");
  const current = value ?? inner;
  const date = current.slice(0, 10);
  const time = current.slice(11, 16) || pendingTime;

  const emit = (next: string) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  return (
    <div
      role="group"
      aria-label={field.inField && !ariaLabelProp ? undefined : ariaLabel}
      aria-labelledby={field.inField && !ariaLabelProp ? field.labelId : undefined}
      className={cn("flex w-full items-center gap-2", className)}
    >
      <NoField>
        <div className="min-w-0 flex-1">
          <DatePicker
            id={field.props.id}
            value={date}
            min={min?.slice(0, 10)}
            max={max?.slice(0, 10)}
            disabled={disabled}
            aria-label={`${ariaLabel}: día`}
            onChange={(next) => emit(next ? `${next}T${time}` : "")}
          />
        </div>
        <TimeInput
          className="w-28 shrink-0"
          value={time}
          disabled={disabled}
          aria-label={`${ariaLabel}: hora`}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) return;
            if (date) emit(`${date}T${next}`);
            else setPendingTime(next);
          }}
        />
      </NoField>
      {name ? <input type="hidden" name={name} value={current} /> : null}
    </div>
  );
}
