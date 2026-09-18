"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import {
  Banner,
  BrandLogo,
  Button,
  Card,
  ErrorBlock,
  Field,
  Heading,
  Input,
} from "@/components/ui";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: resetError } =
        await getSupabaseClient().auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/nueva-contrasena` },
        );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setEnviado(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo enviar el correo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <BrandLogo />
        <Heading level={1}>Recupera tu acceso</Heading>
      </div>

      {enviado ? (
        <Card title="Revisa tu correo">
          {/* A proposito no se dice si ese correo tiene cuenta o no: seria una
              forma de averiguar quien esta registrado probando direcciones. */}
          <Banner tone="success">
            Si {email} tiene cuenta, te llega un enlace para poner una
            contraseña nueva.
          </Banner>
          <p className="mt-4 text-sm leading-6 text-muted">
            El enlace caduca en una hora. Si no aparece, mira en spam.
          </p>
        </Card>
      ) : (
        <Card>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="tu@empresa.com"
                required
              />
            </Field>

            {error ? <ErrorBlock>{error}</ErrorBlock> : null}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviarme el enlace"}
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
