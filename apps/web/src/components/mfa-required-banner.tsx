"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * La organización exige 2FA y esta sesión no la ha pasado: la API rechaza sus
 * peticiones (`mfa_required`), así que se dice arriba y se lleva a Seguridad.
 */
export function MfaRequiredBanner({ required }: { required: boolean }) {
  const [level, setLevel] = useState<string | null>(null);

  useEffect(() => {
    if (!required) return;
    let cancelled = false;
    void getSupabaseClient()
      .auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data }) => {
        if (!cancelled) setLevel(data?.currentLevel ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [required]);

  if (!required || level === null || level === "aal2") return null;
  return (
    <div role="alert" className="bg-warning px-4 py-2 text-center text-sm text-foreground">
      Esta cuenta exige la verificación en dos pasos.{" "}
      <Link href="/configuracion?section=seguridad" className="font-medium underline underline-offset-2">
        Actívala en Seguridad
      </Link>{" "}
      y vuelve a entrar.
    </div>
  );
}
