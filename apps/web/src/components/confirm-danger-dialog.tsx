"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/ui";

/**
 * Confirmacion para acciones de riesgo (borrar cliente, borrar tienda): exige
 * escribir el nombre exacto antes de habilitar el boton. Mas seguro que un
 * window.confirm generico sin ser un modal pesado. Desde R-008 (2026-07-21)
 * el borrado real es soft-delete con periodo de gracia, no inmediato -- `note`
 * es donde cada caller declara ese dato factual (p. ej. "30 dias para
 * restaurar"), no una explicacion larga.
 *
 * Migrado 2026-07-23 al Modal real de HeroUI (react-aria): foco atrapado,
 * cierre con Escape y overlay ya los da el primitivo, no hace falta
 * reimplementarlos a mano.
 */
export function ConfirmDangerDialog({
  title,
  note,
  confirmPhrase,
  actionLabel,
  onConfirm,
  onCancel,
  isBusy,
}: {
  title: string;
  note?: string;
  confirmPhrase: string;
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy: boolean;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmPhrase;

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isBusy && onCancel()}>
      <Modal.Backdrop isDismissable={!isBusy}>
        <Modal.Container size="sm">
          <Modal.Dialog aria-describedby="confirm-danger-instructions">
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {note ? <p className="font-mono text-xs uppercase tracking-wide text-accent">{note}</p> : null}
              <p id="confirm-danger-instructions" className="mt-3 text-sm text-muted">
                Escribe <span className="font-mono font-medium text-foreground">{confirmPhrase}</span> para confirmar.
              </p>
              <Input
                autoFocus
                aria-label={`Escribe ${confirmPhrase} para confirmar`}
                aria-describedby="confirm-danger-instructions"
                className="mt-3"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" disabled={isBusy} onClick={onCancel}>
                Cancelar
              </Button>
              <Button variant="danger" disabled={!matches || isBusy} onClick={onConfirm}>
                {isBusy ? "Borrando..." : actionLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
