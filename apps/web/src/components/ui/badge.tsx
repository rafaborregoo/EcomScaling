"use client";

import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "brand" | "success" | "warn" | "danger";
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
type LegacyVariant = "soft" | "solid";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-transparent bg-accent text-accent-foreground",
  secondary: "border-transparent bg-foreground/5 text-foreground",
  destructive: "border-transparent bg-danger text-white",
  outline: "border-separator bg-transparent text-foreground",
  ghost: "border-transparent",
  link: "border-transparent bg-transparent text-accent underline-offset-4 hover:underline",
};

const toneClasses: Record<Tone, string> = {
  neutral: "border-transparent bg-foreground/5 text-muted",
  brand: "border-accent/20 bg-accent-soft text-accent",
  success: "border-success/20 bg-success/10 text-success",
  warn: "border-warning/25 bg-warn-tint text-warning",
  danger: "border-danger/20 bg-danger/10 text-danger",
};

const solidToneClasses: Record<Tone, string> = {
  neutral: "border-transparent bg-default-300 text-foreground",
  brand: "border-transparent bg-accent text-accent-foreground",
  success: "border-transparent bg-success text-white",
  warn: "border-transparent bg-warning text-white",
  danger: "border-transparent bg-danger text-white",
};

const baseClass =
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap leading-4 transition-colors [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0 [&_svg[data-icon=inline-start]]:ml-[-0.125rem] [&_svg[data-icon=inline-end]]:mr-[-0.125rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type BadgeProps = Omit<ComponentProps<"span">, "color"> & {
  variant?: BadgeVariant | LegacyVariant;
  /** Semantic status colors retained for the app's existing call sites. */
  tone?: Tone;
  /** Render an anchor or another element with the badge styles. */
  render?: ReactElement;
};

export function Badge({
  variant = "secondary",
  tone,
  render,
  className,
  children,
  ...props
}: BadgeProps) {
  const resolvedVariant: BadgeVariant =
    variant === "soft" ? "secondary" : variant === "solid" ? "default" : variant;
  const styleClass = tone
    ? variant === "solid"
      ? solidToneClasses[tone]
      : toneClasses[tone]
    : variantClasses[resolvedVariant];
  const sharedProps = {
    ...props,
    "data-slot": "badge",
    "data-variant": resolvedVariant,
    className: cn(baseClass, styleClass, className),
  };

  if (render) {
    return cloneElement(render, {
      ...sharedProps,
      children: children ?? (render.props as { children?: ReactNode }).children,
    } as ComponentProps<"a">);
  }

  return <span {...sharedProps}>{children}</span>;
}
