import { cn } from "./cn";

export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estatico, no necesita optimizacion de next/image
    <img
      src="/logos/ecomscaling-logo.svg"
      alt="EcomScaling"
      className={cn("h-5 w-auto", className)}
    />
  );
}
