"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchBootstrap, getAccessToken } from "@/lib/bootstrap";

/** Quien ya tiene sesión entra directo al portal; el resto ve la página pública. */
export function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function route() {
      try {
        const token = await getAccessToken();
        if (!token) return;
        await fetchBootstrap(token);
        router.replace("/dashboard");
      } catch {
        // Sin sesión válida: se queda en la página pública.
      }
    }

    void route();
  }, [router]);

  return null;
}
