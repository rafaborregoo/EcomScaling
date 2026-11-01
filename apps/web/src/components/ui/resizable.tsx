"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { cn } from "./cn";
import { GripVerticalIcon } from "./icons";

// Paneles redimensionables con la API de shadcn: ResizablePanelGroup
// (orientation) > ResizablePanel (defaultSize, minSize, maxSize) +
// ResizableHandle (withHandle). Propio, sin react-resizable-panels: el reparto
// vive en % y cada panel es `flex: <%> 1 0`. Tamaños como en shadcn v4:
// "50%", y además "26rem" o "320px" (un número suelto es %). minSize/maxSize
// van también al CSS (min-width/max-width), así que el navegador los respeta
// aunque cambie el ancho de la ventana. Teclado en el asa: flechas (5 %),
// Inicio/Fin; doble clic vuelve al reparto por defecto. Con `autoSaveId` el
// reparto se recuerda en este navegador (copiloto: el ancho que dejó cada uno).
// Es para vistas partidas que se usan un rato (copiloto junto a la pantalla,
// editores); un bloque que solo crece hacia abajo es `resize: vertical`.

type Orientation = "horizontal" | "vertical";
type Size = number | string;
type PanelSpec = { defaultSize?: Size; minSize?: Size; maxSize?: Size };
type Layout = { ids: string[]; sizes: number[] };

const STEP = 5;

function remPx() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** "50%" → 50; "26rem"/"320px" → % de `total` (px); número → %. */
export function toPercent(size: Size | undefined, total: number, rem = 16): number | undefined {
  if (size === undefined) return undefined;
  if (typeof size === "number") return size;
  const value = parseFloat(size);
  if (!Number.isFinite(value)) return undefined;
  if (size.trim().endsWith("%")) return value;
  if (!total) return undefined;
  return ((size.trim().endsWith("rem") ? value * rem : value) / total) * 100;
}

/** Reparto inicial: los tamaños dados, y lo que sobre a partes iguales entre el resto; suma 100. */
export function initialSizes(specs: PanelSpec[], total: number, rem = 16): number[] {
  const given = specs.map((spec) => toPercent(spec.defaultSize, total, rem));
  const free = given.filter((size) => size === undefined).length;
  const taken = given.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  if (!free) return given.map((size) => ((size ?? 0) / (taken || 1)) * 100);
  const share = Math.max(0, 100 - taken) / free;
  return given.map((size) => size ?? share);
}

/** Mueve la frontera entre el panel `index` y el siguiente `delta` puntos, sin saltarse min/max de ninguno. */
export function resizeSizes(sizes: number[], index: number, delta: number, limits: Array<{ min: number; max: number }>) {
  const a = sizes[index];
  const b = sizes[index + 1];
  if (a === undefined || b === undefined) return sizes;
  const pair = a + b;
  const low = Math.max(limits[index]?.min ?? 0, pair - (limits[index + 1]?.max ?? 100));
  const high = Math.min(limits[index]?.max ?? 100, pair - (limits[index + 1]?.min ?? 0));
  const next = Math.min(high, Math.max(low, a + delta));
  if (next === a) return sizes;
  const out = [...sizes];
  out[index] = next;
  out[index + 1] = pair - next;
  return out;
}

type GroupContextValue = {
  orientation: Orientation;
  layout: Layout;
  register: (id: string, spec: PanelSpec) => () => void;
  moveBy: (index: number, delta: number) => void;
  dragFrom: (index: number, start: number[], deltaPx: number) => void;
  commit: () => void;
  reset: () => void;
  total: () => number;
};

const GroupContext = createContext<GroupContextValue | null>(null);

