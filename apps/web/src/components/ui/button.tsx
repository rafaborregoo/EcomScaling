"use client";

import type { ReactNode } from "react";
import { Button as HeroButton, Tooltip } from "@heroui/react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

// React Aria's Button (base de HeroUI) no acepta onClick -- solo onPress.
// Los call sites actuales de este proyecto siempre pasan callbacks sin usar
// el evento (onClick={regenerate}, onClick={() => setTab(...)}), asi que
// traducir a onPress sin reenviar el evento es seguro aqui.
export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  onClick,
  type = "button",
  form,
  title,
  children,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  // Id del <form> al que pertenece un `type="submit"` que vive fuera de el:
  // el pie de un Dialog envia el formulario del cuerpo sin anidarlo.
  form?: string;
  title?: string;
  children?: ReactNode;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-label"?: string;
  // Botones que son un interruptor (un filtro activado/desactivado): sin esto
  // el lector de pantalla lee la etiqueta y no dice si esta puesto o quitado.
  "aria-pressed"?: boolean;
}) {
  const button = (
    <HeroButton
      type={type}
      form={form}
      variant={variant}
      size={size}
      isDisabled={disabled}
      className={cn(
        "min-w-20 font-medium tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2",
        // 32/36px valen con raton; con el dedo el minimo usable son 44px. La
        // variante `pointer-coarse` lo aplica por capacidad del dispositivo,
        // no por ancho de viewport -- un portatil tactil tambien lo necesita.
        size === "sm" ? "min-h-8 pointer-coarse:min-h-11" : "min-h-9 pointer-coarse:min-h-11",
        className,
      )}
      onPress={onClick}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {children}
    </HeroButton>
  );

  // El Button de HeroUI (react-aria-components) no acepta el atributo nativo
  // `title` -- se usa el Tooltip real de HeroUI en su lugar (mejor que el
  // tooltip nativo del navegador: accesible, con retraso configurable).
  if (!title) {
    return button;
  }

  return (
    <Tooltip delay={300}>
      {button}
      <Tooltip.Content>
        <p>{title}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
