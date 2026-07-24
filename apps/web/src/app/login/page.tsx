"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchBootstrap, getAccessToken } from "@/lib/bootstrap";
import { Button, ErrorBlock, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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
