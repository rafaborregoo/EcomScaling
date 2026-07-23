"use client";

import { Avatar as HeroAvatar } from "@heroui/react";

type AvatarColor = "accent" | "default" | "success" | "warning" | "danger";
type AvatarSize = "sm" | "md" | "lg";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

// Avatar para clientes/leads en listas: imagen si hay `src`, iniciales del
// nombre como fallback si no (o si la imagen falla en cargar).
export function Avatar({
  name,
  src,
  size = "md",
  color = "default",
  className,
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  color?: AvatarColor;
  className?: string;
}) {
  return (
    <HeroAvatar size={size} color={color} className={className}>
      {src ? <HeroAvatar.Image alt={name} src={src} /> : null}
      <HeroAvatar.Fallback>{initials(name)}</HeroAvatar.Fallback>
    </HeroAvatar>
  );
}
