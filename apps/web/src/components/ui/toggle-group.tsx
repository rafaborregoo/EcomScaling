"use client";

import { createContext, useContext, type ComponentProps, type HTMLAttributes } from "react";
import { Button, type ButtonSize } from "./button";
import { cn } from "./cn";

// Grupo de interruptores con la API de shadcn (ToggleGroup type="single"):
// opciones excluyentes que cambian lo que se ve o un valor corto (periodo,
// vista Tarjetas/Tabla, filtro, Móvil · Tablet · Escritorio, alineación).
// Siempre hay una elegida: pulsar la activa no la apaga, que es lo que pedían
// todos los usos. Los valores pueden ser texto o número (7 · 30 · 90 días).
//
// Sin `spacing` se pinta pegado, como un ButtonGroup de botones `outline`
// (2-4 opciones). Con `spacing` (en pasos de 4 px, como shadcn) van sueltos y
// saltan de línea: para filtros con muchas opciones. La opción activa va en
// morado suave (`[aria-pressed="true"]` en globals.css).
//
// Para elegir en un formulario entre opciones con descripción: RadioGroup.

type Value = string | number;

type ToggleGroupContextValue = {
  value: Value;
  onValueChange: (value: Value) => void;
  size: ButtonSize;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

export function ToggleGroup<T extends Value = string>({
  value,
  onValueChange,
  size = "sm",
  spacing = 0,
  className,
  style,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value: T;
  onValueChange: (value: T) => void;
  size?: ButtonSize;
  spacing?: number;
}) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange: onValueChange as (value: Value) => void, size }}>
      <div
        role="group"
        data-slot="toggle-group"
        data-orientation="horizontal"
        data-spacing={spacing}
        className={cn(spacing ? "ui-toggle-group" : "ui-button-group", className)}
        style={spacing ? { gap: `${spacing * 0.25}rem`, ...style } : style}
        {...props}
      />
    </ToggleGroupContext.Provider>
  );
}

export function ToggleGroupItem({
  value,
  size,
  ...props
}: Omit<ComponentProps<typeof Button>, "value" | "variant" | "onClick"> & {
  value: Value;
}) {
  const group = useContext(ToggleGroupContext);
  if (!group) throw new Error("ToggleGroupItem va dentro de un ToggleGroup");
  const pressed = group.value === value;

  return (
    <Button
      data-slot="toggle-group-item"
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed}
      variant="outline"
      size={size ?? group.size}
      onClick={() => {
        if (!pressed) group.onValueChange(value);
      }}
      {...props}
    />
  );
}
