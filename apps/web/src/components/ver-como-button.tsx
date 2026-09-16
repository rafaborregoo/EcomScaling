"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * Entra en modo "ver como" (view-as.ts) para una organizacion CLIENTE.
 *
 * Solo clientes a proposito: un cliente no tiene mas que su propia
 * organizacion, asi que "ver como" = exactamente lo que ve su dueño en
 * /dashboard. Un consultor tiene ademas su cartera entera, scopeada del lado
 * del servidor por su propio user_id -- "ver como" un consultor mostraria el
 * portfolio vacio del propio admin, no el suyo, asi que no se ofrece aqui.
 */
export function VerComoButton({
  organizationId,
  displayName,
  size = "sm",
}: {
  organizationId: string;
  displayName: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  return (
    <Button
      size={size}
      variant="ghost"
      onClick={() =>
        router.push(
          `/dashboard?organizationId=${encodeURIComponent(organizationId)}&verComo=${encodeURIComponent(displayName)}`,
        )
      }
    >
      Ver como
    </Button>
  );
}
