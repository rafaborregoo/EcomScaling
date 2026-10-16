import { connectionNeedsReconnect } from "@e-nora/contracts";

/**
 * Errores de autorización o permisos no se arreglan repitiendo la petición.
 * El resto se puede reintentar en el siguiente ciclo programado. Misma regla
 * que el punto rojo y los avisos (packages/contracts/src/connection-reconnect.ts).
 */
export function requiresIntegrationReauthorization(
  message: string | null | undefined,
): boolean {
  return connectionNeedsReconnect({ status: "error", last_error_message: message ?? null });
}
