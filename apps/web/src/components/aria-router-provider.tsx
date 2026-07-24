"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RouterProvider } from "@heroui/react";

// Sin esto, el Link real de HeroUI (React Aria) no sabe nada del router de
// Next.js y hace recarga completa de pagina en cada navegacion. Este
// provider le pasa el router.push de Next para que la navegacion siga siendo
// client-side, tal como con next/link.
export function AriaRouterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={(href) => router.push(String(href))}>{children}</RouterProvider>;
}
