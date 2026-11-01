"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle, useFieldControl } from "./field";

// Grupo de radios único de la app con la API de shadcn: RadioGroup (`value` +
// `onValueChange`, o `defaultValue` sin controlar) y RadioGroupItem. Cada
// opción es un <input type="radio"> nativo con el mismo `name`: flechas,
// formularios y lector de pantalla gratis. Pintado en globals.css (`.ui-radio`).
//
// Para elegir un valor de un formulario, en lista o en tarjetas. Los filtros,
// periodos y cambios de vista (pastillas o segmentado) son ToggleGroup.
//
// Atajos, como en Checkbox: RadioGroupItem con `children` pinta el texto al
// lado; RadioCard es la tarjeta de elección (FieldLabel > Field de shadcn).

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  defaultValue: string | undefined;
  onValueChange: ((value: string) => void) | undefined;
  disabled: boolean;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export function RadioGroup<T extends string = string>({
  value,
  defaultValue,
  onValueChange,
  name,
  disabled = false,
  orientation = "vertical",
  className,
  ...props
}: Omit<ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** Nombre del campo en un <form>; si no, uno propio. */
  name?: string;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
}) {
  const id = useId();
  return (
    <RadioGroupContext.Provider
      value={{ name: name ?? id, value, defaultValue, onValueChange: onValueChange as ((value: string) => void) | undefined, disabled }}
    >
      <div
        role="radiogroup"
        data-slot="radio-group"
        data-orientation={orientation}
        aria-disabled={disabled || undefined}
        className={cn("ui-radio-group", className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  );
}

export function RadioGroupItem({
  value,
  disabled,
  children,
  className,
  onChange,
  ...props
}: Omit<ComponentProps<"input">, "type" | "value" | "name" | "checked" | "defaultChecked" | "children"> & {
  value: string;
  children?: ReactNode;
}) {
  const group = useContext(RadioGroupContext);
  if (!group) throw new Error("RadioGroupItem va dentro de un RadioGroup");
  // En un Field horizontal (con FieldLabel al lado) toma su id; con texto propio no.
  const field = useFieldControl(props).props;
  const input = (
    <input
      type="radio"
      data-slot="radio-group-item"
      name={group.name}
      value={value}
      {...(group.value !== undefined ? { checked: group.value === value } : { defaultChecked: group.defaultValue === value })}
      disabled={group.disabled || disabled}
      className={cn("ui-radio", !children && className)}
      onChange={(event) => {
        onChange?.(event);
        if (event.target.checked) group.onValueChange?.(value);
      }}
      {...props}
      {...(children ? {} : field)}
    />
  );
  if (!children) return input;
  return (
    <label data-slot="radio-field" className={cn("ui-checkbox-field", className)}>
      {input}
      <span className="ui-checkbox-field__label">{children}</span>
    </label>
  );
}

/** Tarjeta de elección: título, descripción opcional y, a la izquierda, un logo o icono. */
export function RadioCard({
  value,
  title,
  description,
  media,
  disabled,
  children,
  className,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
  disabled?: boolean;
  /** Contenido extra bajo la descripción (un ejemplo, una cifra). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <FieldLabel className={className}>
      <Field orientation="horizontal">
        {media ? <span className="ui-radio-card__media" aria-hidden="true">{media}</span> : null}
        <FieldContent>
          <FieldTitle>{title}</FieldTitle>
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          {children}
        </FieldContent>
        <RadioGroupItem value={value} disabled={disabled} />
      </Field>
    </FieldLabel>
  );
}
