"use client";

import { type FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { PasswordRequirements } from "@/components/password-requirements";
import { PasswordConfirmation } from "@/components/password-confirmation";
import { PasswordInput } from "@/components/password-input";
import {
  getPasswordErrorMessage,
  isPasswordValid,
  PASSWORD_MIN_LENGTH,
  passwordConfirmationState,
} from "@/lib/password-policy";
import {
  Banner,
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
 * Alta por cuenta propia. La organizacion no se crea aqui: se crea en /planes,
 * con la sesion ya en la mano (ver `apps/api/src/registro.ts`). El proyecto
 * exige confirmar el correo, asi que entre el registro y la sesion hay un paso
 * que no controlamos -- y crear la organizacion antes de saber que el correo es
 * de verdad llenaria la tabla de organizaciones fantasma.
 *
 * §16: si llega con `?code=`, el codigo viaja en el metadata del usuario --
 * sobrevive al viaje por el correo de confirmacion sin depender de que la
 * URL de vuelta lo lleve tambien. /planes lo lee de ahi y lo manda a
 * /v1/mi-organizacion, que vincula la organizacion nueva a la consultora que
 * lo genero en la MISMA llamada que la crea.
 */
function RegistroContent() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteCode = (params.get("code") ?? "").toUpperCase().trim();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (
      !isPasswordValid(password) ||
      passwordConfirmationState(password, confirm) !== "match"
    ) {
      setError(
        "La contraseña debe cumplir los requisitos y coincidir en ambos campos.",
      );
      return;
    }
    setIsSubmitting(true);

    try {
      const { data, error: signUpError } =
        await getSupabaseClient().auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            // Al onboarding y no directo a /planes: el portal manda alli a
            // cualquiera con `onboarding_completed_at` nulo, asi que pasar de
            // largo solo aplazaba el rebote. El onboarding se salta la
            // contraseña para estas cuentas y termina en /planes.
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: {
              full_name: fullName.trim() || null,
              business_name: businessName.trim() || null,
              // Lo que distingue esta cuenta de una invitada: ya trae
              // contraseña y nombre puestos por su dueño.
              self_signup: true,
              ...(inviteCode ? { pending_invite_code: inviteCode } : {}),
            },
          },
        });

      if (signUpError) {
        setError(getPasswordErrorMessage(signUpError));
        return;
      }

      // Con confirmacion por correo activada no llega sesion: `session` viene
      // nula y el usuario tiene que pasar por su bandeja. Si algun dia se
      // desactiva, entra directo y no hay que tocar nada aqui.
      if (data.session) {
        router.push("/onboarding");
        return;
      }
      setEnviado(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (enviado) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
        <Card title="Revisa tu correo">
          <Banner tone="success">
            Te hemos enviado un enlace a {email}. Ábrelo para confirmar la
            cuenta y elegir tu plan.
          </Banner>
          <p className="mt-4 text-sm leading-6 text-muted">
            Si no aparece en unos minutos, mira en spam.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className={EYEBROW}>EcomScaling</p>
        <Heading level={1}>Crea tu cuenta</Heading>
        {inviteCode ? (
          <p className="mt-2 text-sm text-muted">
            Tu organización quedará vinculada a tu consultor al crearla.
          </p>
        ) : null}
      </div>

      <Card>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field label="Tu nombre">
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />
          </Field>
          <Field label="Nombre de tu negocio">
            <Input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              autoComplete="organization"
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Contraseña">
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
          </Field>

          <PasswordRequirements password={password} />

          <PasswordConfirmation
            password={password}
            value={confirm}
            onChange={setConfirm}
          />

          {error ? <ErrorBlock>{error}</ErrorBlock> : null}

          <Button
            type="submit"
            disabled={
              isSubmitting ||
              !isPasswordValid(password) ||
              passwordConfirmationState(password, confirm) !== "match"
            }
          >
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link className="underline" href="/login">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando..." />}>
      <RegistroContent />
    </Suspense>
  );
}
