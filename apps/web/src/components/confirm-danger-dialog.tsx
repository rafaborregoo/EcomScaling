"use client";

import { useState } from "react";

/**
 * Confirmacion para acciones irreversibles (borrar cliente, borrar tienda):
 * exige escribir el nombre exacto de lo que se va a borrar antes de habilitar
 * el boton. Mas seguro que un window.confirm generico sin ser un modal pesado.
 */
export function ConfirmDangerDialog({
  title,
  confirmPhrase,
  actionLabel,
  onConfirm,
  onCancel,
  isBusy,
}: {
  title: string;
  confirmPhrase: string;
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy: boolean;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmPhrase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm border border-ink bg-white p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
        <p className="font-display text-xl">{title}</p>
        <p className="mt-3 text-sm text-muted">
          Escribe <span className="font-mono font-medium text-black">{confirmPhrase}</span> para confirmar.
        </p>
        <input
          autoFocus
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
