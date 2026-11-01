"use client";

import { DRAWER_THREAD, MessageThread } from "@/components/consultant-messages";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, EYEBROW } from "@/components/ui";
import { useIsDesktop } from "@/hooks/use-is-desktop";

/**
 * «Escribir sobre esto»: el chat consultor↔cliente en un cajón, con el mensaje
 * ya redactado sobre la pieza desde la que se abre (hito, acción, tarea).
 * `title` null = cerrado.
 */
export function DiscussModal({
  organizationId,
  title,
  draft,
  viewerIsClient,
  onClose,
}: {
  organizationId: string | null;
  title: string | null;
  draft: string;
  viewerIsClient: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  if (!title || !organizationId) return null;
  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      swipeDirection={isDesktop ? "right" : "down"}
      showSwipeHandle={!isDesktop}
    >
      <DrawerContent className="sm:max-w-[40rem]">
        <DrawerHeader>
          <span className={EYEBROW}>Escribir sobre esto</span>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <MessageThread
          organizationId={organizationId}
          viewerIsClient={viewerIsClient}
          initialDraft={draft}
          className={DRAWER_THREAD}
        />
      </DrawerContent>
    </Drawer>
  );
}
