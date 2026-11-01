"use client";

import { type FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/bootstrap";
import {
  BrandLogo,
  Button,
  ErrorBlock,
  Field,
  Heading,
  Input,
  LoadingBlock,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

// El servidor da UNA sola respuesta para todo lo que no vale: no existe, ya
// usado, caducado o email que no coincide (§53 del modelo). Las cuatro por
// separado eran un oráculo -- se prueban códigos hasta que uno deja de decir
// "no existe" y ahí ya sabes que es real. El motivo de verdad queda en los
// logs del API, que es donde hace falta para dar soporte.
const MESSAGES: Record<string, string> = {
  invite_invalid: "El código no es válido o ya no está disponible.",
  invite_codes_not_configured:
    "Los códigos no están disponibles ahora mismo. Avisa a tu consultor.",
  link_generation_failed:
    "No se pudo iniciar sesión. Inténtalo de nuevo en un momento.",
};

// Dos formas de invitación (§16). `requires_signup: true` es un código
// suelto: no hay organización todavía, la crea el propio cliente en
// /registro → /planes. `false` es una invitación a un cliente que YA existe
// (`inviteClientMember`): ahí sigue el flujo antiguo, confirmar y entrar.
type InvitePreview =
  | { requiresSignup: true; consultantName: string; expiresAt: string }
  | {
      requiresSignup: false;
      organization: { id: string; display_name: string };
      expiresAt: string;
    };

function AccesoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(
    (params.get("code") ?? "").toUpperCase().trim(),
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);

  async function previewInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/v1/invites/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        organization?: { id: string; display_name: string };
        consultant?: { display_name: string };
        expires_at?: string;
        requires_signup?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !body?.expires_at) {
        setError(
          (body?.error && MESSAGES[body.error]) ??
            "No se pudo validar el código.",
        );
        return;
      }
      if (body.requires_signup) {
        setPreview({
          requiresSignup: true,
          consultantName: body.consultant?.display_name ?? "tu consultor",
          expiresAt: body.expires_at,
        });
      } else if (body.organization) {
        setPreview({
          requiresSignup: false,
          organization: body.organization,
          expiresAt: body.expires_at,
        });
      } else {
        setError("No se pudo validar el código.");
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvite() {
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
      const body = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.url) {
        setError(
          (body?.error && MESSAGES[body.error]) ??
            "No se pudo aceptar la invitación.",
        );
        setBusy(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setBusy(false);
      setError("Error de red. Inténtalo de nuevo.");
    }
  }

  return (
    <main className="grid min-h-dvh text-foreground lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-separator p-10 lg:flex">
        <BrandLogo />
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

      <div className="flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <BrandLogo />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Acceso con código</CardTitle>
              <CardDescription>Verifica la invitación antes de continuar.</CardDescription>
            </CardHeader>
            <CardContent>
              {preview?.requiresSignup ? (
                <div className="mt-6 space-y-5">
                  <div className="border-t border-separator pt-4">
                    <Heading level={2} size="md">
                      Vas a unirte a la cartera de {preview.consultantName}
                    </Heading>
                    <p className="mt-2 text-sm text-muted">
                      Crea tu cuenta con tu propia contraseña. Tu organización
                      queda vinculada en cuanto la creas.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() =>
                        router.push(
                          `/registro?code=${encodeURIComponent(code.trim().toUpperCase())}`,
                        )
                      }
                    >
                      Crear mi cuenta
                    </Button>
                    <Button variant="ghost" onClick={() => setPreview(null)}>
                      Volver
                    </Button>
                  </div>
                </div>
              ) : preview && !preview.requiresSignup ? (
                <div className="mt-6 space-y-5">
                  <div className="border-t border-separator pt-4">
                    <Heading level={2} size="md">
                      ¿Quieres unirte a {preview.organization.display_name}?
                    </Heading>
                    <p className="mt-2 text-sm text-muted">
                      Tendrás acceso a esta organización.
                    </p>
                  </div>
                  {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                  <div className="flex flex-wrap gap-3">
                    <Button disabled={busy} onClick={() => void acceptInvite()}>
                      {busy ? "Uniéndote..." : "Sí, unirme"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setPreview(null)}
                    >
                      Volver
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={previewInvite}>
                  <Field label="Código">
                    <Input
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.toUpperCase())
                      }
                      placeholder="XXXXXXXX"
                      autoCapitalize="characters"
                      required
                    />
                  </Field>
                  <Field label="Email (si tu consultor te lo pidió)">
                    <Input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="tu@empresa.com"
                    />
                  </Field>
                  {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                  <Button className="w-full" type="submit" disabled={busy}>
                    {busy ? "Validando..." : "Continuar"}
                  </Button>
                  <p className="text-center text-xs text-muted">
                    ¿Ya tienes cuenta?{" "}
                    <Link className="underline" href="/login">
                      Inicia sesión
                    </Link>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
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
