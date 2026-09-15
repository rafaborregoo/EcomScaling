"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import {
  Banner,
  Button,
  Card,
  cn,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  Input,
  LoadingBlock,
} from "@/components/ui";

// FE-01: antes una sesion expirada (o un signOut forzado por el backend, ej.
// consultor suspendido en caliente) redirigia aqui en silencio -- el usuario
// no sabia por que "le echaron". `PortalShell` distingue si habia una sesion
// previa (expirada) de no haber ninguna (primera visita/ya cerrada sesion) y
// solo en el primer caso anade `?reason=session_expired`.
const REASON_MESSAGES: Record<string, string> = {
  session_expired: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionReason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    let signInError: { message: string } | null = null;
    try {
      const result = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      signInError = result.error;
    } catch (signInFailure) {
      setIsSubmitting(false);
      setError(
        signInFailure instanceof Error
          ? signInFailure.message
          : "No se pudo iniciar sesión.",
      );
      return;
    }

    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message);
      return;
    }

    // Todos aterrizan en Dashboard: vista general de la cartera para el
    // consultor, de la tienda para el cliente.
    router.push("/dashboard");
    setIsSubmitting(false);
  }

  return (
    <main className="grid min-h-dvh bg-white text-foreground lg:grid-cols-2">
      {/* Panel de marca (oculto en móvil) */}
      <aside className="hidden flex-col justify-between border-r border-separator p-10 lg:flex">
        <p className={cn(EYEBROW, "text-accent")}>EcomScaling IA</p>
        <div>
          <Heading level={2} size="lg" className="max-w-xl">
            El centro operativo para escalar tiendas ecommerce.
          </Heading>
        </div>
        <p className="text-xs text-muted">
          Acceso para consultores y clientes.
        </p>
      </aside>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-surface px-6 py-12 text-foreground lg:px-12">
        <Card
          className="w-full max-w-md"
          title="Inicia sesión"
          description="Accede al centro operativo de tu organización."
        >
          <p className={cn(EYEBROW, "text-accent lg:hidden")}>EcomScaling IA</p>

          <div
            className="mt-4 grid grid-cols-2 gap-2"
            aria-label="Tipos de acceso"
          >
            <div className="rounded-md border border-separator bg-surface p-3">
              <p className="text-sm font-medium">Consultor</p>
              <p className="mt-1 text-xs text-muted">
                Agencia, tiendas y clientes.
              </p>
            </div>
            <div className="rounded-md border border-separator bg-surface p-3">
              <p className="text-sm font-medium">Cliente</p>
              <p className="mt-1 text-xs text-muted">Tu propia organización.</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            El mismo acceso detecta automáticamente el tipo de cuenta y su plan.
          </p>

          {sessionReason && REASON_MESSAGES[sessionReason] ? (
            <Banner tone="warn" className="mt-4 text-sm">
              {REASON_MESSAGES[sessionReason]}
            </Banner>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            {error ? <ErrorBlock>{error}</ErrorBlock> : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando..." />}>
      <LoginPageContent />
    </Suspense>
  );
}
