"use client";

import type { ReactNode } from "react";
import { AlertDialog } from "@heroui/react";

type ConfirmStatus = "default" | "accent" | "success" | "warning" | "danger";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  status = "danger",
  onConfirm,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  status?: ConfirmStatus;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialog.Trigger>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status={status} />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            {description ? <AlertDialog.Body>{description}</AlertDialog.Body> : null}
            <AlertDialog.Footer>
              {/* AlertDialog.CloseTrigger ya es el elemento <button> (extiende el
                  Button primitivo de react-aria) -- se estiliza directamente en
                  vez de anidar otro Button, para no anidar dos <button>. */}
              <AlertDialog.CloseTrigger className="button button--secondary">{cancelLabel}</AlertDialog.CloseTrigger>
              <AlertDialog.CloseTrigger
                onPress={onConfirm}
                className={`button ${status === "danger" ? "button--danger" : "button--primary"}`}
              >
                {confirmLabel}
              </AlertDialog.CloseTrigger>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
