"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { PasswordRequirements } from "@/components/password-requirements";
import {
  getPasswordErrorMessage,
  isPasswordValid,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-policy";
import {
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  Input,
  LoadingBlock,
} from "@/components/ui";

/**
 * Segundo paso de la recuperacion. El enlace del correo deja una sesion de tipo
 * `recovery` ya montada, asi que aqui no se pide nada mas que la contraseña
 * nueva: la prueba de identidad fue abrir el enlace.
 *
 * Si no hay sesion, el enlace ha caducado o ya se uso. Se dice, en vez de
 * enseñar un formulario que fallaria al guardar.
 */
export default function NuevaContrasenaPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [comprobando, setComprobando] = useState(true);
  const [haySesion, setHaySesion] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function comprobar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelado) return;
      setHaySesion(Boolean(session));
      setComprobando(false);
    }
    void comprobar();
    return () => {
      cancelado = true;
    };
  }, [supabase]);

  const corta = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const noCoincide = confirm.length > 0 && confirm !== password;
  const puedeEnviar =
    isPasswordValid(password) && confirm === password && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(getPasswordErrorMessage(updateError));
        return;
      }
      router.replace("/dashboard");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo guardar la contraseña.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (comprobando) return <LoadingBlock label="Cargando..." />;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className={EYEBROW}>EcomScaling</p>
        <Heading level={1}>Nueva contraseña</Heading>
      </div>

      {!haySesion ? (
        <Card
          title="Enlace no válido"
          description="Ha caducado o ya se usó. Pide uno nuevo."
        >
          <Button className="mt-4" onClick={() => router.push("/recuperar")}>
            Pedir otro enlace
          </Button>
        </Card>
      ) : (
        <Card>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <Field label="Contraseña">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                required
              />
            </Field>
            <PasswordRequirements password={password} />
            {corta ? (
              <p className="text-xs text-danger">Mínimo 8 caracteres.</p>
            ) : null}

            <Field label="Repite la contraseña">
              <Input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            {noCoincide ? (
              <p className="text-xs text-danger">
                Las contraseñas no coinciden.
              </p>
            ) : null}

            {error ? <ErrorBlock>{error}</ErrorBlock> : null}

            <Button type="submit" disabled={!puedeEnviar}>
              {isSubmitting ? "Guardando..." : "Guardar y entrar"}
            </Button>
          </form>
        </Card>
      )}

      <p className="text-center text-sm text-muted">
        <Link className="underline" href="/login">
          Volver a iniciar sesión
        </Link>
      </p>
    </main>
  );
}
