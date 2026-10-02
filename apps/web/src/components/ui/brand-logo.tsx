import { cn } from "./cn";

const BRAND_LOGOS = {
  letras: "/logos/letras-completo.svg",
  completo: "/logos/e-nora-completo.svg",
  simple: "/logos/e-nora-simple.svg",
} as const;

export function BrandLogo({
  className,
  variant = "letras",
  alt = "E-NORA",
}: {
  className?: string;
  variant?: keyof typeof BRAND_LOGOS;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estatico, no necesita optimizacion de next/image
    <img
      src={BRAND_LOGOS[variant]}
      alt={alt}
      className={cn("h-5 w-auto", className)}
    />
  );
}
