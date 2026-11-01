"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { cn } from "./cn";

// Avatar único de la app, con la API de shadcn: Avatar > AvatarImage +
// AvatarFallback (+ AvatarBadge), y AvatarGroup > Avatar… + AvatarGroupCount.
// Nativo, como Button: un <img> que solo se enseña cuando ha cargado; hasta
// entonces (o si falla, o no hay foto) se ven las iniciales del fallback.
// Estilos: `.ui-avatar` en globals.css.

type ImageStatus = "idle" | "loading" | "loaded" | "error";
type AvatarContextValue = { status: ImageStatus; setStatus: (status: ImageStatus) => void };

const AvatarContext = createContext<AvatarContextValue | null>(null);

function useAvatar(name: string) {
  const context = useContext(AvatarContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <Avatar>`);
  return context;
}

/** Iniciales para el fallback: «Ana García López» → «AL»; vacío → «?». */
export function avatarInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  size = "default",
  className,
  ...props
}: ComponentProps<"span"> & { size?: "default" | "sm" | "lg" }) {
  const [status, setStatus] = useState<ImageStatus>("idle");
  return (
    <AvatarContext.Provider value={{ status, setStatus }}>
      <span data-slot="avatar" data-size={size} className={cn("ui-avatar", className)} {...props} />
    </AvatarContext.Provider>
  );
}

export function AvatarImage({ src, alt = "", className, ...props }: ComponentProps<"img">) {
  const { status, setStatus } = useAvatar("AvatarImage");
  const ref = useRef<HTMLImageElement>(null);

  // Cada `src` nuevo vuelve a "cargando" (una foto recién subida no hereda el
  // error de la anterior). Si la imagen ya estaba en caché y cargó antes de
  // hidratar, el onLoad no llega: se mira `complete` al montar.
  useEffect(() => {
    if (!src) {
      setStatus("idle");
      return;
    }
    const image = ref.current;
    setStatus(image?.complete ? (image.naturalWidth > 0 ? "loaded" : "error") : "loading");
  }, [src, setStatus]);

  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatares de cualquier origen (storage, presets), sin optimizador.
    <img
      ref={ref}
      src={typeof src === "string" ? src : undefined}
      alt={alt}
      data-slot="avatar-image"
      data-status={status}
      className={cn("ui-avatar__image", className)}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: ComponentProps<"span">) {
  const { status } = useAvatar("AvatarFallback");
  if (status === "loaded") return null;
  return <span data-slot="avatar-fallback" className={cn("ui-avatar__fallback", className)} {...props} />;
}

export function AvatarBadge({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="avatar-badge" className={cn("ui-avatar__badge", className)} {...props} />;
}

export function AvatarGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="avatar-group" className={cn("ui-avatar-group", className)} {...props} />;
}

export function AvatarGroupCount({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="avatar-group-count" className={cn("ui-avatar ui-avatar-group__count", className)} {...props} />;
}
