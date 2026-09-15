"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "./cn";

// El logo de la plataforma, por id de proveedor.
//
// Existia como `PlatformIcon` dentro de /dashboard y en ningun sitio mas: las
// integraciones se listaban sin una sola senal visual, todas iguales salvo por
// el texto. Vive aqui para que cualquier pantalla que nombre un proveedor pueda
// ensenarlo.
//
// Un recurso de marca ausente (klaviyo todavia no tiene svg) no puede dejar un
// icono roto ni quitar la senal: cae a la inicial dentro del mismo hueco.
const LOGOS: Record<string, { src: string; fallback: string }> = {
  shopify: { src: "/shopify-svgrepo-com.svg", fallback: "S" },
  meta: { src: "/meta-logo-facebook-svgrepo-com.svg", fallback: "M" },
  meta_ads: { src: "/meta-logo-facebook-svgrepo-com.svg", fallback: "M" },
  klaviyo: { src: "/logos/klaviyo.svg", fallback: "K" },
  instagram: { src: "/logos/instagram.svg", fallback: "I" },
  fathom: { src: "/logos/fathom.svg", fallback: "F" },
};

export function ProviderIcon({
  provider,
  alt = "",
  size = 16,
  className,
}: {
  provider: string;
  /** Vacio (por defecto) cuando el nombre del proveedor ya esta escrito al lado. */
  alt?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const logo = LOGOS[provider];
  const box = { width: size, height: size };

  if (!logo || failed) {
    return (
      <span
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={box}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm border border-edge font-mono text-[0.6rem] font-semibold uppercase",
          className,
        )}
      >
        {logo?.fallback ?? provider.slice(0, 1)}
      </span>
    );
  }

  return (
    <Image
      src={logo.src}
      alt={alt}
      width={size}
      height={size}
      style={box}
      className={cn("shrink-0 object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}
