"use client";

import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { UNSAFE_PortalProvider } from "react-aria";
import { XIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "./cn";
import { NoField } from "./field";

// Cajón único de la app, con la API de shadcn (la de Base UI): Drawer >
// DrawerTrigger + DrawerContent (Header > Title/Description, cuerpo, Footer >
// DrawerClose). Nativo, como AlertDialog: un <dialog> con showModal() (capa
// superior, foco atrapado, Escape cierra) que ocupa el viewport; dentro, el
// panel pegado al borde de `swipeDirection`. Pulsar fuera lo cierra y se
// arrastra hacia su borde para cerrarlo. Estilos: `.ui-drawer` en globals.css.
//
// Añadidos sobre shadcn, porque las hojas de E-NORA los necesitan (ADR-0020 §7):
//   - X de cierre en DrawerContent (`showCloseButton`, por defecto sí).
//   - `busy` en Drawer: bloquea X, Escape, fondo, arrastre y DrawerClose.
//   - `dirty` en Drawer: cerrar convierte el DrawerFooter en «¿Descartar los
//     cambios?» en lugar de cerrar.
//
// Select, DatePicker y demás popovers de HeroUI se montan en un portal: dentro
// del cajón ese portal es el propio <dialog> (UNSAFE_PortalProvider), porque en
// <body> quedarían debajo de la capa superior e inertes. Por lo mismo, un
// Dialog (Modal de HeroUI) abierto desde fuera del cajón con este abierto
// quedaría debajo: cerrar el cajón antes de abrirlo.

export type DrawerSwipeDirection = "up" | "right" | "down" | "left";
/** 0–1: fracción del alto de la ventana · >1: píxeles · "31rem" / "400px". */
export type DrawerSnapPoint = number | string;

type DrawerContextValue = {
  open: boolean;
  /** Abrir o cerrar a petición del usuario: respeta `busy` y `dirty`. */
  setOpen: (open: boolean) => void;
  busy: boolean;
  discarding: boolean;
  keepEditing: () => void;
  discard: () => void;
  swipeDirection: DrawerSwipeDirection;
  showSwipeHandle: boolean;
  modal: boolean;
  disablePointerDismissal: boolean;
  snapPoints: DrawerSnapPoint[] | undefined;
  snapPoint: DrawerSnapPoint | undefined;
  setSnapPoint: (point: DrawerSnapPoint) => void;
  titleId: string;
  descriptionId: string;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

function useDrawer(name: string) {
  const context = useContext(DrawerContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <Drawer>`);
  return context;
}

export function Drawer({
  open,
  defaultOpen = false,
  onOpenChange,
  swipeDirection = "down",
  showSwipeHandle = false,
  modal = true,
  disablePointerDismissal = false,
  snapPoints,
  snapPoint,
  onSnapPointChange,
  busy = false,
  dirty = false,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Borde del que sale y hacia el que se arrastra para cerrar. */
  swipeDirection?: DrawerSwipeDirection;
  showSwipeHandle?: boolean;
  /** `false`: la página sigue usable detrás (sin fondo ni foco atrapado). */
  modal?: boolean;
  /** Pulsar fuera no lo cierra. */
  disablePointerDismissal?: boolean;
  /** Alturas a las que se ajusta un cajón vertical al soltarlo; abre en la primera. */
  snapPoints?: DrawerSnapPoint[];
  snapPoint?: DrawerSnapPoint;
  onSnapPointChange?: (point: DrawerSnapPoint) => void;
  /** Trabajando: no se puede cerrar. */
  busy?: boolean;
  /** Hay cambios sin guardar: cerrar pregunta antes de descartar. */
  dirty?: boolean;
  children: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const [discarding, setDiscarding] = useState(false);
  const [uncontrolledSnap, setUncontrolledSnap] = useState(snapPoints?.[0]);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const id = useId();
  // Ajuste durante el render (patrón de React): al cerrar desde fuera se olvida
  // una pregunta de descarte a medias, para que no reaparezca; al abrir vuelve
  // al primer snap point.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setDiscarding(false);
    else setUncontrolledSnap(snapPoints?.[0]);
  }

  const commit = (next: boolean) => {
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  return (
    <DrawerContext.Provider
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
        swipeDirection,
        showSwipeHandle,
        modal,
        disablePointerDismissal,
        snapPoints,
        snapPoint: snapPoint ?? uncontrolledSnap,
        setSnapPoint: (point) => {
          if (snapPoint === undefined) setUncontrolledSnap(point);
          onSnapPointChange?.(point);
        },
        titleId: `${id}-title`,
        descriptionId: `${id}-description`,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

/** El elemento de `render` abre el cajón (recibe el onClick). */
export function DrawerTrigger({
  render,
  children,
}: {
  render: ReactElement<{ onClick?: () => void; children?: ReactNode }>;
  children?: ReactNode;
}) {
  const { setOpen } = useDrawer("DrawerTrigger");
  return cloneElement(render, {
    onClick: () => setOpen(true),
    ...(children === undefined ? {} : { children }),
  });
}

/** El elemento de `render` cierra el cajón (respeta `busy` y `dirty`). */
export function DrawerClose({
  render,
  children,
}: {
  render: ReactElement<{ onClick?: () => void; disabled?: boolean; children?: ReactNode }>;
  children?: ReactNode;
}) {
  const { setOpen, busy } = useDrawer("DrawerClose");
  return cloneElement(render, {
    onClick: () => setOpen(false),
    disabled: busy || render.props.disabled,
    ...(children === undefined ? {} : { children }),
  });
}

export function DrawerSwipeHandle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="drawer-swipe-handle" aria-hidden className={cn("ui-drawer__handle", className)} {...props} />;
}

const AXIS = {
  up: { axis: "y", sign: -1 },
  down: { axis: "y", sign: 1 },
  left: { axis: "x", sign: -1 },
  right: { axis: "x", sign: 1 },
} as const;

/** Alto en píxeles de un snap point. */
function snapPointToPx(point: DrawerSnapPoint, viewportHeight: number) {
  if (typeof point === "number") return point <= 1 ? point * viewportHeight : point;
  const value = Number.parseFloat(point);
  return point.trim().endsWith("rem") ? value * 16 : value;
}

export function DrawerContent({
  className,
  style,
  showCloseButton = true,
  children,
  ...props
}: Omit<ComponentProps<"dialog">, "open"> & { showCloseButton?: boolean }) {
  const context = useDrawer("DrawerContent");
  const ref = useRef<HTMLDialogElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; distance: number } | null>(null);
  const pressedOutside = useRef(false);
  const { axis, sign } = AXIS[context.swipeDirection];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (context.open && !dialog.open) {
      if (context.modal) dialog.showModal();
      else dialog.show();
    }
    if (!context.open && dialog.open) dialog.close();
  }, [context.open, context.modal]);

  // Snap points (solo vertical): el panel mide lo que el mayor y se desplaza
  // hacia su borde lo que sobra para enseñar el activo.
  // ponytail: el alto de la ventana se lee al pintar; si cambia con el cajón
  // abierto, se ajusta en el siguiente render. Escuchar resize si molesta.
  const viewport = context.open && typeof window !== "undefined" ? window.innerHeight : 0;
  const snaps = context.snapPoints && axis === "y" ? context.snapPoints.map((point) => snapPointToPx(point, viewport)) : null;
  const panelHeight = snaps ? Math.min(Math.max(...snaps), viewport - 16) : 0;
  const activeIndex = snaps && context.snapPoint !== undefined ? Math.max(0, context.snapPoints!.indexOf(context.snapPoint)) : 0;
  const snapOffset = snaps ? Math.max(0, panelHeight - snaps[activeIndex]) : 0;

  // Arrastre hacia el borde: solo desde el asa o la cabecera, para no pelear
  // con el scroll ni con la selección de texto del cuerpo. Sin snap points
  // cierra pasado un 25 % del panel; con ellos, se queda en el más cercano
  // (o cierra si lo más cercano es fuera).
  // ponytail: sin inercia; el gesto decide solo por la posición al soltar.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (context.busy || event.button !== 0) return;
    if (!target.closest('[data-slot="drawer-swipe-handle"], [data-slot="drawer-header"]')) return;
    if (target.closest("button, a, input, textarea, select, [contenteditable]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { start: axis === "y" ? event.clientY : event.clientX, distance: 0 };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const popup = popupRef.current;
    if (!drag.current || !popup) return;
    const raw = ((axis === "y" ? event.clientY : event.clientX) - drag.current.start) * sign;
    // Con snap points también se tira hacia dentro, hasta el panel entero.
    const distance = Math.max(snaps ? -snapOffset : 0, raw);
    drag.current.distance = distance;
    popup.dataset.swiping = "";
    const offset = (snapOffset + distance) * sign;
    popup.style.translate = axis === "y" ? `0 ${offset}px` : `${offset}px 0`;
  };
  const onPointerUp = () => {
    const popup = popupRef.current;
    if (!drag.current || !popup) return;
    const distance = drag.current.distance;
    drag.current = null;
    delete popup.dataset.swiping;
    popup.style.translate = "";
    if (snaps && context.snapPoints) {
      const visible = panelHeight - (snapOffset + distance);
      const nearest = [0, ...snaps].reduce((best, height, index) =>
        Math.abs(height - visible) < Math.abs([0, ...snaps][best] - visible) ? index : best, 0);
      if (nearest === 0) context.setOpen(false);
      else context.setSnapPoint(context.snapPoints[nearest - 1]);
      return;
    }
    const size = axis === "y" ? popup.offsetHeight : popup.offsetWidth;
    if (distance > size * 0.25) context.setOpen(false);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={context.titleId}
      aria-describedby={context.descriptionId}
      data-slot="drawer-content"
      data-modal={context.modal}
      className="ui-drawer"
      onCancel={(event) => {
        // Escape: el estado manda; el <dialog> no se cierra por su cuenta.
        event.preventDefault();
        context.setOpen(false);
      }}
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // El <dialog> ocupa el viewport: un clic en él y no en el panel es fuera.
        // Tiene que empezar fuera también: si se pulsa en el panel y se suelta
        // en otro sitio (p. ej. al abrir un Select), el click llega al <dialog>.
        if (event.target === event.currentTarget && pressedOutside.current && !context.disablePointerDismissal) {
          context.setOpen(false);
        }
      }}
      {...props}
    >
      {context.open ? (
        <UNSAFE_PortalProvider getContainer={() => ref.current ?? document.body}>
          <div
            ref={popupRef}
            data-slot="drawer-popup"
            // Al abrir un popover, react-aria deja `inert` todo lo demás; con el
            // panel inerte, el foco del clic caía en el <dialog> y el Select se
            // cerraba nada más abrirse. Lo de fuera ya lo bloquea showModal().
            data-react-aria-top-layer=""
            data-swipe-direction={context.swipeDirection}
            data-swipe-axis={axis}
            data-snap-points={snaps ? "" : undefined}
            data-expanded={snaps && snaps[activeIndex] >= Math.max(...snaps) ? "" : undefined}
            className={cn("ui-drawer__popup group/drawer-popup", className)}
            style={
              snaps
                ? ({ ...style, height: panelHeight, "--drawer-snap-offset": `${snapOffset * sign}px` } as CSSProperties)
                : style
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {context.showSwipeHandle ? <DrawerSwipeHandle /> : null}
            <NoField>{children}</NoField>
            {showCloseButton && !context.busy ? (
              <DrawerClose
                render={<Button variant="ghost" size="icon-sm" aria-label="Cerrar" className="ui-drawer__close" />}
              >
                <XIcon aria-hidden />
              </DrawerClose>
            ) : null}
          </div>
        </UNSAFE_PortalProvider>
      ) : null}
    </dialog>
  );
}

export function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="drawer-header" className={cn("ui-drawer__header", className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: ComponentProps<"h2">) {
  const { titleId } = useDrawer("DrawerTitle");
  return <h2 id={titleId} data-slot="drawer-title" className={cn("ui-drawer__title", className)} {...props} />;
}

export function DrawerDescription({ className, ...props }: ComponentProps<"div">) {
  const { descriptionId } = useDrawer("DrawerDescription");
  return (
    <div id={descriptionId} data-slot="drawer-description" className={cn("ui-drawer__description", className)} {...props} />
  );
}

export function DrawerFooter({ className, children, ...props }: ComponentProps<"div">) {
  const { discarding, keepEditing, discard } = useDrawer("DrawerFooter");
  return (
    <div data-slot="drawer-footer" className={cn("ui-drawer__footer", className)} {...props}>
      {discarding ? (
        <>
          <p className="ui-drawer__discard">¿Descartar los cambios sin guardar?</p>
          <Button variant="destructive" onClick={discard}>
            Descartar
          </Button>
          <Button variant="outline" onClick={keepEditing}>
            Seguir editando
          </Button>
        </>
      ) : (
        children
      )}
    </div>
  );
}
