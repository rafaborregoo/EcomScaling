"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { useFieldControl } from "./field";

// Código de un solo uso (verificación en dos pasos, códigos por email) con la
// API de shadcn: InputOTP > InputOTPGroup > InputOTPSlot, InputOTPSeparator.
// Nativo: un único <input> transparente encima de las casillas, así pegar,
// el autorrelleno del SMS/llavero (`autocomplete="one-time-code"`) y los
// lectores de pantalla ven un campo normal; las casillas solo pintan. Dentro
// de un Field toma su id, ayuda y error. Estilos: `.ui-otp` en globals.css.

export const REGEXP_ONLY_DIGITS = "^\\d+$";
export const REGEXP_ONLY_CHARS = "^[a-zA-Z]+$";
export const REGEXP_ONLY_DIGITS_AND_CHARS = "^[a-zA-Z0-9]+$";

type OtpContextValue = { value: string; maxLength: number; focused: boolean; invalid: boolean };

const OtpContext = createContext<OtpContextValue | null>(null);

export function InputOTP({
  maxLength,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onComplete,
  pattern = REGEXP_ONLY_DIGITS,
  className,
  containerClassName,
  children,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "maxLength" | "pattern"> & {
  maxLength: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Se llama al escribir o pegar la última cifra. */
  onComplete?: (value: string) => void;
  /** Expresión que tiene que cumplir cada carácter (REGEXP_ONLY_DIGITS por defecto). */
  pattern?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const value = controlledValue ?? uncontrolledValue;
  const field = useFieldControl(props).props;
  const invalid = Boolean(field["aria-invalid"] ?? props["aria-invalid"]);
  const allowed = new RegExp(pattern);
  const inputRef = useRef<HTMLInputElement>(null);
  // Al recargar, el navegador restaura en el <input> el código de antes sin
  // que React lo sepa: las casillas saldrían vacías y lo escrito se sumaría a
  // ese valor fantasma. El input siempre enseña el estado.
  useLayoutEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) inputRef.current.value = value;
  });

  const change = (raw: string) => {
    // Pegar «123 456» o «123-456» deja «123456»; lo que no cumple el patrón no entra.
    const next = [...raw.replace(/[\s-]/g, "")].filter((char) => allowed.test(char)).join("").slice(0, maxLength);
    if (next === value) return;
    if (controlledValue === undefined) setUncontrolledValue(next);
    onChange?.(next);
    if (next.length === maxLength) onComplete?.(next);
  };

  return (
    <OtpContext.Provider value={{ value, maxLength, focused, invalid }}>
      <div
        data-slot="input-otp"
        data-disabled={props.disabled || undefined}
        className={cn("ui-otp", containerClassName)}
      >
        {children}
        <input
          ref={inputRef}
          autoComplete="one-time-code"
          inputMode={pattern === REGEXP_ONLY_DIGITS ? "numeric" : "text"}
          spellCheck={false}
          {...props}
          {...field}
          value={value}
          data-slot="input-otp-input"
          className={cn("ui-otp__input", className)}
          onChange={(event) => change(event.target.value)}
          // El cursor siempre al final: se borra y se escribe desde la última casilla.
          onSelect={(event) => {
            const input = event.currentTarget;
            if (input.selectionStart !== input.value.length) input.setSelectionRange(input.value.length, input.value.length);
          }}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
        />
      </div>
    </OtpContext.Provider>
  );
}

export function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className={cn("ui-otp__group", className)} {...props} />;
}

export function InputOTPSlot({ index, className, "aria-invalid": ariaInvalid, ...props }: ComponentProps<"div"> & { index: number }) {
  const otp = useContext(OtpContext);
  if (!otp) throw new Error("InputOTPSlot tiene que ir dentro de <InputOTP>");
  const char = otp.value[index];
  // Activa la casilla donde va la siguiente cifra; con el código completo, la última.
  const active = otp.focused && index === Math.min(otp.value.length, otp.maxLength - 1);
  return (
    <div
      aria-hidden
      data-slot="input-otp-slot"
      data-active={active || undefined}
      data-invalid={Boolean(ariaInvalid) || otp.invalid || undefined}
      className={cn("ui-otp__slot", className)}
      {...props}
    >
      {char ?? (active ? <span className="ui-otp__caret" /> : null)}
    </div>
  );
}

export function InputOTPSeparator({ className, ...props }: ComponentProps<"div">) {
  return (
    <div role="separator" data-slot="input-otp-separator" className={cn("ui-otp__separator", className)} {...props}>
      <span />
    </div>
  );
}
