"use client";

import { useState, type ReactNode } from "react";
import { Drawer, Modal } from "@heroui/react";
import { Button } from "./button";
import { EYEBROW } from "./typography";
import { cn } from "./cn";

// Superficies superpuestas de E-NORA (ADR-0020 §7). Las paginas no importan
// `Modal` ni `Drawer` de HeroUI: usan `Dialog` (modal centrado, hoja inferior en
// movil), `Sheet` (panel lateral) o `ConfirmDialog`. Garantizan lo que antes
// cada pantalla resolvia a mano:
//   - X de cierre siempre (se oculta solo mientras `isBusy`).
//   - `isBusy` bloquea X, Escape y fondo, y el boton principal pasa a «…».
//   - `isDirty` convierte el pie en «¿Descartar los cambios?» en lugar de cerrar.
//   - Pie con la jerarquia de ADR-0020 §6: accion lateral a la izquierda,
//     Cancelar (ghost) y UNA primaria a la derecha.
//   - Nunca se apilan: una confirmacion dentro de un dialogo va en el pie.

export type DialogSize = "sm" | "md" | "lg" | "xl" | "cover";
export type SheetSize = "sm" | "md" | "lg";

export type DialogPrimary = {
  label: ReactNode;
  /** Etiqueta mientras `isBusy`. Por defecto, la etiqueta con «…». */
  busyLabel?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "danger";
};

type SurfaceProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trabajando: bloquea el cierre y pone la primaria en «…». */
  isBusy?: boolean;
  /** Hay cambios sin guardar: cerrar pregunta antes de descartar. */
  isDirty?: boolean;
  /** Id del <form> del cuerpo: la primaria lo envia sin anidarse en el. */
  formId?: string;
  /** Accion lateral (izquierda del pie): una salida o una accion destructiva. */
  start?: ReactNode;
  /** `false` oculta Cancelar (p. ej. un dialogo que solo informa). */
  cancelLabel?: string | false;
  primary?: DialogPrimary;
  /** Sustituye a Cancelar + primaria cuando el pie no encaja en el molde. */
  footer?: ReactNode;
  children?: ReactNode;
};

function useDismissGuard({
  isOpen,
  isBusy,
  isDirty,
  onOpenChange,
}: Pick<SurfaceProps, "isOpen" | "onOpenChange"> & {
  isBusy: boolean;
  isDirty: boolean;
}) {
  const [discarding, setDiscarding] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  // Ajuste de estado durante el render (patron de React): al cerrar desde fuera
  // se olvida una pregunta de descarte a medias, para que no reaparezca.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setDiscarding(false);
  }

  const requestClose = () => {
    if (isBusy) return;
    if (isDirty) {
      setDiscarding(true);
      return;
    }
    onOpenChange(false);
  };
  const handleOpenChange = (open: boolean) => {
    if (open) onOpenChange(true);
    else requestClose();
  };
  const discard = () => {
    setDiscarding(false);
    onOpenChange(false);
  };

  return {
    discarding: discarding && isOpen,
    keepEditing: () => setDiscarding(false),
    requestClose,
    handleOpenChange,
    discard,
  };
}

function Actions({
  guard,
  isBusy,
  formId,
  start,
  cancelLabel = "Cancelar",
  primary,
  footer,
}: Pick<SurfaceProps, "formId" | "start" | "cancelLabel" | "primary" | "footer"> & {
  guard: ReturnType<typeof useDismissGuard>;
  isBusy: boolean;
}) {
  if (guard.discarding) {
    return (
      <>
        <span className="mr-auto text-[13px] font-medium text-ink">
          ¿Descartar los cambios sin guardar?
        </span>
        <Button variant="ghost" onClick={guard.keepEditing}>
          Seguir editando
        </Button>
        <Button variant="danger" onClick={guard.discard}>
          Descartar
        </Button>
      </>
    );
  }
  return (
    <>
      {start ? <div className="mr-auto flex items-center gap-2">{start}</div> : null}
      {footer ?? (
        <>
          {cancelLabel !== false ? (
            <Button variant="ghost" disabled={isBusy} onClick={guard.requestClose}>
              {cancelLabel}
            </Button>
          ) : null}
          {primary ? (
            <Button
              variant={primary.tone ?? "primary"}
              type={formId ? "submit" : "button"}
              form={formId}
              disabled={primary.disabled || isBusy}
              onClick={primary.onClick}
            >
              {isBusy
                ? (primary.busyLabel ??
                  (typeof primary.label === "string" ? `${primary.label}…` : "…"))
                : primary.label}
            </Button>
          ) : null}
        </>
      )}
    </>
  );
}

