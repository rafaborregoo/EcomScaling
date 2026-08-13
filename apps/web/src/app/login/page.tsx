"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { fetchBootstrap, getAccessToken } from "@/lib/bootstrap";
import { Button, ErrorBlock, Field, Input, LoadingBlock } from "@/components/ui";

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
      setError(signInFailure instanceof Error ? signInFailure.message : "No se pudo iniciar sesión.");
      return;
    }

    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message);
      return;
    }

    // Consultores y admins aterrizan directamente en su panel de clientes;
    // los clientes, en el dashboard de su tienda.
    try {
      const token = await getAccessToken();
      const bootstrap = token ? await fetchBootstrap(token) : null;
      const isConsultant = ["platform_admin", "consultant"].includes(
        bootstrap?.profile.platform_role ?? "",
      );
      router.push(isConsultant ? "/consultor" : "/dashboard");
    } catch {
      router.push("/dashboard");
    }
  }

  return (
    <main className="grid min-h-screen bg-white text-black lg:grid-cols-2">
      {/* Panel de marca (oculto en móvil) */}
      <aside className="hidden flex-col justify-between border-r border-line p-10 lg:flex">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand">
          EcomScaling IA
        </p>
        <div>
          <h2 className="font-display text-4xl leading-tight">
            El centro operativo para escalar tiendas ecommerce.
          </h2>
        </div>
        <p className="font-mono text-xs text-muted">Acceso para consultores y clientes.</p>
      </aside>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-white px-6 py-12 text-black">
        <section className="w-full max-w-sm">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand lg:hidden">
            EcomScaling IA
          </p>
          <h1 className="mt-2 font-display text-3xl lg:mt-0">Inicia sesión</h1>

          {sessionReason && REASON_MESSAGES[sessionReason] ? (
            <p className="mt-4 rounded-md border border-line bg-warn-tint px-3 py-2 text-sm">
              {REASON_MESSAGES[sessionReason]}
            </p>
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
        </section>
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
