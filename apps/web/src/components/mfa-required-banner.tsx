"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { Banner } from "@/components/ui/banner";
import { buttonVariants } from "@/components/ui/button";

/**
 * La organización exige 2FA y esta sesión no la ha pasado: la API rechaza sus
 * peticiones (`mfa_required`), así que se dice arriba. Si la cuenta ya tiene
 * la app configurada, falta solo el código (se pide en /login); si no, se
 * lleva a Seguridad a activarla.
 */
export function MfaRequiredBanner({ required }: { required: boolean }) {
  const [level, setLevel] = useState<{ current: string; next: string } | null>(null);

  useEffect(() => {
    if (!required) return;
    let cancelled = false;
    void getSupabaseClient()
      .auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data }) => {
        if (!cancelled && data?.currentLevel) setLevel({ current: data.currentLevel, next: data.nextLevel ?? data.currentLevel });
      });
    return () => {
      cancelled = true;
    };
  }, [required]);

  if (!required || level === null || level.current === "aal2") return null;
  if (level.next === "aal2") {
    return (
      <Banner
        tone="warn"
        className="rounded-none border-x-0 border-t-0 px-6 py-3 lg:px-10"
        title="Falta el código de tu app de autenticación"
        action={
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Escribir el código
          </Link>
        }
      >
        Esta cuenta pide verificación en dos pasos. Hasta que escribas el código no se puede trabajar en ella.
      </Banner>
    );
  }
  return (
    <Banner
      tone="warn"
      className="rounded-none border-x-0 border-t-0 px-6 py-3 lg:px-10"
      title="Esta cuenta pide verificación en dos pasos"
      action={
        <Link href="/configuracion?section=seguridad" className={buttonVariants({ size: "sm" })}>
          Activarla
        </Link>
      }
    >
      Actívala en Seguridad y vuelve a entrar. Hasta entonces no se puede trabajar en la cuenta.
    </Banner>
  );
}
