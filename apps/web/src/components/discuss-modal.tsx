"use client";

import { MessageThread } from "@/components/consultant-messages";
import { Modal } from "@/components/ui";

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
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog aria-label={`Conversación: ${title}`}>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <MessageThread
                organizationId={organizationId}
                viewerIsClient={viewerIsClient}
                initialDraft={draft}
                className="h-[60svh] min-h-72"
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
