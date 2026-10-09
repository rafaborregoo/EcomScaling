"use client";

import { MessageThread } from "@/components/consultant-messages";
import { Dialog } from "@/components/ui";

/**
 * «Escribir sobre esto»: el chat consultor↔cliente en un modal, con el mensaje
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
  if (!title || !organizationId) return null;
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      eyebrow="Escribir sobre esto"
      title={title}
    >
      <MessageThread
        organizationId={organizationId}
        viewerIsClient={viewerIsClient}
        initialDraft={draft}
        className="h-[min(70dvh,40rem)]"
      />
    </Dialog>
  );
}
