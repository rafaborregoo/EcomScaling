"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

// Disparador de subida de archivo con aspecto de Button de HeroUI. El <input>
// nativo queda oculto (sr-only, fuera del tab order) y el Button real es el
// control accesible. Reemplaza los <label className="border ..."> ad-hoc.
export function UploadButton({
  accept,
  children = "Subir archivo",
  busyLabel = "Subiendo…",
  variant = "secondary",
  size,
  disabled,
  onFile,
}: {
  accept?: string;
  children?: ReactNode;
  busyLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Recibe el archivo elegido. Si devuelve una promesa, el botón queda en
   *  estado "ocupado" hasta que resuelve. */
  onFile: (file: File) => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await onFile(file);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? busyLabel : children}
      </Button>
    </>
  );
}
