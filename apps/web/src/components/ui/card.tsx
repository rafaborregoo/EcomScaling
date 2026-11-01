"use client";

import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "./cn";
import { EYEBROW } from "./typography";
import { MetricInsights } from "./metric-insights";
import { useInsightForAnchor } from "@/components/insights-context";

// Tarjeta única de la app con la API de shadcn: Card > CardHeader (CardTitle,
// CardDescription, CardAction) + CardContent + CardFooter. Es un <div> nativo;
// los estilos viven en globals.css (`.ui-card`, dentro de @layer components)
// para que cualquier utilidad de Tailwind en `className` gane. El espaciado
// sale de --card-spacing (16 px; 12 px con size="sm"), y se puede cambiar por
// tarjeta con `[--card-spacing:--spacing(6)]`.
//
// Se conservan los data-slot de siempre (card, card-header, card-title,
// card-description, card-content): los temas por zona (.trabajo-theme,
// data-channel, nora-min...) cuelgan de ellos.

export type CardSize = "default" | "sm";

// El id de la tarjeta es su ancla: los hallazgos de los agentes enlazan al
// bloque de datos que los prueba, y CardTitle pinta ahí su marca ✨.
const CardAnchor = createContext<string | undefined>(undefined);

export function Card({ size = "default", className, id, ...props }: ComponentProps<"div"> & { size?: CardSize }) {
  return (
    <CardAnchor.Provider value={id}>
      <div id={id} data-slot="card" data-size={size} className={cn("ui-card", className)} {...props} />
    </CardAnchor.Provider>
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("ui-card__header", className)} {...props} />;
}

/** Antetítulo en versalitas sobre el título (extensión de E-NORA, no está en shadcn). */
export function CardKicker({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="card-kicker" className={cn(EYEBROW, "ui-card__kicker", className)} {...props} />;
}

/** Es un encabezado (h3 por defecto) para que la página conserve su esquema de títulos. */
export function CardTitle({
  as: Heading = "h3",
  className,
  children,
  ...props
}: ComponentProps<"h3"> & { as?: "h2" | "h3" | "h4" | "div" }) {
  const insight = useInsightForAnchor(useContext(CardAnchor));
  return (
    <Heading data-slot="card-title" className={cn("ui-card__title", className)} {...props}>
      {children}
      {insight && children ? (
        <MetricInsights
          metricLabel={insight.label}
          insights={insight.insights}
          href={insight.href}
          targetLabel={insight.label}
        />
      ) : null}
    </Heading>
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("ui-card__description", className)} {...props} />;
}

/** Botón, enlace o insignia arriba a la derecha de la cabecera; baja debajo si la tarjeta es estrecha. */
export function CardAction({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("ui-card__action", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("ui-card__content", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("ui-card__footer", className)} {...props} />;
}
