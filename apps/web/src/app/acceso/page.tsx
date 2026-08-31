"use client";

import { type FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/bootstrap";
import {
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

const MESSAGES: Record<string, string> = {
  invalid_input: "Revisa el código y el email.",
  invite_not_found: "No encontramos ese código. Comprueba que lo has escrito bien.",
  invite_already_used: "Este código ya se usó.",
  invite_expired: "El código ha caducado. Pídele a tu consultor uno nuevo.",
  email_mismatch: "El email no coincide con el de la invitación.",
  link_generation_failed: "No se pudo iniciar sesión. Inténtalo de nuevo en un momento.",
};

function AccesoContent() {
  const params = useSearchParams();
  const [code, setCode] = useState(
    (params.get("code") ?? "").toUpperCase().trim(),
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/v1/invites/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !body?.url) {
        setError(
          (body?.error && MESSAGES[body.error]) ??
            "No se pudo validar el código.",
        );
        setBusy(false);
        return;
      }
      // Enlace de sesión de Supabase -> establece sesión -> /onboarding.
      window.location.assign(body.url);
    } catch {
      setBusy(false);
      setError("Error de red. Inténtalo de nuevo.");
    }
  }

  return (
    <main className="grid min-h-screen bg-white text-foreground lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-separator p-10 lg:flex">
        <p className={cn(EYEBROW, "text-accent")}>EcomScaling</p>
        <Heading level={2} size="lg" className="max-w-xl">
          Activa tu cuenta con el código que te dio tu consultor.
        </Heading>
        <p className="text-xs text-muted">
          ¿Ya tienes contraseña? Entra desde{" "}
          <a href="/login" className="underline">
            iniciar sesión
          </a>
          .
        </p>
      </aside>

      <div className="flex items-center justify-center bg-surface px-6 py-12 lg:px-12">
        <Card
          className="w-full max-w-md"
          title="Acceso con código"
          description="Introduce el código de invitación y el email al que te invitaron."
        >
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <Field label="Código">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                autoCapitalize="characters"
                required
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
              />
            </Field>
            {error ? <ErrorBlock>{error}</ErrorBlock> : null}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? "Validando..." : "Entrar"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function AccesoPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando..." />}>
      <AccesoContent />
    </Suspense>
  );
}