const hasActions = (p: SurfaceProps) =>
  Boolean(p.start || p.primary || p.footer || typeof p.cancelLabel === "string");

/** Modal centrado (hoja inferior en movil). */
export function Dialog({
  title,
  eyebrow,
  description,
  size = "md",
  className,
  isBusy = false,
  isDirty = false,
  ...surface
}: SurfaceProps & {
  title: ReactNode;
  /** Origen o categoria sobre el titulo («Hito · Auditoria de tracking»). */
  eyebrow?: ReactNode;
  /** Una linea bajo el titulo, solo si evita un error o una restriccion. */
  description?: ReactNode;
  /** sm 24 rem · md 32 · lg 44 · xl 60 · cover: pantalla casi completa. */
  size?: DialogSize;
  className?: string;
}) {
  const guard = useDismissGuard({
    isOpen: surface.isOpen,
    onOpenChange: surface.onOpenChange,
    isBusy,
    isDirty,
  });
  return (
    <Modal isOpen={surface.isOpen} onOpenChange={guard.handleOpenChange}>
      <Modal.Backdrop isDismissable={!isBusy} isKeyboardDismissDisabled={isBusy}>
        <Modal.Container
          size={size === "sm" ? "sm" : size === "cover" ? "cover" : "lg"}
        >
          <Modal.Dialog className={cn("ui-dialog", `ui-dialog--${size}`, className)}>
            {isBusy ? null : <Modal.CloseTrigger />}
            <Modal.Header>
              {eyebrow ? <span className={EYEBROW}>{eyebrow}</span> : null}
              <Modal.Heading>{title}</Modal.Heading>
              {description ? (
                <p className="text-[13px] leading-relaxed text-muted">{description}</p>
              ) : null}
            </Modal.Header>
            <Modal.Body className="space-y-4">{surface.children}</Modal.Body>
            {hasActions(surface) ? (
              <Modal.Footer>
                <Actions guard={guard} isBusy={isBusy} {...surface} />
              </Modal.Footer>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Panel lateral para fichas, detalle y altas largas. Sin `Card` dentro. */
export function Sheet({
  title,
  meta,
  headerActions,
  size = "md",
  placement = "right",
  bare = false,
  flush = false,
  ariaLabel,
  className,
  isBusy = false,
  isDirty = false,
  ...surface
}: SurfaceProps & {
  title: ReactNode;
  /** Linea bajo el titulo: badges, fecha, origen. */
  meta?: ReactNode;
  /** Controles junto a la X (menu «⋯», enlace a la ficha…). */
  headerActions?: ReactNode;
  /** sm 28 rem (altas) · md 40 (fichas) · lg 60 (con vista previa). */
  size?: SheetSize;
  /** `bottom`: hoja inferior a todo el ancho, para movil. */
  placement?: "right" | "bottom";
  /** Sin cabecera ni pie: el contenido trae los suyos (panel del copiloto). */
  bare?: boolean;
  /** Cuerpo sin padding, para listas a sangre. */
  flush?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const guard = useDismissGuard({
    isOpen: surface.isOpen,
    onOpenChange: surface.onOpenChange,
    isBusy,
    isDirty,
  });
  return (
    <Drawer isOpen={surface.isOpen} onOpenChange={guard.handleOpenChange}>
      <Drawer.Backdrop isDismissable={!isBusy} isKeyboardDismissDisabled={isBusy}>
        <Drawer.Content placement={placement}>
          <Drawer.Dialog
            aria-label={ariaLabel}
            className={cn(
              "ui-sheet",
              placement === "bottom" ? "ui-sheet--bottom" : `ui-sheet--${size}`,
              flush && "ui-sheet--flush",
              className,
            )}
          >
            {bare ? (
              surface.children
            ) : (
              <>
            <Drawer.Header>
              <div className="min-w-0 flex-1 space-y-1">
                <Drawer.Heading>{title}</Drawer.Heading>
                {meta ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {meta}
                  </div>
                ) : null}
              </div>
              {headerActions ? (
                <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
              ) : null}
              {isBusy ? null : <Drawer.CloseTrigger />}
            </Drawer.Header>
            <Drawer.Body className="space-y-4">{surface.children}</Drawer.Body>
            {hasActions(surface) ? (
              <Drawer.Footer>
                <Actions guard={guard} isBusy={isBusy} {...surface} />
              </Drawer.Footer>
            ) : null}
              </>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
