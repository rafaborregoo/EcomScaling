"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.js";

// Botones: primario negro nitido; secundario y ghost como enlaces subrayados.
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const buttonBase: Record<ButtonVariant, string> = {
  primary:
    "bg-black font-medium text-white transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "bg-brand font-medium text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "font-medium underline decoration-edge-strong decoration-1 underline-offset-4 transition hover:text-brand hover:decoration-brand disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "text-muted underline decoration-transparent underline-offset-4 transition hover:text-brand hover:decoration-brand disabled:cursor-not-allowed disabled:opacity-50",
};

const solidSizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
};

const linkSizes: Record<ButtonSize, string> = {
  sm: "text-xs",
  md: "text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const isSolid = variant === "primary" || variant === "danger";

  return (
    <button
      className={cn(isSolid ? solidSizes[size] : linkSizes[size], buttonBase[variant], className)}
      {...props}
    />
  );
}