function useGroup(name: string) {
  const context = useContext(GroupContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <ResizablePanelGroup>`);
  return context;
}

function storageKey(autoSaveId: string, count: number) {
  return `resizable:${autoSaveId}:${count}`;
}

function readSaved(autoSaveId: string | undefined, count: number) {
  if (!autoSaveId) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(autoSaveId, count)) ?? "null");
    return Array.isArray(saved) && saved.length === count && saved.every((n) => typeof n === "number") ? (saved as number[]) : null;
  } catch {
    return null;
  }
}

export function ResizablePanelGroup({
  orientation = "horizontal",
  autoSaveId,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { orientation?: Orientation; autoSaveId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const specs = useRef(new Map<string, PanelSpec>());
  const [layout, setLayout] = useState<Layout>({ ids: [], sizes: [] });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [version, setVersion] = useState(0);

  const total = useCallback(() => {
    const element = ref.current;
    if (!element) return 0;
    return orientation === "horizontal" ? element.clientWidth : element.clientHeight;
  }, [orientation]);

  const register = useCallback((id: string, spec: PanelSpec) => {
    specs.current.set(id, spec);
    setVersion((v) => v + 1);
    return () => {
      specs.current.delete(id);
      setVersion((v) => v + 1);
    };
  }, []);

  const panelIds = useCallback(
    () =>
      Array.from(ref.current?.children ?? [])
        .map((child) => (child as HTMLElement).dataset.panelId)
        .filter((id): id is string => Boolean(id && specs.current.has(id))),
    [],
  );

  const fresh = useCallback(
    (ignoreSaved: boolean): Layout => {
      const ids = panelIds();
      const saved = ignoreSaved ? null : readSaved(autoSaveId, ids.length);
      return { ids, sizes: saved ?? initialSizes(ids.map((id) => specs.current.get(id) ?? {}), total(), remPx()) };
    },
    [autoSaveId, panelIds, total],
  );

  // Al entrar o salir un panel (abrir el copiloto) se reparte de nuevo, antes de pintar.
  useLayoutEffect(() => {
    if (version) setLayout(fresh(false));
  }, [version, fresh]);

  const limits = useCallback(() => {
    const size = total();
    const rem = remPx();
    return layoutRef.current.ids.map((id) => {
      const spec = specs.current.get(id) ?? {};
      return { min: toPercent(spec.minSize, size, rem) ?? 0, max: toPercent(spec.maxSize, size, rem) ?? 100 };
    });
  }, [total]);

  const commit = useCallback(() => {
    if (!autoSaveId) return;
    try {
      localStorage.setItem(storageKey(autoSaveId, layoutRef.current.sizes.length), JSON.stringify(layoutRef.current.sizes));
    } catch {
      // Sin almacenamiento (modo privado): el reparto vale solo para esta visita.
    }
  }, [autoSaveId]);

  const value: GroupContextValue = {
    orientation,
    layout,
    register,
    total,
    commit,
    moveBy: (index, delta) => setLayout((current) => ({ ...current, sizes: resizeSizes(current.sizes, index, delta, limits()) })),
    dragFrom: (index, start, deltaPx) => {
      const size = total();
      if (size) setLayout((current) => ({ ...current, sizes: resizeSizes(start, index, (deltaPx / size) * 100, limits()) }));
    },
    reset: () => {
      if (autoSaveId) {
        try {
          localStorage.removeItem(storageKey(autoSaveId, layoutRef.current.ids.length));
        } catch {
          // Igual que en commit.
        }
      }
      setLayout(fresh(true));
    },
  };

  return (
    <GroupContext.Provider value={value}>
      <div
        ref={ref}
        data-slot="resizable-panel-group"
        data-orientation={orientation}
        // Vertical llena el alto de su panel; horizontal toma el alto de su contenido (en un grid, h-full se resuelve mal).
        className={cn("flex w-full", orientation === "vertical" && "h-full flex-col", className)}
        {...props}
      >
        {children}
      </div>
    </GroupContext.Provider>
  );
}

function cssSize(size: Size | undefined) {
  return typeof size === "number" ? `${size}%` : size;
}

export function ResizablePanel({
  defaultSize,
  minSize,
  maxSize,
  className,
  style,
  ...props
}: ComponentProps<"div"> & PanelSpec) {
  const { orientation, layout, register } = useGroup("ResizablePanel");
  const id = useId();
  useLayoutEffect(() => register(id, { defaultSize, minSize, maxSize }), [register, id, defaultSize, minSize, maxSize]);

  const index = layout.ids.indexOf(id);
  const size = index >= 0 ? layout.sizes[index] : undefined;
  const fallback = defaultSize === undefined || typeof defaultSize === "number" || defaultSize.trim().endsWith("%")
    ? `${toPercent(defaultSize, 0) ?? 1} 1 0px`
    : `0 0 ${defaultSize}`;
  const horizontal = orientation === "horizontal";
  const sizing: CSSProperties = {
    flex: size === undefined ? fallback : `${size} 1 0px`,
    [horizontal ? "minWidth" : "minHeight"]: cssSize(minSize) ?? 0,
    [horizontal ? "maxWidth" : "maxHeight"]: cssSize(maxSize),
  };
  return <div id={id} data-slot="resizable-panel" data-panel-id={id} className={className} style={{ ...sizing, ...style }} {...props} />;
}

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: ComponentProps<"div"> & { withHandle?: boolean }) {
  const group = useGroup("ResizableHandle");
  const { orientation, layout } = group;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: number; start: number[]; pointer: number } | null>(null);
  const [before, setBefore] = useState<string | undefined>();
  useLayoutEffect(() => setBefore((ref.current?.previousElementSibling as HTMLElement | null)?.dataset.panelId), [layout.ids]);
  const index = before ? layout.ids.indexOf(before) : -1;
  const horizontal = orientation === "horizontal";

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (index < 0 || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: index, start: layout.sizes, pointer: horizontal ? event.clientX : event.clientY };
    document.documentElement.dataset.resizing = orientation;
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    group.dragFrom(drag.current.from, drag.current.start, (horizontal ? event.clientX : event.clientY) - drag.current.pointer);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    delete document.documentElement.dataset.resizing;
    group.commit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (index < 0) return;
    const keys: Record<string, number> = horizontal
      ? { ArrowLeft: -STEP, ArrowRight: STEP, Home: -100, End: 100 }
      : { ArrowUp: -STEP, ArrowDown: STEP, Home: -100, End: 100 };
    const delta = keys[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    group.moveBy(index, delta);
    requestAnimationFrame(group.commit);
  }

  const now = index >= 0 ? layout.sizes[index] : undefined;
  return (
    <div
      ref={ref}
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-controls={before}
      aria-valuenow={now === undefined ? undefined : Math.round(now)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={props["aria-label"] ?? "Cambiar tamaño"}
      data-slot="resizable-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={group.reset}
      className={cn(
        // Línea de 1 px con 9 px de zona de agarre (::after); morada al pasar, arrastrar o enfocar.
        "relative flex shrink-0 touch-none items-center justify-center bg-separator transition-colors select-none",
        "after:absolute hover:bg-[var(--nora-purple)] focus-visible:bg-[var(--nora-purple)] focus-visible:outline-none",
        horizontal ? "w-px cursor-col-resize after:inset-y-0 after:-inset-x-1" : "h-px cursor-row-resize after:inset-x-0 after:-inset-y-1",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className={cn("relative flex items-center justify-center rounded-sm border border-separator bg-white text-muted", horizontal ? "h-6 w-3" : "h-3 w-6")}>
          <GripVerticalIcon className={cn("size-2.5", !horizontal && "rotate-90")} />
        </div>
      ) : null}
    </div>
  );
}
