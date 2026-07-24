"use client";

import type { ReactNode } from "react";
import { Button as HeroButton, Tooltip } from "@heroui/react";

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
      className={className}
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
