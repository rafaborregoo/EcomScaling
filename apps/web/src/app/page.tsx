"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchBootstrap, getAccessToken } from "@/lib/bootstrap";
import { LoadingBlock } from "@/components/ui";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function route() {
      try {
        const token = await getAccessToken();

        if (!token) {
          router.replace("/login");
          return;
        }

        await fetchBootstrap(token);
        // Todos aterrizan en Dashboard: para el consultor es la vista general
        // de su cartera, para el cliente es la de su tienda.
        router.replace("/dashboard");
      } catch {
        router.replace("/login");
      }
    }

    void route();
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-foreground">
      <LoadingBlock label="Preparando tu espacio de trabajo…" />
    </main>
  );
}
