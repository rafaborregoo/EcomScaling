"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchBootstrap, getAccessToken } from "@/lib/bootstrap";

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

        const bootstrap = await fetchBootstrap(token);
        const isConsultant = ["platform_admin", "consultant"].includes(
          bootstrap.profile.platform_role,
        );
        router.replace(isConsultant ? "/consultor" : "/dashboard");
      } catch {
        router.replace("/login");
      }
    }

    void route();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-black">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">EcomScaling IA</p>
    </main>
  );
}
