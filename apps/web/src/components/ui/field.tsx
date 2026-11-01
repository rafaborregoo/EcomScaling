"use client";

import { createContext, useContext, useId, useLayoutEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

// Campo único de la app con la API de shadcn: Field > FieldLabel + control +
// FieldDescription + FieldError; FieldGroup apila campos, FieldSet + FieldLegend
// los agrupa con semántica y FieldSeparator los divide. Son elementos nativos;
// los estilos viven en globals.css (`.ui-field*`, dentro de @layer components).
//
// Diferencia deliberada con shadcn: Field reparte ids por contexto. FieldLabel
// apunta solo al control (Input, Textarea, Select, Checkbox, DatePicker,
// SearchableSelect…) y el control enlaza solo la ayuda y el error, así que no
// hace falta inventar `id`/`htmlFor` en cada formulario. Un `id` o `htmlFor`
// explícito gana; si pones uno, pon los dos.
//
// `<Field label="…" hint="…" error="…">control</Field>` es el atajo que usa casi
// toda la app: un control por campo.

type FieldIds = { controlId: string; labelId: string; descriptionId: string; errorId: string; invalid: boolean };

const FieldContext = createContext<FieldIds | null>(null);

/**
 * Props que un control pone por defecto dentro de un Field: su id (al que
 * apunta la etiqueta), la ayuda y el error como descripción y el estado
 * inválido. Lo que el control reciba explícitamente gana (un `aria-label`
 * propio también gana a la etiqueta al nombrarlo, como en HTML). Un control
 * por Field: si una fila lleva varios («% + fijo»), los demás llevan su propio
 * `id` o van dentro de <NoField>.
 */
export function useFieldControl(
  props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"] } = {},
) {
  const field = useContext(FieldContext);
  if (!field) return { props: { id: props.id, "aria-describedby": props["aria-describedby"], "aria-invalid": props["aria-invalid"] }, labelId: undefined, inField: false };
  return {
    /** Para esparcir en el elemento que recibe el foco. */
    props: {
      id: props.id ?? field.controlId,
      "aria-describedby": [props["aria-describedby"], field.descriptionId, field.invalid ? field.errorId : undefined].filter(Boolean).join(" ") || undefined,
      "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    },
    labelId: field.labelId,
    inField: true,
  };
}

/** Corta el contexto: para controles compuestos cuyas piezas internas no son «el» control del campo. */
export function NoField({ children }: { children: ReactNode }) {
  return <FieldContext.Provider value={null}>{children}</FieldContext.Provider>;
}

export type FieldOrientation = "vertical" | "horizontal" | "responsive";

export function Field({
  orientation = "vertical",
  label,
  hint,
  error,
  className,
  children,
  "data-invalid": dataInvalid,
  ...props
}: ComponentProps<"div"> & {
  orientation?: FieldOrientation;
  /** Atajo: etiqueta del control. Con ella Field pinta FieldLabel, FieldDescription y FieldError. */
  label?: ReactNode;
  hint?: ReactNode;
  /** Mensaje de error; marca el control como inválido. */
  error?: ReactNode;
  "data-invalid"?: boolean;
}) {
  const id = useId();
  const invalid = Boolean(error) || Boolean(dataInvalid);
  const ids: FieldIds = { controlId: `${id}-control`, labelId: `${id}-label`, descriptionId: `${id}-description`, errorId: `${id}-error`, invalid };
  return (
    <FieldContext.Provider value={ids}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        data-invalid={invalid || undefined}
        className={cn("ui-field", className)}
        {...props}
      >
        {label !== undefined ? <FieldLabel>{label}</FieldLabel> : null}
        {children}
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Etiqueta y descripción juntas, al lado de un Checkbox o Switch en un Field horizontal. */
export function FieldContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-content" className={cn("ui-field__content", className)} {...props} />;
}

export function FieldLabel({ className, htmlFor, id, ...props }: ComponentProps<"label">) {
  const field = useContext(FieldContext);
  // Si el control no tomó el id (un Select de HeroUI, un Switch, botones), el
  // `for` apuntaría a nada: se quita y el control se nombra por aria-labelledby.
  const target = htmlFor ?? field?.controlId;
  const [linked, setLinked] = useState(true);
  // Sin dependencias a propósito: el control puede aparecer después (un campo condicional).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const exists = !target || Boolean(document.getElementById(target));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee el DOM tras pintar; solo cambia si cambia
    if (exists !== linked) setLinked(exists);
  });
  return (
    <label
      data-slot="field-label"
      id={id ?? field?.labelId}
      htmlFor={linked ? target : undefined}
      className={cn("ui-field__label", className)}
      {...props}
    />
  );
}

/** Título sin <label>: para un Slider, un grupo de botones o el título de una tarjeta de elección. */
export function FieldTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-title" className={cn("ui-field__title", className)} {...props} />;
}

export function FieldDescription({ className, id, ...props }: ComponentProps<"p">) {
  const field = useContext(FieldContext);
  return <p data-slot="field-description" id={id ?? field?.descriptionId} className={cn("ui-field__description", className)} {...props} />;
}

/** Error del campo. Acepta `children` o la lista `errors` de un validador (se quitan los repetidos). */
export function FieldError({
  className,
  children,
  errors,
  id,
  ...props
}: ComponentProps<"div"> & { errors?: Array<{ message?: string } | undefined> }) {
  const field = useContext(FieldContext);
  const messages = [...new Set((errors ?? []).map((error) => error?.message).filter(Boolean))];
  const content = children ?? (messages.length === 1 ? messages[0] : messages.length ? (
    <ul className="ml-4 flex list-disc flex-col gap-1">{messages.map((message) => <li key={message}>{message}</li>)}</ul>
  ) : null);
  if (!content) return null;
  return (
    <div role="alert" data-slot="field-error" id={id ?? field?.errorId} className={cn("ui-field__error", className)} {...props}>
      {content}
    </div>
  );
}

/** Pila de campos (o de FieldSet) con el mismo aire entre ellos. */
export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("ui-field-group", className)} {...props} />;
}

export function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return <fieldset data-slot="field-set" className={cn("ui-field-set", className)} {...props} />;
}

/** `variant="label"`: leyenda del tamaño de una etiqueta, para un grupo de casillas o radios. */
export function FieldLegend({ variant = "legend", className, ...props }: ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return <legend data-slot="field-legend" data-variant={variant} className={cn("ui-field-legend", className)} {...props} />;
}

/** Línea entre campos; con texto, el texto va en medio («O continúa con»). */
export function FieldSeparator({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="field-separator" data-content={children ? "" : undefined} className={cn("ui-field-separator", className)} {...props}>
      {children ? <span className="ui-field-separator__content">{children}</span> : null}
    </div>
  );
}
