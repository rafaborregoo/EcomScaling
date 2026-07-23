"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Confirmacion para acciones de riesgo (borrar cliente, borrar tienda): exige
 * escribir el nombre exacto antes de habilitar el boton. Mas seguro que un
 * window.confirm generico sin ser un modal pesado. Desde R-008 (2026-07-21)
 * el borrado real es soft-delete con periodo de gracia, no inmediato -- `note`
 * es donde cada caller declara ese dato factual (p. ej. "30 dias para
 * restaurar"), no una explicacion larga.
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const matches = typed.trim() === confirmPhrase;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled])',
        ),
      );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isBusy) onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-sm border border-ink bg-white p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-danger-title"
        aria-describedby="confirm-danger-instructions"
      >
        <p id="confirm-danger-title" className="font-display text-xl">{title}</p>
        {note ? <p id="confirm-danger-note" className="mt-1 font-mono text-xs uppercase tracking-wide text-brand">{note}</p> : null}
        <p id="confirm-danger-instructions" className="mt-3 text-sm text-muted">
          Escribe <span className="font-mono font-medium text-black">{confirmPhrase}</span> para confirmar.
        </p>
        <input
          autoFocus
          aria-label={`Escribe ${confirmPhrase} para confirmar`}
          aria-describedby="confirm-danger-instructions"
          className="mt-3 w-full rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-2 text-sm outline-none transition-colors focus:border-ink"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
        <div className="mt-5 flex justify-end gap-4">
          <button
            type="button"
            className="text-sm text-muted underline decoration-transparent underline-offset-4 transition hover:text-black"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!matches || isBusy}
            onClick={onConfirm}
          >
            {isBusy ? "Borrando..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
