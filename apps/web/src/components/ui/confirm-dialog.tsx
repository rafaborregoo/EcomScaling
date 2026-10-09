"use client";

import {
  cloneElement,
  useId,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Banner } from "./banner";
import { Dialog } from "./dialog";
import { Input } from "./input";

// Confirmacion unica de la app (ADR-0020 §7). Tres niveles segun el riesgo de la accion
// (ver «Mapa de confirmaciones» de la auditoria de modales):
//   N1 confirmar          -> `description`
//   N2 con consecuencias  -> `description` + `consequences`
//   N3 escribir para confirmar (irreversible o masivo) -> `confirmPhrase`
// Se abre con `trigger` (boton que recibe el onClick) o controlada con
// `open` / `onOpenChange`. `onConfirm` puede ser asincrono: el boton muestra
// «…» y el dialogo bloquea el cierre hasta que acaba. Si la promesa se rechaza
// o devuelve `false`, el dialogo SE QUEDA abierto (con el error inline) en vez
// de cerrar y esconderlo.

type ConfirmStatus = "default" | "accent" | "success" | "warning" | "danger";

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  consequences,
  note,
  irreversible = false,
  confirmLabel = "Confirmar",
  busyLabel,
  cancelLabel = "Cancelar",
  status = "danger",
  confirmPhrase,
  isBusy = false,
  onConfirm,
}: {
  /** Boton que abre el dialogo; recibe el `onClick` que lo abre. */
  trigger?: ReactElement<{ onClick?: () => void }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Lo concreto que se pierde (nivel 2). */
  consequences?: string[];
  /** Dato factual de la accion (plazo de gracia, que se conserva). */
  note?: ReactNode;
  /** Sin vuelta atras: el `note` pasa a aviso rojo. */
  irreversible?: boolean;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  status?: ConfirmStatus;
  /** Si existe, hay que escribirla exacta para habilitar la accion (nivel 3). */
  confirmPhrase?: string;
  /** Trabajo en curso gestionado por quien llama (se suma al interno). */
  isBusy?: boolean;
  onConfirm: () => unknown | Promise<unknown>;
}) {
  const formId = useId();
  const controlled = open !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = controlled ? open : innerOpen;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setTyped("");
      setError(null);
    }
  }

  const setOpen = (next: boolean) => {
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
  };

  const matches = !confirmPhrase || typed.trim() === confirmPhrase;
  const busy = pending || isBusy;

  async function confirm() {
    if (!matches || busy) return;
    setPending(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result === false) return;
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "No se pudo completar la acción. Reintenta.",
      );
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void confirm();
  }

  const dialog = (
    <Dialog
      isOpen={isOpen}
      onOpenChange={setOpen}
      size="sm"
      title={title}
      isBusy={busy}
      formId={confirmPhrase ? formId : undefined}
      cancelLabel={cancelLabel}
      primary={{
        label: confirmLabel,
        busyLabel: busyLabel ?? `${confirmLabel}…`,
        tone: status === "danger" ? "danger" : "primary",
        disabled: !matches,
        onClick: confirmPhrase ? undefined : () => void confirm(),
      }}
    >
      {note ? (
        irreversible ? (
          <Banner tone="danger">{note}</Banner>
        ) : (
          <p className="text-[13px] leading-relaxed text-muted">{note}</p>
        )
      ) : null}
      {description ? (
        <p className="text-[13px] leading-relaxed text-ink">{description}</p>
      ) : null}
      {consequences && consequences.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-ink">
          {consequences.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {confirmPhrase ? (
        <form id={formId} className="space-y-2" onSubmit={submit}>
          <p className="text-[13px] text-ink">
            Escribe{" "}
            <span className="rounded-md border border-edge bg-surface px-1.5 font-medium">
              {confirmPhrase}
            </span>{" "}
            para confirmar.
          </p>
          <Input
            autoFocus
            aria-label={`Escribe ${confirmPhrase} para confirmar`}
            autoComplete="off"
            value={typed}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
          />
        </form>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Dialog>
  );

  // `Modal.Trigger` no sirve para envolver un boton (renderiza un div con
  // role=button y el Button de dentro corta la pulsacion): se abre con el
  // onClick del propio boton.
  if (!trigger) return dialog;
  return (
    <>
      {cloneElement(trigger, { onClick: () => setOpen(true) })}
      {dialog}
    </>
  );
}
