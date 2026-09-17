"use client";

import {
  PASSWORD_MIN_LENGTH,
  passwordConfirmationState,
} from "@/lib/password-policy";
import { Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export function PasswordConfirmation({
  password,
  value,
  onChange,
}: {
  password: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const state = passwordConfirmationState(password, value);
  const statusId = "password-confirmation-status";

  return (
    <>
      <Field label="Repite la contraseña">
        <PasswordInput
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          aria-invalid={state === "mismatch"}
          aria-describedby={statusId}
        />
      </Field>
      <p
        id={statusId}
        aria-live="polite"
        role={state === "mismatch" ? "alert" : "status"}
        className={
          state === "mismatch"
            ? "text-xs text-danger"
            : state === "match"
              ? "text-xs text-success"
              : "sr-only"
        }
      >
        {state === "mismatch"
          ? "Las contraseñas no coinciden."
          : state === "match"
            ? "Las contraseñas coinciden."
            : "Repite la contraseña para confirmar."}
      </p>
    </>
  );
}
