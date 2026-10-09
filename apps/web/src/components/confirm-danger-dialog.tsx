"use client";

import { ConfirmDialog } from "@/components/ui";

/**
 * Confirmacion de nivel 3 (escribir el nombre exacto) para borrados de riesgo.
 * Es un adaptador de `ConfirmDialog`: quien llama monta el componente cuando
 * hay un objetivo y lo desmonta en `onCancel`. Desde R-008 (2026-07-21) el
 * borrado real es soft-delete con periodo de gracia en algunos casos -- `note`
 * es donde cada caller declara ese dato factual.
 */
export function ConfirmDangerDialog({
  title,
  note,
  irreversible,
  confirmPhrase,
  actionLabel,
  busyLabel,
  onConfirm,
  onCancel,
  isBusy,
}: {
  title: string;
  note?: string;
  /** Sin periodo de gracia: el aviso se pinta en rojo. */
  irreversible?: boolean;
  confirmPhrase: string;
  actionLabel: string;
  /** Etiqueta mientras trabaja; por defecto «{actionLabel}…». */
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy: boolean;
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      note={note}
      irreversible={irreversible}
      confirmPhrase={confirmPhrase}
      confirmLabel={actionLabel}
      busyLabel={busyLabel}
      isBusy={isBusy}
      onConfirm={() => {
        onConfirm();
        // El llamador lleva el estado `isBusy` y desmonta el dialogo al acabar:
        // se queda abierto hasta entonces.
        return false;
      }}
    />
  );
}
