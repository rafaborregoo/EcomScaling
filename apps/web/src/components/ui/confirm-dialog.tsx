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
              <AlertDialog.CloseTrigger className="min-h-9 border border-edge bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-brand hover:text-brand">{cancelLabel}</AlertDialog.CloseTrigger>
              <AlertDialog.CloseTrigger
                onPress={onConfirm}
                className={status === "danger" ? "min-h-9 border border-danger bg-danger px-3 py-2 text-sm font-medium text-white transition hover:opacity-90" : "min-h-9 border border-brand bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-deep"}
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
