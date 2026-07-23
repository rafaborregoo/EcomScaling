"use client";

import type { ReactNode } from "react";
import { Badge as HeroBadge } from "@heroui/react";

// HeroUI tiene dos componentes de nombre parecido: Chip (nuestro Badge de
// tono/estado, ver badge.tsx) y este Badge -- un punto/contador anclado a
// una esquina de otro elemento (avatar, icono). Renombrado para no chocar.
type NotificationColor = "accent" | "default" | "success" | "warning" | "danger";
type NotificationPlacement = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export function NotificationBadge({
  children,
  count,
  color = "danger",
  placement = "top-right",
  size = "sm",
  className,
}: {
  children: ReactNode;
  count?: ReactNode;
  color?: NotificationColor;
  placement?: NotificationPlacement;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <HeroBadge.Anchor className={className}>
      {children}
      <HeroBadge color={color} placement={placement} size={size}>
        {count}
      </HeroBadge>
    </HeroBadge.Anchor>
  );
}
