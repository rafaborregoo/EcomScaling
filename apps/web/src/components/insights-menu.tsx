"use client";

import { useState } from "react";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  totalInsightCount,
  type InsightSpot,
} from "@/lib/insights-registry";
import { useInsights } from "@/components/insights-context";
import {
  ScrollArea,
  EmptyState,
  cn,
  insightBadgeCount,
  IconChevronRight,
  Link,
  List,
  NotificationBadge,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SparklesIcon,
} from "@/components/ui";

/**
 * Zona de IA del header, hermana de la campana de notificaciones: el indice de
 * todo lo que la IA tiene que decir, dos palabras por entrada. No repite el
 * contenido -- para eso esta el icono de cada card --, solo lleva hasta el.
 *
 * Al abrir el enlace, la pantalla de destino ancla en `#insight-<id>` y el
 * campo parpadea (regla `:target` en globals.css). Sin ese ancla el usuario
 * aterriza en una pagina larga sin saber que mirar.
 *
 * El ambito llega por props y no por `useActiveConnection`: este menu vive en
 * el header del shell, por ENCIMA de los proveedores de organizacion/tienda.
 */
export function InsightsMenu() {
  const isDesktop = useIsDesktop();
  const [isOpen, setIsOpen] = useState(false);
  const { spots } = useInsights();
  if (spots.length === 0) return null;
  const count = totalInsightCount(spots);

  const trigger = (onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Análisis de la IA${count > 0 ? ` (${count} puntos)` : ""}`}
      className={cn(
        "relative inline-flex size-9 items-center justify-center bg-transparent transition-colors pointer-coarse:size-11",
        count > 0 ? "text-accent" : "text-muted hover:text-foreground",
      )}
    >
      <NotificationBadge count={count}>
        <SparklesIcon aria-hidden="true" className="size-[1.15rem]" />
      </NotificationBadge>
    </button>
  );

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3">
      <p className="text-sm font-semibold tracking-[-0.01em]">Lo que ve la IA</p>
      {count > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.7rem] font-semibold leading-5 text-white">
          {count}
        </span>
      ) : null}
    </div>
  );

  const row = (spot: InsightSpot) => {
    const spotCount = insightBadgeCount(spot.insights);
    return (
      <List.Item as="li" key={spot.id}>
        <Item size="sm" className="flex-nowrap rounded-none px-4 py-3" render={<Link href={spot.href} onClick={() => setIsOpen(false)} />}>
          <ItemContent>
            <ItemTitle className="block truncate">{spot.label}</ItemTitle>
            <ItemDescription className="truncate">{spot.location}</ItemDescription>
          </ItemContent>
          <ItemActions className="flex-nowrap">
            {spotCount > 0 ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-accent">
                {spotCount}
              </span>
            ) : null}
            <IconChevronRight aria-hidden="true" className="size-3 text-muted" />
          </ItemActions>
        </Item>
      </List.Item>
    );
  };

  const body =
    count === 0 ? (
      <EmptyState size="sm" className="py-10" icon={<SparklesIcon aria-hidden="true" />} title="Nada que revisar ahora mismo" />
    ) : (
      <List as="ul">{spots.map(row)}</List>
    );

  if (isDesktop) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger render={trigger()} />
        <PopoverContent side="bottom" align="end" className="w-[20rem] gap-0 overflow-hidden p-0" aria-label="Lo que ve la IA">
          <div className="flex max-h-[min(30rem,calc(100vh_/_var(--ui-zoom)_-_6rem))] flex-col">
            {header}
            <ScrollArea className="min-h-0 flex-1 overscroll-contain">
              {body}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      {trigger(() => setIsOpen(true))}
      <Drawer open={isOpen} onOpenChange={setIsOpen} swipeDirection="down" showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Lo que ve la IA</DrawerTitle>
            {count > 0 ? <DrawerDescription>{count} por revisar</DrawerDescription> : null}
          </DrawerHeader>
          <ScrollArea className="flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)]">{body}</ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}
