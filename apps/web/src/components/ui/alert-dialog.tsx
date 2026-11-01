"use client";

import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { NoField } from "./field";
import { Input } from "./input";

// Diálogo de alerta único de la app, con la API de shadcn: AlertDialog >
// AlertDialogTrigger + AlertDialogContent (Header > Media/Title/Description,
// Footer > Cancel/Action). Nativo, como Button y Accordion: un <dialog> con
// showModal() (capa superior, foco atrapado, Escape = cancelar) y
// role="alertdialog"; el fondo no lo cierra. Estilos: `.ui-alert-dialog` en
// globals.css.
//
// Dos añadidos sobre shadcn, porque las confirmaciones de E-NORA los necesitan:
//   - `AlertDialogAction` acepta un `onClick` asíncrono: mientras trabaja
//     bloquea los botones y Escape; si la promesa falla o devuelve `false`, el
//     diálogo se queda abierto con el error encima del pie.
//   - `AlertDialogConfirmPhrase`: para lo irreversible o masivo, hay que
//     escribir una frase exacta antes de poder confirmar.

type AlertDialogContextValue = {
  open: boolean;
  /** Abrir o cerrar a petición del usuario: no cierra mientras trabaja. */
  setOpen: (open: boolean) => void;
  /** Cierre al acabar la acción, aunque `busy` aún no se haya refrescado. */
  close: () => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  phraseOk: boolean;
  setPhraseOk: (ok: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

function useAlertDialog(name: string) {
  const context = useContext(AlertDialogContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <AlertDialog>`);
  return context;
}

export function AlertDialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phraseOk, setPhraseOk] = useState(true);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const id = useId();
  // Ajuste durante el render (patrón de React): cada apertura empieza limpia.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setError(null);
  }

  const commit = (next: boolean) => {
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  return (
    <AlertDialogContext.Provider
      value={{
        open: isOpen,
        setOpen: (next) => {
          if (!next && busy) return;
          commit(next);
        },
        close: () => commit(false),
        busy,
        setBusy,
        error,
        setError,
        phraseOk,
        setPhraseOk,
        titleId: `${id}-title`,
        descriptionId: `${id}-description`,
      }}
    >
      {children}
    </AlertDialogContext.Provider>
  );
}

/** El elemento de `render` abre el diálogo (recibe el onClick). */
export function AlertDialogTrigger({
  render,
  children,
}: {
  render: ReactElement<{ onClick?: () => void; children?: ReactNode }>;
  children?: ReactNode;
}) {
  const { setOpen } = useAlertDialog("AlertDialogTrigger");
  return cloneElement(render, {
    onClick: () => setOpen(true),
    ...(children === undefined ? {} : { children }),
  });
}

export function AlertDialogContent({
  size = "default",
  className,
  children,
  ...props
}: Omit<ComponentProps<"dialog">, "open" | "role"> & { size?: "default" | "sm" }) {
  const context = useAlertDialog("AlertDialogContent");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (context.open && !dialog.open) dialog.showModal();
    if (!context.open && dialog.open) dialog.close();
  }, [context.open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={context.titleId}
      aria-describedby={context.descriptionId}
      data-slot="alert-dialog-content"
      data-size={size}
      className={cn("ui-alert-dialog", className)}
      onCancel={(event) => {
        // Escape: el estado manda; el <dialog> no se cierra por su cuenta.
        event.preventDefault();
        context.setOpen(false);
      }}
      {...props}
    >
      {context.open ? <NoField>{children}</NoField> : null}
    </dialog>
  );
}

export function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("ui-alert-dialog__header", className)} {...props} />;
}

export function AlertDialogMedia({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-dialog-media" aria-hidden className={cn("ui-alert-dialog__media", className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: ComponentProps<"h2">) {
  const { titleId } = useAlertDialog("AlertDialogTitle");
  return <h2 id={titleId} data-slot="alert-dialog-title" className={cn("ui-alert-dialog__title", className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: ComponentProps<"p">) {
  const { descriptionId } = useAlertDialog("AlertDialogDescription");
  return (
    <p id={descriptionId} data-slot="alert-dialog-description" className={cn("ui-alert-dialog__description", className)} {...props} />
  );
}

export function AlertDialogFooter({ className, children, ...props }: ComponentProps<"div">) {
  const { error } = useAlertDialog("AlertDialogFooter");
  return (
    <>
      {error ? (
        <p role="alert" className="ui-alert-dialog__error">
          {error}
        </p>
      ) : null}
      <div data-slot="alert-dialog-footer" className={cn("ui-alert-dialog__footer", className)} {...props}>
        <div role="group" aria-label="Acciones de confirmación" className="flex flex-wrap items-center gap-2 ml-auto">
          {children}
        </div>
      </div>
    </>
  );
}

export function AlertDialogCancel({
  variant = "outline",
  children = "Cancelar",
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick">) {
  const { setOpen, busy } = useAlertDialog("AlertDialogCancel");
  return (
    <Button data-slot="alert-dialog-cancel" variant={variant} disabled={busy} onClick={() => setOpen(false)} {...props}>
      {children}
    </Button>
  );
}

export function AlertDialogAction({
  onClick,
  busyLabel,
  disabled,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & {
  /** Puede ser asíncrono; devolver `false` deja el diálogo abierto. */
  onClick?: () => unknown;
  /** Etiqueta mientras trabaja; por defecto, la etiqueta con «…». */
  busyLabel?: ReactNode;
}) {
  const context = useAlertDialog("AlertDialogAction");

  async function run() {
    context.setError(null);
    const result = onClick?.();
    if (!(result instanceof Promise)) {
      if (result !== false) context.close();
      return;
    }
    context.setBusy(true);
    try {
      if ((await result) !== false) context.close();
    } catch (cause) {
      context.setError(
        cause instanceof Error && cause.message ? cause.message : "No se pudo completar la acción. Reintenta.",
      );
    } finally {
      context.setBusy(false);
    }
  }

  return (
    <Button
      data-slot="alert-dialog-action"
      disabled={disabled || context.busy || !context.phraseOk}
      onClick={() => void run()}
      {...props}
    >
      {context.busy ? (busyLabel ?? (typeof children === "string" ? `${children}…` : children)) : children}
    </Button>
  );
}

/** Hay que escribir `phrase` exacta para que AlertDialogAction se habilite. */
export function AlertDialogConfirmPhrase({ phrase }: { phrase: string }) {
  const { setPhraseOk, busy } = useAlertDialog("AlertDialogConfirmPhrase");
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === phrase;

  // Antes de pintar: la acción no llega a verse habilitada ni un fotograma.
  useLayoutEffect(() => {
    setPhraseOk(matches);
  }, [matches, setPhraseOk]);
  useEffect(() => () => setPhraseOk(true), [setPhraseOk]);

  return (
    <label className="ui-alert-dialog__phrase">
      <span>
        Escribe <b>{phrase}</b> para confirmar.
      </span>
      <Input
        autoFocus
        autoComplete="off"
        aria-label={`Escribe ${phrase} para confirmar`}
        value={typed}
        disabled={busy}
        onChange={(event) => setTyped(event.target.value)}
      />
    </label>
  );
}
