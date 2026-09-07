"use client";

import { cloneElement, useState, type ReactElement, type ReactNode } from "react";
import { Modal } from "@heroui/react";
import { Button } from "./button";

type ConfirmStatus = "default" | "accent" | "success" | "warning" | "danger";

// Migrado de AlertDialog a Modal (2026-08-28): AlertDialog.CloseTrigger es el
// `CloseButton` de HeroUI (botón-icono circular, tamaño fijo) -- estilarlo con
// texto + clases propias dejaba los botones "Cancelar"/"Confirmar" como
// círculos azules con el texto desbordado. Modal + el `Button` del catálogo
// dan los mismos estados/jerarquía que el resto de la app y ya está estilado
// globalmente (borde, radio, cabecera con separador).
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  status = "danger",
  onConfirm,
}: {
  /** Boton que abre el dialogo; recibe el `onClick` que lo abre. */
  trigger: ReactElement<{ onClick?: () => void }>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  status?: ConfirmStatus;
  onConfirm: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // `Modal.Trigger` NO sirve para envolver un boton: renderiza un
  // `<div role="button">` con la pulsacion de react-aria, y el `Button` de
  // dentro (react-aria tambien) corta la propagacion del evento -- el div
  // nunca recibe la pulsacion y el dialogo no se abre nunca. Ademas anidaba un
  // control dentro de `role="button"` (WCAG 4.1.2). Se abre con el `onClick`
  // del propio boton, que es lo que ya hace el resto de modales de la app.
  return (
    <>
      {cloneElement(trigger, { onClick: () => setIsOpen(true) })}
      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog
              aria-label={typeof title === "string" ? title : "Confirmar"}
            >
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              {description ? (
                <Modal.Body>
                  <p className="text-[13px] leading-relaxed text-foreground">
                    {description}
                  </p>
                </Modal.Body>
              ) : null}
              <Modal.Footer>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  {cancelLabel}
                </Button>
                <Button
                  variant={status === "danger" ? "danger" : "primary"}
                  onClick={() => {
                    onConfirm();
                    setIsOpen(false);
                  }}
                >
                  {confirmLabel}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
