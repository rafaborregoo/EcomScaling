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
  title,
  children,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-label": ariaLabel,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  title?: string;
  children?: ReactNode;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-label"?: string;
}) {
  const button = (
    <HeroButton
      type={type}
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
