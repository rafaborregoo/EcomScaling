"use client";

import {
  cloneElement,
  createContext,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Modal } from "@heroui/react";
import { XIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "./cn";
import { NoField } from "./field";

// Diálogo único de la app, con la API de shadcn: Dialog > DialogTrigger +
// DialogContent (Header > Title/Description, Footer > Close). Por debajo va el
// Modal de HeroUI (react-aria) y no un <dialog> nativo como AlertDialog: los
// formularios llevan Select y DatePicker, cuyos desplegables se montan en un
// portal y quedarían inertes debajo de la capa superior de un showModal().
// Estilos: `.ui-dialog` en globals.css.
//
// Dos añadidos sobre shadcn, porque los formularios de E-NORA los necesitan
// (ADR-0020 §7):
//   - `busy` en Dialog: trabajando no se cierra (sin X, ni Escape, ni fondo, y
//     DialogClose deshabilitado).
//   - `dirty` en Dialog: cerrar con cambios sin guardar convierte el pie en
//     «¿Descartar los cambios?» en vez de cerrar. Necesita un DialogFooter.

type DialogContextValue = {
  open: boolean;
  /** Abrir o cerrar a petición del usuario: respeta `busy` y `dirty`. */
  setOpen: (open: boolean) => void;
  busy: boolean;
  discarding: boolean;
  keepEditing: () => void;
  discard: () => void;
  descriptionId: string;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog(name: string) {
  const context = useContext(DialogContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <Dialog>`);
  return context;
}

export function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  busy = false,
  dirty = false,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trabajando: no se puede cerrar. */
  busy?: boolean;
  /** Hay cambios sin guardar: cerrar pregunta antes de descartar. */
  dirty?: boolean;
  children: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const [discarding, setDiscarding] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const id = useId();
  // Ajuste durante el render (patrón de React): al cerrar desde fuera se olvida
  // una pregunta de descarte a medias, para que no reaparezca.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setDiscarding(false);
  }

  const commit = (next: boolean) => {
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  return (
    <DialogContext.Provider
      value={{
        open: isOpen,
        setOpen: (next) => {
          if (next) return commit(true);
          if (busy) return;
          if (dirty) return setDiscarding(true);
          commit(false);
        },
        busy,
        discarding: discarding && isOpen,
        keepEditing: () => setDiscarding(false),
        discard: () => {
          setDiscarding(false);
          commit(false);
        },
        descriptionId: `${id}-description`,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

/** El elemento de `render` abre el diálogo (recibe el onClick). */
export function DialogTrigger({
  render = <Button variant="outline" />,
  children,
}: {
  render?: ReactElement<{ onClick?: () => void; children?: ReactNode }>;
  children?: ReactNode;
}) {
  const { setOpen } = useDialog("DialogTrigger");
  return cloneElement(render, {
    onClick: () => setOpen(true),
    ...(children === undefined ? {} : { children }),
  });
}

/** El elemento de `render` cierra el diálogo; sin él, un botón outline. */
export function DialogClose({
  render = <Button variant="outline" />,
  children,
}: {
  render?: ReactElement<{ onClick?: () => void; disabled?: boolean; children?: ReactNode }>;
  children?: ReactNode;
}) {
  const { setOpen, busy } = useDialog("DialogClose");
  return cloneElement(render, {
    onClick: () => setOpen(false),
    disabled: busy || render.props.disabled,
    ...(children === undefined ? {} : { children }),
  });
}

export function DialogContent({
  showCloseButton = true,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  /** `false` quita la X de la esquina. */
  showCloseButton?: boolean;
  className?: string;
  children?: ReactNode;
  /** Solo si el diálogo no lleva DialogTitle. */
  "aria-label"?: string;
}) {
  const context = useDialog("DialogContent");
  return (
    <Modal isOpen={context.open} onOpenChange={context.setOpen}>
      <Modal.Backdrop
        className="ui-dialog-backdrop"
        isDismissable={!context.busy}
        isKeyboardDismissDisabled={context.busy}
      >
        <Modal.Container placement="center">
          <Modal.Dialog
            data-slot="dialog-content"
            aria-label={ariaLabel}
            aria-describedby={context.descriptionId}
            className={cn("ui-dialog", className)}
          >
            {/* Abierto desde un Field (una fila de ajustes), sus campos no heredan el de la fila. */}
            <NoField>{children}</NoField>
            {showCloseButton && !context.busy ? (
              <Button
                data-slot="dialog-close"
                variant="ghost"
                size="icon-sm"
                aria-label="Cerrar"
                className="ui-dialog__close"
                onClick={() => context.setOpen(false)}
              >
                <XIcon aria-hidden />
              </Button>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("ui-dialog__header", className)} {...props} />;
}

export function DialogTitle({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <Modal.Heading level={2} data-slot="dialog-title" className={cn("ui-dialog__title", className)}>
      {children}
    </Modal.Heading>
  );
}

export function DialogDescription({ className, ...props }: ComponentProps<"p">) {
  const { descriptionId } = useDialog("DialogDescription");
  return <p id={descriptionId} data-slot="dialog-description" className={cn("ui-dialog__description", className)} {...props} />;
}

export function DialogFooter({
  showCloseButton = false,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  /** Añade un «Cerrar» outline al final. */
  showCloseButton?: boolean;
}) {
  const context = useDialog("DialogFooter");
  if (context.discarding) {
    return (
      <div data-slot="dialog-footer" className={cn("ui-dialog__footer", className)} {...props}>
        <span className="ui-dialog__discard">¿Descartar los cambios sin guardar?</span>
        <Button variant="outline" onClick={context.keepEditing}>
          Seguir editando
        </Button>
        <Button variant="destructive" onClick={context.discard}>
          Descartar
        </Button>
      </div>
    );
  }
  return (
    <div data-slot="dialog-footer" className={cn("ui-dialog__footer", className)} {...props}>
      {children}
      {showCloseButton ? <DialogClose>Cerrar</DialogClose> : null}
    </div>
  );
}
