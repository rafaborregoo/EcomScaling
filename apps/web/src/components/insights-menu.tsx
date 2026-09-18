"use client";

import { useEffect, useState } from "react";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { apiFetch } from "@/lib/bootstrap";
import {
  insightSpotsFromAiAssessments,
  insightSpotsFor,
  totalInsightCount,
  type InsightScope,
  type PlaybookInsightAssessment,
  type InsightSpot,
} from "@/lib/insights-registry";
import {
  cn,
  insightBadgeCount,
  IconChevronRight,
  Link,
  List,
  Modal,
  Popover,
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
export function InsightsMenu({ scope }: { scope: InsightScope }) {
  const isDesktop = useIsDesktop();
  const [isOpen, setIsOpen] = useState(false);
  const [playbookSpots, setPlaybookSpots] = useState<InsightSpot[]>([]);

  useEffect(() => {
    if (!scope.isConsultant || !scope.organizationId) {
      setPlaybookSpots([]);
      return;
    }

    let cancelled = false;
    const organizationId = encodeURIComponent(scope.organizationId);
    apiFetch(`/v1/consultant/ai-playbook-insights?organizationId=${organizationId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los insights de IA.");
        return response.json() as Promise<{ assessments: PlaybookInsightAssessment[] }>;
      })
      .then((payload) => {
        if (!cancelled) setPlaybookSpots(insightSpotsFromAiAssessments(scope, payload.assessments));
      })
      .catch(() => {
        if (!cancelled) setPlaybookSpots([]);
      });

    return () => {
      cancelled = true;
    };
  }, [scope.isConsultant, scope.organizationId, scope.connectionId]);

  const staticSpots = insightSpotsFor(scope);
  const spots = [
    ...staticSpots,
    ...playbookSpots.filter((spot) => !staticSpots.some((item) => item.id === spot.id)),
  ];
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
      <SparklesIcon aria-hidden="true" className="size-[1.15rem]" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-semibold leading-none text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
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
      <List.Item
        as="li"
        key={spot.id}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
      >
        <Link
          href={spot.href}
          className="flex min-w-0 flex-1 items-center gap-3 text-sm text-foreground no-underline"
          onClick={() => setIsOpen(false)}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-5">{spot.label}</p>
            <p className="truncate text-xs text-muted">{spot.location}</p>
          </div>
          {spotCount > 0 ? (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums text-accent">
              {spotCount}
            </span>
          ) : null}
          <IconChevronRight aria-hidden="true" className="size-3 text-muted" />
        </Link>
      </List.Item>
    );
  };

  const body =
    count === 0 ? (
      <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
        <SparklesIcon aria-hidden="true" className="size-5 text-muted" />
        <p className="text-sm text-muted">Nada que revisar ahora mismo.</p>
      </div>
    ) : (
      <List as="ul">{spots.map(row)}</List>
    );

  if (isDesktop) {
    return (
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>{trigger()}</Popover.Trigger>
        <Popover.Content
          placement="bottom end"
          className="w-[20rem] overflow-hidden rounded-xl p-0 shadow-lg"
        >
          <Popover.Dialog
            aria-label="Lo que ve la IA"
            className="flex max-h-[min(30rem,calc(100vh-6rem))] flex-col p-0"
          >
            {header}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {body}
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    );
  }

  return (
    <>
      {trigger(() => setIsOpen(true))}
      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog
              aria-label="Lo que ve la IA"
              className="w-full max-w-none overflow-hidden p-0"
            >
              {header}
              <div className="max-h-[70svh] overflow-y-auto">{body}</div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
